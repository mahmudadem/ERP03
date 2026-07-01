import { PrismaClient, Prisma } from '@prisma/client';
import { PosSettings } from '../../../../domain/pos/entities/PosSettings';
import { IPosSettingsRepository } from '../../../../repository/interfaces/pos/IPosSettingsRepository';

export class PrismaPosSettingsRepository implements IPosSettingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getSettings(companyId: string): Promise<PosSettings | null> {
    const record = await this.prisma.posSettings.findUnique({ where: { companyId } });
    if (!record) return null;
    return PosSettings.fromJSON({
      ...((record.settings as object) || {}),
      companyId: record.companyId,
    });
  }

  async saveSettings(settings: PosSettings, tx?: unknown): Promise<void> {
    const client = (tx as Prisma.TransactionClient) || this.prisma;
    await client.posSettings.upsert({
      where: { companyId: settings.companyId },
      create: {
        companyId: settings.companyId,
        settings: settings.toJSON(),
      },
      update: {
        settings: settings.toJSON(),
        updatedAt: new Date(),
      },
    });
  }
}
