import { CompletePosSaleUseCase } from '../../../application/pos/use-cases/CompletePosSaleUseCase';
import { PosShift } from '../../../domain/pos/entities/PosShift';
import { PosSettings } from '../../../domain/pos/entities/PosSettings';
import { PosRegister } from '../../../domain/pos/entities/PosRegister';
import { SalesInvoice } from '../../../domain/sales/entities/SalesInvoice';

const makeSettings = (): PosSettings =>
  PosSettings.fromJSON({
    companyId: 'cmp_test',
    requireOpenShift: true,
    walkInCustomerId: 'walk-in-cust',
    cashOverAccountId: 'over-acc',
    cashShortAccountId: 'short-acc',
    receiptPrefix: 'R',
    receiptNextSeq: 1,
    cashRounding: 'none',
    allowPosDirectSales: true,
    paymentMethods: [
      { code: 'CASH', settlementAccountId: 'cash-acc', requiresReference: false, allowsChange: true, isEnabled: true },
      { code: 'CARD', settlementAccountId: 'card-acc', requiresReference: true, allowsChange: false, isEnabled: true },
    ],
  });

const makeShift = (overrides: Partial<any> = {}): PosShift =>
  PosShift.fromJSON({
    id: 'shift_1',
    companyId: 'cmp_test',
    registerId: 'reg_1',
    cashierUserId: 'cashier_1',
    status: 'OPEN',
    openedAt: new Date(),
    openingFloat: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

const makeRegister = (): PosRegister =>
  PosRegister.fromJSON({
    id: 'reg_1',
    companyId: 'cmp_test',
    code: 'POS-01',
    name: 'Front',
    warehouseId: 'wh1',
    cashDrawerAccountId: 'cash-acc',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

/** Build a SalesInvoice with configurable base totals (tax-inclusive grand total). */
const makeSI = (o: { subtotalBase?: number; taxTotalBase?: number; grandTotalBase?: number } = {}): SalesInvoice => {
  const subtotal = o.subtotalBase ?? 10;
  const tax = o.taxTotalBase ?? 0;
  const grand = o.grandTotalBase ?? subtotal + tax;
  return SalesInvoice.fromJSON({
    id: 'si_1',
    companyId: 'cmp_test',
    invoiceNumber: 'SI-0001',
    customerId: 'walk-in-cust',
    customerName: 'Walk-in',
    invoiceDate: new Date().toISOString().slice(0, 10),
    currency: 'USD',
    exchangeRate: 1,
    status: 'POSTED',
    paymentStatus: 'PAID',
    voucherType: 'SALES_INVOICE',
    persona: 'direct',
    source: 'pos',
    formType: 'pos_sale',
    paidAmountBase: grand,
    outstandingAmountBase: 0,
    voucherId: 'v_1',
    cogsVoucherId: null,
    subtotalBase: subtotal,
    taxTotalBase: tax,
    grandTotalBase: grand,
    subtotalDoc: subtotal,
    taxTotalDoc: tax,
    grandTotalDoc: grand,
    createdBy: 'cashier_1',
    createdAt: new Date(),
    postedAt: new Date(),
    lines: [
      {
        lineId: 'sil_1',
        id: 'sil_1',
        invoiceId: 'si_1',
        itemId: 'item_1',
        itemCode: 'ITEM-1',
        itemName: 'Widget',
        trackInventory: true,
        invoicedQty: 1,
        uom: 'ea',
        unitPriceDoc: subtotal,
        lineTotalDoc: subtotal,
        unitPriceBase: subtotal,
        lineTotalBase: subtotal,
        discountAmountBase: 0,
        taxRate: tax > 0 ? tax / subtotal : 0,
        taxAmountDoc: tax,
        taxAmountBase: tax,
        taxCode: tax > 0 ? 'VAT' : '',
        revenueAccountId: 'rev',
      },
    ],
  });
};

interface SetupOpts {
  shift?: Partial<any>;
  /** authoritative draft grand total (incl. tax) returned by CreateSalesInvoiceUseCase */
  draftGrand?: number;
  draftTax?: number;
  /** SI returned by PostSalesInvoiceUseCase (defaults to match the draft) */
  posted?: SalesInvoice;
}

const setup = (opts: SetupOpts = {}) => {
  const subtotal = (opts.draftGrand ?? 10) - (opts.draftTax ?? 0);
  const draft = makeSI({ grandTotalBase: opts.draftGrand ?? 10, taxTotalBase: opts.draftTax ?? 0, subtotalBase: subtotal });
  const posted = opts.posted ?? makeSI({ grandTotalBase: opts.draftGrand ?? 10, taxTotalBase: opts.draftTax ?? 0, subtotalBase: subtotal });
  const shiftRepo = { getById: jest.fn().mockResolvedValue(makeShift(opts.shift)) };
  const settingsRepo = { getSettings: jest.fn().mockResolvedValue(makeSettings()), saveSettings: jest.fn() };
  const registerRepo = { getById: jest.fn().mockResolvedValue(makeRegister()) };
  const receiptRepo = { create: jest.fn() };
  const paymentRepo = { create: jest.fn() };
  const cashMovementRepo = { create: jest.fn() };
  const tx = { runTransaction: async (fn: any) => fn({}) };
  const createUC = { execute: jest.fn().mockResolvedValue({ salesInvoice: draft }) };
  const postUC = { execute: jest.fn().mockResolvedValue(posted) };
  const salesInvoiceRepo = { delete: jest.fn().mockResolvedValue(undefined) };
  const useCase = new CompletePosSaleUseCase(
    shiftRepo as any, settingsRepo as any, registerRepo as any, receiptRepo as any,
    paymentRepo as any, cashMovementRepo as any, tx as any,
    createUC as any, postUC as any, salesInvoiceRepo as any
  );
  return { useCase, createUC, postUC, salesInvoiceRepo, receiptRepo, draft, posted };
};

const run = (useCase: CompletePosSaleUseCase, payments: any[], extra: Partial<any> = {}) =>
  useCase.execute({
    companyId: 'cmp_test',
    registerId: 'reg_1',
    shiftId: 'shift_1',
    lines: [{ itemId: 'item_1', qty: 1, unitPrice: 10 }],
    payments,
    actor: { userId: 'cashier_1' },
    ...extra,
  });

const settlementOf = (postUC: any) => postUC.execute.mock.calls[0][4];

describe('CompletePosSaleUseCase', () => {
  it('rejects when no shift is open', async () => {
    const { useCase, createUC } = setup({ shift: { status: 'CLOSED' } });
    await expect(run(useCase, [{ method: 'CASH', amount: 10 }])).rejects.toThrow(/No open shift/);
    expect(createUC.execute).not.toHaveBeenCalled();
  });

  it('rejects when another cashier is acting', async () => {
    const { useCase } = setup({ shift: { cashierUserId: 'OTHER' } });
    await expect(run(useCase, [{ method: 'CASH', amount: 10 }])).rejects.toThrow(/own shift/);
  });

  it('rejects a CARD payment that produces change (before creating the SI)', async () => {
    const { useCase, createUC } = setup();
    await expect(
      run(useCase, [
        { method: 'CARD', amount: 5, reference: 'A1' },
        { method: 'CARD', amount: 5, reference: 'A2', changeGiven: 5 },
      ])
    ).rejects.toThrow(/Only CASH may give change/);
    expect(createUC.execute).not.toHaveBeenCalled();
  });

  it('rejects a CARD payment without a reference when requiresReference is on', async () => {
    const { useCase, createUC } = setup();
    await expect(run(useCase, [{ method: 'CARD', amount: 10 }])).rejects.toThrow(/requires a reference/);
    expect(createUC.execute).not.toHaveBeenCalled();
  });

  it('builds the SI input with persona/source/formType and the walk-in customer', async () => {
    const { useCase, createUC } = setup();
    await run(useCase, [{ method: 'CASH', amount: 10 }]);
    const [input] = createUC.execute.mock.calls[0];
    expect(input.customerId).toBe('walk-in-cust');
    expect(input.source).toBe('pos');
    expect(input.voucherType).toBe('sales_invoice');
    expect(input.formType).toBe('pos_sale');
    expect(input.persona).toBe('direct');
  });

  it('completes a single-tender exact sale with CASH_FULL settlement', async () => {
    const { useCase, postUC } = setup({ draftGrand: 10 });
    const result = await run(useCase, [{ method: 'CASH', amount: 10 }]);
    const settlement = settlementOf(postUC);
    expect(settlement.settlementMode).toBe('CASH_FULL');
    expect(settlement.settlements[0].paymentMethod).toBe('CASH');
    expect(settlement.settlements[0].amountBase).toBe(10);
    expect(result.change).toBe(0);
    expect(result.salesInvoiceNumber).toBe('SI-0001');
  });

  it('completes a split CASH+CARD sale with MULTI settlement', async () => {
    const { useCase, postUC } = setup({ draftGrand: 10 });
    const result = await run(useCase, [
      { method: 'CASH', amount: 5 },
      { method: 'CARD', amount: 5, reference: 'AUTH-1' },
    ]);
    const settlement = settlementOf(postUC);
    expect(settlement.settlementMode).toBe('MULTI');
    expect(settlement.settlements.find((s: any) => s.paymentMethod === 'CASH').amountBase).toBe(5);
    expect(settlement.settlements.find((s: any) => s.paymentMethod === 'CREDIT_CARD').amountBase).toBe(5);
    expect(result.change).toBe(0);
  });

  it('nets CASH change off the settlement (applied = grand total)', async () => {
    const { useCase, postUC } = setup({ draftGrand: 10 });
    const result = await run(useCase, [{ method: 'CASH', amount: 15 }]);
    const settlement = settlementOf(postUC);
    expect(settlement.settlementMode).toBe('MULTI');
    expect(settlement.settlements[0].amountBase).toBe(10);
    expect(result.change).toBe(5);
  });

  // ---- Tax correctness (the regression these tests previously missed) ----

  it('validates payment against the TAX-INCLUSIVE SI total and discards the draft on a shortfall', async () => {
    // Net 10 + tax 1 = 11 due. Cashier tenders only the net 10 → must be rejected.
    const { useCase, postUC, salesInvoiceRepo } = setup({ draftGrand: 11, draftTax: 1 });
    await expect(run(useCase, [{ method: 'CASH', amount: 10 }])).rejects.toThrow(/incl\. tax \(11\.00\)/);
    expect(salesInvoiceRepo.delete).toHaveBeenCalledWith('cmp_test', 'si_1');
    expect(postUC.execute).not.toHaveBeenCalled();
  });

  it('settles the full tax-inclusive total and hydrates the receipt from the posted SI', async () => {
    const { useCase, postUC } = setup({ draftGrand: 11, draftTax: 1 });
    const result = await run(useCase, [{ method: 'CASH', amount: 11 }]);
    const settlement = settlementOf(postUC);
    expect(settlement.settlementMode).toBe('CASH_FULL');
    expect(settlement.settlements[0].amountBase).toBe(11);
    expect(result.change).toBe(0);
    // Receipt reflects the SI financial truth, not POS-local tax-exclusive math.
    expect(result.receipt.taxTotal).toBe(1);
    expect(result.receipt.grandTotal).toBe(11);
    expect(result.receipt.lines[0].itemName).toBe('Widget');
  });
});
