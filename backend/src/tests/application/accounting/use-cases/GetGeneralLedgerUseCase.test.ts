import { GetGeneralLedgerUseCase } from '../../../../application/accounting/use-cases/ReportingUseCases';

describe('GetGeneralLedgerUseCase', () => {
  it('passes voucherId through to the ledger repository for voucher impact views', async () => {
    const ledgerRepo = {
      getGeneralLedger: jest.fn(async (_companyId: string, filters: any) => {
        if (filters.voucherId === 'v-1') {
          return [
            {
              id: 'le-1',
              date: '2026-06-16',
              voucherId: 'v-1',
              accountId: 'acc-cash',
              debit: 100,
              credit: 0,
              currency: 'SYP',
              amount: 100,
              baseCurrency: 'SYP',
              baseAmount: 100,
              exchangeRate: 1,
            },
          ];
        }
        return [];
      }),
    };
    const accountRepo = {
      list: jest.fn(async () => [
        {
          id: 'acc-cash',
          code: '10101',
          name: 'Cash',
        },
      ]),
    };
    const voucherRepo = {
      findById: jest.fn(async () => ({
        id: 'v-1',
        voucherNo: 'JOU-0001',
        description: 'Owner capital',
      })),
    };
    const userRepo = { getUserById: jest.fn() };
    const permissionChecker = { assertOrThrow: jest.fn(async () => undefined) };

    const useCase = new GetGeneralLedgerUseCase(
      ledgerRepo as any,
      accountRepo as any,
      voucherRepo as any,
      userRepo as any,
      permissionChecker as any
    );

    const result = await useCase.execute('company-1', 'user-1', {
      voucherId: 'v-1',
      limit: 50,
      offset: 0,
    });

    expect(permissionChecker.assertOrThrow).toHaveBeenCalledWith(
      'user-1',
      'company-1',
      'accounting.reports.generalLedger.view'
    );
    expect(ledgerRepo.getGeneralLedger).toHaveBeenCalledWith(
      'company-1',
      expect.objectContaining({ voucherId: 'v-1' })
    );
    expect(result.metadata.totalItems).toBe(1);
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: 'le-1',
        voucherId: 'v-1',
        voucherNo: 'JOU-0001',
        accountCode: '10101',
        accountName: 'Cash',
        debit: 100,
        credit: 0,
      })
    );
  });
});
