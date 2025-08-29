// ===== Common Type Definitions =====

// Theme mode type
export type ThemeMode = 'light' | 'dark' | 'system';

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
	saveWorkspace: (id: string) => void;
	loadWorkspace: (id: string) => Promise<void>;
	saveData: () => Promise<void>;
	_originalLoadWorkspace?: (id: string) => Promise<void>;
}

// Context Workspaces plugin-like interface
export interface ContextWorkspacesPluginLike {
	settings: { spaces: Record<string, unknown>; currentSpaceId: string };
	switchToSpace: (spaceId: string) => Promise<void>;
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
	workspaceLastSeen?: Record<string, number>; // Track when workspaces were last seen
}

export const DEFAULT_SETTINGS: ContextWorkspacesSettings = {
	spaces: {},
	currentSpaceId: '',
	spaceOrder: [],
};

// Plugin type for better type safety
export interface ContextWorkspacesPlugin {
	app: unknown; // Obsidian App instance
	settings: ContextWorkspacesSettings;
	saveSettings(): Promise<void>;
	switchToSpace(spaceId: string): Promise<void>;
	createNewSpace(): Promise<void>;
	openSpaceManager(): void;
	deleteSpace(spaceId: string): Promise<void>;
	updateSidebarSpaces(): void;
	updateSidebarSpacesOptimized(): void;
	onSpaceOrderChanged(newSpaceOrder: string[]): void;
	searchSpaces(query: string): string[];
	// Workspace API synchronization methods
	syncSpaceNameWithObsidian(spaceId: string, newName: string): Promise<void>;
	syncMissingWorkspacesFromObsidian(): Promise<void>;
	initializeWorkspaceSync(): Promise<void>;
}
