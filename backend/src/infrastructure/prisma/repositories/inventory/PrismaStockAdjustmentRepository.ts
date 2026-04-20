import { PrismaClient } from '@prisma/client';
import { IStockAdjustmentRepository, StockAdjustmentListOptions } from '../../../../repository/interfaces/inventory/IStockAdjustmentRepository';
import { StockAdjustment, StockAdjustmentStatus } from '../../../../domain/inventory/entities/StockAdjustment';

export class PrismaStockAdjustmentRepository implements IStockAdjustmentRepository {
  constructor(private prisma: PrismaClient) {}

  async createAdjustment(adjustment: StockAdjustment, transaction?: unknown): Promise<void> {
    const prisma = (transaction as any) || this.prisma;
    await prisma.stockAdjustment.create({
      data: {
        id: adjustment.id,
        companyId: adjustment.companyId,
        documentNo: adjustment.id,
        date: new Date(adjustment.date),
        reason: adjustment.reason,
        notes: adjustment.notes || null,
        status: adjustment.status,
        createdBy: adjustment.createdBy,
        lines: {
          create: adjustment.lines.map((line) => ({
            id: `sal_${adjustment.id}_${line.itemId}`,
            itemId: line.itemId,
            warehouseId: adjustment.warehouseId,
            qtyBefore: line.currentQty,
            qtyAfter: line.newQty,
            unitCostBase: line.unitCostBase,
            notes: line.unitCostCCY?.toString() || null,
          })),
        },
      } as any,
    });
  }

  async updateAdjustment(companyId: string, id: string, data: Partial<StockAdjustment>, transaction?: unknown): Promise<void> {
    const prisma = (transaction as any) || this.prisma;
    const existing = await prisma.stockAdjustment.findUnique({
      where: { id, companyId },
      include: { lines: true },
    });
    const warehouseId = data.warehouseId || existing?.lines?.[0]?.warehouseId || '';
    const updateData: any = {};
    if (data.warehouseId !== undefined) updateData.warehouseId = data.warehouseId;
    if (data.date !== undefined) updateData.date = new Date(data.date);
    if (data.reason !== undefined) updateData.reason = data.reason;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.voucherId !== undefined) updateData.voucherId = data.voucherId;
    if (data.adjustmentValueBase !== undefined) updateData.adjustmentValueBase = data.adjustmentValueBase;
    if (data.postedAt !== undefined) updateData.postedAt = data.postedAt;
    if (data.lines !== undefined) {
      updateData.lines = {
        deleteMany: {},
        create: data.lines.map((line: any) => ({
          id: `sal_${id}_${line.itemId}`,
          itemId: line.itemId,
          warehouseId,
          qtyBefore: line.currentQty,
          qtyAfter: line.newQty,
          unitCostBase: line.unitCostBase,
          notes: line.unitCostCCY?.toString() || null,
        })),
      };
    }
    await prisma.stockAdjustment.update({
      where: { id, companyId },
      data: updateData,
    });
  }

  async getAdjustment(id: string): Promise<StockAdjustment | null> {
    const record = await this.prisma.stockAdjustment.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async getCompanyAdjustments(companyId: string, opts?: StockAdjustmentListOptions): Promise<StockAdjustment[]> {
    const records = await this.prisma.stockAdjustment.findMany({
      where: { companyId },
      include: { lines: true },
      orderBy: { createdAt: 'asc' },
      take: opts?.limit,
      skip: opts?.offset,
    });
    return records.map((r) => this.toDomain(r));
  }

  async getByStatus(companyId: string, status: StockAdjustmentStatus, opts?: StockAdjustmentListOptions): Promise<StockAdjustment[]> {
    const records = await this.prisma.stockAdjustment.findMany({
      where: { companyId, status: status as any },
      include: { lines: true },
      orderBy: { createdAt: 'asc' },
      take: opts?.limit,
      skip: opts?.offset,
    });
    return records.map((r) => this.toDomain(r));
  }

  async deleteAdjustment(id: string): Promise<void> {
    await this.prisma.stockAdjustment.delete({
      where: { id },
    });
  }

  private toDomain(record: any): StockAdjustment {
    const warehouseId = record.lines?.[0]?.warehouseId || (record as any).warehouseId || '';
    const lines = (record.lines || []).map((line: any) => ({
      itemId: line.itemId,
      currentQty: line.qtyBefore,
      newQty: line.qtyAfter,
      adjustmentQty: line.qtyAfter - line.qtyBefore,
      unitCostBase: line.unitCostBase || 0,
      unitCostCCY: line.notes ? parseFloat(line.notes) : 0,
    }));

    return StockAdjustment.fromJSON({
      id: record.id,
      companyId: record.companyId,
      warehouseId,
      date: record.date instanceof Date ? record.date.toISOString().split('T')[0] : String(record.date).split('T')[0],
      reason: record.reason,
      notes: record.notes,
      lines,
      status: record.status,
      voucherId: (record as any).voucherId,
      adjustmentValueBase: (record as any).adjustmentValueBase ?? 0,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      postedAt: (record as any).postedAt,
    });
  }
}

const adjustmentWarehouseIdFallback = '';
