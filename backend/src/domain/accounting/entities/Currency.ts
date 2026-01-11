/**
 * Currency Value Object
 * 
 * Represents a global currency with fixed properties.
 * Companies can enable/disable currencies but cannot modify their properties.
 */

export interface CurrencyProps {
  code: string;          // ISO 4217 code (e.g., "USD", "EUR", "JPY")
  name: string;          // Display name (e.g., "US Dollar")
  symbol: string;        // Currency symbol (e.g., "$", "€", "¥")
  decimalPlaces: number; // 0 for JPY, 3 for BHD/KWD, 2 for most
  isActive: boolean;
}

export class Currency {
  public readonly code: string;
  public readonly name: string;
  public readonly symbol: string;
  public readonly decimalPlaces: number;
  public readonly isActive: boolean;

  constructor(props: CurrencyProps) {
    if (!props.code || props.code.length !== 3) {
      throw new Error('Currency code must be a 3-letter ISO 4217 code');
    }
    if (props.decimalPlaces < 0 || props.decimalPlaces > 4) {
      throw new Error('Currency decimalPlaces must be between 0 and 4');
    }

    this.code = props.code.toUpperCase();
    this.name = props.name;
    this.symbol = props.symbol;
    this.decimalPlaces = props.decimalPlaces;
    this.isActive = props.isActive;
  }

  /**
   * Round a monetary value according to this currency's precision
   */
  roundAmount(value: number): number {
    const factor = Math.pow(10, this.decimalPlaces);
    return Math.round(value * factor) / factor;
  }

  /**
   * Format a monetary value for display
   */
  formatAmount(value: number): string {
    return value.toFixed(this.decimalPlaces);
  }

  toJSON(): CurrencyProps {
    return {
      code: this.code,
      name: this.name,
      symbol: this.symbol,
      decimalPlaces: this.decimalPlaces,
      isActive: this.isActive,
    };
  }

  static fromJSON(data: CurrencyProps): Currency {
    return new Currency(data);
  }
}
