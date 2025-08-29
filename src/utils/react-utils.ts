import type React from 'react';
import { createRoot, type Root } from 'react-dom/client';

/**
 * React 컴포넌트를 Obsidian DOM에 렌더링하는 래퍼 클래스
 */
export class ReactWrapper {
	private root: Root | null = null;
	private container: HTMLElement | null = null;

	/**
	 * React 컴포넌트를 DOM에 렌더링
	 */
	render(component: React.ReactElement, container: HTMLElement) {
		// 기존 루트가 있다면 정리
		this.cleanup();

		// 새 컨테이너 생성
		this.container = container;
		this.root = createRoot(container);
		this.root.render(component);
	}

	/**
	 * 컴포넌트 업데이트
	 */
	update(component: React.ReactElement) {
		if (this.root) {
			this.root.render(component);
		}
	}

	/**
	 * 정리
	 */
	cleanup() {
		try {
			if (this.root) {
				this.root.unmount();
				this.root = null;
			}
		} catch (error) {
			console.warn('Error during React cleanup:', error);
		} finally {
			if (this.container) {
				this.container = null;
			}
		}
	}

	/**
	 * 컨테이너가 연결되어 있는지 확인
	 */
	isConnected(): boolean {
		return this.container?.isConnected ?? false;
	}
}

/**
 * React 모달을 Obsidian 모달과 통합하는 래퍼 클래스
 */
export class ReactModalWrapper {
	private wrapper: ReactWrapper;
	private modalContainer: HTMLElement | null = null;
	private backdrop: HTMLElement | null = null;

	constructor() {
		this.wrapper = new ReactWrapper();
	}

	/**
	 * 모달 열기
	 */
	open(component: React.ReactElement) {
		// 기존 모달 정리
		this.close();

		// 모달 컨테이너 생성
		this.modalContainer = document.createElement('div');
		this.modalContainer.className = 'react-modal-container';
		this.modalContainer.style.cssText = `
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			z-index: 1000;
			display: flex;
			align-items: center;
			justify-content: center;
		`;

		// 백드롭 생성
		this.backdrop = document.createElement('div');
		this.backdrop.className = 'react-modal-backdrop';
		this.backdrop.style.cssText = `
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background: rgba(0, 0, 0, 0.5);
		`;

		// 모달 컨텐츠 컨테이너
		const contentContainer = document.createElement('div');
		contentContainer.className = 'react-modal-content';
		contentContainer.style.cssText = `
			position: relative;
			z-index: 1001;
			background: var(--background-primary);
			border: 1px solid var(--background-modifier-border);
			border-radius: 8px;
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
			max-width: 90vw;
			max-height: 90vh;
			overflow: auto;
			padding: 20px;
			width: auto;
		`;

		// DOM에 추가
		this.modalContainer.appendChild(this.backdrop);
		this.modalContainer.appendChild(contentContainer);
		document.body.appendChild(this.modalContainer);

		// React 컴포넌트 렌더링
		this.wrapper.render(component, contentContainer);

		// 백드롭 클릭으로 모달 닫기
		this.backdrop.addEventListener('click', () => {
			this.close();
		});

		// ESC 키로 모달 닫기
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				this.close();
			}
		};
		document.addEventListener('keydown', handleEscape);

		// 정리 함수 저장
		this.cleanup = () => {
			document.removeEventListener('keydown', handleEscape);
		};
	}

	/**
	 * 모달 닫기
	 */
	close() {
		if (this.modalContainer) {
			this.modalContainer.remove();
			this.modalContainer = null;
		}
		if (this.backdrop) {
			this.backdrop = null;
		}
		this.wrapper.cleanup();
		if (this.cleanup) {
			this.cleanup();
		}
	}

	private cleanup?: () => void;
}
