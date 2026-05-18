import { RecordSalesInvoicePaymentUseCase, PostSalesInvoiceWithSettlementInput } from '../../../application/sales/use-cases/PaymentSyncUseCases';
import { SalesInvoice } from '../../../domain/sales/entities/SalesInvoice';

const buildPostedInvoice = (grandTotalBase = 100, paidAmountBase = 0) =>
  new SalesInvoice({
    id: 'si-1',
    companyId: 'cmp-1',
    invoiceNumber: 'SI-1',
    formType: 'sales_invoice_direct',
    voucherType: 'sales_invoice',
    persona: 'direct',
    customerId: 'cust-1',
    customerName: 'Customer A',
    invoiceDate: '2026-05-02',
    currency: 'USD',
    exchangeRate: 1,
    lines: [
      {
        lineId: 'line-1',
        lineNo: 1,
        itemId: 'item-1',
        itemCode: 'I1',
        itemName: 'Item 1',
        trackInventory: false,
        invoicedQty: 1,
        uom: 'EA',
        unitPriceDoc: grandTotalBase,
        lineTotalDoc: grandTotalBase,
        unitPriceBase: grandTotalBase,
        lineTotalBase: grandTotalBase,
        taxRate: 0,
        taxAmountDoc: 0,
        taxAmountBase: 0,
        revenueAccountId: 'REV-1',
      },
    ],
    subtotalDoc: grandTotalBase,
    taxTotalDoc: 0,
    grandTotalDoc: grandTotalBase,
    subtotalBase: grandTotalBase,
    taxTotalBase: 0,
    grandTotalBase,
    paymentTermsDays: 0,
    paymentStatus: paidAmountBase > 0 ? (paidAmountBase >= grandTotalBase ? 'PAID' : 'PARTIALLY_PAID') : 'UNPAID',
    paidAmountBase,
    outstandingAmountBase: grandTotalBase - paidAmountBase,
    status: 'POSTED',
    createdBy: 'u-1',
    createdAt: new Date('2026-05-02T00:00:00.000Z'),
    updatedAt: new Date('2026-05-02T00:00:00.000Z'),
  });

const makeDeps = (invoice: SalesInvoice) => ({
  salesInvoiceRepo: {
    getById: jest.fn().mockResolvedValue(invoice),
    update: jest.fn().mockResolvedValue(undefined),
  },
  paymentHistoryRepo: {
    create: jest.fn().mockResolvedValue(undefined),
  },
  salesSettingsRepo: {
    getSettings: jest.fn().mockResolvedValue({
      defaultARAccountId: 'AR-1',
      paymentMethodConfigs: [
        { method: 'CASH', settlementAccountId: 'CASH-1', isEnabled: true },
        { method: 'BANK_TRANSFER', settlementAccountId: 'BANK-1', isEnabled: true },
      ],
    }),
  },
  voucherRepo: {
    save: jest.fn().mockResolvedValue(undefined),
  },
  voucherSequenceRepo: {
    getNextNumber: jest.fn().mockResolvedValue('RV-001'),
  },
  ledgerRepo: {
    recordForVoucher: jest.fn().mockResolvedValue(undefined),
  },
  companyCurrencyRepo: {
    getBaseCurrency: jest.fn().mockResolvedValue('USD'),
  },
  transactionManager: {
    runTransaction: jest.fn(async (fn) => fn()),
  },
});

const makeSettlementInput = (amountBase: number, mode: 'CASH_FULL' | 'MULTI' = 'CASH_FULL'): PostSalesInvoiceWithSettlementInput => ({
  settlementMode: mode,
  receivablePayableAccountId: 'AR-1',
  settlements: [{
    amountBase,
    paymentMethod: 'CASH',
    paymentDate: '2026-05-02',
  }],
});

const postingAccount = (id: string, userCode = id) => ({
  id,
  userCode,
  code: userCode,
  name: userCode,
  accountRole: 'POSTING',
  status: 'ACTIVE',
});

const headerAccount = (id: string, userCode = id) => ({
  id,
  userCode,
  code: userCode,
  name: userCode,
  accountRole: 'HEADER',
  status: 'ACTIVE',
});

