import React from 'react';
import { useCostCenters } from '../../../../context/CostCentersContext';

interface Props {
  value?: string | null;
  onChange: (ccId: string | null) => void;
  placeholder?: string;
}

export const CostCenterSelector: React.FC<Props> = ({ value, onChange, placeholder }) => {
  const { costCenters, loading } = useCostCenters();
  return (
    <select
      className="w-full px-3 py-2 border rounded-md text-sm"
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={loading}
    >
      <option value="">{placeholder || 'Select cost center'}</option>
      {costCenters.map((cc) => (
        <option key={cc.id} value={cc.id}>
          {cc.code} — {cc.name}
        </option>
      ))}
    </select>
  );
};
