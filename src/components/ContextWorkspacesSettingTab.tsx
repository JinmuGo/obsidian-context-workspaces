import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { type App, Notice } from 'obsidian';
import type React from 'react';
import { useEffect, useState } from 'react';
import type { ContextWorkspacesPlugin, SpaceConfig } from '../types';
import { isWorkspacesPluginEnabled } from '../utils/obsidian-utils';
import { DndProvider } from './DndProvider';
import { HelpModal } from './HelpModal';
import { SpaceEditModal } from './SpaceEditModal';

interface SpaceItemProps {
	spaceId: string;
	space: SpaceConfig;
	isActive: boolean;
	onToggleAutoSave: (spaceId: string) => void;
	onEditSpace: (spaceId: string) => void;
	onDeleteSpace: (spaceId: string) => void;
}

const SpaceItem: React.FC<SpaceItemProps> = ({
	spaceId,
	space,
	isActive,
	onToggleAutoSave,
	onEditSpace,
	onDeleteSpace,
}) => {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: spaceId,
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={`obsidian-context-workspaces-settings-item ${isActive ? 'active' : ''} ${isDragging ? 'obsidian-context-workspaces-dragging' : ''}`}
		>
			{/* Drag handle */}
			<div className="obsidian-context-workspaces-drag-handle" {...attributes} {...listeners}>
				⋮⋮
			</div>

			{/* Main row with title, current label, and auto-save */}
			<div className="obsidian-context-workspaces-item-main-row">
				{/* Left side: title and current label */}
				<div className="obsidian-context-workspaces-item-left">
					<div className="obsidian-context-workspaces-item-title-container">
						<span className="obsidian-context-workspaces-item-icon">
							{space.icon || '📄'}
						</span>
						<span className="obsidian-context-workspaces-item-name">{space.name}</span>
					</div>

					{isActive && (
						<span className="obsidian-context-workspaces-current-badge">CURRENT</span>
					)}
				</div>

				{/* Right side: auto-save toggle */}
				<div className="obsidian-context-workspaces-item-right">
					<div className="obsidian-context-workspaces-auto-save-container">
						<span>Auto-save</span>

						<div className="obsidian-context-workspaces-tooltip-container">
							<button
								type="button"
								className={`obsidian-context-workspaces-switch-toggle ${space.autoSave ? 'active' : ''}`}
								onClick={() => onToggleAutoSave(spaceId)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										onToggleAutoSave(spaceId);
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
				</div>
			</div>

			{/* Description and action buttons row */}
			<div className="obsidian-context-workspaces-item-description-row">
				{/* Description */}
				<div className="obsidian-context-workspaces-item-description">
					{space.description || 'No description'}
				</div>

				{/* Action buttons on the right */}
				<div className="obsidian-context-workspaces-action-buttons">
					{/* Edit button */}
					<button
						type="button"
						className="obsidian-context-workspaces-button obsidian-context-workspaces-cta obsidian-context-workspaces-action-btn"
						onClick={() => onEditSpace(spaceId)}
					>
						Edit
					</button>

					{/* Delete button */}
					<button
						type="button"
						className="obsidian-context-workspaces-button obsidian-context-workspaces-warning obsidian-context-workspaces-action-btn"
						onClick={() => onDeleteSpace(spaceId)}
					>
						Delete
					</button>
				</div>
			</div>
		</div>
	);
};

interface ContextWorkspacesSettingTabProps {
	app: unknown;
	plugin: ContextWorkspacesPlugin;
	containerEl: HTMLElement;
}

