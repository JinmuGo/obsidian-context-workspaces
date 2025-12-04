import { type App, Modal, type Plugin, PluginSettingTab } from 'obsidian';
import React from 'react';
import { ContextWorkspacesSettingTab as ReactContextWorkspacesSettingTab } from '../components/ContextWorkspacesSettingTab';
import { HelpModal as ReactHelpModal } from '../components/HelpModal';
import { SidebarManager as ReactSidebarManager } from '../components/SidebarManager';
import { SpaceCreateModal } from '../components/SpaceCreateModal';
import { SpaceEditModal as ReactSpaceEditModal } from '../components/SpaceEditModal';
import { SpaceManagerModal as ReactSpaceManagerModal } from '../components/SpaceManagerModal';
import type { ContextWorkspacesPlugin } from '../types';
import { getLeftSidebarContainer } from '../utils/obsidian-utils';
import { ReactModalWrapper, ReactWrapper } from '../utils/react-utils';

// Export the SpaceCreateModal directly since it now extends Modal
export { SpaceCreateModal };

// Wrapper for HelpModal
export class HelpModal extends Modal {
	private reactWrapper: ReactModalWrapper;

	constructor(app: App) {
		super(app);
		this.reactWrapper = new ReactModalWrapper();
	}

	onOpen() {
		this.reactWrapper.open(
			React.createElement(ReactHelpModal, {
				isOpen: true,
				onClose: () => this.close(),
			})
		);
	}

	onClose() {
		this.reactWrapper.close();
	}
}

// Wrapper for SpaceEditModal (React version - used in settings tab)
export class SpaceEditModal extends Modal {
	private plugin: ContextWorkspacesPlugin;
	private spaceId: string;
	private onSave?: () => void;
	private reactWrapper: ReactModalWrapper;

	constructor(app: App, plugin: ContextWorkspacesPlugin, spaceId: string, onSave?: () => void) {
		super(app);
		this.plugin = plugin;
		this.spaceId = spaceId;
		this.onSave = onSave;
		this.reactWrapper = new ReactModalWrapper();
	}

	onOpen() {
		this.reactWrapper.open(
			React.createElement(ReactSpaceEditModal, {
				app: this.app,
				plugin: this.plugin,
				spaceId: this.spaceId,
				isOpen: true,
				onSave: this.onSave,
				onClose: () => this.close(),
			})
		);
	}

	onClose() {
		this.reactWrapper.close();
	}
}

// Wrapper for SpaceManagerModal
export class SpaceManagerModal extends Modal {
	private plugin: ContextWorkspacesPlugin;
	private reactWrapper: ReactModalWrapper;

	constructor(app: App, plugin: ContextWorkspacesPlugin) {
		super(app);
		this.plugin = plugin;
		this.reactWrapper = new ReactModalWrapper();
	}

	onOpen() {
		this.reactWrapper.open(
			React.createElement(ReactSpaceManagerModal, {
				app: this.app,
				plugin: this.plugin,
				isOpen: true,
				onClose: () => this.close(),
			})
		);
	}

	onClose() {
		this.reactWrapper.close();
	}
}

// Wrapper for ContextWorkspacesSettingTab
export class ContextWorkspacesSettingTab extends PluginSettingTab {
	private plugin: ContextWorkspacesPlugin;
	private reactWrapper: ReactWrapper;

	constructor(app: App, plugin: ContextWorkspacesPlugin) {
		super(app, plugin as unknown as Plugin);
		this.plugin = plugin;
		this.reactWrapper = new ReactWrapper();
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.reactWrapper.render(
			React.createElement(ReactContextWorkspacesSettingTab, {
				app: this.app,
				plugin: this.plugin,
				containerEl: containerEl,
			}),
			containerEl
		);
	}

	hide() {
		this.reactWrapper.cleanup();
		super.hide();
	}
}

// Wrapper for SidebarManager
export class SidebarManager {
	private plugin: ContextWorkspacesPlugin;
	public container: HTMLElement | null = null;
	private observer: MutationObserver | null = null;
	private reactWrapper: ReactWrapper;
	private isInitializing: boolean = false;
	private reinitializeTimeout: NodeJS.Timeout | null = null;

	constructor(plugin: Plugin) {
		this.plugin = plugin as unknown as ContextWorkspacesPlugin;
		this.reactWrapper = new ReactWrapper();
	}

