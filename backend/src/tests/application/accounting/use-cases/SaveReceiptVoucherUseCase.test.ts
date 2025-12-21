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

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SaveReceiptVoucherUseCase } from '../../../../src/application/accounting/use-cases/SaveReceiptVoucherUseCase';
import { ReceiptVoucherInput } from '../../../../src/domain/accounting/handlers/ReceiptVoucherHandler';
import { VoucherStatus, VoucherType } from '../../../../src/domain/accounting/types/VoucherTypes';
import { SimpleCompanyService } from '../../../../src/application/accounting/services/SimpleCompanyService';
import { SimpleExchangeRateService } from '../../../../src/application/accounting/services/SimpleExchangeRateService';
import { SimpleVoucherNumberGenerator } from '../../../../src/application/accounting/services/SimpleVoucherNumberGenerator';
import { InMemoryVoucherRepository } from '../../../helpers/InMemoryVoucherRepository';

describe('SaveReceiptVoucherUseCase - Integration', () => {
  let useCase: SaveReceiptVoucherUseCase;
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
    useCase = new SaveReceiptVoucherUseCase(
      repository,
      exchangeRateService,
      companyService,
      numberGenerator
    );

    // Set up test company with USD base currency
    companyService.setBaseCurrency('company-001', 'USD');
  });

  describe('Basic Receipt Creation', () => {
    it('should create receipt voucher with valid input', async () => {
      const input: ReceiptVoucherInput = {
        date: '2025-01-15',
        amount: 100,
        cashAccountId: 'cash-001',
        revenueAccountId: 'revenue-001',
        description: 'Customer payment received'
      };

      const voucher = await useCase.execute(input, 'company-001', 'user-001');

      expect(voucher.id).toBeDefined();
      expect(voucher.voucherNo).toBe('REC-2025-001');
      expect(voucher.type).toBe(VoucherType.RECEIPT);
      expect(voucher.status).toBe(VoucherStatus.DRAFT);
      expect(voucher.description).toBe('Customer payment received');
      expect(voucher.createdBy).toBe('user-001');
      expect(voucher.lines).toHaveLength(2);
    });

    it('should auto-increment voucher numbers', async () => {
      const input: ReceiptVoucherInput = {
        date: '2025-01-15',
        amount: 100,
        cashAccountId: 'cash-001',
        revenueAccountId: 'revenue-001',
        description: 'Receipt 1'
      };

      const voucher1 = await useCase.execute(input, 'company-001', 'user-001');
      expect(voucher1.voucherNo).toBe('REC-2025-001');

      const voucher2 = await useCase.execute(input, 'company-001', 'user-001');
      expect(voucher2.voucherNo).toBe('REC-2025-002');

      const voucher3 = await useCase.execute(input, 'company-001', 'user-001');
      expect(voucher3.voucherNo).toBe('REC-2025-003');
    });

    it('should save voucher to repository', async () => {
      const input: ReceiptVoucherInput = {
        date: '2025-01-15',
        amount: 100,
        cashAccountId: 'cash-001',
        revenueAccountId: 'revenue-001',
        description: 'Test receipt'
      };

      const voucher = await useCase.execute(input, 'company-001', 'user-001');

      // Verify it's in repository
      const retrieved = await repository.findById('company-001', voucher.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(voucher.id);
    });
  });

  describe('Posting Logic Verification', () => {
    it('should DEBIT cash account', async () => {
      const input: ReceiptVoucherInput = {
        date: '2025-01-15',
        amount: 150,
        cashAccountId: 'cash-001',
        revenueAccountId: 'revenue-001',
        description: 'Test'
      };

      const voucher = await useCase.execute(input, 'company-001', 'user-001');

      const debitLine = voucher.lines.find(l => l.side === 'Debit');
      expect(debitLine).toBeDefined();
      expect(debitLine!.accountId).toBe('cash-001');
      expect(debitLine!.baseAmount).toBe(150);
    });

    it('should CREDIT revenue account', async () => {
      const input: ReceiptVoucherInput = {
        date: '2025-01-15',
        amount: 150,
        cashAccountId: 'cash-001',
        revenueAccountId: 'revenue-001',
        description: 'Test'
      };

      const voucher = await useCase.execute(input, 'company-001', 'user-001');

      const creditLine = voucher.lines.find(l => l.side === 'Credit');
      expect(creditLine).toBeDefined();
      expect(creditLine!.accountId).toBe('revenue-001');
      expect(creditLine!.baseAmount).toBe(150);
    });

    it('should create balanced voucher', async () => {
      const input: ReceiptVoucherInput = {
        date: '2025-01-15',
        amount: 250,
        cashAccountId: 'cash-001',
        revenueAccountId: 'revenue-001',
        description: 'Test'
      };

      const voucher = await useCase.execute(input, 'company-001', 'user-001');

      expect(voucher.totalDebit).toBe(250);
      expect(voucher.totalCredit).toBe(250);
      expect(voucher.isBalanced).toBe(true);
    });
  });

  describe('Multi-Currency Support', () => {
    it('should handle same currency (no FX)', async () => {
      const input: ReceiptVoucherInput = {
        date: '2025-01-15',
        amount: 100,
        cashAccountId: 'cash-001',
        revenueAccountId: 'revenue-001',
        description: 'USD receipt',
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

      const input: ReceiptVoucherInput = {
        date: '2025-01-15',
        amount: 100,  // 100 EUR
        cashAccountId: 'cash-001',
        revenueAccountId: 'revenue-001',
        description: 'EUR receipt',
        currency: 'EUR'
      };

      const voucher = await useCase.execute(input, 'company-001', 'user-001');

      expect(voucher.currency).toBe('EUR');
      expect(voucher.baseCurrency).toBe('USD');
      expect(voucher.exchangeRate).toBe(1.10);
      expect(voucher.totalDebit).toBe(110);  // 100 EUR * 1.10 = 110 USD
      expect(voucher.totalCredit).toBe(110);
      
      voucher.lines.forEach(line => {
        expect(line.amount).toBe(100);  // Transaction amount in EUR
        expect(line.baseAmount).toBe(110);  // Base amount in USD
      });
    });

    it('should throw error if exchange rate not found', async () => {
      const input: ReceiptVoucherInput = {
        date: '2025-01-15',
        amount: 100,
        cashAccountId: 'cash-001',
        revenueAccountId: 'revenue-001',
        description: 'GBP receipt',
        currency: 'GBP'
      };

      await expect(
        useCase.execute(input, 'company-001', 'user-001')
      ).rejects.toThrow('Exchange rate not found');
    });
  });

  describe('Validation', () => {
    it('should reject invalid input', async () => {
      const input: ReceiptVoucherInput = {
        date: '',  // Missing date
        amount: 100,
        cashAccountId: 'cash-001',
        revenueAccountId: 'revenue-001',
        description: 'Test'
      };

      await expect(
        useCase.execute(input, 'company-001', 'user-001')
      ).rejects.toThrow('Date is required');
    });

    it('should reject zero amount', async () => {
      const input: ReceiptVoucherInput = {
        date: '2025-01-15',
        amount: 0,
        cashAccountId: 'cash-001',
        revenueAccountId: 'revenue-001',
        description: 'Test'
      };

      await expect(
        useCase.execute(input, 'company-001', 'user-001')
      ).rejects.toThrow('Amount must be greater than zero');
    });

    it('should reject same account for debit and credit', async () => {
      const input: ReceiptVoucherInput = {
        date: '2025-01-15',
        amount: 100,
        cashAccountId: 'account-001',
        revenueAccountId: 'account-001',  // Same!
        description: 'Test'
      };

      await expect(
        useCase.execute(input, 'company-001', 'user-001')
      ).rejects.toThrow('Cash account and revenue account cannot be the same');
    });
  });

  describe('Audit Trail', () => {
    it('should record creation metadata', async () => {
      const input: ReceiptVoucherInput = {
        date: '2025-01-15',
        amount: 100,
        cashAccountId: 'cash-001',
        revenueAccountId: 'revenue-001',
        description: 'Test'
      };

      const voucher = await useCase.execute(input, 'company-001', 'user-001');

      expect(voucher.createdBy).toBe('user-001');
      expect(voucher.createdAt).toBeDefined();
      expect(voucher.createdAt).toBeInstanceOf(Date);
    });

    it('should start in DRAFT status', async () => {
      const input: ReceiptVoucherInput = {
        date: '2025-01-15',
        amount: 100,
        cashAccountId: 'cash-001',
        revenueAccountId: 'revenue-001',
        description: 'Test'
      };

      const voucher = await useCase.execute(input, 'company-001', 'user-001');

      expect(voucher.status).toBe(VoucherStatus.DRAFT);
      expect(voucher.approvedBy).toBeUndefined();
      expect(voucher.approvedAt).toBeUndefined();
    });

    it('should preserve cost center if provided', async () => {
      const input: ReceiptVoucherInput = {
        date: '2025-01-15',
        amount: 100,
        cashAccountId: 'cash-001',
        revenueAccountId: 'revenue-001',
        description: 'Test',
        costCenterId: 'cc-sales'
      };

      const voucher = await useCase.execute(input, 'company-001', 'user-001');

      voucher.lines.forEach(line => {
        expect(line.costCenterId).toBe('cc-sales');
      });
    });
  });
});
