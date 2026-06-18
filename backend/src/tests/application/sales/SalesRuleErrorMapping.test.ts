import { describe, expect, it, jest } from '@jest/globals';
import { Request, Response } from 'express';
import { errorHandler } from '../../../errors/errorHandler';
import { Quote, QuoteLine } from '../../../domain/sales/entities/Quote';
import { IQuoteRepository } from '../../../repository/interfaces/sales/IQuoteRepository';
import {
  AcceptQuoteUseCase,
  ConvertQuoteToSalesOrderUseCase,
} from '../../../application/sales/use-cases/QuoteUseCases';
import { CreateSalesOrderUseCase } from '../../../application/sales/use-cases/SalesOrderUseCases';
import { PostSalesInvoiceUseCase, SettlementInput } from '../../../application/sales/use-cases/SalesInvoiceUseCases';
import { SalesInvoice } from '../../../domain/sales/entities/SalesInvoice';

// ---------------------------------------------------------------------------
// Helper: drive a thrown error through the REAL global error handler and
// capture the HTTP status + JSON body it would produce. This is the contract
// the API client actually sees — a business-rule rejection must come back as a
// structured 4xx with a meaningful domain code, NOT INFRA_999 / HTTP 500.
// ---------------------------------------------------------------------------

function mapThroughErrorHandler(err: unknown): { status: number; body: any } {
  const captured: { status: number; body: any } = { status: 0, body: undefined };
  const res = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: any) {
      captured.body = body;
      return this;
    },
  } as unknown as Response;
  const req = { url: '/test', method: 'POST' } as unknown as Request;
  errorHandler(err as Error, req, res, jest.fn());
  return captured;
}

async function captureRejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error('Expected the use-case to reject, but it resolved');
}

// ---------------------------------------------------------------------------
// Shared quote test data
// ---------------------------------------------------------------------------

const COMPANY_ID = 'cmp-rule-test';
const CUSTOMER_ID = 'cust-001';

function makeQuoteLine(): QuoteLine {
  return {
    lineId: 'line-001',
    lineNo: 1,
    itemId: 'item-001',
    itemCode: 'SKU-001',
    itemName: 'Widget A',
    quotedQty: 10,
    uom: 'EA',
    unitPriceDoc: 100,
    taxRate: 0.1,
    taxAmountDoc: 100,
    taxAmountBase: 100,
    grossLineTotalDoc: 1000,
    lineTotalDoc: 1000,
    unitPriceBase: 100,
    lineTotalBase: 1000,
  };
}

