/**
 * DynamicFormRenderer.tsx
 * Orchestrates rendering a full form from a FormDefinition.
 * Handles state, rules, and validation.
 */
import React, { useState, useEffect } from 'react';
import { FormDefinition } from '../types/FormDefinition';
import { DynamicSectionRenderer } from './DynamicSectionRenderer';
import { evaluateVisibility } from '../utils/evaluateRules';
import { validateForm } from '../utils/validateForm';
import { Button } from '../../components/ui/Button';

interface Props {
  definition: FormDefinition;
  initialValues?: Record<string, any>;
  onSubmit: (values: Record<string, any>) => void;
  onCancel?: () => void;
  readOnly?: boolean;
}

export const DynamicFormRenderer: React.FC<Props> = ({
  definition,
  initialValues = {},
  onSubmit,
  onCancel,
  readOnly
}) => {
  const [values, setValues] = useState<Record<string, any>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hiddenFieldIds, setHiddenFieldIds] = useState<Set<string>>(new Set());

  // Run rules whenever values change
  useEffect(() => {
    const hidden = evaluateVisibility(definition.rules, values);
    setHiddenFieldIds(hidden);
  }, [values, definition.rules]);

  const handleChange = (fieldName: string, value: any) => {
    setValues(prev => ({ ...prev, [fieldName]: value }));
    // Clear error for this field if it exists
    if (errors[fieldName]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors = validateForm(definition, values);
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {definition.sections.map(section => (
        <DynamicSectionRenderer
          key={section.id}
          section={section}
          allFields={definition.fields}
          values={values}
          errors={errors}
          onChange={handleChange}
          hiddenFieldIds={hiddenFieldIds}
        />
      ))}

      {!readOnly && (
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
           {onCancel && (
             <Button type="button" variant="ghost" onClick={onCancel}>
               Cancel
             </Button>
           )}
           <Button type="submit" variant="primary">
             Save Changes
           </Button>
        </div>
      )}
    </form>
  );
};