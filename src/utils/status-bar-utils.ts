import type { SpaceConfig } from '../types';

/** Fallback icon used when a space has no icon set. */
export const DEFAULT_SPACE_ICON = '📄';

/**
 * Format the label shown in the status bar item and the space-switcher menu.
 */
export function formatStatusBarLabel(space: Pick<SpaceConfig, 'icon' | 'name'>): string {
	const icon = space.icon || DEFAULT_SPACE_ICON;
	return `${icon} ${space.name}`.trim();
}
