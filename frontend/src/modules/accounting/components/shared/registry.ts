import React from 'react';
import { AccountSelector } from './AccountSelector';
import { CostCenterSelector } from './CostCenterSelector';
import { CurrencyExchangeWidget } from './CurrencyExchangeWidget';

/**
 * Registry of custom components used in the Voucher Designer and Renderer.
 * This allows us to decouple the generic renderer from specific business components.
 */

export interface CustomComponentProps {
  value: any;
  onChange: (value: any) => void;
  error?: string;
  disabled?: boolean;
  field?: any;
  context?: any;
  currency?: string;
  baseCurrency?: string;  // For CurrencyExchangeWidget
  voucherDate?: string;   // For CurrencyExchangeWidget
}

export const CustomComponentRegistry: Record<string, React.ComponentType<CustomComponentProps>> = {
  accountSelector: AccountSelector as any,
  account: AccountSelector as any, 
  accountId: AccountSelector as any,
  account_id: AccountSelector as any,
  accountID: AccountSelector as any,
  payToAccountId: AccountSelector as any,
  payFromAccountId: AccountSelector as any,
  depositToAccountId: AccountSelector as any,
  receiveFromAccountId: AccountSelector as any,
  buyAccountId: AccountSelector as any,
  sellAccountId: AccountSelector as any,
  fromAccountId: AccountSelector as any,
  toAccountId: AccountSelector as any,
  costCenterSelector: CostCenterSelector as any,
  costCenter: CostCenterSelector as any,
  costCenterId: CostCenterSelector as any,
  cost_center_id: CostCenterSelector as any,
  currencyExchange: CurrencyExchangeWidget as any,
};

export type CustomComponentType = keyof typeof CustomComponentRegistry;

export default CustomComponentRegistry;

