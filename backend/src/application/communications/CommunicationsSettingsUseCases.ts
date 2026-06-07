import { CommunicationsSettings, MessagingAccount } from '../../domain/communications/CommunicationsSettings';
import { ICommunicationsSettingsRepository } from '../../repository/interfaces/communications/ICommunicationsSettingsRepository';
import { ICredentialCipher } from '../sales/services/ICredentialCipher';

export class GetCommunicationsSettingsUseCase {
  constructor(private readonly repo: ICommunicationsSettingsRepository) {}

  async execute(companyId: string): Promise<CommunicationsSettings> {
    return (await this.repo.getSettings(companyId)) ?? CommunicationsSettings.createDefault(companyId);
  }
}

export interface UpdateCommunicationsSettingsInput {
  companyId: string;
  messagingAccounts: Array<MessagingAccount & { credential?: string }>;
}

export class UpdateCommunicationsSettingsUseCase {
  constructor(
    private readonly repo: ICommunicationsSettingsRepository,
    private readonly cipher: ICredentialCipher
  ) {}

  async execute(input: UpdateCommunicationsSettingsInput): Promise<CommunicationsSettings> {
    const existing = (await this.repo.getSettings(input.companyId)) ?? CommunicationsSettings.createDefault(input.companyId);

    const existingById = new Map(existing.messagingAccounts.map((a) => [a.id, a]));

    const accounts: MessagingAccount[] = (input.messagingAccounts ?? []).map((a) => {
      const prev = existingById.get(a.id);
      let encryptedCredential = prev?.encryptedCredential;

      const raw = (a as any).credential;
      if (raw && typeof raw === 'string' && raw.trim()) {
        encryptedCredential = this.cipher.encrypt(raw.trim());
      }

      return {
        id: a.id,
        channel: a.channel,
        provider: a.provider,
        label: a.label,
        isDefault: a.isDefault,
        isActive: a.isActive,
        phoneNumberE164: a.phoneNumberE164,
        phoneNumberId: a.phoneNumberId,
        fromAddress: a.fromAddress,
        fromDisplayName: a.fromDisplayName,
        botUsername: a.botUsername,
        apiVersion: a.apiVersion,
        encryptedCredential,
      };
    });

    const settings = new CommunicationsSettings({ companyId: input.companyId, messagingAccounts: accounts });
    await this.repo.saveSettings(settings);
    return settings;
  }
}
