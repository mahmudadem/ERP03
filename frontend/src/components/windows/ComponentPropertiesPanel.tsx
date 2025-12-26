import React from 'react';
import { WindowComponent, ComponentStyle } from '../../types/WindowConfig';

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
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Select a component to edit its properties
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
    <div className="h-full overflow-y-auto p-4 space-y-6">
      {/* Component Info */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-3">Component Info</h3>
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Label</label>
            <input
              type="text"
              value={component.label}
              onChange={(e) => updateProperty('label', e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
            <div className="px-2 py-1.5 text-sm bg-gray-100 rounded text-gray-600">
              {component.type === 'widget' ? component.widgetType : 'action'}
            </div>
          </div>
        </div>
      </div>

      {/* Position */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-3">Position</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Section</label>
            <select
              value={component.section || 'footer'}
              onChange={(e) => updateProperty('section', e.target.value as 'header' | 'footer')}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
            >
              <option value="header">Header</option>
              <option value="footer">Footer</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Row</label>
            <input
              type="number"
              min="0"
              max="2"
              value={component.row}
              onChange={(e) => updateProperty('row', parseInt(e.target.value))}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Column (0-11)</label>
            <input
              type="number"
              min="0"
              max="11"
              value={component.col}
              onChange={(e) => updateProperty('col', parseInt(e.target.value))}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Span (1-12)</label>
            <input
              type="number"
              min="1"
              max="12"
              value={component.colSpan}
              onChange={(e) => updateProperty('colSpan', parseInt(e.target.value))}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
            />
          </div>
        </div>
      </div>

      {/* Size */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-3">Size</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Width</label>
            <input
              type="text"
              value={component.style?.width || 'auto'}
              onChange={(e) => updateStyle('width', e.target.value)}
              placeholder="auto, 200px, 100%"
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Height</label>
            <input
              type="text"
              value={component.style?.height || 'auto'}
              onChange={(e) => updateStyle('height', e.target.value)}
              placeholder="auto, 40px"
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
            />
          </div>
        </div>
      </div>

      {/* Label Styling */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-3">Label Style</h3>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Font Size</label>
              <input
                type="text"
                value={component.style?.labelFontSize || '12px'}
                onChange={(e) => updateStyle('labelFontSize', e.target.value)}
                placeholder="12px, 14px"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Font Weight</label>
              <select
                value={component.style?.labelFontWeight || 'normal'}
                onChange={(e) => updateStyle('labelFontWeight', e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
              >
                <option value="normal">Normal</option>
                <option value="bold">Bold</option>
                <option value="600">Semi-Bold</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Text Color</label>
              <input
                type="color"
                value={component.style?.labelColor || '#666666'}
                onChange={(e) => updateStyle('labelColor', e.target.value)}
                className="w-full h-8 border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Background</label>
              <input
                type="color"
                value={component.style?.labelBackground || '#f0f0f0'}
                onChange={(e) => updateStyle('labelBackground', e.target.value)}
                className="w-full h-8 border border-gray-300 rounded"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Value Styling */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-3">Value Style</h3>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Font Size</label>
              <input
                type="text"
                value={component.style?.valueFontSize || '14px'}
                onChange={(e) => updateStyle('valueFontSize', e.target.value)}
                placeholder="14px, 16px"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Font Weight</label>
              <select
                value={component.style?.valueFontWeight || 'normal'}
                onChange={(e) => updateStyle('valueFontWeight', e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
              >
                <option value="normal">Normal</option>
                <option value="bold">Bold</option>
                <option value="600">Semi-Bold</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Text Color</label>
              <input
                type="color"
                value={component.style?.valueColor || '#000000'}
                onChange={(e) => updateStyle('valueColor', e.target.value)}
                className="w-full h-8 border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Background</label>
              <input
                type="color"
                value={component.style?.valueBackground || '#ffffff'}
                onChange={(e) => updateStyle('valueBackground', e.target.value)}
                className="w-full h-8 border border-gray-300 rounded"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Border/Frame */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-3">Border / Frame</h3>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Border Width</label>
              <input
                type="text"
                value={component.style?.borderWidth || '1px'}
                onChange={(e) => updateStyle('borderWidth', e.target.value)}
                placeholder="1px, 2px"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Border Style</label>
              <select
                value={component.style?.borderStyle || 'solid'}
                onChange={(e) => updateStyle('borderStyle', e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
              >
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="dotted">Dotted</option>
                <option value="none">None</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Border Color</label>
              <input
                type="color"
                value={component.style?.borderColor || '#cccccc'}
                onChange={(e) => updateStyle('borderColor', e.target.value)}
                className="w-full h-8 border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Border Radius</label>
              <input
                type="text"
                value={component.style?.borderRadius || '4px'}
                onChange={(e) => updateStyle('borderRadius', e.target.value)}
                placeholder="4px, 8px"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Spacing */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-3">Spacing</h3>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Padding</label>
          <input
            type="text"
            value={component.style?.padding || '8px'}
            onChange={(e) => updateStyle('padding', e.target.value)}
            placeholder="8px, 12px 16px"
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
          />
        </div>
      </div>
    </div>
  );
};
