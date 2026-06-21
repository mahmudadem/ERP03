import { CompletePosSaleUseCase } from '../../../application/pos/use-cases/CompletePosSaleUseCase';
import { PosShift } from '../../../domain/pos/entities/PosShift';
import { PosSettings } from '../../../domain/pos/entities/PosSettings';
import { PosRegister } from '../../../domain/pos/entities/PosRegister';

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

const makePostedSale = (o: { subtotal?: number; taxTotal?: number; grandTotal?: number } = {}) => {
  const subtotal = o.subtotal ?? 10;
  const taxTotal = o.taxTotal ?? 0;
  const grandTotal = o.grandTotal ?? subtotal + taxTotal;
  return {
    documentId: 'pos_sale_1',
    documentNumber: 'R-000001',
    customerName: 'Walk-in',
    subtotal,
    discountTotal: 0,
    taxTotal,
    grandTotal,
    voucherIds: ['v_1'],
    lines: [
      {
        lineId: 'pos_line_1',
        itemId: 'item_1',
        itemCode: 'ITEM-1',
        itemName: 'Widget',
        qty: 1,
        uom: 'ea',
        unitPrice: subtotal,
        lineDiscount: 0,
        taxCodeId: taxTotal > 0 ? 'vat' : undefined,
        lineTotal: subtotal,
        taxAmount: taxTotal,
        unitCostBase: 0,
        lineCostBase: 0,
      },
    ],
  };
};

interface SetupOpts {
  shift?: Partial<any>;
  draftGrand?: number;
  draftTax?: number;
  posted?: any;
}

