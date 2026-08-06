import type { App } from 'obsidian';
import {
	detectAndHandleWorkspaceDeletions,
	handleWorkspaceDeletions,
	needsDeletionDetection,
	observeWorkspaceDeletions,
} from '../src/utils/deletion-detection-utils';
import { mockApp } from './mocks/obsidian';

function createSettings(currentSpaceId = 'A') {
	return {
		spaces: {
			A: { name: 'A', icon: 'A', autoSave: true },
			B: { name: 'B', icon: 'B', autoSave: true },
			default: { name: 'Default', icon: 'D', autoSave: false },
		},
		spaceOrder: ['A', 'B', 'default'],
		currentSpaceId,
		workspaceLastSeen: { A: 1, B: 1, default: 1 },
	};
}

describe('Workspace deletion detection', () => {
	beforeEach(() => {
		mockApp.internalPlugins.plugins.workspaces.instance.workspaces = {};
		jest.clearAllMocks();
	});

	test('does not treat an empty registry snapshot as a mass deletion', () => {
		const settings = createSettings();

		const result = observeWorkspaceDeletions(settings, {}, 1000);

		expect(result.deletedWorkspaces).toEqual([]);
		expect(result.settingsChanged).toBe(false);
		expect(Object.keys(settings.spaces)).toEqual(['A', 'B', 'default']);
	});

	test('deletes a previously observed workspace immediately on a trusted snapshot', () => {
		const settings = createSettings();

		const result = observeWorkspaceDeletions(settings, { A: 'A' }, 1000);

		expect(result.deletedWorkspaces).toEqual(['B']);
		expect(result.settingsChanged).toBe(true);
	});

	test('does not delete a space that was never observed in Obsidian', () => {
		const settings = createSettings();
		settings.spaces.C = { name: 'C', icon: 'C', autoSave: true };
		settings.spaceOrder.push('C');

		const result = observeWorkspaceDeletions(settings, { A: 'A' }, 1000);

		// B has history and is deleted; C has no history and stays so that
		// synchronization can create its Obsidian workspace.
		expect(result.deletedWorkspaces).toEqual(['B']);
		expect(settings.spaces.C).toBeDefined();
	});

	test('skips default and marks current workspace deletion for switching', () => {
		const settings = createSettings('B');

		const result = observeWorkspaceDeletions(settings, { A: 'A' }, 1000);

		expect(result.deletedWorkspaces).toEqual(['B']);
		expect(result.currentWorkspaceDeleted).toBe(true);
		expect(result.needsCurrentWorkspaceSwitch).toBe(true);
		expect(result.deletedWorkspaces).not.toContain('default');
	});

	test('unavailable registry reads do not mutate spaces', () => {
		const settings = createSettings();
		const instance = mockApp.internalPlugins.plugins.workspaces.instance;
		const descriptor = Object.getOwnPropertyDescriptor(instance, 'workspaces');

		Object.defineProperty(instance, 'workspaces', {
			configurable: true,
			get: () => {
				throw new Error('Transient registry failure');
			},
		});

		try {
			const result = detectAndHandleWorkspaceDeletions(
				mockApp as unknown as App,
				settings,
			);

			expect(result.registryAvailable).toBe(false);
			expect(result.deletedWorkspaces).toEqual([]);
			expect(Object.keys(settings.spaces)).toEqual(['A', 'B', 'default']);
		} finally {
			if (descriptor) {
				Object.defineProperty(instance, 'workspaces', descriptor);
			}
		}
	});

	test('confirmed deletion removes the space and selects a surviving space', () => {
		const settings = createSettings('B');
		mockApp.internalPlugins.plugins.workspaces.instance.workspaces = {
			A: { name: 'A' },
		};

		const result = handleWorkspaceDeletions(mockApp as unknown as App, settings);

		expect(result.deletedWorkspaces).toEqual(['B']);
		expect(settings.spaces.B).toBeUndefined();
		expect(settings.workspaceLastSeen.B).toBeUndefined();
		expect(settings.spaceOrder).toEqual(['A', 'default']);
		expect(settings.currentSpaceId).toBe('A');
	});

	test('needsDeletionDetection abstains when the registry is empty', () => {
		const settings = createSettings();

		expect(needsDeletionDetection(mockApp as unknown as App, settings)).toBe(false);
	});

	test('needsDeletionDetection detects a missing observed workspace', () => {
		const settings = createSettings();
		mockApp.internalPlugins.plugins.workspaces.instance.workspaces = {
			A: { name: 'A' },
			default: { name: 'Default' },
		};

		expect(needsDeletionDetection(mockApp as unknown as App, settings)).toBe(true);
	});
});
