"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaveJournalEntryUseCase = void 0;
const uuid_1 = require("uuid");
const VoucherEntity_1 = require("../../domain/accounting/entities/VoucherEntity");
const VoucherTypes_1 = require("../../domain/accounting/types/VoucherTypes");
const JournalEntryHandler_1 = require("../../domain/accounting/handlers/JournalEntryHandler");
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
class SaveJournalEntryUseCase {
    constructor(voucherRepository, exchangeRateService, companyService, numberGenerator) {
        this.voucherRepository = voucherRepository;
        this.exchangeRateService = exchangeRateService;
        this.companyService = companyService;
        this.numberGenerator = numberGenerator;
        this.handler = new JournalEntryHandler_1.JournalEntryHandler();
    }
    /**
     * Execute the use case
     *
     * @param input Journal entry data
     * @param companyId Company ID
     * @param userId User creating the voucher
     * @returns Saved voucher entity
     */
    async execute(input, companyId, userId) {
        // Step 1: Validate input using handler
        // This includes validating that debits = credits
        await this.handler.validate(input);
        // Step 2: Get company base currency
        const baseCurrency = await this.companyService.getBaseCurrency(companyId);
        const currency = input.currency || baseCurrency;
        // Step 3: Get exchange rate
        let exchangeRate = 1.0;
        if (currency !== baseCurrency) {
            exchangeRate = await this.exchangeRateService.getRate(currency, baseCurrency, input.date);
            if (exchangeRate <= 0) {
                throw new Error(`Invalid exchange rate: ${exchangeRate}`);
            }
        }
        // Step 4: Create lines using handler (EXPLICIT CONVERSION)
        // Handler converts user's debit/credit input to voucher lines
        const lines = this.handler.createLines(input, baseCurrency, exchangeRate);
        // Step 5: Calculate totals (validation happens in constructor)
        const totalDebit = lines.reduce((sum, line) => sum + line.debitAmount, 0);
        const totalCredit = lines.reduce((sum, line) => sum + line.creditAmount, 0);
        // Step 6: Generate unique voucher number
        const voucherNo = await this.numberGenerator.generate(companyId, VoucherTypes_1.VoucherType.JOURNAL_ENTRY, input.date);
        // Step 7: Create voucher entity
        // Entity validation ensures debits = credits
        const voucher = new VoucherEntity_1.VoucherEntity((0, uuid_1.v4)(), // Generate ID
        companyId, voucherNo, VoucherTypes_1.VoucherType.JOURNAL_ENTRY, input.date, input.description, currency, baseCurrency, exchangeRate, lines, // Readonly array
        totalDebit, totalCredit, VoucherTypes_1.VoucherStatus.DRAFT, // Always starts as DRAFT
        userId, new Date() // Created at
        );
        // Step 8: Save to repository
        const savedVoucher = await this.voucherRepository.save(voucher);
        return savedVoucher;
    }
}
exports.SaveJournalEntryUseCase = SaveJournalEntryUseCase;
//# sourceMappingURL=SaveJournalEntryUseCase.js.map