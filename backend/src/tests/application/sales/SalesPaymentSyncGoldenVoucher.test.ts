import { describe, expect, it, jest } from '@jest/globals';
import { PostSalesInvoiceWithSettlementUseCase } from '../../../application/sales/use-cases/PaymentSyncUseCases';
import {
  FinancialEvent,
  FinancialEventRecord,
  IAccountingBridge,
  PreBuiltVoucherEvent,
} from '../../../application/system-core/contracts/IAccountingBridge';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { SalesInvoice } from '../../../domain/sales/entities/SalesInvoice';

const COMPANY_ID = 'cmp-sales-payment-golden';
const USER_ID = 'u-sales-payment-golden';

class CapturingBridge implements IAccountingBridge {
  public preBuiltEvents: PreBuiltVoucherEvent[] = [];

  async recordFinancialEvent(_event: FinancialEvent): Promise<FinancialEventRecord> {
    throw new Error('Sales PaymentSync should not send subledger financial events');
  }

  async recordPreBuiltVoucher(event: PreBuiltVoucherEvent): Promise<FinancialEventRecord> {
    this.preBuiltEvents.push(event);
    return { mode: 'full', voucher: event.voucher };
  }
}

class MinimalBridge implements IAccountingBridge {
  public preBuiltEvents: PreBuiltVoucherEvent[] = [];

  async recordFinancialEvent(_event: FinancialEvent): Promise<FinancialEventRecord> {
    throw new Error('Sales PaymentSync should not send subledger financial events');
  }

  async recordPreBuiltVoucher(event: PreBuiltVoucherEvent): Promise<FinancialEventRecord> {
    this.preBuiltEvents.push(event);
    return { mode: 'minimal', voucher: null };
  }
}

