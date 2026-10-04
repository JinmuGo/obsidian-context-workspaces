import { Menu, Notice, Platform, Plugin, type TFile } from 'obsidian';
import type { ContextWorkspacesSettings, PendingSpaceRequest } from './types';
import { DEFAULT_SETTINGS } from './types';
import {
	applySpaceTheme,
	backupThemeState,
	createObsidianWorkspace,
	deleteObsidianWorkspace,
	getExistingWorkspaces,
	isWorkspacesPluginEnabled,
	loadWorkspaceState,
	removeWorkspaceLoadMonitoring,
	removeWorkspaceRegistryMonitoring,
	restoreThemeState,
	saveWorkspaceState,
	setupWorkspaceLoadMonitoring,
	setupWorkspaceRegistryMonitoring,
	updateObsidianWorkspaceName,
	workspaceExistsInObsidian,
} from './utils/obsidian-utils';
import {
	generateSpaceId,
	parseSpaceData,
	searchSpaces,
} from './utils/space-utils';
import { formatStatusBarLabel } from './utils/status-bar-utils';
import { importObsidianWorkspaces } from './utils/sync-utils';
import {
	ContextWorkspacesView,
	VIEW_TYPE_CONTEXT_WORKSPACES,
} from './views/ContextWorkspacesView';
import {
	ContextWorkspacesSettingTab,
	SpaceCreateModal,
	SpaceManagerModal,
} from './wrappers';

export default class ContextWorkspacesPlugin extends Plugin {
	settings: ContextWorkspacesSettings;
	layoutChangeTimeout: number;
	switchingToSpaceId: string | null = null;
	// The persisted current id may be stale after a plugin reload, so this is
	// populated only after a workspace load has established what is visible.
	loadedWorkspaceId: string | null = null;
	internalWorkspaceLoadId: string | null = null;
	workspaceLoadInProgress = 0;
	workspaceLoadGeneration = 0;
	private pendingSpaceRequest: PendingSpaceRequest | null = null;
	private statusBarItem: HTMLElement | null = null;

