import {
	generateSpaceId,
	parseSpaceData,
	searchSpaces,
	validateSpaceConfig,
} from '../src/utils/space-utils';

describe('Space Utils tests', () => {
	describe('generateSpaceId', () => {
		test('Should generate unique IDs', () => {
			const spaces = {};
			const id1 = generateSpaceId('Test Space', spaces);
			spaces[id1] = { name: 'Test Space', icon: '🚀', autoSave: true };
			const id2 = generateSpaceId('Test Space', spaces);
			expect(id1).not.toBe(id2);
		});

		test('Should handle empty names', () => {
			const spaces = {};
			const id1 = generateSpaceId('', spaces);
			spaces[id1] = { name: '', icon: '🚀', autoSave: true };
			const id2 = generateSpaceId('', spaces);
			expect(id1).toBe('space');
			expect(id2).toBe('space-1');
		});
	});

	describe('parseSpaceData', () => {
		test('Should parse JSON format', () => {
			const input = JSON.stringify({
				name: 'Test Space',
				icon: '🚀',
				description: 'Test description',
				theme: 'Minimal',
				themeMode: 'dark',
			});

			const result = parseSpaceData(input);

			expect(result.name).toBe('Test Space');
			expect(result.icon).toBe('🚀');
			expect(result.description).toBe('Test description');
			expect(result.theme).toBe('Minimal');
			expect(result.themeMode).toBe('dark');
		});

		test('Should handle legacy string format', () => {
			const result = parseSpaceData('Test Space');
			expect(result.name).toBe('Test Space');
			expect(result.icon).toBe('✨');
		});

		test('Should handle empty theme', () => {
			const input = JSON.stringify({
				name: 'Test Space',
				icon: '🚀',
				theme: '',
			});

			const result = parseSpaceData(input);
			expect(result.theme).toBeUndefined();
		});
	});

	describe('searchSpaces', () => {
		test('Should find spaces by name', () => {
			const spaces = {
				space1: { name: 'Space 1', icon: '🚀', autoSave: true },
				space2: { name: 'Space 2', icon: '🚀', autoSave: true },
			};

			const results = searchSpaces(spaces, 'Space 1');
			expect(results).toEqual(['space1']);
		});

		test('Should find spaces by description', () => {
			const spaces = {
				space1: { name: 'Space 1', icon: '🚀', autoSave: true, description: 'Test description' },
				space2: { name: 'Space 2', icon: '🚀', autoSave: true },
			};

			const results = searchSpaces(spaces, 'Test description');
			expect(results).toEqual(['space1']);
		});

		test('Should return empty array for no matches', () => {
			const spaces = {
				space1: { name: 'Space 1', icon: '🚀', autoSave: true },
			};

			const results = searchSpaces(spaces, 'nonexistent');
			expect(results).toEqual([]);
		});
	});

	describe('validateSpaceConfig', () => {
		test('Should validate correct config', () => {
			const space = {
				name: 'Test Space',
				icon: '🚀',
				autoSave: true,
			};

			expect(validateSpaceConfig(space)).toBe(true);
		});

		test('Should reject invalid config', () => {
			// Test null
			expect(validateSpaceConfig(null)).toBe(false);
			
			// Test empty object
			expect(validateSpaceConfig({})).toBe(false);
			
			// Test empty name
			expect(validateSpaceConfig({ name: '', icon: '🚀', autoSave: true })).toBe(false);
			
			// Test empty icon
			expect(validateSpaceConfig({ name: 'Test', icon: '', autoSave: true })).toBe(false);
			
			// Test missing autoSave
			expect(validateSpaceConfig({ name: 'Test', icon: '🚀' })).toBe(false);
			
			// Test wrong autoSave type
			expect(validateSpaceConfig({ name: 'Test', icon: '🚀', autoSave: 'not boolean' })).toBe(false);
		});
	});
});
