import React from 'react';
import { GripVertical, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { WindowComponent } from '../../types/WindowConfig';

interface GridCanvasProps {
  components: WindowComponent[];
  onComponentsChange: (components: WindowComponent[]) => void;
  sectionName: string;
}

export const GridCanvas: React.FC<GridCanvasProps> = ({
  components,
  onComponentsChange,
  sectionName,
}) => {
  const [selectedComponentId, setSelectedComponentId] = React.useState<string | null>(null);

  // Add component at specific position
  const addComponent = (component: Omit<WindowComponent, 'row' | 'col' | 'colSpan'>, row: number, col: number) => {
    const newComponent: WindowComponent = {
      ...component,
      id: `${component.id}-${Date.now()}`,
      row,
      col,
      colSpan: 3, // Default span
    };
    onComponentsChange([...components, newComponent]);
  };

  // Remove component
  const removeComponent = (id: string) => {
    onComponentsChange(components.filter(c => c.id !== id));
    if (selectedComponentId === id) {
      setSelectedComponentId(null);
    }
  };

  // Update component position
  const updateComponentPosition = (id: string, row: number, col: number) => {
    onComponentsChange(
      components.map(c => (c.id === id ? { ...c, row, col } : c))
    );
  };

  // Update component span
  const updateComponentSpan = (id: string, colSpan: number) => {
    onComponentsChange(
      components.map(c => (c.id === id ? { ...c, colSpan: Math.max(1, Math.min(12, colSpan)) } : c))
    );
  };

  // Get component at specific grid cell
  const getComponentAtCell = (row: number, col: number): WindowComponent | null => {
    return components.find(c => 
      c.row === row && c.col <= col && c.col + c.colSpan > col
    ) || null;
  };

  // Render grid (3 rows x 12 columns)
  const renderGrid = () => {
    const rows = 3;
    const cols = 12;
    const grid: JSX.Element[] = [];

    for (let row = 0; row < rows; row++) {
      const rowCells: JSX.Element[] = [];
      
      for (let col = 0; col < cols; col++) {
        const component = getComponentAtCell(row, col);
        
        // Skip if this cell is part of a component that starts earlier
        if (component && component.col !== col) {
          continue;
        }

        if (component) {
          // Render component
          const isSelected = selectedComponentId === component.id;
          rowCells.push(
            <div
              key={`${row}-${col}`}
              className={`relative group ${isSelected ? 'ring-2 ring-indigo-500' : ''}`}
              style={{ gridColumn: `span ${component.colSpan}` }}
              onClick={() => setSelectedComponentId(component.id)}
            >
              {/* Component Card */}
              <div className="bg-white border-2 border-gray-200 rounded-lg p-3 hover:border-indigo-300 transition-colors cursor-pointer h-full">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <GripVertical size={14} className="text-gray-400" />
                    <span className="text-xs font-medium text-gray-700">{component.label}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeComponent(component.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                
                <div className="flex items-center gap-1 text-[10px] text-gray-500">
                  <span className="px-1.5 py-0.5 bg-gray-100 rounded">
                    {component.type === 'widget' ? component.widgetType : 'action'}
                  </span>
                  <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                    Col: {component.col + 1}
                  </span>
                  <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded">
                    Span: {component.colSpan}
                  </span>
                </div>

                {/* Resize Controls */}
                {isSelected && (
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 flex items-center gap-1 bg-white border border-gray-300 rounded shadow-sm px-1 py-0.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateComponentSpan(component.id, component.colSpan - 1);
                      }}
                      disabled={component.colSpan <= 1}
                      className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"
                      title="Decrease width"
                    >
                      <ChevronLeft size={12} />
                    </button>
                    <span className="text-[9px] font-medium text-gray-600 px-1">
                      {component.colSpan}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateComponentSpan(component.id, component.colSpan + 1);
                      }}
                      disabled={component.col + component.colSpan >= 12}
                      className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"
                      title="Increase width"
                    >
                      <ChevronRight size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        } else {
          // Render empty drop zone
          rowCells.push(
            <div
              key={`${row}-${col}`}
              className="border border-dashed border-gray-200 rounded bg-gray-50/50 hover:bg-indigo-50/30 hover:border-indigo-300 transition-colors min-h-[60px] flex items-center justify-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const componentData = e.dataTransfer.getData('component');
                if (componentData) {
                  const component = JSON.parse(componentData);
                  addComponent(component, row, col);
                }
              }}
            >
              <span className="text-[9px] text-gray-300 font-medium">
                {col + 1}
              </span>
            </div>
          );
        }
      }

      grid.push(
        <div key={row} className="grid grid-cols-12 gap-2">
          {rowCells}
        </div>
      );
    }

    return grid;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
          {sectionName} Canvas (12-Column Grid)
        </h4>
        {components.length > 0 && (
          <span className="text-[10px] text-gray-500">
            {components.length} component{components.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      
      <div className="space-y-2">
        {renderGrid()}
      </div>

      {components.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-xs">
          Drag components from the library to add them to the grid
        </div>
      )}
    </div>
  );
};
