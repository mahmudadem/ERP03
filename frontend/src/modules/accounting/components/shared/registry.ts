import React from 'react';
import { AccountSelector } from './AccountSelector';
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
}

export const CustomComponentRegistry: Record<string, React.ComponentType<CustomComponentProps>> = {
  accountSelector: AccountSelector as any,
  currencyExchange: CurrencyExchangeWidget as any,
};

export type CustomComponentType = keyof typeof CustomComponentRegistry;

export default CustomComponentRegistry;
