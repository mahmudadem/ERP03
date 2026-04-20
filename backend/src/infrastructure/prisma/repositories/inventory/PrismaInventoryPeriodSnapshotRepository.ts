import { PrismaClient } from '@prisma/client';
import { IInventoryPeriodSnapshotRepository, InventoryPeriodSnapshotListOptions } from '../../../../repository/interfaces/inventory/IInventoryPeriodSnapshotRepository';
import { InventoryPeriodSnapshot } from '../../../../domain/inventory/entities/InventoryPeriodSnapshot';

export class PrismaInventoryPeriodSnapshotRepository implements IInventoryPeriodSnapshotRepository {
  constructor(private prisma: PrismaClient) {}

  async saveSnapshot(snapshot: InventoryPeriodSnapshot): Promise<void> {
    const snapshotData = snapshot.snapshotData.map((line) => ({
      itemId: line.itemId,
      warehouseId: line.warehouseId,
      qtyOnHand: line.qtyOnHand,
      avgCostBase: line.avgCostBase,
      avgCostCCY: line.avgCostCCY,
      lastCostBase: line.lastCostBase,
      lastCostCCY: line.lastCostCCY,
      valueBase: line.valueBase,
    }));

    await this.prisma.inventoryPeriodSnapshot.upsert({
      where: { id: snapshot.id },
      create: {
        id: snapshot.id,
        companyId: snapshot.companyId,
        period: snapshot.periodKey,
        itemId: '_aggregate_',
        warehouseId: '_aggregate_',
        openingQty: 0,
        closingQty: 0,
        totalIn: 0,
        totalOut: 0,
        avgCostBase: 0,
        capturedAt: snapshot.createdAt,
        snapshotData: snapshotData,
        totalValueBase: snapshot.totalValueBase,
        totalItems: snapshot.totalItems,
      } as any,
      update: {
        period: snapshot.periodKey,
        capturedAt: snapshot.createdAt,
        snapshotData: snapshotData,
        totalValueBase: snapshot.totalValueBase,
        totalItems: snapshot.totalItems,
      } as any,
    });
  }

  async getSnapshot(companyId: string, id: string): Promise<InventoryPeriodSnapshot | null> {
    const record = await this.prisma.inventoryPeriodSnapshot.findFirst({
      where: { id, companyId },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async getSnapshotByPeriodKey(companyId: string, periodKey: string): Promise<InventoryPeriodSnapshot | null> {
    const record = await this.prisma.inventoryPeriodSnapshot.findFirst({
      where: { companyId, period: periodKey },
      orderBy: { capturedAt: 'desc' },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async findNearestSnapshotForDate(companyId: string, asOfDate: string): Promise<InventoryPeriodSnapshot | null> {
    const asOfPeriod = asOfDate.substring(0, 7);
    const records = await this.prisma.inventoryPeriodSnapshot.findMany({
      where: {
        companyId,
        period: { lte: asOfPeriod },
      },
      orderBy: { period: 'desc' },
    });
    if (!records || records.length === 0) return null;
    return this.toDomain(records[0]);
  }

  async listSnapshots(companyId: string, opts?: InventoryPeriodSnapshotListOptions): Promise<InventoryPeriodSnapshot[]> {
    const records = await this.prisma.inventoryPeriodSnapshot.findMany({
      where: { companyId },
      orderBy: { capturedAt: 'desc' },
      take: opts?.limit,
      skip: opts?.offset,
    });
    return records.map((r) => this.toDomain(r));
  }

  private toDomain(record: any): InventoryPeriodSnapshot {
    const snapshotData = (record as any).snapshotData ?? [];
    const periodKey = record.period;
    const periodEndDate = (record as any).periodEndDate ?? (periodKey ? `${periodKey}-28` : '');
    return new InventoryPeriodSnapshot({
      id: record.id,
      companyId: record.companyId,
      periodKey: periodKey,
      periodEndDate: periodEndDate,
      snapshotData: Array.isArray(snapshotData) ? snapshotData : [],
      totalValueBase: (record as any).totalValueBase ?? 0,
      totalItems: (record as any).totalItems ?? 0,
      createdAt: record.capturedAt,
    });
  }
}