	async onload() {
		await this.loadSettings();

		// Register the custom view
		this.registerView(VIEW_TYPE_CONTEXT_WORKSPACES, (leaf) => {
			return new ContextWorkspacesView(leaf, this);
		});

		// Activate view when layout is ready, unless the user opted out so their
		// last-used sidebar tab stays in front. The view leaf is still restored
		// by Obsidian's saved layout; it just isn't forced to the foreground.
		this.app.workspace.onLayoutReady(() => {
			if (this.settings.activateViewOnStartup !== false) {
				void this.activateView();
			}
		});

		// Add ribbon icon for quick toggle
		this.addRibbonIcon('layout-grid', 'Context workspaces', () => {
			void this.activateView();
		});

		// Register workspace event listeners
		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				this.handleLayoutChange();
			})
		);

		// File open event listener (for auto-connection feature)
		this.registerEvent(
			this.app.workspace.on('file-open', (file: TFile) => {
				this.handleFileOpen(file);
			})
		);

		// Add commands
		this.addCommand({
			id: 'next-space',
			name: 'Next space',
			callback: () => {
				void this.switchToNextSpace();
			},
		});

		this.addCommand({
			id: 'previous-space',
			name: 'Previous space',
			callback: () => {
				void this.switchToPreviousSpace();
			},
		});

		this.addCommand({
			id: 'create-new-space',
			name: 'Create new space',
			callback: () => {
				void this.createNewSpace();
			},
		});

		this.addCommand({
			id: 'manage-spaces',
			name: 'Manage spaces',
			callback: () => {
				this.openSpaceManager();
			},
		});

		// Add settings tab
		this.addSettingTab(new ContextWorkspacesSettingTab(this.app, this));

		// Initialize default space
		await this.initializeDefaultSpace();

		// Set up the status bar space switcher
		this.setupStatusBar();

		// Import workspaces that were created while the plugin was not running
		await this.syncMissingWorkspacesFromObsidian();

		// Setup workspace load monitoring for auto-switching
		setupWorkspaceLoadMonitoring(this.app, this);

		// Follow workspaces.json changes from other devices and native workspace edits
		setupWorkspaceRegistryMonitoring(this.app, this);

		// Backup original Obsidian theme on plugin load
		backupThemeState(this.app);

		// Apply current space theme on load
		window.setTimeout(() => {
			try {
				this.applyCurrentSpaceTheme();
			} catch (error) {
				console.error('Failed to apply current space theme on load:', error);
			}
		}, 1000); // Delay to ensure Obsidian is fully loaded
	}

	onunload() {
		// Save current state
		this.saveCurrentSpaceState();

		// Restore original Obsidian theme before unloading
		void (async () => {
			try {
				await restoreThemeState(this.app);
			} catch (error) {
				console.error('Failed to restore original Obsidian theme on unload:', error);
			}
		})();

		// Clear timeouts
		window.clearTimeout(this.layoutChangeTimeout);
		this.workspaceLoadGeneration += 1;
		this.internalWorkspaceLoadId = null;
		this.pendingSpaceRequest?.resolve(false);
		this.pendingSpaceRequest = null;

		// Drop the status bar reference (Obsidian removes the element itself)
		this.statusBarItem = null;

		// Remove workspace monitoring
		removeWorkspaceLoadMonitoring(this.app);
		removeWorkspaceRegistryMonitoring(this.app);
	}

	/**
	 * Activate the Context Workspaces view in the sidebar
	 */
	async activateView(): Promise<void> {
		const { workspace } = this.app;

		// Check if view is already open
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_CONTEXT_WORKSPACES)[0];

		if (!leaf) {
			// Create new leaf in left sidebar
			const leftLeaf = workspace.getLeftLeaf(false);
			if (leftLeaf) {
				await leftLeaf.setViewState({
					type: VIEW_TYPE_CONTEXT_WORKSPACES,
					active: true,
				});
				leaf = leftLeaf;
			}
		}

		if (leaf) {
			await workspace.revealLeaf(leaf);
		}
	}

	/**
	 * Get the active Context Workspaces view instance
	 */
	getView(): ContextWorkspacesView | null {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CONTEXT_WORKSPACES);
		if (leaves.length > 0) {
			return leaves[0].view as ContextWorkspacesView;
		}
		return null;
	}

	/**
	 * Create the status bar space switcher, if enabled.
	 */
	private setupStatusBar(): void {
		if (this.settings.showStatusBar === false) {
			return;
		}

		this.statusBarItem = this.addStatusBarItem();
		this.statusBarItem.addClass('mod-clickable');
		this.statusBarItem.setAttribute('aria-label', 'Switch space');
		this.registerDomEvent(this.statusBarItem, 'click', (evt) => {
			this.openStatusBarMenu(evt);
		});

		this.updateStatusBar();
	}

	/**
	 * Update the status bar label to reflect the current space.
	 */
	private updateStatusBar(): void {
		if (!this.statusBarItem) {
			return;
		}

		const space = this.settings.spaces[this.settings.currentSpaceId];
		this.statusBarItem.setText(space ? formatStatusBarLabel(space) : 'No space');
	}

	/**
	 * Create or remove the status bar item to match the current setting.
	 * Lets the settings toggle take effect without reloading the plugin.
	 */
	refreshStatusBar(): void {
		if (this.settings.showStatusBar === false) {
			this.statusBarItem?.remove();
			this.statusBarItem = null;
			return;
		}

		if (!this.statusBarItem) {
			this.setupStatusBar();
		} else {
			this.updateStatusBar();
		}
	}

	/**
	 * Open a menu listing all spaces for quick switching.
	 */
	private openStatusBarMenu(evt: MouseEvent): void {
		const menu = new Menu();

		for (const spaceId of this.settings.spaceOrder) {
			const space = this.settings.spaces[spaceId];
			if (!space) {
				continue;
			}

			menu.addItem((item) => {
				item.setTitle(formatStatusBarLabel(space))
					.setChecked(spaceId === this.settings.currentSpaceId)
					.onClick(() => {
						void this.switchToSpace(spaceId, 'status-bar');
					});
			});
		}

		menu.showAtMouseEvent(evt);
	}

	async loadSettings() {
		// `workspaceLastSeen` drove the removed registry-based deletion detection.
		const { workspaceLastSeen: _obsolete, ...data } = ((await this.loadData()) ?? {}) as Partial<
			ContextWorkspacesSettings
		> & { workspaceLastSeen?: unknown };
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
	}

	/**
	 * Obsidian calls this when data.json changes on disk, e.g. through a sync tool.
	 * The current space stays per device because it describes what this screen shows.
	 */
	async onExternalSettingsChange() {
		const localCurrentSpaceId = this.settings.currentSpaceId;
		await this.loadSettings();
		if (this.settings.spaces[localCurrentSpaceId]) {
			this.settings.currentSpaceId = localCurrentSpaceId;
		}
		// Another device deleted the space on screen; stop saving into it.
		if (this.loadedWorkspaceId && !this.settings.spaces[this.loadedWorkspaceId]) {
			this.cancelPendingLayoutSave();
			this.loadedWorkspaceId = null;
		}
		this.updateSidebarSpaces();
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async initializeDefaultSpace() {
		if (!isWorkspacesPluginEnabled(this.app)) {
			new Notice('Context workspaces requires the workspaces plugin to be enabled.');
			return;
		}

		// Import existing workspaces as spaces
		const existingWorkspaces = getExistingWorkspaces(this.app);

		if (Object.keys(this.settings.spaces).length === 0) {
			const shouldCreateInitialWorkspace = Object.keys(existingWorkspaces).length === 0;
			// Create initial space if no spaces exist
			const initialSpaceId = 'space-1';
			this.settings.spaces[initialSpaceId] = {
				name: 'My Space',
				icon: '🏠',
				autoSave: true,
			};

			// Convert existing workspaces to spaces
			for (const [workspaceId, workspace] of Object.entries(existingWorkspaces)) {
				if (workspaceId !== initialSpaceId) {
					this.settings.spaces[workspaceId] = {
						name: (workspace as { name?: string })?.name || workspaceId,
						icon: '📄',
						autoSave: false, // Existing workspaces use snapshot mode
					};
				}
			}

			this.settings.spaceOrder = Object.keys(this.settings.spaces);
			this.settings.currentSpaceId = initialSpaceId;
			await this.saveSettings();

			// Give the first space a backing workspace. Mobile layouts are never
			// written to the shared registry; a desktop creates it on first switch.
			if (shouldCreateInitialWorkspace && !Platform.isMobile) {
				try {
					await createObsidianWorkspace(this.app, initialSpaceId, 'My Space');
				} catch (error) {
					console.error('Failed to create the initial Obsidian workspace:', error);
					new Notice('Initial space created, but its Obsidian workspace is unavailable.');
				}
			}
		}
	}

	async switchToSpace(
		spaceId: string,
		_method: string = 'sidebar',
		skipSave = false,
		workspaceAlreadyLoaded = false,
		nativeLoadGeneration?: number,
	): Promise<boolean> {
		// Native callbacks carry their generation so they can only apply the load
		// that produced them.
		if (nativeLoadGeneration !== undefined) {
			if (nativeLoadGeneration !== this.workspaceLoadGeneration) {
				return false;
			}
		}

		if (!this.settings.spaces[spaceId]) {
			return false;
		}

		const loadedWorkspaceId = this.loadedWorkspaceId ?? this.settings.currentSpaceId;
		const isAlreadyActive =
			this.loadedWorkspaceId !== null &&
			spaceId === this.settings.currentSpaceId &&
			loadedWorkspaceId === spaceId &&
			this.workspaceLoadInProgress === 0 &&
			this.switchingToSpaceId === null;
		if (isAlreadyActive && !workspaceAlreadyLoaded) {
			return true;
		}

		// A real request supersedes delayed native callbacks. Do this after the
		// no-op check so a duplicate click does not invalidate an active load.
		if (nativeLoadGeneration === undefined) {
			this.workspaceLoadGeneration += 1;
		}

		if (this.switchingToSpaceId) {
			this.pendingSpaceRequest?.resolve(false);
			return new Promise<boolean>((resolve) => {
				this.pendingSpaceRequest = {
					spaceId,
					method: _method,
					skipSave,
					workspaceAlreadyLoaded,
					nativeLoadGeneration,
					resolve,
				};
			});
		}

		this.switchingToSpaceId = spaceId;
		this.cancelPendingLayoutSave();
		let switchSucceeded = false;

		try {
			// Save the workspace that is actually visible, not just the logical
			// currentSpaceId. Native loads can temporarily make these differ.
			if (!skipSave) {
				this.saveCurrentSpaceState();
			}

			// A native load already put this workspace on screen. Avoid loading it
			// a second time and racing the native switcher.
			if (!workspaceAlreadyLoaded) {
				await this.loadSpaceState(spaceId);
			}

			this.loadedWorkspaceId = spaceId;
			this.settings.currentSpaceId = spaceId;
			await this.saveSettings();
			switchSucceeded = true;

			// Reflect the new current space in the status bar
			this.updateStatusBar();

			// Apply space theme if configured (with error handling)
			const space = this.settings.spaces[spaceId];
			if (space && (space.theme || space.themeMode)) {
				try {
					applySpaceTheme(this.app, space.theme, space.themeMode);
				} catch (error) {
					console.error('Failed to apply space theme:', error);
					// If theme application fails, restore to original Obsidian theme
					try {
						await restoreThemeState(this.app);
					} catch (restoreError) {
						console.error('Failed to restore theme state:', restoreError);
					}
				}
			} else {
				// If no theme is configured for this space, restore to the original theme
				try {
					await restoreThemeState(this.app);
				} catch (restoreError) {
					console.error('Failed to restore original theme:', restoreError);
				}
			}

			// Update sidebar safely with delay to ensure state is stable
			window.setTimeout(() => {
				try {
					this.getView()?.render();
				} catch (error) {
					console.error('Failed to update sidebar:', error);
				}
			}, 50);

			// Show notification
			if (space) {
				const spaceIcon = space.icon || '📄';
				new Notice(`Switched to ${spaceIcon} ${space.name} space`, 2000);
			}
		} catch (error) {
			console.error(`Failed to switch to space ${spaceId}:`, error);
			// currentSpaceId remains unchanged when loading fails, so future saves
			// continue to target the workspace that is still visible.
			try {
				await restoreThemeState(this.app);
			} catch (restoreError) {
				console.error('Failed to restore theme state after switch failure:', restoreError);
			}
		} finally {
			this.switchingToSpaceId = null;

			const pendingSpaceRequest = this.pendingSpaceRequest;
			this.pendingSpaceRequest = null;
			const pendingSpaceIsActive =
			this.loadedWorkspaceId !== null &&
				pendingSpaceRequest?.spaceId === this.settings.currentSpaceId &&
				(this.loadedWorkspaceId ?? this.settings.currentSpaceId) ===
					pendingSpaceRequest?.spaceId &&
				this.workspaceLoadInProgress === 0;
			if (
				pendingSpaceRequest &&
				!pendingSpaceIsActive &&
				this.settings.spaces[pendingSpaceRequest.spaceId]
			) {
				void this.switchToSpace(
					pendingSpaceRequest.spaceId,
					pendingSpaceRequest.method,
					pendingSpaceRequest.skipSave,
					pendingSpaceRequest.workspaceAlreadyLoaded,
					pendingSpaceRequest.nativeLoadGeneration,
				).then(pendingSpaceRequest.resolve, () => pendingSpaceRequest.resolve(false));
			} else {
				pendingSpaceRequest?.resolve(pendingSpaceIsActive);
			}
		}

		return switchSucceeded;
	}

	// Handle space order changes from DnD
	onSpaceOrderChanged(newSpaceOrder: string[]) {
		// Update the plugin's space order
		this.settings.spaceOrder = newSpaceOrder;

		// Update sidebar to reflect the new order safely with delay
		window.setTimeout(() => {
			try {
				this.getView()?.render();
			} catch (error) {
				console.error('Failed to update sidebar after order change:', error);
			}
		}, 50);
	}

	saveCurrentSpaceState() {
		const loadedWorkspaceId = this.loadedWorkspaceId;
		if (!loadedWorkspaceId) {
			return;
		}

		this.saveSpaceState(loadedWorkspaceId);
	}

	cancelPendingLayoutSave() {
		window.clearTimeout(this.layoutChangeTimeout);
	}

	async loadSpaceState(spaceId: string) {
		const space = this.settings.spaces[spaceId];
		if (!space) return;

		// The space exists but its layout does not, e.g. another device created it and
		// its workspaces.json has not arrived yet. Keep the layout on screen and save it
		// for the space, as creating a space does.
		if (isWorkspacesPluginEnabled(this.app) && !workspaceExistsInObsidian(this.app, spaceId)) {
			if (Platform.isMobile) {
				new Notice(`${space.name} has no saved layout yet. Open it on desktop first.`);
				throw new Error(`Obsidian workspace not found: ${spaceId}`);
			}
			await createObsidianWorkspace(this.app, spaceId, space.name);
			new Notice(`${space.name} had no saved layout, so the current layout was saved to it.`);
			return;
		}

		try {
			// Load workspace state (this will automatically open pinned tabs)
			this.internalWorkspaceLoadId = spaceId;
			await loadWorkspaceState(this.app, spaceId);
		} catch (error) {
			console.error('Failed to load workspace state:', error);
			throw error;
		} finally {
			if (this.internalWorkspaceLoadId === spaceId) {
				this.internalWorkspaceLoadId = null;
			}
		}
	}

	switchToNextSpace() {
		// Compute from the latest requested target, even before its layout finishes
		// loading, so rapid repeated presses advance one space at a time.
		const baseId =
			this.pendingSpaceRequest?.spaceId ??
			this.switchingToSpaceId ??
			(this.loadedWorkspaceId && this.settings.spaces[this.loadedWorkspaceId]
				? this.loadedWorkspaceId
				: this.settings.currentSpaceId);
		const currentIndex = this.settings.spaceOrder.indexOf(baseId);
		const nextIndex = (currentIndex + 1) % this.settings.spaceOrder.length;
		const nextSpaceId = this.settings.spaceOrder[nextIndex];

		if (nextSpaceId) {
			void this.switchToSpace(nextSpaceId, 'next');
		}
	}

	switchToPreviousSpace() {
		const baseId =
			this.pendingSpaceRequest?.spaceId ??
			this.switchingToSpaceId ??
			(this.loadedWorkspaceId && this.settings.spaces[this.loadedWorkspaceId]
				? this.loadedWorkspaceId
				: this.settings.currentSpaceId);
		const currentIndex = this.settings.spaceOrder.indexOf(baseId);
		const prevIndex =
			currentIndex <= 0 ? this.settings.spaceOrder.length - 1 : currentIndex - 1;
		const prevSpaceId = this.settings.spaceOrder[prevIndex];

		if (prevSpaceId) {
			void this.switchToSpace(prevSpaceId, 'prev');
		}
	}

	async createNewSpace() {
		// A new space starts from the layout on screen, and mobile layouts must not
		// end up in the workspaces that desktops share (#18).
		if (Platform.isMobile) {
			new Notice('Create new spaces on desktop. They sync to mobile with your vault.');
			return;
		}

		const spaceData = await this.promptForSpaceName();
		if (!spaceData) return;

		const { name, icon, description, theme, themeMode } = parseSpaceData(spaceData);
		const spaceId = generateSpaceId(name, this.settings.spaces);

		// Create space in our settings
		this.settings.spaces[spaceId] = {
			name,
			icon,
			description,
			autoSave: true,
			theme: theme || undefined,
			themeMode: themeMode || 'system',
		};

		this.settings.spaceOrder.push(spaceId);
		await this.saveSettings();

		// Create corresponding workspace in Obsidian's internal API
		try {
			await createObsidianWorkspace(this.app, spaceId, name);
		} catch (error) {
			console.error('Failed to create Obsidian workspace:', error);
			new Notice('Space created but failed to sync with Obsidian workspace.');
		}

		// Switch to new space
		await this.switchToSpace(spaceId);

		// Update sidebar safely with delay
		window.setTimeout(() => {
			try {
				this.getView()?.render();
			} catch (error) {
				console.error('Failed to update sidebar after space creation:', error);
			}
		}, 50);

		new Notice(
			`New space '${icon || '📄'} ${name}' created and synced with Obsidian workspace.`
		);
	}

	async promptForSpaceName(): Promise<string | null> {
		return new Promise((resolve) => {
			const modal = new SpaceCreateModal(this.app, (name: string | null) => {
				resolve(name);
			});
			modal.open();
		});
	}

	openSpaceManager() {
		new SpaceManagerModal(this.app, this).open();
	}

	/**
	 * Open this plugin's settings tab.
	 * `app.setting` is an internal (undocumented) Obsidian API.
	 */
	openSettings(): void {
		const setting = (
			this.app as unknown as {
				setting?: { open: () => void; openTabById: (id: string) => void };
			}
		).setting;
		setting?.open();
		setting?.openTabById(this.manifest.id);
	}



	async deleteSpace(spaceId: string) {
		// Cannot delete the last remaining space
		const remainingSpaces = this.settings.spaceOrder.filter((id) => id !== spaceId);
		if (remainingSpaces.length === 0) {
			new Notice('Cannot delete the last remaining space. At least one space must exist.');
			return;
		}

		// Switch to another space if deleting current space
		if (spaceId === this.settings.currentSpaceId) {
			const otherSpaces = this.settings.spaceOrder.filter((id) => id !== spaceId);
			if (otherSpaces.length > 0) {
				await this.switchToSpace(otherSpaces[0]);
			}
		}

		// Delete the space from our settings
		delete this.settings.spaces[spaceId];
		this.settings.spaceOrder = this.settings.spaceOrder.filter((id) => id !== spaceId);

		await this.saveSettings();

		// Delete corresponding workspace from Obsidian's internal API
		try {
			await deleteObsidianWorkspace(this.app, spaceId);
		} catch (error) {
			console.error('Failed to delete Obsidian workspace:', error);
			new Notice('Space deleted but failed to sync with Obsidian workspace.');
		}

		// Update sidebar safely with delay
		window.setTimeout(() => {
			try {
				this.getView()?.render();
			} catch (error) {
				console.error('Failed to update sidebar after space deletion:', error);
			}
		}, 50);

		new Notice('Space deleted and synced with Obsidian workspace.');
	}



	handleLayoutChange() {
		// Auto-save current space state if auto-save is enabled
		if (this.switchingToSpaceId || this.workspaceLoadInProgress > 0) {
			return;
		}

		const spaceId = this.loadedWorkspaceId;
		if (!spaceId) {
			return;
		}

		const currentSpace = this.settings.spaces[spaceId];
		if (!currentSpace?.autoSave) {
			return;
		}

		// Debounce to avoid excessive saves
		window.clearTimeout(this.layoutChangeTimeout);
		this.layoutChangeTimeout = window.setTimeout(() => {
			// Re-validate at fire time: never save while a switch is in flight,
			// and never write this layout into a different visible workspace than
			// the one it was scheduled for.
			if (
				this.switchingToSpaceId ||
				this.workspaceLoadInProgress > 0 ||
				(this.loadedWorkspaceId ?? this.settings.currentSpaceId) !== spaceId
			) {
				return;
			}
			this.saveSpaceState(spaceId);
		}, 500);
	}

	private saveSpaceState(spaceId: string) {
		const space = this.settings.spaces[spaceId];
		// Mobile only reads layouts; its tabs must not overwrite desktop workspaces (#18).
		if (!space?.autoSave || Platform.isMobile) {
			return;
		}

		try {
			saveWorkspaceState(this.app, spaceId);
		} catch (error) {
			console.error('Failed to save workspace state:', error);
		}
	}

	handleFileOpen(_file: TFile) {
		// Auto-connection feature removed
	}

	// Compatibility methods for sidebar manager
	updateSidebarSpaces() {
		window.setTimeout(() => {
			try {
				this.getView()?.render();
				this.updateStatusBar();
			} catch (error) {
				console.error('Failed to update sidebar spaces:', error);
			}
		}, 50);
	}

	updateSidebarSpacesOptimized() {
		window.setTimeout(() => {
			try {
				this.getView()?.render();
				this.updateStatusBar();
			} catch (error) {
				console.error('Failed to update sidebar spaces optimized:', error);
			}
		}, 50);
	}

	applyCurrentSpaceTheme() {
		const currentSpace = this.settings.spaces[this.settings.currentSpaceId];
		if (currentSpace && (currentSpace.theme || currentSpace.themeMode)) {
			try {
				applySpaceTheme(this.app, currentSpace.theme, currentSpace.themeMode);
			} catch (error) {
				console.error('Failed to apply current space theme:', error);
				// If theme application fails, restore to original Obsidian theme
				void (async () => {
					try {
						await restoreThemeState(this.app);
					} catch (restoreError) {
						console.error('Failed to restore theme state:', restoreError);
					}
				})();
				throw error;
			}
		} else {
			// If no theme is configured for current space, restore to original Obsidian theme
			void (async () => {
				try {
					await restoreThemeState(this.app);
				} catch (restoreError) {
					console.error('Failed to restore original theme:', restoreError);
				}
			})();
		}
	}

	searchSpaces(query: string): string[] {
		return searchSpaces(this.settings.spaces, query);
	}

	/**
	 * Sync space name changes with Obsidian's internal workspace API
	 */
	async syncSpaceNameWithObsidian(spaceId: string, newName: string): Promise<void> {
		try {
			await updateObsidianWorkspaceName(this.app, spaceId, newName);
		} catch (error) {
			console.error('Failed to sync space name with Obsidian workspace:', error);
			throw error;
		}
	}

	/**
	 * Import Obsidian workspaces that have no Context Space yet
	 */
	async syncMissingWorkspacesFromObsidian(): Promise<void> {
		const imported = importObsidianWorkspaces(this.app, this.settings);
		if (imported.length === 0) {
			return;
		}

		try {
			await this.saveSettings();
		} catch (error) {
			console.error('Failed to save imported workspaces:', error);
			return;
		}
		this.updateSidebarSpaces();
		new Notice(`Imported ${imported.length} workspaces from Obsidian.`);
	}

	/**
	 * A workspace was saved through Obsidian's workspaces API. Saving under a new name
	 * in Obsidian's own UI creates a workspace, so give it a space.
	 */
	handleNativeWorkspaceSaved(workspaceId: string): void {
		if (this.settings.spaces[workspaceId]) {
			return;
		}
		void this.syncMissingWorkspacesFromObsidian();
	}

	/**
	 * The user deleted a workspace in Obsidian's own UI. Deletions on other devices
	 * arrive through data.json instead; a workspace that is merely missing from the
	 * registry never removes a space, because a sync tool may not have delivered it yet (#22).
	 */
	handleNativeWorkspaceDeleted(workspaceId: string): void {
		if (!this.settings.spaces[workspaceId]) {
			return;
		}

		// At least one space must exist. Its layout is recreated on the next switch.
		const remainingSpaceIds = this.settings.spaceOrder.filter((id) => id !== workspaceId);
		if (remainingSpaceIds.length === 0) {
			return;
		}

		delete this.settings.spaces[workspaceId];
		this.settings.spaceOrder = remainingSpaceIds;
		if (this.settings.currentSpaceId === workspaceId) {
			this.settings.currentSpaceId = remainingSpaceIds[0];
		}
		// The deleted layout may still be on screen; never save it back.
		if (this.loadedWorkspaceId === workspaceId) {
			this.cancelPendingLayoutSave();
			this.loadedWorkspaceId = null;
		}

		void this.saveSettings().then(
			() => this.updateSidebarSpaces(),
			(error) => console.error('Failed to remove the deleted workspace space:', error)
		);
	}
}
