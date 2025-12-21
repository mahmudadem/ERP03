import { v4 as uuidv4 } from 'uuid';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { VoucherType, VoucherStatus } from '../../../domain/accounting/types/VoucherTypes';
import { JournalEntryHandler, JournalEntryInput } from '../../../domain/accounting/handlers/JournalEntryHandler';
import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { IExchangeRateService, ICompanyService, IVoucherNumberGenerator } from './SavePaymentVoucherUseCase';

/**
 * Save Journal Entry Voucher Use Case
 * 
 * ADR-005 Compliant - Same Pattern as Payment/Receipt
 * 
 * This implements journal entry creation following the exact same
 * pattern as payment and receipt vouchers.
 * 
 * The difference: Handler accepts user-defined debits/credits
 * instead of a fixed posting pattern.
 * 
 * Flow (Identical to Payment/Receipt):
 * 1. Validate input (including balance check)
 * 2. Get base currency and exchange rate
 * 3. Use handler to create lines (EXPLICIT conversion)
 * 4. Create voucher entity
 * 5. Calculate totals
 * 6. Generate voucher number
 * 7. Save to repository
 * 8. Return saved voucher
 * 
 * No approval workflow - voucher starts as DRAFT.
 */
export class SaveJournalEntryUseCase {
  private readonly handler: JournalEntryHandler;

  constructor(
    private readonly voucherRepository: IVoucherRepository,
    private readonly exchangeRateService: IExchangeRateService,
    private readonly companyService: ICompanyService,
    private readonly numberGenerator: IVoucherNumberGenerator
  ) {
    this.handler = new JournalEntryHandler();
  }

  /**
   * Execute the use case
   * 
   * @param input Journal entry data
   * @param companyId Company ID
   * @param userId User creating the voucher
   * @returns Saved voucher entity
   */
  async execute(
    input: JournalEntryInput,
    companyId: string,
    userId: string
  ): Promise<VoucherEntity> {
    // Step 1: Validate input using handler
    // This includes validating that debits = credits
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

    // Step 4: Create lines using handler (EXPLICIT CONVERSION)
    // Handler converts user's debit/credit input to voucher lines
    const lines = this.handler.createLines(input, baseCurrency, exchangeRate);

    // Step 5: Calculate totals (validation happens in constructor)
    const totalDebit = lines.reduce((sum: number, line) => sum + line.debitAmount, 0);
    const totalCredit = lines.reduce((sum: number, line) => sum + line.creditAmount, 0);

    // Step 6: Generate unique voucher number
    const voucherNo = await this.numberGenerator.generate(
      companyId,
      VoucherType.JOURNAL_ENTRY,
      input.date
    );

    // Step 7: Create voucher entity
    // Entity validation ensures debits = credits
    const voucher = new VoucherEntity(
      uuidv4(),  // Generate ID
      companyId,
      voucherNo,
      VoucherType.JOURNAL_ENTRY,
      input.date,
      input.description,
      currency,
      baseCurrency,
      exchangeRate,
      lines,  // Readonly array
      totalDebit,
      totalCredit,
      VoucherStatus.DRAFT,  // Always starts as DRAFT
      userId,
      new Date()  // Created at
    );

    // Step 8: Save to repository
    const savedVoucher = await this.voucherRepository.save(voucher);

    return savedVoucher;
  }
}
