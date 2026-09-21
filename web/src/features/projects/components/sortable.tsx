import type { ReactNode } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
} from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { arrayMove } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';

export interface DragHandle {
  attributes: DraggableAttributes;
  listeners: SyntheticListenerMap | undefined;
  setActivatorNodeRef: (element: HTMLElement | null) => void;
  isDragging: boolean;
}

interface SortableItemProps {
  id: string;
  render: (handle: DragHandle) => ReactNode;
  className?: string;
}

function SortableItem({ id, render, className }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(className, isDragging && 'relative z-20')}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {render({ attributes, listeners, setActivatorNodeRef, isDragging })}
    </div>
  );
}

export interface SortableListProps {
  ids: string[];
  layout: 'grid' | 'list';
  disabled?: boolean;
  onReorder: (ids: string[]) => void;
  containerClassName?: string;
  itemClassName?: string;
  render: (id: string, handle: DragHandle) => ReactNode;
}

export function SortableList({
  ids,
  layout,
  disabled = false,
  onReorder,
  containerClassName,
  itemClassName,
  render,
}: SortableListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(ids, oldIndex, newIndex));
  };

  if (disabled) {
    return (
      <div className={containerClassName}>
        {ids.map((id) => (
          <div key={id} className={itemClassName}>
            {render(id, {
              attributes: {} as DraggableAttributes,
              listeners: undefined,
              setActivatorNodeRef: () => undefined,
              isDragging: false,
            })}
          </div>
        ))}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext
        items={ids}
        strategy={layout === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}
      >
        <div className={containerClassName}>
          {ids.map((id) => (
            <SortableItem
              key={id}
              id={id}
              className={itemClassName}
              render={(handle) => render(id, handle)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
