import { describe, it, expect } from '@jest/globals';
import { AccountAccessPolicy } from '../../../../domain/accounting/policies/implementations/AccountAccessPolicy';
import { PostingPolicyContext, PolicyResult } from '../../../../domain/accounting/policies/PostingPolicyTypes';
import { VoucherStatus, VoucherType } from '../../../../domain/accounting/types/VoucherTypes';
import { UserAccessScope } from '../../../../domain/accounting/policies/UserAccessTypes';
import { IUserAccessScopeProvider } from '../../../../infrastructure/accounting/access/IUserAccessScopeProvider';
import { IAccountLookupService, AccountWithAccess } from '../../../../domain/accounting/services/IAccountLookupService';
import { VoucherLineEntity } from '../../../../domain/accounting/entities/VoucherLineEntity';

describe('AccountAccessPolicy', () => {
  // Mock providers
  const createMockUserScopeProvider = (scope: UserAccessScope): IUserAccessScopeProvider => ({
    getScope: async () => scope
  });

  const createMockAccountLookup = (accounts: Map<string, AccountWithAccess>): IAccountLookupService => ({
    getAccountsByIds: async () => accounts
  });

  const createContext = (userId: string, lines: VoucherLineEntity[]): PostingPolicyContext => ({
    companyId: 'company-001',
    voucherId: 'v-001',
    userId,
    voucherType: VoucherType.JOURNAL_ENTRY,
    voucherDate: '2025-01-15',
    voucherNo: 'JE-001',
    baseCurrency: 'USD',
    totalDebit: 100,
    totalCredit: 100,
    status: VoucherStatus.DRAFT,
    isApproved: false,
    lines,
    metadata: {}
  });

  it('should allow access for super user', async () => {
    const userScope = { allowedUnitIds: [], isSuper: true };
    const accountLookup = createMockAccountLookup(new Map<string, AccountWithAccess>([
      ['acc-1', { id: 'acc-1', code: 'C001', name: 'Restricted Cash', ownerUnitIds: ['branch-a'], ownerScope: 'restricted', type: 'Asset' }]
    ]));
    
    const policy = new AccountAccessPolicy(
      createMockUserScopeProvider(userScope),
      accountLookup
    );

    const lines = [new VoucherLineEntity(1, 'acc-1', 'Debit', 100, 'USD', 100, 'USD', 1.0)];
    const context = createContext('user-1', lines);
    const result = await policy.validate(context);

    expect(result.ok).toBe(true);
  });

  it('should allow access to shared account', async () => {
    const userScope = { allowedUnitIds: ['branch-b'] };
    const accountLookup = createMockAccountLookup(new Map<string, AccountWithAccess>([
      ['acc-1', { id: 'acc-1', code: 'C001', name: 'Petty Cash', ownerScope: 'shared', type: 'Asset' }]
    ]));
    
    const policy = new AccountAccessPolicy(
      createMockUserScopeProvider(userScope),
      accountLookup
    );

    const lines = [new VoucherLineEntity(1, 'acc-1', 'Debit', 100, 'USD', 100, 'USD', 1.0)];
    const context = createContext('user-1', lines);
    const result = await policy.validate(context);

    expect(result.ok).toBe(true);
  });

  it('should allow access when user has matching unit', async () => {
    const userScope = { allowedUnitIds: ['branch-a', 'dept-1'] };
    const accountLookup = createMockAccountLookup(new Map<string, AccountWithAccess>([
      ['acc-1', { id: 'acc-1', code: 'C001', name: 'Branch A Cash', ownerUnitIds: ['branch-a'], ownerScope: 'restricted', type: 'Asset' }]
    ]));
    
    const policy = new AccountAccessPolicy(
      createMockUserScopeProvider(userScope),
      accountLookup
    );

    const lines = [new VoucherLineEntity(1, 'acc-1', 'Debit', 100, 'USD', 100, 'USD', 1.0)];
    const context = createContext('user-1', lines);
    const result = await policy.validate(context);

    expect(result.ok).toBe(true);
  });

  it('should deny access when user lacks matching unit', async () => {
    const userScope = { allowedUnitIds: ['branch-b'] };
    const accountLookup = createMockAccountLookup(new Map<string, AccountWithAccess>([
      ['acc-1', { id: 'acc-1', code: 'C001', name: 'Branch A Cash', ownerUnitIds: ['branch-a'], ownerScope: 'restricted', type: 'Asset' }]
    ]));
    
    const policy = new AccountAccessPolicy(
      createMockUserScopeProvider(userScope),
      accountLookup
    );

    const lines = [new VoucherLineEntity(1, 'acc-1', 'Debit', 100, 'USD', 100, 'USD', 1.0)];
    const context = createContext('user-1', lines);
    const result: PolicyResult = await policy.validate(context);

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.code).toBe('ACCOUNT_ACCESS_DENIED');
      expect(result.error.message).toContain('Branch A Cash');
      expect(result.error.fieldHints).toContain('lines[0].accountId');
    }
  });

  it('should allow access to account without metadata (default shared)', async () => {
    const userScope = { allowedUnitIds: ['branch-a'] };
    const accountLookup = createMockAccountLookup(new Map<string, AccountWithAccess>([
      ['acc-1', { id: 'acc-1', code: 'C001', name: 'General Cash', ownerScope: 'shared', type: 'Asset' }]
    ]));
    
    const policy = new AccountAccessPolicy(
      createMockUserScopeProvider(userScope),
      accountLookup
    );

    const lines = [new VoucherLineEntity(1, 'acc-1', 'Debit', 100, 'USD', 100, 'USD', 1.0)];
    const context = createContext('user-1', lines);
    const result = await policy.validate(context);

    expect(result.ok).toBe(true);
  });

  it('should detect violation on second line', async () => {
    const userScope = { allowedUnitIds: ['branch-a'] };
    const accountLookup = createMockAccountLookup(new Map<string, AccountWithAccess>([
      ['acc-1', { id: 'acc-1', code: 'C001', name: 'Branch A Cash', ownerUnitIds: ['branch-a'], ownerScope: 'restricted', type: 'Asset' }],
      ['acc-2', { id: 'acc-2', code: 'C002', name: 'Branch B Cash', ownerUnitIds: ['branch-b'], ownerScope: 'restricted', type: 'Asset' }]
    ]));
    
    const policy = new AccountAccessPolicy(
      createMockUserScopeProvider(userScope),
      accountLookup
    );

    const lines = [
      new VoucherLineEntity(1, 'acc-1', 'Debit', 100, 'USD', 100, 'USD', 1.0),
      new VoucherLineEntity(2, 'acc-2', 'Credit', 100, 'USD', 100, 'USD', 1.0)
    ];
    const context = createContext('user-1', lines);
    const result: PolicyResult = await policy.validate(context);

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.fieldHints).toContain('lines[1].accountId');
    }
  });
});
