/**
 * PrismaReconciliationRepository
 *
 * SQL implementation of IReconciliationRepository using Prisma.
 * Handles bank reconciliation storage, retrieval, and updates.
 */

import { PrismaClient } from '@prisma/client';
import { IReconciliationRepository } from '../../../../repository/interfaces/accounting/IReconciliationRepository';
import { Reconciliation, ReconciliationAdjustment, ReconciliationStatus } from '../../../../domain/accounting/entities/Reconciliation';

export class PrismaReconciliationRepository implements IReconciliationRepository {
  constructor(private prisma: PrismaClient) {}

  // =========================================================================
  // MAPPING HELPERS
  // =========================================================================

  private toDomain(record: any): Reconciliation {
    const matchedEntries = (record.matchedEntries as any) ?? {};
    const adjustments: ReconciliationAdjustment[] = matchedEntries.adjustments ?? [];
    const bankStatementId = matchedEntries.bankStatementId ?? '';
    const periodEnd = matchedEntries.periodEnd ?? record.period;
    const bookBalance = matchedEntries.bookBalance ?? 0;
    const bankBalance = matchedEntries.bankBalance ?? 0;

    return new Reconciliation(
      record.id,
      record.companyId,
      record.accountId,
      bankStatementId,
      periodEnd,
      bookBalance,
      bankBalance,
      adjustments,
      (record.status as ReconciliationStatus) ?? 'IN_PROGRESS',
      record.completedAt ? (record.completedAt instanceof Date ? record.completedAt : new Date(record.completedAt)) : undefined,
      record.completedBy ?? undefined
    );
  }

  private buildMatchedEntries(reconciliation: Reconciliation): any {
    return {
      bankStatementId: reconciliation.bankStatementId,
      periodEnd: reconciliation.periodEnd,
      bookBalance: reconciliation.bookBalance,
      bankBalance: reconciliation.bankBalance,
      adjustments: reconciliation.adjustments,
    };
  }

  // =========================================================================
  // IMPLEMENTATION
  // =========================================================================

  async save(reconciliation: Reconciliation): Promise<Reconciliation> {
    const record = await this.prisma.reconciliation.create({
      data: {
        id: reconciliation.id,
        company: { connect: { id: reconciliation.companyId } },
        accountId: reconciliation.accountId,
        period: reconciliation.periodEnd,
        status: reconciliation.status,
        matchedEntries: this.buildMatchedEntries(reconciliation) as any,
        discrepancy: reconciliation.bookBalance - reconciliation.bankBalance,
        notes: null,
        completedAt: reconciliation.completedAt ?? null,
        completedBy: reconciliation.completedBy ?? null,
      } as any,
    });

    return this.toDomain(record);
  }

  async findLatestForAccount(companyId: string, accountId: string): Promise<Reconciliation | null> {
    const record = await this.prisma.reconciliation.findFirst({
      where: { companyId, accountId },
      orderBy: { period: 'desc' },
    });

    return record ? this.toDomain(record) : null;
  }

  async list(companyId: string, accountId?: string): Promise<Reconciliation[]> {
    const where: any = { companyId };
    if (accountId) {
      where.accountId = accountId;
    }

    const records = await this.prisma.reconciliation.findMany({
      where,
      orderBy: { period: 'desc' },
    });

    return records.map((r) => this.toDomain(r));
  }

  async update(reconciliation: Reconciliation): Promise<void> {
    await this.prisma.reconciliation.update({
      where: { id: reconciliation.id },
      data: {
        status: reconciliation.status,
        matchedEntries: this.buildMatchedEntries(reconciliation) as any,
        discrepancy: reconciliation.bookBalance - reconciliation.bankBalance,
        completedAt: reconciliation.completedAt ?? null,
        completedBy: reconciliation.completedBy ?? null,
      } as any,
    });
  }
}
