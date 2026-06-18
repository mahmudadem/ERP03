import { GetTradingAccountUseCase } from '../../../../application/reporting/use-cases/GetTradingAccountUseCase';
import { ILedgerRepository } from '../../../../repository/interfaces/accounting/ILedgerRepository';
import { IAccountRepository } from '../../../../repository/interfaces/accounting/IAccountRepository';

const createLedgerRepository = () =>
  ({
    getTrialBalance: jest.fn(),
  } as unknown as jest.Mocked<ILedgerRepository>);

const createAccountRepository = () =>
  ({
    list: jest.fn(),
  } as unknown as jest.Mocked<IAccountRepository>);

describe('GetTradingAccountUseCase', () => {
  const permissionChecker = { assertOrThrow: jest.fn().mockResolvedValue(undefined) } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('computes periodic trading cost of sales from opening inventory, net purchases, and closing inventory', async () => {
    const ledgerRepository = createLedgerRepository();
    const accountRepository = createAccountRepository();
    const inventorySettingsRepo = {
      getSettings: jest.fn().mockResolvedValue({ accountingMode: 'PERIODIC' }),
    } as any;
    const inventoryValuationService = {
      value: jest
        .fn()
        .mockResolvedValueOnce({ totalValueBase: 200 })
        .mockResolvedValueOnce({ totalValueBase: 300 }),
    } as any;

    accountRepository.list.mockResolvedValue([
      { id: 'sales', userCode: '400', name: 'Sales', classification: 'REVENUE', plSubgroup: 'SALES' },
      { id: 'sales-return', userCode: '401', name: 'Sales Returns', classification: 'REVENUE', plSubgroup: 'SALES' },
      { id: 'purchases', userCode: '50101', name: 'Purchases', classification: 'EXPENSE', plSubgroup: 'COST_OF_SALES' },
      { id: 'purchase-returns', userCode: '50103', name: 'Purchase Returns', classification: 'EXPENSE', plSubgroup: 'COST_OF_SALES' },
    ] as any);

    ledgerRepository.getTrialBalance
      .mockResolvedValueOnce([
        { accountId: 'sales', debit: 0, credit: 100 },
        { accountId: 'sales-return', debit: 0, credit: 0 },
        { accountId: 'purchases', debit: 50, credit: 0 },
        { accountId: 'purchase-returns', debit: 0, credit: 10 },
      ] as any)
      .mockResolvedValueOnce([
        { accountId: 'sales', debit: 0, credit: 1100 },
        { accountId: 'sales-return', debit: 80, credit: 0 },
        { accountId: 'purchases', debit: 500, credit: 0 },
        { accountId: 'purchase-returns', debit: 0, credit: 40 },
      ] as any);

    const useCase = new GetTradingAccountUseCase(
      ledgerRepository,
      accountRepository,
      permissionChecker,
      inventorySettingsRepo,
      inventoryValuationService
    );

    const result = await useCase.execute({
      companyId: 'c1',
      userId: 'u1',
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    });

    expect(result.netSales).toBe(920);
    expect(result.costOfSales).toBe(320);
    expect(result.grossProfit).toBe(600);
    expect(result.periodicComputation).toEqual({
      pricingPolicy: 'AVERAGE',
      openingInventory: 200,
      netPurchases: 420,
      closingInventory: 300,
      purchaseBreakdown: [
        { accountId: 'purchases', accountName: '50101 - Purchases', amount: 450 },
        { accountId: 'purchase-returns', accountName: '50103 - Purchase Returns', amount: -30 },
      ],
    });
  });
});
