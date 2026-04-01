import { InventoryPeriodSnapshot } from '../../../domain/inventory/entities/InventoryPeriodSnapshot';

export interface InventoryPeriodSnapshotListOptions {
  limit?: number;
  offset?: number;
}

export interface IInventoryPeriodSnapshotRepository {
  saveSnapshot(snapshot: InventoryPeriodSnapshot): Promise<void>;
  getSnapshot(companyId: string, id: string): Promise<InventoryPeriodSnapshot | null>;
  getSnapshotByPeriodKey(companyId: string, periodKey: string): Promise<InventoryPeriodSnapshot | null>;
  findNearestSnapshotForDate(companyId: string, asOfDate: string): Promise<InventoryPeriodSnapshot | null>;
  listSnapshots(companyId: string, opts?: InventoryPeriodSnapshotListOptions): Promise<InventoryPeriodSnapshot[]>;
}
