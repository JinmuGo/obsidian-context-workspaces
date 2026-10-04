import type { App } from 'obsidian';
import type { ContextWorkspacesSettings } from '../types';
import { getObsidianWorkspaceNames } from './obsidian-utils';

/**
 * Import Obsidian workspaces that have no Context Space yet and return their ids.
 *
 * This is one-way on purpose. A space whose workspace is missing from the registry
 * is left alone: with a sync tool in between, a missing entry usually means that
 * `workspaces.json` has not arrived yet. Recreating it from the layout on screen or
 * deleting the space would overwrite the other device's data once it does (#18, #22).
 */
export function importObsidianWorkspaces(app: App, settings: ContextWorkspacesSettings): string[] {
	const obsidianWorkspaceNames = getObsidianWorkspaceNames(app);
	if (!obsidianWorkspaceNames) {
		return [];
	}

	const imported: string[] = [];
	for (const [workspaceId, workspaceName] of Object.entries(obsidianWorkspaceNames)) {
		if (settings.spaces[workspaceId]) {
			continue;
		}

		settings.spaces[workspaceId] = {
			name: workspaceName,
			icon: '📄',
			autoSave: false,
		};
		if (!settings.spaceOrder.includes(workspaceId)) {
			settings.spaceOrder.push(workspaceId);
		}
		imported.push(workspaceId);
	}

	return imported;
}
