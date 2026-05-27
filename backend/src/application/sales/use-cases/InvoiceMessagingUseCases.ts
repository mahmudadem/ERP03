import { ApiError } from '../../../api/errors/ApiError';
import { ISalesInvoiceRepository } from '../../../repository/interfaces/sales/ISalesInvoiceRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import {
  ICompanyMessagingResolver,
  ResolvedTelegramMessagingConfig,
  ResolvedWhatsAppMessagingConfig,
} from '../services/ICompanyMessagingResolver';
import {
  IInvoiceMessagingProvider,
  SendTelegramMessageResult,
  SendWhatsAppMessageResult,
} from '../services/IInvoiceMessagingProvider';

const normalizeE164 = (raw: string): string => {
  const compact = raw.trim().replace(/[\s\-().]/g, '');
  if (!compact) {
    throw ApiError.badRequest('Phone number is required for WhatsApp sending.');
  }

  let normalized = compact;
  if (normalized.startsWith('00')) {
    normalized = `+${normalized.slice(2)}`;
  }

  if (!normalized.startsWith('+')) {
    throw ApiError.badRequest('Phone number must include country code in E.164 format (example: +905551112233).');
  }

  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw ApiError.badRequest('Phone number must be a valid E.164 number.');
  }

  return normalized;
};

const buildDefaultMessage = (params: {
  invoiceNumber: string;
  customerName: string;
  grandTotalDoc: number;
  currency: string;
  invoiceDate: string;
  documentUrl?: string;
}): string => {
  const amount = Number.isFinite(params.grandTotalDoc) ? params.grandTotalDoc.toFixed(2) : String(params.grandTotalDoc);
  const lines = [
    `Invoice ${params.invoiceNumber}`,
    `Customer: ${params.customerName}`,
    `Amount: ${amount} ${params.currency}`,
    `Date: ${params.invoiceDate}`,
  ];
  if (params.documentUrl) {
    lines.push(`View: ${params.documentUrl}`);
  }
  return lines.join('\n');
};

const normalizeTelegramRecipient = (raw: string): string => {
  const value = String(raw || '').trim();
  if (!value) {
    throw ApiError.badRequest('Telegram chat id or username is required.');
  }

  if (value.startsWith('@')) {
    if (!/^@[a-zA-Z0-9_]{5,32}$/.test(value)) {
      throw ApiError.badRequest('Telegram username must be in @username format.');
    }
    return value;
  }

  if (!/^-?\d{5,20}$/.test(value)) {
    throw ApiError.badRequest('Telegram chat id must be numeric, or provide @username.');
  }

  return value;
};

export interface SendSalesInvoiceWhatsappInput {
  companyId: string;
  invoiceId: string;
  messagingAccountId?: string;
  toPhoneNumber?: string;
  messageText?: string;
  documentUrl?: string;
}

export interface SendSalesInvoiceWhatsappResult {
  provider: string;
  messageId: string;
  senderAccountId?: string;
  senderLabel?: string;
  invoiceId: string;
  invoiceNumber: string;
  recipientPhoneNumber: string;
}

export interface SendSalesInvoiceTelegramInput {
  companyId: string;
  invoiceId: string;
  messagingAccountId?: string;
  toChatId?: string;
  messageText?: string;
  documentUrl?: string;
}

export interface SendSalesInvoiceTelegramResult {
  provider: string;
  messageId: string;
  senderAccountId?: string;
  senderLabel?: string;
  invoiceId: string;
  invoiceNumber: string;
  recipientChatId: string;
}

export class SendSalesInvoiceWhatsappUseCase {
  constructor(
    private readonly salesInvoiceRepo: ISalesInvoiceRepository,
    private readonly partyRepo: IPartyRepository,
    private readonly messagingProvider: IInvoiceMessagingProvider,
    private readonly messagingResolver: ICompanyMessagingResolver,
    private readonly appBaseUrl?: string
  ) {}

