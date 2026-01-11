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
    const records = await this.prisma.companyCurrency.findMany({
      where: { companyId, isEnabled: true },
      orderBy: { currencyCode: 'asc' },
    });

    return records.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      currencyCode: r.currencyCode,
      isEnabled: r.isEnabled,
      enabledAt: r.enabledAt,
      disabledAt: r.disabledAt,
    }));
  }

  async findAllByCompany(companyId: string): Promise<CompanyCurrencyRecord[]> {
    const records = await this.prisma.companyCurrency.findMany({
      where: { companyId },
      orderBy: { currencyCode: 'asc' },
    });

    return records.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      currencyCode: r.currencyCode,
      isEnabled: r.isEnabled,
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

    return {
      id: record.id,
      companyId: record.companyId,
      currencyCode: record.currencyCode,
      isEnabled: record.isEnabled,
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
      },
    });
  }
}
