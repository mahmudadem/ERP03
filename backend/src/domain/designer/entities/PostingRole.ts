/**
 * PostingRole Enumeration
 * 
 * Defines the semantic meaning of posting fields.
 * Only fields with these roles affect the General Ledger.
 */
export enum PostingRole {
  /**
   * GL Account identifier
   * Used for: Debit/Credit account selection
   */
  ACCOUNT = 'ACCOUNT',

  /**
   * Transaction amount
   * Used for: Debit/Credit values, payment amounts
   */
  AMOUNT = 'AMOUNT',

  /**
   * Transaction date
   * Used for: Posting period determination
   */
  DATE = 'DATE',

  /**
   * Currency code
   * Used for: Multi-currency support
   */
  CURRENCY = 'CURRENCY',

  /**
   * Foreign exchange rate
   * Used for: Currency conversion
   */
  EXCHANGE_RATE = 'EXCHANGE_RATE',

  /**
   * Item quantity
   * Used for: Inventory/unit tracking
   */
  QUANTITY = 'QUANTITY',

  /**
   * Tax amount or rate
   * Used for: Tax calculation
   */
  TAX = 'TAX'
}
