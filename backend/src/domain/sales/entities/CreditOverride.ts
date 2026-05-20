import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Value types
// ---------------------------------------------------------------------------

export type CreditOverrideSourceType = 'SALES_ORDER'; // extensible — add SO quote etc.

export interface CreditOverrideProps {
  id?: string;
  companyId: string;
  customerId: string;
  sourceType: CreditOverrideSourceType;
  /** The source document id (e.g. the SalesOrder.id) */
  sourceId: string;
  /** Human-readable number for display (e.g. "SO-2026-001") */
  sourceNumber: string;
  /** The customer's credit ceiling at the time of override */
  creditLimit: number;
  /** Sum of outstanding invoice balances at the time of override */
  currentExposure: number;
  /** The order's grandTotalBase at the time of override */
  orderAmount: number;
  /** currentExposure + orderAmount */
  projectedExposure: number;
  /** Mandatory justification — must be non-empty */
  reason: string;
  /** User id of the person who approved the override */
  overriddenBy: string;
  overriddenAt: Date;
  createdAt?: Date;
}

// ---------------------------------------------------------------------------
// Entity
// ---------------------------------------------------------------------------

export class CreditOverride {
  readonly id: string;
  readonly companyId: string;
  readonly customerId: string;
  readonly sourceType: CreditOverrideSourceType;
  readonly sourceId: string;
  readonly sourceNumber: string;
  readonly creditLimit: number;
  readonly currentExposure: number;
  readonly orderAmount: number;
  readonly projectedExposure: number;
  readonly reason: string;
  readonly overriddenBy: string;
  readonly overriddenAt: Date;
  readonly createdAt: Date;

  constructor(props: CreditOverrideProps) {
    if (!props.reason?.trim()) {
      throw new Error('CreditOverride reason is required and must be non-empty');
    }
    if (!props.overriddenBy?.trim()) {
      throw new Error('CreditOverride overriddenBy is required');
    }

    this.id = props.id ?? randomUUID();
    this.companyId = props.companyId;
    this.customerId = props.customerId;
    this.sourceType = props.sourceType;
    this.sourceId = props.sourceId;
    this.sourceNumber = props.sourceNumber;
    this.creditLimit = props.creditLimit;
    this.currentExposure = props.currentExposure;
    this.orderAmount = props.orderAmount;
    this.projectedExposure = props.projectedExposure;
    this.reason = props.reason.trim();
    this.overriddenBy = props.overriddenBy;
    this.overriddenAt = props.overriddenAt;
    this.createdAt = props.createdAt ?? new Date();
  }

  // -------------------------------------------------------------------------
  // Serialisation
  // -------------------------------------------------------------------------

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      companyId: this.companyId,
      customerId: this.customerId,
      sourceType: this.sourceType,
      sourceId: this.sourceId,
      sourceNumber: this.sourceNumber,
      creditLimit: this.creditLimit,
      currentExposure: this.currentExposure,
      orderAmount: this.orderAmount,
      projectedExposure: this.projectedExposure,
      reason: this.reason,
      overriddenBy: this.overriddenBy,
      overriddenAt: this.overriddenAt.toISOString(),
      createdAt: this.createdAt.toISOString(),
    };
  }

  static fromJSON(data: Record<string, unknown>): CreditOverride {
    return new CreditOverride({
      id: data.id as string,
      companyId: data.companyId as string,
      customerId: data.customerId as string,
      sourceType: data.sourceType as CreditOverrideSourceType,
      sourceId: data.sourceId as string,
      sourceNumber: data.sourceNumber as string,
      creditLimit: data.creditLimit as number,
      currentExposure: data.currentExposure as number,
      orderAmount: data.orderAmount as number,
      projectedExposure: data.projectedExposure as number,
      reason: data.reason as string,
      overriddenBy: data.overriddenBy as string,
      overriddenAt: new Date(data.overriddenAt as string),
      createdAt: data.createdAt ? new Date(data.createdAt as string) : undefined,
    });
  }
}
