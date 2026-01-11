/**
 * Exchange Rate Entity
 * 
 * Represents a stored exchange rate for a specific date.
 * Multiple rates per (company, pair, date) are allowed.
 */

export type ExchangeRateSource = 'MANUAL' | 'REFERENCE';

export interface ExchangeRateProps {
  id: string;
  companyId: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  date: Date;
  source: ExchangeRateSource;
  createdAt: Date;
  createdBy?: string;
}

export class ExchangeRate {
  public readonly id: string;
  public readonly companyId: string;
  public readonly fromCurrency: string;
  public readonly toCurrency: string;
  public readonly rate: number;
  public readonly date: Date;
  public readonly source: ExchangeRateSource;
  public readonly createdAt: Date;
  public readonly createdBy?: string;

  constructor(props: ExchangeRateProps) {
    if (props.rate <= 0) {
      throw new Error('Exchange rate must be positive');
    }
    if (!props.fromCurrency || !props.toCurrency) {
      throw new Error('Currency codes are required');
    }

    this.id = props.id;
    this.companyId = props.companyId;
    this.fromCurrency = props.fromCurrency.toUpperCase();
    this.toCurrency = props.toCurrency.toUpperCase();
    this.rate = props.rate;
    this.date = props.date;
    this.source = props.source;
    this.createdAt = props.createdAt;
    this.createdBy = props.createdBy;
  }

  /**
   * Date as ISO date string (YYYY-MM-DD)
   */
  get dateString(): string {
    return this.date.toISOString().split('T')[0];
  }

  /**
   * Check if this rate is for the same currency pair
   */
  isSamePair(fromCurrency: string, toCurrency: string): boolean {
    return (
      this.fromCurrency === fromCurrency.toUpperCase() &&
      this.toCurrency === toCurrency.toUpperCase()
    );
  }

  toJSON(): ExchangeRateProps {
    return {
      id: this.id,
      companyId: this.companyId,
      fromCurrency: this.fromCurrency,
      toCurrency: this.toCurrency,
      rate: this.rate,
      date: this.date,
      source: this.source,
      createdAt: this.createdAt,
      createdBy: this.createdBy,
    };
  }

  static fromJSON(data: ExchangeRateProps): ExchangeRate {
    return new ExchangeRate({
      ...data,
      date: new Date(data.date),
      createdAt: new Date(data.createdAt),
    });
  }
}
