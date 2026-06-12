import React from 'react';
import { AccountSelector } from './shared/AccountSelector';

interface AccountSelectorProps {
  value: string;
  onChange: (accountId: string) => void;
  label: string;
  required?: boolean;
}

export const AccountSelectorSimple: React.FC<AccountSelectorProps> = ({
  value,
  onChange,
  label,
  required = false,
}) => {
  return (
    <label className="block text-sm">
      {label && (
        <span className="mb-1 block font-medium text-slate-700">
          {label} {required && '*'}
        </span>
      )}
      <AccountSelector
        value={value}
        onChange={(account) => onChange(account?.id || '')}
        placeholder={label || 'Account'}
        enforceScope
      />
    </label>
  );
};
