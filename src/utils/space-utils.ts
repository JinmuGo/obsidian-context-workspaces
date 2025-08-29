import type { SpaceConfig, ThemeMode } from '../types';

/**
 * Generate a unique space ID based on the name
 */
export function generateSpaceId(name: string, existingSpaces: Record<string, SpaceConfig>): string {
	if (!name || name.trim().length === 0) {
		let spaceId = 'space';
		let counter = 1;

		while (existingSpaces[spaceId]) {
			spaceId = `space-${counter}`;
			counter++;
		}

		return spaceId;
	}

	const baseId = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
	let spaceId = baseId;
	let counter = 1;

	while (existingSpaces[spaceId]) {
		spaceId = `${baseId}-${counter}`;
		counter++;
	}

	return spaceId;
}

/**
 * Parse space data from modal input (supports both JSON and legacy string format)
 */
export function parseSpaceData(input: string): {
	name: string;
	icon: string;
	description?: string;
	theme?: string;
	themeMode?: ThemeMode;
} {
	try {
		const parsed = JSON.parse(input);
		return {
			name: parsed.name,
			icon: parsed.icon,
			description: parsed.description,
			theme: (parsed.theme ?? '').trim() || undefined,
			themeMode: parsed.themeMode as ThemeMode | undefined,
		};
	} catch {
		// Legacy format compatibility
		return {
			name: input,
			icon: '✨',
		};
	}
}

export function searchSpaces(spaces: Record<string, SpaceConfig>, query: string): string[] {
	const lowerQuery = query.toLowerCase();
	return Object.entries(spaces)
		.filter(([id, space]) => {
			return (
				id.toLowerCase().includes(lowerQuery) ||
				space.name.toLowerCase().includes(lowerQuery) ||
				space.description?.toLowerCase().includes(lowerQuery)
			);
		})
		.map(([id, _]) => id);
}

export function validateSpaceConfig(space: unknown): space is SpaceConfig {
	return (
		space !== null &&
		typeof space === 'object' &&
		'name' in space &&
		typeof (space as SpaceConfig).name === 'string' &&
		(space as SpaceConfig).name.trim().length > 0 &&
		'icon' in space &&
		typeof (space as SpaceConfig).icon === 'string' &&
		(space as SpaceConfig).icon.trim().length > 0 &&
		'autoSave' in space &&
		typeof (space as SpaceConfig).autoSave === 'boolean'
	);
}
