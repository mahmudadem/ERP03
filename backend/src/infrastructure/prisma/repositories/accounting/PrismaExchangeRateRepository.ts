import { PrismaClient } from '@prisma/client';
import { IExchangeRateRepository } from '../../../../repository/interfaces/accounting/IExchangeRateRepository';
import { ExchangeRate } from '../../../../domain/accounting/entities/ExchangeRate';

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
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    const record = await this.prisma.exchangeRate.findFirst({
      where: {
        companyId,
        fromCurrency: fromCurrency.toUpperCase(),
        toCurrency: toCurrency.toUpperCase(),
        date: { gte: dateStart, lte: dateEnd },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async getRatesForDate(
    companyId: string,
    fromCurrency: string,
    toCurrency: string,
    date: Date
  ): Promise<ExchangeRate[]> {
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    const records = await this.prisma.exchangeRate.findMany({
      where: {
        companyId,
        fromCurrency: fromCurrency.toUpperCase(),
        toCurrency: toCurrency.toUpperCase(),
        date: { gte: dateStart, lte: dateEnd },
      },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
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
    return records.map((r) => this.toDomain(r));
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
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async getMostRecentRateBeforeDate(
    companyId: string,
    fromCurrency: string,
    toCurrency: string,
    date: Date
  ): Promise<ExchangeRate | null> {
    const dateCeiling = new Date(date);
    dateCeiling.setHours(23, 59, 59, 999);

    const record = await this.prisma.exchangeRate.findFirst({
      where: {
        companyId,
        fromCurrency: fromCurrency.toUpperCase(),
        toCurrency: toCurrency.toUpperCase(),
        date: { lte: dateCeiling },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async setRate(rate: ExchangeRate): Promise<void> {
    return this.save(rate);
  }

  async getRate(
    fromCurrency: string,
    toCurrency: string,
    date: Date
  ): Promise<ExchangeRate | null> {
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
    return this.toDomain(record);
  }

  private toDomain(record: any): ExchangeRate {
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
