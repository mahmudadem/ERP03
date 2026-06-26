import { describe, expect, it, jest } from '@jest/globals';
import { PostPurchaseInvoiceWithSettlementUseCase } from '../../../application/purchases/use-cases/PaymentSyncUseCases';
import {
  FinancialEvent,
  FinancialEventRecord,
  IAccountingBridge,
  PreBuiltVoucherEvent,
} from '../../../application/system-core/contracts/IAccountingBridge';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { PurchaseInvoice } from '../../../domain/purchases/entities/PurchaseInvoice';

const COMPANY_ID = 'cmp-purchase-payment-golden';
const USER_ID = 'u-purchase-payment-golden';

class CapturingBridge implements IAccountingBridge {
  public preBuiltEvents: PreBuiltVoucherEvent[] = [];

  constructor(private readonly mode: 'full' | 'minimal' = 'full') {}

  async recordFinancialEvent(_event: FinancialEvent): Promise<FinancialEventRecord> {
    throw new Error('Purchase PaymentSync should not send subledger financial events');
  }

  async recordPreBuiltVoucher(event: PreBuiltVoucherEvent): Promise<FinancialEventRecord> {
    this.preBuiltEvents.push(event);
    if (this.mode === 'minimal') return { mode: 'minimal', voucher: null };
    return { mode: 'full', voucher: event.voucher };
  }
}

const makeInvoice = (overrides: Partial<PurchaseInvoice> = {}) =>
  new PurchaseInvoice({
    id: 'pi-pay-1',
    companyId: COMPANY_ID,
    invoiceNumber: 'PI-PAY-0001',
    formType: 'purchase_invoice_direct',
    voucherType: 'purchase_invoice',
    persona: 'direct',
    vendorId: 'ven-1',
    vendorName: 'Vendor One',
    invoiceDate: '2026-01-10',
    currency: 'USD',
    exchangeRate: 1,
    lines: [{
      lineId: 'line-1',
      lineNo: 1,
      itemId: 'item-1',
      itemCode: 'IT-1',
      itemName: 'Item One',
      trackInventory: false,
      invoicedQty: 1,
      uom: 'EA',
      unitPriceDoc: 100,
      lineTotalDoc: 100,
      unitPriceBase: 100,
      lineTotalBase: 100,
      taxRate: 0,
      taxAmountDoc: 0,
      taxAmountBase: 0,
      accountId: 'EXP-1',
    }],
    subtotalDoc: 100,
    taxTotalDoc: 0,
    grandTotalDoc: 100,
    subtotalBase: 100,
    taxTotalBase: 0,
    grandTotalBase: 100,
    paymentTermsDays: 30,
    paymentStatus: 'UNPAID',
    paidAmountBase: 0,
    outstandingAmountBase: 100,
    status: 'POSTED',
    createdBy: USER_ID,
    createdAt: new Date('2026-01-10T00:00:00.000Z'),
    updatedAt: new Date('2026-01-10T00:00:00.000Z'),
    postedAt: new Date('2026-01-10T00:00:00.000Z'),
    ...overrides,
  });

function buildUseCase(bridge: IAccountingBridge, invoice = makeInvoice()) {
  const invoiceStore = new Map([[invoice.id, invoice]]);
  const payments: any[] = [];
  const savedVouchers: VoucherEntity[] = [];

  const useCase = new PostPurchaseInvoiceWithSettlementUseCase(
    {
      getById: jest.fn(async (_companyId: string, id: string) => invoiceStore.get(id) ?? null),
      update: jest.fn(async (updated: PurchaseInvoice) => { invoiceStore.set(updated.id, updated); }),
    } as any,
    {
      create: jest.fn(async (payment: any) => { payments.push(payment); }),
    } as any,
    {
      getSettings: jest.fn(async () => ({ defaultAPAccountId: 'AP-100' })),
    } as any,
    {
      save: jest.fn(async (voucher: VoucherEntity) => { savedVouchers.push(voucher); }),
    } as any,
    {
      getNextNumber: jest.fn(async () => 'PV-0007'),
    } as any,
    {
      recordForVoucher: jest.fn(async () => undefined),
    } as any,
    {
      getBaseCurrency: jest.fn(async () => 'USD'),
    } as any,
    {
      runTransaction: jest.fn(async (fn: (transaction: any) => Promise<any>) => fn({ id: 'txn-purchase-payment' })),
    } as any,
    bridge,
    undefined,
    undefined,
    undefined
  );

  return { useCase, invoice, payments, savedVouchers };
}

