import type { App } from 'obsidian';
import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { SpaceEditModal } from '../src/components/SpaceEditModal';
import {
	applySpaceTheme,
	backupThemeState,
	clearThemeStateBackup,
	getAvailableThemes,
	getCurrentTheme,
	getCurrentThemeMode,
	normalizeCommunityTheme,
	setThemeMode,
} from '../src/utils/obsidian-utils';

interface ThemeTestApp {
	customCss: {
		theme: string;
		themes: Record<string, unknown>;
		setTheme: jest.Mock;
	};
	internalPlugins: {
		plugins: {
			theme?: {
				instance: {
					setThemeMode: jest.Mock;
				};
			};
		};
	};
	vault: {
		config: {
			theme: string;
			cssTheme: string;
			themeMode?: string;
		};
		saveConfig: jest.Mock<Promise<void>, []>;
	};
	workspace: {
		trigger: jest.Mock;
	};
}

function createApp(overrides: Partial<ThemeTestApp> = {}): ThemeTestApp {
	const app: ThemeTestApp = {
		customCss: {
			theme: 'Original',
			themes: { Original: {} },
			setTheme: jest.fn((theme: string) => {
				app.customCss.theme = theme;
			}),
		},
		internalPlugins: { plugins: {} },
		vault: {
			config: {
				theme: 'system',
				cssTheme: 'Original',
			},
			saveConfig: jest.fn().mockResolvedValue(undefined),
		},
		workspace: { trigger: jest.fn() },
	};

	return Object.assign(app, overrides);
}

describe('Obsidian theme integration', () => {
	beforeEach(() => {
		clearThemeStateBackup();
		document.body.className = '';
		jest.mocked(window.matchMedia).mockImplementation((query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: jest.fn(),
			removeListener: jest.fn(),
			addEventListener: jest.fn(),
			removeEventListener: jest.fn(),
			dispatchEvent: jest.fn(),
		}));
	});

	afterEach(() => {
		clearThemeStateBackup();
	});

	test.each([
		['system', 'system'],
		['moonstone', 'light'],
		['obsidian', 'dark'],
	] as const)('maps Obsidian base theme %s to workspace mode %s', (baseTheme, expected) => {
		const app = createApp();
		app.vault.config.theme = baseTheme;
		document.body.className = baseTheme === 'obsidian' ? 'theme-dark' : 'theme-light';

		expect(getCurrentThemeMode(app as unknown as App)).toBe(expected);
	});

	it('treats an empty custom CSS theme as the Obsidian default theme', () => {
		const app = createApp();
		app.customCss.theme = '';
		app.vault.config.cssTheme = '';

		expect(getCurrentTheme(app as unknown as App)).toBe('');
	});

	it('does not expose base colour scheme values as community themes', () => {
		const app = createApp({ customCss: undefined as never });

		expect(getAvailableThemes(app as unknown as App)).toEqual([]);
	});

	it('treats legacy base colour scheme values as inherited community themes', () => {
		const app = createApp();

		expect(normalizeCommunityTheme(app as unknown as App, 'obsidian')).toBeUndefined();
	});

	it('applies system mode from the OS preference without calling an invented theme plugin API', () => {
		const setThemeModeSpy = jest.fn();
		const app = createApp({
			internalPlugins: {
				plugins: { theme: { instance: { setThemeMode: setThemeModeSpy } } },
			},
		});
		document.body.className = 'theme-dark';

		applySpaceTheme(app as unknown as App, 'Original', 'system');

		expect(document.body.classList.contains('theme-light')).toBe(true);
		expect(document.body.classList.contains('theme-dark')).toBe(false);
		expect(setThemeModeSpy).not.toHaveBeenCalled();
	});

	it('restores the original community theme when a space inherits the Obsidian theme', () => {
		const app = createApp();
		backupThemeState(app as unknown as App);
		app.customCss.theme = 'Workspace Theme';

		applySpaceTheme(app as unknown as App, undefined, 'light');

		expect(app.customCss.setTheme).toHaveBeenCalledWith('Original');
	});

	it('persists workspace modes using Obsidian base theme values', async () => {
		const app = createApp();

		await setThemeMode(app as unknown as App, 'dark');

		expect(app.vault.config.theme).toBe('obsidian');
		expect(app.vault.config.themeMode).toBeUndefined();
	});

	it('keeps an explicitly selected theme visible when reopening the editor', async () => {
		const app = createApp();
		const container = document.createElement('div');
		document.body.appendChild(container);
		const root = createRoot(container);
		const plugin = {
			app,
			settings: {
				currentSpaceId: 'space',
				spaces: {
					space: {
						name: 'Space',
						icon: '📄',
						autoSave: true,
						theme: 'Original',
						themeMode: 'system',
					},
				},
			},
			saveSettings: jest.fn().mockResolvedValue(undefined),
			updateSidebarSpacesOptimized: jest.fn(),
			syncSpaceNameWithObsidian: jest.fn().mockResolvedValue(undefined),
		};

		await act(async () => {
			root.render(React.createElement(SpaceEditModal, {
				app,
				plugin: plugin as never,
				spaceId: 'space',
				isOpen: true,
				onClose: jest.fn(),
			}));
		});

		const themeSelect = container.querySelectorAll('select')[0];
		expect(themeSelect.value).toBe('Original');

		await act(async () => root.unmount());
		container.remove();
	});
});
