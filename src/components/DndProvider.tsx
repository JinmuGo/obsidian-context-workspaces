import type { DragEndEvent } from '@dnd-kit/core';
import { closestCenter, DndContext } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type React from 'react';

interface DndProviderProps {
	children: React.ReactNode;
	onDragEnd?: (event: DragEndEvent) => void;
	items?: string[];
}

export const DndProvider: React.FC<DndProviderProps> = ({ children, onDragEnd, items = [] }) => {
	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;

		if (active.id !== over?.id) {
			onDragEnd?.(event);
		}
	};

	return (
		<DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
			<SortableContext items={items} strategy={verticalListSortingStrategy}>
				{children}
			</SortableContext>
		</DndContext>
	);
};
