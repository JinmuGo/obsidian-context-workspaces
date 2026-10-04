/**
 * Regression tests for issues #18 and #22: Syncthing destroying or rewriting
 * workspaces across devices.
 */

import { type App, Platform, type PluginManifest } from 'obsidian';
import ContextWorkspacesPlugin from '../src/main';
import type { WorkspacesData } from '../src/types';
import {
	removeWorkspaceRegistryMonitoring,
	setupWorkspaceRegistryMonitoring,
} from '../src/utils/obsidian-utils';

interface MockWorkspacesInstance {
	workspaces: Record<string, { name?: string } & Record<string, unknown>>;
	activeWorkspace: string;
	saveWorkspace: jest.Mock;
	loadWorkspace: jest.Mock;
	deleteWorkspace: jest.Mock;
	saveData: jest.Mock;
	onExternalSettingsChange?: () => Promise<void>;
}

const LAYOUT_ON_SCREEN = { main: { id: 'on-screen' } };

function createPlugin(workspaces: MockWorkspacesInstance['workspaces']) {
	const instance: MockWorkspacesInstance = {
		workspaces,
		activeWorkspace: 'A',
		saveWorkspace: jest.fn(),
		loadWorkspace: jest.fn().mockResolvedValue(undefined),
		deleteWorkspace: jest.fn(async (id: string) => {
			delete instance.workspaces[id];
		}),
		saveData: jest.fn().mockResolvedValue(undefined),
	};
	const workspacesPlugin = {
		enabled: true,
		instance,
		loadData: jest.fn<Promise<WorkspacesData | null>, []>(),
	};
	const app = {
		workspace: {
			on: jest.fn(),
			getLeavesOfType: jest.fn(() => []),
			getLayout: jest.fn(() => LAYOUT_ON_SCREEN),
		},
		internalPlugins: { plugins: { workspaces: workspacesPlugin } },
		vault: { config: {} },
	};
	const plugin = new ContextWorkspacesPlugin(app as unknown as App, {} as PluginManifest);
	plugin.settings = {
		spaces: {
			A: { name: 'A', icon: '🅰️', autoSave: true },
			B: { name: 'B', icon: '🅱️', autoSave: true },
		},
		spaceOrder: ['A', 'B'],
		currentSpaceId: 'A',
	};
	plugin.loadedWorkspaceId = 'A';
	jest.spyOn(plugin, 'saveSettings').mockResolvedValue(undefined);
	jest.spyOn(plugin, 'updateSidebarSpaces').mockImplementation(() => undefined);
	return { plugin, app, instance, workspacesPlugin };
}

afterEach(() => {
	Platform.isMobile = false;
	jest.restoreAllMocks();
});

describe('workspaces.json changed by another device', () => {
	test('reloads the registry so the next save keeps the other device changes', async () => {
		const { app, instance, workspacesPlugin } = createPlugin({ A: { name: 'A' } });
		setupWorkspaceRegistryMonitoring(app as unknown as App, {
			handleNativeWorkspaceSaved: jest.fn(),
			handleNativeWorkspaceDeleted: jest.fn(),
		});
		workspacesPlugin.loadData.mockResolvedValue({
			workspaces: { A: { name: 'A' }, C: { name: 'C' } },
			active: 'C',
		});

		await instance.onExternalSettingsChange?.();

		expect(Object.keys(instance.workspaces)).toEqual(['A', 'C']);
		expect(instance.activeWorkspace).toBe('C');
	});

	test('keeps the registry in memory when the file cannot be read', async () => {
		const { app, instance, workspacesPlugin } = createPlugin({ A: { name: 'A' } });
		setupWorkspaceRegistryMonitoring(app as unknown as App, {
			handleNativeWorkspaceSaved: jest.fn(),
			handleNativeWorkspaceDeleted: jest.fn(),
		});
		workspacesPlugin.loadData.mockResolvedValue(null);

		await instance.onExternalSettingsChange?.();

		expect(Object.keys(instance.workspaces)).toEqual(['A']);
	});

	test('restores the original registry methods on unload', () => {
		const { app, instance } = createPlugin({ A: { name: 'A' } });
		const { saveWorkspace, deleteWorkspace } = instance;
		setupWorkspaceRegistryMonitoring(app as unknown as App, {
			handleNativeWorkspaceSaved: jest.fn(),
			handleNativeWorkspaceDeleted: jest.fn(),
		});

		removeWorkspaceRegistryMonitoring(app as unknown as App);

		expect(instance.saveWorkspace).toBe(saveWorkspace);
		expect(instance.deleteWorkspace).toBe(deleteWorkspace);
		expect(instance.onExternalSettingsChange).toBeUndefined();
	});
});

