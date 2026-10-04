import type { App } from 'obsidian';
import type {
	ContextWorkspacesPluginLike,
	ObsidianAppInternal,
	ObsidianBaseTheme,
	ObsidianInternalPlugins,
	ThemeMode,
	WorkspaceRegistryListener,
	WorkspacesData,
} from '../types';

const THEME_MODE_TO_OBSIDIAN: Record<ThemeMode, ObsidianBaseTheme> = {
	light: 'moonstone',
	dark: 'obsidian',
	system: 'system',
};

const LEGACY_BASE_THEME_VALUES = new Set(['dark', 'light', 'moonstone', 'obsidian', 'system']);

/**
 * Cast App to internal API type for accessing undocumented Obsidian APIs
 */
function asInternal(app: App): ObsidianAppInternal {
	return app as unknown as ObsidianAppInternal;
}

/**
 * Get Obsidian's internal workspaces plugin
 */
export function getWorkspacesPlugin(app: App): ObsidianInternalPlugins['plugins']['workspaces'] {
	return asInternal(app).internalPlugins.plugins.workspaces;
}

/**
 * Check if workspaces plugin is enabled
 */
export function isWorkspacesPluginEnabled(app: App): boolean {
	const workspaces = getWorkspacesPlugin(app);
	return workspaces?.enabled ?? false;
}

/**
 * Save workspace state using Obsidian's internal API
 */
export function saveWorkspaceState(app: App, workspaceId: string): void {
	try {
		const workspaces = getWorkspacesPlugin(app);
		if (workspaces?.enabled && workspaces.instance) {
			workspaces.instance.saveWorkspace(workspaceId);
		}
	} catch (error) {
		console.error('Failed to save workspace state:', error);
		throw error;
	}
}

/**
 * Load workspace state using Obsidian's internal API
 */
export async function loadWorkspaceState(app: App, workspaceId: string): Promise<void> {
	try {
		const workspaces = getWorkspacesPlugin(app);
		if (!workspaces?.enabled || !workspaces.instance) {
			throw new Error('Obsidian workspaces plugin is unavailable');
		}

		if (!workspaces.instance.workspaces[workspaceId]) {
			throw new Error(`Obsidian workspace not found: ${workspaceId}`);
		}

		await workspaces.instance.loadWorkspace(workspaceId);
	} catch (error) {
		console.error('Failed to load workspace state:', error);
		throw error;
	}
}

/**
 * Get existing workspaces from Obsidian's internal API
 */
export function getExistingWorkspaces(app: App): Record<string, unknown> {
	const workspaces = getWorkspacesPlugin(app);
	return workspaces?.instance?.workspaces ?? {};
}

/**
 * Create a workspace in Obsidian's internal API from the layout currently on screen
 */
export async function createObsidianWorkspace(
	app: App,
	workspaceId: string,
	workspaceName: string
): Promise<void> {
	try {
		const workspaces = getWorkspacesPlugin(app);
		if (workspaces?.enabled && workspaces.instance) {
			workspaces.instance.workspaces[workspaceId] = {
				...app.workspace.getLayout(),
				name: workspaceName,
			};
			await workspaces.instance.saveData();
		}
	} catch (error) {
		console.error('Failed to create Obsidian workspace:', error);
		throw error;
	}
}

/**
 * Update workspace name in Obsidian's internal API
 */
export async function updateObsidianWorkspaceName(
	app: App,
	workspaceId: string,
	newName: string
): Promise<void> {
	try {
		const workspaces = getWorkspacesPlugin(app);
		if (workspaces?.enabled && workspaces.instance?.workspaces[workspaceId]) {
			workspaces.instance.workspaces[workspaceId].name = newName;
			await workspaces.instance.saveData();
		}
	} catch (error) {
		console.error('Failed to update Obsidian workspace name:', error);
		throw error;
	}
}

/**
 * Delete workspace from Obsidian's internal API
 */
