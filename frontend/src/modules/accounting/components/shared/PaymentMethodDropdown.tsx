
import React from 'react';
import { useAccountingSettings } from '../../hooks/useAccountingSettings';
import { ChevronDown, Loader2 } from 'lucide-react';

interface PaymentMethodDropdownProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  onBlur?: () => void;
}

export const PaymentMethodDropdown: React.FC<PaymentMethodDropdownProps> = ({
  value,
  onChange,
  disabled,
  readOnly,
  onBlur
}) => {
  const { data: settings, isLoading } = useAccountingSettings();
  const paymentMethods = settings?.paymentMethods || [];
  const enabledMethods = paymentMethods.filter(pm => pm.isEnabled);

  // If there's a value that's not in enabled methods (legacy), we should still show it
  const showValue = value && !enabledMethods.find(m => m.name === value);
  
  return (
    <div className="relative">
      <select 
        value={value || ''}
        disabled={disabled || readOnly || isLoading}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={`w-full p-1.5 border border-[var(--color-border)] rounded bg-[var(--color-bg-primary)] text-xs text-[var(--color-text-primary)] focus:ring-1 focus:ring-primary-500 outline-none shadow-sm appearance-none pr-8 transition-colors ${readOnly || disabled ? 'bg-[var(--color-bg-secondary)] cursor-not-allowed opacity-80' : ''}`}
      >
        {!isLoading && enabledMethods.length === 0 && <option value="">No payment methods configured</option>}
        {enabledMethods.map(pm => (
          <option key={pm.id} value={pm.name}>
            {pm.name}
          </option>
        ))}
        {showValue && (
          <option value={value}>{value} (Inactive/Legacy)</option>
        )}
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
