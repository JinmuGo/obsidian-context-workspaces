import { ItemView, type View, type WorkspaceLeaf } from 'obsidian';
import React from 'react';
import { SidebarManager as ReactSidebarManager } from '../components/SidebarManager';
import type { ContextWorkspacesPlugin } from '../types';
import { ReactWrapper } from '../utils/react-utils';

export const VIEW_TYPE_CONTEXT_WORKSPACES = 'context-workspaces-view';

/**
 * Returns the view only when the leaf holds a fully-constructed
 * ContextWorkspacesView. Since Obsidian 1.7.2, background leaves expose a
 * DeferredView placeholder instead of the real view; the placeholder has no
 * render() method and must be treated as "no view".
 */
export function asContextWorkspacesView(view: View): ContextWorkspacesView | null {
	return view instanceof ContextWorkspacesView ? view : null;
}

/**
 * Context Workspaces View - ItemView implementation
 * This view can be repositioned by the user via drag-and-drop in Obsidian's workspace-tab area
 */
export class ContextWorkspacesView extends ItemView {
	plugin: ContextWorkspacesPlugin;
	private reactWrapper: ReactWrapper;

	constructor(leaf: WorkspaceLeaf, plugin: ContextWorkspacesPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.reactWrapper = new ReactWrapper();
	}

	getViewType(): string {
		return VIEW_TYPE_CONTEXT_WORKSPACES;
	}

	getDisplayText(): string {
		return 'Context workspaces';
	}

	getIcon(): string {
		return 'layout-grid';
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (container.instanceOf(HTMLElement)) {
			container.empty();
			container.addClass('context-workspaces-view-container');

			// Render React sidebar component
			this.reactWrapper.render(
				React.createElement(ReactSidebarManager, { plugin: this.plugin }),
				container
			);
		}
	}

	async onClose(): Promise<void> {
		// Cleanup React
		this.reactWrapper.cleanup();
	}

	/**
	 * Re-render the sidebar (called when settings change)
	 */
	render(): void {
		const container = this.containerEl.children[1];
		if (container.instanceOf(HTMLElement) && this.reactWrapper.isConnected()) {
			this.reactWrapper.update(
				React.createElement(ReactSidebarManager, { plugin: this.plugin })
			);
		}
	}
}
