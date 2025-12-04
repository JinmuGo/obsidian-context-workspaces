import { type App, Modal, Notice } from 'obsidian';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import type { EmojiData, ThemeMode } from '../types';
import { getAvailableThemes, getCurrentTheme, getCurrentThemeModeForUI } from '../utils/obsidian-utils';
import { EmojiPicker } from './EmojiPicker';

interface SpaceCreateModalProps {
	app: unknown;
	onSubmit: (data: string | null) => void;
}

export class SpaceCreateModal extends Modal {
	private onSubmit: SpaceCreateModalProps['onSubmit'];
	private nameInput: HTMLInputElement;
	private iconButton: HTMLButtonElement;
	private descriptionTextarea: HTMLTextAreaElement;
	private emojiPickerContainer: HTMLDivElement | null;
	private name: string = '';
	private icon: string = '✨';
	private description: string = '';
	private showEmojiPicker: boolean = false;
	private theme: string = '';
	private themeMode: ThemeMode = 'system';
	private themeSelectEl: HTMLSelectElement | null = null;
	private themeModeSelectEl: HTMLSelectElement | null = null;

	constructor(app: unknown, onSubmit: SpaceCreateModalProps['onSubmit']) {
		super(app as App);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Use Obsidian's default modal structure
		contentEl.addClass('obsidian-context-workspaces-space-create-modal');

		// Set modal header
		this.titleEl.setText('Create new space');

		// Modal content area
		const modalContent = contentEl.createDiv('obsidian-context-workspaces-modal-content');

		// Icon and name input area
		const inputSection = modalContent.createDiv('obsidian-context-workspaces-input-section');

		// Icon selection area
		const iconSection = inputSection.createDiv('obsidian-context-workspaces-icon-section');
		iconSection.createEl('label', { text: 'Emoji' });
		this.iconButton = iconSection.createEl('button', {
			cls: 'obsidian-context-workspaces-icon-picker-button',
			text: this.icon,
		});
		this.iconButton.addEventListener('click', () => this.handleShowEmojiPicker());

		// Emoji picker container - will be created dynamically when needed
		this.emojiPickerContainer = null;

		// Name input area
		const nameSection = inputSection.createDiv('obsidian-context-workspaces-name-section');
		nameSection.createEl('label', { text: 'Space name' });
		this.nameInput = nameSection.createEl('input', {
			type: 'text',
			placeholder: 'e.g. Project Alpha, Research Notes',
		});

		// Additional attributes for input handling
		this.nameInput.setAttribute('lang', 'en');
		this.nameInput.setAttribute('inputmode', 'text');
		this.nameInput.setAttribute('autocomplete', 'off');
		this.nameInput.setAttribute('spellcheck', 'false');

		this.nameInput.value = this.name;

		// Event listeners
		this.nameInput.addEventListener('input', (e) => {
			const target = e.target as HTMLInputElement;
			this.name = target.value;
		});

		this.nameInput.addEventListener('compositionstart', (_e) => {
			// Handle composition events
		});

		this.nameInput.addEventListener('compositionend', (e) => {
			const target = e.target as HTMLInputElement;
			this.name = target.value;
		});

		this.nameInput.addEventListener('keydown', (e) => this.handleKeyDown(e));

		// Theme selection area
		const themeSection = modalContent.createDiv('obsidian-context-workspaces-theme-section');
		themeSection.createEl('label', { text: 'Theme (optional)' });
		this.themeSelectEl = themeSection.createEl('select');
		const emptyOption = this.themeSelectEl.createEl('option', { text: 'Use Obsidian theme' });
		emptyOption.value = '';
		const themes = getAvailableThemes(this.app);
		themes.forEach((themeName) => {
			const opt = this.themeSelectEl?.createEl('option', { text: themeName });
			if (opt) {
				opt.value = themeName;
			}
		});
		this.themeSelectEl.addEventListener('change', (e) => {
			const target = e.target as HTMLSelectElement;
			this.theme = target.value;
		});

		// Theme mode selection area
		const themeModeSection = modalContent.createDiv(
			'obsidian-context-workspaces-theme-mode-section'
		);
		themeModeSection.createEl('label', { text: 'Theme mode' });
		this.themeModeSelectEl = themeModeSection.createEl('select');
		const lightOpt = this.themeModeSelectEl.createEl('option', { text: 'Light' });
		lightOpt.value = 'light';
		const darkOpt = this.themeModeSelectEl.createEl('option', { text: 'Dark' });
		darkOpt.value = 'dark';
		const systemOpt = this.themeModeSelectEl.createEl('option', { text: 'System' });
		systemOpt.value = 'system';
		this.themeModeSelectEl.value = this.themeMode;
		this.themeModeSelectEl.addEventListener('change', (e) => {
			const target = e.target as HTMLSelectElement;
			this.themeMode = target.value as ThemeMode;
		});

		// Description input area (moved after theme and mode)
		const descriptionSection = modalContent.createDiv(
			'obsidian-context-workspaces-description-section'
		);
		descriptionSection.createEl('label', {
			text: 'Description (optional)',
		});
		this.descriptionTextarea = descriptionSection.createEl('textarea', {
			placeholder: 'Enter a description for this space...',
		});

		// Additional attributes for textarea
		this.descriptionTextarea.setAttribute('lang', 'en');
		this.descriptionTextarea.setAttribute('spellcheck', 'false');

		this.descriptionTextarea.rows = 3;
		this.descriptionTextarea.value = this.description;
		this.descriptionTextarea.addEventListener('input', (e) => {
			const target = e.target as HTMLTextAreaElement;
			this.description = target.value;
		});

		// Focus on name input
		setTimeout(() => {
			this.nameInput.focus();
		}, 100);

		// Click outside emoji picker to close
		document.addEventListener('mousedown', this.handleClickOutside);

		// Obsidian default modal button setup - manually added
		const buttonContainer = contentEl.createDiv(
			'obsidian-context-workspaces-modal-button-container'
		);

		const cancelButton = buttonContainer.createEl('button', {
			text: 'Cancel',
			cls: 'mod-warning',
		});
		cancelButton.addEventListener('click', () => this.close());

		const createButton = buttonContainer.createEl('button', {
			text: 'Create',
			cls: 'mod-cta',
		});
		createButton.addEventListener('click', () => this.handleSubmit());
	}

