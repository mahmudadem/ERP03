import { PrismaClient, Prisma } from '@prisma/client';
import { CommissionEntry } from '../../../../domain/sales/entities/CommissionEntry';
import {
  ICommissionEntryRepository,
  CommissionEntryListOptions,
} from '../../../../repository/interfaces/sales/ICommissionEntryRepository';

export class PrismaCommissionEntryRepository implements ICommissionEntryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toDomain(row: any): CommissionEntry {
    return new CommissionEntry({
      id: row.id,
      companyId: row.companyId,
      salespersonId: row.salespersonId,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      sourceNumber: row.sourceNumber,
      customerId: row.customerId,
      customerName: row.customerName,
      invoiceDate: row.invoiceDate,
      baseAmount: row.baseAmount,
      commissionPct: row.commissionPct,
      currency: row.currency,
      status: row.status as 'ACCRUED' | 'PAID' | 'CANCELLED',
      accruedAt: row.accruedAt,
      paidAt: row.paidAt ?? undefined,
      paymentReference: row.paymentReference ?? undefined,
      notes: row.notes ?? undefined,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async create(entry: CommissionEntry, transaction?: unknown): Promise<void> {
    const client = (transaction as Prisma.TransactionClient) ?? this.prisma;
    await client.commissionEntry.create({
      data: {
        id: entry.id,
        companyId: entry.companyId,
        salespersonId: entry.salespersonId,
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        sourceNumber: entry.sourceNumber,
        customerId: entry.customerId,
        customerName: entry.customerName,
        invoiceDate: entry.invoiceDate,
        baseAmount: entry.baseAmount,
        commissionPct: entry.commissionPct,
        commissionAmountBase: entry.commissionAmountBase,
        currency: entry.currency,
        status: entry.status,
        accruedAt: entry.accruedAt,
        paidAt: entry.paidAt ?? null,
        paymentReference: entry.paymentReference ?? null,
        notes: entry.notes ?? null,
        createdBy: entry.createdBy,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      },
    });
  }

  async update(entry: CommissionEntry, transaction?: unknown): Promise<void> {
    const client = (transaction as Prisma.TransactionClient) ?? this.prisma;
    await client.commissionEntry.update({
      where: { id: entry.id },
      data: {
        salespersonId: entry.salespersonId,
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        sourceNumber: entry.sourceNumber,
        customerId: entry.customerId,
        customerName: entry.customerName,
        invoiceDate: entry.invoiceDate,
        baseAmount: entry.baseAmount,
        commissionPct: entry.commissionPct,
        commissionAmountBase: entry.commissionAmountBase,
        currency: entry.currency,
        status: entry.status,
        accruedAt: entry.accruedAt,
        paidAt: entry.paidAt ?? null,
        paymentReference: entry.paymentReference ?? null,
        notes: entry.notes ?? null,
        updatedAt: entry.updatedAt,
      },
    });
  }

  async getById(companyId: string, id: string): Promise<CommissionEntry | null> {
    const row = await this.prisma.commissionEntry.findFirst({
      where: { id, companyId },
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async list(companyId: string, opts?: CommissionEntryListOptions): Promise<CommissionEntry[]> {
    const where: any = { companyId };
    if (opts?.salespersonId) where.salespersonId = opts.salespersonId;
    if (opts?.status) where.status = opts.status;
    if (opts?.sourceId) where.sourceId = opts.sourceId;
    if (opts?.fromDate || opts?.toDate) {
      where.invoiceDate = {};
      if (opts.fromDate) where.invoiceDate.gte = opts.fromDate;
      if (opts.toDate) where.invoiceDate.lte = opts.toDate;
    }

    const rows = await (this.prisma).commissionEntry.findMany({
      where,
      orderBy: { invoiceDate: 'desc' },
      skip: opts?.offset,
      take: opts?.limit,
    });
    return rows.map((r: any) => this.toDomain(r));
  }

  async findBySource(
    companyId: string,
    sourceType: string,
    sourceId: string
  ): Promise<CommissionEntry | null> {
    const row = await (this.prisma).commissionEntry.findFirst({
      where: { companyId, sourceType, sourceId },
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async totalsBySalesperson(
    companyId: string,
    salespersonId: string
  ): Promise<{ accrued: number; paid: number; cancelled: number }> {
    const rows = await (this.prisma).commissionEntry.findMany({
      where: { companyId, salespersonId },
      select: { status: true, commissionAmountBase: true },
    });

    let accrued = 0;
    let paid = 0;
    let cancelled = 0;

    for (const row of rows) {
      const amount: number = row.commissionAmountBase ?? 0;
      if (row.status === 'ACCRUED') accrued += amount;
      else if (row.status === 'PAID') paid += amount;
      else if (row.status === 'CANCELLED') cancelled += amount;
    }

    return {
      accrued: Math.round((accrued + Number.EPSILON) * 100) / 100,
      paid: Math.round((paid + Number.EPSILON) * 100) / 100,
      cancelled: Math.round((cancelled + Number.EPSILON) * 100) / 100,
    };
  }
}
