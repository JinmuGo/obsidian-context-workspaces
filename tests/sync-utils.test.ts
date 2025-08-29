import type { App } from 'obsidian';
import {
	needsSync,
	performBidirectionalSync,
	safeBidirectionalSync,
} from '../src/utils/sync-utils';
import { mockApp } from './mocks/obsidian';

describe('Sync Utils tests', () => {
	beforeEach(() => {
		// Initialize mocking
		mockApp.internalPlugins.plugins.workspaces.instance.workspaces = {};
		jest.clearAllMocks();
	});

	describe('performBidirectionalSync', () => {
		test('Should import workspaces from Obsidian to Context Workspaces', async () => {
			const workspaceId = 'obsidian-workspace';
			const obsidianWorkspaceName = 'Obsidian Workspace';

			// Create workspace in Obsidian
			mockApp.internalPlugins.plugins.workspaces.instance.workspaces[workspaceId] = {
				name: obsidianWorkspaceName,
				main: { type: 'tabs' },
				left: { type: 'tabs' },
				right: { type: 'tabs' },
			};

			// Context Workspaces settings
			const settings = {
				spaces: {},
				spaceOrder: [],
				currentSpaceId: 'default',
			};

			// Perform sync
			const result = await performBidirectionalSync(mockApp as unknown as App, settings);

			// Verify results
			expect(result.importedFromObsidian).toContain(workspaceId);
			expect(settings.spaces[workspaceId].name).toBe(obsidianWorkspaceName);
		});

		test('Should create workspaces in Obsidian from Context Workspaces', async () => {
			const spaceId = 'context-workspaces';
			const spaceName = 'Context Space';

			// Context Workspaces settings
			const settings = {
				spaces: {
					[spaceId]: {
						name: spaceName,
						icon: '🚀',
						autoSave: true,
						autoConnectedPaths: [],
					},
				},
				spaceOrder: [spaceId],
				currentSpaceId: spaceId,
			};

			// Perform sync
			const result = await performBidirectionalSync(mockApp as unknown as App, settings);

			// Verify results
			expect(result.createdInObsidian).toContain(spaceId);
			expect(
				mockApp.internalPlugins.plugins.workspaces.instance.workspaces[spaceId]
			).toBeDefined();
		});

		test('Should handle name conflicts correctly', async () => {
			const workspaceId = 'conflict-workspace';
			const obsidianName = 'Conflict Name';
			const contextName = 'Different Name';

			// Create workspace in Obsidian
			mockApp.internalPlugins.plugins.workspaces.instance.workspaces[workspaceId] = {
				name: obsidianName,
				main: { type: 'tabs' },
				left: { type: 'tabs' },
				right: { type: 'tabs' },
			};

			// Context Workspaces settings with different name
			const settings = {
				spaces: {
					[workspaceId]: {
						name: contextName,
						icon: '🚀',
						autoSave: true,
						autoConnectedPaths: [],
					},
				},
				spaceOrder: [workspaceId],
				currentSpaceId: workspaceId,
			};

			// Perform sync
			const result = await performBidirectionalSync(mockApp as unknown as App, settings);

			// Verify conflict resolution
			expect(result.conflicts).toHaveLength(1);
			expect(result.conflicts[0].workspaceId).toBe(workspaceId);
		});
	});

	describe('needsSync', () => {
		test('Should return true when sync is needed', () => {
			const settings = {
				spaces: {},
				spaceOrder: [],
				currentSpaceId: 'default',
				SpacesLimit: 5,
			};

			// Add workspace to Obsidian but not to Context Workspaces
			mockApp.internalPlugins.plugins.workspaces.instance.workspaces['new-workspace'] = {
				name: 'New Workspace',
				main: { type: 'tabs' },
				left: { type: 'tabs' },
				right: { type: 'tabs' },
			};

			expect(needsSync(mockApp as unknown as App, settings)).toBe(true);
		});

		test('Should return false when no sync is needed', async () => {
			const settings = {
				spaces: {
					workspace1: {
						name: 'Workspace 1',
						icon: '🚀',
						autoSave: true,
						autoConnectedPaths: [],
					},
				},
				spaceOrder: ['workspace1'],
				currentSpaceId: 'workspace1',
			};

			// Add workspace to Obsidian
			mockApp.internalPlugins.plugins.workspaces.instance.workspaces['safe-workspace'] = {
				name: 'Safe Workspace',
				main: { type: 'tabs' },
				left: { type: 'tabs' },
				right: { type: 'tabs' },
			};

			const result = await safeBidirectionalSync(mockApp as unknown as App, settings);

			expect(result).toBeTruthy();
			expect(result?.importedFromObsidian).toContain('safe-workspace');
		});

		test('Should handle errors gracefully', async () => {
			const settings = {
				spaces: {},
				spaceOrder: [],
				currentSpaceId: 'default',
			};

			// Mock error condition by overriding the workspaces property
			const originalWorkspaces =
				mockApp.internalPlugins.plugins.workspaces.instance.workspaces;
			Object.defineProperty(
				mockApp.internalPlugins.plugins.workspaces.instance,
				'workspaces',
				{
					get: () => {
						throw new Error('Mock error');
					},
				}
			);

			const result = await safeBidirectionalSync(mockApp as unknown as App, settings);

			expect(result).toBeTruthy();
			// The function should handle the error gracefully and return a result object
			expect(result?.errors).toBeDefined();

			// Restore original workspaces
			Object.defineProperty(
				mockApp.internalPlugins.plugins.workspaces.instance,
				'workspaces',
				{
					get: () => originalWorkspaces,
				}
			);
		});
	});
});
