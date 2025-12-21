"use strict";
/**
 * Payment Voucher Handler Tests
 *
 * ADR-005 Reference Implementation Tests
 *
 * These tests verify that the PaymentVoucherHandler correctly:
 * 1. Validates input
 * 2. Creates exactly 2 lines (debit and credit)
 * 3. Always debits expense, credits cash
 * 4. Handles multi-currency correctly
 */
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const PaymentVoucherHandler_1 = require("../../../../src/domain/accounting/handlers/PaymentVoucherHandler");
(0, globals_1.describe)('PaymentVoucherHandler', () => {
    let handler;
    (0, globals_1.beforeEach)(() => {
        handler = new PaymentVoucherHandler_1.PaymentVoucherHandler();
    });
    (0, globals_1.describe)('validate()', () => {
        (0, globals_1.it)('should pass validation for valid input', async () => {
            const input = {
                date: '2025-01-15',
                amount: 100,
                cashAccountId: 'cash-001',
                expenseAccountId: 'expense-001',
                description: 'Office supplies'
            };
            await (0, globals_1.expect)(handler.validate(input)).resolves.toBeUndefined();
        });
        (0, globals_1.it)('should reject missing date', async () => {
            const input = {
                date: '',
                amount: 100,
                cashAccountId: 'cash-001',
                expenseAccountId: 'expense-001',
                description: 'Test'
            };
            await (0, globals_1.expect)(handler.validate(input)).rejects.toThrow('Date is required');
        });
        (0, globals_1.it)('should reject zero or negative amount', async () => {
            const input = {
                date: '2025-01-15',
                amount: 0,
                cashAccountId: 'cash-001',
                expenseAccountId: 'expense-001',
                description: 'Test'
            };
            await (0, globals_1.expect)(handler.validate(input)).rejects.toThrow('Amount must be greater than zero');
        });
        (0, globals_1.it)('should reject missing cash account', async () => {
            const input = {
                date: '2025-01-15',
                amount: 100,
                cashAccountId: '',
                expenseAccountId: 'expense-001',
                description: 'Test'
            };
            await (0, globals_1.expect)(handler.validate(input)).rejects.toThrow('Cash/Bank account is required');
        });
        (0, globals_1.it)('should reject missing expense account', async () => {
            const input = {
                date: '2025-01-15',
                amount: 100,
                cashAccountId: 'cash-001',
                expenseAccountId: '',
                description: 'Test'
            };
            await (0, globals_1.expect)(handler.validate(input)).rejects.toThrow('Expense/Payable account is required');
        });
        (0, globals_1.it)('should reject same account for cash and expense', async () => {
            const input = {
                date: '2025-01-15',
                amount: 100,
                cashAccountId: 'account-001',
                expenseAccountId: 'account-001',
                description: 'Test'
            };
            await (0, globals_1.expect)(handler.validate(input)).rejects.toThrow('Cash account and expense account cannot be the same');
        });
    });
    (0, globals_1.describe)('createLines()', () => {
        (0, globals_1.it)('should create exactly 2 lines', () => {
            const input = {
                date: '2025-01-15',
                amount: 100,
                cashAccountId: 'cash-001',
                expenseAccountId: 'expense-001',
                description: 'Office supplies'
            };
            const lines = handler.createLines(input, 'USD', 1.0);
            (0, globals_1.expect)(lines).toHaveLength(2);
        });
        (0, globals_1.it)('should DEBIT expense account', () => {
            const input = {
                date: '2025-01-15',
                amount: 100,
                cashAccountId: 'cash-001',
                expenseAccountId: 'expense-001',
                description: 'Office supplies'
            };
            const lines = handler.createLines(input, 'USD', 1.0);
            const debitLine = lines.find(l => l.side === 'Debit');
            (0, globals_1.expect)(debitLine).toBeDefined();
            (0, globals_1.expect)(debitLine.accountId).toBe('expense-001');
            (0, globals_1.expect)(debitLine.amount).toBe(100);
            (0, globals_1.expect)(debitLine.baseAmount).toBe(100);
        });
        (0, globals_1.it)('should CREDIT cash account', () => {
            const input = {
                date: '2025-01-15',
                amount: 100,
                cashAccountId: 'cash-001',
                expenseAccountId: 'expense-001',
                description: 'Office supplies'
            };
            const lines = handler.createLines(input, 'USD', 1.0);
            const creditLine = lines.find(l => l.side === 'Credit');
            (0, globals_1.expect)(creditLine).toBeDefined();
            (0, globals_1.expect)(creditLine.accountId).toBe('cash-001');
            (0, globals_1.expect)(creditLine.amount).toBe(100);
            (0, globals_1.expect)(creditLine.baseAmount).toBe(100);
        });
        (0, globals_1.it)('should handle same currency (no FX)', () => {
            const input = {
                date: '2025-01-15',
                amount: 100,
                cashAccountId: 'cash-001',
                expenseAccountId: 'expense-001',
                description: 'Office supplies',
                currency: 'USD'
            };
            const lines = handler.createLines(input, 'USD', 1.0);
            lines.forEach(line => {
                (0, globals_1.expect)(line.currency).toBe('USD');
                (0, globals_1.expect)(line.baseCurrency).toBe('USD');
                (0, globals_1.expect)(line.exchangeRate).toBe(1.0);
                (0, globals_1.expect)(line.amount).toBe(100);
                (0, globals_1.expect)(line.baseAmount).toBe(100);
            });
        });
        (0, globals_1.it)('should handle foreign currency with exchange rate', () => {
            const input = {
                date: '2025-01-15',
                amount: 100,
                cashAccountId: 'cash-001',
                expenseAccountId: 'expense-001',
                description: 'Office supplies',
                currency: 'EUR'
            };
            // EUR to USD rate = 1.10
            const lines = handler.createLines(input, 'USD', 1.10);
            lines.forEach(line => {
                (0, globals_1.expect)(line.currency).toBe('EUR');
                (0, globals_1.expect)(line.baseCurrency).toBe('USD');
                (0, globals_1.expect)(line.exchangeRate).toBe(1.10);
                (0, globals_1.expect)(line.amount).toBe(100); // Transaction amount
                (0, globals_1.expect)(line.baseAmount).toBe(110); // Base amount (100 * 1.10)
            });
        });
        (0, globals_1.it)('should preserve description in line notes', () => {
            const input = {
                date: '2025-01-15',
                amount: 100,
                cashAccountId: 'cash-001',
                expenseAccountId: 'expense-001',
                description: 'Office supplies payment',
                notes: 'Approved by manager'
            };
            const lines = handler.createLines(input, 'USD', 1.0);
            lines.forEach(line => {
                (0, globals_1.expect)(line.notes).toBe('Approved by manager');
            });
        });
        (0, globals_1.it)('should include cost center if provided', () => {
            const input = {
                date: '2025-01-15',
                amount: 100,
                cashAccountId: 'cash-001',
                expenseAccountId: 'expense-001',
                description: 'Office supplies',
                costCenterId: 'cc-sales'
            };
            const lines = handler.createLines(input, 'USD', 1.0);
            lines.forEach(line => {
                (0, globals_1.expect)(line.costCenterId).toBe('cc-sales');
            });
        });
        (0, globals_1.it)('should assign correct line IDs', () => {
            const input = {
                date: '2025-01-15',
                amount: 100,
                cashAccountId: 'cash-001',
                expenseAccountId: 'expense-001',
                description: 'Test'
            };
            const lines = handler.createLines(input, 'USD', 1.0);
            (0, globals_1.expect)(lines[0].id).toBe(1); // Debit line
            (0, globals_1.expect)(lines[1].id).toBe(2); // Credit line
        });
    });
    (0, globals_1.describe)('getPostingDescription()', () => {
        (0, globals_1.it)('should return documentation string', () => {
            const description = handler.getPostingDescription();
            (0, globals_1.expect)(description).toContain('DEBIT');
            (0, globals_1.expect)(description).toContain('CREDIT');
            (0, globals_1.expect)(description).toContain('Expense/Payable');
            (0, globals_1.expect)(description).toContain('Cash/Bank');
        });
    });
});
//# sourceMappingURL=PaymentVoucherHandler.test.js.map