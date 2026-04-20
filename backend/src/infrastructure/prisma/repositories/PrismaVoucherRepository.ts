/**
 * PrismaVoucherRepository
 *
 * SQL implementation of IVoucherRepository using Prisma.
 * Maps VoucherEntity (with embedded lines) to Voucher + VoucherLine tables.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { VoucherLineEntity } from '../../../domain/accounting/entities/VoucherLineEntity';
import { VoucherType, VoucherStatus, PostingLockPolicy } from '../../../domain/accounting/types/VoucherTypes';

export class PrismaVoucherRepository implements IVoucherRepository {
  constructor(private prisma: PrismaClient) {}

  // =========================================================================
  // MAPPING HELPERS
  // =========================================================================

  private toDomain(data: any): VoucherEntity {
    const lines = (data.lines || []).map((line: any, index: number) => {
      return new VoucherLineEntity(
        line.lineNo ?? index + 1,
        line.accountId,
        line.side as 'Debit' | 'Credit',
        line.baseAmount,
        data.baseCurrency,
        line.amount,
        line.currency,
        line.exchangeRate,
        line.description,
        line.costCenterId,
        line.metadata || {}
      );
    });

    const metadata = (data.metadata as Record<string, any>) || {};

    return new VoucherEntity(
      data.id,
      data.companyId,
      data.voucherNo || '',
      data.type as VoucherType,
      data.date instanceof Date ? data.date.toISOString().split('T')[0] : String(data.date).split('T')[0],
      data.description || '',
      data.currency,
      data.baseCurrency,
      data.exchangeRate,
      lines,
      data.totalDebit,
      data.totalCredit,
      data.status as VoucherStatus,
      metadata,
      data.createdBy,
      data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt),
      data.approvedBy || undefined,
      data.approvedAt ? (data.approvedAt instanceof Date ? data.approvedAt : new Date(data.approvedAt)) : undefined,
      data.rejectedBy || undefined,
      data.rejectedAt ? (data.rejectedAt instanceof Date ? data.rejectedAt : new Date(data.rejectedAt)) : undefined,
      data.rejectionReason || undefined,
      data.lockedBy || undefined,
      data.lockedAt ? (data.lockedAt instanceof Date ? data.lockedAt : new Date(data.lockedAt)) : undefined,
      data.postedBy || undefined,
      data.postedAt ? (data.postedAt instanceof Date ? data.postedAt : new Date(data.postedAt)) : undefined,
      data.postingLockPolicy as PostingLockPolicy | undefined,
      data.reversalOfVoucherId || metadata.reversalOfVoucherId || null,
      data.reference || null,
      data.updatedAt ? (data.updatedAt instanceof Date ? data.updatedAt : new Date(data.updatedAt)) : null,
      data.postingPeriodNo || null,
      data.sourcePayload || null,
      data.formData || null
    );
  }

  private buildCreateInput(companyId: string, voucher: VoucherEntity): Prisma.VoucherCreateInput {
    const linesInput: Prisma.VoucherLineCreateNestedManyWithoutVoucherInput = {
      create: voucher.lines.map((line, index) => ({
        id: `${voucher.id}-line-${index + 1}`,
        accountId: line.accountId,
        description: line.notes || null,
        side: line.side,
        amount: line.amount,
        baseAmount: line.baseAmount,
        currency: line.currency,
        baseCurrency: line.baseCurrency,
        exchangeRate: line.exchangeRate,
        costCenterId: line.costCenterId || null,
        metadata: line.metadata || {},
        lineNo: index + 1
      }))
    };

    const dateValue = typeof voucher.date === 'string' ? new Date(voucher.date) : voucher.date;

    return {
      id: voucher.id,
      company: { connect: { id: companyId } },
      type: voucher.type,
      voucherNo: voucher.voucherNo || null,
      date: dateValue,
      currency: voucher.currency,
      baseCurrency: voucher.baseCurrency,
      exchangeRate: voucher.exchangeRate,
      status: voucher.status,
      totalDebit: voucher.totalDebit,
      totalCredit: voucher.totalCredit,
      createdBy: voucher.createdBy,
      approvedBy: voucher.approvedBy || null,
      lockedBy: voucher.lockedBy || null,
      reference: voucher.reference || null,
      description: voucher.description || null,
      postingPeriodNo: voucher.postingPeriodNo || null,
      metadata: {
        ...voucher.metadata,
        reversalOfVoucherId: voucher.reversalOfVoucherId || null,
        postingLockPolicy: voucher.postingLockPolicy || null,
        sourcePayload: voucher.sourcePayload || null,
        formData: voucher.formData || null
      } as any,
      lines: linesInput
    };
  }

  private buildUpdateInput(voucher: VoucherEntity): Prisma.VoucherUpdateInput {
    const dateValue = typeof voucher.date === 'string' ? new Date(voucher.date) : voucher.date;

    return {
      voucherNo: voucher.voucherNo || null,
      date: dateValue,
      currency: voucher.currency,
      baseCurrency: voucher.baseCurrency,
      exchangeRate: voucher.exchangeRate,
      status: voucher.status,
      totalDebit: voucher.totalDebit,
      totalCredit: voucher.totalCredit,
      approvedBy: voucher.approvedBy || null,
      lockedBy: voucher.lockedBy || null,
      reference: voucher.reference || null,
      description: voucher.description || null,
      postingPeriodNo: voucher.postingPeriodNo || null,
      metadata: {
        ...voucher.metadata,
        reversalOfVoucherId: voucher.reversalOfVoucherId || null,
        postingLockPolicy: voucher.postingLockPolicy || null,
        sourcePayload: voucher.sourcePayload || null,
        formData: voucher.formData || null
      } as any,
      lines: {
        deleteMany: {},
        create: voucher.lines.map((line, index) => ({
          id: `${voucher.id}-line-${index + 1}`,
          accountId: line.accountId,
          description: line.notes || null,
          side: line.side,
          amount: line.amount,
          baseAmount: line.baseAmount,
          currency: line.currency,
          baseCurrency: line.baseCurrency,
          exchangeRate: line.exchangeRate,
          costCenterId: line.costCenterId || null,
          metadata: line.metadata || {},
          lineNo: index + 1
        }))
      }
    };
  }

  // =========================================================================
  // QUERY METHODS
  // =========================================================================

  async findById(companyId: string, voucherId: string): Promise<VoucherEntity | null> {
    const data = await this.prisma.voucher.findFirst({
      where: { id: voucherId, companyId },
      include: { lines: { orderBy: { lineNo: 'asc' } } }
    });

    if (!data) return null;
    return this.toDomain(data);
  }

  async findByType(companyId: string, type: VoucherType, limit?: number): Promise<VoucherEntity[]> {
    const data = await this.prisma.voucher.findMany({
      where: { companyId, type },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
      orderBy: { date: 'desc' },
      take: limit || 100
    });

    return data.map(d => this.toDomain(d));
  }

  async findByStatus(companyId: string, status: VoucherStatus, limit?: number): Promise<VoucherEntity[]> {
    const data = await this.prisma.voucher.findMany({
      where: { companyId, status },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
      orderBy: { date: 'desc' },
      take: limit || 100
    });

    return data.map(d => this.toDomain(d));
  }

  async findByDateRange(companyId: string, startDate: string, endDate: string, limit?: number): Promise<VoucherEntity[]> {
    const data = await this.prisma.voucher.findMany({
      where: {
        companyId,
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
      orderBy: { date: 'desc' },
      take: limit || 100
    });

    return data.map(d => this.toDomain(d));
  }

  async findByCompany(
    companyId: string,
    limit?: number,
    filters?: { from?: string; to?: string; type?: string; status?: string; search?: string; formId?: string },
    offset?: number
  ): Promise<VoucherEntity[]> {
    const where: Prisma.VoucherWhereInput = { companyId };

    if (filters?.from && filters?.to) {
      where.date = {
        gte: new Date(filters.from),
        lte: new Date(filters.to)
      };
    }
    if (filters?.type) {
      where.type = filters.type as VoucherType;
    }
    if (filters?.status) {
      where.status = filters.status as VoucherStatus;
    }
    if (filters?.search) {
      where.OR = [
        { voucherNo: { contains: filters.search } },
        { description: { contains: filters.search } },
        { reference: { contains: filters.search } }
      ];
    }
    if (filters?.formId) {
      where.metadata = { path: ['formId'], equals: filters.formId } as any;
    }

    const data = await this.prisma.voucher.findMany({
      where,
      include: { lines: { orderBy: { lineNo: 'asc' } } },
      orderBy: { date: 'desc' },
      take: limit || 50,
      skip: offset || 0
    });

    return data.map(d => this.toDomain(d));
  }

  async findByReversalOfVoucherId(companyId: string, originalVoucherId: string): Promise<VoucherEntity | null> {
    const data = await this.prisma.voucher.findFirst({
      where: {
        companyId,
        OR: [
          { reversalOfVoucherId: originalVoucherId },
          { metadata: { path: ['reversalOfVoucherId'], equals: originalVoucherId } } as any
        ]
      },
      include: { lines: { orderBy: { lineNo: 'asc' } } }
    });

    if (!data) return null;
    return this.toDomain(data);
  }

  async findPendingFinancialApprovals(companyId: string, limit?: number): Promise<VoucherEntity[]> {
    const data = await this.prisma.voucher.findMany({
      where: {
        companyId,
        status: VoucherStatus.PENDING,
        metadata: { path: ['pendingFinancialApproval'], equals: true }
      } as any,
      include: { lines: { orderBy: { lineNo: 'asc' } } },
      orderBy: { createdAt: 'asc' },
      take: limit || 50
    });

    return data.map(d => this.toDomain(d));
  }

  async findPendingCustodyConfirmations(companyId: string, custodianUserId: string, limit?: number): Promise<VoucherEntity[]> {
    const data = await this.prisma.voucher.findMany({
      where: {
        companyId,
        status: VoucherStatus.PENDING,
        metadata: { path: ['pendingCustodyConfirmations'], array_contains: custodianUserId }
      } as any,
      include: { lines: { orderBy: { lineNo: 'asc' } } },
      orderBy: { createdAt: 'asc' },
      take: limit || 50
    });

    return data.map(d => this.toDomain(d));
  }

  async getRecent(companyId: string, limit: number): Promise<VoucherEntity[]> {
    const data = await this.prisma.voucher.findMany({
      where: { companyId },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return data.map(d => this.toDomain(d));
  }

  // =========================================================================
  // COUNT / AGGREGATION METHODS
  // =========================================================================

  async existsByNumber(companyId: string, voucherNo: string): Promise<boolean> {
    const count = await this.prisma.voucher.count({
      where: { companyId, voucherNo }
    });
    return count > 0;
  }

  async countByFormId(companyId: string, formId: string): Promise<number> {
    return this.prisma.voucher.count({
      where: {
        companyId,
        metadata: { path: ['formId'], equals: formId }
      } as any
    });
  }

  async countByCurrency(companyId: string, currencyCode: string): Promise<number> {
    return this.prisma.voucher.count({
      where: { companyId, currency: currencyCode.toUpperCase() }
    });
  }

  async getCounts(companyId: string, monthStart: string, monthEnd: string): Promise<{
    total: number;
    draft: number;
    pending: number;
    postedThisMonth: number;
    lastMonthTotal: number;
    unbalancedDrafts: number;
  }> {
    const startDate = new Date(monthStart);
    const endDate = new Date(monthEnd);

    // Calculate last month range
    const lastMonthStart = new Date(startDate);
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    const lastMonthEnd = new Date(startDate);
    lastMonthEnd.setDate(0); // Last day of previous month

    const [total, draft, pending, postedThisMonth, lastMonthTotal] = await Promise.all([
      this.prisma.voucher.count({ where: { companyId } }),
      this.prisma.voucher.count({ where: { companyId, status: VoucherStatus.DRAFT } }),
      this.prisma.voucher.count({ where: { companyId, status: VoucherStatus.PENDING } }),
      this.prisma.voucher.count({
        where: {
          companyId,
          status: VoucherStatus.APPROVED,
          updatedAt: { gte: startDate, lte: endDate }
        }
      }),
      this.prisma.voucher.count({
        where: {
          companyId,
          createdAt: { gte: lastMonthStart, lte: lastMonthEnd }
        }
      })
    ]);

    // Unbalanced drafts: drafts where totalDebit != totalCredit
    const draftVouchers = await this.prisma.voucher.findMany({
      where: { companyId, status: VoucherStatus.DRAFT },
      select: { totalDebit: true, totalCredit: true }
    });
    const unbalancedDrafts = draftVouchers.filter(
      v => Math.abs(v.totalDebit - v.totalCredit) > 0.0001
    ).length;

    return { total, draft, pending, postedThisMonth, lastMonthTotal, unbalancedDrafts };
  }

  // =========================================================================
  // MUTATION METHODS
  // =========================================================================

  async save(voucher: VoucherEntity, transaction?: any): Promise<VoucherEntity> {
    const tx = transaction || this.prisma;

    const existing = await tx.voucher.findUnique({
      where: { id: voucher.id }
    });

    if (existing) {
      await tx.voucher.update({
        where: { id: voucher.id },
        data: this.buildUpdateInput(voucher)
      });
    } else {
      await tx.voucher.create({
        data: this.buildCreateInput(voucher.companyId, voucher)
      });
    }

    return voucher;
  }

  async delete(companyId: string, voucherId: string): Promise<boolean> {
    const existing = await this.prisma.voucher.findFirst({
      where: { id: voucherId, companyId }
    });

    if (!existing) return false;

    await this.prisma.voucher.delete({
      where: { id: voucherId }
    });

    return true;
  }
}
