import { PrismaClient, Prisma } from '@prisma/client';
import { PosReceipt } from '../../../../domain/pos/entities/PosReceipt';
import { IPosReceiptRepository } from '../../../../repository/interfaces/pos/IPosReceiptRepository';

export class PrismaPosReceiptRepository implements IPosReceiptRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(receipt: PosReceipt, tx?: unknown): Promise<void> {
    const client = (tx as Prisma.TransactionClient) || this.prisma;
    await client.posReceipt.create({
      data: {
        id: receipt.id,
        companyId: receipt.companyId,
        shiftId: receipt.shiftId,
        registerId: receipt.registerId,
        receiptNumber: receipt.receiptNumber,
        status: receipt.status,
        customerId: receipt.customerId,
        customerName: receipt.customerName || null,
        lines: receipt.lines as any,
        subtotal: receipt.subtotal,
        discountTotal: receipt.discountTotal,
        taxTotal: receipt.taxTotal,
        grandTotal: receipt.grandTotal,
        salesInvoiceId: receipt.salesInvoiceId || null,
        salesInvoiceNumber: receipt.salesInvoiceNumber || null,
        createdBy: receipt.createdBy,
        createdAt: receipt.createdAt,
      },
    });
  }

  async getById(companyId: string, id: string): Promise<PosReceipt | null> {
    const record = await this.prisma.posReceipt.findFirst({ where: { id, companyId } });
    if (!record) return null;
    return this.toDomain(record);
  }

  async getByNumber(companyId: string, number: string): Promise<PosReceipt | null> {
    const record = await this.prisma.posReceipt.findFirst({ where: { companyId, receiptNumber: number } });
    if (!record) return null;
    return this.toDomain(record);
  }

  async list(
    companyId: string,
    filters?: { shiftId?: string; registerId?: string; customerId?: string; dateFrom?: string; dateTo?: string; limit?: number }
  ): Promise<PosReceipt[]> {
    const records = await this.prisma.posReceipt.findMany({
      where: {
        companyId,
        ...(filters?.shiftId ? { shiftId: filters.shiftId } : {}),
        ...(filters?.registerId ? { registerId: filters.registerId } : {}),
        ...(filters?.customerId ? { customerId: filters.customerId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || undefined,
    });
    return records.map((r) => this.toDomain(r));
  }

  private toDomain(record: any): PosReceipt {
    return PosReceipt.fromJSON({
      id: record.id,
      companyId: record.companyId,
      shiftId: record.shiftId,
      registerId: record.registerId,
      receiptNumber: record.receiptNumber,
      status: record.status,
      customerId: record.customerId,
      customerName: record.customerName || undefined,
      lines: (record.lines as any[]) || [],
      subtotal: Number(record.subtotal),
      discountTotal: Number(record.discountTotal),
      taxTotal: Number(record.taxTotal),
      grandTotal: Number(record.grandTotal),
      salesInvoiceId: record.salesInvoiceId || undefined,
      salesInvoiceNumber: record.salesInvoiceNumber || undefined,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
    });
  }
}
