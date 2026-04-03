import {
	validateString,
	validateSpaceConfig,
	validateSpaceId,
	validateSettings,
	sanitizeString,
	sanitizeSpaceName,
	safeJsonParse,
	safeJsonStringify,
	validateThemeMode,
	validateThemeName,
	VALIDATION_RULES,
} from '../src/utils/validation';

describe('validateString', () => {
	test('should pass with valid string and no rules', () => {
		const result = validateString('hello', {});
		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test('should fail when required and empty', () => {
		const result = validateString('', { required: true });
		expect(result.isValid).toBe(false);
		expect(result.errors).toContain('Value is required');
	});

	test('should fail when required and undefined', () => {
		const result = validateString(undefined, { required: true });
		expect(result.isValid).toBe(false);
	});

	test('should pass when not required and undefined', () => {
		const result = validateString(undefined, {});
		expect(result.isValid).toBe(true);
	});

	test('should fail when value is not a string', () => {
		const result = validateString(123, {});
		expect(result.isValid).toBe(false);
		expect(result.errors).toContain('Value must be a string');
	});

	test('should enforce minLength', () => {
		const result = validateString('ab', { minLength: 3 });
		expect(result.isValid).toBe(false);

		const result2 = validateString('abc', { minLength: 3 });
		expect(result2.isValid).toBe(true);
	});

	test('should enforce maxLength', () => {
		const result = validateString('abcdef', { maxLength: 5 });
		expect(result.isValid).toBe(false);

		const result2 = validateString('abcde', { maxLength: 5 });
		expect(result2.isValid).toBe(true);
	});

	test('should enforce pattern', () => {
		const result = validateString('ABC', { pattern: /^[a-z]+$/ });
		expect(result.isValid).toBe(false);

		const result2 = validateString('abc', { pattern: /^[a-z]+$/ });
		expect(result2.isValid).toBe(true);
	});

	test('should combine multiple validation errors', () => {
		const result = validateString('x', { minLength: 3, pattern: /^[0-9]+$/ });
		expect(result.isValid).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(2);
	});
});

describe('validateSpaceConfig', () => {
	test('should validate a correct config', () => {
		expect(
			validateSpaceConfig({
				name: 'Test',
				icon: '🚀',
				autoSave: true,
			})
		).toBe(true);
	});

	test('should validate config with optional fields', () => {
		expect(
			validateSpaceConfig({
				name: 'Test',
				icon: '🚀',
				autoSave: false,
				theme: 'Minimal',
				themeMode: 'dark',
				description: 'A test space',
				createdAt: 1234567890,
			})
		).toBe(true);
	});

	test('should reject null/undefined/non-object', () => {
		expect(validateSpaceConfig(null)).toBe(false);
		expect(validateSpaceConfig(undefined)).toBe(false);
		expect(validateSpaceConfig('string')).toBe(false);
	});

	test('should reject missing required fields', () => {
		expect(validateSpaceConfig({})).toBe(false);
		expect(validateSpaceConfig({ name: 'Test' })).toBe(false);
		expect(validateSpaceConfig({ name: 'Test', icon: '🚀' })).toBe(false);
	});

	test('should reject invalid optional field types', () => {
		const base = { name: 'Test', icon: '🚀', autoSave: true };
		expect(validateSpaceConfig({ ...base, theme: 123 })).toBe(false);
		expect(validateSpaceConfig({ ...base, themeMode: 'invalid' })).toBe(false);
		expect(validateSpaceConfig({ ...base, description: 123 })).toBe(false);
		expect(validateSpaceConfig({ ...base, createdAt: 'not-a-number' })).toBe(false);
	});
});

describe('validateSpaceId', () => {
	test('should accept valid space IDs', () => {
		expect(validateSpaceId('my-space')).toBe(true);
		expect(validateSpaceId('space123')).toBe(true);
		expect(validateSpaceId('a')).toBe(true);
	});

	test('should reject invalid space IDs', () => {
		expect(validateSpaceId('')).toBe(false);
		expect(validateSpaceId(123)).toBe(false);
		expect(validateSpaceId(null)).toBe(false);
		expect(validateSpaceId('My Space')).toBe(false); // uppercase and space
	});
});

describe('validateSettings', () => {
	test('should validate correct settings', () => {
		expect(
			validateSettings({
				spaces: {
					'my-space': { name: 'My Space', icon: '🚀', autoSave: true },
				},
				spaceOrder: ['my-space'],
				currentSpaceId: 'my-space',
			})
		).toBe(true);
	});

	test('should reject null/non-object', () => {
		expect(validateSettings(null)).toBe(false);
		expect(validateSettings('string')).toBe(false);
	});

	test('should reject missing required fields', () => {
		expect(validateSettings({})).toBe(false);
		expect(validateSettings({ spaces: {} })).toBe(false);
		expect(validateSettings({ spaces: {}, spaceOrder: [] })).toBe(false);
	});

	test('should reject invalid space configs within settings', () => {
		expect(
			validateSettings({
				spaces: {
					'my-space': { name: 'Test' }, // missing icon and autoSave
				},
				spaceOrder: ['my-space'],
				currentSpaceId: 'my-space',
			})
		).toBe(false);
	});
});

describe('sanitizeString', () => {
	test('should trim whitespace', () => {
		expect(sanitizeString('  hello  ')).toBe('hello');
	});

	test('should collapse multiple spaces', () => {
		expect(sanitizeString('hello   world')).toBe('hello world');
	});
});

describe('sanitizeSpaceName', () => {
	test('should remove special characters', () => {
		expect(sanitizeSpaceName('Hello@World!')).toBe('HelloWorld');
	});

	test('should keep hyphens and alphanumeric', () => {
		expect(sanitizeSpaceName('my-space-123')).toBe('my-space-123');
	});

	test('should trim and collapse spaces', () => {
		expect(sanitizeSpaceName('  hello   world  ')).toBe('hello world');
	});
});

describe('safeJsonParse', () => {
	test('should parse valid JSON', () => {
		expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 });
	});

	test('should return fallback for invalid JSON', () => {
		expect(safeJsonParse('not json', { fallback: true })).toEqual({ fallback: true });
	});
});

