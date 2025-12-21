import { VoucherLineEntity } from '../entities/VoucherLineEntity';

/**
 * Payment Voucher Input Data
 * 
 * What a user provides when creating a payment voucher.
 * This is the input DTO (Data Transfer Object).
 */
export interface PaymentVoucherInput {
  // Required fields
  date: string;                    // ISO date (YYYY-MM-DD)
  amount: number;                  // Payment amount
  cashAccountId: string;           // Account to pay FROM (Cash/Bank) - will be CREDITED
  expenseAccountId: string;        // Account to pay TO (Expense/Payable) - will be DEBITED
  description: string;             // Payment description

  // Currency (optional, defaults to base currency)
  currency?: string;

  // Optional fields
  notes?: string;
  costCenterId?: string;
}

/**
 * Payment Voucher Handler
 * 
 * ADR-005 Reference Implementation
 * 
 * This is the ONLY voucher type fully implemented.
 * It serves as the reference for how all voucher handlers should work.
 * 
 * EXPLICIT POSTING LOGIC:
 * -------------------
 * Payment vouchers ALWAYS create exactly 2 lines:
 * 
 * 1. DEBIT: Expense/Payable Account (increase expense or decrease liability)
 * 2. CREDIT: Cash/Bank Account (decrease asset - money going out)
 * 
 * Example:
 * Pay $100 for office supplies:
 *   DR: Office Supplies Expense  $100
 *   CR: Cash/Bank Account        $100
 * 
 * The logic is HARD-CODED and EXPLICIT - no runtime evaluation.
 * An accountant can read this code and immediately know what will be posted.
 */
export class PaymentVoucherHandler {
  /**
   * Validate payment input
   * 
   * Checks business rules before creating lines.
   * This runs BEFORE posting logic.
   */
  async validate(input: PaymentVoucherInput): Promise<void> {
    const errors: string[] = [];

    // Required fields
    if (!input.date || input.date.trim() === '') {
      errors.push('Date is required');
    }

    if (!input.amount || input.amount <= 0) {
      errors.push('Amount must be greater than zero');
    }

    if (!input.cashAccountId || input.cashAccountId.trim() === '') {
      errors.push('Cash/Bank account is required');
    }

    if (!input.expenseAccountId || input.expenseAccountId.trim() === '') {
      errors.push('Expense/Payable account is required');
    }

    if (!input.description || input.description.trim() === '') {
      errors.push('Description is required');
    }

    // Business rule: Cannot pay from and to the same account
    if (input.cashAccountId === input.expenseAccountId) {
      errors.push('Cash account and expense account cannot be the same');
    }

    if (errors.length > 0) {
      throw new Error(`Payment voucher validation failed:\n${errors.join('\n')}`);
    }
  }

  /**
   * Create voucher lines for payment
   * 
   * EXPLICIT POSTING LOGIC - This is the core accounting logic.
   * 
   * Every payment creates exactly 2 lines:
   * - Line 1: DEBIT the expense/payable account
   * - Line 2: CREDIT the cash/bank account
   * 
   * No dynamic rules. No field mapping. No runtime evaluation.
   * Just clear, auditable, accounting logic.
   * 
   * @param input Payment data from user
   * @param baseCurrency Company's base currency
   * @param exchangeRate FX rate (from currency service)
   * @returns Array of exactly 2 voucher lines
   */
  createLines(
    input: PaymentVoucherInput,
    baseCurrency: string,
    exchangeRate: number
  ): VoucherLineEntity[] {
    const currency = input.currency || baseCurrency;
    const amount = input.amount;
    const baseAmount = amount * exchangeRate;

    // Line 1: DEBIT Expense/Payable
    const debitLine = new VoucherLineEntity(
      1,  // Line ID
      input.expenseAccountId,
      'Debit',
      amount,
      currency,
      baseAmount,
      baseCurrency,
      exchangeRate,
      input.notes || input.description,
      input.costCenterId
    );

    // Line 2: CREDIT Cash/Bank
    const creditLine = new VoucherLineEntity(
      2,  // Line ID
      input.cashAccountId,
      'Credit',
      amount,
      currency,
      baseAmount,
      baseCurrency,
      exchangeRate,
      input.notes || input.description,
      input.costCenterId
    );

    // ALWAYS return exactly 2 lines
    // This is the contract of a payment voucher
    return [debitLine, creditLine];
  }

  /**
   * Get human-readable description of posting logic
   * 
   * For documentation and audit purposes.
   */
  getPostingDescription(): string {
    return `Payment Voucher Posting Logic:
    
    Line 1: DEBIT  - Expense/Payable Account (increases expense or reduces liability)
    Line 2: CREDIT - Cash/Bank Account (reduces cash/bank balance)
    
    Example: Pay $100 rent
      DR: Rent Expense        $100
      CR: Bank Account        $100
    
    This represents money leaving the company to pay an expense or settle a payable.
    `;
  }
}
