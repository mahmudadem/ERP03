import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { PostSalesInvoiceWithSettlementUseCase, SettlementRow } from '../../../application/sales/use-cases/PaymentSyncUseCases';
import { AccountMappingError } from '../../../domain/accounting/errors/AccountMappingError';
import { SalesInvoice } from '../../../domain/sales/entities/SalesInvoice';
import { SalesSettings } from '../../../domain/sales/entities/SalesSettings';
import { PaymentHistory } from '../../../domain/shared/entities/PaymentHistory';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';

const COMPANY_ID = 'cmp-fx';
const SI_ID = 'si-fx-1';
const USER_ID = 'user-1';
const AR_ACCT = 'acc-ar';
const CASH_ACCT = 'acc-cash';
const FX_ACCT = 'acc-fx';

const makeInvoice = (overrides: Partial<any> = {}): SalesInvoice =>
  new SalesInvoice({
    id: SI_ID,
    companyId: COMPANY_ID,
    invoiceNumber: 'SI-FX-001',
    formType: 'sales_invoice_direct',
    voucherType: 'sales_invoice',
    persona: 'direct',
    customerId: 'cust-1',
    customerName: 'Acme EUR Customer',
    invoiceDate: '2026-05-01',
    currency: 'EUR',
    exchangeRate: 10,
    lines: [
      {
        lineId: 'line-1',
        lineNo: 1,
        itemId: 'item-1',
        itemCode: 'ITM-1',
        itemName: 'Test Item',
        trackInventory: false,
        invoicedQty: 1,
        uom: 'ea',
        unitPriceDoc: 1000,
        lineTotalDoc: 1000,
        unitPriceBase: 10000,
        lineTotalBase: 10000,
        taxRate: 0,
        taxAmountDoc: 0,
        taxAmountBase: 0,
        revenueAccountId: 'acc-rev',
      },
    ],
    charges: [],
    subtotalDoc: 1000,
    taxTotalDoc: 0,
    grandTotalDoc: 1000,
    subtotalBase: 10000,
    taxTotalBase: 0,
    grandTotalBase: 10000,
    paymentTermsDays: 30,
    status: 'POSTED',
    paymentStatus: 'UNPAID',
    paidAmountBase: 0,
    outstandingAmountBase: 10000,
    voucherId: 'vch-original',
    notes: undefined,
    createdBy: USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    postedAt: new Date(),
    ...overrides,
  });

const makeSettings = (withFxAccount: boolean): SalesSettings =>
  new SalesSettings({
    companyId: COMPANY_ID,
    workflowMode: 'SIMPLE',
    allowDirectInvoicing: true,
    requireSOForStockItems: false,
    defaultRevenueAccountId: 'acc-rev',
    defaultPaymentTermsDays: 30,
    allowOverDelivery: false,
    overDeliveryTolerancePct: 0,
    overInvoiceTolerancePct: 0,
    exchangeGainLossAccountId: withFxAccount ? FX_ACCT : undefined,
    paymentMethodConfigs: [{ method: 'BANK_TRANSFER', settlementAccountId: CASH_ACCT, isEnabled: true }],
    soNumberPrefix: 'SO',
    soNumberNextSeq: 1,
    dnNumberPrefix: 'DN',
    dnNumberNextSeq: 1,
    siNumberPrefix: 'SI',
    siNumberNextSeq: 1,
    srNumberPrefix: 'SR',
    srNumberNextSeq: 1,
  });

const buildUseCase = (invoiceOverrides: Partial<any> = {}, withFxAccount = true) => {
  const invoice = makeInvoice(invoiceOverrides);
  const settings = makeSettings(withFxAccount);

  const persistedVouchers: VoucherEntity[] = [];

  const salesInvoiceRepo: any = {
    getById: jest.fn(async () => invoice),
    update: jest.fn(async () => undefined),
  };
  const paymentHistoryRepo: any = {
    create: jest.fn(async (p: PaymentHistory) => p),
  };
  const salesSettingsRepo: any = {
    getSettings: jest.fn(async () => settings),
  };
  const voucherRepo: any = {
    save: jest.fn(async (v: VoucherEntity) => persistedVouchers.push(v)),
  };
  const voucherSequenceRepo: any = {
    getNextNumber: jest.fn(async () => 'RV-001'),
  };
  const ledgerRepo: any = {
    recordForVoucher: jest.fn(async () => undefined),
  };
  const companyCurrencyRepo: any = {
    getBaseCurrency: jest.fn(async () => 'USD'),
  };
  const transactionManager: any = {
    runTransaction: <T,>(fn: (txn: any) => Promise<T>) => fn({}),
  };
  const accountingBridge: any = {
    recordFinancialEvent: jest.fn(),
    recordPreBuiltVoucher: jest.fn(async (event: any) => {
      await event.postFull();
      return { mode: 'full', voucher: event.voucher };
    }),
  };
  // Validation requires accounts to be POSTING + ACTIVE; provide a shape that passes.
  const accountRepo: any = {
    getById: jest.fn(async (_cid: string, id: string) => ({
      id,
      accountRole: 'POSTING',
      status: 'ACTIVE',
      classification: 'ASSET',
      name: id,
    })),
    getByUserCode: jest.fn(async () => null),
  };

  const useCase = new PostSalesInvoiceWithSettlementUseCase(
    salesInvoiceRepo,
    paymentHistoryRepo,
    salesSettingsRepo,
    voucherRepo,
    voucherSequenceRepo,
    ledgerRepo,
    companyCurrencyRepo,
    transactionManager,
    accountingBridge,
    accountRepo
  );

  return { useCase, invoice, persistedVouchers };
};

