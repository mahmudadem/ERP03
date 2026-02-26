import { AgingReportUseCase } from '../../../../application/accounting/use-cases/AgingReportUseCase';
import { ILedgerRepository } from '../../../../repository/interfaces/accounting/ILedgerRepository';
import { IAccountRepository } from '../../../../repository/interfaces/accounting/IAccountRepository';

const accounts: any[] = [
  { id: 'acc1', accountRole: 'RECEIVABLE', userCode: '1101', name: 'AR - Cust A', classification: 'ASSET', status: 'ACTIVE' },
  { id: 'cash1', accountRole: 'POSTING', userCode: '1010', name: 'Cash - Main', classification: 'ASSET', status: 'ACTIVE' },
  { id: 'hdr1', accountRole: 'HEADER', userCode: '104', name: 'Accounts Receivable', classification: 'ASSET', status: 'ACTIVE' },
  { id: 'arChild1', accountRole: 'POSTING', userCode: '10401', name: 'Customers Receivable', classification: 'ASSET', parentId: 'hdr1', status: 'ACTIVE' },
];

describe('AgingReportUseCase', () => {
  const ledgerRepo: jest.Mocked<ILedgerRepository> = {
    recordForVoucher: jest.fn(),
    deleteForVoucher: jest.fn(),
    getAccountLedger: jest.fn(),
    getTrialBalance: jest.fn(),
    getGeneralLedger: jest.fn(),
    getAccountStatement: jest.fn(),
    getUnreconciledEntries: jest.fn(),
    markReconciled: jest.fn(),
    getForeignBalances: jest.fn()
  };
  const accountRepo: jest.Mocked<IAccountRepository> = {
    list: jest.fn(),
    getById: jest.fn(),
    getByUserCode: jest.fn(),
    getByCode: jest.fn(),
    getAccounts: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deactivate: jest.fn(),
    isUsed: jest.fn(),
    hasChildren: jest.fn(),
    countChildren: jest.fn(),
    existsByUserCode: jest.fn(),
    generateNextSystemCode: jest.fn(),
    countByCurrency: jest.fn(),
    recordAuditEvent: jest.fn()
  };
  const permissionChecker: any = { assertOrThrow: jest.fn() };

  it('buckets AR entries by age', async () => {
    accountRepo.list.mockResolvedValue(accounts as any);
    ledgerRepo.getGeneralLedger.mockImplementation(async (_companyId: string, options: any) => {
      if (options?.accountId === 'acc1') {
        return [
          { id: 'e1', accountId: 'acc1', date: '2026-02-05', side: 'Debit', amount: 100 },
          { id: 'e2', accountId: 'acc1', date: '2025-12-20', side: 'Debit', amount: 200 }
        ] as any;
      }
      if (options?.accountId === 'cash1') {
        return [{ id: 'cash-e1', accountId: 'cash1', date: '2026-02-01', side: 'Debit', amount: 999 }] as any;
      }
      if (options?.accountId === 'arChild1') {
        return [{ id: 'archild-e1', accountId: 'arChild1', date: '2026-01-15', side: 'Debit', amount: 300 }] as any;
      }
      return [] as any;
    });

    const uc = new AgingReportUseCase(ledgerRepo, accountRepo, permissionChecker);
    const report = await uc.execute('c1', 'u1', 'AR', '2026-02-10');

    // Only AR-tagged accounts should appear (cash/header excluded)
    expect(report.accounts.map((a) => a.accountId).sort()).toEqual(['acc1', 'arChild1']);

    const row = report.accounts.find((r) => r.accountId === 'acc1')!;
    // e1 is 5 days old => bucket 1-30
    expect(row.bucketAmounts[1]).toBe(100);
    // e2 is >50 days => bucket 31-60 or beyond (approx 52)
    expect(row.bucketAmounts[2]).toBe(200);
  });

  it('supports manual account scope by header account (includes descendants)', async () => {
    accountRepo.list.mockResolvedValue(accounts as any);
    ledgerRepo.getGeneralLedger.mockImplementation(async (_companyId: string, options: any) => {
      if (options?.accountId === 'arChild1') {
        return [{ id: 'archild-e1', accountId: 'arChild1', date: '2026-01-20', side: 'Debit', amount: 150 }] as any;
      }
      return [] as any;
    });

    const uc = new AgingReportUseCase(ledgerRepo, accountRepo, permissionChecker);
    const report = await uc.execute('c1', 'u1', 'AR', '2026-02-10', 'hdr1');

    expect(report.accounts.map((a) => a.accountId)).toEqual(['arChild1']);
    expect(report.grandTotal).toBe(150);
  });
});
