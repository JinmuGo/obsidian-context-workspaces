// #23: selecting System mode forces dark mode, and the theme dropdown resets to
// "Use Obsidian theme" when the editor is reopened.

const THEME = 'E2E Theme';

/** Open the editor for the space at `index`, optionally change its fields, and save. */
async function editSpace(settingsPage, index, { theme, mode } = {}) {
	return settingsPage.eval(`(async () => {
		const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
		const editButtons = [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Edit');
		editButtons[${index}].click();
		await sleep(500);
		const [themeSelect, modeSelect] = document.querySelectorAll('select');
		const shown = { theme: themeSelect.value, mode: modeSelect.value };
		const setValue = (select, value) => {
			Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, value);
			select.dispatchEvent(new Event('change', { bubbles: true }));
		};
		${theme === undefined ? '' : `setValue(themeSelect, ${JSON.stringify(theme)});`}
		${mode === undefined ? '' : `setValue(modeSelect, ${JSON.stringify(mode)});`}
		await sleep(200);
		[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Save').click();
		await sleep(1000);
		return shown;
	})()`);
}

export default {
	id: 'issue-23',
	title: 'System mode follows the OS and theme choices persist',
	vault: {
		notes: ['note.md'],
		workspaces: {
			work: { main: { id: 'main', type: 'split', children: [] }, name: 'work' },
			other: { main: { id: 'main', type: 'split', children: [] }, name: 'other' },
		},
		activeWorkspace: 'work',
		appearance: { theme: 'moonstone', cssTheme: '' },
		themes: { [THEME]: 'body { --e2e-theme: 1; }\n' },
		settings: {
			spaces: {
				work: { name: 'work', icon: '🏠', autoSave: false, themeMode: 'light' },
				other: { name: 'other', icon: '📄', autoSave: false },
			},
			spaceOrder: ['work', 'other'],
			currentSpaceId: 'work',
			activateViewOnStartup: false,
		},
	},

	async run(ctx) {
		const main = await ctx.mainPage();
		const bodyMode = () =>
			ctx.eval(`document.body.classList.contains('theme-dark') ? 'dark' : 'light'`);
		const reapplyWork = async () => {
			await ctx.switchToSpace('other');
			await ctx.switchToSpace('work');
		};

		await main.emulateColorScheme('light');
		let settings = await ctx.openPluginSettings();
		await settings.emulateColorScheme('light');
		await editSpace(settings, 0, { mode: 'system' });
		await ctx.closePluginSettings();
		await reapplyWork();
		ctx.check('System mode is light when the OS is light', (await bodyMode()) === 'light', await bodyMode());

		await main.emulateColorScheme('dark');
		await reapplyWork();
		ctx.check('System mode is dark when the OS is dark', (await bodyMode()) === 'dark', await bodyMode());

		settings = await ctx.openPluginSettings();
		await editSpace(settings, 0, { theme: THEME });
		const reopened = await editSpace(settings, 0);
		ctx.check('a chosen theme is still selected when the editor reopens', reopened.theme === THEME, reopened);

		await editSpace(settings, 0, { theme: '' });
		await ctx.closePluginSettings();
		const saved = await ctx.eval(`${ctx.plugin}.settings.spaces.work.theme ?? null`);
		ctx.check('"Use Obsidian theme" saves no theme for the space', saved === null, saved);
		const cssTheme = ctx.readJson(ctx.appearanceFile).cssTheme ?? '';
		ctx.check(
			'the community theme setting never holds a colour scheme name',
			!['moonstone', 'obsidian', 'system', 'light', 'dark'].includes(cssTheme),
			cssTheme
		);
	},
};
