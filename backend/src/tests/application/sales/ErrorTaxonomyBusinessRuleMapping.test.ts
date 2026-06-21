import { describe, expect, it, jest } from '@jest/globals';
import { Request, Response } from 'express';
import { errorHandler } from '../../../errors/errorHandler';
import { ErrorCode } from '../../../errors/ErrorCodes';
import { PostSalesInvoiceUseCase, SettlementInput } from '../../../application/sales/use-cases/SalesInvoiceUseCases';
import { SalesInvoice } from '../../../domain/sales/entities/SalesInvoice';
import { SubmitVoucherUseCase } from '../../../application/accounting/use-cases/SubmitVoucherUseCase';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { VoucherLineEntity } from '../../../domain/accounting/entities/VoucherLineEntity';
import { VoucherStatus, VoucherType } from '../../../domain/accounting/types/VoucherTypes';

function mapThroughErrorHandler(err: unknown): { status: number; body: any } {
  const captured: { status: number; body: any } = { status: 0, body: undefined };
  const res = {
    status(code: number) { captured.status = code; return this; },
    json(body: any) { captured.body = body; return this; },
  } as unknown as Response;
  const req = { url: '/test', method: 'POST' } as unknown as Request;
  errorHandler(err as Error, req, res, jest.fn());
  return captured;
}

async function captureRejection(promise: Promise<unknown>): Promise<unknown> {
  try { await promise; } catch (err) { return err; }
  throw new Error('Expected the use-case to reject, but it resolved');
}

const buildInvoice = (status: SalesInvoice['status'], grandTotalBase = 100) =>
  new SalesInvoice({
    id: 'si-1', companyId: 'cmp-1', invoiceNumber: 'SI-1',
    formType: 'sales_invoice_direct', voucherType: 'sales_invoice', persona: 'direct',
    customerId: 'cust-1', customerName: 'Customer A',
    invoiceDate: '2026-05-02', currency: 'USD', exchangeRate: 1,
    lines: [{
      lineId: 'line-1', lineNo: 1, itemId: 'item-1', itemCode: 'I1', itemName: 'Item 1',
      trackInventory: false, invoicedQty: 1, uom: 'EA',
      unitPriceDoc: grandTotalBase, lineTotalDoc: grandTotalBase,
      unitPriceBase: grandTotalBase, lineTotalBase: grandTotalBase,
      taxRate: 0, taxAmountDoc: 0, taxAmountBase: 0, revenueAccountId: 'REV-1',
    }],
    subtotalDoc: grandTotalBase, taxTotalDoc: 0, grandTotalDoc: grandTotalBase,
    subtotalBase: grandTotalBase, taxTotalBase: 0, grandTotalBase,
    paymentTermsDays: 0, paymentStatus: 'UNPAID',
    paidAmountBase: 0, outstandingAmountBase: grandTotalBase,
    status, createdBy: 'u-1',
    createdAt: new Date('2026-05-02T00:00:00.000Z'),
    updatedAt: new Date('2026-05-02T00:00:00.000Z'),
  });

