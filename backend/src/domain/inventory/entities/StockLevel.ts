export interface StockLevelProps {
  id: string;
  companyId: string;
  itemId: string;
  warehouseId: string;
  qtyOnHand: number;
  reservedQty: number;
  avgCostBase: number;
  avgCostCCY: number;
  lastCostBase: number;
  lastCostCCY: number;
  postingSeq: number;
  maxBusinessDate: string;
  totalMovements: number;
  lastMovementId: string;
  version: number;
  updatedAt: Date;
}

const toDate = (value: any): Date => {
  if (value instanceof Date) return value;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
};

export class StockLevel {
  readonly id: string;
  readonly companyId: string;
  readonly itemId: string;
  readonly warehouseId: string;
  qtyOnHand: number;
  reservedQty: number;
  avgCostBase: number;
  avgCostCCY: number;
  lastCostBase: number;
  lastCostCCY: number;
  postingSeq: number;
  maxBusinessDate: string;
  totalMovements: number;
  lastMovementId: string;
  version: number;
  updatedAt: Date;

  constructor(props: StockLevelProps) {
    if (!props.id?.trim()) throw new Error('StockLevel id is required');
    if (!props.companyId?.trim()) throw new Error('StockLevel companyId is required');
    if (!props.itemId?.trim()) throw new Error('StockLevel itemId is required');
    if (!props.warehouseId?.trim()) throw new Error('StockLevel warehouseId is required');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(props.maxBusinessDate)) {
      throw new Error('StockLevel maxBusinessDate must be in YYYY-MM-DD format');
    }
    if (props.postingSeq < 0 || Number.isNaN(props.postingSeq)) {
      throw new Error('StockLevel postingSeq must be greater than or equal to 0');
    }
    if (props.version < 0 || Number.isNaN(props.version)) {
      throw new Error('StockLevel version must be greater than or equal to 0');
    }

    this.id = props.id;
    this.companyId = props.companyId;
    this.itemId = props.itemId;
    this.warehouseId = props.warehouseId;
    this.qtyOnHand = props.qtyOnHand;
    this.reservedQty = props.reservedQty;
    this.avgCostBase = props.avgCostBase;
    this.avgCostCCY = props.avgCostCCY;
    this.lastCostBase = props.lastCostBase;
    this.lastCostCCY = props.lastCostCCY;
    this.postingSeq = props.postingSeq;
    this.maxBusinessDate = props.maxBusinessDate;
    this.totalMovements = props.totalMovements;
    this.lastMovementId = props.lastMovementId;
    this.version = props.version;
    this.updatedAt = props.updatedAt;
  }

  static compositeId(itemId: string, warehouseId: string): string {
    return `${itemId}_${warehouseId}`;
  }

  static createNew(companyId: string, itemId: string, warehouseId: string, now: Date = new Date()): StockLevel {
    return new StockLevel({
      id: StockLevel.compositeId(itemId, warehouseId),
      companyId,
      itemId,
      warehouseId,
      qtyOnHand: 0,
      reservedQty: 0,
      avgCostBase: 0,
      avgCostCCY: 0,
      lastCostBase: 0,
      lastCostCCY: 0,
      postingSeq: 0,
      maxBusinessDate: '1970-01-01',
      totalMovements: 0,
      lastMovementId: '',
      version: 0,
      updatedAt: now,
    });
  }

  applyMovementMetadata(movementId: string, movementDate: string, now: Date = new Date()): {
    oldMaxBusinessDate: string;
    isBackdated: boolean;
  } {
    if (!movementId?.trim()) throw new Error('movementId is required');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(movementDate)) {
      throw new Error('movementDate must be in YYYY-MM-DD format');
    }

    const oldMaxBusinessDate = this.maxBusinessDate;
    const isBackdated = movementDate < oldMaxBusinessDate;

    this.postingSeq += 1;
    this.version += 1;
    this.totalMovements += 1;
    this.maxBusinessDate = movementDate > oldMaxBusinessDate ? movementDate : oldMaxBusinessDate;
    this.lastMovementId = movementId;
    this.updatedAt = now;

    return { oldMaxBusinessDate, isBackdated };
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      itemId: this.itemId,
      warehouseId: this.warehouseId,
      qtyOnHand: this.qtyOnHand,
      reservedQty: this.reservedQty,
      avgCostBase: this.avgCostBase,
      avgCostCCY: this.avgCostCCY,
      lastCostBase: this.lastCostBase,
      lastCostCCY: this.lastCostCCY,
      postingSeq: this.postingSeq,
      maxBusinessDate: this.maxBusinessDate,
      totalMovements: this.totalMovements,
      lastMovementId: this.lastMovementId,
      version: this.version,
      updatedAt: this.updatedAt,
    };
  }

  static fromJSON(data: any): StockLevel {
    return new StockLevel({
      id: data.id,
      companyId: data.companyId,
      itemId: data.itemId,
      warehouseId: data.warehouseId,
      qtyOnHand: data.qtyOnHand ?? 0,
      reservedQty: data.reservedQty ?? 0,
      avgCostBase: data.avgCostBase ?? 0,
      avgCostCCY: data.avgCostCCY ?? 0,
      lastCostBase: data.lastCostBase ?? 0,
      lastCostCCY: data.lastCostCCY ?? 0,
      postingSeq: data.postingSeq ?? 0,
      maxBusinessDate: data.maxBusinessDate || '1970-01-01',
      totalMovements: data.totalMovements ?? 0,
      lastMovementId: data.lastMovementId || '',
      version: data.version ?? 0,
      updatedAt: toDate(data.updatedAt || new Date()),
    });
  }
}
