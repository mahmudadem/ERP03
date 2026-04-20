import { PrismaClient } from '@prisma/client';
import { ICurrencyRepository } from '../../../../repository/interfaces/accounting/ICurrencyRepository';
import { Currency } from '../../../../domain/accounting/entities/Currency';

export class PrismaCurrencyRepository implements ICurrencyRepository {
  constructor(private prisma: PrismaClient) {}

  async findAll(companyId?: string): Promise<Currency[]> {
    const records = await this.prisma.currency.findMany({
      orderBy: { code: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findActive(companyId?: string): Promise<Currency[]> {
    const records = await this.prisma.currency.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findByCode(code: string, companyId?: string): Promise<Currency | null> {
    const record = await this.prisma.currency.findUnique({
      where: { code: code.toUpperCase() },
    });
    if (!record) return null;
    return this.toDomain(record);
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
          },
        })
      )
    );
  }

  private toDomain(record: any): Currency {
    return new Currency({
      code: record.code,
      name: record.name,
      symbol: record.symbol,
      decimalPlaces: record.decimalPlaces,
      isActive: record.isActive,
    });
  }
}
