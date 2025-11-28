import { useState, useEffect } from 'react';
import { FormDefinition } from '../designer-engine/types/FormDefinition';

// Mock hook
export const useFormDefinition = (formId: string) => {
  const [definition, setDefinition] = useState<FormDefinition | null>(null);

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setDefinition({
        id: formId,
        name: 'Sample Form',
        module: 'CORE',
        version: 1,
        fields: [],
        sections: [],
        rules: []
      });
    }, 500);
  }, [formId]);

  return { definition };
};
