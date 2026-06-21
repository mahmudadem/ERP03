import {
  roundByCurrency,
  calculateBaseAmount,
} from '../../../domain/core/entities/CurrencyPrecisionHelpers';
import { CashRoundingRule } from '../contracts/IMoneyCore';

export function roundMoney(value: number, currency = 'USD'): number {
  return roundByCurrency(value, currency);
}

export function roundCash(
  value: number,
  currency: string,
  rule?: CashRoundingRule | null
): number {
  if (!rule?.increment || rule.increment <= 0) {
    return roundMoney(value, currency);
  }

  const scaled = value / rule.increment;
  const rounded =
    rule.mode === 'UP'
      ? Math.ceil(scaled)
      : rule.mode === 'DOWN'
        ? Math.floor(scaled)
        : Math.round(scaled);
  return roundMoney(rounded * rule.increment, currency);
}

export function toBase(value: number, currency: string, rate: number, baseCurrency = currency): number {
  return calculateBaseAmount(value, rate, baseCurrency);
}
