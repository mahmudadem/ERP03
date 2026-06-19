import { PrismaClient } from '@prisma/client';
import {
  IInventoryRevaluationRepository,
  InventoryRevaluationListOptions,
} from '../../../../repository/interfaces/inventory/IInventoryRevaluationRepository';
import {
  InventoryRevaluation,
  InventoryRevaluationStatus,
} from '../../../../domain/inventory/entities/InventoryRevaluation';

export class PrismaInventoryRevaluationRepository implements IInventoryRevaluationRepository {
  constructor(private prisma: PrismaClient) {}

  async createRevaluation(revaluation: InventoryRevaluation, transaction?: unknown): Promise<void> {
    const prisma = (transaction as any) || this.prisma;
    await prisma.inventoryRevaluation.create({
      data: {
        id: revaluation.id,
        companyId: revaluation.companyId,
        documentNo: revaluation.id,
        date: new Date(revaluation.date),
        reason: revaluation.reason,
        notes: revaluation.notes || null,
        status: revaluation.status,
        voucherId: revaluation.voucherId || null,
        totalValueDeltaBase: revaluation.totalValueDeltaBase,
        totalValueDeltaCCY: revaluation.totalValueDeltaCCY,
        createdBy: revaluation.createdBy,
        createdAt: revaluation.createdAt,
        updatedAt: revaluation.createdAt,
        postedAt: revaluation.postedAt || null,
        lines: {
          create: revaluation.lines.map((line, index) => ({
            id: `rev_${revaluation.id}_${index + 1}`,
            itemId: line.itemId,
            warehouseId: line.warehouseId || null,
            qtyOnHand: line.qtyOnHand,
            currentAvgCostBase: line.currentAvgCostBase,
            currentAvgCostCCY: line.currentAvgCostCCY,
            newAvgCostBase: line.newAvgCostBase,
            newAvgCostCCY: line.newAvgCostCCY,
            valueDeltaBase: line.valueDeltaBase,
            valueDeltaCCY: line.valueDeltaCCY,
            reason: line.reason || null,
          })),
        },
      } as any,
    });
  }

  async updateRevaluation(
    companyId: string,
    id: string,
    data: Partial<InventoryRevaluation>,
    transaction?: unknown
  ): Promise<void> {
    const prisma = (transaction as any) || this.prisma;
    const updateData: any = {};
    if (data.date !== undefined) updateData.date = new Date(data.date);
    if (data.reason !== undefined) updateData.reason = data.reason;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.voucherId !== undefined) updateData.voucherId = data.voucherId;
    if (data.totalValueDeltaBase !== undefined) updateData.totalValueDeltaBase = data.totalValueDeltaBase;
    if (data.totalValueDeltaCCY !== undefined) updateData.totalValueDeltaCCY = data.totalValueDeltaCCY;
    if (data.postedAt !== undefined) updateData.postedAt = data.postedAt;
    if (data.lines !== undefined) {
      updateData.lines = {
        deleteMany: {},
        create: data.lines.map((line: any, index: number) => ({
          id: `rev_${id}_${index + 1}`,
          itemId: line.itemId,
          warehouseId: line.warehouseId || null,
          qtyOnHand: line.qtyOnHand,
          currentAvgCostBase: line.currentAvgCostBase,
          currentAvgCostCCY: line.currentAvgCostCCY,
          newAvgCostBase: line.newAvgCostBase,
          newAvgCostCCY: line.newAvgCostCCY,
          valueDeltaBase: line.valueDeltaBase,
          valueDeltaCCY: line.valueDeltaCCY,
          reason: line.reason || null,
        })),
      };
    }
    await prisma.inventoryRevaluation.update({
      where: { id, companyId },
      data: updateData,
    });
  }

  async getRevaluation(id: string): Promise<InventoryRevaluation | null> {
    const record = await this.prisma.inventoryRevaluation.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async getCompanyRevaluations(
    companyId: string,
    opts?: InventoryRevaluationListOptions
  ): Promise<InventoryRevaluation[]> {
    const records = await this.prisma.inventoryRevaluation.findMany({
      where: { companyId },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
      take: opts?.limit,
      skip: opts?.offset,
    });
    return records.map((r) => this.toDomain(r));
  }

  async getByStatus(
    companyId: string,
    status: InventoryRevaluationStatus,
    opts?: InventoryRevaluationListOptions
  ): Promise<InventoryRevaluation[]> {
    const records = await this.prisma.inventoryRevaluation.findMany({
      where: { companyId, status: status as any },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
      take: opts?.limit,
      skip: opts?.offset,
    });
    return records.map((r) => this.toDomain(r));
  }

  async deleteRevaluation(id: string): Promise<void> {
    await this.prisma.inventoryRevaluation.delete({
      where: { id },
    });
  }

  private toDomain(record: any): InventoryRevaluation {
    const lines = (record.lines || []).map((line: any) => ({
      itemId: line.itemId,
      warehouseId: line.warehouseId || undefined,
      qtyOnHand: line.qtyOnHand ?? 0,
      currentAvgCostBase: line.currentAvgCostBase ?? 0,
      currentAvgCostCCY: line.currentAvgCostCCY ?? 0,
      newAvgCostBase: line.newAvgCostBase ?? 0,
      newAvgCostCCY: line.newAvgCostCCY ?? 0,
      valueDeltaBase: line.valueDeltaBase ?? 0,
      valueDeltaCCY: line.valueDeltaCCY ?? 0,
      reason: line.reason || undefined,
    }));

    return InventoryRevaluation.fromJSON({
      id: record.id,
      companyId: record.companyId,
      date: record.date,
      reason: record.reason,
      notes: record.notes,
      lines,
      status: record.status,
      voucherId: record.voucherId,
      totalValueDeltaBase: record.totalValueDeltaBase ?? 0,
      totalValueDeltaCCY: record.totalValueDeltaCCY ?? 0,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      postedAt: record.postedAt,
    });
  }
}
