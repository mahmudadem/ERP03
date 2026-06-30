/**
 * PrismaVoucherSequenceRepository
 *
 * SQL implementation of IVoucherSequenceRepository using Prisma.
 * Handles voucher sequence number generation with atomic increments.
 */

import { PrismaClient } from '@prisma/client';
import { IVoucherSequenceRepository } from '../../../../repository/interfaces/accounting/IVoucherSequenceRepository';
import { VoucherSequence } from '../../../../domain/accounting/entities/VoucherSequence';

const formatNumber = (prefix: string, next: number, year?: number, format?: string) => {
  const y = year ? String(year) : '';
  if (format) {
    return format
      .replace('{PREFIX}', prefix)
      .replace('{YYYY}', y)
      .replace(/\{COUNTER:(\d+)\}/g, (_match, width) => String(next).padStart(Number(width) || 4, '0'))
      .replace('{COUNTER}', String(next).padStart(4, '0'));
  }
  const counter = String(next).padStart(4, '0');
  return year ? `${prefix}-${year}-${counter}` : `${prefix}-${counter}`;
};

export class PrismaVoucherSequenceRepository implements IVoucherSequenceRepository {
  constructor(private prisma: PrismaClient) {}

  // =========================================================================
  // MAPPING HELPERS
  // =========================================================================

  private toDomain(record: any): VoucherSequence {
    return {
      id: record.id,
      companyId: record.companyId,
      prefix: record.prefix,
      year: record.fiscalYearId ? new Date(record.fiscalYearId).getFullYear() : undefined,
      lastNumber: record.currentNumber ?? 0,
      format: this.buildFormat(record.prefix, record.fiscalYearId),
      updatedAt: record.updatedAt instanceof Date ? record.updatedAt : new Date(record.updatedAt),
    };
  }

  private buildFormat(prefix: string, fiscalYearId: string | null): string {
    if (fiscalYearId) {
      return `${prefix}-{YYYY}-{COUNTER:4}`;
    }
    return `${prefix}-{COUNTER:4}`;
  }

  // =========================================================================
  // IMPLEMENTATION
  // =========================================================================

  async getNextNumber(companyId: string, prefix: string, year?: number, format?: string): Promise<string> {
    const fiscalYearId = year ? await this.getFiscalYearIdForYear(companyId, year) : null;

    const sequence = await this.prisma.voucherSequence.findFirst({
      where: {
        companyId,
        prefix,
        fiscalYearId,
      },
    });

    if (!sequence) {
      // Create a new sequence starting at 1
      const newSequence = await this.prisma.voucherSequence.create({
        data: {
          // Scope id to the company: '<prefix>-<year>' repeats across companies and
          // VoucherSequence.id is a global PK. Logical identity is (companyId, voucherType, fiscalYearId).
          id: `${companyId}-${prefix}-${year || 'ALL'}`,
          companyId,
          voucherType: prefix,
          prefix,
          currentNumber: 1,
          fiscalYearId,
        } as any,
      });

      return formatNumber(prefix, 1, year, format);
    }

    // Atomically increment and get the next number
    const updated = await this.prisma.voucherSequence.update({
      where: { id: sequence.id },
      data: {
        currentNumber: { increment: 1 },
      } as any,
    });

    return formatNumber(prefix, updated.currentNumber, year, format);
  }

  async getCurrentSequence(companyId: string, prefix: string, year?: number): Promise<VoucherSequence | null> {
    const fiscalYearId = year ? await this.getFiscalYearIdForYear(companyId, year) : null;

    const record = await this.prisma.voucherSequence.findFirst({
      where: {
        companyId,
        prefix,
        fiscalYearId,
      },
    });

    return record ? this.toDomain(record) : null;
  }

  async setNextNumber(companyId: string, prefix: string, nextNumber: number, year?: number, format?: string): Promise<void> {
    const fiscalYearId = year ? await this.getFiscalYearIdForYear(companyId, year) : null;

    const sequence = await this.prisma.voucherSequence.findFirst({
      where: {
        companyId,
        prefix,
        fiscalYearId,
      },
    });

    if (sequence) {
      await this.prisma.voucherSequence.update({
        where: { id: sequence.id },
        data: {
          currentNumber: nextNumber - 1, // Set to nextNumber - 1 so getNextNumber returns nextNumber
        } as any,
      });
    } else {
      await this.prisma.voucherSequence.create({
        data: {
          id: `${prefix}-${year || 'ALL'}`,
          companyId,
          voucherType: prefix,
          prefix,
          currentNumber: nextNumber - 1,
          fiscalYearId,
        } as any,
      });
    }
  }

  async listSequences(companyId: string): Promise<VoucherSequence[]> {
    const records = await this.prisma.voucherSequence.findMany({
      where: { companyId },
      orderBy: [{ prefix: 'asc' }, { fiscalYearId: 'desc' }],
    });

    return records.map((r) => this.toDomain(r));
  }

  // =========================================================================
  // PRIVATE HELPERS
  // =========================================================================

  private async getFiscalYearIdForYear(companyId: string, year: number): Promise<string | null> {
    const fiscalYear = await this.prisma.fiscalYear.findFirst({
      where: {
        companyId,
        startDate: {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31`),
        },
      },
    });

    return fiscalYear?.id ?? null;
  }
}
