
import React from 'react';
import { useCompanyCurrencies } from '../../hooks/useCompanyCurrencies';
import { ChevronDown, Loader2 } from 'lucide-react';

interface CurrencyDropdownProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
}

export const CurrencyDropdown: React.FC<CurrencyDropdownProps> = ({
  value,
  onChange,
  disabled,
  readOnly
}) => {
  const { data: currencies = [], isLoading } = useCompanyCurrencies();

  return (
    <div className="relative">
      <select 
        value={value || ''}
        disabled={disabled || readOnly || isLoading}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full h-[32px] px-2 pr-8 border border-[var(--color-border)] rounded bg-[var(--color-bg-primary)] text-xs text-[var(--color-text-primary)] focus:ring-1 focus:ring-primary-500 outline-none shadow-sm appearance-none transition-colors ${readOnly || disabled ? 'bg-[var(--color-bg-secondary)] cursor-not-allowed opacity-80' : ''}`}
      >
        {!isLoading && currencies.length === 0 && <option value="">No currencies</option>}
        {currencies.map(c => (
          <option key={c.code} value={c.code}>
            {c.code} - {c.name}
          </option>
        ))}
      </select>
      <div className="absolute top-1/2 right-2 -translate-y-1/2 flex items-center pointer-events-none text-[var(--color-text-muted)]">
        {isLoading ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <ChevronDown size={14} />
        )}
      </div>
    </div>
  );
};
