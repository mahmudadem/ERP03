import React, { useState, useEffect } from 'react';
import { accountingApi } from '../../../api/accountingApi';

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
  required = false
}) => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const data = await accountingApi.getAccounts();
        setAccounts(data || []);
      } catch (error) {
        console.error('Failed to load accounts:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAccounts();
  }, []);

  if (loading) {
    return (
      <div>
        <label>{label} {required && '*'}</label>
        <select disabled>
          <option>Loading accounts...</option>
        </select>
      </div>
    );
  }

  return (
    <div>
      <label>{label} {required && '*'}</label>
      <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        required={required}
      >
        <option value="">-- Select Account --</option>
        {accounts.map(account => (
          <option key={account.id} value={account.id}>
            {account.code} - {account.name}
          </option>
        ))}
      </select>
    </div>
  );
};