const setup = (opts: SetupOpts = {}) => {
  const subtotal = (opts.draftGrand ?? 10) - (opts.draftTax ?? 0);
  const preview = makePostedSale({
    subtotal,
    taxTotal: opts.draftTax ?? 0,
    grandTotal: opts.draftGrand ?? 10,
  });
  const posted = opts.posted ?? preview;
  const shiftRepo = { getById: jest.fn().mockResolvedValue(makeShift(opts.shift)) };
  const settingsRepo = { getSettings: jest.fn().mockResolvedValue(makeSettings()), saveSettings: jest.fn() };
  const registerRepo = { getById: jest.fn().mockResolvedValue(makeRegister()) };
  const receiptRepo = { create: jest.fn() };
  const paymentRepo = { create: jest.fn() };
  const cashMovementRepo = { create: jest.fn() };
  const tx = { runTransaction: async (fn: any) => fn({ tx: true }) };
  const postPosSaleUC = {
    execute: jest.fn((input: any) => Promise.resolve(input.dryRun ? preview : posted)),
  };
  const policyEngine = { resolve: jest.fn().mockResolvedValue({ allowed: true, requiresApproval: false, resolvedBy: ['test'] }) };
  const useCase = new CompletePosSaleUseCase(
    shiftRepo as any,
    settingsRepo as any,
    registerRepo as any,
    receiptRepo as any,
    paymentRepo as any,
    cashMovementRepo as any,
    tx as any,
    postPosSaleUC as any,
    policyEngine as any
  );
  return { useCase, postPosSaleUC, receiptRepo, paymentRepo, cashMovementRepo, preview, posted, policyEngine };
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

const postedInputOf = (postPosSaleUC: any) =>
  postPosSaleUC.execute.mock.calls.find((call: any[]) => call[0].dryRun !== true)?.[0];

describe('CompletePosSaleUseCase', () => {
  it('rejects when no shift is open', async () => {
    const { useCase, postPosSaleUC } = setup({ shift: { status: 'CLOSED' } });
    await expect(run(useCase, [{ method: 'CASH', amount: 10 }])).rejects.toThrow(/No open shift/);
    expect(postPosSaleUC.execute).not.toHaveBeenCalled();
  });

  it('rejects when another cashier is acting', async () => {
    const { useCase } = setup({ shift: { cashierUserId: 'OTHER' } });
    await expect(run(useCase, [{ method: 'CASH', amount: 10 }])).rejects.toThrow(/own shift/);
  });

  it('rejects a CARD payment that produces change before posting', async () => {
    const { useCase, postPosSaleUC } = setup();
    await expect(
      run(useCase, [
        { method: 'CARD', amount: 5, reference: 'A1' },
        { method: 'CARD', amount: 5, reference: 'A2', changeGiven: 5 },
      ])
    ).rejects.toThrow(/Only CASH may give change/);
    expect(postPosSaleUC.execute).not.toHaveBeenCalled();
  });

  it('rejects a CARD payment without a reference when requiresReference is on', async () => {
    const { useCase, postPosSaleUC } = setup();
    await expect(run(useCase, [{ method: 'CARD', amount: 10 }])).rejects.toThrow(/requires a reference/);
    expect(postPosSaleUC.execute).not.toHaveBeenCalled();
  });

  it('rejects before posting when POS policy denies direct sale', async () => {
    const { useCase, postPosSaleUC, policyEngine } = setup();
    policyEngine.resolve.mockResolvedValueOnce({ allowed: false, requiresApproval: false, resolvedBy: ['POSTerminalPolicy.allowDirectSales.deny'] });
    await expect(run(useCase, [{ method: 'CASH', amount: 10 }])).rejects.toThrow(/POS direct sale is not allowed/);
    expect(postPosSaleUC.execute).not.toHaveBeenCalled();
  });

  it('uses the POS-owned posting use-case with POS_DIRECT_SALE metadata inputs', async () => {
    const { useCase, postPosSaleUC } = setup();
    await run(useCase, [{ method: 'CASH', amount: 10 }]);
    const postedInput = postedInputOf(postPosSaleUC);
    expect(postedInput.companyId).toBe('cmp_test');
    expect(postedInput.customerId).toBe('walk-in-cust');
    expect(postedInput.documentNumber).toBe('R-000001');
    expect(postedInput.lines[0].warehouseId).toBe('wh1');
    expect(postedInput.transaction).toEqual({ tx: true });
  });

  it('completes a single-tender exact sale through POS posting', async () => {
    const { useCase, postPosSaleUC } = setup({ draftGrand: 10 });
    const result = await run(useCase, [{ method: 'CASH', amount: 10 }]);
    const postedInput = postedInputOf(postPosSaleUC);
    expect(postedInput.payments[0]).toMatchObject({ method: 'CASH', amount: 10 });
    expect(result.change).toBe(0);
    expect(result.salesInvoiceNumber).toBe('R-000001');
  });

  it('completes a split CASH+CARD sale with both applied payments', async () => {
    const { useCase, postPosSaleUC } = setup({ draftGrand: 10 });
    const result = await run(useCase, [
      { method: 'CASH', amount: 5 },
      { method: 'CARD', amount: 5, reference: 'AUTH-1' },
    ]);
    const postedInput = postedInputOf(postPosSaleUC);
    expect(postedInput.payments).toEqual([
      { method: 'CASH', amount: 5, reference: undefined },
      { method: 'CARD', amount: 5, reference: 'AUTH-1' },
    ]);
    expect(result.change).toBe(0);
  });

  it('nets CASH change off the posted settlement amount', async () => {
    const { useCase, postPosSaleUC } = setup({ draftGrand: 10 });
    const result = await run(useCase, [{ method: 'CASH', amount: 15 }]);
    const postedInput = postedInputOf(postPosSaleUC);
    expect(postedInput.payments[0].amount).toBe(10);
    expect(result.change).toBe(5);
  });

  it('validates payment against the TAX-INCLUSIVE POS total without creating a receipt on shortfall', async () => {
    const { useCase, receiptRepo } = setup({ draftGrand: 11, draftTax: 1 });
    await expect(run(useCase, [{ method: 'CASH', amount: 10 }])).rejects.toThrow(/incl\. tax \(11\.00\)/);
    expect(receiptRepo.create).not.toHaveBeenCalled();
  });

  it('settles the full tax-inclusive total and hydrates the receipt from POS posting', async () => {
    const { useCase, postPosSaleUC } = setup({ draftGrand: 11, draftTax: 1 });
    const result = await run(useCase, [{ method: 'CASH', amount: 11 }]);
    const postedInput = postedInputOf(postPosSaleUC);
    expect(postedInput.payments[0].amount).toBe(11);
    expect(result.change).toBe(0);
    expect(result.receipt.taxTotal).toBe(1);
    expect(result.receipt.grandTotal).toBe(11);
    expect(result.receipt.lines[0].itemName).toBe('Widget');
  });
});
