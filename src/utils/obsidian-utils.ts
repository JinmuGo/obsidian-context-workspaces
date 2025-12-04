import type { App } from 'obsidian';
import type {
	ContextWorkspacesPluginLike,
	ThemeMode,
	WorkspacesInstance,
} from '../types';

/**
 * Get Obsidian's internal workspaces plugin
 */
export function getWorkspacesPlugin(app: App) {
	// @ts-expect-error - Obsidian 내부 API 접근
	return app.internalPlugins.plugins.workspaces as {
		enabled?: boolean;
		instance?: WorkspacesInstance;
	};
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
		if (workspaces?.enabled && workspaces.instance?.workspaces[workspaceId]) {
			await workspaces.instance.loadWorkspace(workspaceId);
		}
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
 * Create workspace in Obsidian's internal API
 */
export async function createObsidianWorkspace(
	app: App,
	workspaceId: string,
	workspaceName: string
): Promise<void> {
	try {
		const workspaces = getWorkspacesPlugin(app);
		if (workspaces?.enabled && workspaces.instance) {
			// 현재 workspace의 상태를 저장하여 가져오기
			const tempWorkspaceId = `temp_${Date.now()}`;

			// 현재 상태를 임시 workspace로 저장
			workspaces.instance.saveWorkspace(tempWorkspaceId);

			// 저장된 현재 상태를 가져와서 복사
			const currentWorkspace = workspaces.instance.workspaces[tempWorkspaceId];
			let workspaceStructure: Record<string, unknown> & { name: string };

			if (currentWorkspace && typeof currentWorkspace === 'object') {
				// 현재 workspace의 구조를 복사하되, name만 변경
				workspaceStructure = {
					...currentWorkspace,
					name: workspaceName,
				} as Record<string, unknown> & { name: string };

				// 임시 workspace 삭제
				delete workspaces.instance.workspaces[tempWorkspaceId];
			} else {
				// 현재 workspace가 없는 경우 기본 구조 사용
				workspaceStructure = {
					name: workspaceName,
					main: {
						type: 'tabs',
						active: null,
						children: [],
					},
					left: {
						type: 'tabs',
						active: null,
						children: [],
					},
					right: {
						type: 'tabs',
						active: null,
						children: [],
					},
				};
			}

			workspaces.instance.workspaces[workspaceId] = workspaceStructure;

			// Workspace 저장
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
export function getObsidianWorkspaceNames(app: App): Record<string, string> {
	try {
		const workspaces = getWorkspacesPlugin(app);
		if (workspaces?.enabled && workspaces.instance?.workspaces) {
			const workspaceNames: Record<string, string> = {};
			for (const [id, workspace] of Object.entries(workspaces.instance.workspaces)) {
				workspaceNames[id] = (workspace as { name?: string }).name || id;
			}
			return workspaceNames;
		}
		return {};
	} catch (error) {
		console.error('Failed to get Obsidian workspace names:', error);
		return {};
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
		// Try multiple methods to get available themes
		// Method 1: Direct customCss access
		// @ts-expect-error - Obsidian internal API access
		const customCss = app.customCss;
		if (customCss?.themes) {
			return Object.keys(customCss.themes).sort();
		}

		// Method 2: Check vault config
		// @ts-expect-error - Obsidian internal API access
		const vaultConfig = app.vault.config;
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

		// Fallback to common themes
		const commonThemes = ['obsidian', 'dark', 'light'];
		return commonThemes;
	} catch (error) {
		console.error('Failed to get available themes:', error);
		// Return default themes as fallback
		return ['obsidian', 'dark', 'light'];
	}
}

/**
 * Get current theme
 */
export function getCurrentTheme(app: App): string {
	try {
		// Method 1: Direct customCss access
		// @ts-expect-error - Obsidian internal API access
		const customCss = app.customCss;
		if (customCss?.theme) {
			return customCss.theme;
		}

		// Method 2: Check vault config
		// @ts-expect-error - Obsidian internal API access
		const vaultConfig = app.vault.config;
		if (vaultConfig?.theme) {
			return vaultConfig.theme;
		}

		// Method 3: Check body classes for default themes
		const body = document.body;
		if (body.classList.contains('theme-dark')) {
			return 'dark';
		}
		if (body.classList.contains('theme-light')) {
			return 'light';
		}

		return 'obsidian';
	} catch (error) {
		console.error('Failed to get current theme:', error);
		return 'obsidian';
	}
}

/**
 * Set theme
 */
export async function setTheme(app: App, themeName: string): Promise<void> {
	try {
		// Method 1: Use customCss.setTheme if available (safest method)
		// @ts-expect-error - Obsidian internal API access
		const customCss = app.customCss;
		if (customCss?.setTheme && typeof customCss.setTheme === 'function') {
			customCss.setTheme(themeName);
			return;
		}

		// Method 2: Use Obsidian's built-in theme switching if available
		// @ts-expect-error - Obsidian internal API access
		if (app.internalPlugins?.plugins?.theme?.instance?.setTheme) {
			// @ts-expect-error - Obsidian internal API access
			app.internalPlugins.plugins.theme.instance.setTheme(themeName);
			return;
		}

		// Method 3: Update vault config directly (with safety checks)
		const vaultConfig = (app.vault as { config?: { theme?: string } }).config;
		if (vaultConfig) {
			// Only change if the theme is actually different
			if (vaultConfig.theme !== themeName) {
				vaultConfig.theme = themeName;
				await (app.vault as unknown as { saveConfig(): Promise<void> }).saveConfig();

				// Trigger theme change event
				const workspace = app.workspace as { trigger?: (event: string) => void };
				if (workspace.trigger) {
					workspace.trigger('css-change');
				}

				
				// Force Obsidian to refresh the theme immediately
				setTimeout(() => {
					// Trigger additional events to ensure theme is applied
					const event = new CustomEvent('theme-change', { detail: { theme: themeName } });
					document.dispatchEvent(event);
					
					// Force a re-render of the workspace
					if (workspace.trigger) {
						workspace.trigger('resize');
					}
				}, 50);
			}
			return;
		}

		// Method 4: Fallback - try to reload the page theme
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
		// Check body classes for current mode
		const body = document.body;
		if (body.classList.contains('theme-dark')) {
			return 'dark';
		}
		if (body.classList.contains('theme-light')) {
			return 'light';
		}

		// If no explicit classes, check if it's system mode
		// Check config first
		const configMode = (app.vault as { config?: { themeMode?: string } }).config?.themeMode;
		if (configMode === 'light' || configMode === 'dark') {
			return configMode;
		}

		// If no explicit mode is set, it's system mode
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
	const body = document.body;
	if (body.classList.contains('theme-dark')) {
		return 'dark';
	}
	if (body.classList.contains('theme-light')) {
		return 'light';
	}
	// system mode - check system preference
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Set theme mode
 */
export async function setThemeMode(app: App, mode: ThemeMode): Promise<void> {
	try {
		const body = document.body;
		const currentMode = getCurrentThemeMode(app);

		// Only change if the mode is actually different
		if (currentMode === mode) {
			return;
		}

		// Use Obsidian's built-in theme mode switching if available
		// @ts-expect-error - Obsidian internal API access
		if (app.internalPlugins?.plugins?.theme?.instance?.setThemeMode) {
			// @ts-expect-error - Obsidian internal API access
			app.internalPlugins.plugins.theme.instance.setThemeMode(mode);
			return;
		}

		// Fallback: Manual class manipulation
		if (mode === 'dark') {
			body.classList.remove('theme-light');
			body.classList.add('theme-dark');
		} else if (mode === 'light') {
			body.classList.remove('theme-dark');
			body.classList.add('theme-light');
		} else if (mode === 'system') {
			// system mode - Remove both classes and apply system preference
			body.classList.remove('theme-dark', 'theme-light');

			// Apply system preference
			const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
			if (isDarkMode) {
				body.classList.add('theme-dark');
			} else {
				body.classList.add('theme-light');
			}
		}

		// Update config for persistence
		const vaultConfig = (app.vault as { config?: { themeMode?: string } }).config;
		if (vaultConfig) {
			vaultConfig.themeMode = mode;
			await (app.vault as unknown as { saveConfig(): Promise<void> }).saveConfig();
		}

		// Trigger theme change events
		const workspace = app.workspace as { trigger?: (event: string) => void };
		if (workspace.trigger) {
			workspace.trigger('css-change');
		}

		// Dispatch custom event for theme mode change
		window.dispatchEvent(new CustomEvent('theme-mode-change', { detail: { mode } }));
		
		// Force Obsidian to refresh the theme mode immediately
		setTimeout(() => {
			// Trigger additional events to ensure theme mode is applied
			const event = new CustomEvent('theme-change', { detail: { mode } });
			document.dispatchEvent(event);
			
			// Force a re-render of the workspace
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

		// Apply theme if specified
		if (theme !== undefined) {
			let themeToApply: string;
			
			if (theme === '' || !theme.trim()) {
				// "Use Obsidian theme" option selected - use original Obsidian theme
				themeToApply = getOriginalObsidianTheme() || getCurrentTheme(app);
			} else {
				// Specific theme selected
				themeToApply = theme.trim();
			}
			
			const currentTheme = getCurrentTheme(app);
			if (currentTheme !== themeToApply) {
				// Apply theme without changing Obsidian's default theme setting
				setThemeTemporarily(app, themeToApply);
				changes.push(`Theme: ${themeToApply}`);
			}
		}

		// Apply mode if specified (including system mode)
		if (themeMode) {
			const currentMode = getCurrentThemeMode(app);
			if (currentMode !== themeMode) {
				// Apply theme mode without changing Obsidian's default theme mode setting
				setThemeModeTemporarily(app, themeMode);
				changes.push(`Mode: ${themeMode}`);
			}
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
		// Method 1: Use customCss.setTheme if available (safest method)
		// @ts-expect-error - Obsidian internal API access
		const customCss = app.customCss;
		if (customCss?.setTheme && typeof customCss.setTheme === 'function') {
			customCss.setTheme(themeName);
			return;
		}

		// Method 2: Use Obsidian's built-in theme switching if available
		// @ts-expect-error - Obsidian internal API access
		if (app.internalPlugins?.plugins?.theme?.instance?.setTheme) {
			// @ts-expect-error - Obsidian internal API access
			app.internalPlugins.plugins.theme.instance.setTheme(themeName);
			return;
		}

		// Method 3: Apply theme without saving to config (temporary change)
		if (customCss?.theme) {
			customCss.theme = themeName;
			
			// Trigger theme change event without saving config
			const workspace = app.workspace as { trigger?: (event: string) => void };
			if (workspace.trigger) {
				workspace.trigger('css-change');
			}

			// Force Obsidian to refresh the theme immediately
			setTimeout(() => {
				// Trigger additional events to ensure theme is applied
				const event = new CustomEvent('theme-change', { detail: { theme: themeName } });
				document.dispatchEvent(event);
				
				// Force a re-render of the workspace
				if (workspace.trigger) {
					workspace.trigger('resize');
				}
			}, 50);
			return;
		}

		// Method 4: Fallback - try to reload the page theme
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
		const body = document.body;
		const currentMode = getCurrentThemeMode(app);

		// Only change if the mode is actually different
		if (currentMode === mode) {
			return;
		}

		// Use Obsidian's built-in theme mode switching if available
		// @ts-expect-error - Obsidian internal API access
		if (app.internalPlugins?.plugins?.theme?.instance?.setThemeMode) {
			// @ts-expect-error - Obsidian internal API access
			app.internalPlugins.plugins.theme.instance.setThemeMode(mode);
			return;
		}

		// Fallback: Manual class manipulation without saving to config
		if (mode === 'dark') {
			body.classList.remove('theme-light');
			body.classList.add('theme-dark');
		} else if (mode === 'light') {
			body.classList.remove('theme-dark');
			body.classList.add('theme-light');
		} else if (mode === 'system') {
			// system mode - Remove both classes and apply system preference
			body.classList.remove('theme-dark', 'theme-light');

			// Apply system preference
			const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
			if (isDarkMode) {
				body.classList.add('theme-dark');
			} else {
				body.classList.add('theme-light');
			}
		}

		// Trigger theme change events without saving config
		const workspace = app.workspace as { trigger?: (event: string) => void };
		if (workspace.trigger) {
			workspace.trigger('css-change');
		}

		// Dispatch custom event for theme mode change
		window.dispatchEvent(new CustomEvent('theme-mode-change', { detail: { mode } }));
		
		// Force Obsidian to refresh the theme mode immediately
		setTimeout(() => {
			// Trigger additional events to ensure theme mode is applied
			const event = new CustomEvent('theme-change', { detail: { mode } });
			document.dispatchEvent(event);
			
			// Force a re-render of the workspace
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
		const originalLoadWorkspace = workspaces.instance.loadWorkspace.bind(workspaces.instance);
		workspaces.instance._originalLoadWorkspace = originalLoadWorkspace;

		// Override loadWorkspace method to detect calls
		workspaces.instance.loadWorkspace = async (workspaceId: string) => {
			// Call original method first
			await originalLoadWorkspace(workspaceId);

			// Check if this workspace corresponds to a Context Space
			const spaceExists = plugin.settings.spaces[workspaceId];
			const currentSpaceId = plugin.settings.currentSpaceId;

			if (spaceExists && workspaceId !== currentSpaceId) {
				// Switch to the corresponding Context Space
				setTimeout(() => {
					void plugin.switchToSpace(workspaceId).catch((error) => {
						console.error('Failed to auto-switch to Context Space:', error);
					});
				}, 100); // Small delay to ensure workspace is fully loaded
			}
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
		if (!originalObsidianTheme && !originalObsidianThemeMode) {
			return;
		}

		const changes: string[] = [];

		// Restore to original Obsidian theme (not the backed up workspace-specific theme)
		if (originalObsidianTheme) {
			const currentTheme = getCurrentTheme(app);
			if (currentTheme !== originalObsidianTheme) {
				await setTheme(app, originalObsidianTheme);
				changes.push(`Theme: ${originalObsidianTheme}`);
			}
		}

		// Restore to original Obsidian theme mode
		if (originalObsidianThemeMode) {
			const currentMode = getCurrentThemeMode(app);
			if (currentMode !== originalObsidianThemeMode) {
				await setThemeMode(app, originalObsidianThemeMode);
				changes.push(`Mode: ${originalObsidianThemeMode}`);
			}
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