	initialize() {
		// 중복 초기화 방지 (단, 첫 초기화는 허용)
		if (this.isInitializing && this.container) {
			return;
		}

		this.isInitializing = true;

		try {
			const leftSidebarContainer = getLeftSidebarContainer(this.plugin.app as App);
			if (!leftSidebarContainer) {
				this.isInitializing = false;
				return;
			}

			// 기존 컨테이너가 이미 존재하고 연결되어 있는지 확인
			if (this.container?.isConnected) {
				// 이미 존재하는 경우 렌더링만 업데이트
				this.render();
				this.isInitializing = false;
				return;
			}

			// 기존 컨테이너 정리
			if (this.container) {
				this.container.remove();
				this.container = null;
			}

			// 기존 React 래퍼 정리
			this.reactWrapper.cleanup();

			// 사이드바 컨테이너 생성
			this.container = leftSidebarContainer.createDiv({
				cls: 'obsidian-context-workspaces-sidebar',
			});

			// 초기 렌더링
			this.render();

			// DOM 변경 감지 설정
			this.setupObserver();
		} catch (error) {
			console.error('Failed to initialize sidebar:', error);
		} finally {
			this.isInitializing = false;
		}
	}

	ensureExists() {
		// 컨테이너가 없거나 연결되지 않은 경우 즉시 초기화
		if (!this.container || !this.container.isConnected) {
			this.initialize();
			return;
		}

		// 디바운싱을 위한 타임아웃 설정 (렌더링 업데이트만)
		if (this.reinitializeTimeout) {
			clearTimeout(this.reinitializeTimeout);
		}

		this.reinitializeTimeout = setTimeout(() => {
			// 컨테이너가 존재하고 연결되어 있으면 렌더링만 업데이트
			this.render();
		}, 50); // 50ms 디바운싱
	}

	private setupObserver() {
		if (this.observer) {
			this.observer.disconnect();
		}

		const leftSidebarContainer = getLeftSidebarContainer(this.plugin.app as App);
		if (!leftSidebarContainer) return;

		this.observer = new MutationObserver((mutations) => {
			let shouldReinitialize = false;

			for (const mutation of mutations) {
				if (mutation.type === 'childList') {
					// 추가된 노드들 확인 (중복 사이드바 제거는 CSS에서 처리)
					// mutation.addedNodes.forEach((node) => {
					// 	// 다른 사이드바가 추가되었는지 확인
					// 	if (
					// 		node.nodeType === Node.ELEMENT_NODE &&
					// 		(node as Element).classList?.contains('obsidian-context-workspaces-sidebar') &&
					// 		node !== this.container
					// 	) {
					// 		// 중복 사이드바 발견 - 제거
					// 		(node as Element).remove();
					// 	}
					// });

					// 제거된 노드들 확인
					mutation.removedNodes.forEach((node) => {
						if (
							node === this.container ||
							(node.nodeType === Node.ELEMENT_NODE &&
								this.container &&
								(node as Element).contains(this.container))
						) {
							shouldReinitialize = true;
						}
					});
				}
				if (shouldReinitialize) break;
			}

			if (shouldReinitialize) {
				// requestAnimationFrame을 사용하여 부드러운 재초기화
				requestAnimationFrame(() => {
					this.ensureExists();
				});
			}
		});

		this.observer.observe(leftSidebarContainer, {
			childList: true,
			subtree: true,
		});
	}

	render() {
		if (!this.container) {
			this.ensureExists();
			return;
		}

		try {
			// 컨테이너가 DOM에 연결되어 있는지 확인
			if (!this.container.isConnected) {
				// 컨테이너가 연결되지 않았으면 재초기화 시도
				this.ensureExists();
				return;
			}

			// React 래퍼가 연결되어 있으면 업데이트, 아니면 새로 렌더링
			if (this.reactWrapper.isConnected()) {
				this.reactWrapper.update(
					React.createElement(ReactSidebarManager, {
						plugin: this.plugin,
					})
				);
			} else {
				// 컨테이너 초기화 후 첫 렌더링
				this.container.empty();
				this.reactWrapper.render(
					React.createElement(ReactSidebarManager, {
						plugin: this.plugin,
					}),
					this.container
				);
			}
		} catch (error) {
			console.error('Failed to render sidebar:', error);
			// 렌더링 실패 시 재초기화
			setTimeout(() => {
				this.initialize();
			}, 100);
		}
	}

	destroy() {
		// 타임아웃 정리
		if (this.reinitializeTimeout) {
			clearTimeout(this.reinitializeTimeout);
			this.reinitializeTimeout = null;
		}

		// Observer 정리
		if (this.observer) {
			this.observer.disconnect();
			this.observer = null;
		}

		// React 래퍼 정리
		this.reactWrapper.cleanup();

		// 컨테이너 정리
		if (this.container) {
			this.container.remove();
			this.container = null;
		}

		this.isInitializing = false;
	}
}