describe('Purchase PaymentSync payment vouchers — golden bridge output (Task 267-F Purchase PaymentSync slice)', () => {
  it('G1: captures exact prebuilt payment voucher sent to the accounting bridge', async () => {
    const bridge = new CapturingBridge();
    const { useCase, invoice, payments, savedVouchers } = buildUseCase(bridge);

    const result = await useCase.execute(COMPANY_ID, USER_ID, invoice.id, {
      settlementMode: 'MULTI',
      receivablePayableAccountId: 'AP-100',
      settlements: [{ settlementAccountId: 'CASH-100', amountBase: 40, paymentMethod: 'CASH', paymentDate: '2026-01-15', reference: 'PAY-1' }],
    });

    expect(bridge.preBuiltEvents).toHaveLength(1);
    expect(savedVouchers).toHaveLength(0);

    const event = bridge.preBuiltEvents[0];
    const voucher = event.voucher;
    expect(event.companyId).toBe(COMPANY_ID);
    expect(event.kind).toBe('PURCHASE_PAYMENT');
    expect(voucher.companyId).toBe(COMPANY_ID);
    expect(voucher.voucherNo).toBe('PV-0007');
    expect(voucher.type).toBe('payment');
    expect(voucher.status).toBe('approved');
    expect(voucher.date).toBe('2026-01-15');
    expect(voucher.currency).toBe('USD');
    expect(voucher.exchangeRate).toBe(1);
    expect(voucher.reference).toBeUndefined();
    expect(voucher.metadata).toEqual({
      sourceModule: 'purchases',
      sourceInvoiceId: 'pi-pay-1',
      settlementMode: 'MULTI',
    });

    expect(voucher.lines).toHaveLength(2);
    const apLine = voucher.lines.find((line) => line.accountId === 'AP-100')!;
    const cashLine = voucher.lines.find((line) => line.accountId === 'CASH-100')!;
    expect(apLine.side).toBe('Debit');
    expect(apLine.baseAmount).toBe(40);
    expect(apLine.amount).toBe(40);
    expect(cashLine.side).toBe('Credit');
    expect(cashLine.baseAmount).toBe(40);
    expect(cashLine.amount).toBe(40);
    expect(voucher.totalDebit).toBe(40);
    expect(voucher.totalCredit).toBe(40);

    expect(result.voucherIds).toEqual([voucher.id]);
    expect(payments[0].voucherId).toBe(voucher.id);
    expect(result.invoice.paymentStatus).toBe('PARTIALLY_PAID');
  });

  it('G2: minimal mode captures the same voucher output but links no GL voucher id', async () => {
    const bridge = new CapturingBridge('minimal');
    const { useCase, invoice, payments } = buildUseCase(bridge);

    const result = await useCase.execute(COMPANY_ID, USER_ID, invoice.id, {
      settlementMode: 'MULTI',
      receivablePayableAccountId: 'AP-100',
      settlements: [{ settlementAccountId: 'CASH-100', amountBase: 40, paymentMethod: 'CASH', paymentDate: '2026-01-15' }],
    });

    expect(bridge.preBuiltEvents).toHaveLength(1);
    expect(bridge.preBuiltEvents[0].voucher.voucherNo).toBe('PV-0007');
    expect(result.voucherIds).toEqual([]);
    expect(payments[0].voucherId).toBeNull();
    expect(result.invoice.paymentStatus).toBe('PARTIALLY_PAID');
  });

  it('G3: DEFERRED mode creates no bridge event and no voucher id', async () => {
    const bridge = new CapturingBridge();
    const { useCase, invoice } = buildUseCase(bridge);

    const result = await useCase.execute(COMPANY_ID, USER_ID, invoice.id, {
      settlementMode: 'DEFERRED',
      receivablePayableAccountId: 'AP-100',
      settlements: [],
    });

    expect(bridge.preBuiltEvents).toHaveLength(0);
    expect(result.voucherIds).toEqual([]);
    expect(result.invoice.paymentStatus).toBe('UNPAID');
  });
});