describe('spaces follow explicit deletions only', () => {
	test('keeps spaces whose workspaces are missing from the registry', async () => {
		const { plugin } = createPlugin({ A: { name: 'A' } });

		await plugin.syncMissingWorkspacesFromObsidian();

		expect(Object.keys(plugin.settings.spaces)).toEqual(['A', 'B']);
	});

	test('removes the space when the workspace is deleted in Obsidian', async () => {
		const { plugin, app, instance } = createPlugin({ A: { name: 'A' }, B: { name: 'B' } });
		setupWorkspaceRegistryMonitoring(app as unknown as App, plugin);

		await instance.deleteWorkspace('A');

		expect(Object.keys(plugin.settings.spaces)).toEqual(['B']);
		expect(plugin.settings.spaceOrder).toEqual(['B']);
		expect(plugin.settings.currentSpaceId).toBe('B');
		// The deleted layout is still on screen and must not be saved back.
		expect(plugin.loadedWorkspaceId).toBeNull();
	});

	test('keeps the last remaining space', async () => {
		const { plugin, app, instance } = createPlugin({ A: { name: 'A' } });
		plugin.settings.spaces = { A: { name: 'A', icon: '🅰️', autoSave: true } };
		plugin.settings.spaceOrder = ['A'];
		setupWorkspaceRegistryMonitoring(app as unknown as App, plugin);

		await instance.deleteWorkspace('A');

		expect(Object.keys(plugin.settings.spaces)).toEqual(['A']);
	});

	test('imports a workspace saved under a new name in Obsidian', async () => {
		const { plugin, app, instance } = createPlugin({ A: { name: 'A' }, B: { name: 'B' } });
		setupWorkspaceRegistryMonitoring(app as unknown as App, plugin);

		instance.workspaces.C = { name: 'C' };
		instance.saveWorkspace('C');
		await Promise.resolve();

		expect(plugin.settings.spaces.C).toEqual({ name: 'C', icon: '📄', autoSave: false });
	});
});

describe('data.json changed by another device', () => {
	test('applies the other device spaces but keeps the space on this screen', async () => {
		const { plugin } = createPlugin({ A: { name: 'A' }, B: { name: 'B' } });
		jest.spyOn(plugin, 'loadData').mockResolvedValue({
			spaces: {
				A: { name: 'A', icon: '🅰️', autoSave: true },
				B: { name: 'B', icon: '🅱️', autoSave: true },
				C: { name: 'C', icon: '📚', autoSave: true },
			},
			spaceOrder: ['A', 'B', 'C'],
			currentSpaceId: 'B',
		});

		await plugin.onExternalSettingsChange();

		expect(plugin.settings.spaceOrder).toEqual(['A', 'B', 'C']);
		expect(plugin.settings.currentSpaceId).toBe('A');
		expect(plugin.loadedWorkspaceId).toBe('A');
	});

	test('stops saving into a space that another device deleted', async () => {
		const { plugin } = createPlugin({ A: { name: 'A' }, B: { name: 'B' } });
		jest.spyOn(plugin, 'loadData').mockResolvedValue({
			spaces: { B: { name: 'B', icon: '🅱️', autoSave: true } },
			spaceOrder: ['B'],
			currentSpaceId: 'B',
		});

		await plugin.onExternalSettingsChange();

		expect(plugin.settings.currentSpaceId).toBe('B');
		expect(plugin.loadedWorkspaceId).toBeNull();
	});
});

describe('layout writes', () => {
	test('saves a missing layout from the screen instead of failing the switch', async () => {
		const { plugin, instance } = createPlugin({ A: { name: 'A' } });

		await expect(plugin.switchToSpace('B')).resolves.toBe(true);

		expect(instance.workspaces.B).toEqual({ ...LAYOUT_ON_SCREEN, name: 'B' });
		expect(instance.loadWorkspace).not.toHaveBeenCalled();
	});

	test('mobile never writes its layout into shared workspaces (#18)', async () => {
		Platform.isMobile = true;
		const { plugin, instance } = createPlugin({ A: { name: 'A' }, B: { name: 'B' } });

		await plugin.switchToSpace('B');
		plugin.saveCurrentSpaceState();
		await expect(plugin.switchToSpace('A')).resolves.toBe(true);

		expect(instance.loadWorkspace).toHaveBeenCalledWith('B');
		expect(instance.saveWorkspace).not.toHaveBeenCalled();
	});

	test('mobile does not create a layout for a space that has none', async () => {
		Platform.isMobile = true;
		const { plugin, instance } = createPlugin({ A: { name: 'A' } });

		await expect(plugin.switchToSpace('B')).resolves.toBe(false);

		expect(instance.workspaces.B).toBeUndefined();
		expect(instance.saveData).not.toHaveBeenCalled();
		expect(plugin.settings.currentSpaceId).toBe('A');
	});
});
