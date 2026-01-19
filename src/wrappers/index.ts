import { type App, Modal, type Plugin, PluginSettingTab } from 'obsidian';
import React from 'react';
import { ContextWorkspacesSettingTab as ReactContextWorkspacesSettingTab } from '../components/ContextWorkspacesSettingTab';
import { HelpModal as ReactHelpModal } from '../components/HelpModal';
import { SpaceCreateModal } from '../components/SpaceCreateModal';
import { SpaceEditModal as ReactSpaceEditModal } from '../components/SpaceEditModal';
import { SpaceManagerModal as ReactSpaceManagerModal } from '../components/SpaceManagerModal';
import type { ContextWorkspacesPlugin } from '../types';
import { ReactModalWrapper, ReactWrapper } from '../utils/react-utils';

// Export the SpaceCreateModal directly since it now extends Modal
export { SpaceCreateModal };

// Wrapper for HelpModal
export class HelpModal extends Modal {
	private reactWrapper: ReactModalWrapper;

	constructor(app: App) {
		super(app);
		this.reactWrapper = new ReactModalWrapper();
	}

	onOpen() {
		this.reactWrapper.open(
			React.createElement(ReactHelpModal, {
				isOpen: true,
				onClose: () => this.close(),
			})
		);
	}

	onClose() {
		this.reactWrapper.close();
	}
}

// Wrapper for SpaceEditModal (React version - used in settings tab)
export class SpaceEditModal extends Modal {
	private plugin: ContextWorkspacesPlugin;
	private spaceId: string;
	private onSave?: () => void;
	private reactWrapper: ReactModalWrapper;

	constructor(app: App, plugin: ContextWorkspacesPlugin, spaceId: string, onSave?: () => void) {
		super(app);
		this.plugin = plugin;
		this.spaceId = spaceId;
		this.onSave = onSave;
		this.reactWrapper = new ReactModalWrapper();
	}

	onOpen() {
		this.reactWrapper.open(
			React.createElement(ReactSpaceEditModal, {
				app: this.app,
				plugin: this.plugin,
				spaceId: this.spaceId,
				isOpen: true,
				onSave: this.onSave,
				onClose: () => this.close(),
			})
		);
	}

	onClose() {
		this.reactWrapper.close();
	}
}

// Wrapper for SpaceManagerModal
export class SpaceManagerModal extends Modal {
	private plugin: ContextWorkspacesPlugin;
	private reactWrapper: ReactModalWrapper;

	constructor(app: App, plugin: ContextWorkspacesPlugin) {
		super(app);
		this.plugin = plugin;
		this.reactWrapper = new ReactModalWrapper();
	}

	onOpen() {
		this.reactWrapper.open(
			React.createElement(ReactSpaceManagerModal, {
				app: this.app,
				plugin: this.plugin,
				isOpen: true,
				onClose: () => this.close(),
			})
		);
	}

	onClose() {
		this.reactWrapper.close();
	}
}

// Wrapper for ContextWorkspacesSettingTab
export class ContextWorkspacesSettingTab extends PluginSettingTab {
	private plugin: ContextWorkspacesPlugin;
	private reactWrapper: ReactWrapper;

	constructor(app: App, plugin: ContextWorkspacesPlugin) {
		super(app, plugin as unknown as Plugin);
		this.plugin = plugin;
		this.reactWrapper = new ReactWrapper();
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.reactWrapper.render(
			React.createElement(ReactContextWorkspacesSettingTab, {
				app: this.app,
				plugin: this.plugin,
				containerEl: containerEl,
			}),
			containerEl
		);
	}

	hide() {
		this.reactWrapper.cleanup();
		super.hide();
	}
}

// Note: SidebarManager has been removed.
// The sidebar is now rendered via ContextWorkspacesView (ItemView) which allows
// users to reposition it via drag-and-drop in Obsidian's workspace-tab area.
