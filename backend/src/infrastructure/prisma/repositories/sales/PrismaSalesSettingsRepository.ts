import { PrismaClient } from '@prisma/client';
import { ISalesSettingsRepository } from '../../../../repository/interfaces/sales/ISalesSettingsRepository';
import { SalesSettings } from '../../../../domain/sales/entities/SalesSettings';

export class PrismaSalesSettingsRepository implements ISalesSettingsRepository {
  constructor(private prisma: PrismaClient) {}

  async getSettings(companyId: string): Promise<SalesSettings | null> {
    const record = await this.prisma.salesSettings.findUnique({
      where: { companyId },
    });
    if (!record) return null;
    return SalesSettings.fromJSON(record.settings);
  }

  async saveSettings(settings: SalesSettings): Promise<void> {
    await this.prisma.salesSettings.upsert({
      where: { companyId: settings.companyId },
      create: {
        companyId: settings.companyId,
        settings: settings.toJSON() as any,
        company: { connect: { id: settings.companyId } },
      } as any,
      update: {
        settings: settings.toJSON() as any,
      },
    });
  }
}
