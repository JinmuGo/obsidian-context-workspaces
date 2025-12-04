import { type App, Notice } from 'obsidian';
import type React from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import type { ContextWorkspacesPlugin, EmojiData, ThemeMode } from '../types';
import {
	applySpaceTheme,
	getAvailableThemes,
	getCurrentTheme,
	getCurrentThemeModeForUI,
} from '../utils/obsidian-utils';
import { EmojiPicker } from './EmojiPicker';

interface SpaceEditModalProps {
	app: unknown;
	plugin: ContextWorkspacesPlugin;
	spaceId: string;
	isOpen: boolean;
	onSave?: () => void;
	onClose: () => void;
}

export const SpaceEditModal: React.FC<SpaceEditModalProps> = ({
	app,
	plugin,
	spaceId,
	isOpen,
	onSave,
	onClose,
}) => {
	const space = plugin.settings.spaces[spaceId];
	const emojiPickerId = useId();
	const spaceNameId = useId();
	const themeSelectId = useId();
	const themeModeSelectId = useId();
	const spaceDescriptionId = useId();
	const [name, setName] = useState(space?.name || '');
	const [icon, setIcon] = useState(space?.icon || '📄');
	const [description, setDescription] = useState(space?.description || '');
	const [theme, setTheme] = useState(space?.theme || '');
	const [themeMode, setThemeMode] = useState<ThemeMode>(
		space?.themeMode || 'system'
	);
	const [showEmojiPicker, setShowEmojiPicker] = useState(false);
	const [availableThemes, setAvailableThemes] = useState<string[]>([]);
	const nameInputRef = useRef<HTMLInputElement>(null);
	const emojiPickerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (isOpen) {
			setName(space?.name || '');
			setIcon(space?.icon || '📄');
			setDescription(space?.description || '');
			
			// Handle theme initialization for "Use Obsidian theme" option
			const currentObsidianTheme = getCurrentTheme(app as App);
			const savedTheme = space?.theme;
			
			// If saved theme is the same as current Obsidian theme, show "Use Obsidian theme" option
			if (savedTheme === currentObsidianTheme) {
				setTheme('');
			} else {
				setTheme(savedTheme || '');
			}
			
			setThemeMode(space?.themeMode || 'system');
			setAvailableThemes(getAvailableThemes(app as App));

			if (nameInputRef.current) {
				nameInputRef.current.focus();
			}
		}
	}, [isOpen, space, app]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
				setShowEmojiPicker(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	const handleSave = async () => {
		const trimmedName = name.trim();
		const trimmedIcon = icon.trim();

		if (!trimmedName) {
			new Notice('Please enter a space name.');
			return;
		}

		if (!trimmedIcon) {
			new Notice('Please select a space icon.');
			return;
		}

		const updatedSpace = plugin.settings.spaces[spaceId];
		if (updatedSpace) {
			const isCurrentSpace = spaceId === plugin.settings.currentSpaceId;
			const oldName = updatedSpace.name;

			// Handle "Use Obsidian theme" option
			let themeToSave: string | undefined;
			if (theme === '' || !theme.trim()) {
				// "Use Obsidian theme" selected - save current Obsidian theme
				themeToSave = getCurrentTheme(app as App);
			} else {
				// Specific theme selected
				themeToSave = theme.trim() || undefined;
			}

			updatedSpace.name = trimmedName;
			updatedSpace.icon = trimmedIcon;
			updatedSpace.theme = themeToSave;
			updatedSpace.themeMode = themeMode;
			updatedSpace.description = description.trim() || undefined;

			await plugin.saveSettings();
			void plugin.updateSidebarSpacesOptimized();

			// Sync name change with Obsidian's internal workspace API
			if (oldName !== trimmedName) {
				try {
					await plugin.syncSpaceNameWithObsidian(spaceId, trimmedName);
				} catch (error) {
					console.error('Failed to sync space name with Obsidian workspace:', error);
					new Notice('Space updated but failed to sync with Obsidian workspace.');
				}
			}

			// If this is the current space, apply theme changes immediately
			if (isCurrentSpace && (updatedSpace.theme || updatedSpace.themeMode)) {
				try {
					await applySpaceTheme(
						plugin.app as App,
						updatedSpace.theme,
						updatedSpace.themeMode
					);
					
					// Force CSS refresh and UI update
					setTimeout(() => {
						// Trigger CSS change event
						const workspace = (plugin.app as App).workspace as { trigger?: (event: string) => void };
						if (workspace.trigger) {
							workspace.trigger('css-change');
						}

						// Force Obsidian to refresh the theme
						const event = new CustomEvent('theme-change', { detail: { theme: updatedSpace.theme, mode: updatedSpace.themeMode } });
						document.dispatchEvent(event);
					}, 100);
				} catch (error) {
					console.error('Failed to apply theme changes:', error);
					new Notice('Failed to apply theme changes');
				}
			}

			new Notice('Space updated successfully and synced with Obsidian workspace.');

			if (onSave) {
				onSave();
			}
		}

		onClose();
	};

	const handleKeyDown = (evt: React.KeyboardEvent) => {
		if (evt.key === 'Enter') {
			handleSave();
		} else if (evt.key === 'Escape') {
			onClose();
		}
	};

	const handleShowEmojiPicker = () => {
		setShowEmojiPicker(true);
	};

	if (!isOpen || !space) return null;

	return (
		<div className="obsidian-context-workspaces-modal-container">
			<button
				type="button"
				className="obsidian-context-workspaces-modal-backdrop"
				onClick={onClose}
				onKeyDown={(e) => {
					if (e.key === 'Escape') {
						onClose();
					}
				}}
				aria-label="Close modal"
			/>
			<div className="obsidian-context-workspaces-modal-content obsidian-context-workspaces-edit-modal">
				<div className="obsidian-context-workspaces-modal-body">
					{/* Space name and icon in one row */}
					<div className="obsidian-context-workspaces-name-icon-container">
						{/* Icon button */}
						<div className="obsidian-context-workspaces-icon-container">
							<label htmlFor={emojiPickerId}>Emoji:</label>
							<button
								id={emojiPickerId}
								type="button"
								className="obsidian-context-workspaces-icon-picker-button"
								onClick={handleShowEmojiPicker}
							>
								{icon}
							</button>
							{showEmojiPicker && (
								<div
									ref={emojiPickerRef}
									className="obsidian-context-workspaces-emoji-picker-popup"
								>
									<EmojiPicker
										theme={getCurrentThemeModeForUI()}
										onEmojiSelect={(emoji: EmojiData) => {
											setIcon(emoji.native);
											setShowEmojiPicker(false);
										}}
									/>
								</div>
							)}
						</div>

						{/* Space name input */}
						<div className="obsidian-context-workspaces-name-container">
							<label htmlFor={spaceNameId}>Space name:</label>
							<input
								id={spaceNameId}
								ref={nameInputRef}
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								onKeyDown={handleKeyDown}
							/>
						</div>
					</div>

					{/* Theme selection */}
					<div>
						<label htmlFor={themeSelectId}>Theme (optional):</label>
						<select
							id={themeSelectId}
							value={theme}
							onChange={(e) => setTheme(e.target.value)}
						>
							<option value="">Use Obsidian theme</option>
							{availableThemes.map((themeName) => (
								<option key={themeName} value={themeName}>
									{themeName}
								</option>
							))}
						</select>
					</div>

					{/* Theme mode selection */}
					<div>
						<label htmlFor={themeModeSelectId}>Theme mode:</label>
						<select
							id={themeModeSelectId}
							value={themeMode}
							onChange={(e) =>
								setThemeMode(e.target.value as ThemeMode)
							}
						>
							<option value="light">Light</option>
							<option value="dark">Dark</option>
							<option value="system">System</option>
						</select>
					</div>

					{/* Description input */}
					<div>
						<label htmlFor={spaceDescriptionId}>Description (optional):</label>
						<textarea
							id={spaceDescriptionId}
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Enter a description for this space..."
							rows={3}
						/>
					</div>
				</div>

				<div className="obsidian-context-workspaces-modal-footer">
					<div className="obsidian-context-workspaces-modal-button-container">
						<button type="button" onClick={onClose}>
							Cancel
						</button>
						<button
							type="button"
							className="obsidian-context-workspaces-button obsidian-context-workspaces-cta"
							onClick={() => {
								void handleSave();
							}}
						>
							Save
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default SpaceEditModal;
