"use strict";
/**
 * Save Opening Balance Use Case - Integration Test
 *
 * ADR-005 Compliant
 *
 * This tests the complete flow of creating opening balances:
 * 1. Input validation (including accounting equation)
 * 2. Currency and rate lookup
 * 3. Line creation via handler
 * 4. Voucher entity creation
 * 5. Number generation
 * 6. Repository save
 */
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const SaveOpeningBalanceUseCase_1 = require("../../../../src/application/accounting/use-cases/SaveOpeningBalanceUseCase");
const VoucherTypes_1 = require("../../../../src/domain/accounting/types/VoucherTypes");
const SimpleCompanyService_1 = require("../../../../src/application/accounting/services/SimpleCompanyService");
const SimpleExchangeRateService_1 = require("../../../../src/application/accounting/services/SimpleExchangeRateService");
const SimpleVoucherNumberGenerator_1 = require("../../../../src/application/accounting/services/SimpleVoucherNumberGenerator");
const InMemoryVoucherRepository_1 = require("../../../helpers/InMemoryVoucherRepository");
(0, globals_1.describe)('SaveOpeningBalanceUseCase - Integration', () => {
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
        useCase = new SaveOpeningBalanceUseCase_1.SaveOpeningBalanceUseCase(repository, exchangeRateService, companyService, numberGenerator);
        // Set up test company with USD base currency
        companyService.setBaseCurrency('company-001', 'USD');
    });
    (0, globals_1.describe)('Basic Opening Balance Creation', () => {
        (0, globals_1.it)('should create opening balance with valid input', async () => {
            const input = {
                date: '2025-01-01',
                description: 'Opening balances as of January 1, 2025',
                lines: [
                    { accountId: 'asset-cash', debit: 10000, credit: 0 },
                    { accountId: 'equity-owner', debit: 0, credit: 10000 }
                ]
            };
            const voucher = await useCase.execute(input, 'company-001', 'user-001');
            (0, globals_1.expect)(voucher.id).toBeDefined();
            (0, globals_1.expect)(voucher.voucherNo).toBe('OB-2025-001');
            (0, globals_1.expect)(voucher.type).toBe(VoucherTypes_1.VoucherType.OPENING_BALANCE);
            (0, globals_1.expect)(voucher.status).toBe(VoucherTypes_1.VoucherStatus.DRAFT);
            (0, globals_1.expect)(voucher.description).toBe('Opening balances as of January 1, 2025');
            (0, globals_1.expect)(voucher.createdBy).toBe('user-001');
            (0, globals_1.expect)(voucher.lines).toHaveLength(2);
        });
        (0, globals_1.it)('should auto-increment voucher numbers', async () => {
            const input = {
                date: '2025-01-01',
                description: 'Opening 1',
                lines: [
                    { accountId: 'acc-1', debit: 100, credit: 0 },
                    { accountId: 'acc-2', debit: 0, credit: 100 }
                ]
            };
            const voucher1 = await useCase.execute(input, 'company-001', 'user-001');
            (0, globals_1.expect)(voucher1.voucherNo).toBe('OB-2025-001');
            const voucher2 = await useCase.execute(input, 'company-001', 'user-001');
            (0, globals_1.expect)(voucher2.voucherNo).toBe('OB-2025-002');
        });
        (0, globals_1.it)('should save voucher to repository', async () => {
            const input = {
                date: '2025-01-01',
                description: 'Test opening',
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
    (0, globals_1.describe)('Multi-Account Opening Balances', () => {
        (0, globals_1.it)('should handle complex opening with multiple accounts', async () => {
            const input = {
                date: '2025-01-01',
                description: 'System initialization',
                lines: [
                    { accountId: 'asset-cash', debit: 10000, credit: 0 },
                    { accountId: 'asset-equipment', debit: 5000, credit: 0 },
                    { accountId: 'liability-payable', debit: 0, credit: 3000 },
                    { accountId: 'equity-owner', debit: 0, credit: 12000 }
                ]
            };
            const voucher = await useCase.execute(input, 'company-001', 'user-001');
            (0, globals_1.expect)(voucher.lines).toHaveLength(4);
            (0, globals_1.expect)(voucher.totalDebit).toBe(15000);
            (0, globals_1.expect)(voucher.totalCredit).toBe(15000);
            (0, globals_1.expect)(voucher.isBalanced).toBe(true);
        });
        (0, globals_1.it)('should handle multiple assets', async () => {
            const input = {
                date: '2025-01-01',
                description: 'Asset initialization',
                lines: [
                    { accountId: 'asset-cash', debit: 5000, credit: 0 },
                    { accountId: 'asset-equipment', debit: 3000, credit: 0 },
                    { accountId: 'asset-inventory', debit: 2000, credit: 0 },
                    { accountId: 'equity-owner', debit: 0, credit: 10000 }
                ]
            };
            const voucher = await useCase.execute(input, 'company-001', 'user-001');
            const assetLines = voucher.lines.filter(l => l.side === 'Debit');
            (0, globals_1.expect)(assetLines).toHaveLength(3);
            (0, globals_1.expect)(voucher.totalDebit).toBe(10000);
        });
        (0, globals_1.it)('should handle multiple liabilities and equity', async () => {
            const input = {
                date: '2025-01-01',
                description: 'Liability and equity initialization',
                lines: [
                    { accountId: 'asset-cash', debit: 8000, credit: 0 },
                    { accountId: 'liability-loan', debit: 0, credit: 3000 },
                    { accountId: 'liability-payable', debit: 0, credit: 2000 },
                    { accountId: 'equity-owner', debit: 0, credit: 3000 }
                ]
            };
            const voucher = await useCase.execute(input, 'company-001', 'user-001');
            const liabilityEquityLines = voucher.lines.filter(l => l.side === 'Credit');
            (0, globals_1.expect)(liabilityEquityLines).toHaveLength(3);
            (0, globals_1.expect)(voucher.totalCredit).toBe(8000);
        });
    });
    (0, globals_1.describe)('Posting Verification', () => {
        (0, globals_1.it)('should create balanced voucher', async () => {
            const input = {
                date: '2025-01-01',
                description: 'Test',
                lines: [
                    { accountId: 'asset-cash', debit: 5000, credit: 0 },
                    { accountId: 'equity-owner', debit: 0, credit: 5000 }
                ]
            };
            const voucher = await useCase.execute(input, 'company-001', 'user-001');
            (0, globals_1.expect)(voucher.totalDebit).toBe(5000);
            (0, globals_1.expect)(voucher.totalCredit).toBe(5000);
            (0, globals_1.expect)(voucher.isBalanced).toBe(true);
        });
        (0, globals_1.it)('should preserve account assignments', async () => {
            const input = {
                date: '2025-01-01',
                description: 'Test accounts',
                lines: [
                    { accountId: 'asset-cash-001', debit: 1000, credit: 0 },
                    { accountId: 'equity-retained-002', debit: 0, credit: 1000 }
                ]
            };
            const voucher = await useCase.execute(input, 'company-001', 'user-001');
            const debitLine = voucher.lines.find(l => l.side === 'Debit');
            const creditLine = voucher.lines.find(l => l.side === 'Credit');
            (0, globals_1.expect)(debitLine.accountId).toBe('asset-cash-001');
            (0, globals_1.expect)(creditLine.accountId).toBe('equity-retained-002');
        });
    });
    (0, globals_1.describe)('Validation', () => {
        (0, globals_1.it)('should reject unbalanced opening', async () => {
            const input = {
                date: '2025-01-01',
                description: 'Unbalanced',
                lines: [
                    { accountId: 'asset-cash', debit: 10000, credit: 0 },
                    { accountId: 'equity-owner', debit: 0, credit: 8000 } // Not balanced!
                ]
            };
            await (0, globals_1.expect)(useCase.execute(input, 'company-001', 'user-001')).rejects.toThrow('Opening balances not balanced');
        });
        (0, globals_1.it)('should reject entry with less than 2 lines', async () => {
            const input = {
                date: '2025-01-01',
                description: 'Too few lines',
                lines: [
                    { accountId: 'acc-1', debit: 100, credit: 0 }
                ]
            };
            await (0, globals_1.expect)(useCase.execute(input, 'company-001', 'user-001')).rejects.toThrow('At least 2 lines are required');
        });
        (0, globals_1.it)('should reject line with both debit and credit', async () => {
            const input = {
                date: '2025-01-01',
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
                date: '2025-01-01',
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
                date: '2025-01-01',
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
        (0, globals_1.it)('should preserve line notes', async () => {
            const input = {
                date: '2025-01-01',
                description: 'Test with notes',
                lines: [
                    { accountId: 'acc-1', debit: 100, credit: 0, notes: 'Cash on hand' },
                    { accountId: 'acc-2', debit: 0, credit: 100, notes: 'Initial investment' }
                ]
            };
            const voucher = await useCase.execute(input, 'company-001', 'user-001');
            const debitLine = voucher.lines.find(l => l.side === 'Debit');
            const creditLine = voucher.lines.find(l => l.side === 'Credit');
            (0, globals_1.expect)(debitLine.notes).toBe('Cash on hand');
            (0, globals_1.expect)(creditLine.notes).toBe('Initial investment');
        });
    });
});
//# sourceMappingURL=SaveOpeningBalanceUseCase.test.js.map