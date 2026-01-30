import { PrismaClient } from '@prisma/client';
import { ExchangeRate } from '../../../domain/accounting/entities/ExchangeRate';
import { IExchangeRateRepository } from '../../../repository/interfaces/accounting/IExchangeRateRepository';

/**
 * Prisma implementation of IExchangeRateRepository.
 * 
 * Supports:
 * - Company-scoped rates
 * - Multiple rates per (company, pair, date) - NO unique constraint
 * - Historical rate lookup
 * - Returns null when rate not found (NO silent defaults)
 */
export class PrismaExchangeRateRepository implements IExchangeRateRepository {
  constructor(private prisma: PrismaClient) {}

  async save(rate: ExchangeRate): Promise<void> {
    await this.prisma.exchangeRate.create({
      data: {
        id: rate.id,
        companyId: rate.companyId,
        fromCurrency: rate.fromCurrency,
        toCurrency: rate.toCurrency,
        rate: rate.rate,
        date: rate.date,
        source: rate.source,
        createdAt: rate.createdAt,
        createdBy: rate.createdBy,
      },
    });
  }

  async getLatestRate(
    companyId: string,
    fromCurrency: string,
    toCurrency: string,
    date: Date
  ): Promise<ExchangeRate | null> {
    // Normalize date to start of day
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    const record = await this.prisma.exchangeRate.findFirst({
      where: {
        companyId,
        fromCurrency: fromCurrency.toUpperCase(),
        toCurrency: toCurrency.toUpperCase(),
        date: {
          gte: dateStart,
          lte: dateEnd,
        },
      },
      orderBy: [
        { date: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    if (!record) return null;

    return new ExchangeRate({
      id: record.id,
      companyId: record.companyId,
      fromCurrency: record.fromCurrency,
      toCurrency: record.toCurrency,
      rate: record.rate,
      date: record.date,
      source: record.source as 'MANUAL' | 'REFERENCE',
      createdAt: record.createdAt,
      createdBy: record.createdBy ?? undefined,
    });
  }

  async getRatesForDate(
    companyId: string,
    fromCurrency: string,
    toCurrency: string,
    date: Date
  ): Promise<ExchangeRate[]> {
    // Normalize date to start of day
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    const records = await this.prisma.exchangeRate.findMany({
      where: {
        companyId,
        fromCurrency: fromCurrency.toUpperCase(),
        toCurrency: toCurrency.toUpperCase(),
        date: {
          gte: dateStart,
          lte: dateEnd,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return records.map(
      (r) =>
        new ExchangeRate({
          id: r.id,
          companyId: r.companyId,
          fromCurrency: r.fromCurrency,
          toCurrency: r.toCurrency,
          rate: r.rate,
          date: r.date,
          source: r.source as 'MANUAL' | 'REFERENCE',
          createdAt: r.createdAt,
          createdBy: r.createdBy ?? undefined,
        })
    );
  }

  async getRecentRates(
    companyId: string,
    fromCurrency?: string,
    toCurrency?: string,
    limit: number = 10
  ): Promise<ExchangeRate[]> {
    const where: any = { companyId };
    if (fromCurrency) where.fromCurrency = fromCurrency.toUpperCase();
    if (toCurrency) where.toCurrency = toCurrency.toUpperCase();

    const records = await this.prisma.exchangeRate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return records.map(
      (r) =>
        new ExchangeRate({
          id: r.id,
          companyId: r.companyId,
          fromCurrency: r.fromCurrency,
          toCurrency: r.toCurrency,
          rate: r.rate,
          date: r.date,
          source: r.source as 'MANUAL' | 'REFERENCE',
          createdAt: r.createdAt,
          createdBy: r.createdBy ?? undefined,
        })
    );
  }

  async getMostRecentRate(
    companyId: string,
    fromCurrency: string,
    toCurrency: string
  ): Promise<ExchangeRate | null> {
    const record = await this.prisma.exchangeRate.findFirst({
      where: {
        companyId,
        fromCurrency: fromCurrency.toUpperCase(),
        toCurrency: toCurrency.toUpperCase(),
      },
      orderBy: [
        { date: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    if (!record) return null;

    return new ExchangeRate({
      id: record.id,
      companyId: record.companyId,
      fromCurrency: record.fromCurrency,
      toCurrency: record.toCurrency,
      rate: record.rate,
      date: record.date,
      source: record.source as 'MANUAL' | 'REFERENCE',
      createdAt: record.createdAt,
      createdBy: record.createdBy ?? undefined,
    });
  }

  async getMostRecentRateBeforeDate(
    companyId: string,
    fromCurrency: string,
    toCurrency: string,
    date: Date
  ): Promise<ExchangeRate | null> {
    // We want the most recent rate where record.date <= date
    // Normalize date ceiling to end of day to be safe, though record.date is usually start of day
    const dateCeiling = new Date(date);
    dateCeiling.setHours(23, 59, 59, 999);

    const record = await this.prisma.exchangeRate.findFirst({
      where: {
        companyId,
        fromCurrency: fromCurrency.toUpperCase(),
        toCurrency: toCurrency.toUpperCase(),
        date: {
          lte: dateCeiling,
        },
      },
      orderBy: [
        { date: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    if (!record) return null;

    return new ExchangeRate({
      id: record.id,
      companyId: record.companyId,
      fromCurrency: record.fromCurrency,
      toCurrency: record.toCurrency,
      rate: record.rate,
      date: record.date,
      source: record.source as 'MANUAL' | 'REFERENCE',
      createdAt: record.createdAt,
      createdBy: record.createdBy ?? undefined,
    });
  }

  // ============================================
  // Legacy compatibility - deprecated
  // ============================================

  /** @deprecated Use save() instead */
  async setRate(rate: ExchangeRate): Promise<void> {
    return this.save(rate);
  }

  /** @deprecated Use getLatestRate() instead */
  async getRate(
    fromCurrency: string,
    toCurrency: string,
    date: Date
  ): Promise<ExchangeRate | null> {
    // Legacy method doesn't have companyId, so we can't use it properly
    // This is a best-effort fallback that searches across all companies
    const record = await this.prisma.exchangeRate.findFirst({
      where: {
        fromCurrency: fromCurrency.toUpperCase(),
        toCurrency: toCurrency.toUpperCase(),
        date: {
          gte: new Date(date.setHours(0, 0, 0, 0)),
          lte: new Date(date.setHours(23, 59, 59, 999)),
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) return null;

    return new ExchangeRate({
      id: record.id,
      companyId: record.companyId,
      fromCurrency: record.fromCurrency,
      toCurrency: record.toCurrency,
      rate: record.rate,
      date: record.date,
      source: record.source as 'MANUAL' | 'REFERENCE',
      createdAt: record.createdAt,
      createdBy: record.createdBy ?? undefined,
    });
  }
}
