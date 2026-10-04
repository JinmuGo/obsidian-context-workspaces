// #22: Syncthing destroys workspaces. Another device's changes to workspaces.json and
// data.json must survive this device's saves, and only explicit deletions remove spaces.

import { layoutWithFile } from '../lib/obsidian.mjs';

const space = (name, icon) => ({ name, icon, autoSave: true });

export default {
	id: 'issue-22',
	title: 'changes synced from another device survive local saves',
	vault: {
		notes: ['A.md', 'B.md', 'C.md', 'note.md'],
		workspaces: {
			A: { ...layoutWithFile('A.md'), name: 'A' },
			B: { ...layoutWithFile('B.md'), name: 'B' },
		},
		activeWorkspace: 'A',
		settings: {
			spaces: { A: space('A', '🅰️'), B: space('B', '🅱️') },
			spaceOrder: ['A', 'B'],
			currentSpaceId: 'A',
			activateViewOnStartup: false,
		},
	},

	async run(ctx) {
		await ctx.switchToSpace('B');
		await ctx.switchToSpace('A');

		// Another device adds workspace C.
		const workspaces = ctx.readJson(ctx.workspacesFile);
		workspaces.workspaces.C = { ...layoutWithFile('C.md'), name: 'C' };
		ctx.deliver(ctx.workspacesFile, workspaces);
		await ctx.sleep(2500);

		// This device keeps working; auto-save rewrites workspaces.json.
		await ctx.openFileInNewTab('note.md');
		await ctx.sleep(2000);
		const afterSave = ctx.readJson(ctx.workspacesFile).workspaces;
		ctx.check(
			'local auto-save ran',
			ctx.filesInLayout(afterSave.A).includes('note.md'),
			ctx.filesInLayout(afterSave.A)
		);
		ctx.check(
			'workspace C from the other device survives the local save',
			afterSave.C !== undefined,
			Object.keys(afterSave)
		);

		// Another device adds space C to data.json.
		const settings = ctx.readJson(ctx.dataFile);
		settings.spaces.C = space('C', '📚');
		settings.spaceOrder.push('C');
		settings.currentSpaceId = 'C';
		ctx.deliver(ctx.dataFile, settings);
		await ctx.sleep(2500);
		const live = await ctx.eval(`({
			spaces: Object.keys(${ctx.plugin}.settings.spaces),
			current: ${ctx.plugin}.settings.currentSpaceId,
		})`);
		ctx.check('space C from the other device appears without a restart', live.spaces.includes('C'), live);
		ctx.check('the space on this screen stays current', live.current === 'A', live);

		// The user deletes workspace B in Obsidian's own workspace manager.
		await ctx.eval(`${ctx.registry}.deleteWorkspace('B')`);
		await ctx.sleep(1500);
		const savedSpaces = Object.keys(ctx.readJson(ctx.dataFile).spaces);
		ctx.check('deleting a workspace in Obsidian removes its space', !savedSpaces.includes('B'), savedSpaces);
	},
};
