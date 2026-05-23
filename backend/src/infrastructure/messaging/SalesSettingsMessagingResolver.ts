import {
  ICompanyMessagingResolver,
  ResolvedTelegramMessagingConfig,
  ResolvedWhatsAppMessagingConfig,
} from '../../application/sales/services/ICompanyMessagingResolver';
import { ICredentialCipher } from '../../application/sales/services/ICredentialCipher';
import { ISalesSettingsRepository } from '../../repository/interfaces/sales/ISalesSettingsRepository';

export class SalesSettingsMessagingResolver implements ICompanyMessagingResolver {
  constructor(
    private readonly salesSettingsRepo: ISalesSettingsRepository,
    private readonly credentialCipher: ICredentialCipher
  ) {}

  async resolveWhatsAppConfig(input: { companyId: string; accountId?: string }): Promise<ResolvedWhatsAppMessagingConfig | null> {
    const settings = await this.salesSettingsRepo.getSettings(input.companyId);
    if (!settings) return null;

    const whatsappAccounts = (settings.messagingAccounts || []).filter(
      (account) => account.channel === 'WHATSAPP' && account.isActive !== false
    );

    if (!whatsappAccounts.length) {
      return null;
    }

    const selectedAccount = input.accountId
      ? whatsappAccounts.find((account) => account.id === input.accountId)
      : whatsappAccounts.find((account) => account.isDefault) || whatsappAccounts[0];

    if (!selectedAccount) {
      return null;
    }

    const encryptedCredential = selectedAccount.encryptedCredential?.trim();
    if (!encryptedCredential || !selectedAccount.phoneNumberId?.trim()) {
      return null;
    }

    const accessToken = encryptedCredential.includes(':')
      ? this.credentialCipher.decrypt(encryptedCredential)
      : encryptedCredential;
    if (!accessToken.trim()) {
      return null;
    }

    return {
      accountId: selectedAccount.id,
      label: selectedAccount.label,
      accessToken,
      phoneNumberId: selectedAccount.phoneNumberId,
      apiVersion: selectedAccount.apiVersion,
    };
  }

  async resolveTelegramConfig(input: { companyId: string; accountId?: string }): Promise<ResolvedTelegramMessagingConfig | null> {
    const settings = await this.salesSettingsRepo.getSettings(input.companyId);
    if (!settings) return null;

    const telegramAccounts = (settings.messagingAccounts || []).filter(
      (account) => account.channel === 'TELEGRAM' && account.isActive !== false
    );

    if (!telegramAccounts.length) {
      return null;
    }

    const selectedAccount = input.accountId
      ? telegramAccounts.find((account) => account.id === input.accountId)
      : telegramAccounts.find((account) => account.isDefault) || telegramAccounts[0];

    if (!selectedAccount) {
      return null;
    }

    const encryptedCredential = selectedAccount.encryptedCredential?.trim();
    if (!encryptedCredential) {
      return null;
    }

    const botToken = encryptedCredential.includes(':')
      ? this.credentialCipher.decrypt(encryptedCredential)
      : encryptedCredential;
    if (!botToken.trim()) {
      return null;
    }

    return {
      accountId: selectedAccount.id,
      label: selectedAccount.label,
      botToken,
    };
  }
}
