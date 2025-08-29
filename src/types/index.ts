// ===== 공통 타입 정의 =====

// 테마 모드 타입
export type ThemeMode = 'light' | 'dark' | 'system';

// 이모지 데이터 인터페이스
export interface EmojiData {
	native: string;
	colons?: string;
	unified?: string;
	emoji?: string;
	name?: string;
	category?: string;
	[key: string]: string | undefined;
}

// 테마 상태 백업 인터페이스
export interface ThemeStateBackup {
	theme?: string;
	themeMode?: ThemeMode;
}

// Obsidian 워크스페이스 인스턴스 인터페이스
export interface WorkspacesInstance {
	workspaces: Record<string, { name?: string } & Record<string, unknown>>;
	saveWorkspace: (id: string) => void;
	loadWorkspace: (id: string) => Promise<void>;
	saveData: () => Promise<void>;
	_originalLoadWorkspace?: (id: string) => Promise<void>;
}

// ContextSpaces 플러그인과 유사한 인터페이스
export interface ContextSpacesPluginLike {
	settings: { spaces: Record<string, unknown>; currentSpaceId: string };
	switchToSpace: (spaceId: string) => Promise<void>;
}

// ===== 기존 타입 정의 =====

export interface SpaceConfig {
	name: string;
	icon: string; // Space icon (emoji or text)
	autoSave: boolean;
	theme?: string; // Space-specific theme name
	themeMode?: ThemeMode; // Theme mode
	description?: string; // Space description
	createdAt?: number; // Creation timestamp
}

export interface ContextSpacesSettings {
	spaces: Record<string, SpaceConfig>;
	spaceOrder: string[];
	currentSpaceId: string;
	workspaceLastSeen?: Record<string, number>; // Track when workspaces were last seen
}

export const DEFAULT_SETTINGS: ContextSpacesSettings = {
	spaces: {},
	currentSpaceId: '',
	spaceOrder: [],
};

// Plugin type for better type safety
export interface ContextSpacesPlugin {
	app: unknown; // Obsidian App instance
	settings: ContextSpacesSettings;
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
