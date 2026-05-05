import { PostSalesInvoiceUseCase, SettlementInput } from '../../../application/sales/use-cases/SalesInvoiceUseCases';
import { SalesInvoice } from '../../../domain/sales/entities/SalesInvoice';

const buildPostedInvoice = (grandTotalBase = 100) =>
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
    paymentStatus: 'UNPAID',
    paidAmountBase: 0,
    outstandingAmountBase: grandTotalBase,
    status: 'DRAFT',
    createdBy: 'u-1',
    createdAt: new Date('2026-05-02T00:00:00.000Z'),
    updatedAt: new Date('2026-05-02T00:00:00.000Z'),
  });

const makeDeps = (invoice: SalesInvoice, opts?: { settlementFail?: boolean }) => {
  const settings = {
    defaultRevenueAccountId: 'REV-1',
    defaultARAccountId: 'AR-1',
    allowDirectInvoicing: true,
    overInvoiceTolerancePct: 0,
  };
  const invSettings = null;
  const party = { id: 'cust-1', displayName: 'Customer A', defaultARAccountId: 'AR-1' };
  const baseCurrency = 'USD';
  const item = { id: 'item-1', companyId: 'cmp-1', name: 'Item 1', code: 'I1', trackInventory: false, baseUomId: 'uom-1', baseUom: 'EA', salesUomId: 'uom-1', salesUom: 'EA' };

  return {
    settingsRepo: { getSettings: jest.fn().mockResolvedValue(settings) },
    inventorySettingsRepo: { getSettings: jest.fn().mockResolvedValue(invSettings) },
    salesInvoiceRepo: {
      getById: jest.fn().mockResolvedValue(invoice),
      update: jest.fn().mockResolvedValue(undefined),
    },
    salesOrderRepo: { update: jest.fn().mockResolvedValue(undefined) },
    deliveryNoteRepo: { listByCompany: jest.fn().mockResolvedValue([]) },
    partyRepo: { getById: jest.fn().mockResolvedValue(party) },
    taxCodeRepo: { listByCompany: jest.fn().mockResolvedValue([]) },
    itemRepo: { getItem: jest.fn().mockResolvedValue(item), listByIds: jest.fn().mockResolvedValue([item]) },
    itemCategoryRepo: { getCompanyCategories: jest.fn().mockResolvedValue([]), listByIds: jest.fn().mockResolvedValue([]) },
    warehouseRepo: { listByIds: jest.fn().mockResolvedValue([]) },
    uomConversionRepo: { getConversionsForItem: jest.fn().mockResolvedValue([]) },
    companyCurrencyRepo: { getBaseCurrency: jest.fn().mockResolvedValue(baseCurrency) },
    inventoryService: {
      preFetchStockLevel: jest.fn().mockResolvedValue(null),
      recordStockMovement: jest.fn().mockResolvedValue(undefined),
    },
    companyModuleRepo: { get: jest.fn().mockResolvedValue({ initialized: true }) },
    accountingPostingService: { postInTransaction: jest.fn().mockResolvedValue({ id: 'vch-rev-1' }) },
    accountRepo: undefined,
    transactionManager: {
      runTransaction: jest.fn(async (fn) => fn()),
    },
    paymentHistoryRepo: {
      create: opts?.settlementFail
        ? jest.fn().mockRejectedValue(new Error('Payment history save failed'))
        : jest.fn().mockResolvedValue(undefined),
    },
    voucherRepo: { save: jest.fn().mockResolvedValue(undefined) },
    voucherSequenceRepo: { getNextNumber: jest.fn().mockResolvedValue('RV-001') },
    ledgerRepo: { recordForVoucher: jest.fn().mockResolvedValue(undefined) },
  };
};

const makeSettlementInput = (amountBase: number, mode: 'CASH_FULL' | 'MULTI' | 'DEFERRED' = 'CASH_FULL'): SettlementInput => ({
  settlementMode: mode,
  receivablePayableAccountId: 'AR-1',
  settlements: mode === 'DEFERRED' ? [] : [{
    settlementAccountId: 'CASH-1',
    amountBase,
    paymentMethod: 'CASH',
    paymentDate: '2026-05-02',
  }],
});

