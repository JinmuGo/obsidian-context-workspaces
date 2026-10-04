import type { App } from 'obsidian';
import type { ContextWorkspacesSettings } from '../src/types';
import { importObsidianWorkspaces } from '../src/utils/sync-utils';
import { mockApp } from './mocks/obsidian';

const registry = mockApp.internalPlugins.plugins.workspaces.instance;

describe('importObsidianWorkspaces', () => {
	beforeEach(() => {
		registry.workspaces = {};
		jest.clearAllMocks();
	});

	test('imports workspaces that have no space as snapshot spaces', () => {
		registry.workspaces = { existing: { name: 'Existing' }, native: { name: 'Native' } };
		const settings: ContextWorkspacesSettings = {
			spaces: { existing: { name: 'Existing', icon: '🚀', autoSave: true } },
			spaceOrder: ['existing'],
			currentSpaceId: 'existing',
		};

		const imported = importObsidianWorkspaces(mockApp as unknown as App, settings);

		expect(imported).toEqual(['native']);
		expect(settings.spaces.native).toEqual({ name: 'Native', icon: '📄', autoSave: false });
		expect(settings.spaceOrder).toEqual(['existing', 'native']);
	});

	test('leaves a space alone when its workspace has not arrived yet (#18, #22)', () => {
		registry.workspaces = { existing: { name: 'Existing' } };
		const settings: ContextWorkspacesSettings = {
			spaces: {
				existing: { name: 'Existing', icon: '🚀', autoSave: true },
				'from-other-device': { name: 'From other device', icon: '📚', autoSave: true },
			},
			spaceOrder: ['existing', 'from-other-device'],
			currentSpaceId: 'existing',
		};

		importObsidianWorkspaces(mockApp as unknown as App, settings);

		expect(settings.spaces['from-other-device']).toBeDefined();
		expect(registry.workspaces['from-other-device']).toBeUndefined();
		expect(registry.saveData).not.toHaveBeenCalled();
	});

	test('keeps the space name when the registry still has an older name', () => {
		registry.workspaces = { renamed: { name: 'Old name' } };
		const settings: ContextWorkspacesSettings = {
			spaces: { renamed: { name: 'New name', icon: '🚀', autoSave: true } },
			spaceOrder: ['renamed'],
			currentSpaceId: 'renamed',
		};

		importObsidianWorkspaces(mockApp as unknown as App, settings);

		expect(settings.spaces.renamed.name).toBe('New name');
	});
});
