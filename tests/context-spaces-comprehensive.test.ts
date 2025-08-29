import type { SpaceConfig } from '../src/types';
import {
	generateSpaceId,
	parseSpaceData,
	searchSpaces,
	validateSpaceConfig,
} from '../src/utils/space-utils';

describe('Obsidian Context Workspaces Plugin - Comprehensive Tests', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('1. Space Management Features', () => {
		describe('generateSpaceId', () => {
			test('Generate space ID with various names', () => {
				const existingSpaces = {};

				const testCases = [
					'Project Alpha',
					'Research Notes',
					'Development Space',
					'📚 Learning Space',
					'🎯 Goal Management',
					'Mixed Language',
					'Special Characters!@#$%^&*()',
					'Name with Spaces',
					'Very Long Name Test',
				];

				testCases.forEach((name) => {
					const spaceId = generateSpaceId(name, existingSpaces);

					expect(spaceId).toBeTruthy();
					expect(typeof spaceId).toBe('string');
					expect(spaceId.length).toBeGreaterThan(0);

					// ID should only contain letters, numbers, and hyphens
					expect(spaceId).toMatch(/^[a-z0-9-]+$/);

					// Special characters should be converted to hyphens
					expect(spaceId).not.toMatch(/[!@#$%^&*()]/);
				});
			});

			test('Generate unique ID for duplicate names', () => {
				const existingSpaces = {
					'project-alpha': {
						name: 'Project Alpha',
						icon: '🚀',
						autoSave: true,
					},
					'project-alpha-1': {
						name: 'Project Alpha',
						icon: '📄',
						autoSave: false,
					},
				};

				const spaceId = generateSpaceId('Project Alpha', existingSpaces);

				expect(spaceId).toBeTruthy();
				expect(existingSpaces[spaceId]).toBeUndefined();
			});

			test('Generate default ID for empty name', () => {
				const existingSpaces = {};
				const spaceId = generateSpaceId('', existingSpaces);

				expect(spaceId).toBeTruthy();
				expect(spaceId).toMatch(/^[a-z0-9-]+$/);
			});
		});

		describe('parseSpaceData', () => {
			test('Parse valid space data', () => {
				const validData = JSON.stringify({
					name: 'Test Space',
					icon: '🚀',
					description: 'Test description',
					theme: 'dark',
					themeMode: 'dark',
				});

				const result = parseSpaceData(validData);

				expect(result.name).toBe('Test Space');
				expect(result.icon).toBe('🚀');
				expect(result.description).toBe('Test description');
				expect(result.theme).toBe('dark');
				expect(result.themeMode).toBe('dark');
			});

			test('Parse legacy string format', () => {
				const legacyData = 'Legacy Space Name';
				const result = parseSpaceData(legacyData);

				expect(result.name).toBe('Legacy Space Name');
				expect(result.icon).toBe('✨');
				expect(result.description).toBeUndefined();
			});

			test('Handle empty theme in data', () => {
				const dataWithEmptyTheme = JSON.stringify({
					name: 'Test Space',
					icon: '🚀',
					theme: '',
					themeMode: 'system',
				});

				const result = parseSpaceData(dataWithEmptyTheme);

				expect(result.theme).toBeUndefined();
				expect(result.themeMode).toBe('system');
			});
		});

		describe('searchSpaces', () => {
			test('Search spaces by name', () => {
				const spaces = {
					'space1': { name: 'Project Alpha', icon: '🚀', autoSave: true },
					'space2': { name: 'Research Notes', icon: '📚', autoSave: false },
					'space3': { name: 'Development', icon: '💻', autoSave: true },
				};

				const results = searchSpaces(spaces, 'Project');
				expect(results).toContain('space1');
				expect(results).toHaveLength(1);
			});

			test('Search spaces by description', () => {
				const spaces = {
					'space1': { 
						name: 'Project Alpha', 
						icon: '🚀', 
						autoSave: true,
						description: 'Main project workspace'
					},
					'space2': { 
						name: 'Research Notes', 
						icon: '📚', 
						autoSave: false,
						description: 'Research and notes'
					},
				};

				const results = searchSpaces(spaces, 'research');
				expect(results).toContain('space2');
				expect(results).toHaveLength(1);
			});

			test('Search non-existent spaces', () => {
				const spaces = {
					'space1': { name: 'Project Alpha', icon: '🚀', autoSave: true },
				};

				const results = searchSpaces(spaces, 'NonExistent');
				expect(results).toHaveLength(0);
			});

			test('Case insensitive search', () => {
				const spaces = {
					'space1': { name: 'Project Alpha', icon: '🚀', autoSave: true },
				};

				const results = searchSpaces(spaces, 'PROJECT');
				expect(results).toContain('space1');
			});
		});

		describe('validateSpaceConfig', () => {
			test('Validate complete space configuration', () => {
				const validConfig: SpaceConfig = {
					name: 'Test Space',
					icon: '🚀',
					autoSave: true,
					description: 'Test description',
					theme: 'dark',
					themeMode: 'dark',
					createdAt: Date.now(),
				};

				expect(validateSpaceConfig(validConfig)).toBe(true);
			});

			test('Validate minimal space configuration', () => {
				const minimalConfig: SpaceConfig = {
					name: 'Test Space',
					icon: '🚀',
					autoSave: false,
				};

				expect(validateSpaceConfig(minimalConfig)).toBe(true);
			});

			test('Reject invalid space configuration', () => {
				const invalidConfigs = [
					null,
					undefined,
					{},
					{ name: '', icon: '🚀', autoSave: true },
					{ name: 'Test', icon: '', autoSave: true },
					{ name: 'Test', icon: '🚀' }, // missing autoSave
					{ name: 'Test', autoSave: true }, // missing icon
					{ icon: '🚀', autoSave: true }, // missing name
				];

				invalidConfigs.forEach((config) => {
					expect(validateSpaceConfig(config)).toBe(false);
				});
			});
		});
	});

	describe('2. Space Configuration Validation', () => {
		describe('Space configuration structure', () => {
			test('Complete space configuration', () => {
				const spaceConfig: SpaceConfig = {
					name: 'Complete Space',
					icon: '🎯',
					autoSave: true,
					description: 'A complete space configuration',
					theme: 'obsidian',
					themeMode: 'system',
					createdAt: Date.now(),
				};

				expect(spaceConfig.name).toBe('Complete Space');
				expect(spaceConfig.icon).toBe('🎯');
				expect(spaceConfig.autoSave).toBe(true);
				expect(spaceConfig.description).toBe('A complete space configuration');
				expect(spaceConfig.theme).toBe('obsidian');
				expect(spaceConfig.themeMode).toBe('system');
				expect(typeof spaceConfig.createdAt).toBe('number');
			});

			test('Minimal space configuration', () => {
				const spaceConfig: SpaceConfig = {
					name: 'Minimal Space',
					icon: '📄',
					autoSave: false,
				};

				expect(spaceConfig.name).toBe('Minimal Space');
				expect(spaceConfig.icon).toBe('📄');
				expect(spaceConfig.autoSave).toBe(false);
				expect(spaceConfig.description).toBeUndefined();
				expect(spaceConfig.theme).toBeUndefined();
				expect(spaceConfig.themeMode).toBeUndefined();
				expect(spaceConfig.createdAt).toBeUndefined();
			});

			test('Handle very long space names', () => {
				const longName = 'A'.repeat(200);
				const spaceConfig: SpaceConfig = {
					name: longName,
					icon: '📄',
					autoSave: false,
				};

				expect(spaceConfig.name).toBe(longName);
				expect(spaceConfig.name.length).toBe(200);
			});

			test('Handle special characters in names', () => {
				const specialName = 'Space with 🚀 emoji and special chars!@#$%';
				const spaceConfig: SpaceConfig = {
					name: specialName,
					icon: '📄',
					autoSave: false,
				};

				expect(spaceConfig.name).toBe(specialName);
			});
		});
	});

	describe('3. Search Functionality', () => {
		test('Empty query returns all spaces', () => {
			const spaces = {
				'space1': { name: 'Project Alpha', icon: '🚀', autoSave: true },
				'space2': { name: 'Research Notes', icon: '📚', autoSave: false },
			};

			const results = searchSpaces(spaces, '');
			expect(results).toContain('space1');
			expect(results).toContain('space2');
			expect(results).toHaveLength(2);
		});

		test('Search performance with large number of spaces', () => {
			const spaces: Record<string, SpaceConfig> = {};
			
			// Create 1000 spaces
			for (let i = 0; i < 1000; i++) {
				spaces[`space${i}`] = {
					name: `Space ${i}`,
					icon: '📄',
					autoSave: i % 2 === 0,
				};
			}

			const startTime = performance.now();
			const results = searchSpaces(spaces, 'Space 500');
			const endTime = performance.now();

			expect(results).toContain('space500');
			expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
		});

		test('ID generation performance with large number of spaces', () => {
			const spaces: Record<string, SpaceConfig> = {};
			
			// Create 1000 spaces
			for (let i = 0; i < 1000; i++) {
				spaces[`space${i}`] = {
					name: `Space ${i}`,
					icon: '📄',
					autoSave: i % 2 === 0,
				};
			}

			const startTime = performance.now();
			const newId = generateSpaceId('New Space', spaces);
			const endTime = performance.now();

			expect(newId).toBeTruthy();
			expect(spaces[newId]).toBeUndefined();
			expect(endTime - startTime).toBeLessThan(50); // Should complete within 50ms
		});

		test('Bulk space access statistics update', () => {
			const spaces: Record<string, SpaceConfig> = {};
			
			// Create 1000 spaces
			for (let i = 0; i < 1000; i++) {
				spaces[`space${i}`] = {
					name: `Space ${i}`,
					icon: '📄',
					autoSave: i % 2 === 0,
				};
			}

			const startTime = performance.now();
			
			// Update access statistics for all spaces
			Object.keys(spaces).forEach((spaceId) => {
				// Simulate access statistics update
				spaces[spaceId].createdAt = Date.now();
			});
			
			const endTime = performance.now();

			// Verify all spaces have updated access statistics
			Object.values(spaces).forEach((space) => {
				expect(space.createdAt).toBeGreaterThan(0);
			});

			expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
		});
	});

	describe('4. Integration Tests', () => {
		test('Complete space lifecycle', () => {
			const existingSpaces: Record<string, SpaceConfig> = {};

			// 1. Generate space ID
			const spaceId = generateSpaceId('Test Space', existingSpaces);
			expect(spaceId).toBeTruthy();

			// 2. Create space configuration
			const spaceConfig: SpaceConfig = {
				name: 'Test Space',
				icon: '🚀',
				autoSave: true,
				description: 'Test description',
				theme: 'dark',
				themeMode: 'dark',
				createdAt: Date.now(),
			};

			// 3. Validate space configuration
			expect(validateSpaceConfig(spaceConfig)).toBe(true);

			// 4. Add space to collection
			existingSpaces[spaceId] = spaceConfig;

			// 5. Search for space
			const searchResults = searchSpaces(existingSpaces, 'Test');
			expect(searchResults).toContain(spaceId);

			// 6. Access statistics update (removed)
			// This functionality was removed from the codebase

			// 7. Parse space data test
			const spaceData = JSON.stringify({
				name: spaceConfig.name,
				icon: spaceConfig.icon,
				description: spaceConfig.description,
				theme: spaceConfig.theme,
				themeMode: spaceConfig.themeMode,
			});

			const parsedData = parseSpaceData(spaceData);
			expect(parsedData.name).toBe(spaceConfig.name);
			expect(parsedData.icon).toBe(spaceConfig.icon);
		});

		test('Multiple space management', () => {
			const spaces: Record<string, SpaceConfig> = {};

			// Create multiple spaces
			const spaceNames = ['Project Alpha', 'Research Notes', 'Development', 'Personal'];
			const spaceIcons = ['🚀', '📚', '💻', '👤'];

			spaceNames.forEach((name, index) => {
				const spaceId = generateSpaceId(name, spaces);
				spaces[spaceId] = {
					name,
					icon: spaceIcons[index],
					autoSave: index % 2 === 0,
					description: `Description for ${name}`,
					createdAt: Date.now(),
				};
			});

			// Verify all spaces were created correctly
			expect(Object.keys(spaces)).toHaveLength(4);

			// Test space search
			const projectResults = searchSpaces(spaces, 'Project');
			expect(projectResults.length).toBeGreaterThan(0);

			// Update access statistics for all spaces
			Object.keys(spaces).forEach((spaceId) => {
				spaces[spaceId].createdAt = Date.now();
			});

			// Verify all spaces have updated access statistics
			Object.values(spaces).forEach((space) => {
				expect(space.createdAt).toBeGreaterThan(0);
			});

			// Test adding new space
			const newSpaceId = generateSpaceId('New Space', spaces);
			spaces[newSpaceId] = {
				name: 'New Space',
				icon: '🆕',
				autoSave: true,
				createdAt: Date.now(),
			};

			expect(Object.keys(spaces)).toHaveLength(5);
			expect(spaces[newSpaceId]).toBeDefined();
		});

		test('Space switching simulation', () => {
			const spaces: Record<string, SpaceConfig> = {};

			// Create test spaces
			const spaceIds: string[] = [];
			for (let i = 0; i < 5; i++) {
				const spaceId = generateSpaceId(`Space ${i}`, spaces);
				spaces[spaceId] = {
					name: `Space ${i}`,
					icon: '📄',
					autoSave: i % 2 === 0,
					createdAt: Date.now(),
				};
				spaceIds.push(spaceId);
			}

			// Simulate space switching
			let currentSpaceIndex = 0;
			const switchToNextSpace = () => {
				currentSpaceIndex = (currentSpaceIndex + 1) % spaceIds.length;
				return spaceIds[currentSpaceIndex];
			};

			// Test switching through all spaces
			for (let i = 0; i < 10; i++) {
				const nextSpaceId = switchToNextSpace();
				expect(spaces[nextSpaceId]).toBeDefined();
				expect(spaces[nextSpaceId].name).toBe(`Space ${currentSpaceIndex}`);
			}
		});
	});
});
