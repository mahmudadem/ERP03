import {
  SendSalesInvoiceTelegramUseCase,
  SendSalesInvoiceWhatsappUseCase,
} from '../../../application/sales/use-cases/InvoiceMessagingUseCases';

describe('SendSalesInvoiceWhatsappUseCase', () => {
  const salesInvoiceRepo: any = {
    getById: jest.fn(),
  };
  const partyRepo: any = {
    getById: jest.fn(),
  };
  const messagingProvider: any = {
    sendWhatsAppMessage: jest.fn(),
    sendTelegramMessage: jest.fn(),
  };
  const messagingResolver: any = {
    resolveWhatsAppConfig: jest.fn(),
    resolveTelegramConfig: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    messagingResolver.resolveWhatsAppConfig.mockResolvedValue({
      accountId: 'wa_primary',
      label: 'Main Company Number',
      accessToken: 'token-123',
      phoneNumberId: '123456',
      apiVersion: 'v22.0',
    });
    messagingProvider.sendWhatsAppMessage.mockResolvedValue({
      provider: 'meta_whatsapp_cloud',
      messageId: 'wamid.123',
    });
    messagingResolver.resolveTelegramConfig.mockResolvedValue({
      accountId: 'tg_primary',
      label: 'Main Telegram Bot',
      botToken: 'token-telegram',
    });
    messagingProvider.sendTelegramMessage.mockResolvedValue({
      provider: 'telegram_bot',
      messageId: '55001',
    });
  });

  it('sends posted invoice using customer phone fallback', async () => {
    salesInvoiceRepo.getById.mockResolvedValue({
      id: 'si_1',
      companyId: 'c1',
      invoiceNumber: 'SI-1001',
      customerId: 'cust_1',
      customerName: 'Acme Ltd',
      grandTotalDoc: 1000,
      currency: 'USD',
      invoiceDate: '2026-05-22',
      status: 'POSTED',
    });
    partyRepo.getById.mockResolvedValue({
      id: 'cust_1',
      companyId: 'c1',
      phone: '+905551112233',
    });

    const useCase = new SendSalesInvoiceWhatsappUseCase(
      salesInvoiceRepo,
      partyRepo,
      messagingProvider,
      messagingResolver,
      'https://erp.example.com'
    );

    const result = await useCase.execute({
      companyId: 'c1',
      invoiceId: 'si_1',
    });

    expect(messagingProvider.sendWhatsAppMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        toPhoneNumberE164: '+905551112233',
      }),
      expect.objectContaining({
        phoneNumberId: '123456',
      })
    );
    expect(result.messageId).toBe('wamid.123');
    expect(result.recipientPhoneNumber).toBe('+905551112233');
    expect(result.senderAccountId).toBe('wa_primary');
  });

  it('rejects non-posted invoices', async () => {
    salesInvoiceRepo.getById.mockResolvedValue({
      id: 'si_2',
      companyId: 'c1',
      invoiceNumber: 'SI-1002',
      customerId: 'cust_1',
      customerName: 'Acme Ltd',
      grandTotalDoc: 1000,
      currency: 'USD',
      invoiceDate: '2026-05-22',
      status: 'DRAFT',
    });

    const useCase = new SendSalesInvoiceWhatsappUseCase(
      salesInvoiceRepo,
      partyRepo,
      messagingProvider,
      messagingResolver
    );

    await expect(useCase.execute({
      companyId: 'c1',
      invoiceId: 'si_2',
    })).rejects.toThrow('Only posted sales invoices can be sent via WhatsApp.');
  });

  it('rejects invalid phone numbers', async () => {
    salesInvoiceRepo.getById.mockResolvedValue({
      id: 'si_3',
      companyId: 'c1',
      invoiceNumber: 'SI-1003',
      customerId: 'cust_1',
      customerName: 'Acme Ltd',
      grandTotalDoc: 1000,
      currency: 'USD',
      invoiceDate: '2026-05-22',
      status: 'POSTED',
    });
    partyRepo.getById.mockResolvedValue({
      id: 'cust_1',
      companyId: 'c1',
      phone: '0555 111 2233',
    });

    const useCase = new SendSalesInvoiceWhatsappUseCase(
      salesInvoiceRepo,
      partyRepo,
      messagingProvider,
      messagingResolver
    );

    await expect(useCase.execute({
      companyId: 'c1',
      invoiceId: 'si_3',
    })).rejects.toThrow('Phone number must include country code');
  });
});

describe('SendSalesInvoiceTelegramUseCase', () => {
  const salesInvoiceRepo: any = {
    getById: jest.fn(),
  };
  const partyRepo: any = {
    getById: jest.fn(),
  };
  const messagingProvider: any = {
    sendWhatsAppMessage: jest.fn(),
    sendTelegramMessage: jest.fn(),
  };
  const messagingResolver: any = {
    resolveWhatsAppConfig: jest.fn(),
    resolveTelegramConfig: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    messagingResolver.resolveTelegramConfig.mockResolvedValue({
      accountId: 'tg_primary',
      label: 'Main Telegram Bot',
      botToken: 'token-telegram',
    });
    messagingProvider.sendTelegramMessage.mockResolvedValue({
      provider: 'telegram_bot',
      messageId: '55001',
    });
  });

  it('sends posted invoice to telegram chat id', async () => {
    salesInvoiceRepo.getById.mockResolvedValue({
      id: 'si_10',
      companyId: 'c1',
      invoiceNumber: 'SI-2201',
      customerId: 'cust_1',
      customerName: 'Acme Ltd',
      grandTotalDoc: 1550,
      currency: 'USD',
      invoiceDate: '2026-05-23',
      status: 'POSTED',
    });
    partyRepo.getById.mockResolvedValue({
      id: 'cust_1',
      companyId: 'c1',
    });

    const useCase = new SendSalesInvoiceTelegramUseCase(
      salesInvoiceRepo,
      partyRepo,
      messagingProvider,
      messagingResolver,
      'https://erp.example.com'
    );

    const result = await useCase.execute({
      companyId: 'c1',
      invoiceId: 'si_10',
      toChatId: '-1001234567890',
    });

    expect(messagingProvider.sendTelegramMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        toChatIdOrUsername: '-1001234567890',
      }),
      expect.objectContaining({
        botToken: 'token-telegram',
      })
    );
    expect(result.messageId).toBe('55001');
    expect(result.senderAccountId).toBe('tg_primary');
  });

  it('rejects when telegram recipient is missing', async () => {
    salesInvoiceRepo.getById.mockResolvedValue({
      id: 'si_11',
      companyId: 'c1',
      invoiceNumber: 'SI-2202',
      customerId: 'cust_1',
      customerName: 'Acme Ltd',
      grandTotalDoc: 300,
      currency: 'USD',
      invoiceDate: '2026-05-23',
      status: 'POSTED',
    });
    partyRepo.getById.mockResolvedValue({
      id: 'cust_1',
      companyId: 'c1',
    });

    const useCase = new SendSalesInvoiceTelegramUseCase(
      salesInvoiceRepo,
      partyRepo,
      messagingProvider,
      messagingResolver
    );

    await expect(
      useCase.execute({
        companyId: 'c1',
        invoiceId: 'si_11',
      })
    ).rejects.toThrow('Telegram chat id or username is required.');
  });
});
