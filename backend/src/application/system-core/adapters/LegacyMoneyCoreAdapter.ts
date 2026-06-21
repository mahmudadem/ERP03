import { CashRoundingRule, IMoneyCore } from '../contracts/IMoneyCore';
import { roundCash, roundMoney, toBase } from '../money/roundMoney';

export class LegacyMoneyCoreAdapter implements IMoneyCore {
  round(value: number, currency: string): number {
    return roundMoney(value, currency);
  }

  roundCash(value: number, currency: string, rule?: CashRoundingRule | null): number {
    return roundCash(value, currency, rule);
  }

  toBase(value: number, currency: string, rate: number, baseCurrency = currency): number {
    return toBase(value, currency, rate, baseCurrency);
  }
}

