
import React from 'react';
import { FieldType } from '../../types/FieldDefinition';

interface FieldTypeOption {
  type: FieldType;
  label: string;
  icon: string;
}

const FIELD_TYPES: FieldTypeOption[] = [
  { type: 'TEXT', label: 'Text Input', icon: '📝' },
  { type: 'NUMBER', label: 'Number', icon: '🔢' },
  { type: 'DATE', label: 'Date Picker', icon: '📅' },
  { type: 'SELECT', label: 'Dropdown', icon: '▼' },
  { type: 'CHECKBOX', label: 'Checkbox', icon: '☑️' },
  { type: 'TEXTAREA', label: 'Text Area', icon: 'paragraph' },
];

export const FieldListPanel: React.FC = () => {
  const handleDragStart = (e: React.DragEvent, type: FieldType) => {
    e.dataTransfer.setData('field_type', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="p-4">
      <h3 className="font-bold text-xs uppercase text-gray-500 mb-4 tracking-wider">Toolbox</h3>
      <div className="grid grid-cols-1 gap-2">
        {FIELD_TYPES.map(ft => (
          <div 
            key={ft.type}
            draggable
            onDragStart={(e) => handleDragStart(e, ft.type)}
            className="bg-white border border-gray-200 hover:border-blue-500 hover:shadow-sm p-3 rounded cursor-grab active:cursor-grabbing text-sm flex items-center gap-3 transition-all"
          >
            <span className="text-lg">{ft.icon}</span>
            <span className="font-medium text-gray-700">{ft.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-8 p-3 bg-blue-50 rounded text-xs text-blue-700 leading-relaxed">
        <strong>Tip:</strong> Drag these items onto the canvas to add them to your form.
      </div>
    </div>
  );
};
