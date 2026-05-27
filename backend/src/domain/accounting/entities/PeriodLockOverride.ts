import { randomUUID } from 'crypto';

export type PeriodLockOverrideSourceType = 'SALES_INVOICE' | 'DELIVERY_NOTE' | 'SALES_RETURN';

export interface PeriodLockOverrideProps {
  id?: string;
  companyId: string;
  sourceModule: 'sales';
  sourceType: PeriodLockOverrideSourceType;
  sourceId: string;
  sourceNumber: string;
  documentDate: string;
  lockedThroughDate: string;
  reason: string;
  overriddenBy: string;
  overriddenAt?: Date;
  createdAt?: Date;
}

export class PeriodLockOverride {
  readonly id: string;
  readonly companyId: string;
  readonly sourceModule: 'sales';
  readonly sourceType: PeriodLockOverrideSourceType;
  readonly sourceId: string;
  readonly sourceNumber: string;
  readonly documentDate: string;
  readonly lockedThroughDate: string;
  readonly reason: string;
  readonly overriddenBy: string;
  readonly overriddenAt: Date;
  readonly createdAt: Date;

  constructor(props: PeriodLockOverrideProps) {
    if (!props.reason?.trim()) {
      throw new Error('PeriodLockOverride reason is required and must be non-empty');
    }
    if (!props.overriddenBy?.trim()) {
      throw new Error('PeriodLockOverride overriddenBy is required');
    }

    this.id = props.id ?? randomUUID();
    this.companyId = props.companyId;
    this.sourceModule = props.sourceModule;
    this.sourceType = props.sourceType;
    this.sourceId = props.sourceId;
    this.sourceNumber = props.sourceNumber;
    this.documentDate = props.documentDate;
    this.lockedThroughDate = props.lockedThroughDate;
    this.reason = props.reason.trim();
    this.overriddenBy = props.overriddenBy;
    this.overriddenAt = props.overriddenAt ?? new Date();
    this.createdAt = props.createdAt ?? new Date();
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      companyId: this.companyId,
      sourceModule: this.sourceModule,
      sourceType: this.sourceType,
      sourceId: this.sourceId,
      sourceNumber: this.sourceNumber,
      documentDate: this.documentDate,
      lockedThroughDate: this.lockedThroughDate,
      reason: this.reason,
      overriddenBy: this.overriddenBy,
      overriddenAt: this.overriddenAt.toISOString(),
      createdAt: this.createdAt.toISOString(),
    };
  }

  static fromJSON(data: Record<string, unknown>): PeriodLockOverride {
    return new PeriodLockOverride({
      id: data.id as string,
      companyId: data.companyId as string,
      sourceModule: data.sourceModule as 'sales',
      sourceType: data.sourceType as PeriodLockOverrideSourceType,
      sourceId: data.sourceId as string,
      sourceNumber: data.sourceNumber as string,
      documentDate: data.documentDate as string,
      lockedThroughDate: data.lockedThroughDate as string,
      reason: data.reason as string,
      overriddenBy: data.overriddenBy as string,
      overriddenAt: data.overriddenAt ? new Date(data.overriddenAt as string) : undefined,
      createdAt: data.createdAt ? new Date(data.createdAt as string) : undefined,
    });
  }
}
