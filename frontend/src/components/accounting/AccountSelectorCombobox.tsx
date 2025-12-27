import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { accountingApi } from '../../api/accountingApi';
import { Combobox } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid';

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface AccountSelectorProps {
  value: string; // Account ID
  onChange: (accountId: string, account?: Account) => void;
  className?: string;
  placeholder?: string;
  noBorder?: boolean; // For use in table cells
}

export const AccountSelectorCombobox: React.FC<AccountSelectorProps> = ({ 
  value, 
  onChange, 
  className = "",
  placeholder = "Select account...",
  noBorder = false
}) => {
  const [query, setQuery] = useState('');

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounting', 'accounts'],
    queryFn: () => accountingApi.getAccounts(),
    staleTime: 5 * 60 * 1000,
  });

  const selectedAccount = accounts.find(a => a.id === value);

  const filteredAccounts =
    query === ''
      ? accounts
      : accounts.filter((account) => {
          const searchStr = `${account.code} ${account.name}`.toLowerCase();
          return searchStr.includes(query.toLowerCase());
        });

  if (isLoading) {
    return <div className="animate-pulse h-9 bg-gray-100 rounded-md w-full"></div>;
  }

  // DEBUG: Verify noBorder value
  if (noBorder) {
    console.log('🔴 AccountSelector rendering with noBorder=true');
  }

  return (
    <Combobox value={selectedAccount || null} onChange={(account: Account | null) => {
      if (account) onChange(account.id, account);
    }}>
      <div className={`relative ${noBorder ? '' : 'mt-1'} ${className}`}>
        <div 
          className={`relative w-full cursor-default overflow-hidden ${noBorder ? 'rounded-none bg-transparent' : 'rounded-md bg-white border border-gray-300'} text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-300 sm:text-sm`}
          style={noBorder ? { border: 'none', boxShadow: 'none' } : undefined}
        >
          <Combobox.Input
            className={`w-full border-none ${noBorder ? 'py-1 pl-2 pr-8' : 'py-2 pl-3 pr-10'} text-sm leading-5 text-gray-900 focus:ring-0 bg-transparent`}
            displayValue={(account: Account) => account ? `${account.code} - ${account.name}` : ''}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
          />
          <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
            <ChevronUpDownIcon
              className="h-5 w-5 text-gray-400"
              aria-hidden="true"
            />
          </Combobox.Button>
        </div>
        <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
          {filteredAccounts.length === 0 && query !== '' ? (
            <div className="relative cursor-default select-none py-2 px-4 text-gray-700">
              Nothing found.
            </div>
          ) : (
            filteredAccounts.map((account) => (
              <Combobox.Option
                key={account.id}
                className={({ active }) =>
                  `relative cursor-default select-none py-2 pl-10 pr-4 ${
                    active ? 'bg-blue-600 text-white' : 'text-gray-900'
                  }`
                }
                value={account}
              >
                {({ selected, active }) => (
                  <>
                    <span
                      className={`block truncate ${
                        selected ? 'font-medium' : 'font-normal'
                      }`}
                    >
                      {account.code} - {account.name}
                    </span>
                    {selected ? (
                      <span
                        className={`absolute inset-y-0 left-0 flex items-center pl-3 ${
                          active ? 'text-white' : 'text-blue-600'
                        }`}
                      >
                        <CheckIcon className="h-5 w-5" aria-hidden="true" />
                      </span>
                    ) : null}
                  </>
                )}
              </Combobox.Option>
            ))
          )}
        </Combobox.Options>
      </div>
    </Combobox>
  );
};
