import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Notice } from 'obsidian';
import type React from 'react';
import { Component, type ReactNode, useEffect, useRef, useState } from 'react';
import type { ContextWorkspacesPlugin, SpaceConfig } from '../types';
import { DndProvider } from './DndProvider';

// Error Boundary Component
class ErrorBoundary extends Component<
	{ children: ReactNode; fallback?: ReactNode },
	{ hasError: boolean }
> {
	constructor(props: { children: ReactNode; fallback?: ReactNode }) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError(_error: Error) {
		return { hasError: true };
	}

	componentDidCatch(error: Error, errorInfo: unknown) {
		console.error('SidebarManager Error Boundary caught an error:', error, errorInfo);
	}

	render() {
		if (this.state.hasError) {
			return (
				this.props.fallback || (
					<div className="obsidian-context-workspaces-error">
						<p>Something went wrong with the sidebar.</p>
						<button type="button" onClick={() => this.setState({ hasError: false })}>
							Try again
						</button>
					</div>
				)
			);
		}

		return this.props.children;
	}
}

interface SpaceItemProps {
	spaceId: string;
	space: SpaceConfig;
	isActive: boolean;
	isCenter?: boolean;
	onSwitchSpace: (spaceId: string) => void;
}

const SpaceItem: React.FC<SpaceItemProps> = ({
	spaceId,
	space,
	isActive,
	isCenter = false,
	onSwitchSpace,
}) => {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: spaceId,
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	// Handle double click for space switching (alternative to drag)
	const handleDoubleClick = () => {
		// Prevent double click if dragging
		if (isDragging) {
			return;
		}

		// Switch to the space
		onSwitchSpace(spaceId);
	};

	return (
		<button
			ref={setNodeRef}
			style={style}
			className={`obsidian-context-workspaces-item ${isActive ? 'active' : ''} ${isCenter ? 'center' : ''} ${isDragging ? 'obsidian-context-workspaces-dragging' : ''}`}
			onDoubleClick={handleDoubleClick}
			title={`${space.name} (Double-click to switch, Drag to reorder)`}
			type="button"
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					onSwitchSpace(spaceId);
				}
			}}
			{...attributes}
		>
			{/* Space icon with DnD listeners */}
			<div className="obsidian-context-workspaces-icon" {...listeners}>
				{space.icon || '📄'}
			</div>

			{/* Auto-save indicator */}
			{space.autoSave && <div className="obsidian-context-workspaces-auto-save">•</div>}
		</button>
	);
};

interface SidebarManagerProps {
	plugin: ContextWorkspacesPlugin;
}

