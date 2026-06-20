import { PrismaClient, Prisma } from '@prisma/client';
import { PosPayment } from '../../../../domain/pos/entities/PosPayment';
import { IPosPaymentRepository } from '../../../../repository/interfaces/pos/IPosPaymentRepository';

export class PrismaPosPaymentRepository implements IPosPaymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(payment: PosPayment, tx?: unknown): Promise<void> {
    const client = (tx as Prisma.TransactionClient) || this.prisma;
    await client.posPayment.create({
      data: {
        id: payment.id,
        companyId: payment.companyId,
        receiptId: payment.receiptId,
        method: payment.method,
        amount: payment.amount,
        changeGiven: payment.changeGiven,
        reference: payment.reference || null,
        createdAt: payment.createdAt,
      },
    });
  }

  async listByReceipt(companyId: string, receiptId: string): Promise<PosPayment[]> {
    const records = await this.prisma.posPayment.findMany({ where: { companyId, receiptId } });
    return records.map((r) => PosPayment.fromJSON({
      id: r.id,
      companyId: r.companyId,
      receiptId: r.receiptId,
      method: r.method,
      amount: Number(r.amount),
      changeGiven: Number(r.changeGiven),
      reference: r.reference || undefined,
      createdAt: r.createdAt,
    }));
  }
}
