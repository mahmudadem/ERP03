import { CloseYearUseCase } from '../../../../application/accounting/use-cases/FiscalYearUseCases';
import { FiscalYear, FiscalYearStatus, PeriodStatus } from '../../../../domain/accounting/entities/FiscalYear';

const makeRepo = <T>(data: any) => ({
  findById: jest.fn().mockResolvedValue(data),
  findActiveForDate: jest.fn(),
  findByCompany: jest.fn(),
  save: jest.fn(),
  update: jest.fn()
});

describe('CloseYearUseCase', () => {
  it('creates a draft closing voucher and links it to the fiscal year', async () => {
    const fy = new FiscalYear(
      'FY2026',
      'c1',
      'Fiscal Year 2026',
      '2026-01-01',
      '2026-12-31',
      FiscalYearStatus.OPEN,
      [{ id: '2026-01', name: 'Jan', startDate: '2026-01-01', endDate: '2026-12-31', status: PeriodStatus.OPEN, periodNo: 1, isSpecial: false }]
    );
    const fiscalYearRepo = makeRepo(fy);
    const ledgerRepo = {
      getTrialBalance: jest.fn().mockResolvedValue([
        { accountId: 'rev', debit: 0, credit: 1000 },
        { accountId: 'exp', debit: 400, credit: 0 }
      ]),
      recordForVoucher: jest.fn()
    } as any;
    const accountRepo = {
      list: jest.fn().mockResolvedValue([
        { id: 'rev', classification: 'REVENUE' },
        { id: 'exp', classification: 'EXPENSE' },
        { id: 're', classification: 'EQUITY' }
      ])
    } as any;
    const companyRepo = { findById: jest.fn().mockResolvedValue({ baseCurrency: 'USD' }) } as any;
    const voucherRepo = { save: jest.fn() } as any;
    const txManager = { runTransaction: async (fn: any) => fn({}) } as any;
    const permissionChecker = { assertOrThrow: jest.fn() } as any;

    const useCase = new CloseYearUseCase(
      fiscalYearRepo as any,
      ledgerRepo,
      accountRepo,
      companyRepo,
      voucherRepo as any,
      txManager as any,
      permissionChecker as any
    );

    const result = await useCase.execute('c1', 'u1', 'FY2026', { retainedEarningsAccountId: 're' });
    expect(result.voucherId).toBeDefined();
    expect(voucherRepo.save).toHaveBeenCalled();
    expect(ledgerRepo.recordForVoucher).not.toHaveBeenCalled();
    expect(fiscalYearRepo.update).toHaveBeenCalled();
    const updatedFy = fiscalYearRepo.update.mock.calls[0][0];
    expect(updatedFy.closingVoucherId).toBe(result.voucherId);
    expect(updatedFy.status).toBe(FiscalYearStatus.OPEN);
  });
});
