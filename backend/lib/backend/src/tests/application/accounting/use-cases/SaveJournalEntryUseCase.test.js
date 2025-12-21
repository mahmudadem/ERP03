"use strict";
/**
 * Save Journal Entry Use Case - Integration Test
 *
 * ADR-005 Compliant
 *
 * This tests the complete flow of creating a journal entry:
 * 1. Input validation (including balance check)
 * 2. Currency and rate lookup
 * 3. Line creation via handler
 * 4. Voucher entity creation
 * 5. Number generation
 * 6. Repository save
 */
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const SaveJournalEntryUseCase_1 = require("../../../../src/application/accounting/use-cases/SaveJournalEntryUseCase");
const VoucherTypes_1 = require("../../../../src/domain/accounting/types/VoucherTypes");
const SimpleCompanyService_1 = require("../../../../src/application/accounting/services/SimpleCompanyService");
const SimpleExchangeRateService_1 = require("../../../../src/application/accounting/services/SimpleExchangeRateService");
const SimpleVoucherNumberGenerator_1 = require("../../../../src/application/accounting/services/SimpleVoucherNumberGenerator");
const InMemoryVoucherRepository_1 = require("../../../helpers/InMemoryVoucherRepository");
(0, globals_1.describe)('SaveJournalEntryUseCase - Integration', () => {
    let useCase;
    let repository;
    let companyService;
    let exchangeRateService;
    let numberGenerator;
    (0, globals_1.beforeEach)(() => {
        // Set up dependencies
        repository = new InMemoryVoucherRepository_1.InMemoryVoucherRepository();
        companyService = new SimpleCompanyService_1.SimpleCompanyService();
        exchangeRateService = new SimpleExchangeRateService_1.SimpleExchangeRateService();
        numberGenerator = new SimpleVoucherNumberGenerator_1.SimpleVoucherNumberGenerator();
        // Create use case
        useCase = new SaveJournalEntryUseCase_1.SaveJournalEntryUseCase(repository, exchangeRateService, companyService, numberGenerator);
        // Set up test company with USD base currency
        companyService.setBaseCurrency('company-001', 'USD');
    });
    (0, globals_1.describe)('Basic Journal Entry Creation', () => {
        (0, globals_1.it)('should create journal entry with valid input', async () => {
            const input = {
                date: '2025-01-15',
                description: 'Monthly depreciation',
                lines: [
                    { accountId: 'expense-depreciation', debit: 500, credit: 0 },
                    { accountId: 'asset-accum-depr', debit: 0, credit: 500 }
                ]
            };
            const voucher = await useCase.execute(input, 'company-001', 'user-001');
            (0, globals_1.expect)(voucher.id).toBeDefined();
            (0, globals_1.expect)(voucher.voucherNo).toBe('JV-2025-001');
            (0, globals_1.expect)(voucher.type).toBe(VoucherTypes_1.VoucherType.JOURNAL_ENTRY);
            (0, globals_1.expect)(voucher.status).toBe(VoucherTypes_1.VoucherStatus.DRAFT);
            (0, globals_1.expect)(voucher.description).toBe('Monthly depreciation');
            (0, globals_1.expect)(voucher.createdBy).toBe('user-001');
            (0, globals_1.expect)(voucher.lines).toHaveLength(2);
        });
        (0, globals_1.it)('should auto-increment voucher numbers', async () => {
            const input = {
                date: '2025-01-15',
                description: 'Entry 1',
                lines: [
                    { accountId: 'acc-1', debit: 100, credit: 0 },
                    { accountId: 'acc-2', debit: 0, credit: 100 }
                ]
            };
            const voucher1 = await useCase.execute(input, 'company-001', 'user-001');
            (0, globals_1.expect)(voucher1.voucherNo).toBe('JV-2025-001');
            const voucher2 = await useCase.execute(input, 'company-001', 'user-001');
            (0, globals_1.expect)(voucher2.voucherNo).toBe('JV-2025-002');
            const voucher3 = await useCase.execute(input, 'company-001', 'user-001');
            (0, globals_1.expect)(voucher3.voucherNo).toBe('JV-2025-003');
        });
        (0, globals_1.it)('should save voucher to repository', async () => {
            const input = {
                date: '2025-01-15',
                description: 'Test entry',
                lines: [
                    { accountId: 'acc-1', debit: 100, credit: 0 },
                    { accountId: 'acc-2', debit: 0, credit: 100 }
                ]
            };
            const voucher = await useCase.execute(input, 'company-001', 'user-001');
            // Verify it's in repository
            const retrieved = await repository.findById('company-001', voucher.id);
            (0, globals_1.expect)(retrieved).toBeDefined();
            (0, globals_1.expect)(retrieved.id).toBe(voucher.id);
        });
    });
    (0, globals_1.describe)('Multi-Line Entries', () => {
        (0, globals_1.it)('should handle entry with multiple debits', async () => {
            const input = {
                date: '2025-01-15',
                description: 'Split expenses',
                lines: [
                    { accountId: 'expense-rent', debit: 1000, credit: 0 },
                    { accountId: 'expense-utilities', debit: 200, credit: 0 },
                    { accountId: 'cash-checking', debit: 0, credit: 1200 }
                ]
            };
            const voucher = await useCase.execute(input, 'company-001', 'user-001');
            (0, globals_1.expect)(voucher.lines).toHaveLength(3);
            (0, globals_1.expect)(voucher.totalDebit).toBe(1200);
            (0, globals_1.expect)(voucher.totalCredit).toBe(1200);
            (0, globals_1.expect)(voucher.isBalanced).toBe(true);
        });
        (0, globals_1.it)('should handle entry with multiple credits', async () => {
            const input = {
                date: '2025-01-15',
                description: 'Split payment',
                lines: [
                    { accountId: 'expense-supplies', debit: 500, credit: 0 },
                    { accountId: 'cash-checking', debit: 0, credit: 300 },
                    { accountId: 'cash-petty', debit: 0, credit: 200 }
                ]
            };
            const voucher = await useCase.execute(input, 'company-001', 'user-001');
            (0, globals_1.expect)(voucher.lines).toHaveLength(3);
            (0, globals_1.expect)(voucher.totalDebit).toBe(500);
            (0, globals_1.expect)(voucher.totalCredit).toBe(500);
        });
        (0, globals_1.it)('should handle complex multi-line entry', async () => {
            const input = {
                date: '2025-01-15',
                description: 'Monthly accruals',
                lines: [
                    { accountId: 'expense-rent', debit: 1000, credit: 0 },
                    { accountId: 'expense-utilities', debit: 200, credit: 0 },
                    { accountId: 'expense-insurance', debit: 150, credit: 0 },
                    { accountId: 'liability-accrued-rent', debit: 0, credit: 1000 },
                    { accountId: 'liability-accrued-utilities', debit: 0, credit: 200 },
                    { accountId: 'liability-accrued-insurance', debit: 0, credit: 150 }
                ]
            };
            const voucher = await useCase.execute(input, 'company-001', 'user-001');
            (0, globals_1.expect)(voucher.lines).toHaveLength(6);
            (0, globals_1.expect)(voucher.totalDebit).toBe(1350);
            (0, globals_1.expect)(voucher.totalCredit).toBe(1350);
            (0, globals_1.expect)(voucher.isBalanced).toBe(true);
        });
    });
    (0, globals_1.describe)('Posting Verification', () => {
        (0, globals_1.it)('should create balanced voucher', async () => {
            const input = {
                date: '2025-01-15',
                description: 'Test',
                lines: [
                    { accountId: 'acc-1', debit: 250, credit: 0 },
                    { accountId: 'acc-2', debit: 0, credit: 250 }
                ]
            };
            const voucher = await useCase.execute(input, 'company-001', 'user-001');
            (0, globals_1.expect)(voucher.totalDebit).toBe(250);
            (0, globals_1.expect)(voucher.totalCredit).toBe(250);
            (0, globals_1.expect)(voucher.isBalanced).toBe(true);
        });
        (0, globals_1.it)('should preserve account assignments', async () => {
            const input = {
                date: '2025-01-15',
                description: 'Test accounts',
                lines: [
                    { accountId: 'expense-depreciation', debit: 100, credit: 0 },
                    { accountId: 'accum-depreciation', debit: 0, credit: 100 }
                ]
            };
            const voucher = await useCase.execute(input, 'company-001', 'user-001');
            const debitLine = voucher.lines.find(l => l.side === 'Debit');
            const creditLine = voucher.lines.find(l => l.side === 'Credit');
            (0, globals_1.expect)(debitLine.accountId).toBe('expense-depreciation');
            (0, globals_1.expect)(creditLine.accountId).toBe('accum-depreciation');
        });
    });
    (0, globals_1.describe)('Multi-Currency Support', () => {
        (0, globals_1.it)('should handle same currency (no FX)', async () => {
            const input = {
                date: '2025-01-15',
                description: 'USD entry',
                lines: [
                    { accountId: 'acc-1', debit: 100, credit: 0 },
                    { accountId: 'acc-2', debit: 0, credit: 100 }
                ],
                currency: 'USD'
            };
            const voucher = await useCase.execute(input, 'company-001', 'user-001');
            (0, globals_1.expect)(voucher.currency).toBe('USD');
            (0, globals_1.expect)(voucher.baseCurrency).toBe('USD');
            (0, globals_1.expect)(voucher.exchangeRate).toBe(1.0);
            voucher.lines.forEach(line => {
                (0, globals_1.expect)(line.amount).toBe(100);
                (0, globals_1.expect)(line.baseAmount).toBe(100);
                (0, globals_1.expect)(line.exchangeRate).toBe(1.0);
            });
        });
        (0, globals_1.it)('should handle foreign currency with exchange rate', async () => {
            // Set up EUR to USD rate = 1.10
            exchangeRateService.setRate('EUR', 'USD', '2025-01-15', 1.10);
            const input = {
                date: '2025-01-15',
                description: 'EUR entry',
                lines: [
                    { accountId: 'acc-1', debit: 100, credit: 0 },
                    { accountId: 'acc-2', debit: 0, credit: 100 }
                ],
                currency: 'EUR'
            };
            const voucher = await useCase.execute(input, 'company-001', 'user-001');
            (0, globals_1.expect)(voucher.currency).toBe('EUR');
            (0, globals_1.expect)(voucher.baseCurrency).toBe('USD');
            (0, globals_1.expect)(voucher.exchangeRate).toBe(1.10);
            (0, globals_1.expect)(voucher.totalDebit).toBe(110); // 100 EUR * 1.10 = 110 USD
            (0, globals_1.expect)(voucher.totalCredit).toBe(110);
            voucher.lines.forEach(line => {
                (0, globals_1.expect)(line.amount).toBe(100); // Transaction amount in EUR
                (0, globals_1.expect)(line.baseAmount).toBe(110); // Base amount in USD
            });
        });
        (0, globals_1.it)('should throw error if exchange rate not found', async () => {
            const input = {
                date: '2025-01-15',
                description: 'GBP entry',
                lines: [
                    { accountId: 'acc-1', debit: 100, credit: 0 },
                    { accountId: 'acc-2', debit: 0, credit: 100 }
                ],
                currency: 'GBP'
            };
            await (0, globals_1.expect)(useCase.execute(input, 'company-001', 'user-001')).rejects.toThrow('Exchange rate not found');
        });
    });
    (0, globals_1.describe)('Validation', () => {
        (0, globals_1.it)('should reject unbalanced entry', async () => {
            const input = {
                date: '2025-01-15',
                description: 'Unbalanced',
                lines: [
                    { accountId: 'acc-1', debit: 100, credit: 0 },
                    { accountId: 'acc-2', debit: 0, credit: 80 } // Not balanced!
                ]
            };
            await (0, globals_1.expect)(useCase.execute(input, 'company-001', 'user-001')).rejects.toThrow('Entry is not balanced');
        });
        (0, globals_1.it)('should reject entry with less than 2 lines', async () => {
            const input = {
                date: '2025-01-15',
                description: 'Too few lines',
                lines: [
                    { accountId: 'acc-1', debit: 100, credit: 0 }
                ]
            };
            await (0, globals_1.expect)(useCase.execute(input, 'company-001', 'user-001')).rejects.toThrow('At least 2 lines are required');
        });
        (0, globals_1.it)('should reject line with both debit and credit', async () => {
            const input = {
                date: '2025-01-15',
                description: 'Invalid line',
                lines: [
                    { accountId: 'acc-1', debit: 100, credit: 50 },
                    { accountId: 'acc-2', debit: 0, credit: 150 }
                ]
            };
            await (0, globals_1.expect)(useCase.execute(input, 'company-001', 'user-001')).rejects.toThrow('Cannot have both debit and credit');
        });
    });
    (0, globals_1.describe)('Audit Trail', () => {
        (0, globals_1.it)('should record creation metadata', async () => {
            const input = {
                date: '2025-01-15',
                description: 'Test',
                lines: [
                    { accountId: 'acc-1', debit: 100, credit: 0 },
                    { accountId: 'acc-2', debit: 0, credit: 100 }
                ]
            };
            const voucher = await useCase.execute(input, 'company-001', 'user-001');
            (0, globals_1.expect)(voucher.createdBy).toBe('user-001');
            (0, globals_1.expect)(voucher.createdAt).toBeDefined();
            (0, globals_1.expect)(voucher.createdAt).toBeInstanceOf(Date);
        });
        (0, globals_1.it)('should start in DRAFT status', async () => {
            const input = {
                date: '2025-01-15',
                description: 'Test',
                lines: [
                    { accountId: 'acc-1', debit: 100, credit: 0 },
                    { accountId: 'acc-2', debit: 0, credit: 100 }
                ]
            };
            const voucher = await useCase.execute(input, 'company-001', 'user-001');
            (0, globals_1.expect)(voucher.status).toBe(VoucherTypes_1.VoucherStatus.DRAFT);
            (0, globals_1.expect)(voucher.approvedBy).toBeUndefined();
            (0, globals_1.expect)(voucher.approvedAt).toBeUndefined();
        });
        (0, globals_1.it)('should preserve line notes and cost centers', async () => {
            const input = {
                date: '2025-01-15',
                description: 'Test metadata',
                lines: [
                    {
                        accountId: 'acc-1',
                        debit: 100,
                        credit: 0,
                        notes: 'Debit note',
                        costCenterId: 'cc-sales'
                    },
                    {
                        accountId: 'acc-2',
                        debit: 0,
                        credit: 100,
                        notes: 'Credit note',
                        costCenterId: 'cc-sales'
                    }
                ]
            };
            const voucher = await useCase.execute(input, 'company-001', 'user-001');
            const debitLine = voucher.lines.find(l => l.side === 'Debit');
            const creditLine = voucher.lines.find(l => l.side === 'Credit');
            (0, globals_1.expect)(debitLine.notes).toBe('Debit note');
            (0, globals_1.expect)(debitLine.costCenterId).toBe('cc-sales');
            (0, globals_1.expect)(creditLine.notes).toBe('Credit note');
            (0, globals_1.expect)(creditLine.costCenterId).toBe('cc-sales');
        });
    });
});
//# sourceMappingURL=SaveJournalEntryUseCase.test.js.map