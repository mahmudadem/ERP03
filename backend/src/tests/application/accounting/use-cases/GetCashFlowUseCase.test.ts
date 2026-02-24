import { GetCashFlowStatementUseCase } from '../../../../application/accounting/use-cases/CashFlowUseCases';
import { ILedgerRepository } from '../../../../repository/interfaces/accounting/ILedgerRepository';
import { IAccountRepository } from '../../../../repository/interfaces/accounting/IAccountRepository';
import { ICompanyRepository } from '../../../../repository/interfaces/core/ICompanyRepository';

const createLedgerRepo = (): jest.Mocked<ILedgerRepository> => ({
  recordForVoucher: jest.fn(),
  deleteForVoucher: jest.fn(),
  getAccountLedger: jest.fn(),
  getTrialBalance: jest.fn(),
  getGeneralLedger: jest.fn(),
  getAccountStatement: jest.fn(),
  getUnreconciledEntries: jest.fn(),
  markReconciled: jest.fn(),
  getForeignBalances: jest.fn(),
});

const createAccountRepo = (): jest.Mocked<IAccountRepository> => ({
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
  recordAuditEvent: jest.fn(),
});

const createCompanyRepo = (): jest.Mocked<ICompanyRepository> =>
  ({
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
    delete: jest.fn(),
  } as any);

describe('GetCashFlowStatementUseCase', () => {
  const permissionChecker = { assertOrThrow: jest.fn().mockResolvedValue(undefined) } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds operating/investing/financing sections and reconciles net cash change', async () => {
    const ledgerRepo = createLedgerRepo();
    const accountRepo = createAccountRepo();
    const companyRepo = createCompanyRepo();

    const accounts = [
      { id: 'cash', userCode: '1010', name: 'Cash on Hand', classification: 'ASSET', accountRole: 'POSTING' },
      { id: 'ar', userCode: '1100', name: 'Accounts Receivable', classification: 'ASSET', accountRole: 'POSTING' },
      { id: 'ppe', userCode: '1500', name: 'Property and Equipment', classification: 'ASSET', accountRole: 'POSTING' },
      { id: 'ap', userCode: '2100', name: 'Accounts Payable', classification: 'LIABILITY', accountRole: 'POSTING' },
      { id: 'loan', userCode: '2200', name: 'Bank Loan', classification: 'LIABILITY', accountRole: 'POSTING' },
      { id: 'sales', userCode: '4000', name: 'Sales Revenue', classification: 'REVENUE', accountRole: 'POSTING' },
      { id: 'dep', userCode: '5200', name: 'Depreciation Expense', classification: 'EXPENSE', accountRole: 'POSTING' },
      { id: 'rent', userCode: '5300', name: 'Rent Expense', classification: 'EXPENSE', accountRole: 'POSTING' },
    ];

    accountRepo.list.mockResolvedValue(accounts as any);
    companyRepo.findById.mockResolvedValue({ id: 'c1', baseCurrency: 'USD' } as any);

    const openingTB = [
      { accountId: 'cash', debit: 1000, credit: 0 },
      { accountId: 'ar', debit: 200, credit: 0 },
      { accountId: 'ppe', debit: 500, credit: 0 },
      { accountId: 'ap', debit: 0, credit: 150 },
      { accountId: 'loan', debit: 0, credit: 300 },
      { accountId: 'sales', debit: 0, credit: 0 },
      { accountId: 'dep', debit: 0, credit: 0 },
      { accountId: 'rent', debit: 0, credit: 0 },
    ];

    const closingTB = [
      { accountId: 'cash', debit: 1230, credit: 0 },
      { accountId: 'ar', debit: 320, credit: 0 },
      { accountId: 'ppe', debit: 650, credit: 0 },
      { accountId: 'ap', debit: 0, credit: 220 },
      { accountId: 'loan', debit: 0, credit: 380 },
      { accountId: 'sales', debit: 0, credit: 900 },
      { accountId: 'dep', debit: 40, credit: 0 },
      { accountId: 'rent', debit: 510, credit: 0 },
    ];

    ledgerRepo.getTrialBalance.mockImplementation(async (_companyId, asOfDate) => {
      if (asOfDate === '2025-12-31') return openingTB as any;
      return closingTB as any;
    });

    const useCase = new GetCashFlowStatementUseCase(
      ledgerRepo,
      accountRepo,
      companyRepo,
      permissionChecker
    );

    const result = await useCase.execute('c1', 'u1', '2026-01-01', '2026-01-31');

    expect(permissionChecker.assertOrThrow).toHaveBeenCalledWith('u1', 'c1', 'accounting.reports.cashFlow.view');
    expect(result.netCashChange).toBe(230);
    expect(result.openingCashBalance).toBe(1000);
    expect(result.closingCashBalance).toBe(1230);

    expect(result.investing.total).toBe(-150);
    expect(result.investing.items.length).toBeGreaterThan(0);
    expect(result.financing.total).toBe(80);
    expect(result.financing.items.length).toBeGreaterThan(0);

    expect(result.operating.total + result.investing.total + result.financing.total).toBe(result.netCashChange);
    expect(result.operating.items.some((item) => item.name === 'Net Income')).toBe(true);
  });

  it('honors explicit account cashFlowCategory override', async () => {
    const ledgerRepo = createLedgerRepo();
    const accountRepo = createAccountRepo();
    const companyRepo = createCompanyRepo();

    accountRepo.list.mockResolvedValue(
      [
        { id: 'cash', userCode: '1010', name: 'Cash', classification: 'ASSET', accountRole: 'POSTING' },
        {
          id: 'misc',
          userCode: '1199',
          name: 'Misc Asset',
          classification: 'ASSET',
          accountRole: 'POSTING',
          cashFlowCategory: 'INVESTING',
        },
      ] as any
    );
    companyRepo.findById.mockResolvedValue({ id: 'c1', baseCurrency: 'USD' } as any);
    ledgerRepo.getTrialBalance.mockImplementation(async (_companyId, asOfDate) => {
      if (asOfDate === '2025-12-31') {
        return [
          { accountId: 'cash', debit: 100, credit: 0 },
          { accountId: 'misc', debit: 20, credit: 0 },
        ] as any;
      }
      return [
        { accountId: 'cash', debit: 70, credit: 0 },
        { accountId: 'misc', debit: 50, credit: 0 },
      ] as any;
    });

    const useCase = new GetCashFlowStatementUseCase(
      ledgerRepo,
      accountRepo,
      companyRepo,
      permissionChecker
    );

    const result = await useCase.execute('c1', 'u1', '2026-01-01', '2026-01-31');

    expect(result.netCashChange).toBe(-30);
    expect(result.investing.total).toBe(-30);
    expect(result.investing.items[0]?.accountId).toBe('misc');
    expect(result.financing.total).toBe(0);
  });
});
