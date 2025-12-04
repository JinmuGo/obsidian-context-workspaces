import { type App, Modal } from 'obsidian';

export class ConfirmModal extends Modal {
	private message: string;
	private onConfirm: () => void;
	private onCancel?: () => void;

	constructor(app: App, message: string, onConfirm: () => void, onCancel?: () => void) {
		super(app);
		this.message = message;
		this.onConfirm = onConfirm;
		this.onCancel = onCancel;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Message
		contentEl.createDiv({ text: this.message, cls: 'obsidian-context-workspaces-confirm-message' });

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });

		const confirmButton = buttonContainer.createEl('button', { text: 'Yes', cls: 'mod-cta' });
		confirmButton.addEventListener('click', () => {
			this.close();
			this.onConfirm();
		});

		const cancelButton = buttonContainer.createEl('button', { text: 'No' });
		cancelButton.addEventListener('click', () => {
			this.close();
			if (this.onCancel) this.onCancel();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
