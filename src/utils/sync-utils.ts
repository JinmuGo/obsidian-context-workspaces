import type { App } from 'obsidian';
import type { ContextSpacesSettings } from '../types';
import { createObsidianWorkspace, getObsidianWorkspaceNames } from './obsidian-utils';

/**
 * 양방향 동기화 결과를 나타내는 인터페이스
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
 * 양방향 동기화를 수행하는 함수
 */
export async function performBidirectionalSync(
	app: App,
	settings: ContextSpacesSettings
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

		// 1단계: Obsidian → Context Spaces 동기화
		for (const [workspaceId, workspaceName] of Object.entries(obsidianWorkspaceNames)) {
			if (!settings.spaces[workspaceId]) {
				// 새로운 workspace를 Context Spaces로 가져오기
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
				console.log(`Imported workspace from Obsidian: ${workspaceName} (${workspaceId})`);
			} else {
				// 기존 workspace가 있는 경우 이름 충돌 확인
				const contextName = settings.spaces[workspaceId].name;
				if (contextName !== workspaceName) {
					// 충돌 발생: Obsidian 이름을 우선으로 함
					const resolvedName = workspaceName;
					settings.spaces[workspaceId].name = resolvedName;

					result.conflicts.push({
						workspaceId,
						obsidianName: workspaceName,
						contextName,
						resolvedName,
					});

					_hasChanges = true;
					console.log(
						`Resolved name conflict for ${workspaceId}: "${contextName}" → "${resolvedName}"`
					);
				}
			}
		}

		// 2단계: Context Spaces → Obsidian 동기화
		for (const spaceId of Object.keys(settings.spaces)) {
			if (!obsidianWorkspaceNames[spaceId]) {
				try {
					await createObsidianWorkspace(app, spaceId, settings.spaces[spaceId].name);
					result.createdInObsidian.push(spaceId);
					console.log(
						`Created workspace in Obsidian: ${settings.spaces[spaceId].name} (${spaceId})`
					);
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
 * 동기화 결과를 사용자에게 알리는 함수
 */
export function notifySyncResult(result: SyncResult): void {
	const messages: string[] = [];

	if (result.importedFromObsidian.length > 0) {
		messages.push(
			`${result.importedFromObsidian.length}개 workspace를 Obsidian에서 가져왔습니다.`
		);
	}

	if (result.createdInObsidian.length > 0) {
		messages.push(`${result.createdInObsidian.length}개 workspace를 Obsidian에 생성했습니다.`);
	}

	if (result.conflicts.length > 0) {
		messages.push(`${result.conflicts.length}개 이름 충돌을 해결했습니다.`);
	}

	if (result.errors.length > 0) {
		messages.push(`${result.errors.length}개 오류가 발생했습니다.`);
	}

	if (messages.length > 0) {
		console.log('Sync Result:', messages.join(' '));
	}
}

/**
 * 동기화가 필요한지 확인하는 함수
 */
export function needsSync(app: App, settings: ContextSpacesSettings): boolean {
	const obsidianWorkspaceNames = getObsidianWorkspaceNames(app);

	// Obsidian에만 있는 workspace가 있는지 확인
	for (const workspaceId of Object.keys(obsidianWorkspaceNames)) {
		if (!settings.spaces[workspaceId]) {
			return true;
		}
	}

	// Context Spaces에만 있는 workspace가 있는지 확인
	for (const spaceId of Object.keys(settings.spaces)) {
		if (!obsidianWorkspaceNames[spaceId]) {
			return true;
		}
	}

	// 이름 충돌이 있는지 확인
	for (const [workspaceId, workspaceName] of Object.entries(obsidianWorkspaceNames)) {
		if (settings.spaces[workspaceId] && settings.spaces[workspaceId].name !== workspaceName) {
			return true;
		}
	}

	return false;
}

/**
 * 안전한 동기화를 수행하는 함수 (중복 실행 방지)
 */
let syncInProgress = false;

export async function safeBidirectionalSync(
	app: App,
	settings: ContextSpacesSettings
): Promise<SyncResult | null> {
	if (syncInProgress) {
		console.log('Sync already in progress, skipping...');
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
