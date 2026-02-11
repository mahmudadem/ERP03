import { GetBalanceSheetUseCase } from '../../../../application/accounting/use-cases/LedgerUseCases';
import { ILedgerRepository } from '../../../../repository/interfaces/accounting/ILedgerRepository';
import { IAccountRepository } from '../../../../repository/interfaces/accounting/IAccountRepository';
import { ICompanyRepository } from '../../../../repository/interfaces/core/ICompanyRepository';

const createMockLedgerRepo = (): jest.Mocked<ILedgerRepository> => ({
  recordForVoucher: jest.fn(),
  deleteForVoucher: jest.fn(),
  getAccountLedger: jest.fn(),
  getTrialBalance: jest.fn(),
  getGeneralLedger: jest.fn(),
  getAccountStatement: jest.fn(),
  getUnreconciledEntries: jest.fn(),
  markReconciled: jest.fn()
});

const createMockAccountRepo = (): jest.Mocked<IAccountRepository> => ({
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
});

const createMockCompanyRepo = (): jest.Mocked<ICompanyRepository> => ({
  save: jest.fn(),
  findById: jest.fn(),
  findByTaxId: jest.fn(),
  findByNameAndOwner: jest.fn(),
  getUserCompanies: jest.fn(),
  enableModule: jest.fn(),
  update: jest.fn(),
  disableModule: jest.fn(),
  updateBundle: jest.fn(),
  updateFeatures: jest.fn(),
  listAll: jest.fn(),
  delete: jest.fn()
});

describe('GetBalanceSheetUseCase', () => {
  const permissionChecker = { assertOrThrow: jest.fn().mockResolvedValue(undefined) } as any;
  let ledgerRepo: jest.Mocked<ILedgerRepository>;
  let accountRepo: jest.Mocked<IAccountRepository>;
  let companyRepo: jest.Mocked<ICompanyRepository>;
  let useCase: GetBalanceSheetUseCase;

  beforeEach(() => {
    ledgerRepo = createMockLedgerRepo();
    accountRepo = createMockAccountRepo();
    companyRepo = createMockCompanyRepo();
    useCase = new GetBalanceSheetUseCase(ledgerRepo, accountRepo, permissionChecker, companyRepo);
  });

  it('computes balance sheet sections and retained earnings across all classifications', async () => {
    const accounts: any[] = [
      { id: 'a1', userCode: '1000', name: 'Assets', classification: 'ASSET', balanceNature: 'DEBIT', accountRole: 'HEADER', parentId: null },
      { id: 'a2', userCode: '1010', name: 'Cash', classification: 'ASSET', balanceNature: 'DEBIT', accountRole: 'POSTING', parentId: 'a1' },
      { id: 'l1', userCode: '2000', name: 'Accounts Payable', classification: 'LIABILITY', balanceNature: 'CREDIT', accountRole: 'POSTING', parentId: null },
      { id: 'e1', userCode: '3000', name: 'Owner Capital', classification: 'EQUITY', balanceNature: 'CREDIT', accountRole: 'POSTING', parentId: null },
      { id: 'r1', userCode: '4000', name: 'Sales Revenue', classification: 'REVENUE', balanceNature: 'CREDIT', accountRole: 'POSTING', parentId: null },
      { id: 'x1', userCode: '5000', name: 'Office Supplies', classification: 'EXPENSE', balanceNature: 'DEBIT', accountRole: 'POSTING', parentId: null }
    ];

    const trialBalance = [
      { accountId: 'a2', accountCode: '1010', accountName: 'Cash', debit: 2200, credit: 0, balance: 2200 },
      { accountId: 'l1', accountCode: '2000', accountName: 'Accounts Payable', debit: 0, credit: 700, balance: -700 },
      { accountId: 'e1', accountCode: '3000', accountName: 'Owner Capital', debit: 0, credit: 500, balance: -500 },
      { accountId: 'r1', accountCode: '4000', accountName: 'Sales Revenue', debit: 0, credit: 1200, balance: -1200 },
      { accountId: 'x1', accountCode: '5000', accountName: 'Office Supplies', debit: 200, credit: 0, balance: 200 }
    ];

    accountRepo.list.mockResolvedValue(accounts as any);
    ledgerRepo.getTrialBalance.mockResolvedValue(trialBalance as any);
    companyRepo.findById.mockResolvedValue({ baseCurrency: 'USD' } as any);

    const result = await useCase.execute('company-1', 'user-1', '2026-12-31');

    expect(permissionChecker.assertOrThrow).toHaveBeenCalledWith(
      'user-1',
      'company-1',
      'accounting.reports.balanceSheet.view'
    );

    const renderedIds = [
      ...result.assets.accounts,
      ...result.liabilities.accounts,
      ...result.equity.accounts
    ].map((a) => a.accountId);

    expect(renderedIds).not.toContain('r1');
    expect(renderedIds).not.toContain('x1');

    expect(result.retainedEarnings).toBeCloseTo(1000);
    expect(result.assets.total).toBeCloseTo(2200);
    expect(result.liabilities.total).toBeCloseTo(700);
    expect(result.equity.total).toBeCloseTo(1500);
    expect(result.totalAssets).toBeCloseTo(result.totalLiabilitiesAndEquity);
    expect(result.isBalanced).toBe(true);

    const retainedLine = result.equity.accounts.find((a) => a.accountId === 'retained-earnings');
    expect(retainedLine?.balance).toBeCloseTo(1000);
    expect(result.baseCurrency).toBe('USD');
  });
});
