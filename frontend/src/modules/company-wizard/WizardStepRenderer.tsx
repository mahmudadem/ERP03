import React from 'react';
import { CompanyWizardStep } from './api';
import { WizardFieldRenderer } from './WizardFieldRenderer';
import { useTranslation } from "react-i18next";

interface Props {
  step: CompanyWizardStep;
  values: Record<string, any>;
  onChange: (fieldId: string, value: any) => void;
}

export const WizardStepRenderer: React.FC<Props> = ({ step, values, onChange }) => {
    const { t } = useTranslation('common');
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">{step.titleEn}</h2>
        <p className="text-sm text-gray-500">{t(`Step #`)}{step.order}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {step.fields.map((field) => (
          <WizardFieldRenderer
            key={field.id}
            field={field}
            value={values[field.id]}
            onChange={(val) => onChange(field.id, val)}
          />
        ))}
      </div>
    </div>
  );
};