export async function deleteObsidianWorkspace(app: App, workspaceId: string): Promise<void> {
	try {
		const workspaces = getWorkspacesPlugin(app);
		if (workspaces?.enabled && workspaces.instance?.workspaces[workspaceId]) {
			delete workspaces.instance.workspaces[workspaceId];
			await workspaces.instance.saveData();
		}
	} catch (error) {
		console.error('Failed to delete Obsidian workspace:', error);
		throw error;
	}
}

/**
 * Get workspace names from Obsidian's internal API
 */
export function getObsidianWorkspaceNames(app: App): Record<string, string> | null {
	try {
		const workspaces = getWorkspacesPlugin(app);
		if (workspaces?.enabled && workspaces.instance?.workspaces) {
			const workspaceNames: Record<string, string> = {};
			for (const [id, workspace] of Object.entries(workspaces.instance.workspaces)) {
				workspaceNames[id] = (workspace as { name?: string }).name || id;
			}
			return workspaceNames;
		}
		return null;
	} catch (error) {
		console.error('Failed to get Obsidian workspace names:', error);
		return null;
	}
}

/**
 * Check if workspace exists in Obsidian's internal API
 */
export function workspaceExistsInObsidian(app: App, workspaceId: string): boolean {
	try {
		const workspaces = getWorkspacesPlugin(app);
		return workspaces?.enabled === true && !!workspaces.instance?.workspaces[workspaceId];
	} catch (error) {
		console.error('Failed to check if workspace exists in Obsidian:', error);
		return false;
	}
}

/**
 * Get available themes from Obsidian
 */
export function getAvailableThemes(app: App): string[] {
	try {
		const internal = asInternal(app);

		// Method 1: Direct customCss access
		const customCss = internal.customCss;
		if (customCss?.themes) {
			return Object.keys(customCss.themes).sort();
		}

		// Method 2: Check vault config
		const vaultConfig = internal.vault.config;
		if (vaultConfig?.themes) {
			return Object.keys(vaultConfig.themes).sort();
		}

		// Method 3: Check if customCss has themes property
		if (customCss && typeof customCss === 'object') {
			const themes = Object.keys(customCss).filter(
				(key) => key !== 'theme' && key !== 'setTheme' && key !== 'themes'
			);
			if (themes.length > 0) {
				return themes.sort();
			}
		}

		return [];
	} catch (error) {
		console.error('Failed to get available themes:', error);
		return [];
	}
}

/**
 * Older versions stored Obsidian's base colour scheme in the community-theme field.
 */
export function normalizeCommunityTheme(app: App, theme?: string): string | undefined {
	const selectedTheme = theme?.trim();
	if (!selectedTheme) {
		return undefined;
	}

	const availableThemes = getAvailableThemes(app);
	if (LEGACY_BASE_THEME_VALUES.has(selectedTheme) && !availableThemes.includes(selectedTheme)) {
		return undefined;
	}

	return selectedTheme;
}

/**
 * Get current theme
 */
export function getCurrentTheme(app: App): string {
	try {
		const internal = asInternal(app);

		// An empty value means the built-in Obsidian theme and is still a valid value.
		const customCss = internal.customCss;
		if (customCss && typeof customCss.theme === 'string') {
			return customCss.theme;
		}

		// Community themes are stored separately from the base colour scheme.
		const vaultConfig = internal.vault.config;
		if (vaultConfig && typeof vaultConfig.cssTheme === 'string') {
			return vaultConfig.cssTheme;
		}

		return '';
	} catch (error) {
		console.error('Failed to get current theme:', error);
		return '';
	}
}

/**
 * Set theme
 */
