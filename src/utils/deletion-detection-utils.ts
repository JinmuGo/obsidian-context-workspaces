import type { App } from 'obsidian';
import type { ContextWorkspacesSettings } from '../types';
import { getObsidianWorkspaceNames } from './obsidian-utils';

/**
 * Interface representing workspace deletion detection result
 */
export interface DeletionDetectionResult {
	deletedWorkspaces: string[];
	currentWorkspaceDeleted: boolean;
	needsCurrentWorkspaceSwitch: boolean;
	errors: Array<{
		workspaceId: string;
		error: string;
	}>;
}

/**
 * Function to detect and handle workspace deletions
 */
export function detectAndHandleWorkspaceDeletions(
	app: App,
	settings: ContextWorkspacesSettings
): DeletionDetectionResult {
	const result: DeletionDetectionResult = {
		deletedWorkspaces: [],
		currentWorkspaceDeleted: false,
		needsCurrentWorkspaceSwitch: false,
		errors: [],
	};

	try {
		const obsidianWorkspaceNames = getObsidianWorkspaceNames(app);

		for (const spaceId of Object.keys(settings.spaces)) {
			if (spaceId === 'default') continue; // Exclude default workspace

			if (!obsidianWorkspaceNames[spaceId]) {
				result.deletedWorkspaces.push(spaceId);

				// Check if current active workspace was deleted
				if (spaceId === settings.currentSpaceId) {
					result.currentWorkspaceDeleted = true;
					result.needsCurrentWorkspaceSwitch = true;
				}
			}
		}

		return result;
	} catch (error) {
		result.errors.push({
			workspaceId: 'detection',
			error: error instanceof Error ? error.message : String(error),
		});
		console.error('Failed to detect workspace deletions:', error);
		return result;
	}
}

/**
 * Function to remove deleted workspaces from Context Workspaces
 */
export function removeDeletedWorkspaces(
	settings: ContextWorkspacesSettings,
	deletedWorkspaces: string[]
): void {
	for (const workspaceId of deletedWorkspaces) {
		// Remove workspace
		delete settings.spaces[workspaceId];

		// Remove from space order
		const orderIndex = settings.spaceOrder.indexOf(workspaceId);
		if (orderIndex !== -1) {
			settings.spaceOrder.splice(orderIndex, 1);
		}

		if (process.env.NODE_ENV === 'development') {
			console.log(`Removed deleted workspace from Context Workspaces: ${workspaceId}`);
		}
	}
}

/**
 * Function to switch to first workspace when current workspace is deleted
 */
export function switchToFirstWorkspace(settings: ContextWorkspacesSettings): void {
	const firstSpaceId = settings.spaceOrder[0];
	if (firstSpaceId && settings.currentSpaceId !== firstSpaceId) {
		const oldWorkspaceId = settings.currentSpaceId;
		settings.currentSpaceId = firstSpaceId;

		if (process.env.NODE_ENV === 'development') {
			console.log(`Switched from deleted workspace ${oldWorkspaceId} to first workspace ${firstSpaceId}`);
		}
	}
}

/**
 * Function to completely handle workspace deletions
 */
export function handleWorkspaceDeletions(
	app: App,
	settings: ContextWorkspacesSettings
): DeletionDetectionResult {
	const detectionResult = detectAndHandleWorkspaceDeletions(app, settings);

	if (detectionResult.deletedWorkspaces.length > 0) {
		removeDeletedWorkspaces(settings, detectionResult.deletedWorkspaces);

		if (detectionResult.needsCurrentWorkspaceSwitch) {
			switchToFirstWorkspace(settings);
		}

		if (process.env.NODE_ENV === 'development') {
			console.log(`Handled ${detectionResult.deletedWorkspaces.length} deleted workspace(s)`);
		}
	}

	return detectionResult;
}

export function needsDeletionDetection(app: App, settings: ContextWorkspacesSettings): boolean {
	try {
		const obsidianWorkspaceNames = getObsidianWorkspaceNames(app);

		for (const spaceId of Object.keys(settings.spaces)) {
			if (!obsidianWorkspaceNames[spaceId]) {
				return true;
			}
		}

		return false;
	} catch (error) {
		console.error('Failed to check if deletion detection is needed:', error);
		return false;
	}
}

/**
 * Safe deletion detection function (prevents duplicate execution)
 */
let deletionDetectionInProgress = false;

export async function safeDeletionDetection(
	app: App,
	settings: ContextWorkspacesSettings
): Promise<DeletionDetectionResult | null> {
	if (deletionDetectionInProgress) {
		if (process.env.NODE_ENV === 'development') {
			console.log('Deletion detection already in progress, skipping...');
		}
		return null;
	}

	deletionDetectionInProgress = true;
	try {
		// Changed to synchronous processing (removed unnecessary Promise/setTimeout)
		const result = handleWorkspaceDeletions(app, settings);

		if (result.deletedWorkspaces.length > 0 && process.env.NODE_ENV === 'development') {
			console.log(
				`Detected and handled ${result.deletedWorkspaces.length} deleted workspace(s)`
			);
		}

		return result;
	} finally {
		deletionDetectionInProgress = false;
	}
}
