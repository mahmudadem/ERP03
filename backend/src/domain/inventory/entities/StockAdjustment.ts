export type StockAdjustmentReason = 'DAMAGE' | 'LOSS' | 'CORRECTION' | 'EXPIRED' | 'FOUND' | 'OTHER';
export type StockAdjustmentStatus = 'DRAFT' | 'POSTED';

export interface StockAdjustmentLine {
  itemId: string;
  currentQty: number;
  newQty: number;
  adjustmentQty: number;
  unitCostBase: number;
  unitCostCCY: number;
}

export interface StockAdjustmentProps {
  id: string;
  companyId: string;
  warehouseId: string;
  date: string;
  reason: StockAdjustmentReason;
  notes?: string;
  lines: StockAdjustmentLine[];
  status: StockAdjustmentStatus;
  voucherId?: string;
  adjustmentValueBase: number;
  createdBy: string;
  createdAt: Date;
  postedAt?: Date;
}

const ADJUSTMENT_REASONS: StockAdjustmentReason[] = ['DAMAGE', 'LOSS', 'CORRECTION', 'EXPIRED', 'FOUND', 'OTHER'];
const ADJUSTMENT_STATUSES: StockAdjustmentStatus[] = ['DRAFT', 'POSTED'];

const toDate = (value: any): Date => {
  if (!value) return value;
  if (value instanceof Date) return value;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
};

export class StockAdjustment {
  readonly id: string;
  readonly companyId: string;
  warehouseId: string;
  date: string;
  reason: StockAdjustmentReason;
  notes?: string;
  lines: StockAdjustmentLine[];
  status: StockAdjustmentStatus;
  voucherId?: string;
  adjustmentValueBase: number;
  readonly createdBy: string;
  readonly createdAt: Date;
  postedAt?: Date;

  constructor(props: StockAdjustmentProps) {
    if (!props.id?.trim()) throw new Error('StockAdjustment id is required');
    if (!props.companyId?.trim()) throw new Error('StockAdjustment companyId is required');
    if (!props.warehouseId?.trim()) throw new Error('StockAdjustment warehouseId is required');
    if (!props.createdBy?.trim()) throw new Error('StockAdjustment createdBy is required');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(props.date)) {
      throw new Error('StockAdjustment date must be in YYYY-MM-DD format');
    }
    if (!ADJUSTMENT_REASONS.includes(props.reason)) {
      throw new Error(`Invalid StockAdjustment reason: ${props.reason}`);
    }
    if (!ADJUSTMENT_STATUSES.includes(props.status)) {
      throw new Error(`Invalid StockAdjustment status: ${props.status}`);
    }
    if (!Array.isArray(props.lines) || props.lines.length === 0) {
      throw new Error('StockAdjustment lines are required');
    }

    props.lines.forEach((line, index) => {
      if (!line.itemId?.trim()) {
        throw new Error(`StockAdjustment line ${index + 1}: itemId is required`);
      }
      if (Number.isNaN(line.currentQty) || Number.isNaN(line.newQty) || Number.isNaN(line.adjustmentQty)) {
        throw new Error(`StockAdjustment line ${index + 1}: quantity fields must be valid numbers`);
      }
      if (Number.isNaN(line.unitCostBase) || Number.isNaN(line.unitCostCCY)) {
        throw new Error(`StockAdjustment line ${index + 1}: unit costs must be valid numbers`);
      }
    });

    this.id = props.id;
    this.companyId = props.companyId;
    this.warehouseId = props.warehouseId;
    this.date = props.date;
    this.reason = props.reason;
    this.notes = props.notes;
    this.lines = props.lines.map((line) => ({ ...line }));
    this.status = props.status;
    this.voucherId = props.voucherId;
    this.adjustmentValueBase = props.adjustmentValueBase;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt;
    this.postedAt = props.postedAt;
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      warehouseId: this.warehouseId,
      date: this.date,
      reason: this.reason,
      notes: this.notes,
      lines: this.lines.map((line) => ({ ...line })),
      status: this.status,
      voucherId: this.voucherId,
      adjustmentValueBase: this.adjustmentValueBase,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      postedAt: this.postedAt,
    };
  }

  static fromJSON(data: any): StockAdjustment {
    return new StockAdjustment({
      id: data.id,
      companyId: data.companyId,
      warehouseId: data.warehouseId,
      date: data.date,
      reason: data.reason,
      notes: data.notes,
      lines: Array.isArray(data.lines) ? data.lines : [],
      status: data.status || 'DRAFT',
      voucherId: data.voucherId,
      adjustmentValueBase: data.adjustmentValueBase ?? 0,
      createdBy: data.createdBy || 'SYSTEM',
      createdAt: toDate(data.createdAt || new Date()),
      postedAt: toDate(data.postedAt),
    });
  }
}
