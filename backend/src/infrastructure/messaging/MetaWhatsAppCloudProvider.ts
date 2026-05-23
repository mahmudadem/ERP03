import axios from 'axios';
import { ApiError } from '../../api/errors/ApiError';
import {
  IInvoiceMessagingProvider,
  SendWhatsAppMessageInput,
  SendWhatsAppMessageResult,
  WhatsAppProviderRuntimeConfig,
} from '../../application/sales/services/IInvoiceMessagingProvider';

interface MetaWhatsAppCloudProviderConfig {
  accessToken: string;
  phoneNumberId: string;
  apiVersion?: string;
  timeoutMs?: number;
}

interface MetaWhatsAppSendResponse {
  messages?: Array<{ id?: string }>;
  error?: {
    message?: string;
  };
}

export class MetaWhatsAppCloudProvider implements IInvoiceMessagingProvider {
  private readonly timeoutMs: number;

  constructor(private readonly config: MetaWhatsAppCloudProviderConfig) {
    this.timeoutMs = config.timeoutMs ?? 15000;
  }

  private buildEndpoint(apiVersion: string, phoneNumberId: string): string {
    return `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  }

  async sendWhatsAppMessage(
    input: SendWhatsAppMessageInput,
    runtimeConfig?: WhatsAppProviderRuntimeConfig
  ): Promise<SendWhatsAppMessageResult> {
    const accessToken = runtimeConfig?.accessToken?.trim() || this.config.accessToken;
    const phoneNumberId = runtimeConfig?.phoneNumberId?.trim() || this.config.phoneNumberId;
    const apiVersion = runtimeConfig?.apiVersion?.trim() || this.config.apiVersion || 'v22.0';
    const endpoint = this.buildEndpoint(apiVersion, phoneNumberId);

    if (!accessToken || !phoneNumberId) {
      throw ApiError.custom(
        503,
        'WhatsApp Cloud provider is not configured. Set WHATSAPP_CLOUD_ACCESS_TOKEN and WHATSAPP_CLOUD_PHONE_NUMBER_ID.'
      );
    }

    const to = input.toPhoneNumberE164.replace(/^\+/, '');

    try {
      const response = await axios.post<MetaWhatsAppSendResponse>(
        endpoint,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: {
            preview_url: true,
            body: input.messageBody,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: this.timeoutMs,
        }
      );

      const messageId = response.data?.messages?.[0]?.id;
      if (!messageId) {
        throw ApiError.custom(502, 'WhatsApp provider did not return a message id.');
      }

      return {
        provider: 'meta_whatsapp_cloud',
        messageId,
      };
    } catch (error: any) {
      const status = error?.response?.status;
      const providerMessage: string | undefined =
        error?.response?.data?.error?.message || error?.response?.data?.message;

      if (status === 401 || status === 403) {
        throw ApiError.custom(502, `WhatsApp provider authentication failed.${providerMessage ? ` ${providerMessage}` : ''}`);
      }
      if (status === 429) {
        throw ApiError.custom(429, 'WhatsApp provider rate limit reached. Try again shortly.');
      }

      throw ApiError.custom(502, `Failed to send WhatsApp message.${providerMessage ? ` ${providerMessage}` : ''}`);
    }
  }
}
