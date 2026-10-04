// ===== Obsidian Internal API Type Definitions =====

/**
 * Obsidian's internal customCss interface (not officially documented)
 */
export interface ObsidianCustomCss {
	theme?: string;
	themes?: Record<string, unknown>;
	setTheme?: (themeName: string) => void;
}

/**
 * Obsidian's internal plugins interface
 */
export interface ObsidianInternalPlugins {
	plugins: {
		workspaces?: {
			enabled?: boolean;
			instance?: WorkspacesInstance;
			// Reads `.obsidian/workspaces.json` from disk
			loadData?: () => Promise<WorkspacesData | null>;
		};
	};
}

/**
 * Extended App interface for accessing Obsidian internal APIs
 */
export interface ObsidianAppInternal {
	customCss?: ObsidianCustomCss;
	internalPlugins: ObsidianInternalPlugins;
	changeTheme?: (theme: ObsidianBaseTheme) => void;
	workspace: {
		trigger?: (event: string) => void;
	};
	vault: {
		config?: {
			theme?: ObsidianBaseTheme;
			cssTheme?: string;
			themes?: Record<string, unknown>;
		};
		saveConfig?: () => Promise<void>;
	};
}

// ===== Common Type Definitions =====

// Theme mode type
export type ThemeMode = 'light' | 'dark' | 'system';

// Obsidian's persisted base colour scheme values
export type ObsidianBaseTheme = 'moonstone' | 'obsidian' | 'system';

// Sidebar view mode type
export type SidebarViewMode = 'icon' | 'list';

// Emoji data interface
export interface EmojiData {
	native: string;
	colons?: string;
	unified?: string;
	emoji?: string;
	name?: string;
	category?: string;
	[key: string]: string | undefined;
}

// Theme state backup interface
export interface ThemeStateBackup {
	theme?: string;
	themeMode?: ThemeMode;
}

// Obsidian workspace instance interface
export interface WorkspacesInstance {
	workspaces: Record<string, { name?: string } & Record<string, unknown>>;
	activeWorkspace: string;
	saveWorkspace: (id: string) => void;
	loadWorkspace: (id: string) => Promise<void>;
	deleteWorkspace: (id: string) => Promise<void>;
	saveData: () => Promise<void>;
	// Obsidian calls this when workspaces.json changes on disk (e.g. via a sync tool)
	onExternalSettingsChange?: () => Promise<void>;
	_originalLoadWorkspace?: (id: string) => Promise<void>;
	_originalSaveWorkspace?: (id: string) => void;
	_originalDeleteWorkspace?: (id: string) => Promise<void>;
}

// Persisted shape of `.obsidian/workspaces.json`
export interface WorkspacesData {
	workspaces?: WorkspacesInstance['workspaces'];
	active?: string;
}

// Receives workspace registry changes that the user made through Obsidian's own UI
export interface WorkspaceRegistryListener {
	handleNativeWorkspaceSaved: (workspaceId: string) => void;
	handleNativeWorkspaceDeleted: (workspaceId: string) => void;
}

// Queued space switch request (last-wins) while a switch is in flight.
// Carries the full request so a queued native-switcher follow-up keeps skipSave.
export interface PendingSpaceRequest {
	spaceId: string;
	method: string;
	skipSave: boolean;
	workspaceAlreadyLoaded: boolean;
	nativeLoadGeneration?: number;
	resolve: (switched: boolean) => void;
}

// Context Workspaces plugin-like interface
export interface ContextWorkspacesPluginLike {
	settings: { spaces: Record<string, unknown>; currentSpaceId: string };
	switchingToSpaceId: string | null;
	loadedWorkspaceId: string | null;
	internalWorkspaceLoadId: string | null;
	workspaceLoadInProgress: number;
	workspaceLoadGeneration: number;
	switchToSpace: (
		spaceId: string,
		method?: string,
		skipSave?: boolean,
		workspaceAlreadyLoaded?: boolean,
		nativeLoadGeneration?: number,
	) => Promise<boolean>;
	saveCurrentSpaceState: () => void;
	cancelPendingLayoutSave: () => void;
}

// ===== Existing Type Definitions =====

export interface SpaceConfig {
	name: string;
	icon: string; // Space icon (emoji or text)
	autoSave: boolean;
	theme?: string; // Space-specific theme name
	themeMode?: ThemeMode; // Theme mode
	description?: string; // Space description
	createdAt?: number; // Creation timestamp
}

export interface ContextWorkspacesSettings {
	spaces: Record<string, SpaceConfig>;
	spaceOrder: string[];
	currentSpaceId: string;
	sidebarViewMode?: SidebarViewMode; // Sidebar display mode: 'icon' or 'list'
	activateViewOnStartup?: boolean; // Reveal the Context Workspaces tab on startup
	showStatusBar?: boolean; // Show the status bar space switcher
}

export const DEFAULT_SETTINGS: ContextWorkspacesSettings = {
	spaces: {},
	currentSpaceId: '',
	spaceOrder: [],
	sidebarViewMode: 'icon',
	activateViewOnStartup: true,
	showStatusBar: true,
};

export interface ContextWorkspacesPlugin {
	app: unknown; // Obsidian App instance
	settings: ContextWorkspacesSettings;
	saveSettings(): Promise<void>;
	switchToSpace(
		spaceId: string,
		method?: string,
		skipSave?: boolean,
		workspaceAlreadyLoaded?: boolean,
		nativeLoadGeneration?: number,
	): Promise<boolean>;
	switchToNextSpace(): void;
	switchToPreviousSpace(): void;
	createNewSpace(): Promise<void>;
	openSpaceManager(): void;
	openSettings(): void;
	refreshStatusBar(): void;
	deleteSpace(spaceId: string): Promise<void>;
	updateSidebarSpaces(): void;
	updateSidebarSpacesOptimized(): void;
	onSpaceOrderChanged(newSpaceOrder: string[]): void;
	searchSpaces(query: string): string[];
	// Workspace API synchronization methods
	syncSpaceNameWithObsidian(spaceId: string, newName: string): Promise<void>;
	syncMissingWorkspacesFromObsidian(): Promise<void>;
}
