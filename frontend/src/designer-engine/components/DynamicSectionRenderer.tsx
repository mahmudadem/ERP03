/**
 * DynamicSectionRenderer.tsx
 * Renders a group of fields in a grid layout.
 */
import React from 'react';
import { SectionDefinition } from '../types/SectionDefinition';
import { FieldDefinition } from '../types/FieldDefinition';
import { DynamicFieldRenderer } from './DynamicFieldRenderer';

interface Props {
  section: SectionDefinition;
  allFields: FieldDefinition[];
  values: Record<string, any>;
  errors: Record<string, string>;
  onChange: (fieldName: string, value: any) => void;
  hiddenFieldIds: Set<string>;
}

export const DynamicSectionRenderer: React.FC<Props> = ({ 
  section, 
  allFields, 
  values, 
  errors, 
  onChange,
  hiddenFieldIds
}) => {
  // Filter fields that belong to this section
  const sectionFields = section.fieldIds
    .map(id => allFields.find(f => f.id === id))
    .filter((f): f is FieldDefinition => !!f); // Ensure no undefined

  if (sectionFields.length === 0) return null;

  return (
    <div className="mb-6 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      {section.title && (
        <h3 className="mb-4 text-sm font-bold text-gray-800 uppercase tracking-wide border-b pb-2">
          {section.title}
        </h3>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {sectionFields.map(field => {
          if (hiddenFieldIds.has(field.id)) return null;

          // Calculate column span based on width prop
          let colSpan = 'col-span-1';
          if (field.width === 'full') colSpan = 'col-span-1 md:col-span-2 lg:col-span-4';
          if (field.width === '1/2') colSpan = 'col-span-1 md:col-span-1 lg:col-span-2';

          return (
            <div key={field.id} className={colSpan}>
              <DynamicFieldRenderer
                field={field}
                value={values[field.name]}
                error={errors[field.name]}
                onChange={(val) => onChange(field.name, val)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
