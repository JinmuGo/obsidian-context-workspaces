import { Menu, Notice, Plugin, type TFile } from 'obsidian';
import type { ContextWorkspacesSettings, PendingSpaceRequest } from './types';
import { DEFAULT_SETTINGS } from './types';
import { needsDeletionDetection } from './utils/deletion-detection-utils';
import {
	applySpaceTheme,
	backupThemeState,
	createObsidianWorkspace,
	deleteObsidianWorkspace,
	getExistingWorkspaces,
	getObsidianWorkspaceNames,
	isWorkspacesPluginEnabled,
	loadWorkspaceState,
	removeWorkspaceLoadMonitoring,
	restoreThemeState,
	saveWorkspaceState,
	setupWorkspaceLoadMonitoring,
	updateObsidianWorkspaceName,
} from './utils/obsidian-utils';
import {
	generateSpaceId,
	parseSpaceData,
	searchSpaces,
} from './utils/space-utils';
import { formatStatusBarLabel } from './utils/status-bar-utils';
import { needsSync, safeBidirectionalSync } from './utils/sync-utils';
import {
	ContextWorkspacesView,
	VIEW_TYPE_CONTEXT_WORKSPACES,
} from './views/ContextWorkspacesView';
import {
	ContextWorkspacesSettingTab,
	SpaceCreateModal,
	SpaceManagerModal,
} from './wrappers';

const WORKSPACE_DELETION_CONFIRMATION_DELAY_MS = 5000;

interface WorkspaceDeletionCandidate {
	firstDetectedAt: number;
	detections: number;
	warned: boolean;
}

export default class ContextWorkspacesPlugin extends Plugin {
	settings: ContextWorkspacesSettings;
	layoutChangeTimeout: number;
	workspaceChangeTimeout: number;
	switchingToSpaceId: string | null = null;
	// The persisted current id may be stale after a plugin reload, so this is
	// populated only after a workspace load has established what is visible.
	loadedWorkspaceId: string | null = null;
	internalWorkspaceLoadId: string | null = null;
	workspaceLoadInProgress = 0;
	workspaceLoadGeneration = 0;
	private workspaceDeletionCandidates = new Map<string, WorkspaceDeletionCandidate>();
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

