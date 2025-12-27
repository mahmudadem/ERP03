import React, { useState } from 'react';
import { X, Plus, Trash2, GripVertical } from 'lucide-react';
import { WindowConfig, WindowComponent, AVAILABLE_WIDGETS, AVAILABLE_ACTIONS } from '../../types/WindowConfig';
import { ComponentPropertiesPanel } from './ComponentPropertiesPanel';
import { GridCanvas } from './GridCanvas';

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
  const handleAddNewComponent = (template: Omit<WindowComponent, 'row' | 'col' | 'colSpan'>, section: 'header' | 'footer', row: number, col: number) => {
    const newComponent: WindowComponent = {
      ...template,
      id: `${template.id}-${Date.now()}`,
      row,
      col,
      colSpan: 3,
      section,
    };

    const updatedConfig = { ...config };
    if (section === 'header') {
      updatedConfig.header.components = [...(updatedConfig.header.components || []), newComponent];
    } else {
      updatedConfig.footer.components = [...(updatedConfig.footer.components || []), newComponent];
    }

    setConfig(updatedConfig);
    setSelectedComponentId(newComponent.id);
  };

  // Update a component
  const updateComponent = (updated: WindowComponent) => {
    const updatedConfig = { ...config };
    
    // Update in header
    updatedConfig.header.components = (updatedConfig.header.components || []).map(c => 
      c.id === updated.id ? updated : c
    );
    
    // Update in footer
    updatedConfig.footer.components = (updatedConfig.footer.components || []).map(c => 
      c.id === updated.id ? updated : c
    );

    setConfig(updatedConfig);
  };

  // Handle Drop orchestration
  const handleDropToGrid = (e: React.DragEvent, targetSection: 'header' | 'footer', row: number, col: number) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('type');

    if (type === 'new_component') {
      const componentData = e.dataTransfer.getData('component');
      if (componentData) {
        const template = JSON.parse(componentData);
        handleAddNewComponent(template, targetSection, row, col);
      }
    } else if (type === 'existing_component') {
      const fieldId = e.dataTransfer.getData('fieldId');
      const sourceSection = e.dataTransfer.getData('sourceSection') as 'header' | 'footer';

      const updatedConfig = { ...config };
      
      // Find and remove from source
      let movedComponent: WindowComponent | undefined;
      if (sourceSection === 'header') {
        const idx = updatedConfig.header.components.findIndex(c => c.id === fieldId);
        if (idx !== -1) [movedComponent] = updatedConfig.header.components.splice(idx, 1);
      } else {
        const idx = updatedConfig.footer.components.findIndex(c => c.id === fieldId);
        if (idx !== -1) [movedComponent] = updatedConfig.footer.components.splice(idx, 1);
      }

      if (movedComponent) {
        movedComponent.row = row;
        movedComponent.col = col;
        movedComponent.section = targetSection;

        // Add to target
        if (targetSection === 'header') {
          updatedConfig.header.components.push(movedComponent);
        } else {
          updatedConfig.footer.components.push(movedComponent);
        }
        
        setConfig(updatedConfig);
        setSelectedComponentId(fieldId);
      }
    }
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

              {/* Add Component Menu Removed - Moving to Drag & Drop */}
            </div>

            {/* Component List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Widgets</h4>
                <div className="space-y-2">
                  {AVAILABLE_WIDGETS.map(widget => (
                    <div
                      key={widget.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('type', 'new_component');
                        e.dataTransfer.setData('component', JSON.stringify(widget));
                      }}
                      className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm cursor-grab active:cursor-grabbing hover:border-indigo-300 transition-colors flex items-center justify-between group"
                    >
                      <span className="text-sm font-medium text-gray-700">{widget.label}</span>
                      <GripVertical size={14} className="text-gray-300 group-hover:text-indigo-400" />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Actions</h4>
                <div className="space-y-2">
                  {AVAILABLE_ACTIONS.map(action => (
                    <div
                      key={action.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('type', 'new_component');
                        e.dataTransfer.setData('component', JSON.stringify(action));
                      }}
                      className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg shadow-sm cursor-grab active:cursor-grabbing hover:border-indigo-300 transition-colors flex items-center justify-between group"
                    >
                      <span className="text-sm font-medium text-indigo-700">{action.label}</span>
                      <GripVertical size={14} className="text-indigo-300 group-hover:text-indigo-400" />
                    </div>
                  ))}
                </div>
              </div>
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
          <div className="flex-1 bg-gray-100 p-8 overflow-y-auto">
            <div className="max-w-4xl mx-auto space-y-6">
              <GridCanvas 
                sectionName="Header"
                components={config.header.components}
                selectedComponentId={selectedComponentId}
                onSelect={setSelectedComponentId}
                onUpdateComponent={updateComponent}
                onDeleteComponent={deleteComponent}
                onDropComponent={(e, r, c) => handleDropToGrid(e, 'header', r, c)}
              />

              {/* Body Placeholder */}
              <div className="border border-dashed border-gray-300 rounded-xl bg-gray-50/50 p-12 text-center">
                <div className="flex flex-col items-center gap-2">
                   <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Main Content Area (Body)</div>
                   <div className="text-xs text-gray-400">The primary voucher content will be rendered here.</div>
                </div>
              </div>

              <GridCanvas 
                sectionName="Footer"
                components={config.footer.components}
                selectedComponentId={selectedComponentId}
                onSelect={setSelectedComponentId}
                onUpdateComponent={updateComponent}
                onDeleteComponent={deleteComponent}
                onDropComponent={(e, r, c) => handleDropToGrid(e, 'footer', r, c)}
              />
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
