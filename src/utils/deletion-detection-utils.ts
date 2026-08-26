import type { App } from 'obsidian';
import type { ContextWorkspacesSettings } from '../types';
import { getObsidianWorkspaceNames } from './obsidian-utils';

/**
 * Check whether a healthy workspace-registry snapshot contains missing spaces.
 * This function never mutates settings; deletion confirmation and removal are
 * centralized in ContextWorkspacesPlugin.handleWorkspaceChange.
 */
export function needsDeletionDetection(app: App, settings: ContextWorkspacesSettings): boolean {
	const obsidianWorkspaceNames = getObsidianWorkspaceNames(app);
	if (!obsidianWorkspaceNames || Object.keys(obsidianWorkspaceNames).length === 0) {
		return false;
	}

	for (const spaceId of Object.keys(settings.spaces)) {
		if (spaceId === 'default') continue;
		if (!obsidianWorkspaceNames[spaceId]) {
			return true;
		}
	}

	return false;
}