const makeInvoice = (overrides: Partial<SalesInvoice> = {}) =>
  new SalesInvoice({
    id: 'si-pay-1',
    companyId: COMPANY_ID,
    invoiceNumber: 'SI-PAY-0001',
    formType: 'sales_invoice_direct',
    voucherType: 'sales_invoice',
    persona: 'direct',
    customerId: 'cus-1',
    customerName: 'Customer One',
    invoiceDate: '2026-01-10',
    currency: 'USD',
    exchangeRate: 1,
    lines: [
      {
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
        revenueAccountId: 'REV-1',
      },
    ],
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

  const useCase = new PostSalesInvoiceWithSettlementUseCase(
    {
      getById: jest.fn(async (_companyId: string, id: string) => invoiceStore.get(id) ?? null),
      update: jest.fn(async (updated: SalesInvoice) => { invoiceStore.set(updated.id, updated); }),
    } as any,
    {
      create: jest.fn(async (payment: any) => { payments.push(payment); }),
    } as any,
    {
      getSettings: jest.fn(async () => ({
        defaultARAccountId: 'AR-100',
        paymentMethodConfigs: [{ method: 'CASH', settlementAccountId: 'CASH-100', isEnabled: true }],
        exchangeGainLossAccountId: 'FX-100',
      })),
    } as any,
    {
      save: jest.fn(async (voucher: VoucherEntity) => { savedVouchers.push(voucher); }),
    } as any,
    {
      getNextNumber: jest.fn(async () => 'RV-0007'),
    } as any,
    {
      recordForVoucher: jest.fn(async () => undefined),
    } as any,
    {
      getBaseCurrency: jest.fn(async () => 'USD'),
    } as any,
    {
      runTransaction: jest.fn(async (fn: (transaction: any) => Promise<any>) => fn({ id: 'txn-sales-payment' })),
    } as any,
    bridge,
    undefined,
    undefined,
    undefined
  );

  return { useCase, invoice, payments, savedVouchers };
}

describe('Sales PaymentSync receipt vouchers — golden bridge output (Task 267-F PaymentSync slice)', () => {
  it('G1: captures exact prebuilt receipt voucher sent to the accounting bridge', async () => {
    const bridge = new CapturingBridge();
    const { useCase, invoice, payments, savedVouchers } = buildUseCase(bridge);

    const result = await useCase.execute(COMPANY_ID, USER_ID, invoice.id, {
      settlementMode: 'MULTI',
      settlements: [{ amountBase: 40, paymentMethod: 'CASH', paymentDate: '2026-01-15', reference: 'RCPT-1' }],
    });

    expect(bridge.preBuiltEvents).toHaveLength(1);
    expect(savedVouchers).toHaveLength(0);

    const event = bridge.preBuiltEvents[0];
    const voucher = event.voucher;
    expect(event.companyId).toBe(COMPANY_ID);
    expect(event.kind).toBe('SALES_RECEIPT');
    expect(voucher.companyId).toBe(COMPANY_ID);
    expect(voucher.voucherNo).toBe('RV-0007');
    expect(voucher.type).toBe('receipt');
    expect(voucher.status).toBe('approved');
    expect(voucher.date).toBe('2026-01-15');
    expect(voucher.currency).toBe('USD');
    expect(voucher.exchangeRate).toBe(1);
    expect(voucher.reference).toBeUndefined();
    expect(voucher.metadata).toEqual({
      sourceModule: 'sales',
      sourceInvoiceId: 'si-pay-1',
      settlementMode: 'MULTI',
    });

    expect(voucher.lines).toHaveLength(2);
    const cashLine = voucher.lines.find((line) => line.accountId === 'CASH-100')!;
    const arLine = voucher.lines.find((line) => line.accountId === 'AR-100')!;
    expect(cashLine.side).toBe('Debit');
    expect(cashLine.baseAmount).toBe(40);
    expect(cashLine.amount).toBe(40);
    expect(arLine.side).toBe('Credit');
    expect(arLine.baseAmount).toBe(40);
    expect(arLine.amount).toBe(40);
    expect(voucher.totalDebit).toBe(40);
    expect(voucher.totalCredit).toBe(40);

    expect(result.voucherIds).toEqual([voucher.id]);
    expect(payments[0].voucherId).toBe(voucher.id);
    expect(result.invoice.paymentStatus).toBe('PARTIALLY_PAID');
  });

  it('G2: minimal mode captures the same voucher output but links no GL voucher id', async () => {
    const bridge = new MinimalBridge();
    const { useCase, invoice, payments } = buildUseCase(bridge);

    const result = await useCase.execute(COMPANY_ID, USER_ID, invoice.id, {
      settlementMode: 'MULTI',
      settlements: [{ amountBase: 40, paymentMethod: 'CASH', paymentDate: '2026-01-15' }],
    });

    expect(bridge.preBuiltEvents).toHaveLength(1);
    expect(bridge.preBuiltEvents[0].voucher.voucherNo).toBe('RV-0007');
    expect(result.voucherIds).toEqual([]);
    expect(payments[0].voucherId).toBeNull();
    expect(result.invoice.paymentStatus).toBe('PARTIALLY_PAID');
  });

  it('G3: foreign-currency receipt pins realized FX gain line output', async () => {
    const bridge = new CapturingBridge();
    const invoice = makeInvoice({
      currency: 'EUR',
      exchangeRate: 10,
      grandTotalDoc: 100,
      grandTotalBase: 1000,
      subtotalDoc: 100,
      subtotalBase: 1000,
      outstandingAmountBase: 1000,
    } as Partial<SalesInvoice>);
    const { useCase } = buildUseCase(bridge, invoice);

    await useCase.execute(COMPANY_ID, USER_ID, invoice.id, {
      settlementMode: 'CASH_FULL',
      receivablePayableAccountId: 'AR-100',
      settlements: [{
        amountBase: 1100,
        amountDoc: 100,
        exchangeRate: 11,
        paymentMethod: 'CASH',
        paymentDate: '2026-01-15',
      }],
    });

    const voucher = bridge.preBuiltEvents[0].voucher;
    expect(voucher.currency).toBe('EUR');
    expect(voucher.exchangeRate).toBe(11);
    expect(voucher.lines).toHaveLength(3);
    expect(voucher.lines.find((line) => line.accountId === 'CASH-100')!.baseAmount).toBe(1100);
    expect(voucher.lines.find((line) => line.accountId === 'AR-100')!.baseAmount).toBe(1000);
    const fxLine = voucher.lines.find((line) => line.accountId === 'FX-100')!;
    expect(fxLine.side).toBe('Credit');
    expect(fxLine.baseAmount).toBe(100);
    expect(voucher.totalDebit).toBe(1100);
    expect(voucher.totalCredit).toBe(1100);
  });
});
