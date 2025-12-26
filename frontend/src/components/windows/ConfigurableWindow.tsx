import React from 'react';
import { X, Minus, Square, Save, Send, Trash2, Printer, Download, Mail } from 'lucide-react';
import { WindowConfig, WindowComponent } from '../../types/WindowConfig';
import { WidgetRegistry } from './Widgets';

interface ConfigurableWindowProps {
  config: WindowConfig;
  data?: any;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  children: React.ReactNode;
  isMaximized?: boolean;
}

const ActionIcons: Record<string, any> = {
  Save,
  Send,
  Trash2,
  Printer,
  Download,
  Mail,
};

export const ConfigurableWindow: React.FC<ConfigurableWindowProps> = ({
  config,
  data = {},
  onClose,
  onMinimize,
  onMaximize,
  children,
  isMaximized = false,
}) => {
  // Render a component (widget or action) in the grid
  const renderComponent = (component: WindowComponent) => {
    if (component.type === 'widget' && component.widgetType) {
      const WidgetComponent = WidgetRegistry[component.widgetType];
      return WidgetComponent ? <WidgetComponent widget={component} data={data} /> : null;
    }
    
    if (component.type === 'action') {
      const variantClasses: Record<string, string> = {
        primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
        secondary: 'bg-gray-600 text-white hover:bg-gray-700',
        outline: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
        text: 'text-gray-600 hover:text-gray-800 hover:bg-gray-100',
        danger: 'bg-red-600 text-white hover:bg-red-700',
      };

      const Icon = component.icon ? ActionIcons[component.icon] : null;

      return (
        <button
          disabled={component.disabled}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-2 ${variantClasses[component.variant || 'primary']}`}
        >
          {Icon && <Icon size={14} />}
          {component.label}
        </button>
      );
    }

    return null;
  };

  // Render a grid section (header or footer)
  const renderGridSection = (components: WindowComponent[] | undefined) => {
    // Null safety check
    if (!components || components.length === 0) {
      return null;
    }

    // Group by row
    const rows: Record<number, WindowComponent[]> = {};
    components.forEach(comp => {
      if (!rows[comp.row]) rows[comp.row] = [];
      rows[comp.row].push(comp);
    });

    return (
      <div className="space-y-2">
        {Object.keys(rows).sort((a, b) => Number(a) - Number(b)).map(rowKey => (
          <div key={rowKey} className="grid grid-cols-12 gap-3">
            {rows[Number(rowKey)]
              .sort((a, b) => a.col - b.col)
              .map(comp => (
                <div
                  key={comp.id}
                  className="flex items-center"
                  style={{ gridColumn: `span ${comp.colSpan}` }}
                >
                  {renderComponent(comp)}
                </div>
              ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed left-20 top-20 w-[900px] bg-white rounded-lg shadow-2xl border border-gray-300 flex flex-col z-50">
      {/* Window Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 cursor-move select-none">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-gray-700">{config.header.title}</h3>
          
          {/* Window Controls */}
          {config.header.showControls && (
            <div className="flex items-center gap-1">
              {onMinimize && (
                <button
                  onClick={onMinimize}
                  className="p-1 hover:bg-gray-200 rounded text-gray-500"
                  title="Minimize"
                >
                  <Minus className="w-4 h-4" />
                </button>
              )}
              {onMaximize && (
                <button
                  onClick={onMaximize}
                  className="p-1 hover:bg-gray-200 rounded text-gray-500"
                  title={isMaximized ? "Restore" : "Maximize"}
                >
                  <Square className="w-3 h-3" />
                </button>
              )}
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-gray-200 rounded text-gray-500"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
        
        {/* Header Components Grid */}
        {config.header.components && config.header.components.length > 0 && (
          <div className="pt-2 border-t border-gray-200">
            {renderGridSection(config.header.components)}
          </div>
        )}
      </div>

      {/* Window Body */}
      <div className="flex-1 overflow-y-auto p-4 bg-white max-h-[600px]">
        {children}
      </div>

      {/* Window Footer */}
      {config.footer.components && config.footer.components.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
          {renderGridSection(config.footer.components)}
        </div>
      )}
    </div>
  );
};