		// Workspace changed event listener
		this.registerEvent(
			// @ts-expect-error - Event 'workspace-changed' is not in the public API types
			this.app.workspace.on('workspace-changed', () => {
				// Debounce workspace change events to prevent excessive calls
				window.clearTimeout(this.workspaceChangeTimeout);
				this.workspaceChangeTimeout = window.setTimeout(() => {
					this.handleWorkspaceChange();
				}, 1000); // Wait 1 second before processing workspace changes
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

		// Initialize workspace synchronization
		await this.initializeWorkspaceSync();

		// Setup workspace load monitoring for auto-switching
		setupWorkspaceLoadMonitoring(this.app, this);

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
		window.clearTimeout(this.workspaceChangeTimeout);
		this.workspaceLoadGeneration += 1;
		this.internalWorkspaceLoadId = null;
		this.pendingSpaceRequest?.resolve(false);
		this.pendingSpaceRequest = null;

		// Drop the status bar reference (Obsidian removes the element itself)
		this.statusBarItem = null;

		// Remove workspace load monitoring
		removeWorkspaceLoadMonitoring(this.app);
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
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<ContextWorkspacesSettings> | null,
		);
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

			// First-run initialization is the only place where an empty registry is
			// expected. Create the backing workspace explicitly so background sync
			// can safely abstain from all later empty-registry snapshots.
			if (shouldCreateInitialWorkspace) {
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
		if (!space?.autoSave) {
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
	 * Perform bidirectional synchronization between Context Workspaces and Obsidian workspaces
	 */
	async syncMissingWorkspacesFromObsidian(): Promise<void> {
		try {
			const syncResult = await safeBidirectionalSync(this.app, this.settings);

			if (syncResult) {
				// Save settings if there were changes
				if (
					syncResult.importedFromObsidian.length > 0 ||
					syncResult.createdInObsidian.length > 0 ||
					syncResult.conflicts.length > 0
				) {
					await this.saveSettings();
					this.updateSidebarSpaces();
				}

				// Show notification with sync results
				const messages: string[] = [];

				if (syncResult.importedFromObsidian.length > 0) {
					messages.push(
						`Imported ${syncResult.importedFromObsidian.length} workspaces from Obsidian.`
					);
				}

				if (syncResult.createdInObsidian.length > 0) {
					messages.push(
						`Created ${syncResult.createdInObsidian.length} workspaces in Obsidian.`
					);
				}

				if (syncResult.conflicts.length > 0) {
					messages.push(`Resolved ${syncResult.conflicts.length} name conflicts.`);
				}

				if (syncResult.errors.length > 0) {
					messages.push(`${syncResult.errors.length} errors occurred.`);
				}

				if (messages.length > 0) {
					new Notice(messages.join(' '));
				}
			}
		} catch (error) {
			console.error('Failed to perform bidirectional sync:', error);
			new Notice('Error occurred during synchronization.');
		}
	}

	/**
	 * Handle workspace changes (creation, deletion, modification) - optimized version
	 */
	handleWorkspaceChange(): void {
		try {
			// Workspace switches temporarily change the registry and must never be
			// interpreted as user-initiated deletion.
			if (this.switchingToSpaceId) {
				return;
			}

			const obsidianWorkspaceNames = getObsidianWorkspaceNames(this.app);
			if (!obsidianWorkspaceNames || Object.keys(obsidianWorkspaceNames).length === 0) {
				this.workspaceDeletionCandidates.clear();
				return;
			}

			const deletedWorkspaces: string[] = [];
			const now = Date.now();

			for (const spaceId of Object.keys(this.settings.spaces)) {
				if (spaceId === 'default') {
					this.workspaceDeletionCandidates.delete(spaceId);
					continue;
				}

				if (!obsidianWorkspaceNames[spaceId]) {
					const previousCandidate = this.workspaceDeletionCandidates.get(spaceId);
					const candidate: WorkspaceDeletionCandidate = previousCandidate
						? { ...previousCandidate, detections: previousCandidate.detections + 1 }
						: { firstDetectedAt: now, detections: 1, warned: false };
					this.workspaceDeletionCandidates.set(spaceId, candidate);

					const deletionConfirmed =
						candidate.detections >= 2 &&
						now - candidate.firstDetectedAt >= WORKSPACE_DELETION_CONFIRMATION_DELAY_MS;
					if (!deletionConfirmed) {
						continue;
					}

					// Keep the current Context Space as a recovery path even when the
					// corresponding Obsidian workspace remains missing.
					if (spaceId === this.settings.currentSpaceId) {
						if (!candidate.warned) {
							console.warn(
								'Current workspace is missing from Obsidian. The Context Space was kept.'
							);
							new Notice(
								'Current workspace is missing from Obsidian. The context space was not removed.',
								5000
							);
							candidate.warned = true;
						}
						continue;
					}

					deletedWorkspaces.push(spaceId);
				} else {
					this.workspaceDeletionCandidates.delete(spaceId);
					if (!this.settings.workspaceLastSeen) {
						this.settings.workspaceLastSeen = {};
					}
					this.settings.workspaceLastSeen[spaceId] = now;
				}
			}

			if (deletedWorkspaces.length > 0) {
				for (const workspaceId of deletedWorkspaces) {
					delete this.settings.spaces[workspaceId];
					this.workspaceDeletionCandidates.delete(workspaceId);

					const orderIndex = this.settings.spaceOrder.indexOf(workspaceId);
					if (orderIndex !== -1) {
						this.settings.spaceOrder.splice(orderIndex, 1);
					}

					// Clean up last seen timestamp
					if (this.settings.workspaceLastSeen?.[workspaceId]) {
						delete this.settings.workspaceLastSeen[workspaceId];
					}
				}

				void (async () => {
					try {
						await this.saveSettings();
						this.updateSidebarSpaces();

						if (deletedWorkspaces.length > 1) {
							new Notice(
								`${deletedWorkspaces.length} workspaces were removed from Context Workspaces.`,
								3000
							);
						}
					} catch (error) {
						console.error('Failed to handle deleted workspaces:', error);
					}
				})();
			}

			const newWorkspaces: string[] = [];
			for (const [workspaceId] of Object.entries(obsidianWorkspaceNames)) {
				if (!this.settings.spaces[workspaceId] && workspaceId !== 'default') {
					newWorkspaces.push(workspaceId);
				}
			}

			if (newWorkspaces.length > 0) {
				for (const workspaceId of newWorkspaces) {
					const workspaceName = obsidianWorkspaceNames[workspaceId];
					this.settings.spaces[workspaceId] = {
						name: workspaceName || workspaceId,
						icon: '📄',
						autoSave: false,
					};

					// Add to space order if not already present
					if (!this.settings.spaceOrder.includes(workspaceId)) {
						this.settings.spaceOrder.push(workspaceId);
					}

					// Update last seen timestamp
					if (!this.settings.workspaceLastSeen) {
						this.settings.workspaceLastSeen = {};
					}
					this.settings.workspaceLastSeen[workspaceId] = Date.now();
				}

				// Save settings and update UI
				void (async () => {
					try {
						await this.saveSettings();
						this.updateSidebarSpaces();

						// Show notification
						new Notice(
							`${newWorkspaces.length} new workspaces were imported from Obsidian.`
						);
					} catch (error) {
						console.error('Failed to handle new workspaces:', error);
					}
				})();
			}
		} catch (error) {
			console.error('Failed to handle workspace change:', error);
		}
	}

	/**
	 * Initialize workspace synchronization
	 */
	async initializeWorkspaceSync(): Promise<void> {
		// Sync missing workspaces on startup
		await this.syncMissingWorkspacesFromObsidian();

		// Record the first observation on startup. A later independent check is
		// required before a non-current Context Space can be removed.
		if (needsDeletionDetection(this.app, this.settings)) {
			this.handleWorkspaceChange();
		}

		// Set up periodic sync (every 30 seconds) only if sync is needed
		window.setInterval(() => {
			if (
				needsSync(this.app, this.settings) ||
				needsDeletionDetection(this.app, this.settings)
			) {
				this.handleWorkspaceChange();
			}
		}, 30000);
	}
}
