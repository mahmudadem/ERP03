export interface ResolveWhatsAppMessagingConfigInput {
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
    input: ResolveWhatsAppMessagingConfigInput
  ): Promise<ResolvedWhatsAppMessagingConfig | null>;
}

