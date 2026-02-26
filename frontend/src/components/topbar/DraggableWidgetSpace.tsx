import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useWidgetStore } from '../../store/widgetStore';
import { ClockWidget } from './widgets/ClockWidget';
import { DateWidget } from './widgets/DateWidget';
import { NotesWidget } from './widgets/NotesWidget';
import { AlarmWidget } from './widgets/AlarmWidget';
import { CompanyLogoWidget } from './widgets/CompanyLogoWidget';
import { CompanyInfoWidget } from './widgets/CompanyInfoWidget';
import { UIModeWidget } from './widgets/UIModeWidget';

const WidgetMap: Record<string, React.FC> = {
  clock: ClockWidget,
  date: DateWidget,
  notes: NotesWidget,
  alarm: AlarmWidget,
  'company-logo': CompanyLogoWidget,
  'company-info': CompanyInfoWidget,
  'ui-mode': UIModeWidget,
};

const SortableItem = ({ id, type }: { id: string; type: string }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  const Component = WidgetMap[type];

  if (!Component) return null;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
      <Component />
    </div>
  );
};

export const DraggableWidgetSpace: React.FC = () => {
  const { widgets, setWidgets } = useWidgetStore();
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = widgets.findIndex((w) => w.id === active.id);
      const newIndex = widgets.findIndex((w) => w.id === over.id);
      
      setWidgets(arrayMove(widgets, oldIndex, newIndex));
    }
  };

  const visibleWidgets = widgets.filter(w => w.visible);

  if (visibleWidgets.length === 0) return <div className="flex-1" />;

  return (
    <div className="flex-1 flex items-center gap-3 px-6 overflow-hidden max-w-full">
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext 
          items={visibleWidgets.map(w => w.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex items-center gap-3 w-full scrollbar-hide overflow-x-auto pb-1 -mb-1">
            {visibleWidgets.map((widget) => (
              <SortableItem key={widget.id} id={widget.id} type={widget.type} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};
