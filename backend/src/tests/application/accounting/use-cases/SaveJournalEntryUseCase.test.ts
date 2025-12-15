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

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SaveJournalEntryUseCase } from '../../../../src/application/accounting/use-cases/SaveJournalEntryUseCase';
import { JournalEntryInput } from '../../../../src/domain/accounting/handlers/JournalEntryHandler';
import { VoucherStatus, VoucherType } from '../../../../src/domain/accounting/types/VoucherTypes';
import { SimpleCompanyService } from '../../../../src/application/accounting/services/SimpleCompanyService';
import { SimpleExchangeRateService } from '../../../../src/application/accounting/services/SimpleExchangeRateService';
import { SimpleVoucherNumberGenerator } from '../../../../src/application/accounting/services/SimpleVoucherNumberGenerator';
import { InMemoryVoucherRepository } from '../../../helpers/InMemoryVoucherRepository';

describe('SaveJournalEntryUseCase - Integration', () => {
  let useCase: SaveJournalEntryUseCase;
  let repository: InMemoryVoucherRepository;
  let companyService: SimpleCompanyService;
  let exchangeRateService: SimpleExchangeRateService;
  let numberGenerator: SimpleVoucherNumberGenerator;

  beforeEach(() => {
    // Set up dependencies
    repository = new InMemoryVoucherRepository();
    companyService = new SimpleCompanyService();
    exchangeRateService = new SimpleExchangeRateService();
    numberGenerator = new SimpleVoucherNumberGenerator();

    // Create use case
    useCase = new SaveJournalEntryUseCase(
      repository,
      exchangeRateService,
      companyService,
      numberGenerator
    );

    // Set up test company with USD base currency
    companyService.setBaseCurrency('company-001', 'USD');
  });

  describe('Basic Journal Entry Creation', () => {
    it('should create journal entry with valid input', async () => {
      const input: JournalEntryInput = {
        date: '2025-01-15',
        description: 'Monthly depreciation',
        lines: [
          { accountId: 'expense-depreciation', debit: 500, credit: 0 },
          { accountId: 'asset-accum-depr', debit: 0, credit: 500 }
        ]
      };

      const voucher = await useCase.execute(input, 'company-001', 'user-001');

      expect(voucher.id).toBeDefined();
      expect(voucher.voucherNo).toBe('JV-2025-001');
      expect(voucher.type).toBe(VoucherType.JOURNAL_ENTRY);
      expect(voucher.status).toBe(VoucherStatus.DRAFT);
      expect(voucher.description).toBe('Monthly depreciation');
      expect(voucher.createdBy).toBe('user-001');
      expect(voucher.lines).toHaveLength(2);
    });

    it('should auto-increment voucher numbers', async () => {
      const input: JournalEntryInput = {
        date: '2025-01-15',
        description: 'Entry 1',
        lines: [
          { accountId: 'acc-1', debit: 100, credit: 0 },
          { accountId: 'acc-2', debit: 0, credit: 100 }
        ]
      };

      const voucher1 = await useCase.execute(input, 'company-001', 'user-001');
      expect(voucher1.voucherNo).toBe('JV-2025-001');

      const voucher2 = await useCase.execute(input, 'company-001', 'user-001');
      expect(voucher2.voucherNo).toBe('JV-2025-002');

      const voucher3 = await useCase.execute(input, 'company-001', 'user-001');
      expect(voucher3.voucherNo).toBe('JV-2025-003');
    });

    it('should save voucher to repository', async () => {
      const input: JournalEntryInput = {
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
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(voucher.id);
    });
  });

  describe('Multi-Line Entries', () => {
    it('should handle entry with multiple debits', async () => {
      const input: JournalEntryInput = {
        date: '2025-01-15',
        description: 'Split expenses',
        lines: [
          { accountId: 'expense-rent', debit: 1000, credit: 0 },
          { accountId: 'expense-utilities', debit: 200, credit: 0 },
          { accountId: 'cash-checking', debit: 0, credit: 1200 }
        ]
      };

      const voucher = await useCase.execute(input, 'company-001', 'user-001');

      expect(voucher.lines).toHaveLength(3);
      expect(voucher.totalDebit).toBe(1200);
      expect(voucher.totalCredit).toBe(1200);
      expect(voucher.isBalanced).toBe(true);
    });

    it('should handle entry with multiple credits', async () => {
      const input: JournalEntryInput = {
        date: '2025-01-15',
        description: 'Split payment',
        lines: [
          { accountId: 'expense-supplies', debit: 500, credit: 0 },
          { accountId: 'cash-checking', debit: 0, credit: 300 },
          { accountId: 'cash-petty', debit: 0, credit: 200 }
        ]
      };

      const voucher = await useCase.execute(input, 'company-001', 'user-001');

      expect(voucher.lines).toHaveLength(3);
      expect(voucher.totalDebit).toBe(500);
      expect(voucher.totalCredit).toBe(500);
    });

    it('should handle complex multi-line entry', async () => {
      const input: JournalEntryInput = {
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

      expect(voucher.lines).toHaveLength(6);
      expect(voucher.totalDebit).toBe(1350);
      expect(voucher.totalCredit).toBe(1350);
      expect(voucher.isBalanced).toBe(true);
    });
  });

  describe('Posting Verification', () => {
    it('should create balanced voucher', async () => {
      const input: JournalEntryInput = {
        date: '2025-01-15',
        description: 'Test',
        lines: [
          { accountId: 'acc-1', debit: 250, credit: 0 },
          { accountId: 'acc-2', debit: 0, credit: 250 }
        ]
      };

      const voucher = await useCase.execute(input, 'company-001', 'user-001');

      expect(voucher.totalDebit).toBe(250);
      expect(voucher.totalCredit).toBe(250);
      expect(voucher.isBalanced).toBe(true);
    });

    it('should preserve account assignments', async () => {
      const input: JournalEntryInput = {
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

      expect(debitLine!.accountId).toBe('expense-depreciation');
      expect(creditLine!.accountId).toBe('accum-depreciation');
    });
  });

  describe('Multi-Currency Support', () => {
    it('should handle same currency (no FX)', async () => {
      const input: JournalEntryInput = {
        date: '2025-01-15',
        description: 'USD entry',
        lines: [
          { accountId: 'acc-1', debit: 100, credit: 0 },
          { accountId: 'acc-2', debit: 0, credit: 100 }
        ],
        currency: 'USD'
      };

      const voucher = await useCase.execute(input, 'company-001', 'user-001');

      expect(voucher.currency).toBe('USD');
      expect(voucher.baseCurrency).toBe('USD');
      expect(voucher.exchangeRate).toBe(1.0);
      
      voucher.lines.forEach(line => {
        expect(line.amount).toBe(100);
        expect(line.baseAmount).toBe(100);
        expect(line.exchangeRate).toBe(1.0);
      });
    });

    it('should handle foreign currency with exchange rate', async () => {
      // Set up EUR to USD rate = 1.10
      exchangeRateService.setRate('EUR', 'USD', '2025-01-15', 1.10);

      const input: JournalEntryInput = {
        date: '2025-01-15',
        description: 'EUR entry',
        lines: [
          { accountId: 'acc-1', debit: 100, credit: 0 },
          { accountId: 'acc-2', debit: 0, credit: 100 }
        ],
        currency: 'EUR'
      };

      const voucher = await useCase.execute(input, 'company-001', 'user-001');

      expect(voucher.currency).toBe('EUR');
      expect(voucher.baseCurrency).toBe('USD');
      expect(voucher.exchangeRate).toBe(1.10);
      expect(voucher.totalDebit).toBe(110);  // 100 EUR * 1.10 = 110 USD
      expect(voucher.totalCredit).toBe(110);
      
      voucher.lines.forEach(line => {
        expect(line.amount).toBe(100);      // Transaction amount in EUR
        expect(line.baseAmount).toBe(110);  // Base amount in USD
      });
    });

    it('should throw error if exchange rate not found', async () => {
      const input: JournalEntryInput = {
        date: '2025-01-15',
        description: 'GBP entry',
        lines: [
          { accountId: 'acc-1', debit: 100, credit: 0 },
          { accountId: 'acc-2', debit: 0, credit: 100 }
        ],
        currency: 'GBP'
      };

      await expect(
        useCase.execute(input, 'company-001', 'user-001')
      ).rejects.toThrow('Exchange rate not found');
    });
  });

  describe('Validation', () => {
    it('should reject unbalanced entry', async () => {
      const input: JournalEntryInput = {
        date: '2025-01-15',
        description: 'Unbalanced',
        lines: [
          { accountId: 'acc-1', debit: 100, credit: 0 },
          { accountId: 'acc-2', debit: 0, credit: 80 }  // Not balanced!
        ]
      };

      await expect(
        useCase.execute(input, 'company-001', 'user-001')
      ).rejects.toThrow('Entry is not balanced');
    });

    it('should reject entry with less than 2 lines', async () => {
      const input: JournalEntryInput = {
        date: '2025-01-15',
        description: 'Too few lines',
        lines: [
          { accountId: 'acc-1', debit: 100, credit: 0 }
        ]
      };

      await expect(
        useCase.execute(input, 'company-001', 'user-001')
      ).rejects.toThrow('At least 2 lines are required');
    });

    it('should reject line with both debit and credit', async () => {
      const input: JournalEntryInput = {
        date: '2025-01-15',
        description: 'Invalid line',
        lines: [
          { accountId: 'acc-1', debit: 100, credit: 50 },  // Invalid!
          { accountId: 'acc-2', debit: 0, credit: 150 }
        ]
      };

      await expect(
        useCase.execute(input, 'company-001', 'user-001')
      ).rejects.toThrow('Cannot have both debit and credit');
    });
  });

  describe('Audit Trail', () => {
    it('should record creation metadata', async () => {
      const input: JournalEntryInput = {
        date: '2025-01-15',
        description: 'Test',
        lines: [
          { accountId: 'acc-1', debit: 100, credit: 0 },
          { accountId: 'acc-2', debit: 0, credit: 100 }
        ]
      };

      const voucher = await useCase.execute(input, 'company-001', 'user-001');

      expect(voucher.createdBy).toBe('user-001');
      expect(voucher.createdAt).toBeDefined();
      expect(voucher.createdAt).toBeInstanceOf(Date);
    });

    it('should start in DRAFT status', async () => {
      const input: JournalEntryInput = {
        date: '2025-01-15',
        description: 'Test',
        lines: [
          { accountId: 'acc-1', debit: 100, credit: 0 },
          { accountId: 'acc-2', debit: 0, credit: 100 }
        ]
      };

      const voucher = await useCase.execute(input, 'company-001', 'user-001');

      expect(voucher.status).toBe(VoucherStatus.DRAFT);
      expect(voucher.approvedBy).toBeUndefined();
      expect(voucher.approvedAt).toBeUndefined();
    });

    it('should preserve line notes and cost centers', async () => {
      const input: JournalEntryInput = {
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

      expect(debitLine!.notes).toBe('Debit note');
      expect(debitLine!.costCenterId).toBe('cc-sales');
      expect(creditLine!.notes).toBe('Credit note');
      expect(creditLine!.costCenterId).toBe('cc-sales');
    });
  });
});
