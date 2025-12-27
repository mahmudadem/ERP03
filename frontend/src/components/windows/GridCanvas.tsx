import React, { useRef } from 'react';
import { GripVertical, Trash2 } from 'lucide-react';
import { WindowComponent } from '../../types/WindowConfig';

interface GridCanvasProps {
  components: WindowComponent[];
  sectionName: string;
  selectedComponentId: string | null;
  onSelect: (id: string | null) => void;
  onUpdateComponent: (component: WindowComponent) => void;
  onDeleteComponent: (id: string) => void;
  onDropComponent: (e: React.DragEvent, row: number, col: number) => void;
}

export const GridCanvas: React.FC<GridCanvasProps> = ({
  components,
  sectionName,
  selectedComponentId,
  onSelect,
  onUpdateComponent,
  onDeleteComponent,
  onDropComponent,
}) => {
  const resizingRef = useRef<{ 
    fieldId: string; 
    startX: number; 
    startSpan: number; 
    containerWidth: number 
  } | null>(null);

  const maxRow = components.reduce((max, f) => Math.max(max, f.row), 0) + 1;
  const gridRows = Math.max(4, maxRow + 1);

  // Resize Handlers
  const startResize = (e: React.MouseEvent, component: WindowComponent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const container = (e.target as HTMLElement).closest('.grid-container') as HTMLElement;
    if (!container) return;

    resizingRef.current = {
      fieldId: component.id,
      startX: e.clientX,
      startSpan: component.colSpan,
      containerWidth: container.offsetWidth
    };
    
    window.addEventListener('mousemove', onResizeMove);
    window.addEventListener('mouseup', onResizeEnd);
  };

  const onResizeMove = (e: MouseEvent) => {
    if (!resizingRef.current) return;
    const { fieldId, startX, startSpan, containerWidth } = resizingRef.current;
    
    const colWidth = containerWidth / 12;
    const deltaX = e.clientX - startX;
    const deltaCols = Math.round(deltaX / colWidth);
    
    const newSpan = Math.max(1, Math.min(12, startSpan + deltaCols));
    
    const component = components.find(c => c.id === fieldId);
    if (component && component.colSpan !== newSpan) {
      if (component.col + newSpan <= 12) {
        onUpdateComponent({ ...component, colSpan: newSpan });
      }
    }
  };

  const onResizeEnd = () => {
    resizingRef.current = null;
    window.removeEventListener('mousemove', onResizeMove);
    window.removeEventListener('mouseup', onResizeEnd);
  };

  const handleDragStart = (e: React.DragEvent, component: WindowComponent) => {
    e.dataTransfer.setData('fieldId', component.id);
    e.dataTransfer.setData('sourceSection', sectionName.toLowerCase());
    e.dataTransfer.setData('type', 'existing_component');
    onSelect(component.id);
  };

  return (
    <div 
      className="mb-6 border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm transition-all relative group"
      onDragOver={(e) => e.preventDefault()}
    >
      {/* Section Header */}
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <GripVertical size={14} className="text-gray-400" />
          <span className="text-xs font-bold text-gray-500 uppercase">{sectionName} SECTION</span>
        </div>
      </div>

      {/* Grid Canvas */}
      <div 
        className="p-4 grid grid-cols-12 gap-2 relative min-h-[150px] grid-container"
        style={{ gridTemplateRows: `repeat(${gridRows}, minmax(3.5rem, auto))` }}
      >
        {/* Background Grid Cells */}
        {Array.from({ length: gridRows * 12 }).map((_, i) => {
          const r = Math.floor(i / 12);
          const c = i % 12;
          return (
            <div 
              key={`cell-${r}-${c}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDropComponent(e, r, c)}
              className="border border-dashed border-gray-100 rounded h-full w-full absolute z-0 pointer-events-auto hover:bg-indigo-50/30 transition-colors"
              style={{ 
                gridRowStart: r + 1, 
                gridColumnStart: c + 1,
                top: `${r * (3.5 + 0.5) + 1}rem`, // Approximate if using absolute, but better to stay within grid flow if possible
                // Actually, let's use the same technique as VoucherDesigner which uses absolute cells in a grid container
              }}
            />
          );
        })}

        {/* Components */}
        {components.map((component) => {
          const isSelected = selectedComponentId === component.id;
          
          return (
            <div 
              key={component.id}
              draggable
              onDragStart={(e) => handleDragStart(e, component)}
              onClick={(e) => { 
                e.stopPropagation(); 
                onSelect(component.id); 
              }}
              className={`
                rounded border p-2 flex flex-col justify-center text-xs relative z-10 select-none shadow-sm group/item transition-all
                ${isSelected ? 'ring-2 ring-indigo-500 border-indigo-500 z-20' : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-400 cursor-move'}
                ${component.widgetType === 'status' ? 'bg-gray-50/50' : ''}
                ${component.type === 'action' ? 'bg-indigo-50/50 border-indigo-100 text-indigo-700 font-medium' : ''}
              `}
              style={{
                gridColumnStart: component.col + 1,
                gridColumnEnd: `span ${component.colSpan}`,
                gridRowStart: component.row + 1,
                minHeight: '3.5rem'
              }}
            >
              <div className="flex justify-between items-start w-full">
                <span className="truncate font-medium pointer-events-none">
                  {component.label}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteComponent(component.id);
                  }}
                  className="opacity-0 group-hover/item:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              <div className="mt-1 flex gap-1">
                <span className="text-[9px] px-1 bg-gray-100 text-gray-500 rounded lowercase">
                   {component.type === 'widget' ? component.widgetType : 'action'}
                </span>
              </div>
              
              {/* Resize Handle */}
              <div 
                className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-indigo-400/50 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center justify-center z-30"
                onMouseDown={(e) => startResize(e, component)}
              >
                 <div className="w-0.5 h-4 bg-indigo-500/50 rounded-full"></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