const buildUseCase = (deps: ReturnType<typeof makeDeps>) =>
  new PostSalesInvoiceUseCase(
    deps.settingsRepo as any,
    deps.inventorySettingsRepo as any,
    deps.salesInvoiceRepo as any,
    deps.salesOrderRepo as any,
    deps.deliveryNoteRepo as any,
    deps.partyRepo as any,
    deps.taxCodeRepo as any,
    deps.itemRepo as any,
    deps.itemCategoryRepo as any,
    deps.warehouseRepo as any,
    deps.uomConversionRepo as any,
    deps.companyCurrencyRepo as any,
    deps.inventoryService as any,
    deps.companyModuleRepo as any,
    deps.accountingPostingService as any,
    deps.accountRepo,
    deps.transactionManager as any,
    deps.paymentHistoryRepo as any,
    deps.voucherRepo as any,
    deps.voucherSequenceRepo as any,
    deps.ledgerRepo as any
  );

describe('PostSalesInvoiceUseCase — Settlement Modes', () => {
  it('posts with DEFERRED mode — invoice remains UNPAID', async () => {
    const invoice = buildPostedInvoice(100);
    const deps = makeDeps(invoice);
    const useCase = buildUseCase(deps);

    const result = await useCase.execute('cmp-1', invoice.id, true, undefined, makeSettlementInput(0, 'DEFERRED'));

    expect(result.status).toBe('POSTED');
    expect(result.paymentStatus).toBe('UNPAID');
    expect(result.paidAmountBase).toBe(0);
    expect(result.outstandingAmountBase).toBe(100);
    expect(deps.paymentHistoryRepo.create).not.toHaveBeenCalled();
  });

  it('posts with CASH_FULL mode — invoice becomes PAID', async () => {
    const invoice = buildPostedInvoice(100);
    const deps = makeDeps(invoice);
    const useCase = buildUseCase(deps);

    const result = await useCase.execute('cmp-1', invoice.id, true, undefined, makeSettlementInput(100, 'CASH_FULL'));

    expect(result.status).toBe('POSTED');
    expect(result.paymentStatus).toBe('PAID');
    expect(result.paidAmountBase).toBe(100);
    expect(result.outstandingAmountBase).toBe(0);
    expect(deps.paymentHistoryRepo.create).toHaveBeenCalled();
    expect(deps.voucherRepo.save).toHaveBeenCalled();
  });

  it('posts with MULTI mode — partial settlement marks PARTIALLY_PAID', async () => {
    const invoice = buildPostedInvoice(100);
    const deps = makeDeps(invoice);
    const useCase = buildUseCase(deps);

    const result = await useCase.execute('cmp-1', invoice.id, true, undefined, {
      settlementMode: 'MULTI',
      receivablePayableAccountId: 'AR-1',
      settlements: [
        { settlementAccountId: 'CASH-1', amountBase: 40, paymentMethod: 'CASH', paymentDate: '2026-05-02' },
        { settlementAccountId: 'BANK-1', amountBase: 30, paymentMethod: 'BANK_TRANSFER', paymentDate: '2026-05-02' },
      ],
    });

    expect(result.status).toBe('POSTED');
    expect(result.paymentStatus).toBe('PARTIALLY_PAID');
    expect(result.paidAmountBase).toBe(70);
    expect(result.outstandingAmountBase).toBe(30);
    expect(deps.paymentHistoryRepo.create).toHaveBeenCalledTimes(2);
  });

  it('rolls back atomically when settlement sub-step fails', async () => {
    const invoice = buildPostedInvoice(100);
    const deps = makeDeps(invoice, { settlementFail: true });
    const useCase = buildUseCase(deps);

    await expect(useCase.execute('cmp-1', invoice.id, true, undefined, makeSettlementInput(100, 'CASH_FULL'))).rejects.toThrow(
      'Payment history save failed'
    );

    expect(deps.salesInvoiceRepo.update).not.toHaveBeenCalled();
  });
});
