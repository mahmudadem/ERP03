import { PeriodLockService } from '../PeriodLockService';
import { PeriodLockedError } from '../../../../domain/accounting/errors/PeriodLockedError';
import { IAccountingPolicyConfigProvider } from '../../../../infrastructure/accounting/config/IAccountingPolicyConfigProvider';
import { IFiscalYearRepository } from '../../../../repository/interfaces/accounting/IFiscalYearRepository';
import { FiscalYear, PeriodStatus, PeriodScheme, FiscalYearStatus } from '../../../../domain/accounting/entities/FiscalYear';
import { AccountingPolicyConfig } from '../../../../domain/accounting/policies/PostingPolicyTypes';

function makeFiscalYear(periods: Array<{ startDate: string; endDate: string; status: PeriodStatus; periodNo: number; isSpecial: boolean }>): FiscalYear {
  return new FiscalYear(
    'FY2026',
    'comp-1',
    'FY 2026',
    '2026-01-01',
    '2026-12-31',
    FiscalYearStatus.OPEN,
    periods.map((p) => ({
      id: `P${p.periodNo}`,
      name: `Period ${p.periodNo}`,
      startDate: p.startDate,
      endDate: p.endDate,
      status: p.status,
      periodNo: p.periodNo,
      isSpecial: p.isSpecial,
    })),
    undefined,
    new Date(),
    'user-1',
    PeriodScheme.MONTHLY,
    0
  );
}

function makeConfig(overrides: Partial<AccountingPolicyConfig> = {}): AccountingPolicyConfig {
  return {
    periodLockEnabled: false,
    lockedThroughDate: undefined,
    financialApprovalEnabled: false,
    faApplyMode: 'ALL',
    custodyConfirmationEnabled: false,
    approvalRequired: false,
    autoPostEnabled: true,
    accountAccessEnabled: false,
    costCenterPolicy: { enabled: false, requiredFor: {} },
    policyErrorMode: 'FAIL_FAST',
    paymentMethods: [],
    ...overrides,
  };
}

describe('PeriodLockService', () => {
  let configProvider: jest.Mocked<IAccountingPolicyConfigProvider>;
  let fiscalYearRepo: jest.Mocked<IFiscalYearRepository>;
  let service: PeriodLockService;

  beforeEach(() => {
    configProvider = { getConfig: jest.fn() } as any;
    fiscalYearRepo = { findActiveForDate: jest.fn() } as any;
    service = new PeriodLockService(configProvider, fiscalYearRepo);
  });

  it('allows posting when period lock is disabled', async () => {
    configProvider.getConfig.mockResolvedValue(makeConfig({ periodLockEnabled: false }));
    await expect(service.assertPostingAllowed('comp-1', '2026-05-15')).resolves.toBeUndefined();
    expect(fiscalYearRepo.findActiveForDate).not.toHaveBeenCalled();
  });

  it('throws SOFT PeriodLockedError when date is within lockedThroughDate and no override', async () => {
    configProvider.getConfig.mockResolvedValue(makeConfig({ periodLockEnabled: true, lockedThroughDate: '2026-05-31' }));
    fiscalYearRepo.findActiveForDate.mockResolvedValue(null);
    await expect(service.assertPostingAllowed('comp-1', '2026-05-15')).rejects.toThrow(PeriodLockedError);
    const err = await service.assertPostingAllowed('comp-1', '2026-05-15').catch((e) => e);
    expect(err.tier).toBe('SOFT');
    expect(err.documentDate).toBe('2026-05-15');
    expect(err.lockedThroughDate).toBe('2026-05-31');
  });

  it('allows posting when SOFT lock is overridden with a reason', async () => {
    configProvider.getConfig.mockResolvedValue(makeConfig({ periodLockEnabled: true, lockedThroughDate: '2026-05-31' }));
    fiscalYearRepo.findActiveForDate.mockResolvedValue(null);
    await expect(
      service.assertPostingAllowed('comp-1', '2026-05-15', { reason: 'Urgent correction', overriddenBy: 'user-1' })
    ).resolves.toBeUndefined();
  });

  it('rejects SOFT lock override when overrides are disabled by policy config', async () => {
    configProvider.getConfig.mockResolvedValue(makeConfig({
      periodLockEnabled: true,
      lockedThroughDate: '2026-05-31',
      allowPeriodLockOverride: false,
    }));
    fiscalYearRepo.findActiveForDate.mockResolvedValue(null);

    await expect(
      service.assertPostingAllowed('comp-1', '2026-05-15', { reason: 'Urgent correction', overriddenBy: 'user-1' })
    ).rejects.toThrow(PeriodLockedError);
  });

  it('throws HARD PeriodLockedError when fiscal period is CLOSED, even with override', async () => {
    configProvider.getConfig.mockResolvedValue(makeConfig({ periodLockEnabled: true, lockedThroughDate: undefined }));
    fiscalYearRepo.findActiveForDate.mockResolvedValue(
      makeFiscalYear([{ startDate: '2026-05-01', endDate: '2026-05-31', status: PeriodStatus.CLOSED, periodNo: 5, isSpecial: false }])
    );
    await expect(
      service.assertPostingAllowed('comp-1', '2026-05-15', { reason: 'Override attempt', overriddenBy: 'user-1' })
    ).rejects.toThrow(PeriodLockedError);
    const err = await service.assertPostingAllowed('comp-1', '2026-05-15', { reason: 'Override', overriddenBy: 'user-1' }).catch((e) => e);
    expect(err.tier).toBe('HARD');
  });

  it('allows posting when date is after lockedThroughDate', async () => {
    configProvider.getConfig.mockResolvedValue(makeConfig({ periodLockEnabled: true, lockedThroughDate: '2026-05-31' }));
    fiscalYearRepo.findActiveForDate.mockResolvedValue(
      makeFiscalYear([{ startDate: '2026-06-01', endDate: '2026-06-30', status: PeriodStatus.OPEN, periodNo: 6, isSpecial: false }])
    );
    await expect(service.assertPostingAllowed('comp-1', '2026-06-15')).resolves.toBeUndefined();
  });
});
