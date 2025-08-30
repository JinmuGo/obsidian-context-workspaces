// Obsidian API mocking

interface CreateElementOptions {
	cls?: string;
	text?: string;
	placeholder?: string;
	rows?: number;
	type?: string;
}

type ObsidianElement = HTMLElement & Record<string, unknown>;

export class Notice {
	// Notice functionality for testing
}

// DOM 요소에 Obsidian 메서드 추가하는 헬퍼 함수
function addObsidianMethods(element: HTMLElement): ObsidianElement {
	const el = element as ObsidianElement;
	el.empty = () => {
		while (element.firstChild) {
			element.removeChild(element.firstChild);
		}
	};

	el.addClass = (...classes: string[]) => {
		classes.forEach((cls) => {
			element.classList.add(cls);
		});
	};

	el.createDiv = (className?: string) => {
		const div = document.createElement('div') as HTMLDivElement;
		if (className) {
			div.className = className;
		}
		element.appendChild(div);
		return addObsidianMethods(div) as unknown as HTMLDivElement & ObsidianElement;
	};

	el.createEl = (tag: string, options?: CreateElementOptions) => {
		const createdElement = document.createElement(tag);
		if (options?.cls) {
			createdElement.className = options.cls;
		}
		if (options?.text) {
			createdElement.textContent = options.text;
		}
		if (options?.placeholder) {
			(createdElement as HTMLInputElement).placeholder = options.placeholder;
		}
		if (options?.rows) {
			(createdElement as HTMLTextAreaElement).rows = options.rows;
		}
		if (options?.type) {
			(createdElement as HTMLInputElement).type = options.type;
		}
		return addObsidianMethods(createdElement);
	};

	return el;
}

export class Modal {
	app: unknown;
	contentEl: ObsidianElement;

	constructor(app: unknown) {
		this.app = app;
		this.contentEl = addObsidianMethods(document.createElement('div'));
	}

	open() {
		// Modal open logic
	}

	close() {
		// Modal close logic
	}
}

export class Plugin {
	app: unknown;
	settings: Record<string, unknown>;

	constructor(app: unknown, _manifest: unknown) {
		this.app = app;
		this.settings = {};
	}

	async loadData() {
		return this.settings;
	}

	async saveData(data: Record<string, unknown>) {
		this.settings = data;
	}
}

// App 모킹
export const mockApp = {
	workspace: {
		on: jest.fn(),
		leftSplit: {
			containerEl: addObsidianMethods(document.createElement('div')),
		},
	},
	internalPlugins: {
		plugins: {
			workspaces: {
				enabled: true,
				instance: {
					workspaces: {} as Record<string, unknown>,
					saveData: jest.fn().mockResolvedValue(undefined),
					loadWorkspace: jest.fn().mockResolvedValue(undefined),
					saveWorkspace: jest.fn(),
					getCurrentWorkspace: jest.fn().mockReturnValue(null),
				},
			},
		},
	},
	vault: {
		config: {
			theme: 'obsidian',
			themeMode: 'system',
		},
		saveConfig: jest.fn().mockResolvedValue(undefined),
	},
	customCss: {
		theme: 'obsidian',
		themes: {
			obsidian: {},
			dark: {},
			light: {},
		},
		setTheme: jest.fn(),
	},
};

// TFile 타입 모킹
export interface TFile {
	path: string;
	name: string;
	basename: string;
	extension: string;
}

// Other Obsidian types
export type App = typeof mockApp;
