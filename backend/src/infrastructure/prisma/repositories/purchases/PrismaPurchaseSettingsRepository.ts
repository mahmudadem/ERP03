import { PrismaClient } from '@prisma/client';
import { IPurchaseSettingsRepository } from '../../../../repository/interfaces/purchases/IPurchaseSettingsRepository';
import { PurchaseSettings } from '../../../../domain/purchases/entities/PurchaseSettings';

export class PrismaPurchaseSettingsRepository implements IPurchaseSettingsRepository {
  constructor(private prisma: PrismaClient) {}

  async getSettings(companyId: string): Promise<PurchaseSettings | null> {
    const record = await this.prisma.purchaseSettings.findUnique({
      where: { companyId },
    });
    if (!record) return null;
    return PurchaseSettings.fromJSON(record.settings);
  }

  async saveSettings(settings: PurchaseSettings): Promise<void> {
    await this.prisma.purchaseSettings.upsert({
      where: { companyId: settings.companyId },
      create: {
        // companyId is set via the `company` relation connect — Prisma rejects the
        // scalar FK and the relation together on create.
        settings: settings.toJSON(),
        company: { connect: { id: settings.companyId } },
      },
      update: {
        settings: settings.toJSON(),
      },
    });
  }
}