export const SidebarManager: React.FC<SidebarManagerProps> = ({ plugin }) => {
	const [spaces, setSpaces] = useState(plugin.settings.spaces);
	const [spaceOrder, setSpaceOrder] = useState(plugin.settings.spaceOrder);
	const [currentSpaceId, setCurrentSpaceId] = useState(plugin.settings.currentSpaceId);
	const [animationDirection, setAnimationDirection] = useState<'left' | 'right' | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const isMountedRef = useRef(true);
	const previousSpaceIdRef = useRef<string>(plugin.settings.currentSpaceId);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	// Update state when plugin settings change
	useEffect(() => {
		const updateState = () => {
			// Check if component is still mounted
			if (!isMountedRef.current) return;

			try {
				// Only update if values have actually changed
				if (JSON.stringify(plugin.settings.spaces) !== JSON.stringify(spaces)) {
					setSpaces(plugin.settings.spaces);
				}
				if (JSON.stringify(plugin.settings.spaceOrder) !== JSON.stringify(spaceOrder)) {
					setSpaceOrder(plugin.settings.spaceOrder);
				}
				if (plugin.settings.currentSpaceId !== currentSpaceId) {
					// Determine animation direction
					const currentIndex = plugin.settings.spaceOrder.indexOf(
						plugin.settings.currentSpaceId
					);
					const previousIndex = plugin.settings.spaceOrder.indexOf(
						previousSpaceIdRef.current
					);

					if (currentIndex !== -1 && previousIndex !== -1 && spaceOrder.length >= 5) {
						const direction = currentIndex > previousIndex ? 'right' : 'left';
						setAnimationDirection(direction);

						// Clear animation after animation completes
						setTimeout(() => {
							setAnimationDirection(null);
						}, 300);
					}

					setCurrentSpaceId(plugin.settings.currentSpaceId);
					previousSpaceIdRef.current = plugin.settings.currentSpaceId;
				}
			} catch (error) {
				console.warn('Error updating sidebar state:', error);
			}
		};

		// Initial update
		updateState();

		// Use a more efficient update mechanism
		const interval = setInterval(updateState, 500);
		return () => {
			clearInterval(interval);
		};
	}, [plugin, spaces, spaceOrder, currentSpaceId]); // Include dependencies to ensure proper updates

	const handleDragEnd = (event: {
		active: { id: string | number };
		over: { id: string | number } | null;
	}) => {
		// Check if component is still mounted
		if (!isMountedRef.current) return;

		const { active, over } = event;

		if (over && active.id !== over.id) {
			const oldIndex = spaceOrder.indexOf(String(active.id));
			const newIndex = spaceOrder.indexOf(String(over.id));

			// Only update if the position actually changed
			if (oldIndex !== newIndex) {
				const newSpaceOrder = [...spaceOrder];
				const draggedItem = newSpaceOrder[oldIndex];
				newSpaceOrder.splice(oldIndex, 1);
				newSpaceOrder.splice(newIndex, 0, draggedItem);

				// Update local state
				setSpaceOrder(newSpaceOrder);

				// Update plugin settings
				plugin.settings.spaceOrder = newSpaceOrder;
				void plugin.saveSettings();

				// Notify plugin about the order change
				if (plugin.onSpaceOrderChanged) {
					plugin.onSpaceOrderChanged(newSpaceOrder);
				}
			}
		}
	};

	const handleSwitchSpace = (spaceId: string) => {
		// Check if component is still mounted
		if (!isMountedRef.current) return;

		// Call plugin method to switch space
		void plugin.switchToSpace(spaceId);

		// Scroll to center the active space if using centered layout
		if (shouldUseCenteredLayout) {
			setTimeout(() => {
				const carousel = containerRef.current?.querySelector(
					'.obsidian-context-workspaces-carousel'
				) as HTMLElement;
				const activeItem = carousel?.querySelector(
					'.obsidian-context-workspaces-item.active'
				) as HTMLElement;
				if (carousel && activeItem) {
					const carouselRect = carousel.getBoundingClientRect();
					const itemRect = activeItem.getBoundingClientRect();
					const scrollLeft =
						activeItem.offsetLeft - carouselRect.width / 2 + itemRect.width / 2;
					carousel.scrollTo({
						left: scrollLeft,
						behavior: 'smooth',
					});
				}
			}, 100);
		}
	};



	const handlePreviousSpace = () => {
		if (!isMountedRef.current) return;
		// Find current space index and switch to previous
		const currentIndex = spaceOrder.indexOf(currentSpaceId);
		if (currentIndex > 0) {
			const previousSpaceId = spaceOrder[currentIndex - 1];
			void plugin.switchToSpace(previousSpaceId);
		}
	};

	const handleNextSpace = () => {
		if (!isMountedRef.current) return;
		// Find current space index and switch to next
		const currentIndex = spaceOrder.indexOf(currentSpaceId);
		if (currentIndex < spaceOrder.length - 1) {
			const nextSpaceId = spaceOrder[currentIndex + 1];
			void plugin.switchToSpace(nextSpaceId);
		}
	};

	const handleCreateNewSpace = () => {
		if (!isMountedRef.current) return;
		void plugin.createNewSpace();
	};

	// Check if we should use centered layout (5 or more spaces)
	const shouldUseCenteredLayout = spaceOrder.length >= 5;

	// Always enable navigation buttons since we have cycle functionality
	const canGoPrevious = spaceOrder.length > 1;
	const canGoNext = spaceOrder.length > 1;

	// Calculate visible spaces for grid carousel
	const getVisibleSpaces = () => {
		if (!shouldUseCenteredLayout) return spaceOrder;

		const currentIndex = spaceOrder.indexOf(currentSpaceId);
		const totalSpaces = spaceOrder.length;
		const visibleCount = 5; // Show 5 spaces at a time
		const halfVisible = Math.floor(visibleCount / 2);

		let startIndex = currentIndex - halfVisible;
		let endIndex = currentIndex + halfVisible;

		// Handle edge cases for loop
		if (startIndex < 0) {
			startIndex = totalSpaces + startIndex;
		}
		if (endIndex >= totalSpaces) {
			endIndex = endIndex - totalSpaces;
		}

		const visibleSpaces = [];
		for (let i = 0; i < visibleCount; i++) {
			const index = (startIndex + i) % totalSpaces;
			visibleSpaces.push(spaceOrder[index]);
		}

		return visibleSpaces;
	};

	return (
		<ErrorBoundary>
			<DndProvider onDragEnd={handleDragEnd} items={spaceOrder}>
				<div ref={containerRef} className="obsidian-context-workspaces-sidebar">
					{/* Header */}
					<div className="obsidian-context-workspaces-header">
						<h4 className="obsidian-context-workspaces-title">Context Workspaces</h4>

						{/* Help button */}
						<button
							type="button"
							className="obsidian-context-workspaces-help-btn"
							onClick={() => {
								new Notice(
									'💡 tip: double-click to switch spaces, drag to reorder',
									3000
								);
							}}
							title="Show interaction tips"
						>
							?
						</button>

						{/* Add new space button */}
						<button
							type="button"
							className="obsidian-context-workspaces-add-btn"
							onClick={handleCreateNewSpace}
						>
							+
						</button>
					</div>

					{/* Carousel container */}
					<div
						className={`obsidian-context-workspaces-carousel-container ${shouldUseCenteredLayout ? 'centered-layout grid-carousel' : ''} ${animationDirection ? `animate-${animationDirection}` : ''}`}
					>
						{/* Left navigation button */}
						<button
							type="button"
							className={`obsidian-context-workspaces-nav-btn left ${!canGoPrevious ? 'disabled' : ''}`}
							onClick={handlePreviousSpace}
							disabled={!canGoPrevious}
						>
							‹
						</button>

						{/* Spaces list (grid carousel container) */}
						<div className="obsidian-context-workspaces-carousel">
							{getVisibleSpaces().map((spaceId: string, index: number) => {
								const space = spaces[spaceId];
								if (!space) return null;

								const isActive = spaceId === currentSpaceId;
								const isCenter = shouldUseCenteredLayout && index === 2; // Center position

								return (
									<SpaceItem
										key={spaceId}
										spaceId={spaceId}
										space={space}
										isActive={isActive}
										isCenter={isCenter}
										onSwitchSpace={handleSwitchSpace}
									/>
								);
							})}
						</div>

						{/* Right navigation button */}
						<button
							type="button"
							className={`obsidian-context-workspaces-nav-btn right ${!canGoNext ? 'disabled' : ''}`}
							onClick={handleNextSpace}
							disabled={!canGoNext}
						>
							›
						</button>
					</div>
				</div>
			</DndProvider>
		</ErrorBoundary>
	);
};
