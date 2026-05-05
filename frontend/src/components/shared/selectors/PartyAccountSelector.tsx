import React from 'react';
import { PartySelector } from './PartySelector';
import type { PartyDTO, PartyRole } from '../../../api/sharedApi';
import { AccountSelector } from '../../../modules/accounting/components/shared/AccountSelector';
import type { Account } from '../../../context/AccountsContext';

export interface PartyAccountSelectorValue {
  partyId: string;
  accountId: string;
}

interface PartyAccountSelectorProps {
  role: PartyRole;
  value?: PartyAccountSelectorValue | string | null;
  accountValue?: string;
  disabled?: boolean;
  noBorder?: boolean;
  className?: string;
  onChange: (next: PartyAccountSelectorValue) => void;
}

const resolvePartyId = (value?: PartyAccountSelectorValue | string | null): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return String(value.partyId || '');
};

const resolveAccountId = (
  value?: PartyAccountSelectorValue | string | null,
  accountValue?: string
): string => {
  if (accountValue) return accountValue;
  if (!value || typeof value === 'string') return '';
  return String(value.accountId || '');
};

export const PartyAccountSelector: React.FC<PartyAccountSelectorProps> = ({
  role,
  value,
  accountValue,
  disabled = false,
  noBorder = false,
  className = '',
  onChange,
}) => {
  const partyId = resolvePartyId(value);
  const currentAccountId = resolveAccountId(value, accountValue);

  const handlePartyChange = (party: PartyDTO | null) => {
    const nextPartyId = party?.id || party?.code || '';
    const suggestedAccount =
      role === 'CUSTOMER'
        ? (party?.defaultARAccountId || '')
        : (party?.defaultAPAccountId || '');

    onChange({
      partyId: nextPartyId,
      accountId: suggestedAccount || currentAccountId || '',
    });
  };

  const handleAccountChange = (account: Account | null) => {
    const nextAccountId = account?.id || account?.code || '';
    onChange({
      partyId,
      accountId: nextAccountId,
    });
  };

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-2 ${className}`}>
      <PartySelector
        value={partyId}
        onChange={handlePartyChange}
        role={role}
        disabled={disabled}
        noBorder={noBorder}
        placeholder={role === 'CUSTOMER' ? 'Select customer...' : 'Select vendor...'}
      />
      <AccountSelector
        value={currentAccountId}
        onChange={handleAccountChange}
        disabled={disabled}
        noBorder={noBorder}
        placeholder={role === 'CUSTOMER' ? 'A/R account...' : 'A/P account...'}
      />
    </div>
  );
};

export interface CustomerAccountSelectorProps {
  value?: PartyAccountSelectorValue | string | null;
  accountValue?: string;
  disabled?: boolean;
  noBorder?: boolean;
  className?: string;
  onChange: (next: PartyAccountSelectorValue) => void;
}

export const CustomerAccountSelector: React.FC<CustomerAccountSelectorProps> = (props) => {
  return <PartyAccountSelector {...props} role="CUSTOMER" />;
};

export interface VendorAccountSelectorProps {
  value?: PartyAccountSelectorValue | string | null;
  accountValue?: string;
  disabled?: boolean;
  noBorder?: boolean;
  className?: string;
  onChange: (next: PartyAccountSelectorValue) => void;
}

export const VendorAccountSelector: React.FC<VendorAccountSelectorProps> = (props) => {
  return <PartyAccountSelector {...props} role="VENDOR" />;
};

