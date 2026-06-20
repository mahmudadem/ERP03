/**
 * Inventory Revaluation — value-only cost correction document.
 *
 * Unlike Stock Adjustment (which changes quantity), Inventory Revaluation
 * keeps quantity untouched and only re-prices the existing on-hand
 * quantity at a new average cost. It is the standard "MR21" tool in
 * classic ERPs and is the only Inventory-issued document permitted to
 * correct a wrong average cost without an inventory quantity change.
 *
 * Modes:
 *   - INVOICE_DRIVEN / PERPETUAL: posts a balanced GL voucher (Dr/Cr
 *     Inventory Asset vs the dedicated Inventory Revaluation account)
 *     AND updates the sub-ledger average cost so sub-ledger and GL
 *     tie after posting.
 *   - PERIODIC: updates the sub-ledger average cost and the audit
 *     document, but does NOT post a daily Inventory Asset GL voucher
 *     (the company's carrying value is computed at report time via
 *     the Inventory Valuation service).
 */
export type InventoryRevaluationReason =
  | 'COST_CORRECTION'
  | 'BASIS_CHANGE'
  | 'MIGRATION_FIX'
  | 'WRITE_OFF'
  | 'OTHER';

export type InventoryRevaluationStatus = 'DRAFT' | 'POSTED';

export interface InventoryRevaluationLine {
  itemId: string;
  /** Required when costingBasis = WAREHOUSE; omitted when costingBasis = GLOBAL. */
  warehouseId?: string;
  /** Current on-hand quantity (read-only, snapshot at draft time). */
  qtyOnHand: number;
  currentAvgCostBase: number;
  currentAvgCostCCY: number;
  newAvgCostBase: number;
  newAvgCostCCY: number;
  /** valueDelta = qtyOnHand * (newAvgCost - currentAvgCost) in base and CCY. */
  valueDeltaBase: number;
  valueDeltaCCY: number;
  reason?: string;
}

export interface InventoryRevaluationProps {
  id: string;
  companyId: string;
  date: string;
  reason: InventoryRevaluationReason;
  notes?: string;
  lines: InventoryRevaluationLine[];
  status: InventoryRevaluationStatus;
  voucherId?: string;
  totalValueDeltaBase: number;
  totalValueDeltaCCY: number;
  createdBy: string;
  createdAt: Date;
  postedAt?: Date;
}

const REASONS: InventoryRevaluationReason[] = [
  'COST_CORRECTION',
  'BASIS_CHANGE',
  'MIGRATION_FIX',
  'WRITE_OFF',
  'OTHER',
];

const STATUSES: InventoryRevaluationStatus[] = ['DRAFT', 'POSTED'];

const toDate = (value: any): Date => {
  if (!value) return value;
  if (value instanceof Date) return value;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
};

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
const round6 = (value: number): number => Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;

export class InventoryRevaluation {
  readonly id: string;
  readonly companyId: string;
  date: string;
  reason: InventoryRevaluationReason;
  notes?: string;
  lines: InventoryRevaluationLine[];
  status: InventoryRevaluationStatus;
  voucherId?: string;
  totalValueDeltaBase: number;
  totalValueDeltaCCY: number;
  readonly createdBy: string;
  readonly createdAt: Date;
  postedAt?: Date;

  constructor(props: InventoryRevaluationProps) {
    if (!props.id?.trim()) throw new Error('InventoryRevaluation id is required');
    if (!props.companyId?.trim()) throw new Error('InventoryRevaluation companyId is required');
    if (!props.createdBy?.trim()) throw new Error('InventoryRevaluation createdBy is required');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(props.date)) {
      throw new Error('InventoryRevaluation date must be in YYYY-MM-DD format');
    }
    if (!REASONS.includes(props.reason)) {
      throw new Error(`Invalid InventoryRevaluation reason: ${props.reason}`);
    }
    if (!STATUSES.includes(props.status)) {
      throw new Error(`Invalid InventoryRevaluation status: ${props.status}`);
    }
    if (!Array.isArray(props.lines) || props.lines.length === 0) {
      throw new Error('InventoryRevaluation lines are required');
    }

    props.lines.forEach((line, index) => {
      if (!line.itemId?.trim()) {
        throw new Error(`InventoryRevaluation line ${index + 1}: itemId is required`);
      }
      if (
        Number.isNaN(line.qtyOnHand) ||
        Number.isNaN(line.currentAvgCostBase) ||
        Number.isNaN(line.currentAvgCostCCY) ||
        Number.isNaN(line.newAvgCostBase) ||
        Number.isNaN(line.newAvgCostCCY) ||
        Number.isNaN(line.valueDeltaBase) ||
        Number.isNaN(line.valueDeltaCCY)
      ) {
        throw new Error(`InventoryRevaluation line ${index + 1}: numeric fields must be valid numbers`);
      }
      if (line.newAvgCostBase < 0 || line.newAvgCostCCY < 0) {
        throw new Error(`InventoryRevaluation line ${index + 1}: new average cost must be non-negative`);
      }
    });

    this.id = props.id;
    this.companyId = props.companyId;
    this.date = props.date;
    this.reason = props.reason;
    this.notes = props.notes;
    this.lines = props.lines.map((line) => ({ ...line }));
    this.status = props.status;
    this.voucherId = props.voucherId;
    this.totalValueDeltaBase = round2(props.totalValueDeltaBase);
    this.totalValueDeltaCCY = round2(props.totalValueDeltaCCY);
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt;
    this.postedAt = props.postedAt;
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      date: this.date,
      reason: this.reason,
      notes: this.notes,
      lines: this.lines.map((line) => ({ ...line })),
      status: this.status,
      voucherId: this.voucherId,
      totalValueDeltaBase: this.totalValueDeltaBase,
      totalValueDeltaCCY: this.totalValueDeltaCCY,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      postedAt: this.postedAt,
    };
  }

  static fromJSON(data: any): InventoryRevaluation {
    return new InventoryRevaluation({
      id: data.id,
      companyId: data.companyId,
      date: typeof data.date === 'string'
        ? data.date.slice(0, 10)
        : new Date(data.date).toISOString().slice(0, 10),
      reason: data.reason,
      notes: data.notes,
      lines: Array.isArray(data.lines) ? data.lines.map((line: any) => ({
        ...line,
        qtyOnHand: round6(Number(line.qtyOnHand ?? 0)),
        currentAvgCostBase: round2(Number(line.currentAvgCostBase ?? 0)),
        currentAvgCostCCY: round2(Number(line.currentAvgCostCCY ?? 0)),
        newAvgCostBase: round2(Number(line.newAvgCostBase ?? 0)),
        newAvgCostCCY: round2(Number(line.newAvgCostCCY ?? 0)),
        valueDeltaBase: round2(Number(line.valueDeltaBase ?? 0)),
        valueDeltaCCY: round2(Number(line.valueDeltaCCY ?? 0)),
      })) : [],
      status: data.status || 'DRAFT',
      voucherId: data.voucherId,
      totalValueDeltaBase: data.totalValueDeltaBase ?? 0,
      totalValueDeltaCCY: data.totalValueDeltaCCY ?? 0,
      createdBy: data.createdBy || 'SYSTEM',
      createdAt: toDate(data.createdAt || new Date()),
      postedAt: toDate(data.postedAt),
    });
  }
}
