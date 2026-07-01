import { PrismaClient, Prisma } from '@prisma/client';
import { CommunicationsSettings } from '../../../../domain/communications/CommunicationsSettings';
import { ICommunicationsSettingsRepository } from '../../../../repository/interfaces/communications/ICommunicationsSettingsRepository';

export class PrismaCommunicationsSettingsRepository implements ICommunicationsSettingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getSettings(companyId: string): Promise<CommunicationsSettings | null> {
    const row = await (this.prisma).communicationsSettings.findUnique({
      where: { companyId },
    });
    if (!row) return null;
    return CommunicationsSettings.fromJSON({
      companyId: row.companyId,
      messagingAccounts: row.messagingAccounts ?? [],
    });
  }

  async saveSettings(settings: CommunicationsSettings, transaction?: unknown): Promise<void> {
    const client = (transaction as Prisma.TransactionClient) ?? this.prisma;
    const payload = settings.toJSON();
    await (client).communicationsSettings.upsert({
      where: { companyId: settings.companyId },
      create: {
        companyId: settings.companyId,
        messagingAccounts: payload.messagingAccounts as unknown as Prisma.InputJsonValue,
      },
      update: {
        messagingAccounts: payload.messagingAccounts as unknown as Prisma.InputJsonValue,
      },
    });
  }
}
