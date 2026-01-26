import { PrismaClient } from '@prisma/client';
import {
  ICompanyCurrencyRepository,
  CompanyCurrencyRecord,
} from '../../../repository/interfaces/accounting/ICompanyCurrencyRepository';

/**
 * Prisma implementation of ICompanyCurrencyRepository.
 * Manages enabled currencies per company.
 * Rate storage is handled by IExchangeRateRepository.
 */
export class PrismaCompanyCurrencyRepository implements ICompanyCurrencyRepository {
  constructor(private prisma: PrismaClient) {}

  async findEnabledByCompany(companyId: string): Promise<CompanyCurrencyRecord[]> {
    // 1. Fetch enabled currencies
    const records = await this.prisma.companyCurrency.findMany({
      where: { companyId, isEnabled: true },
      orderBy: { currencyCode: 'asc' },
    });

    // 2. Fetch base currency from Company table to correctly flag isBase
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { baseCurrency: true }
    });
    const baseCurrency = company?.baseCurrency;

    // Auto-repair logic: If nothing found but base currency exists, enable it
    if (records.length === 0 && baseCurrency) {
       await this.enable(companyId, baseCurrency);
       return this.findEnabledByCompany(companyId);
    }

    return records.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      currencyCode: r.currencyCode,
      isEnabled: r.isEnabled,
      isBase: r.currencyCode === baseCurrency,
      enabledAt: r.enabledAt,
      disabledAt: r.disabledAt,
    }));
  }

  async findAllByCompany(companyId: string): Promise<CompanyCurrencyRecord[]> {
    const records = await this.prisma.companyCurrency.findMany({
      where: { companyId },
      orderBy: { currencyCode: 'asc' },
    });

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { baseCurrency: true }
    });
    const baseCurrency = company?.baseCurrency;

    return records.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      currencyCode: r.currencyCode,
      isEnabled: r.isEnabled,
      isBase: r.currencyCode === baseCurrency,
      enabledAt: r.enabledAt,
      disabledAt: r.disabledAt,
    }));
  }

  async isEnabled(companyId: string, currencyCode: string): Promise<boolean> {
    const record = await this.prisma.companyCurrency.findUnique({
      where: {
        companyId_currencyCode: { companyId, currencyCode: currencyCode.toUpperCase() },
      },
    });

    return record?.isEnabled ?? false;
  }

  async enable(companyId: string, currencyCode: string): Promise<CompanyCurrencyRecord> {
    const code = currencyCode.toUpperCase();
    const now = new Date();

    const record = await this.prisma.companyCurrency.upsert({
      where: {
        companyId_currencyCode: { companyId, currencyCode: code },
      },
      create: {
        companyId,
        currencyCode: code,
        isEnabled: true,
        enabledAt: now,
      },
      update: {
        isEnabled: true,
        enabledAt: now,
        disabledAt: null,
      },
    });

    // Determine isBase
    const isBase = await this.isBaseCurrency(companyId, code);

    return {
      id: record.id,
      companyId: record.companyId,
      currencyCode: record.currencyCode,
      isEnabled: record.isEnabled,
      isBase,
      enabledAt: record.enabledAt,
      disabledAt: record.disabledAt,
    };
  }

  async disable(companyId: string, currencyCode: string): Promise<void> {
    await this.prisma.companyCurrency.updateMany({
      where: { companyId, currencyCode: currencyCode.toUpperCase() },
      data: {
        isEnabled: false,
        disabledAt: new Date(),
      } as any,
    });
  }

  async setBaseCurrency(companyId: string, currencyCode: string): Promise<void> {
    const code = currencyCode.toUpperCase();

    // Transactional update:
    // 1. Update Company.baseCurrency
    // 2. Ensure currency is enabled in CompanyCurrency table
    await this.prisma.$transaction([
      this.prisma.company.update({
        where: { id: companyId },
        data: { baseCurrency: code }
      }),
      this.prisma.companyCurrency.upsert({
        where: {
          companyId_currencyCode: { companyId, currencyCode: code },
        },
        create: {
          companyId,
          currencyCode: code,
          isEnabled: true,
          enabledAt: new Date(),
        },
        update: {
          isEnabled: true,
          disabledAt: null,
        }
      })
    ]);
  }

  async getBaseCurrency(companyId: string): Promise<string | null> {
    // Correct source of truth: The Company table
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { baseCurrency: true }
    });
    
    if (company?.baseCurrency) {
      // Ensure it is reflected in the CompanyCurrency table (auto-healing)
      // This is a side-effect, but ensures consistency
      const exists = await this.prisma.companyCurrency.findUnique({
        where: { companyId_currencyCode: { companyId, currencyCode: company.baseCurrency } }
      });
      
      if (!exists || !exists.isEnabled) {
         await this.enable(companyId, company.baseCurrency);
      }
      
      return company.baseCurrency;
    }

    return null;
  }

  // Helper to check base status safely
  private async isBaseCurrency(companyId: string, currencyCode: string): Promise<boolean> {
     const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { baseCurrency: true }
     });
     return company?.baseCurrency === currencyCode;
  }
}
