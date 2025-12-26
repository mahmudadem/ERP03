import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { WindowConfig, WindowComponent, AVAILABLE_WIDGETS, AVAILABLE_ACTIONS } from '../../types/WindowConfig';
import { ComponentPropertiesPanel } from './ComponentPropertiesPanel';

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
        components: [],
        showControls: true,
      },
      body: {
        component: 'GenericVoucherRenderer',
      },
      footer: {
        components: [],
      },
    }
  );

  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Get all components (header + footer)
  const allComponents = [
    ...(config.header.components || []),
    ...(config.footer.components || []),
  ];

  const selectedComponent = allComponents.find(c => c.id === selectedComponentId) || null;

  // Add a new component
  const addComponent = (template: Omit<WindowComponent, 'row' | 'col' | 'colSpan'>) => {
    const newComponent: WindowComponent = {
      ...template,
      id: `${template.id}-${Date.now()}`,
      row: 0,
      col: 0,
      colSpan: 3,
      section: 'footer', // Default to footer
    };

    setConfig({
      ...config,
      footer: {
        ...config.footer,
        components: [...(config.footer.components || []), newComponent],
      },
    });

    setSelectedComponentId(newComponent.id);
    setShowAddMenu(false);
  };

  // Update a component
  const updateComponent = (updated: WindowComponent) => {
    const section = updated.section || 'footer';
    const otherSection = section === 'header' ? 'footer' : 'header';

    // Remove from both sections first
    const headerComponents = (config.header.components || []).filter(c => c.id !== updated.id);
    const footerComponents = (config.footer.components || []).filter(c => c.id !== updated.id);

    // Add to correct section
    if (section === 'header') {
      headerComponents.push(updated);
    } else {
      footerComponents.push(updated);
    }

    setConfig({
      ...config,
      header: {
        ...config.header,
        components: headerComponents,
      },
      footer: {
        ...config.footer,
        components: footerComponents,
      },
    });
  };

  // Delete a component
  const deleteComponent = (id: string) => {
    setConfig({
      ...config,
      header: {
        ...config.header,
        components: (config.header.components || []).filter(c => c.id !== id),
      },
      footer: {
        ...config.footer,
        components: (config.footer.components || []).filter(c => c.id !== id),
      },
    });

    if (selectedComponentId === id) {
      setSelectedComponentId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[1600px] h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Window Configuration Designer</h2>
            <p className="text-sm text-gray-600 mt-1">Configure components with detailed properties</p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* Main Content - 3 Column Layout */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - Component List */}
          <div className="w-80 border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900">Components</h3>
                <button
                  onClick={() => setShowAddMenu(!showAddMenu)}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 flex items-center gap-1"
                >
                  <Plus size={14} />
                  Add
                </button>
              </div>

              {/* Add Component Menu */}
              {showAddMenu && (
                <div className="absolute z-10 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
                  <div className="p-2">
                    <div className="text-xs font-bold text-gray-500 uppercase px-2 py-1">Widgets</div>
                    {AVAILABLE_WIDGETS.map(widget => (
                      <button
                        key={widget.id}
                        onClick={() => addComponent(widget)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm"
                      >
                        {widget.label}
                      </button>
                    ))}
                    <div className="text-xs font-bold text-gray-500 uppercase px-2 py-1 mt-2">Actions</div>
                    {AVAILABLE_ACTIONS.map(action => (
                      <button
                        key={action.id}
                        onClick={() => addComponent(action)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Component List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {allComponents.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No components yet.<br />Click "Add" to get started.
                </div>
              ) : (
                allComponents.map(component => (
                  <div
                    key={component.id}
                    onClick={() => setSelectedComponentId(component.id)}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-colors group ${
                      selectedComponentId === component.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-900">{component.label}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {component.section || 'footer'} • Row {component.row} • Col {component.col}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteComponent(component.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="mt-2 flex gap-1">
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                        {component.type === 'widget' ? component.widgetType : 'action'}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                        Span: {component.colSpan}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Basic Settings */}
            <div className="p-4 border-t border-gray-200 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Window Title</label>
                <input
                  type="text"
                  value={config.header.title}
                  onChange={(e) => setConfig({
                    ...config,
                    header: { ...config.header, title: e.target.value },
                  })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
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
                Show window controls
              </label>
            </div>

            {/* Save/Cancel */}
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
                Save
              </button>
            </div>
          </div>

          {/* Center Panel - Live Preview */}
          <div className="flex-1 bg-gray-100 p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <h3 className="text-sm font-bold text-gray-700 mb-4">Live Preview</h3>
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <div className="text-center text-gray-400 text-sm py-12">
                  Preview will show components with all applied styling
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Properties */}
          <div className="w-96 border-l border-gray-200 bg-gray-50">
            <div className="p-4 border-b border-gray-200 bg-white">
              <h3 className="font-bold text-gray-900">Properties</h3>
            </div>
            <ComponentPropertiesPanel
              component={selectedComponent}
              onUpdate={updateComponent}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
