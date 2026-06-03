import { IAccountingPolicyConfigProvider } from '../../../infrastructure/accounting/config/IAccountingPolicyConfigProvider';
import { IFiscalYearRepository } from '../../../repository/interfaces/accounting/IFiscalYearRepository';
import { PeriodLockedError } from '../../../domain/accounting/errors/PeriodLockedError';
import { PeriodLockPolicy } from '../../../domain/accounting/policies/implementations/PeriodLockPolicy';
import { PostingPolicyContext } from '../../../domain/accounting/policies/PostingPolicyTypes';
import { VoucherStatus, VoucherType } from '../../../domain/accounting/types/VoucherTypes';

export class PeriodLockService {
  constructor(
    private readonly configProvider: IAccountingPolicyConfigProvider,
    private readonly fiscalYearRepo: IFiscalYearRepository
  ) {}

  async assertPostingAllowed(
    companyId: string,
    documentDate: string,
    override?: { reason: string; overriddenBy: string }
  ): Promise<void> {
    const config = await this.configProvider.getConfig(companyId);
    if (!config.periodLockEnabled) {
      return;
    }

    const fiscalResolver = async (cId: string, date: string, postingPeriodNo?: number) => {
      const fy = await this.fiscalYearRepo.findActiveForDate(cId, date);
      const period = fy?.getPeriodForDate(date, postingPeriodNo);
      return period?.status ?? null;
    };

    const policy = new PeriodLockPolicy(
      config.lockedThroughDate,
      fiscalResolver,
      config.allowPeriodLockOverride !== false
    );

    const context: PostingPolicyContext = {
      companyId,
      voucherId: '',
      userId: override?.overriddenBy || 'system',
      voucherType: VoucherType.JOURNAL_ENTRY,
      voucherDate: documentDate,
      voucherNo: '',
      baseCurrency: 'USD',
      totalDebit: 0,
      totalCredit: 0,
      status: VoucherStatus.APPROVED,
      isApproved: true,
      lines: [],
      metadata: override ? { periodLockOverride: override } : undefined,
    };

    const result = await policy.validate(context);
    if (!result.ok) {
      const error = (result as { ok: false; error: any }).error;
      if (error.code === 'PERIOD_CLOSED') {
        throw new PeriodLockedError({ tier: 'HARD', documentDate });
      } else {
        throw new PeriodLockedError({
          tier: 'SOFT',
          documentDate,
          lockedThroughDate: config.lockedThroughDate,
        });
      }
    }
  }
}