export async function setTheme(app: App, themeName: string): Promise<void> {
	try {
		const internal = asInternal(app);

		// Method 1: Use customCss.setTheme if available (safest method)
		const customCss = internal.customCss;
		if (customCss?.setTheme) {
			customCss.setTheme(themeName);
			return;
		}

		// Method 2: Update the community-theme config directly.
		const vaultConfig = internal.vault.config;
		if (vaultConfig) {
			// Only change if the theme is actually different
			if (vaultConfig.cssTheme !== themeName) {
				vaultConfig.cssTheme = themeName;
				if (internal.vault.saveConfig) {
					await internal.vault.saveConfig();
				}

				// Trigger theme change event
				const workspace = internal.workspace;
				if (workspace.trigger) {
					workspace.trigger('css-change');
				}

				// Force Obsidian to refresh the theme immediately
				window.setTimeout(() => {
					const event = new CustomEvent('theme-change', { detail: { theme: themeName } });
					activeDocument.dispatchEvent(event);

					if (workspace.trigger) {
						workspace.trigger('resize');
					}
				}, 50);
			}
			return;
		}

		// Method 3: Fallback - try to reload the page theme
		console.warn('Using fallback theme setting method');
		throw new Error('Unable to set theme - no supported method available');
	} catch (error) {
		console.error('Failed to set theme:', error);
		throw error;
	}
}

/**
 * Get current theme mode
 */
export function getCurrentThemeMode(app: App): ThemeMode {
	try {
		const baseTheme = asInternal(app).vault.config?.theme;
		if (baseTheme === 'system') {
			return 'system';
		}
		if (baseTheme === 'obsidian') {
			return 'dark';
		}
		if (baseTheme === 'moonstone') {
			return 'light';
		}

		// Older or unavailable configs can still be resolved from the rendered state.
		const body = activeDocument.body;
		if (body.classList.contains('theme-dark')) {
			return 'dark';
		}
		if (body.classList.contains('theme-light')) {
			return 'light';
		}

		return 'system';
	} catch (error) {
		console.error('Failed to get current theme mode:', error);
		return 'system';
	}
}

/**
 * Get current theme mode for UI components (resolves system mode to actual light/dark)
 */
