export interface SendWhatsAppMessageInput {
  toPhoneNumberE164: string;
  messageBody: string;
}

export interface WhatsAppProviderRuntimeConfig {
  accessToken: string;
  phoneNumberId: string;
  apiVersion?: string;
}

export interface SendWhatsAppMessageResult {
  provider: string;
  messageId: string;
}

export interface IInvoiceMessagingProvider {
  sendWhatsAppMessage(
    input: SendWhatsAppMessageInput,
    runtimeConfig?: WhatsAppProviderRuntimeConfig
  ): Promise<SendWhatsAppMessageResult>;
}
