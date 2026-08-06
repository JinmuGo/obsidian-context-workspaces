import type { View, WorkspaceLeaf } from 'obsidian';
import type { ContextWorkspacesPlugin } from '../src/types';
import {
	asContextWorkspacesView,
	ContextWorkspacesView,
} from '../src/views/ContextWorkspacesView';

describe('asContextWorkspacesView', () => {
	test('returns null for a deferred placeholder view', () => {
		// Since Obsidian 1.7.2, background leaves expose a DeferredView
		// placeholder instead of the real view. It has no render() method,
		// so treating it as our view crashes every getView()?.render() call.
		const deferredView = {
			getViewType: () => 'context-workspaces-view',
		} as unknown as View;

		expect(asContextWorkspacesView(deferredView)).toBeNull();
	});

	test('returns the view when the leaf holds a real ContextWorkspacesView', () => {
		const leaf = {} as WorkspaceLeaf;
		const plugin = {
			settings: { spaces: {}, currentSpaceId: '' },
		} as unknown as ContextWorkspacesPlugin;
		const view = new ContextWorkspacesView(leaf, plugin);

		expect(asContextWorkspacesView(view)).toBe(view);
	});
});
