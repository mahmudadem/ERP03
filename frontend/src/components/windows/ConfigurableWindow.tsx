import React from 'react';
import { X, Minus, Square } from 'lucide-react';
import { WindowConfig } from '../../types/WindowConfig';
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

export const ConfigurableWindow: React.FC<ConfigurableWindowProps> = ({
  config,
  data = {},
  onClose,
  onMinimize,
  onMaximize,
  children,
  isMaximized = false,
}) => {
  return (
    <div className="fixed left-20 top-20 w-[900px] bg-white rounded-lg shadow-2xl border border-gray-300 flex flex-col z-50">
      {/* Window Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 cursor-move select-none">
        <div className="flex items-center gap-3">
          <h3 className="font-medium text-gray-700">{config.header.title}</h3>
          {config.header.widgets?.map(widget => {
            const WidgetComponent = WidgetRegistry[widget.type];
            return WidgetComponent ? (
              <WidgetComponent key={widget.id} widget={widget} data={data} />
            ) : null;
          })}
        </div>
        
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

      {/* Window Body */}
      <div className="flex-1 overflow-y-auto p-4 bg-white max-h-[600px]">
        {children}
      </div>

      {/* Window Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
        {/* Left Widgets */}
        <div className="flex items-center gap-4">
          {config.footer.leftWidgets?.map(widget => {
            const WidgetComponent = WidgetRegistry[widget.type];
            return WidgetComponent ? (
              <WidgetComponent key={widget.id} widget={widget} data={data} />
            ) : null;
          })}
        </div>

        {/* Center Widgets */}
        <div className="flex items-center gap-4">
          {config.footer.centerWidgets?.map(widget => {
            const WidgetComponent = WidgetRegistry[widget.type];
            return WidgetComponent ? (
              <WidgetComponent key={widget.id} widget={widget} data={data} />
            ) : null;
          })}
        </div>

        {/* Right Widgets + Actions */}
        <div className="flex items-center gap-4">
          {config.footer.rightWidgets?.map(widget => {
            const WidgetComponent = WidgetRegistry[widget.type];
            return WidgetComponent ? (
              <WidgetComponent key={widget.id} widget={widget} data={data} />
            ) : null;
          })}
          
          {/* Action Buttons */}
          {config.footer.actions.map(action => {
            const variantClasses = {
              primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
              secondary: 'bg-gray-600 text-white hover:bg-gray-700',
              outline: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
              text: 'text-gray-600 hover:text-gray-800 hover:bg-gray-100',
              danger: 'bg-red-600 text-white hover:bg-red-700',
            };

            return (
              <button
                key={action.id}
                disabled={action.disabled}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[action.variant]}`}
              >
                {action.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