function makeQuote(status: Quote['status']): Quote {
  return new Quote({
    id: 'q-001',
    companyId: COMPANY_ID,
    quoteNumber: 'Q-111',
    customerId: CUSTOMER_ID,
    customerName: 'Acme Corp',
    status,
    version: 1,
    quoteDate: '2026-05-20',
    currency: 'USD',
    exchangeRate: 1,
    lines: [makeQuoteLine()],
    subtotalDoc: 1000,
    taxTotalDoc: 100,
    grandTotalDoc: 1100,
    subtotalBase: 1000,
    taxTotalBase: 100,
    grandTotalBase: 1100,
    createdBy: 'user-test',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeQuoteRepo(quote: Quote): IQuoteRepository {
  return {
    create: jest.fn<IQuoteRepository['create']>().mockResolvedValue(undefined),
    update: jest.fn<IQuoteRepository['update']>().mockResolvedValue(undefined),
    getById: jest.fn<IQuoteRepository['getById']>().mockResolvedValue(quote),
    getByNumber: jest.fn<IQuoteRepository['getByNumber']>().mockResolvedValue(null),
    list: jest.fn<IQuoteRepository['list']>().mockResolvedValue([]),
    delete: jest.fn<IQuoteRepository['delete']>().mockResolvedValue(undefined),
  };
}

// ---------------------------------------------------------------------------
// 1. Quote-lifecycle guards → 400 QUOTE_INVALID_STATE (was INFRA_999 / 500)
// ---------------------------------------------------------------------------

describe('Quote-lifecycle rejections map to a structured 4xx', () => {
  it('accepting a DRAFT quote → 400 QUOTE_INVALID_STATE, message preserved', async () => {
    const repo = makeQuoteRepo(makeQuote('DRAFT'));
    const useCase = new AcceptQuoteUseCase(repo);

    const err = await captureRejection(useCase.execute(COMPANY_ID, 'q-001'));
    const mapped = mapThroughErrorHandler(err);

    expect(mapped.status).toBe(400);
    expect(mapped.body.error.code).toBe('QUOTE_INVALID_STATE');
    expect(mapped.body.error.message).toBe('Cannot mark quote as ACCEPTED from status: DRAFT');
    // Law 5 — the rejection is attributed to the Sales guard.
    expect(mapped.body.error.guard).toBe('sales');
  });

  it('converting a DRAFT quote to a Sales Order → 400 QUOTE_INVALID_STATE', async () => {
    const repo = makeQuoteRepo(makeQuote('DRAFT'));
    const mockSoUseCase = {
      execute: jest.fn<() => Promise<{ id: string }>>().mockResolvedValue({ id: 'so-1' }),
    } as unknown as CreateSalesOrderUseCase;
    const useCase = new ConvertQuoteToSalesOrderUseCase(repo, mockSoUseCase);

    const err = await captureRejection(useCase.execute(COMPANY_ID, 'q-001'));
    const mapped = mapThroughErrorHandler(err);

    expect(mapped.status).toBe(400);
    expect(mapped.body.error.code).toBe('QUOTE_INVALID_STATE');
    expect(mapped.body.error.message).toBe(
      'Quote must be ACCEPTED to convert to a Sales Order (current: DRAFT)'
    );
    // The SO create use-case is never reached when the guard refuses.
    expect(mockSoUseCase.execute).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 2. Over-payment guard → 400 OVERPAYMENT_NOT_ALLOWED (was INFRA_999 / 500)
//    Driven end-to-end through the real settlement posting flow.
// ---------------------------------------------------------------------------

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

const makeSettlementDeps = (invoice: SalesInvoice) => {
  const settings = {
    defaultRevenueAccountId: 'REV-1',
    defaultARAccountId: 'AR-1',
    paymentMethodConfigs: [{ method: 'CASH', settlementAccountId: 'CASH-1', isEnabled: true }],
    allowDirectInvoicing: true,
    allowOverpayment: false,
    overInvoiceTolerancePct: 0,
  };
  const party = { id: 'cust-1', displayName: 'Customer A', defaultARAccountId: 'AR-1' };
  const item = {
    id: 'item-1',
    companyId: 'cmp-1',
    name: 'Item 1',
    code: 'I1',
    trackInventory: false,
    baseUomId: 'uom-1',
    baseUom: 'EA',
    salesUomId: 'uom-1',
    salesUom: 'EA',
  };

  return {
    settingsRepo: { getSettings: jest.fn<any>().mockResolvedValue(settings) },
    inventorySettingsRepo: { getSettings: jest.fn<any>().mockResolvedValue(null) },
    salesInvoiceRepo: {
      getById: jest.fn<any>().mockResolvedValue(invoice),
      update: jest.fn<any>().mockResolvedValue(undefined),
    },
    salesOrderRepo: { update: jest.fn<any>().mockResolvedValue(undefined) },
    deliveryNoteRepo: { listByCompany: jest.fn<any>().mockResolvedValue([]) },
    partyRepo: { getById: jest.fn<any>().mockResolvedValue(party) },
    taxCodeRepo: { listByCompany: jest.fn<any>().mockResolvedValue([]) },
    itemRepo: { getItem: jest.fn<any>().mockResolvedValue(item), listByIds: jest.fn<any>().mockResolvedValue([item]) },
    itemCategoryRepo: {
      getCompanyCategories: jest.fn<any>().mockResolvedValue([]),
      listByIds: jest.fn<any>().mockResolvedValue([]),
    },
    warehouseRepo: { listByIds: jest.fn<any>().mockResolvedValue([]) },
    uomConversionRepo: { getConversionsForItem: jest.fn<any>().mockResolvedValue([]) },
    companyCurrencyRepo: { getBaseCurrency: jest.fn<any>().mockResolvedValue('USD') },
    inventoryService: {
      preFetchStockLevel: jest.fn<any>().mockResolvedValue(null),
      recordStockMovement: jest.fn<any>().mockResolvedValue(undefined),
    },
    companyModuleRepo: { get: jest.fn<any>().mockResolvedValue({ initialized: true }) },
    accountingPostingService: { postInTransaction: jest.fn<any>().mockResolvedValue({ id: 'vch-rev-1' }) },
    accountRepo: undefined,
    transactionManager: { runTransaction: jest.fn<any>(async (fn: any) => fn()) },
    paymentHistoryRepo: { create: jest.fn<any>().mockResolvedValue(undefined) },
    voucherRepo: { save: jest.fn<any>().mockResolvedValue(undefined) },
    voucherSequenceRepo: { getNextNumber: jest.fn<any>().mockResolvedValue('RV-001') },
    ledgerRepo: { recordForVoucher: jest.fn<any>().mockResolvedValue(undefined) },
  };
};

const buildPostUseCase = (deps: ReturnType<typeof makeSettlementDeps>) =>
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

describe('Over-payment rejection maps to a structured 4xx', () => {
  it('MULTI settlement exceeding outstanding (overpayment off) → 400 OVERPAYMENT_NOT_ALLOWED', async () => {
    const invoice = buildPostedInvoice(1000);
    const deps = makeSettlementDeps(invoice);
    const useCase = buildPostUseCase(deps);

    const overpaidSettlement: SettlementInput = {
      settlementMode: 'MULTI',
      receivablePayableAccountId: 'AR-1',
      settlements: [{ amountBase: 1500, paymentMethod: 'CASH', paymentDate: '2026-05-02' }],
    };

    const err = await captureRejection(
      useCase.execute('cmp-1', invoice.id, true, undefined, overpaidSettlement)
    );
    const mapped = mapThroughErrorHandler(err);

    expect(mapped.status).toBe(400);
    expect(mapped.body.error.code).toBe('OVERPAYMENT_NOT_ALLOWED');
    expect(mapped.body.error.message).toBe(
      'MULTI settlement total (1500) exceeds outstanding amount (1000). Enable "allow over-payment" in Sales settings to record the excess as a customer credit.'
    );
    expect(mapped.body.error.guard).toBe('sales');
  });
});
