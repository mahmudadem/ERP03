import React from 'react';
import { WindowComponent, ComponentStyle } from '../../types/WindowConfig';
import { Sliders, MousePointerClick } from 'lucide-react';

interface ComponentPropertiesPanelProps {
  component: WindowComponent | null;
  onUpdate: (component: WindowComponent) => void;
}

export const ComponentPropertiesPanel: React.FC<ComponentPropertiesPanelProps> = ({
  component,
  onUpdate,
}) => {
  if (!component) {
    return (
      <div className="text-center text-gray-400 py-10 px-6">
        <MousePointerClick size={40} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">Select a component in the grid to edit its properties.</p>
      </div>
    );
  }

  const updateProperty = (key: keyof WindowComponent, value: any) => {
    onUpdate({ ...component, [key]: value });
  };

  const updateStyle = (key: keyof ComponentStyle, value: string) => {
    onUpdate({
      ...component,
      style: {
        ...component.style,
        [key]: value,
      },
    });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b border-gray-100 bg-gray-50/50">
        <h3 className="font-bold text-gray-700 flex items-center gap-2">
          <Sliders size={16} /> Properties
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Field ID (Read-only) */}
        <div>
          <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">Field ID</label>
          <div className="text-sm font-mono bg-gray-100 p-2 rounded text-gray-600 border border-gray-200">
            {component.id.split('-')[0]}
          </div>
        </div>

        {/* Custom Label */}
        <div>
          <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">Custom Label</label>
          <input 
            type="text" 
            value={component.label}
            onChange={(e) => updateProperty('label', e.target.value)}
            placeholder="Default Label"
            className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900"
          />
        </div>

        {/* Width Slider */}
        <div>
          <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">Width (Columns)</label>
          <div className="flex items-center gap-3">
            <input 
              type="range" 
              min="1" 
              max="12"
              value={component.colSpan}
              onChange={(e) => updateProperty('colSpan', parseInt(e.target.value))}
              className="flex-1 accent-indigo-600 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm font-bold w-6 text-center text-indigo-600">{component.colSpan}</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1 italic font-medium">Grid has 12 columns total.</p>
        </div>

        {/* Row/Col Position */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">Row Index</label>
            <input 
              type="number" 
              min="0"
              value={component.row}
              onChange={(e) => updateProperty('row', Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900 font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">Column Start</label>
            <input 
              type="number" 
              min="0" 
              max="11"
              value={component.col}
              onChange={(e) => updateProperty('col', Math.max(0, Math.min(11, parseInt(e.target.value) || 0)))}
              className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900 font-mono"
            />
          </div>
        </div>

        {/* Move to Section */}
        <div>
          <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">Move to Section</label>
          <select 
            value={component.section || 'footer'}
            onChange={(e) => updateProperty('section', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded text-sm bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="header">HEADER</option>
            <option value="footer">FOOTER</option>
          </select>
        </div>

        {/* Advanced Styling Section (Optional/Grouped) */}
        <div className="pt-6 border-t border-gray-100">
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Appearance</h4>
          <div className="space-y-4">
             {/* Colors */}
             <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Text Color</label>
                  <input
                    type="color"
                    value={component.style?.valueColor || '#000000'}
                    onChange={(e) => updateStyle('valueColor', e.target.value)}
                    className="w-full h-8 border border-gray-300 rounded cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Background</label>
                  <input
                    type="color"
                    value={component.style?.valueBackground || '#ffffff'}
                    onChange={(e) => updateStyle('valueBackground', e.target.value)}
                    className="w-full h-8 border border-gray-300 rounded cursor-pointer"
                  />
                </div>
             </div>

             {/* Font Weight */}
             <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Font Weight</label>
                <select
                  value={component.style?.valueFontWeight || 'normal'}
                  onChange={(e) => updateStyle('valueFontWeight', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded text-xs"
                >
                  <option value="normal">Normal</option>
                  <option value="bold">Bold</option>
                  <option value="600">Semi-Bold</option>
                </select>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
