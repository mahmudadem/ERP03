import { PrismaClient, Prisma } from '@prisma/client';
import { Quote } from '../../../../domain/sales/entities/Quote';
import {
  IQuoteRepository,
  QuoteListOptions,
} from '../../../../repository/interfaces/sales/IQuoteRepository';

export class PrismaQuoteRepository implements IQuoteRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toDomain(row: any): Quote {
    return Quote.fromJSON({
      ...row,
      lines: row.lines ?? [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async create(quote: Quote, transaction?: unknown): Promise<void> {
    const client = (transaction as Prisma.TransactionClient) ?? this.prisma;
    await (client as any).quote.create({
      data: {
        id: quote.id,
        companyId: quote.companyId,
        quoteNumber: quote.quoteNumber,
        customerId: quote.customerId,
        customerName: quote.customerName,
        salespersonId: quote.salespersonId ?? null,
        status: quote.status,
        version: quote.version,
        originQuoteId: quote.originQuoteId ?? null,
        quoteDate: quote.quoteDate,
        validUntil: quote.validUntil ?? null,
        currency: quote.currency,
        exchangeRate: quote.exchangeRate,
        lines: quote.lines.map((l: any) => ({ ...l })) as any,
        subtotalDoc: quote.subtotalDoc,
        taxTotalDoc: quote.taxTotalDoc,
        grandTotalDoc: quote.grandTotalDoc,
        subtotalBase: quote.subtotalBase,
        taxTotalBase: quote.taxTotalBase,
        grandTotalBase: quote.grandTotalBase,
        notes: quote.notes ?? null,
        convertedToType: quote.convertedToType ?? null,
        convertedToId: quote.convertedToId ?? null,
        createdBy: quote.createdBy,
        createdAt: quote.createdAt,
        updatedAt: quote.updatedAt,
      },
    });
  }

  async update(quote: Quote, transaction?: unknown): Promise<void> {
    const client = (transaction as Prisma.TransactionClient) ?? this.prisma;
    await (client as any).quote.update({
      where: { id: quote.id },
      data: {
        quoteNumber: quote.quoteNumber,
        customerId: quote.customerId,
        customerName: quote.customerName,
        salespersonId: quote.salespersonId ?? null,
        status: quote.status,
        version: quote.version,
        originQuoteId: quote.originQuoteId ?? null,
        quoteDate: quote.quoteDate,
        validUntil: quote.validUntil ?? null,
        currency: quote.currency,
        exchangeRate: quote.exchangeRate,
        lines: quote.lines.map((l: any) => ({ ...l })) as any,
        subtotalDoc: quote.subtotalDoc,
        taxTotalDoc: quote.taxTotalDoc,
        grandTotalDoc: quote.grandTotalDoc,
        subtotalBase: quote.subtotalBase,
        taxTotalBase: quote.taxTotalBase,
        grandTotalBase: quote.grandTotalBase,
        notes: quote.notes ?? null,
        convertedToType: quote.convertedToType ?? null,
        convertedToId: quote.convertedToId ?? null,
        updatedAt: quote.updatedAt,
      },
    });
  }

  async getById(companyId: string, id: string): Promise<Quote | null> {
    const row = await (this.prisma as any).quote.findFirst({
      where: { id, companyId },
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async getByNumber(companyId: string, quoteNumber: string): Promise<Quote | null> {
    const row = await (this.prisma as any).quote.findFirst({
      where: { companyId, quoteNumber },
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async list(companyId: string, opts?: QuoteListOptions): Promise<Quote[]> {
    const where: any = { companyId };
    if (opts?.status) where.status = opts.status;
    if (opts?.customerId) where.customerId = opts.customerId;

    const rows = await (this.prisma as any).quote.findMany({
      where,
      orderBy: { quoteDate: 'desc' },
      skip: opts?.offset,
      take: opts?.limit,
    });
    return rows.map((r: any) => this.toDomain(r));
  }

  async delete(companyId: string, id: string): Promise<void> {
    await (this.prisma as any).quote.deleteMany({
      where: { id, companyId },
    });
  }
}
