import { v4 as uuidv4 } from 'uuid';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { VoucherType, VoucherStatus } from '../../../domain/accounting/types/VoucherTypes';
import { OpeningBalanceHandler, OpeningBalanceInput } from '../../../domain/accounting/handlers/OpeningBalanceHandler';
import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { IExchangeRateService, ICompanyService, IVoucherNumberGenerator } from './SavePaymentVoucherUseCase';

/**
 * Save Opening Balance Use Case
 * 
 * ADR-005 Compliant - Same Pattern as All Other Vouchers
 * 
 * This implements opening balance creation for system initialization.
 * Opening Balance is essentially a special Journal Entry that sets
 * initial account balances.
 * 
 * Flow (Identical to Payment/Receipt/Journal):
 * 1. Validate input (including accounting equation check)
 * 2. Get base currency and exchange rate
 * 3. Use handler to create lines (EXPLICIT conversion)
 * 4. Create voucher entity
 * 5. Calculate totals
 * 6. Generate voucher number
 * 7. Save to repository
 * 8. Return saved voucher
 * 
 * No approval workflow - voucher starts as DRAFT.
 * User typically approves immediately after verification.
 */
export class SaveOpeningBalanceUseCase {
  private readonly handler: OpeningBalanceHandler;

  constructor(
    private readonly voucherRepository: IVoucherRepository,
    private readonly exchangeRateService: IExchangeRateService,
    private readonly companyService: ICompanyService,
    private readonly numberGenerator: IVoucherNumberGenerator
  ) {
    this.handler = new OpeningBalanceHandler();
  }

  /**
   * Execute the use case
   * 
   * @param input Opening balance data
   * @param companyId Company ID
   * @param userId User creating the voucher
   * @returns Saved voucher entity
   */
  async execute(
    input: OpeningBalanceInput,
    companyId: string,
    userId: string
  ): Promise<VoucherEntity> {
    // Step 1: Validate input using handler
    // This includes validating that Assets (DR) = Liabilities + Equity (CR)
    await this.handler.validate(input);

    // Step 2: Get company base currency
    const baseCurrency = await this.companyService.getBaseCurrency(companyId);
    const currency = input.currency || baseCurrency;

    // Step 3: Get exchange rate
    // Note: Opening balances are typically in base currency (rate = 1.0)
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
    // Handler converts user's opening balances to voucher lines
    const lines = this.handler.createLines(input, baseCurrency, exchangeRate);

    // Step 5: Calculate totals (validation happens in constructor)
    const totalDebit = lines.reduce((sum, line) => sum + line.debitAmount, 0);
    const totalCredit = lines.reduce((sum, line) => sum + line.creditAmount, 0);

    // Step 6: Generate unique voucher number
    const voucherNo = await this.numberGenerator.generate(
      companyId,
      VoucherType.OPENING_BALANCE,
      input.date
    );

    // Step 7: Create voucher entity
    // Entity validation ensures debits = credits
    const voucher = new VoucherEntity(
      uuidv4(),  // Generate ID
      companyId,
      voucherNo,
      VoucherType.OPENING_BALANCE,
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
