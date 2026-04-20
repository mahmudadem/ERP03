/**
 * PrismaCurrencyRepository
 * Prisma (SQL) implementation of ICurrencyRepository for company-wizard module
 */

import { PrismaClient } from '@prisma/client';
import { ICurrencyRepository } from '../../../../repository/interfaces/company-wizard/ICurrencyRepository';

export class PrismaCurrencyRepository implements ICurrencyRepository {
  constructor(private prisma: PrismaClient) {}

  async listCurrencies(companyId?: string): Promise<Array<{ id: string; name: string }>> {
    if (companyId) {
      // List enabled currencies for a company
      const companyCurrencies = await this.prisma.companyCurrency.findMany({
        where: { companyId, isEnabled: true },
        include: { currency: true }
      });

      return companyCurrencies.map(cc => ({
        id: cc.currencyCode,
        name: cc.currency.name
      }));
    } else {
      // List all active global currencies
      const currencies = await this.prisma.currency.findMany({
        where: { isActive: true },
        orderBy: { code: 'asc' }
      });

      return currencies.map(c => ({
        id: c.code,
        name: c.name
      }));
    }
  }

  async seedCurrencies(companyId: string, currencies: any[], baseCurrency?: string): Promise<void> {
    // Enable the provided currencies for the company
    const companyCurrencies = currencies.map((c) => ({
      companyId,
      currencyCode: c.id || c.code,
      isEnabled: true,
      enabledAt: new Date()
    }));

    // Use upsert to avoid duplicates
    await this.prisma.$transaction(
      companyCurrencies.map((cc) =>
        this.prisma.companyCurrency.upsert({
          where: {
            companyId_currencyCode: {
              companyId: cc.companyId,
              currencyCode: cc.currencyCode
            }
          },
          create: cc,
          update: {
            isEnabled: true,
            disabledAt: null
          }
        })
      )
    );

    // Set base currency in company settings if provided
    if (baseCurrency) {
      await this.prisma.company.update({
        where: { id: companyId },
        data: { baseCurrency }
      });
    }
  }
}