export const ContextWorkspacesSettingTab: React.FC<ContextWorkspacesSettingTabProps> = ({
	app,
	plugin,
}) => {
	const [spaces, setSpaces] = useState(plugin.settings.spaces);
	const [spaceOrder, setSpaceOrder] = useState(plugin.settings.spaceOrder);
	const [showHelp, setShowHelp] = useState(false);
	const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);

	// Update state when plugin settings change
	useEffect(() => {
		setSpaces(plugin.settings.spaces);
		setSpaceOrder(plugin.settings.spaceOrder);
	}, [plugin.settings]);

	// When Workspaces core plugin is disabled, show guidance UI instead of full settings
	if (!isWorkspacesPluginEnabled(plugin.app as App)) {
		return (
			<div className="obsidian-context-workspaces-settings">
				<h2>Context Workspaces Settings</h2>
				<div className="obsidian-context-workspaces-settings-disabled">
					<h3>Enable Obsidian Workspaces core plugin</h3>
					<p>
						Context Workspaces depends on Obsidian's Workspaces core plugin. Please enable
						it first by following the instructions below.
					</p>
					<ol>
						<li>Go to Settings → Core plugins</li>
						<li>Turn on the Workspaces switch</li>
						<li>Close settings and return to this page</li>
					</ol>
					<div className="obsidian-context-workspaces-setting-item-description">
						Once Workspaces is enabled, you can manage spaces from this settings page.
					</div>
				</div>
			</div>
		);
	}

	const handleDragEnd = (event: {
		active: { id: string | number };
		over: { id: string | number } | null;
	}) => {
		const { active, over } = event;

		if (over && active.id !== over.id) {
			const oldIndex = spaceOrder.indexOf(String(active.id));
			const newIndex = spaceOrder.indexOf(String(over.id));

			const newSpaceOrder = [...spaceOrder];
			const draggedItem = newSpaceOrder[oldIndex];
			newSpaceOrder.splice(oldIndex, 1);
			newSpaceOrder.splice(newIndex, 0, draggedItem);

			setSpaceOrder(newSpaceOrder);
			plugin.settings.spaceOrder = newSpaceOrder;
			plugin.saveSettings();
		}
	};

	const handleToggleAutoSave = async (spaceId: string) => {
		const updatedSpaces = { ...spaces };
		updatedSpaces[spaceId].autoSave = !updatedSpaces[spaceId].autoSave;

		plugin.settings.spaces = updatedSpaces;
		await plugin.saveSettings();
		setSpaces(updatedSpaces);

		plugin.updateSidebarSpacesOptimized();
	};

	const handleEditSpace = (spaceId: string) => {
		setEditingSpaceId(spaceId);
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

	const handleSpaceEditSave = () => {
		setEditingSpaceId(null);
		// Refresh spaces data
		setSpaces(plugin.settings.spaces);
		setSpaceOrder(plugin.settings.spaceOrder);
	};

	return (
		<DndProvider onDragEnd={handleDragEnd} items={spaceOrder}>
			<div className="obsidian-context-workspaces-settings">
				<h2>Context Workspaces Settings</h2>

				<div className="obsidian-context-workspaces-settings-header">
					<h3>Spaces List</h3>
					<button
						type="button"
						className="obsidian-context-workspaces-button obsidian-context-workspaces-cta"
						onClick={async () => {
							await plugin.createNewSpace();
							// Force update state after space creation
							setSpaces({ ...plugin.settings.spaces });
							setSpaceOrder([...plugin.settings.spaceOrder]);
						}}
					>
						New Space
					</button>
				</div>

				{/* Add explanation */}
				<div className="obsidian-context-workspaces-setting-item-description">
					Toggle auto-save for each space. When enabled, the space will automatically save
					and restore its layout when switching. When disabled, it acts like a static
					workspace template. Drag and drop spaces to reorder them.
				</div>

				<div className="obsidian-context-workspaces-settings-list">
					{spaceOrder.map((spaceId: string) => {
						const space = spaces[spaceId];
						if (!space) return null;

						return (
							<SpaceItem
								key={spaceId}
								spaceId={spaceId}
								space={space}
								isActive={spaceId === plugin.settings.currentSpaceId}
								onToggleAutoSave={handleToggleAutoSave}
								onEditSpace={handleEditSpace}
								onDeleteSpace={handleDeleteSpace}
							/>
						);
					})}
				</div>

				<h3>General Settings</h3>

				<div className="obsidian-context-workspaces-setting-item">
					<div className="obsidian-context-workspaces-setting-item-info">
						<div className="obsidian-context-workspaces-setting-item-name">Help</div>
						<div className="obsidian-context-workspaces-setting-item-description">
							Learn how to use Context Workspaces.
						</div>
					</div>
					<div className="obsidian-context-workspaces-setting-item-control">
						<button
							type="button"
							className="obsidian-context-workspaces-button obsidian-context-workspaces-cta"
							onClick={() => setShowHelp(true)}
						>
							View Help
						</button>
					</div>
				</div>

				{/* Modals */}
				<HelpModal app={app} isOpen={showHelp} onClose={() => setShowHelp(false)} />

				{editingSpaceId && (
					<SpaceEditModal
						app={app}
						plugin={plugin}
						spaceId={editingSpaceId}
						isOpen={true}
						onSave={handleSpaceEditSave}
						onClose={() => setEditingSpaceId(null)}
					/>
				)}
			</div>
		</DndProvider>
	);
};
