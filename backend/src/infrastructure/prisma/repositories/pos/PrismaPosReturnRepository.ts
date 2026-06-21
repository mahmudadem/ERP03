import { PrismaClient, Prisma } from '@prisma/client';
import { PosReturn } from '../../../../domain/pos/entities/PosReturn';
import { IPosReturnRepository } from '../../../../repository/interfaces/pos/IPosReturnRepository';

export class PrismaPosReturnRepository implements IPosReturnRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(returnDoc: PosReturn, tx?: unknown): Promise<void> {
    const client = (tx as Prisma.TransactionClient) || this.prisma;
    await client.posReturn.create({
      data: {
        id: returnDoc.id,
        companyId: returnDoc.companyId,
        shiftId: returnDoc.shiftId,
        registerId: returnDoc.registerId,
        returnNumber: returnDoc.returnNumber,
        originalReceiptId: returnDoc.originalReceiptId,
        originalReceiptNumber: returnDoc.originalReceiptNumber,
        salesInvoiceId: returnDoc.salesInvoiceId,
        lines: returnDoc.lines as any,
        refundMethod: returnDoc.refundMethod,
        refundTotal: returnDoc.refundTotal,
        salesReturnId: returnDoc.salesReturnId || null,
        salesReturnNumber: returnDoc.salesReturnNumber || null,
        createdBy: returnDoc.createdBy,
        createdAt: returnDoc.createdAt,
      },
    });
  }

  async getById(companyId: string, id: string): Promise<PosReturn | null> {
    const record = await this.prisma.posReturn.findFirst({ where: { id, companyId } });
    if (!record) return null;
    return this.toDomain(record);
  }

  async list(companyId: string, filters?: { shiftId?: string; originalReceiptId?: string; limit?: number }): Promise<PosReturn[]> {
    const records = await this.prisma.posReturn.findMany({
      where: {
        companyId,
        ...(filters?.shiftId ? { shiftId: filters.shiftId } : {}),
        ...(filters?.originalReceiptId ? { originalReceiptId: filters.originalReceiptId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || undefined,
    });
    return records.map((r) => this.toDomain(r));
  }

  private toDomain(record: any): PosReturn {
    return PosReturn.fromJSON({
      id: record.id,
      companyId: record.companyId,
      shiftId: record.shiftId,
      registerId: record.registerId,
      returnNumber: record.returnNumber,
      originalReceiptId: record.originalReceiptId,
      originalReceiptNumber: record.originalReceiptNumber,
      salesInvoiceId: record.salesInvoiceId,
      lines: (record.lines as any[]) || [],
      refundMethod: record.refundMethod,
      refundTotal: Number(record.refundTotal),
      salesReturnId: record.salesReturnId || undefined,
      salesReturnNumber: record.salesReturnNumber || undefined,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
    });
  }
}
