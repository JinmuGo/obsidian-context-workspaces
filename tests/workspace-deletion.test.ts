import type { App, PluginManifest } from 'obsidian';
import ContextWorkspacesPlugin from '../src/main';

interface MockWorkspacesInstance {
	workspaces: Record<string, { name?: string }>;
	saveWorkspace: jest.Mock;
	loadWorkspace: jest.Mock;
	saveData: jest.Mock;
}

interface MockAppShape {
	workspace: {
		on: jest.Mock;
		getLeavesOfType: jest.Mock;
	};
	internalPlugins: {
		plugins: {
			workspaces: {
				enabled: boolean;
				instance: MockWorkspacesInstance;
			};
		};
	};
	vault: { config: Record<string, unknown> };
}

function createPlugin(workspaces: MockWorkspacesInstance['workspaces']) {
	const instance: MockWorkspacesInstance = {
		workspaces,
		saveWorkspace: jest.fn(),
		loadWorkspace: jest.fn().mockResolvedValue(undefined),
		saveData: jest.fn().mockResolvedValue(undefined),
	};
	const appShape: MockAppShape = {
		workspace: {
			on: jest.fn(),
			getLeavesOfType: jest.fn(() => []),
		},
		internalPlugins: {
			plugins: {
				workspaces: { enabled: true, instance },
			},
		},
		vault: { config: {} },
	};
	const plugin = new ContextWorkspacesPlugin(
		appShape as unknown as App,
		{} as PluginManifest,
	);
	plugin.settings = {
		spaces: {
			default: { name: 'Default', icon: '🏠', autoSave: true },
			A: { name: 'A', icon: '🅰️', autoSave: true },
			B: { name: 'B', icon: '🅱️', autoSave: true },
		},
		spaceOrder: ['default', 'A', 'B'],
		currentSpaceId: 'A',
	};
	jest.spyOn(plugin, 'saveSettings').mockResolvedValue(undefined);
	jest.spyOn(plugin, 'updateSidebarSpaces').mockImplementation(() => undefined);
	return { plugin, appShape, instance };
}

async function flushMicrotasks(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
}

describe('workspace deletion safety (issue #17)', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
	});

	afterEach(() => {
		jest.restoreAllMocks();
		jest.useRealTimers();
	});

	test('does not remove spaces when the registry is unavailable', () => {
		const { plugin, appShape } = createPlugin({ A: { name: 'A' }, B: { name: 'B' } });
		appShape.internalPlugins.plugins.workspaces.enabled = false;

		plugin.handleWorkspaceChange();
		jest.advanceTimersByTime(30_000);
		plugin.handleWorkspaceChange();

		expect(Object.keys(plugin.settings.spaces)).toEqual(['default', 'A', 'B']);
		expect(plugin.saveSettings).not.toHaveBeenCalled();
	});

	test('does not remove spaces when the registry is temporarily empty', () => {
		const { plugin } = createPlugin({});

		plugin.handleWorkspaceChange();
		jest.advanceTimersByTime(30_000);
		plugin.handleWorkspaceChange();

		expect(Object.keys(plugin.settings.spaces)).toEqual(['default', 'A', 'B']);
		expect(plugin.saveSettings).not.toHaveBeenCalled();
	});

	test('requires two missing observations separated by the grace period', async () => {
		const { plugin } = createPlugin({ A: { name: 'A' } });

		plugin.handleWorkspaceChange();
		expect(plugin.settings.spaces.B).toBeDefined();

		jest.advanceTimersByTime(5001);
		plugin.handleWorkspaceChange();
		await flushMicrotasks();

		expect(plugin.settings.spaces.B).toBeUndefined();
		expect(plugin.settings.spaceOrder).toEqual(['default', 'A']);
		expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
	});

	test('resets a deletion candidate when the workspace reappears', () => {
		const { plugin, instance } = createPlugin({ A: { name: 'A' } });

		plugin.handleWorkspaceChange();
		instance.workspaces.B = { name: 'B' };
		jest.advanceTimersByTime(5001);
		plugin.handleWorkspaceChange();
		delete instance.workspaces.B;
		jest.advanceTimersByTime(5001);
		plugin.handleWorkspaceChange();

		expect(plugin.settings.spaces.B).toBeDefined();
		expect(plugin.saveSettings).not.toHaveBeenCalled();
	});

	test('never automatically removes the current or default space', () => {
		const { plugin } = createPlugin({ B: { name: 'B' } });

		plugin.handleWorkspaceChange();
		jest.advanceTimersByTime(5001);
		plugin.handleWorkspaceChange();

		expect(plugin.settings.spaces.default).toBeDefined();
		expect(plugin.settings.spaces.A).toBeDefined();
		expect(plugin.settings.currentSpaceId).toBe('A');
	});

	test('does not collect deletion evidence while a space switch is in flight', () => {
		const { plugin } = createPlugin({ A: { name: 'A' } });
		plugin.switchingToSpaceId = 'B';

		plugin.handleWorkspaceChange();
		plugin.switchingToSpaceId = null;
		jest.advanceTimersByTime(5001);
		plugin.handleWorkspaceChange();

		expect(plugin.settings.spaces.B).toBeDefined();
	});
});
