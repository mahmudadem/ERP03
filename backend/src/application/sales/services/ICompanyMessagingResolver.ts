export interface ResolveMessagingConfigInput {
  companyId: string;
  accountId?: string;
}

export interface ResolvedWhatsAppMessagingConfig {
  accountId: string;
  label: string;
  accessToken: string;
  phoneNumberId: string;
  apiVersion?: string;
}

export interface ICompanyMessagingResolver {
  resolveWhatsAppConfig(
    input: ResolveMessagingConfigInput
  ): Promise<ResolvedWhatsAppMessagingConfig | null>;

  resolveTelegramConfig(
    input: ResolveMessagingConfigInput
  ): Promise<ResolvedTelegramMessagingConfig | null>;
}

export interface ResolvedTelegramMessagingConfig {
  accountId: string;
  label: string;
  botToken: string;
}
