import React, { useState } from 'react';
import { X, GripVertical, Plus, Trash2, Eye } from 'lucide-react';
import { WindowConfig, WindowWidget, WindowAction, AVAILABLE_WIDGETS, AVAILABLE_ACTIONS } from '../../../types/WindowConfig';

interface WindowDesignerProps {
  initialConfig?: WindowConfig;
  onSave: (config: WindowConfig) => void;
  onCancel: () => void;
}

export const WindowConfigDesigner: React.FC<WindowDesignerProps> = ({
  initialConfig,
  onSave,
  onCancel,
}) => {
  const [config, setConfig] = useState<WindowConfig>(
    initialConfig || {
      id: `config-${Date.now()}`,
      windowType: 'voucher',
      header: {
        title: 'New Window',
        showControls: true,
      },
      body: {
        component: 'GenericVoucherRenderer',
      },
      footer: {
        actions: [],
      },
    }
  );

  const [showPreview, setShowPreview] = useState(false);
  const [draggedWidget, setDraggedWidget] = useState<WindowWidget | null>(null);
  const [draggedAction, setDraggedAction] = useState<WindowAction | null>(null);

  // Add widget to footer section
  const addWidget = (widget: WindowWidget, section: 'left' | 'center' | 'right') => {
    const sectionKey = `${section}Widgets` as 'leftWidgets' | 'centerWidgets' | 'rightWidgets';
    const currentWidgets = config.footer[sectionKey] || [];
    
    setConfig({
      ...config,
      footer: {
        ...config.footer,
        [sectionKey]: [...currentWidgets, { ...widget, id: `${widget.id}-${Date.now()}` }],
      },
    });
  };

  // Remove widget
  const removeWidget = (widgetId: string, section: 'left' | 'center' | 'right') => {
    const sectionKey = `${section}Widgets` as 'leftWidgets' | 'centerWidgets' | 'rightWidgets';
    const currentWidgets = config.footer[sectionKey] || [];
    
    setConfig({
      ...config,
      footer: {
        ...config.footer,
        [sectionKey]: currentWidgets.filter(w => w.id !== widgetId),
      },
    });
  };

  // Add action
  const addAction = (action: WindowAction) => {
    setConfig({
      ...config,
      footer: {
        ...config.footer,
        actions: [...config.footer.actions, { ...action, id: `${action.id}-${Date.now()}` }],
      },
    });
  };

  // Remove action
  const removeAction = (actionId: string) => {
    setConfig({
      ...config,
      footer: {
        ...config.footer,
        actions: config.footer.actions.filter(a => a.id !== actionId),
      },
    });
  };

  // Reorder actions via drag-drop
  const reorderActions = (dragIndex: number, dropIndex: number) => {
    const newActions = [...config.footer.actions];
    const [dragged] = newActions.splice(dragIndex, 1);
    newActions.splice(dropIndex, 0, dragged);
    
    setConfig({
      ...config,
      footer: {
        ...config.footer,
        actions: newActions,
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Window Configuration Designer</h2>
            <p className="text-sm text-gray-600 mt-1">Configure header, body, and footer for {config.windowType} windows</p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - Configuration */}
          <div className="w-96 border-r border-gray-200 flex flex-col">
            <div className="p-4 space-y-6 overflow-y-auto flex-1">
              {/* Header Configuration */}
              <div>
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  Header
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Window Title
                    </label>
                    <input
                      type="text"
                      value={config.header.title}
                      onChange={(e) => setConfig({
                        ...config,
                        header: { ...config.header, title: e.target.value },
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Enter window title"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={config.header.showControls}
                      onChange={(e) => setConfig({
                        ...config,
                        header: { ...config.header, showControls: e.target.checked },
                      })}
                      className="rounded"
                    />
                    Show window controls (Min/Max/Close)
                  </label>
                </div>
              </div>

              {/* Body Configuration */}
              <div>
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  Body
                </h3>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Component
                  </label>
                  <select
                    value={config.body.component}
                    onChange={(e) => setConfig({
                      ...config,
                      body: { ...config.body, component: e.target.value },
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="GenericVoucherRenderer">Voucher Renderer</option>
                    <option value="InvoiceRenderer">Invoice Renderer</option>
                    <option value="ReportRenderer">Report Renderer</option>
                    <option value="StatementRenderer">Statement Renderer</option>
                  </select>
                </div>
              </div>

              {/* Footer - Widgets */}
              <div>
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  Footer Widgets
                </h3>
                
                <div className="space-y-3">
                  {/* Available Widgets */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      Available Widgets (Drag to add)
                    </label>
                    <div className="space-y-1">
                      {AVAILABLE_WIDGETS.map(widget => (
                        <div
                          key={widget.id}
                          draggable
                          onDragStart={() => setDraggedWidget(widget)}
                          onDragEnd={() => setDraggedWidget(null)}
                          className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded border border-gray-200 cursor-grab active:cursor-grabbing hover:bg-gray-100 transition-colors"
                        >
                          <GripVertical size={14} className="text-gray-400" />
                          <span className="text-sm flex-1">{widget.label}</span>
                          <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded">
                            {widget.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer - Actions */}
              <div>
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-500" />
                  Footer Actions
                </h3>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Available Actions
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {AVAILABLE_ACTIONS.map(action => (
                      <button
                        key={action.id}
                        onClick={() => addAction(action)}
                        className="px-3 py-2 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                      >
                        + {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Save/Cancel Buttons */}
            <div className="p-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => onSave(config)}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Save Config
              </button>
            </div>
          </div>

          {/* Right Panel - Live Preview */}
          <div className="flex-1 bg-gray-100 p-8 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
                {/* Window Header Preview */}
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="font-medium text-gray-700">{config.header.title}</h3>
                  {config.header.showControls && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-400" />
                      <div className="w-3 h-3 rounded-full bg-green-400" />
                      <div className="w-3 h-3 rounded-full bg-red-400" />
                    </div>
                  )}
                </div>

                {/* Body Preview */}
                <div className="p-8 min-h-[400px] bg-white">
                  <div className="text-center py-12 text-gray-400">
                    <div className="text-sm font-medium mb-2">{config.body.component}</div>
                    <div className="text-xs">Window content will render here</div>
                  </div>
                </div>

                {/* Footer Preview */}
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                  <div className="flex items-center justify-between gap-4">
                    {/* Left Widgets */}
                    <div
                      className="flex items-center gap-3 flex-1"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (draggedWidget) {
                          addWidget(draggedWidget, 'left');
                          setDraggedWidget(null);
                        }
                      }}
                    >
                      {config.footer.leftWidgets?.map(widget => (
                        <div key={widget.id} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded group">
                          <span className="text-sm font-medium text-gray-700">{widget.label}</span>
                          <button
                            onClick={() => removeWidget(widget.id, 'left')}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                      {(!config.footer.leftWidgets || config.footer.leftWidgets.length === 0) && (
                        <div className="text-xs text-gray-400 italic">Drop widgets here</div>
                      )}
                    </div>

                    {/* Center Widgets */}
                    <div
                      className="flex items-center gap-3"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (draggedWidget) {
                          addWidget(draggedWidget, 'center');
                          setDraggedWidget(null);
                        }
                      }}
                    >
                      {config.footer.centerWidgets?.map(widget => (
                        <div key={widget.id} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded group">
                          <span className="text-sm font-medium text-gray-700">{widget.label}</span>
                          <button
                            onClick={() => removeWidget(widget.id, 'center')}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Right Widgets + Actions */}
                    <div className="flex items-center gap-3 justify-end flex-1">
                      {/* Right Widgets */}
                      <div
                        className="flex items-center gap-3"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (draggedWidget) {
                            addWidget(draggedWidget, 'right');
                            setDraggedWidget(null);
                          }
                        }}
                      >
                        {config.footer.rightWidgets?.map(widget => (
                          <div key={widget.id} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded group">
                            <span className="text-sm font-medium text-gray-700">{widget.label}</span>
                            <button
                              onClick={() => removeWidget(widget.id, 'right')}
                              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Actions */}
                      {config.footer.actions.map((action, index) => {
                        const variantClasses = {
                          primary: 'bg-indigo-600 text-white',
                          secondary: 'bg-gray-600 text-white',
                          outline: 'bg-white border border-gray-300 text-gray-700',
                          text: 'text-gray-600 hover:text-gray-800',
                          danger: 'bg-red-600 text-white',
                        };

return (
                          <div
                            key={action.id}
                            draggable
                            onDragStart={() => setDraggedAction(action)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (draggedAction) {
                                const dragIndex = config.footer.actions.findIndex(a => a.id === draggedAction.id);
                                reorderActions(dragIndex, index);
                                setDraggedAction(null);
                              }
                            }}
                            className="flex items-center gap-2 group"
                          >
                            <GripVertical size={14} className="text-gray-400 cursor-grab" />
                            <button className={`px-4 py-2 rounded text-sm font-medium ${variantClasses[action.variant]}`}>
                              {action.label}
                            </button>
                            <button
                              onClick={() => removeAction(action.id)}
                              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
