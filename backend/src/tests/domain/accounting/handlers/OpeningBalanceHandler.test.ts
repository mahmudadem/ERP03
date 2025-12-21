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

import { describe, it, expect, beforeEach } from '@jest/globals';
import { OpeningBalanceHandler, OpeningBalanceInput } from '../../../../src/domain/accounting/handlers/OpeningBalanceHandler';

describe('OpeningBalanceHandler', () => {
  let handler: OpeningBalanceHandler;

  beforeEach(() => {
    handler = new OpeningBalanceHandler();
  });

  describe('validate()', () => {
    it('should pass validation for balanced opening balances', async () => {
      const input: OpeningBalanceInput = {
        date: '2025-01-01',
        description: 'Opening balances',
        lines: [
          { accountId: 'asset-cash', debit: 10000, credit: 0 },
          { accountId: 'equity-owner', debit: 0, credit: 10000 }
        ]
      };

      await expect(handler.validate(input)).resolves.toBeUndefined();
    });

    it('should pass validation for complex opening balances', async () => {
      const input: OpeningBalanceInput = {
        date: '2025-01-01',
        description: 'Opening balances as of Jan 1, 2025',
        lines: [
          { accountId: 'asset-cash', debit: 10000, credit: 0 },
          { accountId: 'asset-equipment', debit: 5000, credit: 0 },
          { accountId: 'liability-payable', debit: 0, credit: 3000 },
          { accountId: 'equity-owner', debit: 0, credit: 12000 }
        ]
      };

      await expect(handler.validate(input)).resolves.toBeUndefined();
    });

    it('should reject missing date', async () => {
      const input: OpeningBalanceInput = {
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
      const input: OpeningBalanceInput = {
        date: '2025-01-01',
        description: '',
        lines: [
          { accountId: 'acc-1', debit: 100, credit: 0 },
          { accountId: 'acc-2', debit: 0, credit: 100 }
        ]
      };

      await expect(handler.validate(input)).rejects.toThrow('Description is required');
    });

    it('should reject if less than 2 lines', async () => {
      const input: OpeningBalanceInput = {
        date: '2025-01-01',
        description: 'Test',
        lines: [
          { accountId: 'acc-1', debit: 100, credit: 0 }
        ]
      };

      await expect(handler.validate(input)).rejects.toThrow('At least 2 lines are required');
    });

    it('should reject line without account', async () => {
      const input: OpeningBalanceInput = {
        date: '2025-01-01',
        description: 'Test',
        lines: [
          { accountId: '', debit: 100, credit: 0 },
          { accountId: 'acc-2', debit: 0, credit: 100 }
        ]
      };

      await expect(handler.validate(input)).rejects.toThrow('Line 1: Account is required');
    });

    it('should reject line with both debit and credit', async () => {
      const input: OpeningBalanceInput = {
        date: '2025-01-01',
        description: 'Test',
        lines: [
          { accountId: 'acc-1', debit: 100, credit: 50 },
          { accountId: 'acc-2', debit: 0, credit: 150 }
        ]
      };

      await expect(handler.validate(input)).rejects.toThrow('Cannot have both debit and credit balance');
    });

    it('should reject line with neither debit nor credit', async () => {
      const input: OpeningBalanceInput = {
        date: '2025-01-01',
        description: 'Test',
        lines: [
          { accountId: 'acc-1', debit: 0, credit: 0 },
          { accountId: 'acc-2', debit: 0, credit: 100 }
        ]
      };

      await expect(handler.validate(input)).rejects.toThrow('Must have either debit or credit balance');
    });

    it('should reject negative balances', async () => {
      const input: OpeningBalanceInput = {
        date: '2025-01-01',
        description: 'Test',
        lines: [
          { accountId: 'acc-1', debit: -100, credit: 0 },
          { accountId: 'acc-2', debit: 0, credit: 100 }
        ]
      };

      await expect(handler.validate(input)).rejects.toThrow('Balances cannot be negative');
    });

    it('should reject unbalanced opening balances', async () => {
      const input: OpeningBalanceInput = {
        date: '2025-01-01',
        description: 'Test',
        lines: [
          { accountId: 'asset-cash', debit: 10000, credit: 0 },
          { accountId: 'equity-owner', debit: 0, credit: 8000 }  // Not balanced!
        ]
      };

      await expect(handler.validate(input)).rejects.toThrow('Opening balances not balanced');
      await expect(handler.validate(input)).rejects.toThrow('Assets = Liabilities + Equity');
    });
  });

  describe('createLines()', () => {
    it('should create correct number of lines', () => {
      const input: OpeningBalanceInput = {
        date: '2025-01-01',
        description: 'Opening balances',
        lines: [
          { accountId: 'asset-cash', debit: 10000, credit: 0 },
          { accountId: 'equity-owner', debit: 0, credit: 10000 }
        ]
      };

      const lines = handler.createLines(input, 'USD', 1.0);

      expect(lines).toHaveLength(2);
    });

    it('should create asset (debit) lines correctly', () => {
      const input: OpeningBalanceInput = {
        date: '2025-01-01',
        description: 'Opening',
        lines: [
          { accountId: 'asset-cash', debit: 5000, credit: 0 },
          { accountId: 'equity-owner', debit: 0, credit: 5000 }
        ]
      };

      const lines = handler.createLines(input, 'USD', 1.0);
      const assetLine = lines.find(l => l.accountId === 'asset-cash');

      expect(assetLine).toBeDefined();
      expect(assetLine!.side).toBe('Debit');
      expect(assetLine!.amount).toBe(5000);
      expect(assetLine!.baseAmount).toBe(5000);
    });

    it('should create liability/equity (credit) lines correctly', () => {
      const input: OpeningBalanceInput = {
        date: '2025-01-01',
        description: 'Opening',
        lines: [
          { accountId: 'asset-cash', debit: 5000, credit: 0 },
          { accountId: 'equity-owner', debit: 0, credit: 5000 }
        ]
      };

      const lines = handler.createLines(input, 'USD', 1.0);
      const equityLine = lines.find(l => l.accountId === 'equity-owner');

      expect(equityLine).toBeDefined();
      expect(equityLine!.side).toBe('Credit');
      expect(equityLine!.amount).toBe(5000);
      expect(equityLine!.baseAmount).toBe(5000);
    });

    it('should handle complex multi-account opening', () => {
      const input: OpeningBalanceInput = {
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

      expect(lines).toHaveLength(4);
      
      const debitLines = lines.filter(l => l.side === 'Debit');
      const creditLines = lines.filter(l => l.side === 'Credit');
      
      expect(debitLines).toHaveLength(2);
      expect(creditLines).toHaveLength(2);
      
      const totalDebit = lines.reduce((sum, l) => sum + l.debitAmount, 0);
      const totalCredit = lines.reduce((sum, l) => sum + l.creditAmount, 0);
      
      expect(totalDebit).toBe(15000);
      expect(totalCredit).toBe(15000);
    });

    it('should handle same currency (no FX)', () => {
      const input: OpeningBalanceInput = {
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
        expect(line.currency).toBe('USD');
        expect(line.baseCurrency).toBe('USD');
        expect(line.exchangeRate).toBe(1.0);
      });
    });

    it('should preserve line notes', () => {
      const input: OpeningBalanceInput = {
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

      expect(debitLine!.notes).toBe('Cash on hand');
      expect(creditLine!.notes).toBe('Initial investment');
    });

    it('should assign sequential line IDs', () => {
      const input: OpeningBalanceInput = {
        date: '2025-01-01',
        description: 'Test IDs',
        lines: [
          { accountId: 'acc-1', debit: 100, credit: 0 },
          { accountId: 'acc-2', debit: 50, credit: 0 },
          { accountId: 'acc-3', debit: 0, credit: 150 }
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

      expect(description).toContain('Opening Balance');
      expect(description).toContain('Assets');
      expect(description).toContain('Liabilities');
      expect(description).toContain('Equity');
      expect(description).toContain('accounting equation');
    });
  });
});
