import { PrismaClient } from '@prisma/client';
import { IInventorySettingsRepository } from '../../../../repository/interfaces/inventory/IInventorySettingsRepository';
import { InventorySettings } from '../../../../domain/inventory/entities/InventorySettings';

export class PrismaInventorySettingsRepository implements IInventorySettingsRepository {
  constructor(private prisma: PrismaClient) {}

  async getSettings(companyId: string): Promise<InventorySettings | null> {
    const record = await this.prisma.inventorySettings.findUnique({
      where: { companyId },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async saveSettings(settings: InventorySettings): Promise<void> {
    const settingsJson = settings.toJSON();
    await this.prisma.inventorySettings.upsert({
      where: { companyId: settings.companyId },
      create: {
        companyId: settings.companyId,
        settings: settingsJson,
      },
      update: {
        settings: settingsJson,
      },
    });
  }

  private toDomain(record: any): InventorySettings {
    const data = record.settings;
    return InventorySettings.fromJSON({
      companyId: record.companyId,
      ...data,
    });
  }
}
