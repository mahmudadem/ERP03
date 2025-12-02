import { useEffect, useState } from 'react';
import { CompanyWizardField } from './api';
import { useWizardSession } from './context/WizardSessionContext';
import { Button } from '../../components/ui/Button';

interface Props {
  field: CompanyWizardField;
  value: any;
  onChange: (value: any) => void;
}

export const WizardFieldRenderer: React.FC<Props> = ({ field, value, onChange }) => {
  const { sessionId } = useWizardSession();
  const [options, setOptions] = useState<Array<{ id: string; label: string }> | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    const loadOptions = async () => {
      if (field.type !== 'select' || !field.optionsSource || !sessionId) return;
      setLoadingOptions(true);
      try {
        const { wizardApi } = await import('./api');
        const opts = await wizardApi.getOptions(sessionId, field.id);
        setOptions(opts);
      } catch (err) {
        console.error('Failed to load options', err);
      } finally {
        setLoadingOptions(false);
      }
    };
    loadOptions();
  }, [field, sessionId]);

  const label = field.labelEn;

  if (field.type === 'boolean') {
    return (
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4"
        />
        <span className="text-sm text-gray-800">{label}{field.required ? ' *' : ''}</span>
      </label>
    );
  }

  if (field.type === 'select') {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-800">
          {label} {field.required ? '*' : ''}
        </label>
        <select
          className="border rounded px-3 py-2 text-sm"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={loadingOptions}
        >
          <option value="">Select...</option>
          {options?.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        {loadingOptions && <span className="text-xs text-gray-500">Loading options...</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-800">
        {label} {field.required ? '*' : ''}
      </label>
      <input
        type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
        value={value ?? ''}
        onChange={(e) => {
          const val = field.type === 'number' ? Number(e.target.value) : e.target.value;
          onChange(val);
        }}
        className="border rounded px-3 py-2 text-sm"
      />
      {field.type === 'date' && value === undefined && (
        <Button variant="ghost" size="sm" onClick={() => onChange(new Date().toISOString().slice(0, 10))}>
          Use Today
        </Button>
      )}
    </div>
  );
};
