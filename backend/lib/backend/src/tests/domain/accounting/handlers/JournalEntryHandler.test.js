"use strict";
/**
 * Journal Entry Handler Tests
 *
 * ADR-005 Compliant
 *
 * These tests verify that the JournalEntryHandler correctly:
 * 1. Validates user input (including balance check)
 * 2. Converts user debit/credit input to voucher lines
 * 3. Handles multi-line entries
 * 4. Handles multi-currency correctly
 */
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const JournalEntryHandler_1 = require("../../../../src/domain/accounting/handlers/JournalEntryHandler");
(0, globals_1.describe)('JournalEntryHandler', () => {
    let handler;
    (0, globals_1.beforeEach)(() => {
        handler = new JournalEntryHandler_1.JournalEntryHandler();
    });
    (0, globals_1.describe)('validate()', () => {
        (0, globals_1.it)('should pass validation for valid balanced entry', async () => {
            const input = {
                date: '2025-01-15',
                description: 'Depreciation entry',
                lines: [
                    { accountId: 'expense-depreciation', debit: 500, credit: 0 },
                    { accountId: 'asset-accum-depr', debit: 0, credit: 500 }
                ]
            };
            await (0, globals_1.expect)(handler.validate(input)).resolves.toBeUndefined();
        });
        (0, globals_1.it)('should reject missing date', async () => {
            const input = {
                date: '',
                description: 'Test',
                lines: [
                    { accountId: 'acc-1', debit: 100, credit: 0 },
                    { accountId: 'acc-2', debit: 0, credit: 100 }
                ]
            };
            await (0, globals_1.expect)(handler.validate(input)).rejects.toThrow('Date is required');
        });
        (0, globals_1.it)('should reject missing description', async () => {
            const input = {
                date: '2025-01-15',
                description: '',
                lines: [
                    { accountId: 'acc-1', debit: 100, credit: 0 },
                    { accountId: 'acc-2', debit: 0, credit: 100 }
                ]
            };
            await (0, globals_1.expect)(handler.validate(input)).rejects.toThrow('Description is required');
        });
        (0, globals_1.it)('should reject if less than 2 lines', async () => {
            const input = {
                date: '2025-01-15',
                description: 'Test',
                lines: [
                    { accountId: 'acc-1', debit: 100, credit: 0 }
                ]
            };
            await (0, globals_1.expect)(handler.validate(input)).rejects.toThrow('At least 2 lines are required');
        });
        (0, globals_1.it)('should reject line without account', async () => {
            const input = {
                date: '2025-01-15',
                description: 'Test',
                lines: [
                    { accountId: '', debit: 100, credit: 0 },
                    { accountId: 'acc-2', debit: 0, credit: 100 }
                ]
            };
            await (0, globals_1.expect)(handler.validate(input)).rejects.toThrow('Line 1: Account is required');
        });
        (0, globals_1.it)('should reject line with both debit and credit', async () => {
            const input = {
                date: '2025-01-15',
                description: 'Test',
                lines: [
                    { accountId: 'acc-1', debit: 100, credit: 50 },
                    { accountId: 'acc-2', debit: 0, credit: 150 }
                ]
            };
            await (0, globals_1.expect)(handler.validate(input)).rejects.toThrow('Line 1: Cannot have both debit and credit');
        });
        (0, globals_1.it)('should reject line with neither debit nor credit', async () => {
            const input = {
                date: '2025-01-15',
                description: 'Test',
                lines: [
                    { accountId: 'acc-1', debit: 0, credit: 0 },
                    { accountId: 'acc-2', debit: 0, credit: 100 }
                ]
            };
            await (0, globals_1.expect)(handler.validate(input)).rejects.toThrow('Line 1: Must have either debit or credit amount');
        });
        (0, globals_1.it)('should reject negative amounts', async () => {
            const input = {
                date: '2025-01-15',
                description: 'Test',
                lines: [
                    { accountId: 'acc-1', debit: -100, credit: 0 },
                    { accountId: 'acc-2', debit: 0, credit: 100 }
                ]
            };
            await (0, globals_1.expect)(handler.validate(input)).rejects.toThrow('Line 1: Amounts cannot be negative');
        });
        (0, globals_1.it)('should reject unbalanced entry', async () => {
            const input = {
                date: '2025-01-15',
                description: 'Test',
                lines: [
                    { accountId: 'acc-1', debit: 100, credit: 0 },
                    { accountId: 'acc-2', debit: 0, credit: 80 } // Not balanced!
                ]
            };
            await (0, globals_1.expect)(handler.validate(input)).rejects.toThrow('Entry is not balanced');
        });
    });
    (0, globals_1.describe)('createLines()', () => {
        (0, globals_1.it)('should create correct number of lines for simple entry', () => {
            const input = {
                date: '2025-01-15',
                description: 'Simple entry',
                lines: [
                    { accountId: 'acc-1', debit: 100, credit: 0 },
                    { accountId: 'acc-2', debit: 0, credit: 100 }
                ]
            };
            const lines = handler.createLines(input, 'USD', 1.0);
            (0, globals_1.expect)(lines).toHaveLength(2);
        });
        (0, globals_1.it)('should create debit line correctly', () => {
            const input = {
                date: '2025-01-15',
                description: 'Test',
                lines: [
                    { accountId: 'expense-001', debit: 150, credit: 0 },
                    { accountId: 'cash-001', debit: 0, credit: 150 }
                ]
            };
            const lines = handler.createLines(input, 'USD', 1.0);
            const debitLine = lines.find(l => l.accountId === 'expense-001');
            (0, globals_1.expect)(debitLine).toBeDefined();
            (0, globals_1.expect)(debitLine.side).toBe('Debit');
            (0, globals_1.expect)(debitLine.amount).toBe(150);
            (0, globals_1.expect)(debitLine.baseAmount).toBe(150);
        });
        (0, globals_1.it)('should create credit line correctly', () => {
            const input = {
                date: '2025-01-15',
                description: 'Test',
                lines: [
                    { accountId: 'expense-001', debit: 150, credit: 0 },
                    { accountId: 'cash-001', debit: 0, credit: 150 }
                ]
            };
            const lines = handler.createLines(input, 'USD', 1.0);
            const creditLine = lines.find(l => l.accountId === 'cash-001');
            (0, globals_1.expect)(creditLine).toBeDefined();
            (0, globals_1.expect)(creditLine.side).toBe('Credit');
            (0, globals_1.expect)(creditLine.amount).toBe(150);
            (0, globals_1.expect)(creditLine.baseAmount).toBe(150);
        });
        (0, globals_1.it)('should handle multi-line entry', () => {
            const input = {
                date: '2025-01-15',
                description: 'Multi-line entry',
                lines: [
                    { accountId: 'expense-1', debit: 100, credit: 0 },
                    { accountId: 'expense-2', debit: 50, credit: 0 },
                    { accountId: 'cash-1', debit: 0, credit: 150 }
                ]
            };
            const lines = handler.createLines(input, 'USD', 1.0);
            (0, globals_1.expect)(lines).toHaveLength(3);
            const debitLines = lines.filter(l => l.side === 'Debit');
            const creditLines = lines.filter(l => l.side === 'Credit');
            (0, globals_1.expect)(debitLines).toHaveLength(2);
            (0, globals_1.expect)(creditLines).toHaveLength(1);
        });
        (0, globals_1.it)('should handle complex multi-line entry', () => {
            const input = {
                date: '2025-01-15',
                description: 'Complex allocation',
                lines: [
                    { accountId: 'expense-rent', debit: 1000, credit: 0 },
                    { accountId: 'expense-utilities', debit: 200, credit: 0 },
                    { accountId: 'cash-checking', debit: 0, credit: 800 },
                    { accountId: 'cash-savings', debit: 0, credit: 400 }
                ]
            };
            const lines = handler.createLines(input, 'USD', 1.0);
            (0, globals_1.expect)(lines).toHaveLength(4);
            const totalDebit = lines.reduce((sum, l) => sum + l.debitAmount, 0);
            const totalCredit = lines.reduce((sum, l) => sum + l.creditAmount, 0);
            (0, globals_1.expect)(totalDebit).toBe(1200);
            (0, globals_1.expect)(totalCredit).toBe(1200);
        });
        (0, globals_1.it)('should handle same currency (no FX)', () => {
            const input = {
                date: '2025-01-15',
                description: 'USD entry',
                lines: [
                    { accountId: 'acc-1', debit: 100, credit: 0 },
                    { accountId: 'acc-2', debit: 0, credit: 100 }
                ],
                currency: 'USD'
            };
            const lines = handler.createLines(input, 'USD', 1.0);
            lines.forEach(line => {
                (0, globals_1.expect)(line.currency).toBe('USD');
                (0, globals_1.expect)(line.baseCurrency).toBe('USD');
                (0, globals_1.expect)(line.exchangeRate).toBe(1.0);
            });
        });
        (0, globals_1.it)('should handle foreign currency with exchange rate', () => {
            const input = {
                date: '2025-01-15',
                description: 'EUR entry',
                lines: [
                    { accountId: 'acc-1', debit: 100, credit: 0 },
                    { accountId: 'acc-2', debit: 0, credit: 100 }
                ],
                currency: 'EUR'
            };
            // EUR to USD rate = 1.10
            const lines = handler.createLines(input, 'USD', 1.10);
            lines.forEach(line => {
                (0, globals_1.expect)(line.currency).toBe('EUR');
                (0, globals_1.expect)(line.baseCurrency).toBe('USD');
                (0, globals_1.expect)(line.exchangeRate).toBe(1.10);
            });
            const debitLine = lines.find(l => l.side === 'Debit');
            (0, globals_1.expect)(debitLine.amount).toBe(100); // Transaction amount in EUR
            (0, globals_1.expect)(debitLine.baseAmount).toBe(110); // Base amount in USD
        });
        (0, globals_1.it)('should preserve line notes', () => {
            const input = {
                date: '2025-01-15',
                description: 'Entry with notes',
                lines: [
                    { accountId: 'acc-1', debit: 100, credit: 0, notes: 'Debit note' },
                    { accountId: 'acc-2', debit: 0, credit: 100, notes: 'Credit note' }
                ]
            };
            const lines = handler.createLines(input, 'USD', 1.0);
            const debitLine = lines.find(l => l.side === 'Debit');
            const creditLine = lines.find(l => l.side === 'Credit');
            (0, globals_1.expect)(debitLine.notes).toBe('Debit note');
            (0, globals_1.expect)(creditLine.notes).toBe('Credit note');
        });
        (0, globals_1.it)('should include cost center if provided', () => {
            const input = {
                date: '2025-01-15',
                description: 'Entry with cost center',
                lines: [
                    { accountId: 'acc-1', debit: 100, credit: 0, costCenterId: 'cc-sales' },
                    { accountId: 'acc-2', debit: 0, credit: 100, costCenterId: 'cc-sales' }
                ]
            };
            const lines = handler.createLines(input, 'USD', 1.0);
            lines.forEach(line => {
                (0, globals_1.expect)(line.costCenterId).toBe('cc-sales');
            });
        });
        (0, globals_1.it)('should assign sequential line IDs', () => {
            const input = {
                date: '2025-01-15',
                description: 'Test IDs',
                lines: [
                    { accountId: 'acc-1', debit: 50, credit: 0 },
                    { accountId: 'acc-2', debit: 50, credit: 0 },
                    { accountId: 'acc-3', debit: 0, credit: 100 }
                ]
            };
            const lines = handler.createLines(input, 'USD', 1.0);
            (0, globals_1.expect)(lines[0].id).toBe(1);
            (0, globals_1.expect)(lines[1].id).toBe(2);
            (0, globals_1.expect)(lines[2].id).toBe(3);
        });
    });
    (0, globals_1.describe)('getPostingDescription()', () => {
        (0, globals_1.it)('should return documentation string', () => {
            const description = handler.getPostingDescription();
            (0, globals_1.expect)(description).toContain('Journal Entry');
            (0, globals_1.expect)(description).toContain('debit/credit');
            (0, globals_1.expect)(description).toContain('Total Debits = Total Credits');
        });
    });
});
//# sourceMappingURL=JournalEntryHandler.test.js.map