const makeDeps = (invoice: SalesInvoice) => {
  const settings = {
    defaultRevenueAccountId: 'REV-1', defaultARAccountId: 'AR-1',
    paymentMethodConfigs: [{ method: 'CASH', settlementAccountId: 'CASH-1', isEnabled: true }],
    allowDirectInvoicing: true, allowOverpayment: false, overInvoiceTolerancePct: 0,
  };
  const party = { id: 'cust-1', displayName: 'Customer A', defaultARAccountId: 'AR-1' };
  const item = {
    id: 'item-1', companyId: 'cmp-1', name: 'Item 1', code: 'I1', trackInventory: false,
    baseUomId: 'uom-1', baseUom: 'EA', salesUomId: 'uom-1', salesUom: 'EA',
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
    itemRepo: {
      getItem: jest.fn<any>().mockResolvedValue(item),
      listByIds: jest.fn<any>().mockResolvedValue([item]),
      updateItemInTransaction: jest.fn<any>().mockResolvedValue(undefined),
    },
    itemCategoryRepo: { getCompanyCategories: jest.fn<any>().mockResolvedValue([]), listByIds: jest.fn<any>().mockResolvedValue([]) },
    warehouseRepo: { listByIds: jest.fn<any>().mockResolvedValue([]) },
    uomConversionRepo: { getConversionsForItem: jest.fn<any>().mockResolvedValue([]) },
    companyCurrencyRepo: { getBaseCurrency: jest.fn<any>().mockResolvedValue('USD') },
    inventoryService: {
      preFetchStockLevel: jest.fn<any>().mockResolvedValue(null),
      preFetchLevelsByItem: jest.fn<any>().mockResolvedValue([]),
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

const buildPostUseCase = (deps: ReturnType<typeof makeDeps>) =>
  new PostSalesInvoiceUseCase(
    deps.settingsRepo as any, deps.inventorySettingsRepo as any,
    deps.salesInvoiceRepo as any, deps.salesOrderRepo as any,
    deps.deliveryNoteRepo as any, deps.partyRepo as any,
    deps.taxCodeRepo as any, deps.itemRepo as any,
    deps.itemCategoryRepo as any, deps.warehouseRepo as any,
    deps.uomConversionRepo as any, deps.companyCurrencyRepo as any,
    deps.inventoryService as any, deps.companyModuleRepo as any,
    deps.accountingPostingService as any, deps.accountRepo,
    deps.transactionManager as any, deps.paymentHistoryRepo as any,
    deps.voucherRepo as any, deps.voucherSequenceRepo as any, deps.ledgerRepo as any
  );

describe('Task 246: Sales-invoice state guards map to a structured 4xx', () => {
  it('re-posting an already-POSTED SI → 400 SALES_ALREADY_POSTED, no duplicate voucher', async () => {
    const posted = new SalesInvoice({
      ...buildInvoice('POSTED', 1000), paymentStatus: 'PAID',
      paidAmountBase: 1000, outstandingAmountBase: 0,
    });
    const deps = makeDeps(posted);
    const useCase = buildPostUseCase(deps);
    const err = await captureRejection(useCase.execute('cmp-1', posted.id, true));
    const mapped = mapThroughErrorHandler(err);
    expect(mapped.status).toBe(400);
    expect(mapped.body.error.code).toBe(ErrorCode.SALES_ALREADY_POSTED);
    expect(mapped.body.error.message).toMatch(/already POSTED/i);
    expect(mapped.body.error.guard).toBe('sales');
    // The clean reject must not create a duplicate voucher / ledger entry.
    expect(deps.ledgerRepo.recordForVoucher).not.toHaveBeenCalled();
    expect(deps.voucherRepo.save).not.toHaveBeenCalled();
  });

  it('posting a CANCELLED SI → 400 SALES_INVALID_STATE', async () => {
    const cancelled = buildInvoice('CANCELLED', 100);
    const deps = makeDeps(cancelled);
    const useCase = buildPostUseCase(deps);
    const err = await captureRejection(useCase.execute('cmp-1', cancelled.id, true));
    const mapped = mapThroughErrorHandler(err);
    expect(mapped.status).toBe(400);
    expect(mapped.body.error.code).toBe(ErrorCode.SALES_INVALID_STATE);
    expect(mapped.body.error.message).toContain('CANCELLED');
    expect(mapped.body.error.guard).toBe('sales');
  });
});

describe('Task 246: SubmitVoucherUseCase + VoucherEntity.submit map to a structured 4xx', () => {
  const makeSubmitDeps = (voucher: VoucherEntity) => {
    const policyConfigProvider = { getConfig: jest.fn<any>().mockResolvedValue({}) };
    const approvalPolicyService = {
      evaluateSmartGates: jest.fn<any>().mockReturnValue({
        mode: 'FLEXIBLE', financialApprovalRequired: false, custodyConfirmationRequired: false,
        requiredCustodians: [], notifyOnlyCustodians: [], missingCustodianAccounts: [],
      }),
      shouldAutoApprove: jest.fn<any>().mockReturnValue(false),
    };
    const getAccountMetadata = jest.fn<any>().mockResolvedValue([]);
    return {
      voucherRepo: {
        findById: jest.fn<any>().mockResolvedValue(voucher),
        save: jest.fn<any>().mockImplementation(async (v) => v),
      },
      policyConfigProvider, approvalPolicyService, getAccountMetadata,
    };
  };

  const buildVoucher = (status: VoucherStatus) =>
    new VoucherEntity(
      'vch-1', 'cmp-1', 'JV-00001', VoucherType.JOURNAL_ENTRY,
      '2026-05-20', 'Test voucher', 'USD', 'USD', 1,
      [
        new VoucherLineEntity(1, 'CASH-1', 'Debit', 100, 'USD', 100, 'USD', 1, 'Dr'),
        new VoucherLineEntity(2, 'REV-1', 'Credit', 100, 'USD', 100, 'USD', 1, 'Cr'),
      ],
      100, 100, status, {}, 'user-1', new Date('2026-05-20T00:00:00.000Z')
    );

  it('SubmitVoucherUseCase rejects a PENDING voucher → 400 VOUCH_INVALID_STATUS', async () => {
    const voucher = buildVoucher(VoucherStatus.PENDING);
    const deps = makeSubmitDeps(voucher);
    const useCase = new SubmitVoucherUseCase(
      deps.voucherRepo as any, deps.policyConfigProvider as any,
      deps.approvalPolicyService as any, deps.getAccountMetadata
    );
    const err = await captureRejection(useCase.execute('cmp-1', voucher.id, 'user-2'));
    const mapped = mapThroughErrorHandler(err);
    expect(mapped.status).toBe(400);
    expect(mapped.body.error.code).toBe(ErrorCode.VOUCH_INVALID_STATUS);
    expect(mapped.body.error.message).toContain('pending');
    expect(mapped.body.error.guard).toBe('accounting');
  });

  it('VoucherEntity.submit on an APPROVED voucher → 400 VOUCH_INVALID_STATUS', async () => {
    const voucher = buildVoucher(VoucherStatus.APPROVED);
    const err = await captureRejection((async () => { voucher.submit('user-1'); })());
    const mapped = mapThroughErrorHandler(err);
    expect(mapped.status).toBe(400);
    expect(mapped.body.error.code).toBe(ErrorCode.VOUCH_INVALID_STATUS);
    expect(mapped.body.error.message).toContain('approved');
    expect(mapped.body.error.guard).toBe('accounting');
  });
});
