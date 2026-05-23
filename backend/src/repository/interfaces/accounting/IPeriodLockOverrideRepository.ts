import { PeriodLockOverride } from '../../../domain/accounting/entities/PeriodLockOverride';

export interface PeriodLockOverrideListOptions {
  limit?: number;
}

export interface IPeriodLockOverrideRepository {
  create(override: PeriodLockOverride, transaction?: unknown): Promise<void>;
  listByCompany(companyId: string, opts?: PeriodLockOverrideListOptions): Promise<PeriodLockOverride[]>;
  findBySource(companyId: string, sourceId: string): Promise<PeriodLockOverride | null>;
}