describe('safeJsonStringify', () => {
	test('should stringify valid objects', () => {
		expect(safeJsonStringify({ a: 1 })).toBe('{"a":1}');
	});

	test('should return fallback for circular references', () => {
		const obj: Record<string, unknown> = {};
		obj.self = obj;
		expect(safeJsonStringify(obj, 'fallback')).toBe('fallback');
	});
});

describe('validateThemeMode', () => {
	test('should accept valid theme modes', () => {
		expect(validateThemeMode('light')).toBe('light');
		expect(validateThemeMode('dark')).toBe('dark');
		expect(validateThemeMode('system')).toBe('system');
	});

	test('should default to system for invalid values', () => {
		expect(validateThemeMode('invalid')).toBe('system');
		expect(validateThemeMode(123)).toBe('system');
		expect(validateThemeMode(null)).toBe('system');
	});
});

describe('validateThemeName', () => {
	test('should accept valid theme names', () => {
		expect(validateThemeName('Minimal')).toBe('Minimal');
		expect(validateThemeName('My Theme-1')).toBe('My Theme-1');
	});

	test('should reject invalid theme names', () => {
		expect(validateThemeName(123)).toBe('');
		expect(validateThemeName('invalid@name!')).toBe('');
	});
});

describe('VALIDATION_RULES', () => {
	test('should have expected rule definitions', () => {
		expect(VALIDATION_RULES.SPACE_NAME.minLength).toBe(1);
		expect(VALIDATION_RULES.SPACE_NAME.maxLength).toBe(100);
		expect(VALIDATION_RULES.SPACE_ID.pattern).toBeInstanceOf(RegExp);
	});
});
