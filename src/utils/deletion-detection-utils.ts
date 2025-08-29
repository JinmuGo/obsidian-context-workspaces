import type { App } from 'obsidian';
import type { ContextSpacesSettings } from '../types';
import { getObsidianWorkspaceNames } from './obsidian-utils';

/**
 * Workspace 삭제 감지 결과를 나타내는 인터페이스
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
 * Workspace 삭제를 감지하고 처리하는 함수
 */
export function detectAndHandleWorkspaceDeletions(
	app: App,
	settings: ContextSpacesSettings
): DeletionDetectionResult {
	const result: DeletionDetectionResult = {
		deletedWorkspaces: [],
		currentWorkspaceDeleted: false,
		needsCurrentWorkspaceSwitch: false,
		errors: [],
	};

	try {
		const obsidianWorkspaceNames = getObsidianWorkspaceNames(app);

		// Context Spaces에 있지만 Obsidian에는 없는 workspace 찾기
		for (const spaceId of Object.keys(settings.spaces)) {
			if (spaceId === 'default') continue; // default workspace는 제외

			if (!obsidianWorkspaceNames[spaceId]) {
				result.deletedWorkspaces.push(spaceId);

				// 현재 활성 workspace가 삭제되었는지 확인
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
 * 삭제된 workspace들을 Context Spaces에서 제거하는 함수
 */
export function removeDeletedWorkspaces(
	settings: ContextSpacesSettings,
	deletedWorkspaces: string[]
): void {
	for (const workspaceId of deletedWorkspaces) {
		// workspace 제거
		delete settings.spaces[workspaceId];

		// space order에서 제거
		const orderIndex = settings.spaceOrder.indexOf(workspaceId);
		if (orderIndex !== -1) {
			settings.spaceOrder.splice(orderIndex, 1);
		}

		console.log(`Removed deleted workspace from Context Spaces: ${workspaceId}`);
	}
}

/**
 * 현재 workspace가 삭제되었을 때 첫 번째 workspace로 전환하는 함수
 */
export function switchToFirstWorkspace(settings: ContextSpacesSettings): void {
	const firstSpaceId = settings.spaceOrder[0];
	if (firstSpaceId && settings.currentSpaceId !== firstSpaceId) {
		const oldWorkspaceId = settings.currentSpaceId;
		settings.currentSpaceId = firstSpaceId;

		console.log(`Switched from deleted workspace ${oldWorkspaceId} to first workspace ${firstSpaceId}`);
	}
}

/**
 * Workspace 삭제를 완전히 처리하는 함수
 */
export function handleWorkspaceDeletions(
	app: App,
	settings: ContextSpacesSettings
): DeletionDetectionResult {
	const detectionResult = detectAndHandleWorkspaceDeletions(app, settings);

	if (detectionResult.deletedWorkspaces.length > 0) {
		// 삭제된 workspace들을 Context Spaces에서 제거
		removeDeletedWorkspaces(settings, detectionResult.deletedWorkspaces);

		// 현재 workspace가 삭제되었다면 첫 번째 workspace로 전환
		if (detectionResult.needsCurrentWorkspaceSwitch) {
			switchToFirstWorkspace(settings);
		}

		console.log(`Handled ${detectionResult.deletedWorkspaces.length} deleted workspace(s)`);
	}

	return detectionResult;
}

/**
 * 삭제 감지가 필요한지 확인하는 함수
 */
export function needsDeletionDetection(app: App, settings: ContextSpacesSettings): boolean {
	try {
		const obsidianWorkspaceNames = getObsidianWorkspaceNames(app);

		// Context Spaces에 있지만 Obsidian에는 없는 workspace가 있는지 확인
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
 * 안전한 삭제 감지를 수행하는 함수 (중복 실행 방지)
 */
let deletionDetectionInProgress = false;

export async function safeDeletionDetection(
	app: App,
	settings: ContextSpacesSettings
): Promise<DeletionDetectionResult | null> {
	if (deletionDetectionInProgress) {
		console.log('Deletion detection already in progress, skipping...');
		return null;
	}

	deletionDetectionInProgress = true;
	try {
		// 동기 처리로 변경 (불필요한 Promise/setTimeout 제거)
		const result = handleWorkspaceDeletions(app, settings);

		if (result.deletedWorkspaces.length > 0) {
			console.log(
				`Detected and handled ${result.deletedWorkspaces.length} deleted workspace(s)`
			);
		}

		return result;
	} finally {
		deletionDetectionInProgress = false;
	}
}
