"use strict";
/**
 * Save Receipt Voucher Use Case - Integration Test
 *
 * ADR-005 Compliant - Mirror of SavePaymentVoucherUseCase Tests
 *
 * This tests the complete flow of creating a receipt voucher:
 * 1. Input validation
 * 2. Currency and rate lookup
 * 3. Line creation via handler
 * 4. Voucher entity creation
 * 5. Number generation
 * 6. Repository save
 */
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const SaveReceiptVoucherUseCase_1 = require("../../../../src/application/accounting/use-cases/SaveReceiptVoucherUseCase");
const VoucherTypes_1 = require("../../../../src/domain/accounting/types/VoucherTypes");
const SimpleCompanyService_1 = require("../../../../src/application/accounting/services/SimpleCompanyService");
const SimpleExchangeRateService_1 = require("../../../../src/application/accounting/services/SimpleExchangeRateService");
const SimpleVoucherNumberGenerator_1 = require("../../../../src/application/accounting/services/SimpleVoucherNumberGenerator");
const InMemoryVoucherRepository_1 = require("../../../helpers/InMemoryVoucherRepository");
(0, globals_1.describe)('SaveReceiptVoucherUseCase - Integration', () => {
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
        useCase = new SaveReceiptVoucherUseCase_1.SaveReceiptVoucherUseCase(repository, exchangeRateService, companyService, numberGenerator);
        // Set up test company with USD base currency
        companyService.setBaseCurrency('company-001', 'USD');
    });
    (0, globals_1.describe)('Basic Receipt Creation', () => {
        (0, globals_1.it)('should create receipt voucher with valid input', async () => {
            const input = {
                date: '2025-01-15',
                amount: 100,
                cashAccountId: 'cash-001',
                revenueAccountId: 'revenue-001',
                description: 'Customer payment received'
            };
            const voucher = await useCase.execute(input, 'company-001', 'user-001');
            (0, globals_1.expect)(voucher.id).toBeDefined();
            (0, globals_1.expect)(voucher.voucherNo).toBe('REC-2025-001');
            (0, globals_1.expect)(voucher.type).toBe(VoucherTypes_1.VoucherType.RECEIPT);
            (0, globals_1.expect)(voucher.status).toBe(VoucherTypes_1.VoucherStatus.DRAFT);
            (0, globals_1.expect)(voucher.description).toBe('Customer payment received');
            (0, globals_1.expect)(voucher.createdBy).toBe('user-001');
            (0, globals_1.expect)(voucher.lines).toHaveLength(2);
        });
        (0, globals_1.it)('should auto-increment voucher numbers', async () => {
            const input = {
                date: '2025-01-15',
                amount: 100,
                cashAccountId: 'cash-001',
                revenueAccountId: 'revenue-001',
                description: 'Receipt 1'
            };
            const voucher1 = await useCase.execute(input, 'company-001', 'user-001');
            (0, globals_1.expect)(voucher1.voucherNo).toBe('REC-2025-001');
            const voucher2 = await useCase.execute(input, 'company-001', 'user-001');
            (0, globals_1.expect)(voucher2.voucherNo).toBe('REC-2025-002');
            const voucher3 = await useCase.execute(input, 'company-001', 'user-001');
            (0, globals_1.expect)(voucher3.voucherNo).toBe('REC-2025-003');
        });
        (0, globals_1.it)('should save voucher to repository', async () => {
            const input = {
                date: '2025-01-15',
                amount: 100,
                cashAccountId: 'cash-001',
                revenueAccountId: 'revenue-001',
                description: 'Test receipt'
            };
            const voucher = await useCase.execute(input, 'company-001', 'user-001');
            // Verify it's in repository
            const retrieved = await repository.findById('company-001', voucher.id);
            (0, globals_1.expect)(retrieved).toBeDefined();
            (0, globals_1.expect)(retrieved.id).toBe(voucher.id);
        });
    });
    (0, globals_1.describe)('Posting Logic Verification', () => {
        (0, globals_1.it)('should DEBIT cash account', async () => {
            const input = {
                date: '2025-01-15',
                amount: 150,
                cashAccountId: 'cash-001',
                revenueAccountId: 'revenue-001',
                description: 'Test'
            };
            const voucher = await useCase.execute(input, 'company-001', 'user-001');
            const debitLine = voucher.lines.find(l => l.side === 'Debit');
            (0, globals_1.expect)(debitLine).toBeDefined();
            (0, globals_1.expect)(debitLine.accountId).toBe('cash-001');
            (0, globals_1.expect)(debitLine.baseAmount).toBe(150);
        });
        (0, globals_1.it)('should CREDIT revenue account', async () => {
            const input = {
                date: '2025-01-15',
                amount: 150,
                cashAccountId: 'cash-001',
                revenueAccountId: 'revenue-001',
                description: 'Test'
            };
            const voucher = await useCase.execute(input, 'company-001', 'user-001');
            const creditLine = voucher.lines.find(l => l.side === 'Credit');
            (0, globals_1.expect)(creditLine).toBeDefined();
            (0, globals_1.expect)(creditLine.accountId).toBe('revenue-001');
            (0, globals_1.expect)(creditLine.baseAmount).toBe(150);
        });
        (0, globals_1.it)('should create balanced voucher', async () => {
            const input = {
                date: '2025-01-15',
                amount: 250,
                cashAccountId: 'cash-001',
                revenueAccountId: 'revenue-001',
                description: 'Test'
            };
            const voucher = await useCase.execute(input, 'company-001', 'user-001');
            (0, globals_1.expect)(voucher.totalDebit).toBe(250);
            (0, globals_1.expect)(voucher.totalCredit).toBe(250);
            (0, globals_1.expect)(voucher.isBalanced).toBe(true);
        });
    });
    (0, globals_1.describe)('Multi-Currency Support', () => {
        (0, globals_1.it)('should handle same currency (no FX)', async () => {
            const input = {
                date: '2025-01-15',
                amount: 100,
                cashAccountId: 'cash-001',
                revenueAccountId: 'revenue-001',
                description: 'USD receipt',
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
                amount: 100,
                cashAccountId: 'cash-001',
                revenueAccountId: 'revenue-001',
                description: 'EUR receipt',
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
                amount: 100,
                cashAccountId: 'cash-001',
                revenueAccountId: 'revenue-001',
                description: 'GBP receipt',
                currency: 'GBP'
            };
            await (0, globals_1.expect)(useCase.execute(input, 'company-001', 'user-001')).rejects.toThrow('Exchange rate not found');
        });
    });
    (0, globals_1.describe)('Validation', () => {
        (0, globals_1.it)('should reject invalid input', async () => {
            const input = {
                date: '',
                amount: 100,
                cashAccountId: 'cash-001',
                revenueAccountId: 'revenue-001',
                description: 'Test'
            };
            await (0, globals_1.expect)(useCase.execute(input, 'company-001', 'user-001')).rejects.toThrow('Date is required');
        });
        (0, globals_1.it)('should reject zero amount', async () => {
            const input = {
                date: '2025-01-15',
                amount: 0,
                cashAccountId: 'cash-001',
                revenueAccountId: 'revenue-001',
                description: 'Test'
            };
            await (0, globals_1.expect)(useCase.execute(input, 'company-001', 'user-001')).rejects.toThrow('Amount must be greater than zero');
        });
        (0, globals_1.it)('should reject same account for debit and credit', async () => {
            const input = {
                date: '2025-01-15',
                amount: 100,
                cashAccountId: 'account-001',
                revenueAccountId: 'account-001',
                description: 'Test'
            };
            await (0, globals_1.expect)(useCase.execute(input, 'company-001', 'user-001')).rejects.toThrow('Cash account and revenue account cannot be the same');
        });
    });
    (0, globals_1.describe)('Audit Trail', () => {
        (0, globals_1.it)('should record creation metadata', async () => {
            const input = {
                date: '2025-01-15',
                amount: 100,
                cashAccountId: 'cash-001',
                revenueAccountId: 'revenue-001',
                description: 'Test'
            };
            const voucher = await useCase.execute(input, 'company-001', 'user-001');
            (0, globals_1.expect)(voucher.createdBy).toBe('user-001');
            (0, globals_1.expect)(voucher.createdAt).toBeDefined();
            (0, globals_1.expect)(voucher.createdAt).toBeInstanceOf(Date);
        });
        (0, globals_1.it)('should start in DRAFT status', async () => {
            const input = {
                date: '2025-01-15',
                amount: 100,
                cashAccountId: 'cash-001',
                revenueAccountId: 'revenue-001',
                description: 'Test'
            };
            const voucher = await useCase.execute(input, 'company-001', 'user-001');
            (0, globals_1.expect)(voucher.status).toBe(VoucherTypes_1.VoucherStatus.DRAFT);
            (0, globals_1.expect)(voucher.approvedBy).toBeUndefined();
            (0, globals_1.expect)(voucher.approvedAt).toBeUndefined();
        });
        (0, globals_1.it)('should preserve cost center if provided', async () => {
            const input = {
                date: '2025-01-15',
                amount: 100,
                cashAccountId: 'cash-001',
                revenueAccountId: 'revenue-001',
                description: 'Test',
                costCenterId: 'cc-sales'
            };
            const voucher = await useCase.execute(input, 'company-001', 'user-001');
            voucher.lines.forEach(line => {
                (0, globals_1.expect)(line.costCenterId).toBe('cc-sales');
            });
        });
    });
});
//# sourceMappingURL=SaveReceiptVoucherUseCase.test.js.map