	onClose() {
		document.removeEventListener('mousedown', this.handleClickOutside);
		if (this.emojiPickerContainer) {
			this.emojiPickerContainer.remove();
			this.emojiPickerContainer = null;
		}
	}

	private handleSubmit() {
		const trimmedName = this.name.trim();
		const trimmedIcon = this.icon.trim();

		if (trimmedName && trimmedIcon) {
			// Handle "Use Obsidian theme" option
			let themeToSave: string | undefined;
			if (this.theme === '' || !this.theme.trim()) {
				// "Use Obsidian theme" selected - save current Obsidian theme
				themeToSave = getCurrentTheme(this.app);
			} else {
				// Specific theme selected
				themeToSave = this.theme.trim() || undefined;
			}

			const submitData = {
				name: trimmedName,
				icon: trimmedIcon,
				description: this.description.trim(),
				theme: themeToSave,
				themeMode: this.themeMode,
			};

			this.onSubmit(JSON.stringify(submitData));
			this.close();
		} else {
			new Notice('Please enter both space name and icon.');
		}
	}

	private handleKeyDown(evt: KeyboardEvent) {
		if (evt.key === 'Enter') {
			this.handleSubmit();
		} else if (evt.key === 'Escape') {
			this.close();
		}
	}

	private handleShowEmojiPicker() {
		if (this.showEmojiPicker) {
			// Close emoji picker
			this.showEmojiPicker = false;
			if (this.emojiPickerContainer) {
				this.emojiPickerContainer.remove();
				this.emojiPickerContainer = null;
			}
		} else {
			// Open emoji picker
			this.showEmojiPicker = true;

			// Create emoji picker container dynamically
			const iconContainer = this.iconButton.parentElement;
			if (iconContainer) {
				this.emojiPickerContainer = iconContainer.createDiv(
					'obsidian-context-workspaces-emoji-picker-popup'
				);

				// Create React component for emoji picker
				const root = createRoot(this.emojiPickerContainer);
				root.render(
					React.createElement(EmojiPicker, {
						theme: getCurrentThemeModeForUI(),
						onEmojiSelect: (emoji: EmojiData) => {
							this.icon = emoji.native;
							this.iconButton.textContent = emoji.native;
							this.showEmojiPicker = false;
							if (this.emojiPickerContainer) {
								this.emojiPickerContainer.remove();
								this.emojiPickerContainer = null;
							}
							root.unmount();
						},
					})
				);
			}
		}
	}

	private handleClickOutside = (event: MouseEvent) => {
		if (
			this.emojiPickerContainer &&
			!this.emojiPickerContainer.contains(event.target as Node)
		) {
			this.showEmojiPicker = false;
			this.emojiPickerContainer.remove();
			this.emojiPickerContainer = null;
		}
	};
}