export function getCurrentThemeModeForUI(): 'light' | 'dark' {
	const body = activeDocument.body;
	if (body.classList.contains('theme-dark')) {
		return 'dark';
	}
	if (body.classList.contains('theme-light')) {
		return 'light';
	}
	// system mode - check system preference
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeModeToBody(mode: ThemeMode): boolean {
	const resolvedMode = mode === 'system'
		? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
		: mode;
	const body = activeDocument.body;
	const changed = !body.classList.contains(`theme-${resolvedMode}`);

	body.classList.toggle('theme-dark', resolvedMode === 'dark');
	body.classList.toggle('theme-light', resolvedMode === 'light');
	return changed;
}

/**
 * Set theme mode
 */
export async function setThemeMode(app: App, mode: ThemeMode): Promise<void> {
	try {
		const internal = asInternal(app);
		const baseTheme = THEME_MODE_TO_OBSIDIAN[mode];

		// Obsidian persists base colour schemes as system/moonstone/obsidian.
		if (internal.changeTheme) {
			internal.changeTheme(baseTheme);
			return;
		}

		// Update config for persistence
		const vaultConfig = internal.vault.config;
		if (vaultConfig) {
			vaultConfig.theme = baseTheme;
			if (internal.vault.saveConfig) {
				await internal.vault.saveConfig();
			}
		}

		applyThemeModeToBody(mode);

		// Trigger theme change events
		const workspace = internal.workspace;
		if (workspace.trigger) {
			workspace.trigger('css-change');
		}

		// Dispatch custom event for theme mode change
		window.dispatchEvent(new CustomEvent('theme-mode-change', { detail: { mode } }));

		// Force Obsidian to refresh the theme mode immediately
		window.setTimeout(() => {
			const event = new CustomEvent('theme-change', { detail: { mode } });
			activeDocument.dispatchEvent(event);

			if (workspace.trigger) {
				workspace.trigger('resize');
			}
		}, 50);
	} catch (error) {
		console.error('Failed to set theme mode:', error);
		throw error;
	}
}

/**
 * Apply space theme settings
 */
export function applySpaceTheme(
	app: App,
	theme?: string,
	themeMode?: ThemeMode
): void {
	try {
		const changes: string[] = [];

		// An omitted theme explicitly inherits the theme Obsidian had on plugin load.
		const selectedTheme = normalizeCommunityTheme(app, theme);
		const themeToApply = selectedTheme || getOriginalObsidianTheme();
		if (themeToApply !== null) {
			const currentTheme = getCurrentTheme(app);
			if (currentTheme !== themeToApply) {
				// Apply theme without changing Obsidian's default theme setting
				setThemeTemporarily(app, themeToApply);
				changes.push(`Theme: ${themeToApply}`);
			}
		}

		// Apply mode if specified (including system mode). The persisted Obsidian
		// preference is intentionally left untouched for workspace-specific modes.
		if (themeMode) {
			setThemeModeTemporarily(app, themeMode);
			changes.push(`Mode: ${themeMode}`);
		}
	} catch (error) {
		console.error('Failed to apply space theme:', error);
		throw error;
	}
}

/**
 * Set theme temporarily without changing Obsidian's default theme setting
 */
function setThemeTemporarily(app: App, themeName: string): void {
	try {
		const internal = asInternal(app);

		// Method 1: Use customCss.setTheme if available (safest method)
		const customCss = internal.customCss;
		if (customCss?.setTheme) {
			customCss.setTheme(themeName);
			return;
		}

		// Method 2: Apply theme without saving to config (temporary change)
		if (customCss) {
			customCss.theme = themeName;

			// Trigger theme change event without saving config
			const workspace = internal.workspace;
			if (workspace.trigger) {
				workspace.trigger('css-change');
			}

			// Force Obsidian to refresh the theme immediately
			window.setTimeout(() => {
				const event = new CustomEvent('theme-change', { detail: { theme: themeName } });
				activeDocument.dispatchEvent(event);

				if (workspace.trigger) {
					workspace.trigger('resize');
				}
			}, 50);
			return;
		}

		// Method 3: Fallback
		console.warn('Using fallback temporary theme setting method');
		throw new Error('Unable to set theme temporarily - no supported method available');
	} catch (error) {
		console.error('Failed to set theme temporarily:', error);
		throw error;
	}
}

/**
 * Set theme mode temporarily without changing Obsidian's default theme mode setting
 */
function setThemeModeTemporarily(app: App, mode: ThemeMode): void {
	try {
		const internal = asInternal(app);
		const changed = applyThemeModeToBody(mode);
		if (!changed) {
			return;
		}

		// Trigger theme change events without saving config
		const workspace = internal.workspace;
		if (workspace.trigger) {
			workspace.trigger('css-change');
		}

		window.dispatchEvent(new CustomEvent('theme-mode-change', { detail: { mode } }));

		window.setTimeout(() => {
			const event = new CustomEvent('theme-change', { detail: { mode } });
			activeDocument.dispatchEvent(event);

			if (workspace.trigger) {
				workspace.trigger('resize');
			}
		}, 50);
	} catch (error) {
		console.error('Failed to set theme mode temporarily:', error);
		throw error;
	}
}

/**
 * Get the left sidebar container element
 */
export function getLeftSidebarContainer(app: App): HTMLElement | null {
	const leftSplit = (app.workspace as unknown as { leftSplit?: { containerEl?: HTMLElement } })
		.leftSplit;
	return leftSplit?.containerEl ?? null;
}

/**
 * Monitor Obsidian's loadWorkspace API calls and automatically switch Context Workspaces
 */
export function setupWorkspaceLoadMonitoring(app: App, plugin: ContextWorkspacesPluginLike): void {
	try {
		const workspaces = getWorkspacesPlugin(app);
		if (!workspaces?.enabled || !workspaces.instance) {
			return;
		}

		// Store original loadWorkspace method
		const originalLoadWorkspace = workspaces.instance.loadWorkspace.bind(
			workspaces.instance,
		) as (id: string) => Promise<void>;
		workspaces.instance._originalLoadWorkspace = originalLoadWorkspace;
		let workspaceLoadQueue: Promise<void> = Promise.resolve();

		// Override loadWorkspace method to detect calls
		workspaces.instance.loadWorkspace = (workspaceId: string) => {
			const isPluginInitiatedLoad = plugin.internalWorkspaceLoadId === workspaceId;
			if (isPluginInitiatedLoad) {
				plugin.internalWorkspaceLoadId = null;
			}

			const queuedLoad = workspaceLoadQueue.then(async () => {
				// Detect externally-initiated loads (e.g. Obsidian's native workspace
				// switcher): the outgoing space's layout is still on screen, so
				// capture it now — after the load completes, saving would write the
				// new layout into the wrong (outgoing) workspace.
				const visibleWorkspaceId =
					plugin.loadedWorkspaceId ?? plugin.settings.currentSpaceId;
				const isExternalLoad =
					!isPluginInitiatedLoad &&
					(plugin.loadedWorkspaceId === null || workspaceId !== visibleWorkspaceId);
				const loadGeneration = isExternalLoad
					? ++plugin.workspaceLoadGeneration
					: plugin.workspaceLoadGeneration;

				plugin.cancelPendingLayoutSave();
				if (isExternalLoad) {
					plugin.saveCurrentSpaceState();
				}

				plugin.workspaceLoadInProgress += 1;
				try {
					// Call original method first.
					await originalLoadWorkspace(workspaceId);

					// Loads are serialized above, so the completed load is the workspace
					// actually on screen even if a newer request is waiting behind it.
					plugin.loadedWorkspaceId = workspaceId;

					const spaceExists = plugin.settings.spaces[workspaceId];
					if (
						isExternalLoad &&
						spaceExists &&
						plugin.workspaceLoadGeneration === loadGeneration
					) {
						// The layout is already loaded. Adopt it without loading it again,
						// and ignore the callback if a newer transition supersedes it.
						window.setTimeout(() => {
							if (
								plugin.workspaceLoadGeneration !== loadGeneration ||
								plugin.loadedWorkspaceId !== workspaceId
							) {
								return;
							}

							void plugin
								.switchToSpace(workspaceId, 'native', true, true, loadGeneration)
								.catch((error) => {
									console.error('Failed to auto-switch to Context Space:', error);
								});
						}, 100);
					}
				} finally {
					plugin.workspaceLoadInProgress = Math.max(
						0,
						plugin.workspaceLoadInProgress - 1,
					);
				}
			});

			workspaceLoadQueue = queuedLoad.catch(() => undefined);
			return queuedLoad;
		};
	} catch (error) {
		console.error('Failed to setup workspace load monitoring:', error);
	}
}

/**
 * Remove workspace load monitoring
 */
export function removeWorkspaceLoadMonitoring(app: App): void {
	try {
		const workspaces = getWorkspacesPlugin(app);
		if (!workspaces?.enabled || !workspaces.instance) {
			return;
		}

		// Restore original loadWorkspace method if it was stored
		if (workspaces.instance._originalLoadWorkspace) {
			workspaces.instance.loadWorkspace = workspaces.instance._originalLoadWorkspace;
			delete workspaces.instance._originalLoadWorkspace;
		}
	} catch (error) {
		console.error('Failed to remove workspace load monitoring:', error);
	}
}

/**
 * Keep Obsidian's in-memory workspace registry in step with `workspaces.json` on disk
 * and report registry changes the user makes through Obsidian's own workspace UI.
 *
 * Obsidian's workspaces plugin reads `workspaces.json` only when it is enabled and
 * rewrites the whole file from memory on every save. When a sync tool such as
 * Syncthing replaces the file, the next save on this device would silently revert the
 * other device's changes. Obsidian calls `onExternalSettingsChange` on internal
 * plugins when their config file changes on disk with a newer mtime than their last
 * write, so the plugin reloads its registry from there.
 */
export function setupWorkspaceRegistryMonitoring(
	app: App,
	listener: WorkspaceRegistryListener
): void {
	try {
		const workspaces = getWorkspacesPlugin(app);
		const instance = workspaces?.instance;
		if (!workspaces?.enabled || !instance) {
			return;
		}

		// Keep the unbound methods so unload restores exactly what Obsidian installed.
		const originalSaveWorkspace = instance.saveWorkspace;
		const originalDeleteWorkspace = instance.deleteWorkspace;
		instance._originalSaveWorkspace = originalSaveWorkspace;
		instance._originalDeleteWorkspace = originalDeleteWorkspace;

		instance.saveWorkspace = (workspaceId: string) => {
			originalSaveWorkspace.call(instance, workspaceId);
			listener.handleNativeWorkspaceSaved(workspaceId);
		};

		instance.deleteWorkspace = async (workspaceId: string) => {
			await originalDeleteWorkspace.call(instance, workspaceId);
			listener.handleNativeWorkspaceDeleted(workspaceId);
		};

		const loadData = workspaces.loadData?.bind(workspaces) as
			| (() => Promise<WorkspacesData | null>)
			| undefined;
		if (loadData) {
			instance.onExternalSettingsChange = async () => {
				try {
					const data = await loadData();
					// A missing or unreadable file is not evidence that the
					// workspaces were removed; keep the registry in memory.
					if (!data) {
						return;
					}
					instance.workspaces = data.workspaces ?? {};
					instance.activeWorkspace = data.active ?? '';
				} catch (error) {
					console.error('Failed to reload the Obsidian workspace registry:', error);
				}
			};
		}
	} catch (error) {
		console.error('Failed to setup workspace registry monitoring:', error);
	}
}

/**
 * Remove workspace registry monitoring
 */
export function removeWorkspaceRegistryMonitoring(app: App): void {
	try {
		const instance = getWorkspacesPlugin(app)?.instance;
		if (!instance) {
			return;
		}

		if (instance._originalSaveWorkspace) {
			instance.saveWorkspace = instance._originalSaveWorkspace;
			delete instance._originalSaveWorkspace;
		}
		if (instance._originalDeleteWorkspace) {
			instance.deleteWorkspace = instance._originalDeleteWorkspace;
			delete instance._originalDeleteWorkspace;
		}
		delete instance.onExternalSettingsChange;
	} catch (error) {
		console.error('Failed to remove workspace registry monitoring:', error);
	}
}

/**
 * Store for theme state backup
 */
let originalObsidianTheme: string | null = null;
let originalObsidianThemeMode: ThemeMode | null = null;

/**
 * Backup current theme state and store original Obsidian theme
 */
export function backupThemeState(app: App): void {
	try {
		// Store original Obsidian theme if not already stored
		if (originalObsidianTheme === null) {
			originalObsidianTheme = getCurrentTheme(app);
		}
		if (originalObsidianThemeMode === null) {
			originalObsidianThemeMode = getCurrentThemeMode(app);
		}
	} catch (error) {
		console.error('Failed to backup theme state:', error);
	}
}

/**
 * Restore theme state from backup (restore to original Obsidian theme, not workspace-specific theme)
 */
export async function restoreThemeState(app: App): Promise<void> {
	try {
		if (originalObsidianTheme === null && originalObsidianThemeMode === null) {
			return;
		}

		const changes: string[] = [];

		// Restore to original Obsidian theme (not the backed up workspace-specific theme)
		if (originalObsidianTheme !== null) {
			const currentTheme = getCurrentTheme(app);
			if (currentTheme !== originalObsidianTheme) {
				await setTheme(app, originalObsidianTheme);
				changes.push(`Theme: ${originalObsidianTheme}`);
			}
		}

		// Restore to original Obsidian theme mode
		if (originalObsidianThemeMode !== null) {
			setThemeModeTemporarily(app, originalObsidianThemeMode);
			changes.push(`Mode: ${originalObsidianThemeMode}`);
		}
	} catch (error) {
		console.error('Failed to restore theme state:', error);
		throw error;
	}
}

/**
 * Clear theme state backup and original theme tracking
 */
export function clearThemeStateBackup(): void {
	originalObsidianTheme = null;
	originalObsidianThemeMode = null;
}

/**
 * Get the original Obsidian theme (before any workspace-specific changes)
 */
export function getOriginalObsidianTheme(): string | null {
	return originalObsidianTheme;
}

/**
 * Get the original Obsidian theme mode (before any workspace-specific changes)
 */
export function getOriginalObsidianThemeMode(): ThemeMode | null {
	return originalObsidianThemeMode;
}
