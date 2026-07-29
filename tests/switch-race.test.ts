/**
 * Regression tests for issue #15: workspace compositions duplicating/overwriting
 * when switching spaces rapidly (Ctrl+Alt+D) or double-clicking the sidebar.
 *
 * Root cause: the debounced auto-save timer scheduled under one space could
 * fire after a switch, writing the outgoing layout into the new workspace's id.
 */

import type { App, PluginManifest } from 'obsidian';
import ContextWorkspacesPlugin from '../src/main';
import { setupWorkspaceLoadMonitoring } from '../src/utils/obsidian-utils';

interface MockWorkspacesInstance {
	workspaces: Record<string, { name?: string } & Record<string, unknown>>;
	saveWorkspace: jest.Mock<(id: string) => void>;
	loadWorkspace: jest.Mock<(id: string) => Promise<void>>;
	saveData: jest.Mock<() => Promise<void>>;
	_originalLoadWorkspace?: (id: string) => Promise<void>;
}

interface MockAppShape {
	workspace: {
		on: jest.Mock;
		getLeavesOfType: jest.Mock;
		trigger: jest.Mock;
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

function createMockApp(): { app: App; instance: MockWorkspacesInstance } {
	const instance: MockWorkspacesInstance = {
		workspaces: {
			A: { name: 'A' },
			B: { name: 'B' },
			C: { name: 'C' },
		},
		saveWorkspace: jest.fn<(id: string) => void>(),
		loadWorkspace: jest.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined),
		saveData: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
	};

	const mockApp: MockAppShape = {
		workspace: {
			on: jest.fn(),
			getLeavesOfType: jest.fn(() => []),
			trigger: jest.fn(),
		},
		internalPlugins: {
			plugins: {
				workspaces: {
					enabled: true,
					instance,
				},
			},
		},
		vault: { config: {} },
	};

	return { app: mockApp as unknown as App, instance };
}

function createPlugin(app: App): ContextWorkspacesPlugin {
	const plugin = new ContextWorkspacesPlugin(app, {} as unknown as PluginManifest);
	plugin.settings = {
		spaces: {
			A: { name: 'A', icon: '🏠', autoSave: true },
			B: { name: 'B', icon: '📄', autoSave: true },
			C: { name: 'C', icon: '📄', autoSave: true },
		},
		spaceOrder: ['A', 'B', 'C'],
		currentSpaceId: 'A',
	};
	return plugin;
}

async function flushMicrotasks(rounds = 25): Promise<void> {
	for (let i = 0; i < rounds; i++) {
		await Promise.resolve();
	}
}

describe('Space switching race conditions (issue #15)', () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	test('stale debounced auto-save never fires into the new space after a switch', async () => {
		const { app, instance } = createMockApp();
		const plugin = createPlugin(app);

		// A layout change schedules an auto-save for space A in 500ms
		plugin.handleLayoutChange();

		// Switching to B must cancel that pending save
		await plugin.switchToSpace('B');

		jest.advanceTimersByTime(2000);
		await flushMicrotasks();

		// Only the intentional save of the outgoing space A may have happened
		expect(instance.saveWorkspace).toHaveBeenCalledTimes(1);
		expect(instance.saveWorkspace).toHaveBeenCalledWith('A');
		expect(instance.saveWorkspace).not.toHaveBeenCalledWith('B');
		expect(plugin.settings.currentSpaceId).toBe('B');
	});

	test('debounced save re-validates the space id at fire time', () => {
		const { app, instance } = createMockApp();
		const plugin = createPlugin(app);

		plugin.handleLayoutChange(); // scheduled under A

		// Simulate currentSpaceId changing without switchToSpace (defense-in-depth)
		plugin.settings.currentSpaceId = 'B';

		jest.advanceTimersByTime(600);
		expect(instance.saveWorkspace).not.toHaveBeenCalled();
	});

	test('debounced save does not fire while a switch is in flight', () => {
		const { app, instance } = createMockApp();
		const plugin = createPlugin(app);

		plugin.handleLayoutChange(); // scheduled under A

		// Simulate an in-flight switch
		plugin.switchingToSpaceId = 'B';

		jest.advanceTimersByTime(600);
		expect(instance.saveWorkspace).not.toHaveBeenCalled();
	});

	test('rapid consecutive switches are queued (last-wins), each saving the correct space', async () => {
		const { app, instance } = createMockApp();
		const plugin = createPlugin(app);

		// Make the first load controllable so the second switch arrives mid-flight
		let resolveLoad: (() => void) | undefined;
		instance.loadWorkspace.mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					resolveLoad = resolve;
				}),
		);

