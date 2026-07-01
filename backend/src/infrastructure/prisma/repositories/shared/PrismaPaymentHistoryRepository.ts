import { Prisma, PrismaClient } from '@prisma/client';
import { PaymentHistory, PaymentMethod, PaymentSourceType } from '../../../../domain/shared/entities/PaymentHistory';
import { IPaymentHistoryRepository } from '../../../../repository/interfaces/shared/IPaymentHistoryRepository';

export class PrismaPaymentHistoryRepository implements IPaymentHistoryRepository {
  constructor(private prisma: PrismaClient) {}

  async create(payment: PaymentHistory, transaction?: unknown): Promise<void> {
    const prisma = (transaction as Prisma.TransactionClient) || this.prisma;
    await prisma.paymentHistory.create({
      data: {
        id: payment.id,
        companyId: payment.companyId,
        sourceType: payment.sourceType,
        sourceId: payment.sourceId,
        sourceNumber: payment.sourceNumber,
        amountBase: payment.amountBase,
        currency: payment.currency,
        exchangeRate: payment.exchangeRate,
        amountDoc: payment.amountDoc,
        paymentDate: payment.paymentDate,
        paymentMethod: payment.paymentMethod,
        reference: payment.reference,
        notes: payment.notes,
        voucherId: payment.voucherId,
        createdBy: payment.createdBy,
        createdAt: payment.createdAt,
      },
    });
  }

  async getById(companyId: string, id: string): Promise<PaymentHistory | null> {
    const record = await this.prisma.paymentHistory.findFirst({
      where: { id, companyId },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async getBySource(companyId: string, sourceType: PaymentSourceType, sourceId: string): Promise<PaymentHistory[]> {
    const records = await this.prisma.paymentHistory.findMany({
      where: { companyId, sourceType, sourceId },
      orderBy: { paymentDate: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  private toDomain(record: Record<string, unknown>): PaymentHistory {
    return PaymentHistory.fromJSON({
      id: record.id as string,
      companyId: record.companyId as string,
      sourceType: record.sourceType as PaymentSourceType,
      sourceId: record.sourceId as string,
      sourceNumber: record.sourceNumber as string,
      amountBase: record.amountBase as number,
      currency: record.currency as string,
      exchangeRate: record.exchangeRate as number,
      amountDoc: record.amountDoc as number,
      paymentDate: record.paymentDate as string,
      paymentMethod: record.paymentMethod as PaymentMethod,
      reference: (record.reference as string) || undefined,
      notes: (record.notes as string) || undefined,
      voucherId: (record.voucherId as string) ?? null,
      createdBy: record.createdBy as string,
      createdAt: record.createdAt as Date,
    });
  }
}
