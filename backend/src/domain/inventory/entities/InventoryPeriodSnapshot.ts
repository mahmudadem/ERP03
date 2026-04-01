export interface InventoryPeriodSnapshotLine {
  itemId: string;
  warehouseId: string;
  qtyOnHand: number;
  avgCostBase: number;
  avgCostCCY: number;
  lastCostBase: number;
  lastCostCCY: number;
  valueBase: number;
}

export interface InventoryPeriodSnapshotProps {
  id: string;
  companyId: string;
  periodKey: string;
  periodEndDate: string;
  snapshotData: InventoryPeriodSnapshotLine[];
  totalValueBase: number;
  totalItems: number;
  createdAt: Date;
}

const toDate = (value: any): Date => {
  if (value instanceof Date) return value;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
};

export class InventoryPeriodSnapshot {
  readonly id: string;
  readonly companyId: string;
  readonly periodKey: string;
  readonly periodEndDate: string;
  readonly snapshotData: InventoryPeriodSnapshotLine[];
  readonly totalValueBase: number;
  readonly totalItems: number;
  readonly createdAt: Date;

  constructor(props: InventoryPeriodSnapshotProps) {
    if (!props.id?.trim()) throw new Error('InventoryPeriodSnapshot id is required');
    if (!props.companyId?.trim()) throw new Error('InventoryPeriodSnapshot companyId is required');
    if (!/^\d{4}-\d{2}$/.test(props.periodKey)) {
      throw new Error('InventoryPeriodSnapshot periodKey must be in YYYY-MM format');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(props.periodEndDate)) {
      throw new Error('InventoryPeriodSnapshot periodEndDate must be in YYYY-MM-DD format');
    }
    if (!Array.isArray(props.snapshotData)) {
      throw new Error('InventoryPeriodSnapshot snapshotData must be an array');
    }

    this.id = props.id;
    this.companyId = props.companyId;
    this.periodKey = props.periodKey;
    this.periodEndDate = props.periodEndDate;
    this.snapshotData = props.snapshotData.map((line) => ({ ...line }));
    this.totalValueBase = props.totalValueBase;
    this.totalItems = props.totalItems;
    this.createdAt = props.createdAt;
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      periodKey: this.periodKey,
      periodEndDate: this.periodEndDate,
      snapshotData: this.snapshotData.map((line) => ({ ...line })),
      totalValueBase: this.totalValueBase,
      totalItems: this.totalItems,
      createdAt: this.createdAt,
    };
  }

  static fromJSON(data: any): InventoryPeriodSnapshot {
    return new InventoryPeriodSnapshot({
      id: data.id,
      companyId: data.companyId,
      periodKey: data.periodKey,
      periodEndDate: data.periodEndDate,
      snapshotData: Array.isArray(data.snapshotData) ? data.snapshotData : [],
      totalValueBase: data.totalValueBase ?? 0,
      totalItems: data.totalItems ?? 0,
      createdAt: toDate(data.createdAt || new Date()),
    });
  }
}
