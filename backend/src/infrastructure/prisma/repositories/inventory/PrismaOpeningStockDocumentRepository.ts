import { PrismaClient } from '@prisma/client';
import { IOpeningStockDocumentRepository, OpeningStockDocumentListOptions } from '../../../../repository/interfaces/inventory/IOpeningStockDocumentRepository';
import { OpeningStockDocument, OpeningStockDocumentStatus } from '../../../../domain/inventory/entities/OpeningStockDocument';

export class PrismaOpeningStockDocumentRepository implements IOpeningStockDocumentRepository {
  constructor(private prisma: PrismaClient) {}

  async createDocument(document: OpeningStockDocument, transaction?: unknown): Promise<void> {
    const prisma = (transaction as any) || this.prisma;
    await prisma.openingStockDocument.create({
      data: {
        id: document.id,
        companyId: document.companyId,
        documentNo: document.id,
        date: new Date(document.date),
        status: document.status,
        notes: document.notes || null,
        createdBy: document.createdBy,
        lines: {
          create: document.lines.map((line) => ({
            id: line.lineId,
            itemId: line.itemId,
            warehouseId: document.warehouseId,
            quantity: line.quantity,
            unitCostBase: line.unitCostBase,
            totalCostBase: line.totalValueBase,
            currency: line.moveCurrency,
            notes: `${line.unitCostInMoveCurrency}|${line.fxRateMovToBase}|${line.fxRateCCYToBase}`,
          })),
        },
      } as any,
    });
  }

  async updateDocument(
    companyId: string,
    id: string,
    data: Partial<OpeningStockDocument>,
    transaction?: unknown
  ): Promise<void> {
    const prisma = (transaction as any) || this.prisma;
    const existing = await prisma.openingStockDocument.findUnique({
      where: { id, companyId },
      include: { lines: true },
    });
    const warehouseId = data.warehouseId || existing?.lines?.[0]?.warehouseId || '';
    const updateData: any = {};
    if (data.warehouseId !== undefined) updateData.warehouseId = data.warehouseId;
    if (data.date !== undefined) updateData.date = new Date(data.date);
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.createAccountingEffect !== undefined) updateData.createAccountingEffect = data.createAccountingEffect;
    if (data.openingBalanceAccountId !== undefined) updateData.openingBalanceAccountId = data.openingBalanceAccountId;
    if (data.voucherId !== undefined) updateData.voucherId = data.voucherId;
    if (data.totalValueBase !== undefined) updateData.totalValueBase = data.totalValueBase;
    if (data.postedAt !== undefined) updateData.postedAt = data.postedAt;
    if (data.lines !== undefined) {
      updateData.lines = {
        deleteMany: {},
        create: data.lines.map((line: any) => ({
          id: line.lineId,
          itemId: line.itemId,
          warehouseId,
          quantity: line.quantity,
          unitCostBase: line.unitCostBase,
          totalCostBase: line.totalValueBase,
          currency: line.moveCurrency,
          notes: `${line.unitCostInMoveCurrency}|${line.fxRateMovToBase}|${line.fxRateCCYToBase}`,
        })),
      };
    }
    await prisma.openingStockDocument.update({
      where: { id, companyId },
      data: updateData,
    });
  }

  async getDocument(id: string): Promise<OpeningStockDocument | null> {
    const record = await this.prisma.openingStockDocument.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async getCompanyDocuments(
    companyId: string,
    opts?: OpeningStockDocumentListOptions
  ): Promise<OpeningStockDocument[]> {
    const records = await this.prisma.openingStockDocument.findMany({
      where: { companyId },
      include: { lines: true },
      orderBy: { createdAt: 'asc' },
      take: opts?.limit,
      skip: opts?.offset,
    });
    return records.map((r) => this.toDomain(r));
  }

  async getByStatus(
    companyId: string,
    status: OpeningStockDocumentStatus,
    opts?: OpeningStockDocumentListOptions
  ): Promise<OpeningStockDocument[]> {
    const records = await this.prisma.openingStockDocument.findMany({
      where: { companyId, status: status as any },
      include: { lines: true },
      orderBy: { createdAt: 'asc' },
      take: opts?.limit,
      skip: opts?.offset,
    });
    return records.map((r) => this.toDomain(r));
  }

  async deleteDocument(id: string): Promise<void> {
    await this.prisma.openingStockDocument.delete({
      where: { id },
    });
  }

  private toDomain(record: any): OpeningStockDocument {
    const lines = (record.lines || []).map((line: any) => {
      const costParts = (line.notes || '0|1|1').split('|');
      return {
        lineId: line.id,
        itemId: line.itemId,
        quantity: line.quantity,
        unitCostInMoveCurrency: parseFloat(costParts[0]) || 0,
        moveCurrency: line.currency,
        fxRateMovToBase: parseFloat(costParts[1]) || 1,
        fxRateCCYToBase: parseFloat(costParts[2]) || 1,
        unitCostBase: line.unitCostBase,
        totalValueBase: line.totalCostBase,
      };
    });

    return OpeningStockDocument.fromJSON({
      id: record.id,
      companyId: record.companyId,
      warehouseId: record.lines?.[0]?.warehouseId || (record as any).warehouseId || '',
      date: record.date instanceof Date ? record.date.toISOString().split('T')[0] : String(record.date).split('T')[0],
      notes: record.notes,
      lines,
      status: record.status,
      createAccountingEffect: (record as any).createAccountingEffect ?? false,
      openingBalanceAccountId: (record as any).openingBalanceAccountId,
      voucherId: (record as any).voucherId,
      totalValueBase: (record as any).totalValueBase ?? 0,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      postedAt: (record as any).postedAt,
    });
  }
}
