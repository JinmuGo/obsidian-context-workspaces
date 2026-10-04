// #18: workspace contents replaced with tabs from another device. A space whose layout has
// not synced yet must not get one made from whatever is on screen, and mobile must never
// write its tabs into the layouts desktops share.

import { layoutWithFile } from '../lib/obsidian.mjs';

const space = (name, icon) => ({ name, icon, autoSave: true });

export default {
	id: 'issue-18',
	title: 'layouts are never rebuilt from the wrong screen',
	vault: {
		notes: ['A.md', 'B.md', 'note.md'],
		workspaces: {
			A: { ...layoutWithFile('A.md'), name: 'A' },
			B: { ...layoutWithFile('B.md'), name: 'B' },
		},
		activeWorkspace: 'A',
		settings: {
			// D's data.json entry arrived before its workspaces.json entry.
			spaces: { A: space('A', '🅰️'), B: space('B', '🅱️'), D: space('D', '🧪') },
			spaceOrder: ['A', 'B', 'D'],
			currentSpaceId: 'A',
			activateViewOnStartup: false,
		},
	},

	async run(ctx) {
		const atStartup = ctx.readJson(ctx.workspacesFile).workspaces;
		ctx.check(
			'startup does not make a layout for D from the screen',
			atStartup.D === undefined,
			ctx.filesInLayout(atStartup.D)
		);
		const spaces = await ctx.eval(`Object.keys(${ctx.plugin}.settings.spaces)`);
		ctx.check('space D is kept while its layout is missing', spaces.includes('D'), spaces);

		await ctx.emulateMobile(true);
		const isMobile = await ctx.eval('app.isMobile');
		ctx.check('mobile emulation is on', isMobile === true, isMobile);
		const before = ctx.readJson(ctx.workspacesFile).workspaces;
		await ctx.switchToSpace('B');
		await ctx.openFileInNewTab('note.md');
		await ctx.sleep(2000);
		await ctx.switchToSpace('A');
		const after = ctx.readJson(ctx.workspacesFile).workspaces;
		ctx.check(
			'mobile does not save its tabs into workspace B',
			JSON.stringify(after.B) === JSON.stringify(before.B),
			{ before: ctx.filesInLayout(before.B), after: ctx.filesInLayout(after.B) }
		);
		ctx.check(
			'mobile does not make a layout for D',
			(await ctx.switchToSpace('D')) === false && ctx.readJson(ctx.workspacesFile).workspaces.D === undefined
		);
	},
};
