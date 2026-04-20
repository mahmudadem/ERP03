import { PrismaClient } from '@prisma/client';
import { IStockTransferRepository, StockTransferListOptions } from '../../../../repository/interfaces/inventory/IStockTransferRepository';
import { StockTransfer, StockTransferStatus } from '../../../../domain/inventory/entities/StockTransfer';

export class PrismaStockTransferRepository implements IStockTransferRepository {
  constructor(private prisma: PrismaClient) {}

  async createTransfer(transfer: StockTransfer): Promise<void> {
    await this.prisma.stockTransfer.create({
      data: {
        id: transfer.id,
        companyId: transfer.companyId,
        documentNo: transfer.id,
        fromWarehouseId: transfer.sourceWarehouseId,
        toWarehouseId: transfer.destinationWarehouseId,
        date: new Date(transfer.date),
        status: transfer.status,
        notes: transfer.notes || null,
        createdBy: transfer.createdBy,
        lines: {
          create: transfer.lines.map((line, index) => ({
            id: `stl_${transfer.id}_${line.itemId}_${index}`,
            itemId: line.itemId,
            quantity: line.qty,
            qtyReceived: 0,
            notes: `${line.unitCostBaseAtTransfer}|${line.unitCostCCYAtTransfer}`,
          })),
        },
      } as any,
    });
  }

  async updateTransfer(id: string, data: Partial<StockTransfer>): Promise<void> {
    const existing = await this.prisma.stockTransfer.findUnique({
      where: { id },
      include: { lines: true },
    });
    const updateData: any = {};
    if (data.sourceWarehouseId !== undefined) updateData.fromWarehouseId = data.sourceWarehouseId;
    if (data.destinationWarehouseId !== undefined) updateData.toWarehouseId = data.destinationWarehouseId;
    if (data.date !== undefined) updateData.date = new Date(data.date);
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.transferPairId !== undefined) updateData.transferPairId = data.transferPairId;
    if (data.completedAt !== undefined) updateData.completedAt = data.completedAt;
    if (data.lines !== undefined) {
      updateData.lines = {
        deleteMany: {},
        create: data.lines.map((line: any, index: number) => ({
          id: `stl_${id}_${line.itemId}_${index}`,
          itemId: line.itemId,
          quantity: line.qty,
          qtyReceived: existing?.lines?.[index]?.qtyReceived ?? 0,
          notes: `${line.unitCostBaseAtTransfer}|${line.unitCostCCYAtTransfer}`,
        })),
      };
    }
    await this.prisma.stockTransfer.update({
      where: { id },
      data: updateData,
    });
  }

  async getTransfer(id: string): Promise<StockTransfer | null> {
    const record = await this.prisma.stockTransfer.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async getCompanyTransfers(companyId: string, opts?: StockTransferListOptions): Promise<StockTransfer[]> {
    const records = await this.prisma.stockTransfer.findMany({
      where: { companyId },
      include: { lines: true },
      orderBy: { createdAt: 'asc' },
      take: opts?.limit,
      skip: opts?.offset,
    });
    return records.map((r) => this.toDomain(r));
  }

  async getByStatus(companyId: string, status: StockTransferStatus, opts?: StockTransferListOptions): Promise<StockTransfer[]> {
    const records = await this.prisma.stockTransfer.findMany({
      where: { companyId, status: status as any },
      include: { lines: true },
      orderBy: { createdAt: 'asc' },
      take: opts?.limit,
      skip: opts?.offset,
    });
    return records.map((r) => this.toDomain(r));
  }

  async deleteTransfer(id: string): Promise<void> {
    await this.prisma.stockTransfer.delete({
      where: { id },
    });
  }

  private toDomain(record: any): StockTransfer {
    const lines = (record.lines || []).map((line: any) => {
      const costParts = (line.notes || '0|0').split('|');
      return {
        itemId: line.itemId,
        qty: line.quantity,
        unitCostBaseAtTransfer: parseFloat(costParts[0]) || 0,
        unitCostCCYAtTransfer: parseFloat(costParts[1]) || 0,
      };
    });

    return StockTransfer.fromJSON({
      id: record.id,
      companyId: record.companyId,
      sourceWarehouseId: record.fromWarehouseId,
      destinationWarehouseId: record.toWarehouseId,
      date: record.date instanceof Date ? record.date.toISOString().split('T')[0] : String(record.date).split('T')[0],
      notes: record.notes,
      lines,
      status: record.status,
      transferPairId: (record as any).transferPairId || record.id,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      completedAt: (record as any).completedAt,
    });
  }
}
