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
	registryAvailable: boolean;
	settingsChanged: boolean;
	errors: Array<{
		workspaceId: string;
		error: string;
	}>;
}

function createResult(registryAvailable = true): DeletionDetectionResult {
	return {
		deletedWorkspaces: [],
		currentWorkspaceDeleted: false,
		needsCurrentWorkspaceSwitch: false,
		registryAvailable,
		settingsChanged: false,
		errors: [],
	};
}

function hasWorkspaceHistory(settings: ContextWorkspacesSettings, spaceId: string): boolean {
	return settings.workspaceLastSeen?.[spaceId] !== undefined;
}

/**
 * Evaluate one trusted registry snapshot. A workspace that was previously
 * observed in Obsidian and is now absent is deleted immediately: a trusted
 * snapshot (available, non-empty, anchored by at least one known workspace)
 * only reports a workspace as missing when it was actually deleted.
 */
export function observeWorkspaceDeletions(
	settings: ContextWorkspacesSettings,
	workspaceNames: Record<string, string>,
	now = Date.now(),
): DeletionDetectionResult {
	const result = createResult();
	const knownSpaceIds = Object.keys(settings.spaces).filter(
		(spaceId) => spaceId !== 'default' && hasWorkspaceHistory(settings, spaceId),
	);
	// If no known workspace is present at all, the snapshot cannot be trusted
	// (registry wipe and mass deletion are indistinguishable) - abstain.
	if (knownSpaceIds.length > 0 && !knownSpaceIds.some((spaceId) => workspaceNames[spaceId])) {
		return result;
	}

	for (const spaceId of Object.keys(settings.spaces)) {
		if (spaceId === 'default') {
			continue;
		}

		if (workspaceNames[spaceId]) {
			if (!settings.workspaceLastSeen) {
				settings.workspaceLastSeen = {};
			}
			if (settings.workspaceLastSeen[spaceId] === undefined) {
				settings.workspaceLastSeen[spaceId] = now;
				result.settingsChanged = true;
			}
			continue;
		}

		// A newly-created Context Space that was never observed in Obsidian is a
		// creation candidate for synchronization, not a deletion candidate.
		if (!hasWorkspaceHistory(settings, spaceId)) {
			continue;
		}

		result.deletedWorkspaces.push(spaceId);
		result.settingsChanged = true;
		if (spaceId === settings.currentSpaceId) {
			result.currentWorkspaceDeleted = true;
			result.needsCurrentWorkspaceSwitch = true;
		}
	}

	return result;
}

/**
 * Detect confirmed workspace deletions from the current registry snapshot.
 */
export function detectAndHandleWorkspaceDeletions(
	app: App,
	settings: ContextWorkspacesSettings,
): DeletionDetectionResult {
	const registry = getObsidianWorkspaceNames(app);
	if (registry.status !== 'available') {
		const result = createResult(false);
		result.errors.push({ workspaceId: 'registry', error: registry.error });
		return result;
	}

	return observeWorkspaceDeletions(settings, registry.names);
}

/**
 * Function to remove confirmed deleted workspaces from Context Workspaces.
 */
export function removeDeletedWorkspaces(
	settings: ContextWorkspacesSettings,
	deletedWorkspaces: string[],
): void {
	for (const workspaceId of deletedWorkspaces) {
		delete settings.spaces[workspaceId];

		const orderIndex = settings.spaceOrder.indexOf(workspaceId);
		if (orderIndex !== -1) {
			settings.spaceOrder.splice(orderIndex, 1);
		}

		if (settings.workspaceLastSeen) {
			delete settings.workspaceLastSeen[workspaceId];
		}
	}
}

/**
 * Function to switch to the first surviving workspace.
 */
export function switchToFirstWorkspace(settings: ContextWorkspacesSettings): void {
	const firstSpaceId = settings.spaceOrder.find((spaceId) => settings.spaces[spaceId]);
	if (firstSpaceId) {
		if (settings.currentSpaceId !== firstSpaceId) {
			settings.currentSpaceId = firstSpaceId;
		}
		return;
	}

	settings.currentSpaceId = '';
}

/**
 * Function to completely handle confirmed workspace deletions.
 */
export function handleWorkspaceDeletions(
	app: App,
	settings: ContextWorkspacesSettings,
): DeletionDetectionResult {
	const detectionResult = detectAndHandleWorkspaceDeletions(app, settings);

	if (detectionResult.deletedWorkspaces.length > 0) {
		removeDeletedWorkspaces(settings, detectionResult.deletedWorkspaces);
		detectionResult.settingsChanged = true;

		if (detectionResult.needsCurrentWorkspaceSwitch) {
			switchToFirstWorkspace(settings);
		}
	}

	return detectionResult;
}

export function needsDeletionDetection(app: App, settings: ContextWorkspacesSettings): boolean {
	const registry = getObsidianWorkspaceNames(app);
	if (registry.status !== 'available') {
		return false;
	}

	return Object.keys(settings.spaces).some(
		(spaceId) =>
			spaceId !== 'default' &&
			hasWorkspaceHistory(settings, spaceId) &&
			!registry.names[spaceId],
	);
}

/**
 * Safe deletion detection function (prevents duplicate execution).
 */
let deletionDetectionInProgress = false;

export function safeDeletionDetection(
	app: App,
	settings: ContextWorkspacesSettings,
): DeletionDetectionResult | null {
	if (deletionDetectionInProgress) {
		return null;
	}

	deletionDetectionInProgress = true;
	try {
		return handleWorkspaceDeletions(app, settings);
	} finally {
		deletionDetectionInProgress = false;
	}
}
