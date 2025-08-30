import type { App } from 'obsidian';
import type { ContextWorkspacesSettings } from '../types';
import { createObsidianWorkspace, getObsidianWorkspaceNames } from './obsidian-utils';

/**
 * Interface representing bidirectional synchronization result
 */
export interface SyncResult {
	importedFromObsidian: string[];
	createdInObsidian: string[];
	conflicts: Array<{
		workspaceId: string;
		obsidianName: string;
		contextName: string;
		resolvedName: string;
	}>;
	errors: Array<{
		workspaceId: string;
		error: string;
	}>;
}

/**
 * Function to perform bidirectional synchronization
 */
export async function performBidirectionalSync(
	app: App,
	settings: ContextWorkspacesSettings
): Promise<SyncResult> {
	const result: SyncResult = {
		importedFromObsidian: [],
		createdInObsidian: [],
		conflicts: [],
		errors: [],
	};

	try {
		const obsidianWorkspaceNames = getObsidianWorkspaceNames(app);
		let _hasChanges = false;

		for (const [workspaceId, workspaceName] of Object.entries(obsidianWorkspaceNames)) {
			if (!settings.spaces[workspaceId]) {
				settings.spaces[workspaceId] = {
					name: workspaceName,
					icon: '📄',
					autoSave: false,
				};

				if (!settings.spaceOrder.includes(workspaceId)) {
					settings.spaceOrder.push(workspaceId);
				}

				result.importedFromObsidian.push(workspaceId);
				_hasChanges = true;
				if (process.env.NODE_ENV === 'development') {
					console.log(`Imported workspace from Obsidian: ${workspaceName} (${workspaceId})`);
				}
			} else {
				// Check for name conflicts with existing workspace
				const contextName = settings.spaces[workspaceId].name;
				if (contextName !== workspaceName) {
					// Conflict occurred: prioritize Obsidian name
					const resolvedName = workspaceName;
					settings.spaces[workspaceId].name = resolvedName;

					result.conflicts.push({
						workspaceId,
						obsidianName: workspaceName,
						contextName,
						resolvedName,
					});

					_hasChanges = true;
					if (process.env.NODE_ENV === 'development') {
						console.log(
							`Resolved name conflict for ${workspaceId}: "${contextName}" → "${resolvedName}"`
						);
					}
				}
			}
		}

		// Step 2: Context Workspaces → Obsidian synchronization
		for (const spaceId of Object.keys(settings.spaces)) {
			if (!obsidianWorkspaceNames[spaceId]) {
				try {
					await createObsidianWorkspace(app, spaceId, settings.spaces[spaceId].name);
					result.createdInObsidian.push(spaceId);
					if (process.env.NODE_ENV === 'development') {
						console.log(
							`Created workspace in Obsidian: ${settings.spaces[spaceId].name} (${spaceId})`
						);
					}
				} catch (error) {
					result.errors.push({
						workspaceId: spaceId,
						error: error instanceof Error ? error.message : String(error),
					});
					console.error(`Failed to create workspace in Obsidian for ${spaceId}:`, error);
				}
			}
		}

		return result;
	} catch (error) {
		result.errors.push({
			workspaceId: 'sync',
			error: error instanceof Error ? error.message : String(error),
		});
		console.error('Failed to perform bidirectional sync:', error);
		return result;
	}
}

/**
 * Function to notify user of synchronization results
 */
export function notifySyncResult(result: SyncResult): void {
	const messages: string[] = [];

	if (result.importedFromObsidian.length > 0) {
		messages.push(
			`${result.importedFromObsidian.length} workspaces imported from Obsidian.`
		);
	}

	if (result.createdInObsidian.length > 0) {
		messages.push(`${result.createdInObsidian.length} workspaces created in Obsidian.`);
	}

	if (result.conflicts.length > 0) {
		messages.push(`${result.conflicts.length} name conflicts resolved.`);
	}

	if (result.errors.length > 0) {
		messages.push(`${result.errors.length} errors occurred.`);
	}

	if (messages.length > 0 && process.env.NODE_ENV === 'development') {
		console.log('Sync Result:', messages.join(' '));
	}
}

/**
 * Function to check if synchronization is needed
 */
export function needsSync(app: App, settings: ContextWorkspacesSettings): boolean {
	const obsidianWorkspaceNames = getObsidianWorkspaceNames(app);

	// Check if there are workspaces only in Obsidian
	for (const workspaceId of Object.keys(obsidianWorkspaceNames)) {
		if (!settings.spaces[workspaceId]) {
			return true;
		}
	}

	for (const spaceId of Object.keys(settings.spaces)) {
		if (!obsidianWorkspaceNames[spaceId]) {
			return true;
		}
	}

	// Check for name conflicts
	for (const [workspaceId, workspaceName] of Object.entries(obsidianWorkspaceNames)) {
		if (settings.spaces[workspaceId] && settings.spaces[workspaceId].name !== workspaceName) {
			return true;
		}
	}

	return false;
}

/**
 * Safe synchronization function (prevents duplicate execution)
 */
let syncInProgress = false;

export async function safeBidirectionalSync(
	app: App,
	settings: ContextWorkspacesSettings
): Promise<SyncResult | null> {
	if (syncInProgress) {
		if (process.env.NODE_ENV === 'development') {
			console.log('Sync already in progress, skipping...');
		}
		return null;
	}

	syncInProgress = true;
	try {
		const result = await performBidirectionalSync(app, settings);
		notifySyncResult(result);
		return result;
	} finally {
		syncInProgress = false;
	}
}
