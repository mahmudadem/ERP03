import { describe, it, expect } from '@jest/globals';
import { CostCenterRequiredPolicy } from '../../../../../src/domain/accounting/policies/implementations/CostCenterRequiredPolicy';
import { PostingPolicyContext } from '../../../../../src/domain/accounting/policies/PostingPolicyTypes';
import { VoucherType, VoucherStatus } from '../../../../../src/domain/accounting/types/VoucherTypes';
import { VoucherLineEntity } from '../../../../../src/domain/accounting/entities/VoucherLineEntity';

// Mock Account Lookup Service
const createMockAccountLookup = (accounts: any[]) => ({
  getAccountsByIds: async (companyId: string, accountIds: string[]) => {
    return accounts.filter(acc => accountIds.includes(acc.id));
  }
});

describe('CostCenterRequiredPolicy', () => {
  const createContext = (lines: any[]): PostingPolicyContext => ({
    companyId: 'test-company',
    voucherId: 'v-123',
    userId: 'user-1',
    voucherType: VoucherType.JOURNAL_ENTRY,
    voucherDate: '2025-01-15',
    voucherNo: 'JE-001',
    baseCurrency: 'USD',
    totalDebit: 100,
    totalCredit: 100,
    status: VoucherStatus.DRAFT,
    isApproved: false,
    lines: lines.map((l, i) => new VoucherLineEntity(
      i + 1,
      l.accountId,
      l.side || 'Debit',
      l.amount || 100,
      'USD',
      l.amount || 100,
      'USD',
      1,
      undefined,
      l.costCenterId
    )),
    metadata: {}
  });

  it('should pass when policy has no rules configured', async () => {
    const policy = new CostCenterRequiredPolicy(
      { accountIds: [], accountTypes: [] },
      createMockAccountLookup([])
    );

    const ctx = createContext([
      { accountId: 'acc-1', side: 'Debit', amount: 100 }
    ]);

    const result = await policy.validate(ctx);
    expect(result.ok).toBe(true);
  });

  it('should pass when expense account has cost center', async () => {
    const accounts = [
      { id: 'acc-expense', code: 'EXP-001', name: 'Travel Expense', type: 'expense' }
    ];

    const policy = new CostCenterRequiredPolicy(
      { accountTypes: ['expense'] },
      createMockAccountLookup(accounts)
    );

    const ctx = createContext([
      { accountId: 'acc-expense', side: 'Debit', amount: 100, costCenterId: 'cc-1' }
    ]);

    const result = await policy.validate(ctx);
    expect(result.ok).toBe(true);
  });

  it('should fail when expense account is missing cost center', async () => {
    const accounts = [
      { id: 'acc-expense', code: 'EXP-001', name: 'Travel Expense', type: 'expense' }
    ];

    const policy = new CostCenterRequiredPolicy(
      { accountTypes: ['expense'] },
      createMockAccountLookup(accounts)
    );

    const ctx = createContext([
      { accountId: 'acc-expense', side: 'Debit', amount: 100 } // No costCenterId
    ]);

    const result = await policy.validate(ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('COST_CENTER_REQUIRED');
      expect(result.error.message).toContain('Travel Expense');
      expect(result.error.fieldHints).toContain('lines[0].costCenterId');
    }
  });

  it('should fail when cost center is empty string', async () => {
    const accounts = [
      { id: 'acc-expense', code: 'EXP-001', name: 'Travel Expense', type: 'expense' }
    ];

    const policy = new CostCenterRequiredPolicy(
      { accountTypes: ['expense'] },
      createMockAccountLookup(accounts)
    );

    const ctx = createContext([
      { accountId: 'acc-expense', side: 'Debit', amount: 100, costCenterId: '   ' } // Empty/whitespace
    ]);

    const result = await policy.validate(ctx);
    expect(result.ok).toBe(false);
  });

  it('should pass when non-expense account is missing cost center', async () => {
    const accounts = [
      { id: 'acc-cash', code: 'CASH-001', name: 'Cash', type: 'asset' }
    ];

    const policy = new CostCenterRequiredPolicy(
      { accountTypes: ['expense'] },
      createMockAccountLookup(accounts)
    );

    const ctx = createContext([
      { accountId: 'acc-cash', side: 'Credit', amount: 100 } // No costCenterId but not expense
    ]);

    const result = await policy.validate(ctx);
    expect(result.ok).toBe(true);
  });

  it('should fail when specific account ID is missing cost center', async () => {
    const accounts = [
      { id: 'acc-special', code: 'SPEC-001', name: 'Special Account', type: 'expense' }
    ];

    const policy = new CostCenterRequiredPolicy(
      { accountIds: ['acc-special'] },
      createMockAccountLookup(accounts)
    );

    const ctx = createContext([
      { accountId: 'acc-special', side: 'Debit', amount: 100 } // No costCenterId
    ]);

    const result = await policy.validate(ctx);
    expect(result.ok).toBe(false);
  });

  it('should handle multiple lines and report first violation', async () => {
    const accounts = [
      { id: 'acc-expense-1', code: 'EXP-001', name: 'Travel', type: 'expense' },
      { id: 'acc-expense-2', code: 'EXP-002', name: 'Marketing', type: 'expense' },
      { id: 'acc-cash', code: 'CASH-001', name: 'Cash', type: 'asset' }
    ];

    const policy = new CostCenterRequiredPolicy(
      { accountTypes: ['expense'] },
      createMockAccountLookup(accounts)
    );

    const ctx = createContext([
      { accountId: 'acc-expense-1', side: 'Debit', amount: 50, costCenterId: 'cc-1' },
      { accountId: 'acc-expense-2', side: 'Debit', amount: 50 }, // Missing!
      { accountId: 'acc-cash', side: 'Credit', amount: 100 }
    ]);

    const result = await policy.validate(ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.fieldHints).toContain('lines[1].costCenterId');
    }
  });

  it('should match on both accountIds and accountTypes', async () => {
    const accounts = [
      { id: 'acc-specific', code: 'SPEC-001', name: 'Specific', type: 'asset' },
      { id: 'acc-expense', code: 'EXP-001', name: 'Expense', type: 'expense' }
    ];

    const policy = new CostCenterRequiredPolicy(
      { 
        accountIds: ['acc-specific'],
        accountTypes: ['expense']
      },
      createMockAccountLookup(accounts)
    );

    // Both should require cost center
    const ctx1 = createContext([
      { accountId: 'acc-specific', side: 'Debit', amount: 100 }
    ]);
    expect((await policy.validate(ctx1)).ok).toBe(false);

    const ctx2 = createContext([
      { accountId: 'acc-expense', side: 'Debit', amount: 100 }
    ]);
    expect((await policy.validate(ctx2)).ok).toBe(false);

    // With cost centers should pass
    const ctx3 = createContext([
      { accountId: 'acc-specific', side: 'Debit', amount: 50, costCenterId: 'cc-1' },
      { accountId: 'acc-expense', side: 'Debit', amount: 50, costCenterId: 'cc-2' }
    ]);
    expect((await policy.validate(ctx3)).ok).toBe(true);
  });
});