const buildSettlement = (overrides: Partial<SettlementRow> = {}): SettlementRow => ({
  settlementAccountId: CASH_ACCT,
  amountBase: 10000,
  paymentMethod: 'BANK_TRANSFER',
  paymentDate: '2026-06-15',
  reference: 'PMT-001',
  ...overrides,
});

describe('PostSalesInvoiceWithSettlementUseCase — realized FX', () => {
  it('produces a 2-line receipt when payment rate equals invoice rate (no FX)', async () => {
    const { useCase, persistedVouchers } = buildUseCase();
    await useCase.execute(COMPANY_ID, USER_ID, SI_ID, {
      settlementMode: 'CASH_FULL',
      receivablePayableAccountId: AR_ACCT,
      settlements: [buildSettlement()],
    });
    expect(persistedVouchers).toHaveLength(1);
    const v = persistedVouchers[0];
    expect(v.lines).toHaveLength(2);
    expect(v.lines.find((l) => l.side === 'Debit')!.baseAmount).toBe(10000);
    expect(v.lines.find((l) => l.side === 'Credit')!.baseAmount).toBe(10000);
  });

  it('emits a 3-line receipt with Cr FX Gain when payment rate > invoice rate', async () => {
    const { useCase, persistedVouchers } = buildUseCase();
    await useCase.execute(COMPANY_ID, USER_ID, SI_ID, {
      settlementMode: 'CASH_FULL',
      receivablePayableAccountId: AR_ACCT,
      settlements: [
        buildSettlement({
          amountBase: 11000,
          amountDoc: 1000,
          exchangeRate: 11,
        }),
      ],
    });
    const v = persistedVouchers[0];
    expect(v.lines).toHaveLength(3);
    const cashLine = v.lines.find((l) => l.accountId === CASH_ACCT)!;
    const arLine = v.lines.find((l) => l.accountId === AR_ACCT)!;
    const fxLine = v.lines.find((l) => l.accountId === FX_ACCT)!;
    expect(cashLine.side).toBe('Debit');
    expect(cashLine.baseAmount).toBe(11000);
    expect(arLine.side).toBe('Credit');
    expect(arLine.baseAmount).toBe(10000);
    expect(fxLine.side).toBe('Credit');
    expect(fxLine.baseAmount).toBe(1000);
    expect(fxLine.notes).toContain('Realized FX gain');
    expect(v.totalDebit).toBe(11000);
    expect(v.totalCredit).toBe(11000);
  });

  it('emits a 3-line receipt with Dr FX Loss when payment rate < invoice rate', async () => {
    const { useCase, persistedVouchers } = buildUseCase();
    await useCase.execute(COMPANY_ID, USER_ID, SI_ID, {
      settlementMode: 'CASH_FULL',
      receivablePayableAccountId: AR_ACCT,
      settlements: [
        buildSettlement({
          amountBase: 9000,
          amountDoc: 1000,
          exchangeRate: 9,
        }),
      ],
    });
    const v = persistedVouchers[0];
    expect(v.lines).toHaveLength(3);
    const cashLine = v.lines.find((l) => l.accountId === CASH_ACCT)!;
    const arLine = v.lines.find((l) => l.accountId === AR_ACCT)!;
    const fxLine = v.lines.find((l) => l.accountId === FX_ACCT)!;
    expect(cashLine.baseAmount).toBe(9000);
    expect(arLine.baseAmount).toBe(10000);
    expect(fxLine.side).toBe('Debit');
    expect(fxLine.baseAmount).toBe(1000);
    expect(fxLine.notes).toContain('Realized FX loss');
    expect(v.totalDebit).toBe(10000);
    expect(v.totalCredit).toBe(10000);
  });

  it('throws AccountMappingError when payment rate differs but exchangeGainLossAccountId is unset', async () => {
    const { useCase } = buildUseCase({}, false);
    await expect(
      useCase.execute(COMPANY_ID, USER_ID, SI_ID, {
        settlementMode: 'CASH_FULL',
        receivablePayableAccountId: AR_ACCT,
        settlements: [
          buildSettlement({
            amountBase: 11000,
            amountDoc: 1000,
            exchangeRate: 11,
          }),
        ],
      })
    ).rejects.toBeInstanceOf(AccountMappingError);
  });
});
