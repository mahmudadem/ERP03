import { PrismaClient } from '@prisma/client';
import { Currency } from '../../../domain/accounting/entities/Currency';
import { ICurrencyRepository } from '../../../repository/interfaces/accounting/ICurrencyRepository';

/**
 * Prisma implementation of ICurrencyRepository.
 * Manages global currency definitions.
 */
export class PrismaCurrencyRepository implements ICurrencyRepository {
  constructor(private prisma: PrismaClient) {}

  async findAll(): Promise<Currency[]> {
    const records = await this.prisma.currency.findMany({
      orderBy: { code: 'asc' },
    });

    return records.map(
      (r) =>
        new Currency({
          code: r.code,
          name: r.name,
          symbol: r.symbol,
          decimalPlaces: r.decimalPlaces,
          isActive: r.isActive,
        })
    );
  }

  async findActive(): Promise<Currency[]> {
    const records = await this.prisma.currency.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });

    return records.map(
      (r) =>
        new Currency({
          code: r.code,
          name: r.name,
          symbol: r.symbol,
          decimalPlaces: r.decimalPlaces,
          isActive: r.isActive,
        })
    );
  }

  async findByCode(code: string): Promise<Currency | null> {
    const record = await this.prisma.currency.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!record) return null;

    return new Currency({
      code: record.code,
      name: record.name,
      symbol: record.symbol,
      decimalPlaces: record.decimalPlaces,
      isActive: record.isActive,
    });
  }

  async save(currency: Currency): Promise<void> {
    await this.prisma.currency.upsert({
      where: { code: currency.code },
      create: {
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol,
        decimalPlaces: currency.decimalPlaces,
        isActive: currency.isActive,
      },
      update: {
        name: currency.name,
        symbol: currency.symbol,
        decimalPlaces: currency.decimalPlaces,
        isActive: currency.isActive,
      },
    });
  }

  async seedCurrencies(currencies: Currency[]): Promise<void> {
    // Use transaction for atomicity
    await this.prisma.$transaction(
      currencies.map((currency) =>
        this.prisma.currency.upsert({
          where: { code: currency.code },
          create: {
            code: currency.code,
            name: currency.name,
            symbol: currency.symbol,
            decimalPlaces: currency.decimalPlaces,
            isActive: currency.isActive,
          },
          update: {
            name: currency.name,
            symbol: currency.symbol,
            decimalPlaces: currency.decimalPlaces,
            // Don't overwrite isActive on existing records
          },
        })
      )
    );
  }
}
