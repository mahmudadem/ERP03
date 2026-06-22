/**
 * PosHeldCart — Suspended POS cart before payment/posting.
 *
 * Held carts are operational only. They do not reserve stock, allocate receipt
 * numbers, create payments, or post accounting events until recalled and sold.
 */
export type PosHeldCartStatus = 'HELD' | 'RECALLED' | 'CANCELLED';

export interface PosHeldCartLine {
  lineId?: string;
  itemId: string;
  itemCode?: string;
  itemName?: string;
  uom?: string;
  qty: number;
  unitPrice: number;
  discountType?: 'PERCENT' | 'AMOUNT';
  discountValue?: number;
  lineDiscount?: number;
  lineTotal?: number;
  taxCodeId?: string;
  priceOverride?: boolean;
  taxOverride?: boolean;
  managerOverrideId?: string;
  note?: string;
}

export interface PosHeldCartProps {
  id: string;
  companyId: string;
  registerId: string;
  shiftId: string;
  cashierUserId: string;
  customerId?: string;
  note?: string;
  status?: PosHeldCartStatus;
  lines: PosHeldCartLine[];
  subtotal?: number;
  discountTotal?: number;
  taxTotal?: number;
  grandTotal?: number;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
  recalledAt?: Date;
  recalledBy?: string;
  cancelledAt?: Date;
  cancelledBy?: string;
  cancelReason?: string;
}

const numeric = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const asDate = (value: unknown, fallback = new Date()): Date => {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return fallback;
};

export class PosHeldCart {
  readonly id: string;
  readonly companyId: string;
  readonly registerId: string;
  readonly shiftId: string;
  readonly cashierUserId: string;
  readonly customerId?: string;
  readonly note?: string;
  readonly status: PosHeldCartStatus;
  readonly lines: PosHeldCartLine[];
  readonly subtotal: number;
  readonly discountTotal: number;
  readonly taxTotal: number;
  readonly grandTotal: number;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly recalledAt?: Date;
  readonly recalledBy?: string;
  readonly cancelledAt?: Date;
  readonly cancelledBy?: string;
  readonly cancelReason?: string;

  constructor(props: PosHeldCartProps) {
    if (!props.id?.trim()) throw new Error('PosHeldCart id is required');
    if (!props.companyId?.trim()) throw new Error('PosHeldCart companyId is required');
    if (!props.registerId?.trim()) throw new Error('PosHeldCart registerId is required');
    if (!props.shiftId?.trim()) throw new Error('PosHeldCart shiftId is required');
    if (!props.cashierUserId?.trim()) throw new Error('PosHeldCart cashierUserId is required');
    if (!props.createdBy?.trim()) throw new Error('PosHeldCart createdBy is required');
    if (!Array.isArray(props.lines) || props.lines.length === 0) {
      throw new Error('PosHeldCart must have at least one line.');
    }

    this.id = props.id;
    this.companyId = props.companyId;
    this.registerId = props.registerId;
    this.shiftId = props.shiftId;
    this.cashierUserId = props.cashierUserId;
    this.customerId = props.customerId;
    this.note = props.note;
    this.status = props.status || 'HELD';
    this.lines = props.lines.map((line) => ({
      ...line,
      qty: numeric(line.qty),
      unitPrice: numeric(line.unitPrice),
      lineDiscount: numeric(line.lineDiscount),
      lineTotal: numeric(line.lineTotal, numeric(line.qty) * numeric(line.unitPrice) - numeric(line.lineDiscount)),
    }));
    this.subtotal = numeric(props.subtotal, this.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0));
    this.discountTotal = numeric(props.discountTotal, this.lines.reduce((s, l) => s + numeric(l.lineDiscount), 0));
    this.taxTotal = numeric(props.taxTotal);
    this.grandTotal = numeric(props.grandTotal, Math.max(0, this.subtotal - this.discountTotal + this.taxTotal));
    this.createdBy = props.createdBy;
    this.createdAt = asDate(props.createdAt);
    this.updatedAt = asDate(props.updatedAt, this.createdAt);
    this.recalledAt = props.recalledAt ? asDate(props.recalledAt) : undefined;
    this.recalledBy = props.recalledBy;
    this.cancelledAt = props.cancelledAt ? asDate(props.cancelledAt) : undefined;
    this.cancelledBy = props.cancelledBy;
    this.cancelReason = props.cancelReason;
  }

  markRecalled(userId: string, at = new Date()): PosHeldCart {
    if (this.status !== 'HELD') throw new Error('Only HELD carts can be recalled.');
    return new PosHeldCart({
      ...this.toJSON(),
      status: 'RECALLED',
      recalledAt: at,
      recalledBy: userId,
      updatedAt: at,
    });
  }

  markCancelled(userId: string, reason?: string, at = new Date()): PosHeldCart {
    if (this.status !== 'HELD') throw new Error('Only HELD carts can be cancelled.');
    return new PosHeldCart({
      ...this.toJSON(),
      status: 'CANCELLED',
      cancelledAt: at,
      cancelledBy: userId,
      cancelReason: reason,
      updatedAt: at,
    });
  }

  toJSON(): PosHeldCartProps {
    return {
      id: this.id,
      companyId: this.companyId,
      registerId: this.registerId,
      shiftId: this.shiftId,
      cashierUserId: this.cashierUserId,
      customerId: this.customerId,
      note: this.note,
      status: this.status,
      lines: this.lines,
      subtotal: this.subtotal,
      discountTotal: this.discountTotal,
      taxTotal: this.taxTotal,
      grandTotal: this.grandTotal,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      recalledAt: this.recalledAt,
      recalledBy: this.recalledBy,
      cancelledAt: this.cancelledAt,
      cancelledBy: this.cancelledBy,
      cancelReason: this.cancelReason,
    };
  }

  static fromJSON(data: any): PosHeldCart {
    return new PosHeldCart({
      id: data.id,
      companyId: data.companyId,
      registerId: data.registerId,
      shiftId: data.shiftId,
      cashierUserId: data.cashierUserId,
      customerId: data.customerId,
      note: data.note,
      status: data.status,
      lines: data.lines || [],
      subtotal: data.subtotal,
      discountTotal: data.discountTotal,
      taxTotal: data.taxTotal,
      grandTotal: data.grandTotal,
      createdBy: data.createdBy,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      recalledAt: data.recalledAt,
      recalledBy: data.recalledBy,
      cancelledAt: data.cancelledAt,
      cancelledBy: data.cancelledBy,
      cancelReason: data.cancelReason,
    });
  }
}
