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
  markReconciled: jest.fn(),
  getForeignBalances: jest.fn()
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

  it('overrides periodic inventory with valuation AND keeps the Balance Sheet balanced via a virtual close', async () => {
    // Realistic, genuinely-balanced periodic GL (TB balances at 2100/2100):
    //   capital injected:  Dr Cash 1000 / Cr Capital 1000
    //   opening stock:     Dr Inventory 200 / Cr Opening Balance Equity 200
    //   purchase (credit): Dr Purchases 500 / Cr AP 500      (periodic → expensed, NOT inventory)
    //   sale (cash):       Dr Cash 400 / Cr Sales 400        (periodic → no COGS line)
    // GL inventory therefore sits at the opening 200; periodic purchases never touch it.
    // Closing valuation (qty × avg) = 350 → the report must recognise the +150 uplift
    // on BOTH the asset side and equity (Current Year Earnings) or it won't balance.
    const inventorySettingsRepo = {
      getSettings: jest.fn().mockResolvedValue({
        accountingMode: 'PERIODIC',
        defaultInventoryAssetAccountId: 'inv',
      }),
    } as any;
    const itemRepo = {
      getCompanyItems: jest.fn().mockResolvedValue([
        { id: 'item-1', inventoryAssetAccountId: 'inv' },
      ]),
    } as any;
    const inventoryValuationService = {
      value: jest.fn().mockResolvedValue({ totalValueBase: 350 }),
    } as any;

    useCase = new GetBalanceSheetUseCase(
      ledgerRepo,
      accountRepo,
      permissionChecker,
      companyRepo,
      inventorySettingsRepo,
      itemRepo,
      inventoryValuationService
    );

    accountRepo.list.mockResolvedValue([
      { id: 'assets', userCode: '1000', name: 'Assets', classification: 'ASSET', balanceNature: 'DEBIT', accountRole: 'HEADER', parentId: null },
      { id: 'inv', userCode: '10301', name: 'Goods / Opening Inventory', classification: 'ASSET', balanceNature: 'DEBIT', accountRole: 'POSTING', parentId: 'assets' },
      { id: 'cash', userCode: '1010', name: 'Cash', classification: 'ASSET', balanceNature: 'DEBIT', accountRole: 'POSTING', parentId: 'assets' },
      { id: 'ap', userCode: '2010', name: 'Accounts Payable', classification: 'LIABILITY', balanceNature: 'CREDIT', accountRole: 'POSTING', parentId: null },
      { id: 'capital', userCode: '3000', name: 'Capital', classification: 'EQUITY', balanceNature: 'CREDIT', accountRole: 'POSTING', parentId: null },
      { id: 'obe', userCode: '303', name: 'Opening Balance Equity', classification: 'EQUITY', balanceNature: 'CREDIT', accountRole: 'POSTING', parentId: null },
      { id: 'purchases', userCode: '50101', name: 'Purchases', classification: 'EXPENSE', balanceNature: 'DEBIT', accountRole: 'POSTING', parentId: null },
      { id: 'sales', userCode: '400', name: 'Sales', classification: 'REVENUE', balanceNature: 'CREDIT', accountRole: 'POSTING', parentId: null },
    ] as any);

    ledgerRepo.getTrialBalance.mockResolvedValue([
      { accountId: 'cash', debit: 1400, credit: 0 },
      { accountId: 'inv', debit: 200, credit: 0 },
      { accountId: 'purchases', debit: 500, credit: 0 },
      { accountId: 'capital', debit: 0, credit: 1000 },
      { accountId: 'obe', debit: 0, credit: 200 },
      { accountId: 'ap', debit: 0, credit: 500 },
      { accountId: 'sales', debit: 0, credit: 400 },
    ] as any);
    companyRepo.findById.mockResolvedValue({ baseCurrency: 'USD' } as any);

    const result = await useCase.execute('company-1', 'user-1', '2026-12-31');

    expect(inventoryValuationService.value).toHaveBeenCalledWith('company-1', '2026-12-31', 'AVERAGE');

    // Asset side: inventory shows the report-time valuation, not the frozen GL 200.
    const inventoryLine = result.assets.accounts.find((line) => line.accountId === 'inv');
    expect(inventoryLine?.balance).toBe(350);
    expect(result.totalAssets).toBe(1750); // cash 1400 + inventory 350

    // Equity side: Current Year Earnings = raw (Sales 400 − Purchases 500) + virtual-close uplift 150 = 50.
    // This is exactly periodic net profit = Sales 400 − COGS(200 + 500 − 350 = 350) = 50.
    expect(result.retainedEarnings).toBeCloseTo(50);
    const retainedLine = result.equity.accounts.find((line) => line.accountId === 'retained-earnings');
    expect(retainedLine?.balance).toBeCloseTo(50);

    // The whole statement still ties.
    expect(result.totalLiabilitiesAndEquity).toBeCloseTo(1750);
    expect(result.isBalanced).toBe(true);
  });

  it('does not override inventory or adjust equity for non-periodic companies', async () => {
    const inventorySettingsRepo = {
      getSettings: jest.fn().mockResolvedValue({
        accountingMode: 'PERPETUAL',
        defaultInventoryAssetAccountId: 'inv',
      }),
    } as any;
    const itemRepo = { getCompanyItems: jest.fn().mockResolvedValue([]) } as any;
    const inventoryValuationService = { value: jest.fn() } as any;

    useCase = new GetBalanceSheetUseCase(
      ledgerRepo, accountRepo, permissionChecker, companyRepo,
      inventorySettingsRepo, itemRepo, inventoryValuationService,
    );

    accountRepo.list.mockResolvedValue([
      { id: 'inv', userCode: '10301', name: 'Inventory', classification: 'ASSET', balanceNature: 'DEBIT', accountRole: 'POSTING', parentId: null },
      { id: 'capital', userCode: '3000', name: 'Capital', classification: 'EQUITY', balanceNature: 'CREDIT', accountRole: 'POSTING', parentId: null },
    ] as any);
    ledgerRepo.getTrialBalance.mockResolvedValue([
      { accountId: 'inv', debit: 1000, credit: 0 },
      { accountId: 'capital', debit: 0, credit: 1000 },
    ] as any);
    companyRepo.findById.mockResolvedValue({ baseCurrency: 'USD' } as any);

    const result = await useCase.execute('company-1', 'user-1', '2026-12-31');

    // Perpetual/invoice-driven path is untouched: GL inventory stands, no valuation call.
    expect(inventoryValuationService.value).not.toHaveBeenCalled();
    const inventoryLine = result.assets.accounts.find((line) => line.accountId === 'inv');
    expect(inventoryLine?.balance).toBe(1000);
    expect(result.isBalanced).toBe(true);
  });
});
