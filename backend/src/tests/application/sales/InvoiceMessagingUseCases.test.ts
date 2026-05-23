import { SendSalesInvoiceWhatsappUseCase } from '../../../application/sales/use-cases/InvoiceMessagingUseCases';

describe('SendSalesInvoiceWhatsappUseCase', () => {
  const salesInvoiceRepo: any = {
    getById: jest.fn(),
  };
  const partyRepo: any = {
    getById: jest.fn(),
  };
  const messagingProvider: any = {
    sendWhatsAppMessage: jest.fn(),
  };
  const messagingResolver: any = {
    resolveWhatsAppConfig: jest.fn(),
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
