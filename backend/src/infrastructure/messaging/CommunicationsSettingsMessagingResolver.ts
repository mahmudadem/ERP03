import {
  ICompanyMessagingResolver,
  ResolvedTelegramMessagingConfig,
  ResolvedWhatsAppMessagingConfig,
} from '../../application/sales/services/ICompanyMessagingResolver';
import { ICredentialCipher } from '../../application/sales/services/ICredentialCipher';
import { ICommunicationsSettingsRepository } from '../../repository/interfaces/communications/ICommunicationsSettingsRepository';

export class CommunicationsSettingsMessagingResolver implements ICompanyMessagingResolver {
  constructor(
    private readonly commsRepo: ICommunicationsSettingsRepository,
    private readonly credentialCipher: ICredentialCipher
  ) {}

  async resolveWhatsAppConfig(input: { companyId: string; accountId?: string }): Promise<ResolvedWhatsAppMessagingConfig | null> {
    const settings = await this.commsRepo.getSettings(input.companyId);
    if (!settings) return null;

    const accounts = settings.messagingAccounts.filter((a) => a.channel === 'WHATSAPP' && a.isActive !== false);
    if (!accounts.length) return null;

    const selected = input.accountId
      ? accounts.find((a) => a.id === input.accountId)
      : accounts.find((a) => a.isDefault) ?? accounts[0];

    if (!selected?.encryptedCredential?.trim() || !selected.phoneNumberId?.trim()) return null;

    const enc = selected.encryptedCredential.trim();
    const accessToken = enc.includes(':') ? this.credentialCipher.decrypt(enc) : enc;
    if (!accessToken.trim()) return null;

    return {
      accountId: selected.id,
      label: selected.label,
      accessToken,
      phoneNumberId: selected.phoneNumberId,
      apiVersion: selected.apiVersion,
    };
  }

  async resolveTelegramConfig(input: { companyId: string; accountId?: string }): Promise<ResolvedTelegramMessagingConfig | null> {
    const settings = await this.commsRepo.getSettings(input.companyId);
    if (!settings) return null;

    const accounts = settings.messagingAccounts.filter((a) => a.channel === 'TELEGRAM' && a.isActive !== false);
    if (!accounts.length) return null;

    const selected = input.accountId
      ? accounts.find((a) => a.id === input.accountId)
      : accounts.find((a) => a.isDefault) ?? accounts[0];

    if (!selected?.encryptedCredential?.trim()) return null;

    const enc = selected.encryptedCredential.trim();
    const botToken = enc.includes(':') ? this.credentialCipher.decrypt(enc) : enc;
    if (!botToken.trim()) return null;

    return { accountId: selected.id, label: selected.label, botToken };
  }
}