		const first = plugin.switchToSpace('B');

		// Wait until the first switch is awaiting loadWorkspace('B')
		for (let i = 0; i < 25 && !resolveLoad; i++) {
			await Promise.resolve();
		}
		expect(resolveLoad).toBeDefined();

		// Second switch arrives while the first is in flight → queued
		void plugin.switchToSpace('C');

		resolveLoad?.();
		await first;
		await flushMicrotasks();

		expect(plugin.settings.currentSpaceId).toBe('C');
		// Outgoing saves happened in order: A's layout into A, then B's into B
		expect(instance.saveWorkspace.mock.calls.map((call) => call[0])).toEqual(['A', 'B']);
		expect(instance.loadWorkspace).toHaveBeenCalledWith('B');
		expect(instance.loadWorkspace).toHaveBeenCalledWith('C');
	});

	test('switchToNextSpace computes from the queued target while switching', async () => {
		const { app, instance } = createMockApp();
		const plugin = createPlugin(app);

		let resolveLoad: (() => void) | undefined;
		instance.loadWorkspace.mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					resolveLoad = resolve;
				}),
		);

		const first = plugin.switchToSpace('B');
		for (let i = 0; i < 25 && !resolveLoad; i++) {
			await Promise.resolve();
		}

		// Pressing "next" mid-switch should queue C (computed from in-flight target B)
		plugin.switchToNextSpace();
		expect(
			(plugin as unknown as { pendingSpaceRequest: { spaceId: string } | null })
				.pendingSpaceRequest?.spaceId,
		).toBe('C');

		resolveLoad?.();
		await first;
		await flushMicrotasks();

		expect(plugin.settings.currentSpaceId).toBe('C');
	});

	test('native workspace load saves the outgoing space before loading and skips re-save', async () => {
		const { app, instance } = createMockApp();
		const plugin = createPlugin(app);

		const originalLoadMock = instance.loadWorkspace;
		setupWorkspaceLoadMonitoring(app, plugin);

		// Simulate Obsidian's native switcher loading workspace B
		await instance.loadWorkspace('B');

		// The outgoing space A was saved BEFORE the original load ran
		expect(instance.saveWorkspace).toHaveBeenCalledTimes(1);
		expect(instance.saveWorkspace).toHaveBeenCalledWith('A');
		expect(instance.saveWorkspace.mock.invocationCallOrder[0]).toBeLessThan(
			originalLoadMock.mock.invocationCallOrder[0],
		);

		// The monitoring hook triggers the follow-up switch after 100ms
		jest.advanceTimersByTime(150);
		await flushMicrotasks();

		expect(plugin.settings.currentSpaceId).toBe('B');
		// skipSave: the already-loaded layout must not be re-saved into any workspace
		expect(instance.saveWorkspace).toHaveBeenCalledTimes(1);
	});

	test('queued native-switcher follow-up keeps skipSave (no save into wrong workspace)', async () => {
		const { app, instance } = createMockApp();
		const plugin = createPlugin(app);

		// The first (plugin-initiated) load hangs so the follow-up arrives mid-flight
		let resolveLoad: (() => void) | undefined;
		instance.loadWorkspace.mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					resolveLoad = resolve;
				}),
		);
		setupWorkspaceLoadMonitoring(app, plugin);

		const first = plugin.switchToSpace('B');
		for (let i = 0; i < 25 && !resolveLoad; i++) {
			await Promise.resolve();
		}
		expect(resolveLoad).toBeDefined();

		// Native-switcher follow-up arrives while B's switch is in flight → queued.
		// skipSave=true must survive the queue: the screen no longer shows B's
		// layout, so saving here would write a foreign layout into B's workspace.
		void plugin.switchToSpace('C', 'native', true);

		resolveLoad?.();
		await first;
		await flushMicrotasks();

		expect(plugin.settings.currentSpaceId).toBe('C');
		// Only the intentional outgoing save of A may have happened. In particular
		// B must never be saved — its layout was never fully on screen.
		expect(instance.saveWorkspace.mock.calls.map((call) => call[0])).toEqual(['A']);
	});
});
