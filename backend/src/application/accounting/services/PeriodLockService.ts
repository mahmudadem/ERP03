import { IAccountingPolicyConfigProvider } from '../../../infrastructure/accounting/config/IAccountingPolicyConfigProvider';
import { IFiscalYearRepository } from '../../../repository/interfaces/accounting/IFiscalYearRepository';
import { normalizeAccountingDate } from '../../../domain/accounting/utils/DateNormalization';
import { PeriodStatus } from '../../../domain/accounting/entities/FiscalYear';
import { PeriodLockedError } from '../../../domain/accounting/errors/PeriodLockedError';

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

    const date = normalizeAccountingDate(documentDate);

    // HARD check: fiscal period CLOSED or LOCKED
    const fy = await this.fiscalYearRepo.findActiveForDate(companyId, date);
    if (fy) {
      const period = fy.getPeriodForDate(date);
      if (period && (period.status === PeriodStatus.CLOSED || period.status === PeriodStatus.LOCKED)) {
        throw new PeriodLockedError({ tier: 'HARD', documentDate: date });
      }
    }

    // SOFT check: lockedThroughDate
    if (config.lockedThroughDate) {
      const lockedDate = normalizeAccountingDate(config.lockedThroughDate);
      if (date <= lockedDate) {
        if (override?.reason?.trim()) {
          return;
        }
        throw new PeriodLockedError({ tier: 'SOFT', documentDate: date, lockedThroughDate: config.lockedThroughDate });
      }
    }
  }
}
