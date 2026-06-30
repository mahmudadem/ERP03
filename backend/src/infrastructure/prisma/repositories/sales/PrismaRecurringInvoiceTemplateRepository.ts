import { PrismaClient, Prisma } from '@prisma/client';
import { RecurringInvoiceTemplate } from '../../../../domain/sales/entities/RecurringInvoiceTemplate';
import {
  IRecurringInvoiceTemplateRepository,
  RecurringInvoiceTemplateListOptions,
} from '../../../../repository/interfaces/sales/IRecurringInvoiceTemplateRepository';

export class PrismaRecurringInvoiceTemplateRepository
  implements IRecurringInvoiceTemplateRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  private toDomain(row: any): RecurringInvoiceTemplate {
    return RecurringInvoiceTemplate.fromJSON({
      id: row.id,
      companyId: row.companyId,
      name: row.name,
      sourceInvoiceId: row.sourceInvoiceId,
      customerId: row.customerId,
      customerName: row.customerName,
      currency: row.currency,
      exchangeRate: row.exchangeRate,
      lines: row.lines ?? [],
      notes: row.notes,
      paymentTermsDays: row.paymentTermsDays ?? 0,
      frequency: row.frequency,
      dayOfMonth: row.dayOfMonth,
      dayOfWeek: row.dayOfWeek,
      startDate: row.startDate,
      endDate: row.endDate,
      maxOccurrences: row.maxOccurrences,
      occurrencesGenerated: row.occurrencesGenerated ?? 0,
      nextGenerationDate: row.nextGenerationDate,
      status: row.status || 'ACTIVE',
      createdBy: row.createdBy || 'SYSTEM',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
    });
  }

  async create(template: RecurringInvoiceTemplate, transaction?: unknown): Promise<void> {
    const client = (transaction as Prisma.TransactionClient) ?? this.prisma;
    await (client).recurringInvoiceTemplate.create({
      data: {
        id: template.id,
        companyId: template.companyId,
        name: template.name,
        sourceInvoiceId: template.sourceInvoiceId ?? null,
        customerId: template.customerId,
        customerName: template.customerName,
        currency: template.currency,
        exchangeRate: template.exchangeRate,
        lines: template.lines.map((l: any) => ({ ...l })),
        notes: template.notes ?? null,
        paymentTermsDays: template.paymentTermsDays,
        frequency: template.frequency,
        dayOfMonth: template.dayOfMonth ?? null,
        dayOfWeek: template.dayOfWeek ?? null,
        startDate: template.startDate,
        endDate: template.endDate ?? null,
        maxOccurrences: template.maxOccurrences ?? null,
        occurrencesGenerated: template.occurrencesGenerated,
        nextGenerationDate: template.nextGenerationDate,
        status: template.status,
        createdBy: template.createdBy,
        updatedBy: template.updatedBy ?? null,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt ?? new Date(),
      },
    });
  }

  async update(template: RecurringInvoiceTemplate, transaction?: unknown): Promise<void> {
    const client = (transaction as Prisma.TransactionClient) ?? this.prisma;
    await (client).recurringInvoiceTemplate.update({
      where: { id: template.id },
      data: {
        name: template.name,
        sourceInvoiceId: template.sourceInvoiceId ?? null,
        customerId: template.customerId,
        customerName: template.customerName,
        currency: template.currency,
        exchangeRate: template.exchangeRate,
        lines: template.lines.map((l: any) => ({ ...l })),
        notes: template.notes ?? null,
        paymentTermsDays: template.paymentTermsDays,
        frequency: template.frequency,
        dayOfMonth: template.dayOfMonth ?? null,
        dayOfWeek: template.dayOfWeek ?? null,
        startDate: template.startDate,
        endDate: template.endDate ?? null,
        maxOccurrences: template.maxOccurrences ?? null,
        occurrencesGenerated: template.occurrencesGenerated,
        nextGenerationDate: template.nextGenerationDate,
        status: template.status,
        updatedBy: template.updatedBy ?? null,
        updatedAt: template.updatedAt ?? new Date(),
      },
    });
  }

  async findById(companyId: string, id: string): Promise<RecurringInvoiceTemplate | null> {
    const row = await (this.prisma).recurringInvoiceTemplate.findFirst({
      where: { id, companyId },
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async list(
    companyId: string,
    opts?: RecurringInvoiceTemplateListOptions
  ): Promise<RecurringInvoiceTemplate[]> {
    const where: any = { companyId };
    if (opts?.status) where.status = opts.status;
    if (opts?.customerId) where.customerId = opts.customerId;

    const rows = await (this.prisma).recurringInvoiceTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: opts?.offset,
      take: opts?.limit,
    });
    return rows.map((r: any) => this.toDomain(r));
  }

  async listDue(companyId: string, asOfDate: string): Promise<RecurringInvoiceTemplate[]> {
    const rows = await (this.prisma).recurringInvoiceTemplate.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        nextGenerationDate: { lte: asOfDate },
      },
    });
    return rows.map((r: any) => this.toDomain(r));
  }

  async delete(companyId: string, id: string): Promise<void> {
    await (this.prisma).recurringInvoiceTemplate.deleteMany({
      where: { id, companyId },
    });
  }
}
