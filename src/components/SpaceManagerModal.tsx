import { Notice } from 'obsidian';
import type React from 'react';
import { useState } from 'react';
import type { ContextWorkspacesPlugin } from '../types';

interface SpaceManagerModalProps {
	app?: unknown;
	plugin: ContextWorkspacesPlugin;
	isOpen: boolean;
	onClose: () => void;
}

export const SpaceManagerModal: React.FC<SpaceManagerModalProps> = ({
	plugin,
	isOpen,
	onClose,
}) => {
	const [spaces, setSpaces] = useState(plugin.settings.spaces);
	const [spaceOrder, setSpaceOrder] = useState(plugin.settings.spaceOrder);

	const handleAutoSaveToggle = async (spaceId: string) => {
		const updatedSpaces = { ...spaces };
		updatedSpaces[spaceId].autoSave = !updatedSpaces[spaceId].autoSave;

		plugin.settings.spaces = updatedSpaces;
		await plugin.saveSettings();
		setSpaces(updatedSpaces);

		// Update sidebar
		plugin.updateSidebarSpacesOptimized();
	};

	const handleDeleteSpace = async (spaceId: string) => {
		const space = spaces[spaceId];
		
		// Check if this is the last remaining space
		const remainingSpaces = spaceOrder.filter((id) => id !== spaceId);
		if (remainingSpaces.length === 0) {
			new Notice('Cannot delete the last remaining space. At least one space must exist.');
			return;
		}
		
		if (confirm(`Are you sure you want to delete '${space.name}' space?`)) {
			await plugin.deleteSpace(spaceId);

			// Update local state
			const updatedSpaces = { ...spaces };
			delete updatedSpaces[spaceId];
			setSpaces(updatedSpaces);

			const updatedSpaceOrder = spaceOrder.filter((id: string) => id !== spaceId);
			setSpaceOrder(updatedSpaceOrder);
		}
	};

	if (!isOpen) return null;

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
			<div className="obsidian-context-workspaces-modal-content obsidian-context-workspaces-manager-modal">
				<div className="obsidian-context-workspaces-modal-body">
					<div className="obsidian-context-workspaces-space-list">
						{spaceOrder.map((spaceId: string) => {
							const space = spaces[spaceId];
							if (!space) return null;

							return (
								<div key={spaceId} className="obsidian-context-workspaces-space-item">
									<div className="obsidian-context-workspaces-space-info">
										<h3 data-icon={space.icon || '📄'}>{space.name}</h3>

										{/* Description */}
										{space.description && (
											<p className="obsidian-context-workspaces-space-description">
												{space.description}
											</p>
										)}

										{/* Auto-save info */}
										<p className="obsidian-context-workspaces-auto-save-info">
											Auto-save: {space.autoSave ? 'Enabled' : 'Disabled'}
										</p>

										{/* Theme info */}
										{(() => {
											const themeInfo = [];
											if (space.theme) {
												themeInfo.push(`Theme: ${space.theme}`);
											}
											if (space.themeMode && space.themeMode !== 'system') {
												themeInfo.push(`Mode: ${space.themeMode}`);
											}

											if (themeInfo.length > 0) {
												return (
													<p className="obsidian-context-workspaces-theme-info">
														{themeInfo.join(', ')}
													</p>
												);
											}
											return null;
										})()}
									</div>

									<div className="obsidian-context-workspaces-space-actions">
										{/* Auto-save toggle */}
										<div className="obsidian-context-workspaces-auto-save-container">
											<span>Auto-save</span>

											<div className="obsidian-context-workspaces-tooltip-container">
												<button
													type="button"
													className={`obsidian-context-workspaces-switch-toggle ${space.autoSave ? 'active' : ''}`}
													onClick={() => handleAutoSaveToggle(spaceId)}
													onKeyDown={(e) => {
														if (e.key === 'Enter' || e.key === ' ') {
															e.preventDefault();
															handleAutoSaveToggle(spaceId);
														}
													}}
													aria-label={`Toggle auto-save for ${space.name}`}
												/>

												<div className="obsidian-context-workspaces-tooltip">
													{space.autoSave
														? 'Auto-save enabled: Layout will be automatically saved and restored when switching spaces'
														: 'Auto-save disabled: Layout will not be saved automatically'}
												</div>
											</div>
										</div>

										{/* Delete button */}
										<button
											type="button"
											className="obsidian-context-workspaces-button obsidian-context-workspaces-warning"
											onClick={() => handleDeleteSpace(spaceId)}
										>
											Delete
										</button>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
};
