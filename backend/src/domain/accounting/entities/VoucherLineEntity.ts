import { TransactionSide } from '../types/VoucherTypes';

/**
 * VoucherLine Value Object (Immutable)
 * 
 * ADR-005 Compliant Implementation
 * 
 * Represents a single debit or credit line in a voucher.
 * Supports mixed FX currencies within the same voucher.
 * 
 * Key principles:
 * - Immutable (readonly properties)
 * - Self-validating (validation in constructor)
 * - Stores BOTH transaction (FX) and base currency amounts
 * - Exchange rate frozen at transaction time
 * - baseCurrency must match company base currency
 * 
 * ROUNDING RULE:
 * - baseAmount is rounded to 2 decimal places using STANDARD rounding (Math.round)
 * - When creating FX lines, caller should compute: baseAmount = roundMoney(amount * exchangeRate)
 * - Constructor validates that baseAmount matches roundMoney(amount * exchangeRate) within MONEY_EPS
 */

// ========== MONEY CONSTANTS ==========

/** Epsilon for money comparisons (1 cent tolerance) */
export const MONEY_EPS = 0.01;

/** Default decimal places for money rounding */
export const MONEY_DECIMALS = 2;

/**
 * Round a monetary value to specified decimal places using STANDARD rounding.
 * 
 * NOTE: This uses Math.round (round half away from zero), NOT banker's rounding (half-even).
 * For accounting purposes, standard rounding is acceptable as long as it's applied consistently.
 * 
 * @param value The value to round
 * @param decimals Number of decimal places (default: 2 for currency)
 * @returns Rounded value
 */
export function roundMoney(value: number, decimals: number = MONEY_DECIMALS): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Check if two money values are equal within MONEY_EPS tolerance
 */
export function moneyEquals(a: number, b: number): boolean {
  return Math.abs(a - b) <= MONEY_EPS;
}

export class VoucherLineEntity {
  constructor(
    public readonly id: number,
    public readonly accountId: string,
    public readonly side: TransactionSide,
    
    // Base currency (for accounting/reporting - matches company base)
    public readonly baseAmount: number,
    public readonly baseCurrency: string,
    
    // Transaction currency (FX - may differ per line)
    public readonly amount: number,
    public readonly currency: string,
    
    // FX metadata (rate at transaction time)
    public readonly exchangeRate: number,
    
    // Optional fields
    public readonly notes?: string,
    public readonly costCenterId?: string,
    
    // Metadata (Generic extra fields)
    public readonly metadata: Record<string, any> = {}
  ) {
    // ========== INVARIANT VALIDATIONS ==========
    
    // Invariant: side must be Debit or Credit
    if (side !== 'Debit' && side !== 'Credit') {
      throw new Error(`Invalid side: ${side}. Must be 'Debit' or 'Credit'`);
    }
    
    // Invariant: accountId required
    if (!accountId || accountId.trim() === '') {
      throw new Error('VoucherLine accountId is required');
    }
    
    // Invariant: currency codes required
    if (!baseCurrency || baseCurrency.trim() === '') {
      throw new Error('VoucherLine baseCurrency is required');
    }
    
    if (!currency || currency.trim() === '') {
      throw new Error('VoucherLine currency is required');
    }
    
    // Invariant: baseAmount must be positive
    if (baseAmount <= 0) {
      throw new Error(`VoucherLine baseAmount must be positive, got: ${baseAmount}`);
    }
    
    // Invariant: amount must be positive
    if (amount <= 0) {
      throw new Error(`VoucherLine amount must be positive, got: ${amount}`);
    }
    
    // ========== FX-SPECIFIC INVARIANTS ==========
    
    if (currency === baseCurrency) {
      // Same currency: exchangeRate must be 1
      if (exchangeRate !== 1) {
        throw new Error(
          `When currency equals baseCurrency, exchangeRate must be 1. Got: ${exchangeRate}`
        );
      }
      
      // Same currency: amount should equal baseAmount (within MONEY_EPS)
      if (!moneyEquals(amount, baseAmount)) {
        throw new Error(
          `When currency equals baseCurrency, amount (${amount}) must equal baseAmount (${baseAmount})`
        );
      }
    } else {
      // Different currency (FX line)
      
      // Invariant: exchangeRate must be present and positive
      if (!exchangeRate || exchangeRate <= 0) {
        throw new Error(
          `FX line requires positive exchangeRate. Got: ${exchangeRate}`
        );
      }
      
      // Invariant: baseAmount must match roundMoney(amount * exchangeRate)
      const expectedBaseAmount = roundMoney(amount * exchangeRate);
      
      if (!moneyEquals(baseAmount, expectedBaseAmount)) {
        throw new Error(
          `baseAmount (${baseAmount}) does not match amount * exchangeRate. ` +
          `Expected: ${expectedBaseAmount} (${amount} * ${exchangeRate})`
        );
      }
    }
  }

  /**
   * Get debit amount in base currency (0 if this is a credit line)
   */
  get debitAmount(): number {
    return this.side === 'Debit' ? this.baseAmount : 0;
  }

  /**
   * Get credit amount in base currency (0 if this is a debit line)
   */
  get creditAmount(): number {
    return this.side === 'Credit' ? this.baseAmount : 0;
  }

  /**
   * Check if this line is a debit
   */
  get isDebit(): boolean {
    return this.side === 'Debit';
  }

  /**
   * Check if this line is a credit
   */
  get isCredit(): boolean {
    return this.side === 'Credit';
  }

  /**
   * Check if this involves foreign currency
   */
  get isForeignCurrency(): boolean {
    return this.currency !== this.baseCurrency;
  }

  /**
   * Convert to plain object for persistence
   */
  toJSON(): Record<string, any> {
    return {
      id: this.id,
      accountId: this.accountId,
      side: this.side,
      baseAmount: this.baseAmount,
      baseCurrency: this.baseCurrency,
      amount: this.amount,
      currency: this.currency,
      exchangeRate: this.exchangeRate,
      notes: this.notes || null,
      costCenterId: this.costCenterId || null,
      metadata: this.metadata
    };
  }

  /**
   * Create from plain object (for deserialization)
   * 
   * V2 ONLY - No legacy format support.
   * Legacy data migration should be done via separate migration script.
   */
  static fromJSON(data: any): VoucherLineEntity {
    if (data.side === undefined || data.baseCurrency === undefined) {
      throw new Error(
        'Invalid VoucherLineEntity data: missing required V2 fields (side, baseCurrency). ' +
        'Legacy data must be migrated before use.'
      );
    }
    
    return new VoucherLineEntity(
      data.id,
      data.accountId,
      data.side as TransactionSide,
      data.baseAmount,
      data.baseCurrency,
      data.amount,
      data.currency,
      data.exchangeRate,
      data.notes,
      data.costCenterId,
      data.metadata || {}
    );
  }

  /**
   * Create a new line with updated notes (immutable update)
   */
  withNotes(notes: string): VoucherLineEntity {
    return new VoucherLineEntity(
      this.id,
      this.accountId,
      this.side,
      this.baseAmount,
      this.baseCurrency,
      this.amount,
      this.currency,
      this.exchangeRate,
      notes,
      this.costCenterId,
      this.metadata
    );
  }
}
