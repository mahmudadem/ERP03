/**
 * PosShift — A cashier session on a specific register.
 *
 * The shift carries the opening float, optional reconciliation at close
 * (counted cash, expected cash, over/short amount + voucher id), and a
 * lifecycle status. Only ONE shift may be OPEN per register at a time.
 */
export type PosShiftStatus = 'OPEN' | 'CLOSED' | 'RECONCILED' | 'FORCE_CLOSED' | 'CANCELLED';
export type PosShiftPaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CUSTOM';
export type PosShiftPaymentTotals = Record<PosShiftPaymentMethod, number>;

export interface PosShiftProps {
  id: string;
  companyId: string;
  registerId: string;
  cashierUserId: string;
  status: PosShiftStatus;
  openedAt: Date;
  openingFloat: number;
  closedAt?: Date;
  expectedCash?: number;
  countedCash?: number;
  expectedPaymentTotals?: Partial<PosShiftPaymentTotals>;
  countedPaymentTotals?: Partial<PosShiftPaymentTotals>;
  overShortPaymentTotals?: Partial<PosShiftPaymentTotals>;
  overShortAmount?: number;
  overShortVoucherId?: string;
  reconciledAt?: Date;
  reconciledBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class PosShift {
  readonly id: string;
  readonly companyId: string;
  readonly registerId: string;
  readonly cashierUserId: string;
  status: PosShiftStatus;
  readonly openedAt: Date;
  readonly openingFloat: number;
  closedAt?: Date;
  expectedCash?: number;
  countedCash?: number;
  expectedPaymentTotals: PosShiftPaymentTotals;
  countedPaymentTotals: PosShiftPaymentTotals;
  overShortPaymentTotals: PosShiftPaymentTotals;
  overShortAmount?: number;
  overShortVoucherId?: string;
  reconciledAt?: Date;
  reconciledBy?: string;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: PosShiftProps) {
    if (!props.id?.trim()) throw new Error('PosShift id is required');
    if (!props.companyId?.trim()) throw new Error('PosShift companyId is required');
    if (!props.registerId?.trim()) throw new Error('PosShift registerId is required');
    if (!props.cashierUserId?.trim()) throw new Error('PosShift cashierUserId is required');
    if (!Number.isFinite(props.openingFloat) || props.openingFloat < 0) {
      throw new Error('PosShift openingFloat must be a non-negative number');
    }
    const status: PosShiftStatus = (['OPEN', 'CLOSED', 'RECONCILED', 'FORCE_CLOSED', 'CANCELLED'] as PosShiftStatus[]).includes(props.status)
      ? props.status
      : 'OPEN';

    this.id = props.id;
    this.companyId = props.companyId;
    this.registerId = props.registerId;
    this.cashierUserId = props.cashierUserId;
    this.status = status;
    this.openedAt = props.openedAt;
    this.openingFloat = props.openingFloat;
    this.closedAt = props.closedAt;
    this.expectedCash = props.expectedCash;
    this.countedCash = props.countedCash;
    this.expectedPaymentTotals = normalizePaymentTotals(props.expectedPaymentTotals);
    this.countedPaymentTotals = normalizePaymentTotals(props.countedPaymentTotals);
    this.overShortPaymentTotals = normalizePaymentTotals(props.overShortPaymentTotals);
    this.overShortAmount = props.overShortAmount;
    this.overShortVoucherId = props.overShortVoucherId;
    this.reconciledAt = props.reconciledAt;
    this.reconciledBy = props.reconciledBy;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  isOpen(): boolean {
    return this.status === 'OPEN';
  }

  isClosed(): boolean {
    return this.status !== 'OPEN';
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      registerId: this.registerId,
      cashierUserId: this.cashierUserId,
      status: this.status,
      openedAt: this.openedAt.toISOString(),
      openingFloat: this.openingFloat,
      closedAt: this.closedAt ? this.closedAt.toISOString() : null,
      expectedCash: this.expectedCash,
      countedCash: this.countedCash,
      expectedPaymentTotals: this.expectedPaymentTotals,
      countedPaymentTotals: this.countedPaymentTotals,
      overShortPaymentTotals: this.overShortPaymentTotals,
      overShortAmount: this.overShortAmount,
      overShortVoucherId: this.overShortVoucherId,
      reconciledAt: this.reconciledAt ? this.reconciledAt.toISOString() : null,
      reconciledBy: this.reconciledBy,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static fromJSON(data: any): PosShift {
    return new PosShift({
      id: data.id,
      companyId: data.companyId,
      registerId: data.registerId,
      cashierUserId: data.cashierUserId,
      status: data.status,
      openedAt: data.openedAt ? new Date(data.openedAt) : new Date(),
      openingFloat: Number(data.openingFloat) || 0,
      closedAt: data.closedAt ? new Date(data.closedAt) : undefined,
      expectedCash: data.expectedCash !== undefined ? Number(data.expectedCash) : undefined,
      countedCash: data.countedCash !== undefined ? Number(data.countedCash) : undefined,
      expectedPaymentTotals: data.expectedPaymentTotals,
      countedPaymentTotals: data.countedPaymentTotals,
      overShortPaymentTotals: data.overShortPaymentTotals,
      overShortAmount: data.overShortAmount !== undefined ? Number(data.overShortAmount) : undefined,
      overShortVoucherId: data.overShortVoucherId || undefined,
      reconciledAt: data.reconciledAt ? new Date(data.reconciledAt) : undefined,
      reconciledBy: data.reconciledBy || undefined,
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
    });
  }
}

export const EMPTY_POS_SHIFT_PAYMENT_TOTALS: PosShiftPaymentTotals = {
  CASH: 0,
  CARD: 0,
  BANK_TRANSFER: 0,
  CUSTOM: 0,
};

export function normalizePaymentTotals(value?: Partial<PosShiftPaymentTotals> | null): PosShiftPaymentTotals {
  return {
    CASH: round2(Number(value?.CASH) || 0),
    CARD: round2(Number(value?.CARD) || 0),
    BANK_TRANSFER: round2(Number(value?.BANK_TRANSFER) || 0),
    CUSTOM: round2(Number(value?.CUSTOM) || 0),
  };
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
