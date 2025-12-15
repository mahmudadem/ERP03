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

import { describe, it, expect, beforeEach } from '@jest/globals';
import { JournalEntryHandler, JournalEntryInput, JournalEntryLineInput } from '../../../../src/domain/accounting/handlers/JournalEntryHandler';

describe('JournalEntryHandler', () => {
  let handler: JournalEntryHandler;

  beforeEach(() => {
    handler = new JournalEntryHandler();
  });

  describe('validate()', () => {
    it('should pass validation for valid balanced entry', async () => {
      const input: JournalEntryInput = {
        date: '2025-01-15',
        description: 'Depreciation entry',
        lines: [
          { accountId: 'expense-depreciation', debit: 500, credit: 0 },
          { accountId: 'asset-accum-depr', debit: 0, credit: 500 }
        ]
      };

      await expect(handler.validate(input)).resolves.toBeUndefined();
    });

    it('should reject missing date', async () => {
      const input: JournalEntryInput = {
        date: '',
        description: 'Test',
        lines: [
          { accountId: 'acc-1', debit: 100, credit: 0 },
          { accountId: 'acc-2', debit: 0, credit: 100 }
        ]
      };

      await expect(handler.validate(input)).rejects.toThrow('Date is required');
    });

    it('should reject missing description', async () => {
      const input: JournalEntryInput = {
        date: '2025-01-15',
        description: '',
        lines: [
          { accountId: 'acc-1', debit: 100, credit: 0 },
          { accountId: 'acc-2', debit: 0, credit: 100 }
        ]
      };

      await expect(handler.validate(input)).rejects.toThrow('Description is required');
    });

    it('should reject if less than 2 lines', async () => {
      const input: JournalEntryInput = {
        date: '2025-01-15',
        description: 'Test',
        lines: [
          { accountId: 'acc-1', debit: 100, credit: 0 }
        ]
      };

      await expect(handler.validate(input)).rejects.toThrow('At least 2 lines are required');
    });

    it('should reject line without account', async () => {
      const input: JournalEntryInput = {
        date: '2025-01-15',
        description: 'Test',
        lines: [
          { accountId: '', debit: 100, credit: 0 },
          { accountId: 'acc-2', debit: 0, credit: 100 }
        ]
      };

      await expect(handler.validate(input)).rejects.toThrow('Line 1: Account is required');
    });

    it('should reject line with both debit and credit', async () => {
      const input: JournalEntryInput = {
        date: '2025-01-15',
        description: 'Test',
        lines: [
          { accountId: 'acc-1', debit: 100, credit: 50 },  // Invalid!
          { accountId: 'acc-2', debit: 0, credit: 150 }
        ]
      };

      await expect(handler.validate(input)).rejects.toThrow('Line 1: Cannot have both debit and credit');
    });

    it('should reject line with neither debit nor credit', async () => {
      const input: JournalEntryInput = {
        date: '2025-01-15',
        description: 'Test',
        lines: [
          { accountId: 'acc-1', debit: 0, credit: 0 },  // Invalid!
          { accountId: 'acc-2', debit: 0, credit: 100 }
        ]
      };

      await expect(handler.validate(input)).rejects.toThrow('Line 1: Must have either debit or credit amount');
    });

    it('should reject negative amounts', async () => {
      const input: JournalEntryInput = {
        date: '2025-01-15',
        description: 'Test',
        lines: [
          { accountId: 'acc-1', debit: -100, credit: 0 },
          { accountId: 'acc-2', debit: 0, credit: 100 }
        ]
      };

      await expect(handler.validate(input)).rejects.toThrow('Line 1: Amounts cannot be negative');
    });

    it('should reject unbalanced entry', async () => {
      const input: JournalEntryInput = {
        date: '2025-01-15',
        description: 'Test',
        lines: [
          { accountId: 'acc-1', debit: 100, credit: 0 },
          { accountId: 'acc-2', debit: 0, credit: 80 }  // Not balanced!
        ]
      };

      await expect(handler.validate(input)).rejects.toThrow('Entry is not balanced');
    });
  });

  describe('createLines()', () => {
    it('should create correct number of lines for simple entry', () => {
      const input: JournalEntryInput = {
        date: '2025-01-15',
        description: 'Simple entry',
        lines: [
          { accountId: 'acc-1', debit: 100, credit: 0 },
          { accountId: 'acc-2', debit: 0, credit: 100 }
        ]
      };

      const lines = handler.createLines(input, 'USD', 1.0);

      expect(lines).toHaveLength(2);
    });

    it('should create debit line correctly', () => {
      const input: JournalEntryInput = {
        date: '2025-01-15',
        description: 'Test',
        lines: [
          { accountId: 'expense-001', debit: 150, credit: 0 },
          { accountId: 'cash-001', debit: 0, credit: 150 }
        ]
      };

      const lines = handler.createLines(input, 'USD', 1.0);
      const debitLine = lines.find(l => l.accountId === 'expense-001');

      expect(debitLine).toBeDefined();
      expect(debitLine!.side).toBe('Debit');
      expect(debitLine!.amount).toBe(150);
      expect(debitLine!.baseAmount).toBe(150);
    });

    it('should create credit line correctly', () => {
      const input: JournalEntryInput = {
        date: '2025-01-15',
        description: 'Test',
        lines: [
          { accountId: 'expense-001', debit: 150, credit: 0 },
          { accountId: 'cash-001', debit: 0, credit: 150 }
        ]
      };

      const lines = handler.createLines(input, 'USD', 1.0);
      const creditLine = lines.find(l => l.accountId === 'cash-001');

      expect(creditLine).toBeDefined();
      expect(creditLine!.side).toBe('Credit');
      expect(creditLine!.amount).toBe(150);
      expect(creditLine!.baseAmount).toBe(150);
    });

    it('should handle multi-line entry', () => {
      const input: JournalEntryInput = {
        date: '2025-01-15',
        description: 'Multi-line entry',
        lines: [
          { accountId: 'expense-1', debit: 100, credit: 0 },
          { accountId: 'expense-2', debit: 50, credit: 0 },
          { accountId: 'cash-1', debit: 0, credit: 150 }
        ]
      };

      const lines = handler.createLines(input, 'USD', 1.0);

      expect(lines).toHaveLength(3);
      
      const debitLines = lines.filter(l => l.side === 'Debit');
      const creditLines = lines.filter(l => l.side === 'Credit');
      
      expect(debitLines).toHaveLength(2);
      expect(creditLines).toHaveLength(1);
    });

    it('should handle complex multi-line entry', () => {
      const input: JournalEntryInput = {
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

      expect(lines).toHaveLength(4);
      
      const totalDebit = lines.reduce((sum, l) => sum + l.debitAmount, 0);
      const totalCredit = lines.reduce((sum, l) => sum + l.creditAmount, 0);
      
      expect(totalDebit).toBe(1200);
      expect(totalCredit).toBe(1200);
    });

    it('should handle same currency (no FX)', () => {
      const input: JournalEntryInput = {
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
        expect(line.currency).toBe('USD');
        expect(line.baseCurrency).toBe('USD');
        expect(line.exchangeRate).toBe(1.0);
      });
    });

    it('should handle foreign currency with exchange rate', () => {
      const input: JournalEntryInput = {
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
        expect(line.currency).toBe('EUR');
        expect(line.baseCurrency).toBe('USD');
        expect(line.exchangeRate).toBe(1.10);
      });

      const debitLine = lines.find(l => l.side === 'Debit');
      expect(debitLine!.amount).toBe(100);      // Transaction amount in EUR
      expect(debitLine!.baseAmount).toBe(110);  // Base amount in USD
    });

    it('should preserve line notes', () => {
      const input: JournalEntryInput = {
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

      expect(debitLine!.notes).toBe('Debit note');
      expect(creditLine!.notes).toBe('Credit note');
    });

    it('should include cost center if provided', () => {
      const input: JournalEntryInput = {
        date: '2025-01-15',
        description: 'Entry with cost center',
        lines: [
          { accountId: 'acc-1', debit: 100, credit: 0, costCenterId: 'cc-sales' },
          { accountId: 'acc-2', debit: 0, credit: 100, costCenterId: 'cc-sales' }
        ]
      };

      const lines = handler.createLines(input, 'USD', 1.0);

      lines.forEach(line => {
        expect(line.costCenterId).toBe('cc-sales');
      });
    });

    it('should assign sequential line IDs', () => {
      const input: JournalEntryInput = {
        date: '2025-01-15',
        description: 'Test IDs',
        lines: [
          { accountId: 'acc-1', debit: 50, credit: 0 },
          { accountId: 'acc-2', debit: 50, credit: 0 },
          { accountId: 'acc-3', debit: 0, credit: 100 }
        ]
      };

      const lines = handler.createLines(input, 'USD', 1.0);

      expect(lines[0].id).toBe(1);
      expect(lines[1].id).toBe(2);
      expect(lines[2].id).toBe(3);
    });
  });

  describe('getPostingDescription()', () => {
    it('should return documentation string', () => {
      const description = handler.getPostingDescription();

      expect(description).toContain('Journal Entry');
      expect(description).toContain('debit/credit');
      expect(description).toContain('Total Debits = Total Credits');
    });
  });
});
