import { Menu, Notice, Plugin, type TFile } from 'obsidian';
import type { ContextWorkspacesSettings } from './types';
import { DEFAULT_SETTINGS } from './types';
import {
	needsDeletionDetection,
	observeWorkspaceDeletions,
	removeDeletedWorkspaces,
	safeDeletionDetection,
	switchToFirstWorkspace,
} from './utils/deletion-detection-utils';
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
	asContextWorkspacesView,
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
	workspaceChangeTimeout: number;
	workspaceSyncInterval: number;
	switchingToSpaceId: string | null = null;
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
		window.clearInterval(this.workspaceSyncInterval);

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
		for (const leaf of leaves) {
			const view = asContextWorkspacesView(leaf.view);
			if (view) {
				return view;
			}
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

		// Existing settings are the baseline for deletion detection. Fresh spaces
		// created during initialization intentionally do not get this marker yet.
		if (Object.keys(this.settings.spaces).length > 0) {
			if (!this.settings.workspaceLastSeen) {
				this.settings.workspaceLastSeen = {};
			}
			const now = Date.now();
			for (const spaceId of Object.keys(this.settings.spaces)) {
				if (this.settings.workspaceLastSeen[spaceId] === undefined) {
					this.settings.workspaceLastSeen[spaceId] = now;
				}
			}
		}
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
		if (!existingWorkspaces) {
			console.warn('Deferring default space initialization until workspaces are available.');
			return;
		}

		if (Object.keys(this.settings.spaces).length === 0) {
			// Create initial space if no spaces exist
			const initialSpaceId = 'space-1';
			this.settings.spaces[initialSpaceId] = {
				name: 'My Space',
				icon: '🏠',
				autoSave: true,
			};

			// Convert existing workspaces to spaces
			const now = Date.now();
			for (const [workspaceId, workspace] of Object.entries(existingWorkspaces)) {
				if (!this.settings.workspaceLastSeen) {
					this.settings.workspaceLastSeen = {};
				}
				this.settings.workspaceLastSeen[workspaceId] = now;

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
		}
	}

	async switchToSpace(spaceId: string, _method: string = 'sidebar') {
		if (this.switchingToSpaceId || spaceId === this.settings.currentSpaceId) {
			return;
		}

		this.switchingToSpaceId = spaceId;

		try {
			// Save current space state
			this.saveCurrentSpaceState();

			// Switch to new space
			this.settings.currentSpaceId = spaceId;
			await this.saveSettings();

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
				// If no theme is configured for this space, restore to original Obsidian theme
				try {
					await restoreThemeState(this.app);
				} catch (restoreError) {
					console.error('Failed to restore original theme:', restoreError);
				}
			}

			// Load new space state
			await this.loadSpaceState(spaceId);

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
			// If switching fails, try to restore theme state
			try {
				await restoreThemeState(this.app);
			} catch (restoreError) {
				console.error('Failed to restore theme state after switch failure:', restoreError);
			}
		} finally {
			this.switchingToSpaceId = null;
		}
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
		const currentSpaceId = this.settings.currentSpaceId;
		const currentSpace = this.settings.spaces[currentSpaceId];

		if (!currentSpace || !currentSpace.autoSave) {
			return;
		}

		try {
			saveWorkspaceState(this.app, currentSpaceId);
		} catch (error) {
			console.error('Failed to save workspace state:', error);
		}
	}

	async loadSpaceState(spaceId: string) {
		const space = this.settings.spaces[spaceId];
		if (!space) return;

		try {
			// Load workspace state (this will automatically open pinned tabs)
			await loadWorkspaceState(this.app, spaceId);
		} catch (error) {
			console.error('Failed to load workspace state:', error);
		}
	}

	switchToNextSpace() {
		const currentIndex = this.settings.spaceOrder.indexOf(this.settings.currentSpaceId);
		const nextIndex = (currentIndex + 1) % this.settings.spaceOrder.length;
		const nextSpaceId = this.settings.spaceOrder[nextIndex];

		if (nextSpaceId) {
			void this.switchToSpace(nextSpaceId, 'next');
		}
	}

	switchToPreviousSpace() {
		const currentIndex = this.settings.spaceOrder.indexOf(this.settings.currentSpaceId);
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
			if (!this.settings.workspaceLastSeen) {
				this.settings.workspaceLastSeen = {};
			}
			this.settings.workspaceLastSeen[spaceId] = Date.now();
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
		if (this.settings.workspaceLastSeen) {
			delete this.settings.workspaceLastSeen[spaceId];
		}

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
		if (!this.switchingToSpaceId) {
			const currentSpace = this.settings.spaces[this.settings.currentSpaceId];
			if (currentSpace?.autoSave) {
				// Debounce to avoid excessive saves
				window.clearTimeout(this.layoutChangeTimeout);
				this.layoutChangeTimeout = window.setTimeout(() => {
					this.saveCurrentSpaceState();
				}, 500);
			}
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
		if (this.switchingToSpaceId) {
			return;
		}

		try {
			// 1. Get Obsidian workspace list only once (prevent duplicate calls)
			const registry = getObsidianWorkspaceNames(this.app);
			if (registry.status !== 'available') {
				console.warn(`Deferring workspace change handling: ${registry.error}`);
				return;
			}

			const obsidianWorkspaceNames = registry.names;

			const deletionResult = observeWorkspaceDeletions(
				this.settings,
				obsidianWorkspaceNames,
			);
			const deletedWorkspaces = deletionResult.deletedWorkspaces;
			const currentWorkspaceDeleted = deletionResult.currentWorkspaceDeleted;
			let settingsChanged = deletionResult.settingsChanged;

			// Handle confirmed deletions.
			if (deletedWorkspaces.length > 0) {
				removeDeletedWorkspaces(this.settings, deletedWorkspaces);
				settingsChanged = true;

			}

			// 4. Detect new workspaces (synchronous processing)
			const newWorkspaces: string[] = [];
			for (const [workspaceId] of Object.entries(obsidianWorkspaceNames)) {
				if (!this.settings.spaces[workspaceId] && workspaceId !== 'default') {
					newWorkspaces.push(workspaceId);
				}
			}

			// 5. Handle new workspaces
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

					if (!this.settings.workspaceLastSeen) {
						this.settings.workspaceLastSeen = {};
					}
					this.settings.workspaceLastSeen[workspaceId] = Date.now();
				}
				settingsChanged = true;
			}

			if (currentWorkspaceDeleted) {
				switchToFirstWorkspace(this.settings);
				settingsChanged = true;
			}

			if (settingsChanged) {
				void (async () => {
					try {
						await this.saveSettings();
						if (currentWorkspaceDeleted) {
							await this.loadSpaceState(this.settings.currentSpaceId);
						}
						this.updateSidebarSpaces();

						if (currentWorkspaceDeleted) {
							new Notice(
								'Current workspace was deleted, switched to another workspace.',
								3000,
							);
						} else if (deletedWorkspaces.length > 1) {
							new Notice(
								`${deletedWorkspaces.length} workspaces were removed from Context Workspaces.`,
								3000,
							);
						} else if (newWorkspaces.length > 0) {
							new Notice(
								`${newWorkspaces.length} new workspaces were imported from Obsidian.`,
							);
						}
					} catch (error) {
						console.error('Failed to save workspace change:', error);
					}
				})();
			}
		} catch (error) {
			console.error('Failed to handle workspace change:', error);
		}
	}

	private async runPeriodicWorkspaceSync(): Promise<void> {
		try {
			if (Object.keys(this.settings.spaces).length === 0) {
				await this.initializeDefaultSpace();
			}

			const shouldDetectDeletions = needsDeletionDetection(this.app, this.settings);
			const shouldSync = needsSync(this.app, this.settings);

			if (shouldDetectDeletions) {
				this.handleWorkspaceChange();
			}
			if (shouldSync) {
				await this.syncMissingWorkspacesFromObsidian();
			}
		} catch (error) {
			console.error('Failed to run periodic workspace synchronization:', error);
		}
	}

	/**
	 * Initialize workspace synchronization
	 */
	async initializeWorkspaceSync(): Promise<void> {
		// Check for workspace deletions on startup
		if (needsDeletionDetection(this.app, this.settings)) {
			const deletionResult = safeDeletionDetection(this.app, this.settings);
			if (deletionResult?.settingsChanged) {
				await this.saveSettings();
			}

			if (deletionResult?.currentWorkspaceDeleted) {
				await this.loadSpaceState(this.settings.currentSpaceId);
			}
		}

		// Sync missing workspaces after deletion detection has established whether
		// an absent workspace is new or a previously observed deletion.
		await this.syncMissingWorkspacesFromObsidian();

		// Set up periodic sync (every 30 seconds) only if sync is needed
		this.workspaceSyncInterval = window.setInterval(() => {
			void this.runPeriodicWorkspaceSync();
		}, 30000);
	}
}
