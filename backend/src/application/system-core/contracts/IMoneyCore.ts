export interface CashRoundingRule {
  increment?: number;
  mode?: 'NEAREST' | 'UP' | 'DOWN';
}

export interface IMoneyCore {
  round(value: number, currency: string): number;
  roundCash(value: number, currency: string, rule?: CashRoundingRule | null): number;
  toBase(value: number, currency: string, rate: number, baseCurrency?: string): number;
}

