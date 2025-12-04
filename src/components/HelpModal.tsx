import type React from 'react';

interface HelpModalProps {
	app?: unknown;
	isOpen: boolean;
	onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
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
			<div className="obsidian-context-workspaces-modal-content obsidian-context-workspaces-help-modal">
				<div className="obsidian-context-workspaces-modal-body">
					<div className="obsidian-context-workspaces-help-content">
						<h3>Basic usage</h3>
						<p>• Click on space icons in the sidebar to switch between spaces</p>
						<p>
							• Use "Next space" and "Previous space" commands from the command
							palette
						</p>
						<p>• Use "Create new space" command to create new workspaces</p>

						<h3>Space modes</h3>
						<p>
							• Auto-save mode (🔄): Automatically saves and restores state when
							switching spaces
						</p>
						<p>
							• Snapshot mode: Default Workspace behavior, manual save/load required
						</p>

						<h3>Keyboard shortcuts</h3>
						<p>
							Go to Settings {'>'} Hotkeys to assign keyboard shortcuts for "Next
							space" and "Previous space" commands.
						</p>
					</div>
				</div>
			</div>
		</div>
	);
};
