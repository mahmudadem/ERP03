import { PrismaClient } from '@prisma/client';
import { IFiscalYearRepository } from '../../../../repository/interfaces/accounting/IFiscalYearRepository';
import { FiscalYear, FiscalYearStatus, PeriodScheme, FiscalPeriod, PeriodStatus } from '../../../../domain/accounting/entities/FiscalYear';

export class PrismaFiscalYearRepository implements IFiscalYearRepository {
  constructor(private prisma: PrismaClient) {}

  async findByCompany(companyId: string): Promise<FiscalYear[]> {
    const records = await this.prisma.fiscalYear.findMany({
      where: { companyId },
      orderBy: { startDate: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findById(companyId: string, id: string): Promise<FiscalYear | null> {
    const record = await this.prisma.fiscalYear.findFirst({
      where: { id, companyId },
    });
    return record ? this.toDomain(record) : null;
  }

  async findActiveForDate(companyId: string, date: string): Promise<FiscalYear | null> {
    const targetDate = new Date(date);
    const records = await this.prisma.fiscalYear.findMany({
      where: {
        companyId,
        status: 'OPEN',
        startDate: { lte: targetDate },
        endDate: { gte: targetDate },
      },
    });
    if (records.length === 0) return null;
    return this.toDomain(records[0]);
  }

  async save(fiscalYear: FiscalYear): Promise<void> {
    await this.prisma.fiscalYear.create({
      data: {
        id: fiscalYear.id,
        companyId: fiscalYear.companyId,
        name: fiscalYear.name,
        startDate: new Date(fiscalYear.startDate),
        endDate: new Date(fiscalYear.endDate),
        status: fiscalYear.status,
        isLocked: fiscalYear.status === FiscalYearStatus.LOCKED,
        createdAt: fiscalYear.createdAt ?? new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async update(fiscalYear: FiscalYear): Promise<void> {
    await this.prisma.fiscalYear.update({
      where: { id: fiscalYear.id },
      data: {
        name: fiscalYear.name,
        startDate: new Date(fiscalYear.startDate),
        endDate: new Date(fiscalYear.endDate),
        status: fiscalYear.status,
        isLocked: fiscalYear.status === FiscalYearStatus.LOCKED,
        updatedAt: new Date(),
      },
    });
  }

  async delete(companyId: string, id: string): Promise<void> {
    await this.prisma.fiscalYear.delete({
      where: { id, companyId },
    });
  }

  private toDomain(record: any): FiscalYear {
    const periods: FiscalPeriod[] = (record.periods as any[]) ?? [];
    return new FiscalYear(
      record.id,
      record.companyId,
      record.name,
      this.formatDate(record.startDate),
      this.formatDate(record.endDate),
      (record.status as FiscalYearStatus) ?? FiscalYearStatus.OPEN,
      periods,
      record.closingVoucherId ?? undefined,
      record.createdAt,
      record.createdBy ?? '',
      (record.periodScheme as PeriodScheme) ?? PeriodScheme.MONTHLY,
      record.specialPeriodsCount ?? 0
    );
  }

  private formatDate(date: Date | string): string {
    if (typeof date === 'string') return date;
    return date.toISOString().split('T')[0];
  }
}
