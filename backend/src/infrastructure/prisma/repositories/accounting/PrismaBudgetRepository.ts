import { PrismaClient } from '@prisma/client';
import { IBudgetRepository } from '../../../../repository/interfaces/accounting/IBudgetRepository';
import { Budget, BudgetStatus, BudgetLine } from '../../../../domain/accounting/entities/Budget';

export class PrismaBudgetRepository implements IBudgetRepository {
  constructor(private prisma: PrismaClient) {}

  async create(budget: Budget): Promise<Budget> {
    const record = await this.prisma.budget.create({
      data: {
        id: budget.id,
        companyId: budget.companyId,
        fiscalYearId: budget.fiscalYearId,
        name: budget.name,
        version: budget.version,
        lines: budget.lines as any,
        status: budget.status,
        createdBy: budget.createdBy,
        createdAt: budget.createdAt,
        updatedAt: budget.updatedAt ?? new Date(),
      } as any,
    });
    return this.toDomain(record);
  }

  async update(budget: Budget): Promise<Budget> {
    const record = await this.prisma.budget.update({
      where: { id: budget.id },
      data: {
        name: budget.name,
        version: budget.version,
        lines: budget.lines as any,
        status: budget.status,
        updatedBy: budget.updatedBy,
        updatedAt: budget.updatedAt ?? new Date(),
      } as any,
    });
    return this.toDomain(record);
  }

  async findById(companyId: string, id: string): Promise<Budget | null> {
    const record = await this.prisma.budget.findFirst({
      where: { id, companyId },
    });
    return record ? this.toDomain(record) : null;
  }

  async list(companyId: string, fiscalYearId?: string): Promise<Budget[]> {
    const where: any = { companyId };
    if (fiscalYearId) {
      where.fiscalYearId = fiscalYearId;
    }
    const records = await this.prisma.budget.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async setStatus(companyId: string, id: string, status: BudgetStatus): Promise<void> {
    await this.prisma.budget.update({
      where: { id, companyId },
      data: { status } as any,
    });
  }

  private toDomain(record: any): Budget {
    const lines: BudgetLine[] = (record.lines as any[]) ?? [];
    return new Budget(
      record.id,
      record.companyId,
      record.fiscalYearId,
      record.name ?? '',
      record.version ?? 1,
      (record.status as BudgetStatus) ?? 'DRAFT',
      lines,
      record.createdAt,
      record.createdBy ?? '',
      record.updatedAt ?? undefined,
      record.updatedBy ?? undefined
    );
  }
}
