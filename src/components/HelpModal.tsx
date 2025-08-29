import type React from 'react';

interface HelpModalProps {
	app?: unknown;
	isOpen: boolean;
	onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
	if (!isOpen) return null;

	return (
		<div className="obsidian-context-spaces-modal-container">
			<button
				type="button"
				className="obsidian-context-spaces-modal-backdrop"
				onClick={onClose}
				onKeyDown={(e) => {
					if (e.key === 'Escape') {
						onClose();
					}
				}}
				aria-label="Close modal"
			/>
			<div className="obsidian-context-spaces-modal-content obsidian-context-spaces-help-modal">
				<div className="obsidian-context-spaces-modal-body">
					<div className="obsidian-context-spaces-help-content">
						<h3>Basic Usage</h3>
						<p>• Click on space icons in the sidebar to switch between spaces</p>
						<p>
							• Use "Next Space" and "Previous Space" commands from the command
							palette
						</p>
						<p>• Use "Create New Space" command to create new workspaces</p>

						<h3>Space Modes</h3>
						<p>
							• Auto-save Mode (🔄): Automatically saves and restores state when
							switching spaces
						</p>
						<p>
							• Snapshot Mode: Default Workspace behavior, manual save/load required
						</p>

						<h3>Keyboard Shortcuts</h3>
						<p>
							Go to Settings {'>'} Hotkeys to assign keyboard shortcuts for "Next
							Space" and "Previous Space" commands.
						</p>
					</div>
				</div>
			</div>
		</div>
	);
};
