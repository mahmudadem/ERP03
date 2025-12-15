/**
 * Receipt Voucher Handler Tests
 * 
 * ADR-005 Compliant - Mirror of PaymentVoucherHandler Tests
 * 
 * These tests verify that the ReceiptVoucherHandler correctly:
 * 1. Validates input
 * 2. Creates exactly 2 lines (debit and credit)
 * 3. Always debits cash, credits revenue
 * 4. Handles multi-currency correctly
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ReceiptVoucherHandler, ReceiptVoucherInput } from '../../../../src/domain/accounting/handlers/ReceiptVoucherHandler';

describe('ReceiptVoucherHandler', () => {
  let handler: ReceiptVoucherHandler;

  beforeEach(() => {
    handler = new ReceiptVoucherHandler();
  });

  describe('validate()', () => {
    it('should pass validation for valid input', async () => {
      const input: ReceiptVoucherInput = {
        date: '2025-01-15',
        amount: 100,
        cashAccountId: 'cash-001',
        revenueAccountId: 'revenue-001',
        description: 'Customer payment'
      };

      await expect(handler.validate(input)).resolves.toBeUndefined();
    });

    it('should reject missing date', async () => {
      const input: ReceiptVoucherInput = {
        date: '',
        amount: 100,
        cashAccountId: 'cash-001',
        revenueAccountId: 'revenue-001',
        description: 'Test'
      };

      await expect(handler.validate(input)).rejects.toThrow('Date is required');
    });

    it('should reject zero or negative amount', async () => {
      const input: ReceiptVoucherInput = {
        date: '2025-01-15',
        amount: 0,
        cashAccountId: 'cash-001',
        revenueAccountId: 'revenue-001',
        description: 'Test'
      };

      await expect(handler.validate(input)).rejects.toThrow('Amount must be greater than zero');
    });

    it('should reject missing cash account', async () => {
      const input: ReceiptVoucherInput = {
        date: '2025-01-15',
        amount: 100,
        cashAccountId: '',
        revenueAccountId: 'revenue-001',
        description: 'Test'
      };

      await expect(handler.validate(input)).rejects.toThrow('Cash/Bank account is required');
    });

    it('should reject missing revenue account', async () => {
      const input: ReceiptVoucherInput = {
        date: '2025-01-15',
        amount: 100,
        cashAccountId: 'cash-001',
        revenueAccountId: '',
        description: 'Test'
      };

      await expect(handler.validate(input)).rejects.toThrow('Revenue/Receivable account is required');
    });

    it('should reject same account for cash and revenue', async () => {
      const input: ReceiptVoucherInput = {
        date: '2025-01-15',
        amount: 100,
        cashAccountId: 'account-001',
        revenueAccountId: 'account-001',
        description: 'Test'
      };

      await expect(handler.validate(input)).rejects.toThrow(
        'Cash account and revenue account cannot be the same'
      );
    });
  });

  describe('createLines()', () => {
    it('should create exactly 2 lines', () => {
      const input: ReceiptVoucherInput = {
        date: '2025-01-15',
        amount: 100,
        cashAccountId: 'cash-001',
        revenueAccountId: 'revenue-001',
        description: 'Customer payment'
      };

      const lines = handler.createLines(input, 'USD', 1.0);

      expect(lines).toHaveLength(2);
    });

    it('should DEBIT cash account', () => {
      const input: ReceiptVoucherInput = {
        date: '2025-01-15',
        amount: 100,
        cashAccountId: 'cash-001',
        revenueAccountId: 'revenue-001',
        description: 'Customer payment'
      };

      const lines = handler.createLines(input, 'USD', 1.0);
      const debitLine = lines.find(l => l.side === 'Debit');

      expect(debitLine).toBeDefined();
      expect(debitLine!.accountId).toBe('cash-001');
      expect(debitLine!.amount).toBe(100);
      expect(debitLine!.baseAmount).toBe(100);
    });

    it('should CREDIT revenue account', () => {
      const input: ReceiptVoucherInput = {
        date: '2025-01-15',
        amount: 100,
        cashAccountId: 'cash-001',
        revenueAccountId: 'revenue-001',
        description: 'Customer payment'
      };

      const lines = handler.createLines(input, 'USD', 1.0);
      const creditLine = lines.find(l => l.side === 'Credit');

      expect(creditLine).toBeDefined();
      expect(creditLine!.accountId).toBe('revenue-001');
      expect(creditLine!.amount).toBe(100);
      expect(creditLine!.baseAmount).toBe(100);
    });

    it('should handle same currency (no FX)', () => {
      const input: ReceiptVoucherInput = {
        date: '2025-01-15',
        amount: 100,
        cashAccountId: 'cash-001',
        revenueAccountId: 'revenue-001',
        description: 'Customer payment',
        currency: 'USD'
      };

      const lines = handler.createLines(input, 'USD', 1.0);

      lines.forEach(line => {
        expect(line.currency).toBe('USD');
        expect(line.baseCurrency).toBe('USD');
        expect(line.exchangeRate).toBe(1.0);
        expect(line.amount).toBe(100);
        expect(line.baseAmount).toBe(100);
      });
    });

    it('should handle foreign currency with exchange rate', () => {
      const input: ReceiptVoucherInput = {
        date: '2025-01-15',
        amount: 100,  // 100 EUR
        cashAccountId: 'cash-001',
        revenueAccountId: 'revenue-001',
        description: 'Customer payment',
        currency: 'EUR'
      };

      // EUR to USD rate = 1.10
      const lines = handler.createLines(input, 'USD', 1.10);

      lines.forEach(line => {
        expect(line.currency).toBe('EUR');
        expect(line.baseCurrency).toBe('USD');
        expect(line.exchangeRate).toBe(1.10);
        expect(line.amount).toBe(100);  // Transaction amount
        expect(line.baseAmount).toBe(110);  // Base amount (100 * 1.10)
      });
    });

    it('should preserve description in line notes', () => {
      const input: ReceiptVoucherInput = {
        date: '2025-01-15',
        amount: 100,
        cashAccountId: 'cash-001',
        revenueAccountId: 'revenue-001',
        description: 'Customer payment received',
        notes: 'Invoice #12345'
      };

      const lines = handler.createLines(input, 'USD', 1.0);

      lines.forEach(line => {
        expect(line.notes).toBe('Invoice #12345');
      });
    });

    it('should include cost center if provided', () => {
      const input: ReceiptVoucherInput = {
        date: '2025-01-15',
        amount: 100,
        cashAccountId: 'cash-001',
        revenueAccountId: 'revenue-001',
        description: 'Customer payment',
        costCenterId: 'cc-sales'
      };

      const lines = handler.createLines(input, 'USD', 1.0);

      lines.forEach(line => {
        expect(line.costCenterId).toBe('cc-sales');
      });
    });

    it('should assign correct line IDs', () => {
      const input: ReceiptVoucherInput = {
        date: '2025-01-15',
        amount: 100,
        cashAccountId: 'cash-001',
        revenueAccountId: 'revenue-001',
        description: 'Test'
      };

      const lines = handler.createLines(input, 'USD', 1.0);

      expect(lines[0].id).toBe(1);  // Debit line (Cash)
      expect(lines[1].id).toBe(2);  // Credit line (Revenue)
    });
  });

  describe('getPostingDescription()', () => {
    it('should return documentation string', () => {
      const description = handler.getPostingDescription();

      expect(description).toContain('DEBIT');
      expect(description).toContain('CREDIT');
      expect(description).toContain('Cash/Bank');
      expect(description).toContain('Revenue/Receivable');
    });
  });
});
