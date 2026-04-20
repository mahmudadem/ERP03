import { PrismaClient } from '@prisma/client';
import { IRecurringVoucherTemplateRepository } from '../../../../repository/interfaces/accounting/IRecurringVoucherTemplateRepository';
import { RecurringVoucherTemplate, RecurrenceFrequency, RecurringStatus } from '../../../../domain/accounting/entities/RecurringVoucherTemplate';

export class PrismaRecurringVoucherTemplateRepository implements IRecurringVoucherTemplateRepository {
  constructor(private prisma: PrismaClient) {}

  async create(template: RecurringVoucherTemplate): Promise<RecurringVoucherTemplate> {
    const record = await this.prisma.recurringVoucherTemplate.create({
      data: {
        id: template.id,
        companyId: template.companyId,
        name: template.name,
        schedule: {
          frequency: template.frequency,
          dayOfMonth: template.dayOfMonth,
          startDate: template.startDate,
          endDate: template.endDate,
          maxOccurrences: template.maxOccurrences,
        } as any,
        voucherData: {
          sourceVoucherId: template.sourceVoucherId,
        } as any,
        isActive: template.status === 'ACTIVE',
        nextRunAt: new Date(template.nextGenerationDate),
        createdAt: template.createdAt,
        updatedAt: template.updatedAt ?? new Date(),
      },
    });
    return this.toDomain(record);
  }

  async update(template: RecurringVoucherTemplate): Promise<RecurringVoucherTemplate> {
    const record = await this.prisma.recurringVoucherTemplate.update({
      where: { id: template.id },
      data: {
        name: template.name,
        schedule: {
          frequency: template.frequency,
          dayOfMonth: template.dayOfMonth,
          startDate: template.startDate,
          endDate: template.endDate,
          maxOccurrences: template.maxOccurrences,
        } as any,
        voucherData: {
          sourceVoucherId: template.sourceVoucherId,
        } as any,
        isActive: template.status === 'ACTIVE',
        nextRunAt: new Date(template.nextGenerationDate),
        updatedAt: template.updatedAt ?? new Date(),
      },
    });
    return this.toDomain(record);
  }

  async list(companyId: string): Promise<RecurringVoucherTemplate[]> {
    const records = await this.prisma.recurringVoucherTemplate.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findById(companyId: string, id: string): Promise<RecurringVoucherTemplate | null> {
    const record = await this.prisma.recurringVoucherTemplate.findFirst({
      where: { id, companyId },
    });
    return record ? this.toDomain(record) : null;
  }

  async listDue(companyId: string, asOfDate: string): Promise<RecurringVoucherTemplate[]> {
    const asOf = new Date(asOfDate);
    const records = await this.prisma.recurringVoucherTemplate.findMany({
      where: {
        companyId,
        isActive: true,
        nextRunAt: { lte: asOf },
      },
      orderBy: { nextRunAt: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  private toDomain(record: any): RecurringVoucherTemplate {
    const schedule = (record.schedule as any) ?? {};
    const voucherData = (record.voucherData as any) ?? {};
    const status: RecurringStatus = record.isActive ? 'ACTIVE' : 'PAUSED';

    return new RecurringVoucherTemplate(
      record.id,
      record.companyId,
      record.name,
      voucherData.sourceVoucherId ?? '',
      (schedule.frequency as RecurrenceFrequency) ?? 'MONTHLY',
      schedule.dayOfMonth ?? 1,
      schedule.startDate ?? record.createdAt.toISOString().split('T')[0],
      schedule.endDate ?? undefined,
      schedule.maxOccurrences ?? undefined,
      record.occurrencesGenerated ?? 0,
      record.nextRunAt
        ? record.nextRunAt.toISOString().split('T')[0]
        : record.createdAt.toISOString().split('T')[0],
      status,
      record.createdBy ?? '',
      record.createdAt,
      record.updatedAt ?? undefined,
      record.updatedBy ?? undefined
    );
  }
}
