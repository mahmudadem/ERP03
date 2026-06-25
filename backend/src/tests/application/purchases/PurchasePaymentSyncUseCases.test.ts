import { RecordPurchaseInvoicePaymentUseCase, PostPurchaseInvoiceWithSettlementInput } from '../../../application/purchases/use-cases/PaymentSyncUseCases';
import { PurchaseInvoice } from '../../../domain/purchases/entities/PurchaseInvoice';

const buildPostedInvoice = (grandTotalBase = 100, paidAmountBase = 0) =>
  new PurchaseInvoice({
    id: 'pi-1',
    companyId: 'cmp-1',
    invoiceNumber: 'PI-1',
    formType: 'purchase_invoice_direct',
    voucherType: 'purchase_invoice',
    persona: 'direct',
    vendorId: 'vendor-1',
    vendorName: 'Vendor A',
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
        accountId: 'EXP-1',
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

const makeDeps = (invoice: PurchaseInvoice) => ({
  purchaseInvoiceRepo: {
    getById: jest.fn().mockResolvedValue(invoice),
    update: jest.fn().mockResolvedValue(undefined),
  },
  paymentHistoryRepo: {
    create: jest.fn().mockResolvedValue(undefined),
  },
  purchaseSettingsRepo: {
    getSettings: jest.fn().mockResolvedValue({ defaultAPAccountId: 'AP-1' }),
  },
  voucherRepo: {
    save: jest.fn().mockResolvedValue(undefined),
  },
  voucherSequenceRepo: {
    getNextNumber: jest.fn().mockResolvedValue('PV-001'),
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

const makeSettlementInput = (amountBase: number, mode: 'CASH_FULL' | 'MULTI' = 'CASH_FULL'): PostPurchaseInvoiceWithSettlementInput => ({
  settlementMode: mode,
  receivablePayableAccountId: 'AP-1',
  settlements: [{
    settlementAccountId: 'CASH-1',
    amountBase,
    paymentMethod: 'CASH',
    paymentDate: '2026-05-02',
  }],
});

const makeFullBridge = () => ({
  recordFinancialEvent: jest.fn(async () => {
    throw new Error('Purchase PaymentSync should not record subledger financial events');
  }),
  recordPreBuiltVoucher: jest.fn(async (event: any) => {
    await event.postFull();
    return { mode: 'full', voucher: event.voucher };
  }),
});

describe('RecordPurchaseInvoicePaymentUseCase', () => {
  it('records full payment via CASH_FULL and marks invoice PAID', async () => {
    const invoice = buildPostedInvoice(100, 0);
    const deps = makeDeps(invoice);
    const useCase = new RecordPurchaseInvoicePaymentUseCase(
      deps.purchaseInvoiceRepo as any,
      deps.paymentHistoryRepo as any,
      deps.purchaseSettingsRepo as any,
      deps.voucherRepo as any,
      deps.voucherSequenceRepo as any,
      deps.ledgerRepo as any,
      deps.companyCurrencyRepo as any,
      deps.transactionManager as any,
      makeFullBridge() as any
    );

    const result = await useCase.execute('cmp-1', 'u-1', 'pi-1', makeSettlementInput(100));

    expect(result.invoice.paidAmountBase).toBe(100);
    expect(result.invoice.outstandingAmountBase).toBe(0);
    expect(result.invoice.paymentStatus).toBe('PAID');
    expect(deps.purchaseInvoiceRepo.update).toHaveBeenCalled();
    expect(deps.paymentHistoryRepo.create).toHaveBeenCalled();
  });

  it('rejects zero or negative settlement amount', async () => {
    const invoice = buildPostedInvoice(100, 0);
    const deps = makeDeps(invoice);
    const useCase = new RecordPurchaseInvoicePaymentUseCase(
      deps.purchaseInvoiceRepo as any,
      deps.paymentHistoryRepo as any,
      deps.purchaseSettingsRepo as any,
      deps.voucherRepo as any,
      deps.voucherSequenceRepo as any,
      deps.ledgerRepo as any,
      deps.companyCurrencyRepo as any,
      deps.transactionManager as any,
      makeFullBridge() as any
    );

    await expect(useCase.execute('cmp-1', 'u-1', 'pi-1', {
      settlementMode: 'MULTI',
      receivablePayableAccountId: 'AP-1',
      settlements: [{ settlementAccountId: 'CASH-1', amountBase: 0, paymentMethod: 'CASH' }],
    })).rejects.toThrow('Each settlement row amount must be positive');

    expect(deps.purchaseInvoiceRepo.update).not.toHaveBeenCalled();
  });

  it('creates payment voucher when settlement is provided', async () => {
    const invoice = buildPostedInvoice(100, 0);
    const deps = makeDeps(invoice);
    const useCase = new RecordPurchaseInvoicePaymentUseCase(
      deps.purchaseInvoiceRepo as any,
      deps.paymentHistoryRepo as any,
      deps.purchaseSettingsRepo as any,
      deps.voucherRepo as any,
      deps.voucherSequenceRepo as any,
      deps.ledgerRepo as any,
      deps.companyCurrencyRepo as any,
      deps.transactionManager as any,
      makeFullBridge() as any
    );

    const result = await useCase.execute('cmp-1', 'u-1', 'pi-1', makeSettlementInput(50, 'MULTI'));

    expect(result.voucherIds.length).toBeGreaterThan(0);
    expect(deps.voucherRepo.save).toHaveBeenCalled();
    expect(deps.ledgerRepo.recordForVoucher).toHaveBeenCalled();
  });

  it('rejects overpayment above outstanding amount', async () => {
    const invoice = buildPostedInvoice(100, 0);
    const deps = makeDeps(invoice);
    const useCase = new RecordPurchaseInvoicePaymentUseCase(
      deps.purchaseInvoiceRepo as any,
      deps.paymentHistoryRepo as any,
      deps.purchaseSettingsRepo as any,
      deps.voucherRepo as any,
      deps.voucherSequenceRepo as any,
      deps.ledgerRepo as any,
      deps.companyCurrencyRepo as any,
      deps.transactionManager as any,
      makeFullBridge() as any
    );

    await expect(useCase.execute('cmp-1', 'u-1', 'pi-1', makeSettlementInput(150))).rejects.toThrow(
      'CASH_FULL settlement total'
    );
  });

  it('skips voucher creation when DEFERRED mode', async () => {
    const invoice = buildPostedInvoice(100, 0);
    const deps = makeDeps(invoice);
    const useCase = new RecordPurchaseInvoicePaymentUseCase(
      deps.purchaseInvoiceRepo as any,
      deps.paymentHistoryRepo as any,
      deps.purchaseSettingsRepo as any,
      deps.voucherRepo as any,
      deps.voucherSequenceRepo as any,
      deps.ledgerRepo as any,
      deps.companyCurrencyRepo as any,
      deps.transactionManager as any,
      makeFullBridge() as any
    );

    const result = await useCase.execute('cmp-1', 'u-1', 'pi-1', {
      settlementMode: 'DEFERRED',
      receivablePayableAccountId: 'AP-1',
      settlements: [],
    });

    expect(result.voucherIds.length).toBe(0);
    expect(deps.voucherRepo.save).not.toHaveBeenCalled();
    expect(deps.paymentHistoryRepo.create).not.toHaveBeenCalled();
  });

  it('rejects MULTI over-payment when allowOverpayment is off (default)', async () => {
    const invoice = buildPostedInvoice(100, 0);
    const deps = makeDeps(invoice);
    const useCase = new RecordPurchaseInvoicePaymentUseCase(
      deps.purchaseInvoiceRepo as any,
      deps.paymentHistoryRepo as any,
      deps.purchaseSettingsRepo as any,
      deps.voucherRepo as any,
      deps.voucherSequenceRepo as any,
      deps.ledgerRepo as any,
      deps.companyCurrencyRepo as any,
      deps.transactionManager as any,
      makeFullBridge() as any
    );

    await expect(useCase.execute('cmp-1', 'u-1', 'pi-1', makeSettlementInput(150, 'MULTI'))).rejects.toThrow(
      'exceeds outstanding amount'
    );
    expect(deps.purchaseInvoiceRepo.update).not.toHaveBeenCalled();
  });

  it('resolves AP from the vendor sub-account when receivablePayableAccountId is omitted (Record-Payment dialog path; GP04-step9 regression)', async () => {
    // The shared RecordPaymentDialog sends only the cash account + amount, never the
    // AP account. Before the fix the use case required receivablePayableAccountId and
    // 500'd with "receivablePayableAccountId is required" on every tenant whose
    // settings.defaultAPAccountId was unset — even though the vendor already had an AP
    // sub-account. Mirrors the Sales-side GP03-step13a fix.
    const invoice = buildPostedInvoice(100, 0);
    const deps = makeDeps(invoice);
    // No settings default AP — force the vendor fallback to be the only resolver.
    deps.purchaseSettingsRepo.getSettings = jest.fn().mockResolvedValue({});
    const partyRepo = {
      getById: jest.fn().mockResolvedValue({ defaultAPAccountId: '20100-VEND-1' }),
    };
    const accountRepo = {
      getById: jest.fn(async (_c: string, id: string) => ({ id })),
      getByUserCode: jest.fn().mockResolvedValue(null),
    };
    const useCase = new RecordPurchaseInvoicePaymentUseCase(
      deps.purchaseInvoiceRepo as any,
      deps.paymentHistoryRepo as any,
      deps.purchaseSettingsRepo as any,
      deps.voucherRepo as any,
      deps.voucherSequenceRepo as any,
      deps.ledgerRepo as any,
      deps.companyCurrencyRepo as any,
      deps.transactionManager as any,
      makeFullBridge() as any,
      accountRepo as any,
      partyRepo as any
    );

    const result = await useCase.execute('cmp-1', 'u-1', 'pi-1', {
      settlementMode: 'MULTI',
      // receivablePayableAccountId intentionally omitted — as the dialog sends it.
      settlements: [{ settlementAccountId: 'CASH-1', amountBase: 100, paymentMethod: 'CASH', paymentDate: '2026-05-02' }],
    });

    expect(result.invoice.paymentStatus).toBe('PAID');
    expect(result.invoice.outstandingAmountBase).toBe(0);
    expect(partyRepo.getById).toHaveBeenCalledWith('cmp-1', 'vendor-1');

    // The payment voucher debits the vendor's own AP sub-account (not a settings default).
    const savedVoucher = deps.voucherRepo.save.mock.calls[0][0];
    const debitLines = savedVoucher.lines.filter((l: any) => l.side === 'Debit');
    expect(debitLines).toHaveLength(1);
    expect(debitLines[0].accountId).toBe('20100-VEND-1');
    expect(debitLines[0].debitAmount).toBe(100);
    const creditLines = savedVoucher.lines.filter((l: any) => l.side === 'Credit');
    expect(creditLines[0].accountId).toBe('CASH-1');
  });

  it('throws a clear error when no AP account can be resolved (no explicit id, no vendor AP, no settings default)', async () => {
    const invoice = buildPostedInvoice(100, 0);
    const deps = makeDeps(invoice);
    deps.purchaseSettingsRepo.getSettings = jest.fn().mockResolvedValue({});
    const partyRepo = { getById: jest.fn().mockResolvedValue({}) };
    const useCase = new RecordPurchaseInvoicePaymentUseCase(
      deps.purchaseInvoiceRepo as any,
      deps.paymentHistoryRepo as any,
      deps.purchaseSettingsRepo as any,
      deps.voucherRepo as any,
      deps.voucherSequenceRepo as any,
      deps.ledgerRepo as any,
      deps.companyCurrencyRepo as any,
      deps.transactionManager as any,
      makeFullBridge() as any,
      undefined,
      partyRepo as any
    );

    await expect(useCase.execute('cmp-1', 'u-1', 'pi-1', {
      settlementMode: 'MULTI',
      settlements: [{ settlementAccountId: 'CASH-1', amountBase: 100, paymentMethod: 'CASH' }],
    })).rejects.toThrow('Purchase default AP account must be configured');
    expect(deps.voucherRepo.save).not.toHaveBeenCalled();
  });

  it('allows MULTI over-payment when allowOverpayment is on, debiting AP in full (vendor credit) and marking PAID', async () => {
    const invoice = buildPostedInvoice(100, 0);
    const deps = makeDeps(invoice);
    deps.purchaseSettingsRepo.getSettings = jest.fn().mockResolvedValue({ defaultAPAccountId: 'AP-1', allowOverpayment: true });
    const useCase = new RecordPurchaseInvoicePaymentUseCase(
      deps.purchaseInvoiceRepo as any,
      deps.paymentHistoryRepo as any,
      deps.purchaseSettingsRepo as any,
      deps.voucherRepo as any,
      deps.voucherSequenceRepo as any,
      deps.ledgerRepo as any,
      deps.companyCurrencyRepo as any,
      deps.transactionManager as any,
      makeFullBridge() as any
    );

    const result = await useCase.execute('cmp-1', 'u-1', 'pi-1', makeSettlementInput(150, 'MULTI'));

    // Invoice fully settled; the over-payment lives in the AP ledger as a negative balance (vendor owes us).
    expect(result.invoice.paymentStatus).toBe('PAID');
    expect(result.invoice.paidAmountBase).toBe(150);
    expect(result.invoice.outstandingAmountBase).toBe(0);

    // The payment voucher debits AP by the FULL cash paid (150) -> drives the party's AP negative.
    const savedVoucher = deps.voucherRepo.save.mock.calls[0][0];
    const debitLines = savedVoucher.lines.filter((l: any) => l.side === 'Debit');
    expect(debitLines).toHaveLength(1);
    expect(debitLines[0].debitAmount).toBe(150);
  });
});
