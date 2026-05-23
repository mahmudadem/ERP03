import { PostingError, ErrorCategory, ErrorViolation } from '../../shared/errors/AppError';

export type PeriodLockTier = 'SOFT' | 'HARD';

export interface PeriodLockedErrorDetails {
  tier: PeriodLockTier;
  documentDate: string;
  lockedThroughDate?: string;
}

export class PeriodLockedError extends PostingError {
  readonly tier: PeriodLockTier;
  readonly documentDate: string;
  readonly lockedThroughDate?: string;

  constructor(details: PeriodLockedErrorDetails) {
    const tierLabel = details.tier === 'HARD' ? 'closed' : 'locked';
    const dateHint = details.lockedThroughDate
      ? ` Document date ${details.documentDate} is on or before the locked-through date ${details.lockedThroughDate}.`
      : '';
    const message = `Cannot post to a ${tierLabel} accounting period.${dateHint}`;

    const violations: ErrorViolation[] = [
      {
        code: `PERIOD_LOCKED_${details.tier}`,
        message,
        fieldHints: ['date'],
        policyId: 'period-lock',
      },
    ];

    super({
      code: 'PERIOD_LOCKED',
      message,
      category: ErrorCategory.POLICY,
      details: { violations },
    });

    this.name = 'PeriodLockedError';
    this.tier = details.tier;
    this.documentDate = details.documentDate;
    this.lockedThroughDate = details.lockedThroughDate;
  }
}