describe('RecordSalesInvoicePaymentUseCase', () => {
  it('records a partial payment via MULTI and marks invoice PARTIALLY_PAID', async () => {
    const invoice = buildPostedInvoice(100, 0);
    const deps = makeDeps(invoice);
    const useCase = new RecordSalesInvoicePaymentUseCase(
      deps.salesInvoiceRepo as any,
      deps.paymentHistoryRepo as any,
      deps.salesSettingsRepo as any,
      deps.voucherRepo as any,
      deps.voucherSequenceRepo as any,
      deps.ledgerRepo as any,
      deps.companyCurrencyRepo as any,
      deps.transactionManager as any
    );

    const result = await useCase.execute('cmp-1', 'u-1', 'si-1', {
      settlementMode: 'MULTI',
      settlements: [{ amountBase: 40, paymentMethod: 'CASH', paymentDate: '2026-05-02' }],
    });

    expect(result.invoice.paidAmountBase).toBe(40);
    expect(result.invoice.outstandingAmountBase).toBe(60);
    expect(result.invoice.paymentStatus).toBe('PARTIALLY_PAID');
    expect(deps.salesInvoiceRepo.update).toHaveBeenCalled();
    expect(deps.paymentHistoryRepo.create).toHaveBeenCalled();
  });

  it('rejects overpayment above outstanding amount', async () => {
    const invoice = buildPostedInvoice(100, 0);
    const deps = makeDeps(invoice);
    const useCase = new RecordSalesInvoicePaymentUseCase(
      deps.salesInvoiceRepo as any,
      deps.paymentHistoryRepo as any,
      deps.salesSettingsRepo as any,
      deps.voucherRepo as any,
      deps.voucherSequenceRepo as any,
      deps.ledgerRepo as any,
      deps.companyCurrencyRepo as any,
      deps.transactionManager as any
    );

    await expect(useCase.execute('cmp-1', 'u-1', 'si-1', makeSettlementInput(120))).rejects.toThrow(
      'CASH_FULL settlement total'
    );
    expect(deps.salesInvoiceRepo.update).not.toHaveBeenCalled();
  });

  it('creates receipt voucher when settlement is provided', async () => {
    const invoice = buildPostedInvoice(100, 0);
    const deps = makeDeps(invoice);
    const useCase = new RecordSalesInvoicePaymentUseCase(
      deps.salesInvoiceRepo as any,
      deps.paymentHistoryRepo as any,
      deps.salesSettingsRepo as any,
      deps.voucherRepo as any,
      deps.voucherSequenceRepo as any,
      deps.ledgerRepo as any,
      deps.companyCurrencyRepo as any,
      deps.transactionManager as any
    );

    const result = await useCase.execute('cmp-1', 'u-1', 'si-1', makeSettlementInput(50, 'MULTI'));

    expect(result.voucherIds.length).toBeGreaterThan(0);
    expect(deps.voucherRepo.save).toHaveBeenCalled();
    expect(deps.ledgerRepo.recordForVoucher).toHaveBeenCalled();
  });

  it('rejects non-posting settlement accounts before recording a later receipt voucher', async () => {
    const invoice = buildPostedInvoice(100, 0);
    const deps = makeDeps(invoice);
    const accounts = new Map<string, any>([
      ['AR-1', postingAccount('AR-1')],
      ['CASH-HEADER', headerAccount('CASH-HEADER')],
    ]);
    const accountRepo = {
      getById: jest.fn(async (_companyId: string, accountId: string) => accounts.get(accountId) ?? null),
      getByUserCode: jest.fn(async (_companyId: string, userCode: string) => accounts.get(userCode) ?? null),
    };
    const useCase = new RecordSalesInvoicePaymentUseCase(
      deps.salesInvoiceRepo as any,
      deps.paymentHistoryRepo as any,
      deps.salesSettingsRepo as any,
      deps.voucherRepo as any,
      deps.voucherSequenceRepo as any,
      deps.ledgerRepo as any,
      deps.companyCurrencyRepo as any,
      deps.transactionManager as any,
      accountRepo as any
    );

    await expect(useCase.execute('cmp-1', 'u-1', 'si-1', {
      settlementMode: 'CASH_FULL',
      receivablePayableAccountId: 'AR-1',
      settlements: [{
        amountBase: 100,
        paymentMethod: 'CASH',
        settlementAccountId: 'CASH-HEADER',
        paymentDate: '2026-05-02',
      }],
    })).rejects.toThrow(/non-POSTING|HEADER/);

    expect(deps.ledgerRepo.recordForVoucher).not.toHaveBeenCalled();
    expect(deps.voucherRepo.save).not.toHaveBeenCalled();
    expect(deps.paymentHistoryRepo.create).not.toHaveBeenCalled();
    expect(deps.salesInvoiceRepo.update).not.toHaveBeenCalled();
  });

  it('resolves settlement account and AR from sales settings when omitted', async () => {
    const invoice = buildPostedInvoice(100, 0);
    const deps = makeDeps(invoice);
    const useCase = new RecordSalesInvoicePaymentUseCase(
      deps.salesInvoiceRepo as any,
      deps.paymentHistoryRepo as any,
      deps.salesSettingsRepo as any,
      deps.voucherRepo as any,
      deps.voucherSequenceRepo as any,
      deps.ledgerRepo as any,
      deps.companyCurrencyRepo as any,
      deps.transactionManager as any
    );

    const result = await useCase.execute('cmp-1', 'u-1', 'si-1', {
      settlementMode: 'MULTI',
      settlements: [{ amountBase: 25, paymentMethod: 'BANK_TRANSFER', paymentDate: '2026-05-02' }],
    });

    expect(result.invoice.paidAmountBase).toBe(25);
    expect(deps.voucherRepo.save).toHaveBeenCalled();
  });

  it('skips voucher creation when DEFERRED mode', async () => {
    const invoice = buildPostedInvoice(100, 0);
    const deps = makeDeps(invoice);
    const useCase = new RecordSalesInvoicePaymentUseCase(
      deps.salesInvoiceRepo as any,
      deps.paymentHistoryRepo as any,
      deps.salesSettingsRepo as any,
      deps.voucherRepo as any,
      deps.voucherSequenceRepo as any,
      deps.ledgerRepo as any,
      deps.companyCurrencyRepo as any,
      deps.transactionManager as any
    );

    const result = await useCase.execute('cmp-1', 'u-1', 'si-1', {
      settlementMode: 'DEFERRED',
      receivablePayableAccountId: 'AR-1',
      settlements: [],
    });

    expect(result.voucherIds.length).toBe(0);
    expect(deps.voucherRepo.save).not.toHaveBeenCalled();
    expect(deps.paymentHistoryRepo.create).not.toHaveBeenCalled();
  });

  it('rejects payment on non-posted invoice', async () => {
    const invoice = buildPostedInvoice(100, 0);
    (invoice as any).status = 'DRAFT';
    const deps = makeDeps(invoice);
    const useCase = new RecordSalesInvoicePaymentUseCase(
      deps.salesInvoiceRepo as any,
      deps.paymentHistoryRepo as any,
      deps.salesSettingsRepo as any,
      deps.voucherRepo as any,
      deps.voucherSequenceRepo as any,
      deps.ledgerRepo as any,
      deps.companyCurrencyRepo as any,
      deps.transactionManager as any
    );

    await expect(useCase.execute('cmp-1', 'u-1', 'si-1', makeSettlementInput(10))).rejects.toThrow(
      'Settlement can only be posted for posted sales invoices'
    );
  });

  it('rejects zero or negative settlement amount', async () => {
    const invoice = buildPostedInvoice(100, 0);
    const deps = makeDeps(invoice);
    const useCase = new RecordSalesInvoicePaymentUseCase(
      deps.salesInvoiceRepo as any,
      deps.paymentHistoryRepo as any,
      deps.salesSettingsRepo as any,
      deps.voucherRepo as any,
      deps.voucherSequenceRepo as any,
      deps.ledgerRepo as any,
      deps.companyCurrencyRepo as any,
      deps.transactionManager as any
    );

    await expect(useCase.execute('cmp-1', 'u-1', 'si-1', {
      settlementMode: 'MULTI',
      receivablePayableAccountId: 'AR-1',
      settlements: [{ amountBase: 0, paymentMethod: 'CASH' }],
    })).rejects.toThrow('Each settlement row amount must be positive');

    await expect(useCase.execute('cmp-1', 'u-1', 'si-1', {
      settlementMode: 'MULTI',
      receivablePayableAccountId: 'AR-1',
      settlements: [{ amountBase: -10, paymentMethod: 'CASH' }],
    })).rejects.toThrow('Each settlement row amount must be positive');
  });
});
