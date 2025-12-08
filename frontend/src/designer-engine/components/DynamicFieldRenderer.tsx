/**
 * DynamicFieldRenderer.tsx
 * Renders a single input based on FieldDefinition.
 */
import React from 'react';
import { FieldDefinition } from '../types/FieldDefinition';

interface Props {
  field: FieldDefinition;
  value: any;
  error?: string;
  onChange: (value: any) => void;
  customComponents?: Record<string, React.ComponentType<any>>;
}

export const DynamicFieldRenderer: React.FC<Props> = ({ field, value, error, onChange, customComponents }) => {
  
  const baseInputClass = `
    w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors
    ${error ? 'border-red-500 bg-red-50' : 'border-gray-300'}
    ${field.readOnly ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'}
  `;

  const renderInput = () => {
    if (customComponents && customComponents[field.type]) {
      const Component = customComponents[field.type];
      return (
        <Component
          value={value}
          onChange={onChange}
          field={field}
          error={error}
          disabled={field.readOnly}
        />
      );
    }

    switch (field.type) {
      case 'TEXT':
      case 'RELATION': // For MVP, relation is just text
        return (
          <input
            type="text"
            className={baseInputClass}
            placeholder={field.placeholder}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={field.readOnly}
          />
        );

      case 'NUMBER':
        return (
          <input
            type="number"
            className={baseInputClass}
            placeholder={field.placeholder}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={field.readOnly}
          />
        );

      case 'DATE':
        let dateValue = '';
        if (value) {
          const d = new Date(value);
          if (!isNaN(d.getTime())) {
            dateValue = d.toISOString().split('T')[0];
          }
        }
        return (
          <input
            type="date"
            className={baseInputClass}
            value={dateValue}
            onChange={(e) => onChange(e.target.value)}
            disabled={field.readOnly}
          />
        );

      case 'CHECKBOX':
        return (
          <div className="flex items-center h-full">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
              disabled={field.readOnly}
            />
            <span className="ml-2 text-sm text-gray-700">{field.placeholder || 'Yes'}</span>
          </div>
        );

      case 'SELECT':
        return (
          <select
            className={baseInputClass}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={field.readOnly}
          >
            <option value="">Select...</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'TEXTAREA':
        return (
          <textarea
            className={baseInputClass}
            rows={3}
            placeholder={field.placeholder}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={field.readOnly}
          />
        );

      default:
        return <div className="text-red-500 text-xs">Unknown Type</div>;
    }
  };

  return (
    <div className={`flex flex-col ${field.hidden ? 'hidden' : ''}`}>
      <label className="mb-1 text-xs font-medium text-gray-700">
        {field.label} {field.required && <span className="text-red-500">*</span>}
      </label>
      {renderInput()}
      {error && <span className="mt-1 text-xs text-red-500">{error}</span>}
    </div>
  );
};
