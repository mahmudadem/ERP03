import { Prisma, PrismaClient } from '@prisma/client';
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
        periodEndDate: new Date(snapshot.periodEndDate),
        capturedAt: snapshot.createdAt,
        snapshotData: snapshotData as unknown as Prisma.InputJsonValue,
        totalValueBase: snapshot.totalValueBase,
        totalItems: snapshot.totalItems,
      },
      update: {
        period: snapshot.periodKey,
        periodEndDate: new Date(snapshot.periodEndDate),
        capturedAt: snapshot.createdAt,
        snapshotData: snapshotData as unknown as Prisma.InputJsonValue,
        totalValueBase: snapshot.totalValueBase,
        totalItems: snapshot.totalItems,
      },
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
    const snapshotData = (record).snapshotData ?? [];
    const periodKey = record.period;
    const periodEndDate = (record).periodEndDate ?? (periodKey ? `${periodKey}-28` : '');
    return new InventoryPeriodSnapshot({
      id: record.id,
      companyId: record.companyId,
      periodKey: periodKey,
      periodEndDate: periodEndDate,
      snapshotData: Array.isArray(snapshotData) ? snapshotData : [],
      totalValueBase: (record).totalValueBase ?? 0,
      totalItems: (record).totalItems ?? 0,
      createdAt: record.capturedAt,
    });
  }
}
