import type { ThemeMode } from '../types';

/**
 * Validation rules for different data types
 */
export const VALIDATION_RULES = {
	SPACE_NAME: {
		minLength: 1,
		maxLength: 100,
	},
	SPACE_DESCRIPTION: {
		maxLength: 500,
	},
	SPACE_ID: {
		minLength: 1,
		maxLength: 50,
		pattern: /^[a-z0-9-]+$/,
	},
	THEME_NAME: {
		maxLength: 100,
		pattern: /^[a-zA-Z0-9\s\-_]+$/,
	},
} as const;

/**
 * Validation result interface
 */
export interface ValidationResult {
	isValid: boolean;
	errors: string[];
}

/**
 * Validate string based on rules
 */
export function validateString(
	value: unknown,
	rules: {
		minLength?: number;
		maxLength?: number;
		pattern?: RegExp;
		required?: boolean;
	}
): ValidationResult {
	const errors: string[] = [];

	if (rules.required && (value === undefined || value === null || value === '')) {
		errors.push('Value is required');
		return { isValid: false, errors };
	}

	if (value === undefined || value === null) {
		return { isValid: true, errors: [] };
	}

	if (typeof value !== 'string') {
		errors.push('Value must be a string');
		return { isValid: false, errors };
	}

	const str = value as string;

	if (rules.minLength !== undefined && str.length < rules.minLength) {
		errors.push(`Minimum length is ${rules.minLength} characters`);
	}

	if (rules.maxLength !== undefined && str.length > rules.maxLength) {
		errors.push(`Maximum length is ${rules.maxLength} characters`);
	}

	if (rules.pattern && !rules.pattern.test(str)) {
		errors.push('Value does not match required pattern');
	}

	return {
		isValid: errors.length === 0,
		errors,
	};
}

/**
 * Validate space configuration
 */
export function validateSpaceConfig(config: unknown): boolean {
	if (!config || typeof config !== 'object') {
		return false;
	}

	const space = config as Record<string, unknown>;

	// Required fields
	if (!space.name || typeof space.name !== 'string') {
		return false;
	}

	if (!space.icon || typeof space.icon !== 'string') {
		return false;
	}

	if (typeof space.autoSave !== 'boolean') {
		return false;
	}

	// Optional fields validation
	if (space.theme !== undefined && typeof space.theme !== 'string') {
		return false;
	}

	if (space.themeMode !== undefined && !['light', 'dark', 'system'].includes(space.themeMode as string)) {
		return false;
	}

	if (space.description !== undefined && typeof space.description !== 'string') {
		return false;
	}

	if (space.createdAt !== undefined && typeof space.createdAt !== 'number') {
		return false;
	}

	return true;
}

/**
 * Validate space ID
 */
export function validateSpaceId(spaceId: unknown): boolean {
	if (typeof spaceId !== 'string') {
		return false;
	}

	const result = validateString(spaceId, VALIDATION_RULES.SPACE_ID);
	return result.isValid;
}

/**
 * Validate settings object
 */
export function validateSettings(settings: unknown): boolean {
	if (!settings || typeof settings !== 'object') {
		return false;
	}

	const config = settings as Record<string, unknown>;

	// Required fields
	if (!config.spaces || typeof config.spaces !== 'object') {
		return false;
	}

	if (!Array.isArray(config.spaceOrder)) {
		return false;
	}

	if (typeof config.currentSpaceId !== 'string') {
		return false;
	}

	// Validate spaces object
	const spaces = config.spaces as Record<string, unknown>;
	for (const [spaceId, spaceConfig] of Object.entries(spaces)) {
		if (!validateSpaceId(spaceId)) {
			return false;
		}
		if (!validateSpaceConfig(spaceConfig)) {
			return false;
		}
	}

	// Validate space order
	for (const spaceId of config.spaceOrder as string[]) {
		if (!validateSpaceId(spaceId)) {
			return false;
		}
	}

	return true;
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string): string {
	return input
		.trim()
		.replace(/\s+/g, ' ');
}

/**
 * Sanitize space name
 */
export function sanitizeSpaceName(name: string): string {
	return sanitizeString(name)
		.replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
		.replace(/\s+/g, ' ') // Replace multiple spaces with single space
		.trim();
}

/**
 * Escape HTML characters
 */
export function escapeHtml(text: string): string {
	const div = document.createElement('div');
	div.textContent = text;
	return div.textContent || '';
}

/**
 * Safe JSON parsing
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
	try {
		return JSON.parse(json) as T;
	} catch {
		return fallback;
	}
}

/**
 * Safe JSON stringify
 */
export function safeJsonStringify(obj: unknown, fallback = ''): string {
	try {
		return JSON.stringify(obj);
	} catch {
		return fallback;
	}
}

/**
 * Validate and sanitize theme mode
 */
export function validateThemeMode(mode: unknown): ThemeMode {
	if (typeof mode === 'string' && ['light', 'dark', 'system'].includes(mode)) {
		return mode as ThemeMode;
	}
	return 'system';
}

/**
 * Validate and sanitize theme name
 */
export function validateThemeName(name: unknown): string {
	if (typeof name === 'string') {
		const result = validateString(name, VALIDATION_RULES.THEME_NAME);
		if (result.isValid) {
			return sanitizeString(name);
		}
	}
	return '';
} 
