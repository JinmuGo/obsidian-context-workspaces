import type React from 'react';
import { createRoot, type Root } from 'react-dom/client';

/**
 * Wrapper class for rendering React components in Obsidian DOM
 */
export class ReactWrapper {
	private root: Root | null = null;
	private container: HTMLElement | null = null;

	/**
	 * Render React component to DOM
	 */
	render(component: React.ReactElement, container: HTMLElement) {
		// Clean up existing root if any
		this.cleanup();

		// Create new container
		this.container = container;
		this.root = createRoot(container);
		this.root.render(component);
	}

	/**
	 * Update component
	 */
	update(component: React.ReactElement) {
		if (this.root) {
			this.root.render(component);
		}
	}

	/**
	 * Cleanup
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
	 * Check if container is connected
	 */
	isConnected(): boolean {
		return this.container?.isConnected ?? false;
	}
}

/**
 * Wrapper class for integrating React modals with Obsidian modals
 */
export class ReactModalWrapper {
	private wrapper: ReactWrapper;
	private modalContainer: HTMLElement | null = null;
	private backdrop: HTMLElement | null = null;

	constructor() {
		this.wrapper = new ReactWrapper();
	}

	/**
	 * Open modal
	 */
	open(component: React.ReactElement) {
		// Clean up existing modal
		this.close();

		// Create modal container
		this.modalContainer = document.createElement('div');
		this.modalContainer.className = 'react-modal-container';

		// Create backdrop
		this.backdrop = document.createElement('div');
		this.backdrop.className = 'react-modal-backdrop';

		// Modal content container
		const contentContainer = document.createElement('div');
		contentContainer.className = 'react-modal-content';

		// Add to DOM
		this.modalContainer.appendChild(this.backdrop);
		this.modalContainer.appendChild(contentContainer);
		document.body.appendChild(this.modalContainer);

		// Render React component
		this.wrapper.render(component, contentContainer);

		// Close modal on backdrop click
		this.backdrop.addEventListener('click', () => {
			this.close();
		});

		// Close modal on ESC key
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				this.close();
			}
		};
		document.addEventListener('keydown', handleEscape);

		// Store cleanup function
		this.cleanup = () => {
			document.removeEventListener('keydown', handleEscape);
		};
	}

	/**
	 * Close modal
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