  async execute(input: SendSalesInvoiceWhatsappInput): Promise<SendSalesInvoiceWhatsappResult> {
    const invoice = await this.salesInvoiceRepo.getById(input.companyId, input.invoiceId);
    if (!invoice) {
      throw ApiError.notFound(`Sales invoice not found: ${input.invoiceId}`);
    }

    if (invoice.status !== 'POSTED') {
      throw ApiError.conflict('Only posted sales invoices can be sent via WhatsApp.');
    }

    const customer = await this.partyRepo.getById(input.companyId, invoice.customerId);
    if (!customer) {
      throw ApiError.notFound(`Customer not found for invoice: ${invoice.customerId}`);
    }

    const recipientPhoneNumber = normalizeE164(input.toPhoneNumber || customer.phone || '');
    const defaultDocumentUrl = this.appBaseUrl
      ? `${this.appBaseUrl.replace(/\/$/, '')}/sales/invoices/${invoice.id}`
      : undefined;

    const messageText = (input.messageText || '').trim() || buildDefaultMessage({
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName,
      grandTotalDoc: invoice.grandTotalDoc,
      currency: invoice.currency,
      invoiceDate: invoice.invoiceDate,
      documentUrl: (input.documentUrl || '').trim() || defaultDocumentUrl,
    });

    if (messageText.length > 4096) {
      throw ApiError.badRequest('WhatsApp message exceeds the 4096 character limit.');
    }

    const resolvedConfig: ResolvedWhatsAppMessagingConfig | null = await this.messagingResolver.resolveWhatsAppConfig({
      companyId: input.companyId,
      accountId: input.messagingAccountId,
    });
    if (input.messagingAccountId && !resolvedConfig) {
      throw ApiError.badRequest('Selected WhatsApp sender account is not available or is missing credentials.');
    }
    const providerResult: SendWhatsAppMessageResult = await this.messagingProvider.sendWhatsAppMessage(
      {
        toPhoneNumberE164: recipientPhoneNumber,
        messageBody: messageText,
      },
      resolvedConfig
        ? {
            accessToken: resolvedConfig.accessToken,
            phoneNumberId: resolvedConfig.phoneNumberId,
            apiVersion: resolvedConfig.apiVersion,
          }
        : undefined
    );

    return {
      provider: providerResult.provider,
      messageId: providerResult.messageId,
      senderAccountId: resolvedConfig?.accountId,
      senderLabel: resolvedConfig?.label,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      recipientPhoneNumber,
    };
  }
}

export class SendSalesInvoiceTelegramUseCase {
  constructor(
    private readonly salesInvoiceRepo: ISalesInvoiceRepository,
    private readonly partyRepo: IPartyRepository,
    private readonly messagingProvider: IInvoiceMessagingProvider,
    private readonly messagingResolver: ICompanyMessagingResolver,
    private readonly appBaseUrl?: string
  ) {}

  async execute(input: SendSalesInvoiceTelegramInput): Promise<SendSalesInvoiceTelegramResult> {
    const invoice = await this.salesInvoiceRepo.getById(input.companyId, input.invoiceId);
    if (!invoice) {
      throw ApiError.notFound(`Sales invoice not found: ${input.invoiceId}`);
    }

    if (invoice.status !== 'POSTED') {
      throw ApiError.conflict('Only posted sales invoices can be sent via Telegram.');
    }

    const customer = await this.partyRepo.getById(input.companyId, invoice.customerId);
    if (!customer) {
      throw ApiError.notFound(`Customer not found for invoice: ${invoice.customerId}`);
    }

    const recipientChatId = normalizeTelegramRecipient(input.toChatId || '');
    const defaultDocumentUrl = this.appBaseUrl
      ? `${this.appBaseUrl.replace(/\/$/, '')}/sales/invoices/${invoice.id}`
      : undefined;

    const messageText = (input.messageText || '').trim() || buildDefaultMessage({
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName,
      grandTotalDoc: invoice.grandTotalDoc,
      currency: invoice.currency,
      invoiceDate: invoice.invoiceDate,
      documentUrl: (input.documentUrl || '').trim() || defaultDocumentUrl,
    });

    if (messageText.length > 4096) {
      throw ApiError.badRequest('Telegram message exceeds the 4096 character limit.');
    }

    const resolvedConfig: ResolvedTelegramMessagingConfig | null = await this.messagingResolver.resolveTelegramConfig({
      companyId: input.companyId,
      accountId: input.messagingAccountId,
    });
    if (!resolvedConfig) {
      throw ApiError.badRequest('Telegram sender account is not available or is missing credentials.');
    }
    const providerResult: SendTelegramMessageResult = await this.messagingProvider.sendTelegramMessage(
      {
        toChatIdOrUsername: recipientChatId,
        messageBody: messageText,
      },
      { botToken: resolvedConfig.botToken }
    );

    return {
      provider: providerResult.provider,
      messageId: providerResult.messageId,
      senderAccountId: resolvedConfig.accountId,
      senderLabel: resolvedConfig.label,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      recipientChatId,
    };
  }
}
