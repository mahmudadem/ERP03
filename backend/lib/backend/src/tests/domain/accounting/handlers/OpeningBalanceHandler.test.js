"use strict";
/**
 * Opening Balance Handler Tests
 *
 * ADR-005 Compliant
 *
 * These tests verify that the OpeningBalanceHandler correctly:
 * 1. Validates user input (including accounting equation)
 * 2. Converts opening balances to voucher lines
 * 3. Handles multi-account initialization
 */
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const OpeningBalanceHandler_1 = require("../../../../src/domain/accounting/handlers/OpeningBalanceHandler");
(0, globals_1.describe)('OpeningBalanceHandler', () => {
    let handler;
    (0, globals_1.beforeEach)(() => {
        handler = new OpeningBalanceHandler_1.OpeningBalanceHandler();
    });
    (0, globals_1.describe)('validate()', () => {
        (0, globals_1.it)('should pass validation for balanced opening balances', async () => {
            const input = {
                date: '2025-01-01',
                description: 'Opening balances',
                lines: [
                    { accountId: 'asset-cash', debit: 10000, credit: 0 },
                    { accountId: 'equity-owner', debit: 0, credit: 10000 }
                ]
            };
            await (0, globals_1.expect)(handler.validate(input)).resolves.toBeUndefined();
        });
        (0, globals_1.it)('should pass validation for complex opening balances', async () => {
            const input = {
                date: '2025-01-01',
                description: 'Opening balances as of Jan 1, 2025',
                lines: [
                    { accountId: 'asset-cash', debit: 10000, credit: 0 },
                    { accountId: 'asset-equipment', debit: 5000, credit: 0 },
                    { accountId: 'liability-payable', debit: 0, credit: 3000 },
                    { accountId: 'equity-owner', debit: 0, credit: 12000 }
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
                date: '2025-01-01',
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
                date: '2025-01-01',
                description: 'Test',
                lines: [
                    { accountId: 'acc-1', debit: 100, credit: 0 }
                ]
            };
            await (0, globals_1.expect)(handler.validate(input)).rejects.toThrow('At least 2 lines are required');
        });
        (0, globals_1.it)('should reject line without account', async () => {
            const input = {
                date: '2025-01-01',
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
                date: '2025-01-01',
                description: 'Test',
                lines: [
                    { accountId: 'acc-1', debit: 100, credit: 50 },
                    { accountId: 'acc-2', debit: 0, credit: 150 }
                ]
            };
            await (0, globals_1.expect)(handler.validate(input)).rejects.toThrow('Cannot have both debit and credit balance');
        });
        (0, globals_1.it)('should reject line with neither debit nor credit', async () => {
            const input = {
                date: '2025-01-01',
                description: 'Test',
                lines: [
                    { accountId: 'acc-1', debit: 0, credit: 0 },
                    { accountId: 'acc-2', debit: 0, credit: 100 }
                ]
            };
            await (0, globals_1.expect)(handler.validate(input)).rejects.toThrow('Must have either debit or credit balance');
        });
        (0, globals_1.it)('should reject negative balances', async () => {
            const input = {
                date: '2025-01-01',
                description: 'Test',
                lines: [
                    { accountId: 'acc-1', debit: -100, credit: 0 },
                    { accountId: 'acc-2', debit: 0, credit: 100 }
                ]
            };
            await (0, globals_1.expect)(handler.validate(input)).rejects.toThrow('Balances cannot be negative');
        });
        (0, globals_1.it)('should reject unbalanced opening balances', async () => {
            const input = {
                date: '2025-01-01',
                description: 'Test',
                lines: [
                    { accountId: 'asset-cash', debit: 10000, credit: 0 },
                    { accountId: 'equity-owner', debit: 0, credit: 8000 } // Not balanced!
                ]
            };
            await (0, globals_1.expect)(handler.validate(input)).rejects.toThrow('Opening balances not balanced');
            await (0, globals_1.expect)(handler.validate(input)).rejects.toThrow('Assets = Liabilities + Equity');
        });
    });
    (0, globals_1.describe)('createLines()', () => {
        (0, globals_1.it)('should create correct number of lines', () => {
            const input = {
                date: '2025-01-01',
                description: 'Opening balances',
                lines: [
                    { accountId: 'asset-cash', debit: 10000, credit: 0 },
                    { accountId: 'equity-owner', debit: 0, credit: 10000 }
                ]
            };
            const lines = handler.createLines(input, 'USD', 1.0);
            (0, globals_1.expect)(lines).toHaveLength(2);
        });
        (0, globals_1.it)('should create asset (debit) lines correctly', () => {
            const input = {
                date: '2025-01-01',
                description: 'Opening',
                lines: [
                    { accountId: 'asset-cash', debit: 5000, credit: 0 },
                    { accountId: 'equity-owner', debit: 0, credit: 5000 }
                ]
            };
            const lines = handler.createLines(input, 'USD', 1.0);
            const assetLine = lines.find(l => l.accountId === 'asset-cash');
            (0, globals_1.expect)(assetLine).toBeDefined();
            (0, globals_1.expect)(assetLine.side).toBe('Debit');
            (0, globals_1.expect)(assetLine.amount).toBe(5000);
            (0, globals_1.expect)(assetLine.baseAmount).toBe(5000);
        });
        (0, globals_1.it)('should create liability/equity (credit) lines correctly', () => {
            const input = {
                date: '2025-01-01',
                description: 'Opening',
                lines: [
                    { accountId: 'asset-cash', debit: 5000, credit: 0 },
                    { accountId: 'equity-owner', debit: 0, credit: 5000 }
                ]
            };
            const lines = handler.createLines(input, 'USD', 1.0);
            const equityLine = lines.find(l => l.accountId === 'equity-owner');
            (0, globals_1.expect)(equityLine).toBeDefined();
            (0, globals_1.expect)(equityLine.side).toBe('Credit');
            (0, globals_1.expect)(equityLine.amount).toBe(5000);
            (0, globals_1.expect)(equityLine.baseAmount).toBe(5000);
        });
        (0, globals_1.it)('should handle complex multi-account opening', () => {
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
            const lines = handler.createLines(input, 'USD', 1.0);
            (0, globals_1.expect)(lines).toHaveLength(4);
            const debitLines = lines.filter(l => l.side === 'Debit');
            const creditLines = lines.filter(l => l.side === 'Credit');
            (0, globals_1.expect)(debitLines).toHaveLength(2);
            (0, globals_1.expect)(creditLines).toHaveLength(2);
            const totalDebit = lines.reduce((sum, l) => sum + l.debitAmount, 0);
            const totalCredit = lines.reduce((sum, l) => sum + l.creditAmount, 0);
            (0, globals_1.expect)(totalDebit).toBe(15000);
            (0, globals_1.expect)(totalCredit).toBe(15000);
        });
        (0, globals_1.it)('should handle same currency (no FX)', () => {
            const input = {
                date: '2025-01-01',
                description: 'USD opening',
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
        (0, globals_1.it)('should preserve line notes', () => {
            const input = {
                date: '2025-01-01',
                description: 'Opening with notes',
                lines: [
                    { accountId: 'acc-1', debit: 100, credit: 0, notes: 'Cash on hand' },
                    { accountId: 'acc-2', debit: 0, credit: 100, notes: 'Initial investment' }
                ]
            };
            const lines = handler.createLines(input, 'USD', 1.0);
            const debitLine = lines.find(l => l.side === 'Debit');
            const creditLine = lines.find(l => l.side === 'Credit');
            (0, globals_1.expect)(debitLine.notes).toBe('Cash on hand');
            (0, globals_1.expect)(creditLine.notes).toBe('Initial investment');
        });
        (0, globals_1.it)('should assign sequential line IDs', () => {
            const input = {
                date: '2025-01-01',
                description: 'Test IDs',
                lines: [
                    { accountId: 'acc-1', debit: 100, credit: 0 },
                    { accountId: 'acc-2', debit: 50, credit: 0 },
                    { accountId: 'acc-3', debit: 0, credit: 150 }
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
            (0, globals_1.expect)(description).toContain('Opening Balance');
            (0, globals_1.expect)(description).toContain('Assets');
            (0, globals_1.expect)(description).toContain('Liabilities');
            (0, globals_1.expect)(description).toContain('Equity');
            (0, globals_1.expect)(description).toContain('accounting equation');
        });
    });
});
//# sourceMappingURL=OpeningBalanceHandler.test.js.map