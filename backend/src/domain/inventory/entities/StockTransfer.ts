export type StockTransferStatus = 'DRAFT' | 'IN_TRANSIT' | 'COMPLETED';

/**
 * FLAT  — pure stock move A→B; destination inherits the source moving-average
 *         cost; no GL voucher (value-neutral).
 * VALUED — ledger-affecting; the destination may land at an overridden/uplifted
 *         cost (e.g. capitalized freight). The uplift posts to GL with the
 *         credit going to the Inventory Transfer Clearing account.
 */
export type StockTransferMode = 'FLAT' | 'VALUED';

export interface StockTransferLine {
  itemId: string;
  qty: number;
  unitCostBaseAtTransfer: number;
  unitCostCCYAtTransfer: number;
}

export interface StockTransferProps {
  id: string;
  companyId: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  date: string;
  notes?: string;
  mode?: StockTransferMode;
  lines: StockTransferLine[];
  status: StockTransferStatus;
  voucherId?: string;
  transferPairId: string;
  createdBy: string;
  createdAt: Date;
  completedAt?: Date;
}

const TRANSFER_STATUSES: StockTransferStatus[] = ['DRAFT', 'IN_TRANSIT', 'COMPLETED'];
const TRANSFER_MODES: StockTransferMode[] = ['FLAT', 'VALUED'];

const toDate = (value: any): Date => {
  if (!value) return value;
  if (value instanceof Date) return value;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
};

export class StockTransfer {
  readonly id: string;
  readonly companyId: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  date: string;
  notes?: string;
  mode: StockTransferMode;
  lines: StockTransferLine[];
  status: StockTransferStatus;
  voucherId?: string;
  transferPairId: string;
  readonly createdBy: string;
  readonly createdAt: Date;
  completedAt?: Date;

  constructor(props: StockTransferProps) {
    if (!props.id?.trim()) throw new Error('StockTransfer id is required');
    if (!props.companyId?.trim()) throw new Error('StockTransfer companyId is required');
    if (!props.sourceWarehouseId?.trim()) throw new Error('StockTransfer sourceWarehouseId is required');
    if (!props.destinationWarehouseId?.trim()) throw new Error('StockTransfer destinationWarehouseId is required');
    if (props.sourceWarehouseId === props.destinationWarehouseId) {
      throw new Error('StockTransfer sourceWarehouseId and destinationWarehouseId must be different');
    }
    if (!props.transferPairId?.trim()) throw new Error('StockTransfer transferPairId is required');
    if (!props.createdBy?.trim()) throw new Error('StockTransfer createdBy is required');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(props.date)) {
      throw new Error('StockTransfer date must be in YYYY-MM-DD format');
    }
    if (!TRANSFER_STATUSES.includes(props.status)) {
      throw new Error(`Invalid StockTransfer status: ${props.status}`);
    }
    if (props.mode !== undefined && !TRANSFER_MODES.includes(props.mode)) {
      throw new Error(`Invalid StockTransfer mode: ${props.mode}`);
    }
    if (!Array.isArray(props.lines) || props.lines.length === 0) {
      throw new Error('StockTransfer lines are required');
    }

    props.lines.forEach((line, index) => {
      if (!line.itemId?.trim()) {
        throw new Error(`StockTransfer line ${index + 1}: itemId is required`);
      }
      if (line.qty <= 0 || Number.isNaN(line.qty)) {
        throw new Error(`StockTransfer line ${index + 1}: qty must be greater than 0`);
      }
      if (Number.isNaN(line.unitCostBaseAtTransfer) || Number.isNaN(line.unitCostCCYAtTransfer)) {
        throw new Error(`StockTransfer line ${index + 1}: unit costs must be valid numbers`);
      }
    });

    this.id = props.id;
    this.companyId = props.companyId;
    this.sourceWarehouseId = props.sourceWarehouseId;
    this.destinationWarehouseId = props.destinationWarehouseId;
    this.date = props.date;
    this.notes = props.notes;
    this.mode = props.mode || 'FLAT';
    this.lines = props.lines.map((line) => ({ ...line }));
    this.status = props.status;
    this.voucherId = props.voucherId;
    this.transferPairId = props.transferPairId;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt;
    this.completedAt = props.completedAt;
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      sourceWarehouseId: this.sourceWarehouseId,
      destinationWarehouseId: this.destinationWarehouseId,
      date: this.date,
      notes: this.notes,
      mode: this.mode,
      lines: this.lines.map((line) => ({ ...line })),
      status: this.status,
      voucherId: this.voucherId,
      transferPairId: this.transferPairId,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      completedAt: this.completedAt,
    };
  }

  static fromJSON(data: any): StockTransfer {
    return new StockTransfer({
      id: data.id,
      companyId: data.companyId,
      sourceWarehouseId: data.sourceWarehouseId,
      destinationWarehouseId: data.destinationWarehouseId,
      date: data.date,
      notes: data.notes,
      mode: data.mode || 'FLAT',
      lines: Array.isArray(data.lines) ? data.lines : [],
      status: data.status || 'DRAFT',
      voucherId: data.voucherId,
      transferPairId: data.transferPairId || data.id,
      createdBy: data.createdBy || 'SYSTEM',
      createdAt: toDate(data.createdAt || new Date()),
      completedAt: toDate(data.completedAt),
    });
  }
}
