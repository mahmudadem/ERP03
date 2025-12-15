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

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SaveOpeningBalanceUseCase } from '../../../../src/application/accounting/use-cases/SaveOpeningBalanceUseCase';
import { OpeningBalanceInput } from '../../../../src/domain/accounting/handlers/OpeningBalanceHandler';
import { VoucherStatus, VoucherType } from '../../../../src/domain/accounting/types/VoucherTypes';
import { SimpleCompanyService } from '../../../../src/application/accounting/services/SimpleCompanyService';
import { SimpleExchangeRateService } from '../../../../src/application/accounting/services/SimpleExchangeRateService';
import { SimpleVoucherNumberGenerator } from '../../../../src/application/accounting/services/SimpleVoucherNumberGenerator';
import { InMemoryVoucherRepository } from '../../../helpers/InMemoryVoucherRepository';

describe('SaveOpeningBalanceUseCase - Integration', () => {
  let useCase: SaveOpeningBalanceUseCase;
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
    useCase = new SaveOpeningBalanceUseCase(
      repository,
      exchangeRateService,
      companyService,
      numberGenerator
    );

    // Set up test company with USD base currency
    companyService.setBaseCurrency('company-001', 'USD');
  });

  describe('Basic Opening Balance Creation', () => {
    it('should create opening balance with valid input', async () => {
      const input: OpeningBalanceInput = {
        date: '2025-01-01',
        description: 'Opening balances as of January 1, 2025',
        lines: [
          { accountId: 'asset-cash', debit: 10000, credit: 0 },
          { accountId: 'equity-owner', debit: 0, credit: 10000 }
        ]
      };

      const voucher = await useCase.execute(input, 'company-001', 'user-001');

      expect(voucher.id).toBeDefined();
      expect(voucher.voucherNo).toBe('OB-2025-001');
      expect(voucher.type).toBe(VoucherType.OPENING_BALANCE);
      expect(voucher.status).toBe(VoucherStatus.DRAFT);
      expect(voucher.description).toBe('Opening balances as of January 1, 2025');
      expect(voucher.createdBy).toBe('user-001');
      expect(voucher.lines).toHaveLength(2);
    });

    it('should auto-increment voucher numbers', async () => {
      const input: OpeningBalanceInput = {
        date: '2025-01-01',
        description: 'Opening 1',
        lines: [
          { accountId: 'acc-1', debit: 100, credit: 0 },
          { accountId: 'acc-2', debit: 0, credit: 100 }
        ]
      };

      const voucher1 = await useCase.execute(input, 'company-001', 'user-001');
      expect(voucher1.voucherNo).toBe('OB-2025-001');

      const voucher2 = await useCase.execute(input, 'company-001', 'user-001');
      expect(voucher2.voucherNo).toBe('OB-2025-002');
    });

    it('should save voucher to repository', async () => {
      const input: OpeningBalanceInput = {
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
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(voucher.id);
    });
  });

  describe('Multi-Account Opening Balances', () => {
    it('should handle complex opening with multiple accounts', async () => {
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

      const voucher = await useCase.execute(input, 'company-001', 'user-001');

      expect(voucher.lines).toHaveLength(4);
      expect(voucher.totalDebit).toBe(15000);
      expect(voucher.totalCredit).toBe(15000);
      expect(voucher.isBalanced).toBe(true);
    });

    it('should handle multiple assets', async () => {
      const input: OpeningBalanceInput = {
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
      expect(assetLines).toHaveLength(3);
      expect(voucher.totalDebit).toBe(10000);
    });

    it('should handle multiple liabilities and equity', async () => {
      const input: OpeningBalanceInput = {
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
      expect(liabilityEquityLines).toHaveLength(3);
      expect(voucher.totalCredit).toBe(8000);
    });
  });

  describe('Posting Verification', () => {
    it('should create balanced voucher', async () => {
      const input: OpeningBalanceInput = {
        date: '2025-01-01',
        description: 'Test',
        lines: [
          { accountId: 'asset-cash', debit: 5000, credit: 0 },
          { accountId: 'equity-owner', debit: 0, credit: 5000 }
        ]
      };

      const voucher = await useCase.execute(input, 'company-001', 'user-001');

      expect(voucher.totalDebit).toBe(5000);
      expect(voucher.totalCredit).toBe(5000);
      expect(voucher.isBalanced).toBe(true);
    });

    it('should preserve account assignments', async () => {
      const input: OpeningBalanceInput = {
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

      expect(debitLine!.accountId).toBe('asset-cash-001');
      expect(creditLine!.accountId).toBe('equity-retained-002');
    });
  });

  describe('Validation', () => {
    it('should reject unbalanced opening', async () => {
      const input: OpeningBalanceInput = {
        date: '2025-01-01',
        description: 'Unbalanced',
        lines: [
          { accountId: 'asset-cash', debit: 10000, credit: 0 },
          { accountId: 'equity-owner', debit: 0, credit: 8000 }  // Not balanced!
        ]
      };

      await expect(
        useCase.execute(input, 'company-001', 'user-001')
      ).rejects.toThrow('Opening balances not balanced');
    });

    it('should reject entry with less than 2 lines', async () => {
      const input: OpeningBalanceInput = {
        date: '2025-01-01',
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
      const input: OpeningBalanceInput = {
        date: '2025-01-01',
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
      const input: OpeningBalanceInput = {
        date: '2025-01-01',
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
      const input: OpeningBalanceInput = {
        date: '2025-01-01',
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

    it('should preserve line notes', async () => {
      const input: OpeningBalanceInput = {
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

      expect(debitLine!.notes).toBe('Cash on hand');
      expect(creditLine!.notes).toBe('Initial investment');
    });
  });
});
