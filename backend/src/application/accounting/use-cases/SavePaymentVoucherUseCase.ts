import { v4 as uuidv4 } from 'uuid';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { VoucherType, VoucherStatus } from '../../../domain/accounting/types/VoucherTypes';
import { PaymentVoucherHandler, PaymentVoucherInput } from '../../../domain/accounting/handlers/PaymentVoucherHandler';
import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';

/**
 * Exchange Rate Service Interface
 * 
 * Simple contract for getting exchange rates.
 * Implementation can fetch from database or external API.
 */
export interface IExchangeRateService {
  /**
   * Get exchange rate for a date
   * 
   * @param fromCurrency Source currency code
   * @param toCurrency Target currency code
   * @param date Transaction date (ISO format)
   * @returns Exchange rate (1 if same currency)
   */
  getRate(fromCurrency: string, toCurrency: string, date: string): Promise<number>;
}

/**
 * Company Service Interface
 * 
 * Get company details (specifically base currency)
 */
export interface ICompanyService {
  /**
   * Get company's base currency
   */
  getBaseCurrency(companyId: string):Promise<string>;
}

/**
 * Voucher Number Generator Interface
 * 
 * Generates unique voucher numbers per company
 */
export interface IVoucherNumberGenerator {
  /**
   * Generate next voucher number
   * 
   * Format: {TYPE}-{YEAR}-{SEQUENCE}
   * Example: PAY-2025-001
   */
  generate(companyId: string, type: VoucherType, date: string): Promise<string>;
}

/**
 * Save Payment Voucher Use Case
 * 
 * ADR-005 Reference Implementation
 * 
 * This is the ONLY fully implemented voucher use case.
 * It demonstrates:
 * - Clean separation of concerns
 * - Explicit business logic
 * - Proper error handling
 * - Complete audit trail
 * - Simple, state-based status (DRAFT)
 * 
 * Flow:
 * 1. Validate input
 * 2. Get base currency and exchange rate
 * 3. Use handler to create lines (EXPLICIT posting)
 * 4. Create voucher entity
 * 5. Calculate totals
 * 6. Generate voucher number
 * 7. Save to repository
 * 8. Return saved voucher
 * 
 * No approval workflow - voucher starts as DRAFT.
 * Approval is handled by separate use case.
 */
export class SavePaymentVoucherUseCase {
  private readonly handler: PaymentVoucherHandler;

  constructor(
    private readonly voucherRepository: IVoucherRepository,
    private readonly exchangeRateService: IExchangeRateService,
    private readonly companyService: ICompanyService,
    private readonly numberGenerator: IVoucherNumberGenerator
  ) {
    this.handler = new PaymentVoucherHandler();
  }

  /**
   * Execute the use case
   * 
   * @param input Payment voucher data
   * @param companyId Company ID
   * @param userId User creating the voucher
   * @returns Saved voucher entity
   */
  async execute(
    input: PaymentVoucherInput,
    companyId: string,
    userId: string
  ): Promise<VoucherEntity> {
    // Step 1: Validate input using handler
    await this.handler.validate(input);

    // Step 2: Get company base currency
    const baseCurrency = await this.companyService.getBaseCurrency(companyId);
    const currency = input.currency || baseCurrency;

    // Step 3: Get exchange rate
    let exchangeRate = 1.0;
    if (currency !== baseCurrency) {
      exchangeRate = await this.exchangeRateService.getRate(
        currency,
        baseCurrency,
        input.date
      );

      if (exchangeRate <= 0) {
        throw new Error(`Invalid exchange rate: ${exchangeRate}`);
      }
    }

    // Step 4: Create lines using handler (EXPLICIT POSTING LOGIC)
    const lines = this.handler.createLines(input, baseCurrency, exchangeRate);

    // Step 5: Calculate totals (validation happens in constructor)
    const totalDebit = lines.reduce((sum, line) => sum + line.debitAmount, 0);
    const totalCredit = lines.reduce((sum, line) => sum + line.creditAmount, 0);

    // Step 6: Generate unique voucher number
    const voucherNo = await this.numberGenerator.generate(
      companyId,
      VoucherType.PAYMENT,
      input.date
    );

    // Step 7: Create voucher entity
    // Entity validation ensures debits = credits
    const voucher = new VoucherEntity(
      uuidv4(),  // Generate ID
      companyId,
      voucherNo,
      VoucherType.PAYMENT,
      input.date,
      input.description,
      currency,
      baseCurrency,
      exchangeRate,
      lines,  // Readonly array
      totalDebit,
      totalCredit,
      VoucherStatus.DRAFT,  // Always starts as DRAFT
      {}, // metadata
      userId,
      new Date()  // Created at
    );

    // Step 8: Save to repository
    const savedVoucher = await this.voucherRepository.save(voucher);

    return savedVoucher;
  }
}
