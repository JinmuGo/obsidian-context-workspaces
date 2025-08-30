import { Notice, Plugin, type TFile } from 'obsidian';
import type { ContextWorkspacesSettings } from './types';
import { DEFAULT_SETTINGS } from './types';
import { needsDeletionDetection, safeDeletionDetection } from './utils/deletion-detection-utils';
import {
	applySpaceTheme,
	backupThemeState,
	createObsidianWorkspace,
	deleteObsidianWorkspace,
	getExistingWorkspaces,
	getObsidianWorkspaceNames,
	getWorkspacesPlugin,
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
import { needsSync, safeBidirectionalSync } from './utils/sync-utils';
import {
	ContextWorkspacesSettingTab,
	SidebarManager,
	SpaceCreateModal,
	SpaceManagerModal,
} from './wrappers';

export default class ContextWorkspacesPlugin extends Plugin {
	settings: ContextWorkspacesSettings;
	sidebarManager: SidebarManager;
	layoutChangeTimeout: NodeJS.Timeout;
	workspaceChangeTimeout: NodeJS.Timeout;
	switchingToSpaceId: string | null = null;

	async onload() {
		await this.loadSettings();

		// Initialize sidebar manager
		this.sidebarManager = new SidebarManager(this);
		this.sidebarManager.initialize();

		// Register workspace event listeners
		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				this.handleLayoutChange();
				// Ensure sidebar exists after layout changes with debouncing
				setTimeout(() => {
					this.sidebarManager.ensureExists();
				}, 100); // Increased delay to prevent rapid reinitialization
			})
		);

		// Workspace changed event listener
		this.registerEvent(
			// @ts-expect-error
			this.app.workspace.on('workspace-changed', () => {
				// Debounce workspace change events to prevent excessive calls
				clearTimeout(this.workspaceChangeTimeout);
				this.workspaceChangeTimeout = setTimeout(() => {
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
			name: 'Next Space',
			callback: () => {
				this.switchToNextSpace();
			},
		});

		this.addCommand({
			id: 'previous-space',
			name: 'Previous Space',
			callback: () => {
				this.switchToPreviousSpace();
			},
		});

		this.addCommand({
			id: 'create-new-space',
			name: 'Create New Space',
			callback: () => {
				this.createNewSpace();
			},
		});

		this.addCommand({
			id: 'manage-spaces',
			name: 'Manage Spaces',
			callback: () => {
				this.openSpaceManager();
			},
		});

		// Add settings tab
		this.addSettingTab(new ContextWorkspacesSettingTab(this.app, this));

		// Initialize default space
		await this.initializeDefaultSpace();

		// Initialize workspace synchronization
		await this.initializeWorkspaceSync();

		// Setup workspace load monitoring for auto-switching
		setupWorkspaceLoadMonitoring(this.app, this);

		// Backup original Obsidian theme on plugin load
		backupThemeState(this.app);

		// Apply current space theme on load
		setTimeout(async () => {
			try {
				await this.applyCurrentSpaceTheme();
			} catch (error) {
				console.error('Failed to apply current space theme on load:', error);
			}
		}, 1000); // Delay to ensure Obsidian is fully loaded
	}

	async onunload() {
		// Save current state
		await this.saveCurrentSpaceState();

		// Restore original Obsidian theme before unloading
		try {
			await restoreThemeState(this.app);
		} catch (error) {
			console.error('Failed to restore original Obsidian theme on unload:', error);
		}

		// Clear timeouts
		clearTimeout(this.layoutChangeTimeout);
		clearTimeout(this.workspaceChangeTimeout);

		// Remove workspace load monitoring
		removeWorkspaceLoadMonitoring(this.app);

		// Cleanup sidebar manager
		if (this.sidebarManager) {
			this.sidebarManager.destroy();
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async initializeDefaultSpace() {
		if (!isWorkspacesPluginEnabled(this.app)) {
			new Notice('Context Workspaces requires the Workspaces plugin to be enabled.');
			return;
		}

		// Import existing workspaces as spaces
		const existingWorkspaces = getExistingWorkspaces(this.app);

		if (Object.keys(this.settings.spaces).length === 0) {
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
		}
	}

	async switchToSpace(spaceId: string) {
		if (this.switchingToSpaceId || spaceId === this.settings.currentSpaceId) {
			return;
		}

		this.switchingToSpaceId = spaceId;

		try {
			// Save current space state
			await this.saveCurrentSpaceState();

			// Switch to new space
			this.settings.currentSpaceId = spaceId;
			await this.saveSettings();

			// Apply space theme if configured (with error handling)
			const space = this.settings.spaces[spaceId];
			if (space && (space.theme || space.themeMode)) {
				try {
					await applySpaceTheme(this.app, space.theme, space.themeMode);
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
			setTimeout(() => {
				try {
					this.sidebarManager.render();
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
		setTimeout(() => {
			try {
				this.sidebarManager.render();
			} catch (error) {
				console.error('Failed to update sidebar after order change:', error);
			}
		}, 50);
	}

	async saveCurrentSpaceState() {
		const currentSpaceId = this.settings.currentSpaceId;
		const currentSpace = this.settings.spaces[currentSpaceId];

		if (!currentSpace || !currentSpace.autoSave) {
			return;
		}

		try {
			await saveWorkspaceState(this.app, currentSpaceId);
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
			this.switchToSpace(nextSpaceId);
		}
	}

	switchToPreviousSpace() {
		const currentIndex = this.settings.spaceOrder.indexOf(this.settings.currentSpaceId);
		const prevIndex =
			currentIndex <= 0 ? this.settings.spaceOrder.length - 1 : currentIndex - 1;
		const prevSpaceId = this.settings.spaceOrder[prevIndex];

		if (prevSpaceId) {
			this.switchToSpace(prevSpaceId);
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
		setTimeout(() => {
			try {
				this.sidebarManager.render();
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
		setTimeout(() => {
			try {
				this.sidebarManager.render();
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
				clearTimeout(this.layoutChangeTimeout);
				this.layoutChangeTimeout = setTimeout(() => {
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
		setTimeout(() => {
			try {
				this.sidebarManager.render();
			} catch (error) {
				console.error('Failed to update sidebar spaces:', error);
			}
		}, 50);
	}

	updateSidebarSpacesOptimized() {
		setTimeout(() => {
			try {
				this.sidebarManager.render();
			} catch (error) {
				console.error('Failed to update sidebar spaces optimized:', error);
			}
		}, 50);
	}

	async applyCurrentSpaceTheme() {
		const currentSpace = this.settings.spaces[this.settings.currentSpaceId];
		if (currentSpace && (currentSpace.theme || currentSpace.themeMode)) {
			try {
				await applySpaceTheme(this.app, currentSpace.theme, currentSpace.themeMode);
			} catch (error) {
				console.error('Failed to apply current space theme:', error);
				// If theme application fails, restore to original Obsidian theme
				try {
					await restoreThemeState(this.app);
				} catch (restoreError) {
					console.error('Failed to restore theme state:', restoreError);
				}
				throw error;
			}
		} else {
			// If no theme is configured for current space, restore to original Obsidian theme
			try {
				await restoreThemeState(this.app);
			} catch (restoreError) {
				console.error('Failed to restore original theme:', restoreError);
			}
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
	async handleWorkspaceChange(): Promise<void> {
		try {
			// Performance measurement start
			const startTime = performance.now();

			// 1. Get Obsidian workspace list only once (prevent duplicate calls)
			const obsidianWorkspaceNames = getObsidianWorkspaceNames(this.app);
			let hasChanges = false;
			const deletedWorkspaces: string[] = [];
			let currentWorkspaceDeleted = false;

			// 2. Detect deletions (synchronous processing) - with safety checks
			for (const spaceId of Object.keys(this.settings.spaces)) {

				// Check if workspace exists in Obsidian
				if (!obsidianWorkspaceNames[spaceId]) {
					// Additional safety check: verify the workspace is actually deleted
					// by checking if it's a recent deletion (within last 5 seconds)
					const workspaceLastSeen = this.settings.workspaceLastSeen?.[spaceId];
					const now = Date.now();
					
					// If we haven't seen this workspace recently, it might be a false positive
					if (!workspaceLastSeen || (now - workspaceLastSeen) < 5000) {
						// Double-check by trying to get the workspace again
						try {
							const workspaces = getWorkspacesPlugin(this.app);
							if (workspaces?.instance?.workspaces?.[spaceId]) {
								continue;
							}
						} catch (error) {
							console.error(`Error checking workspace ${spaceId}:`, error);
							continue; // Skip deletion if we can't verify
						}
					}

					deletedWorkspaces.push(spaceId);
					hasChanges = true;

					// Check if current workspace was deleted
					if (spaceId === this.settings.currentSpaceId) {
						currentWorkspaceDeleted = true;
					}
				} else {
					// Update last seen timestamp for existing workspaces
					if (!this.settings.workspaceLastSeen) {
						this.settings.workspaceLastSeen = {};
					}
					this.settings.workspaceLastSeen[spaceId] = Date.now();
				}
			}

			// 3. Handle deleted workspaces (with confirmation for current workspace)
			if (deletedWorkspaces.length > 0) {
				// Special handling for current workspace deletion
				if (currentWorkspaceDeleted) {
					console.warn('Current workspace appears to be deleted. This might be a false positive.');
					
					// Try to verify the deletion one more time
					try {
						const workspaces = getWorkspacesPlugin(this.app);
						if (workspaces?.instance?.workspaces?.[this.settings.currentSpaceId]) {
							return;
						}
					} catch (error) {
						console.error('Error verifying current workspace deletion:', error);
						return; // Don't proceed if we can't verify
					}

					// For current workspace deletion, show a more prominent warning
					new Notice(
						`Warning: Current workspace appears to be deleted. Switching to Default workspace.`,
						5000
					);
				}

				// For other workspace deletions, don't show notification to avoid spam

				// Remove from Context Workspaces
				for (const workspaceId of deletedWorkspaces) {
					delete this.settings.spaces[workspaceId];

					const orderIndex = this.settings.spaceOrder.indexOf(workspaceId);
					if (orderIndex !== -1) {
						this.settings.spaceOrder.splice(orderIndex, 1);
					}

					// Clean up last seen timestamp
					if (this.settings.workspaceLastSeen?.[workspaceId]) {
						delete this.settings.workspaceLastSeen[workspaceId];
					}
				}

				// Switch to default if current workspace was deleted
				if (currentWorkspaceDeleted) {
					this.settings.currentSpaceId = 'default';
				}

				// Save settings and update UI (asynchronous separation)
				setTimeout(async () => {
					await this.saveSettings();
					this.updateSidebarSpaces();
					this.sidebarManager.ensureExists();

					// Show notification only for significant changes
					if (currentWorkspaceDeleted) {
						new Notice(
							'Current workspace was deleted, switched to Default workspace.',
							3000
						);
					} else if (deletedWorkspaces.length > 1) {
						new Notice(
							`${deletedWorkspaces.length} workspaces were removed from Context Workspaces.`,
							3000
						);
					}
				}, 0);
			}

			// 4. Detect new workspaces (synchronous processing)
			const newWorkspaces: string[] = [];
			for (const [workspaceId] of Object.entries(obsidianWorkspaceNames)) {
				if (!this.settings.spaces[workspaceId] && workspaceId !== 'default') {
					newWorkspaces.push(workspaceId);
					hasChanges = true;
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

					// Update last seen timestamp
					if (!this.settings.workspaceLastSeen) {
						this.settings.workspaceLastSeen = {};
					}
					this.settings.workspaceLastSeen[workspaceId] = Date.now();
				}

				// Save settings and update UI
				setTimeout(async () => {
					await this.saveSettings();
					this.updateSidebarSpaces();

					// Show notification
					new Notice(
						`${newWorkspaces.length} new workspaces were imported from Obsidian.`
					);
				}, 0);
			}

			// Performance measurement end
			const endTime = performance.now();
			// Only log performance in development mode
			if (hasChanges && process.env.NODE_ENV === 'development') {
				console.log(
					`Workspace change handled in ${(endTime - startTime).toFixed(2)}ms`
				);
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

		// Check for workspace deletions on startup
		if (needsDeletionDetection(this.app, this.settings)) {
			await safeDeletionDetection(this.app, this.settings);
		}

		// Set up periodic sync (every 30 seconds) only if sync is needed
		setInterval(async () => {
			if (
				needsSync(this.app, this.settings) ||
				needsDeletionDetection(this.app, this.settings)
			) {
				await this.handleWorkspaceChange();
			}
		}, 30000);
	}
}
