import { CompletePosSaleUseCase } from '../../../application/pos/use-cases/CompletePosSaleUseCase';
import { PosShift } from '../../../domain/pos/entities/PosShift';
import { PosSettings } from '../../../domain/pos/entities/PosSettings';
import { PosRegister } from '../../../domain/pos/entities/PosRegister';

const makeSettings = (overrides: Partial<any> = {}): PosSettings =>
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
    ...overrides,
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
    settlementAccountIds: { CARD: 'card-reg-acc' },
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const makePostedSale = (o: { subtotal?: number; taxTotal?: number; grandTotal?: number; roundedGrandTotal?: number; cashRoundingAdjustmentBase?: number } = {}) => {
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
    roundedGrandTotal: o.roundedGrandTotal ?? grandTotal,
    cashRoundingAdjustmentBase: o.cashRoundingAdjustmentBase ?? 0,
    currency: 'USD',
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
  settings?: Partial<any>;
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
  const settingsRepo = { getSettings: jest.fn().mockResolvedValue(makeSettings(opts.settings)), saveSettings: jest.fn() };
  const registerRepo = { getById: jest.fn().mockResolvedValue(makeRegister()) };
  const receiptRepo = { create: jest.fn() };
  const paymentRepo = { create: jest.fn() };
  const cashMovementRepo = { create: jest.fn() };
  const tx = { runTransaction: async (fn: any) => fn({ tx: true }) };
  const postPosSaleUC = {
    execute: jest.fn((input: any) => Promise.resolve(input.dryRun ? preview : posted)),
  };
  const policyEngine = { resolve: jest.fn().mockResolvedValue({ allowed: true, requiresApproval: false, resolvedBy: ['test'] }) };
  const numberingEngine = { next: jest.fn().mockResolvedValue('R-000001') };
  const auditEngine = { record: jest.fn().mockResolvedValue(undefined) };
  const useCase = new CompletePosSaleUseCase(
    shiftRepo as any,
    settingsRepo as any,
    registerRepo as any,
    receiptRepo as any,
    paymentRepo as any,
    cashMovementRepo as any,
    tx as any,
    postPosSaleUC as any,
    policyEngine as any,
    numberingEngine as any,
    auditEngine as any
  );
  return { useCase, postPosSaleUC, receiptRepo, paymentRepo, cashMovementRepo, preview, posted, policyEngine, numberingEngine, auditEngine };
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
    const { useCase, postPosSaleUC, numberingEngine } = setup();
    await run(useCase, [{ method: 'CASH', amount: 10 }]);
    expect(numberingEngine.next).toHaveBeenCalledWith({
      companyId: 'cmp_test',
      docType: 'POS_RECEIPT',
      scope: 'terminal',
      terminalId: 'reg_1',
      prefix: 'R',
      counterWidth: 6,
      seedNextNumber: 1,
    });
    const postedInput = postedInputOf(postPosSaleUC);
    expect(postedInput.companyId).toBe('cmp_test');
    expect(postedInput.customerId).toBe('walk-in-cust');
    expect(postedInput.documentNumber).toBe('R-000001');
    expect(postedInput.lines[0].warehouseId).toBe('wh1');
    expect(postedInput.paymentMethods.find((m: any) => m.code === 'CASH')?.settlementAccountId).toBe('cash-acc');
    expect(postedInput.paymentMethods.find((m: any) => m.code === 'CARD')?.settlementAccountId).toBe('card-reg-acc');
    expect(postedInput.transaction).toEqual({ tx: true });
  });

  it('persists voided cart lines for audit without sending them to POS posting totals', async () => {
    const { useCase, postPosSaleUC } = setup({ draftGrand: 10 });
    const result = await run(useCase, [{ method: 'CASH', amount: 10 }], {
      lines: [
        { itemId: 'item_1', itemCode: 'ITEM-1', itemName: 'Widget', uom: 'ea', qty: 1, unitPrice: 10 },
        {
          itemId: 'item_void',
          itemCode: 'VOID-1',
          itemName: 'Removed item',
          uom: 'ea',
          qty: 2,
          unitPrice: 5,
          status: 'VOIDED',
          voidedBy: 'cashier_1',
          voidedAt: '2026-06-22T10:00:00.000Z',
          voidReason: 'Customer changed mind',
        },
      ],
    });

    const postedInput = postedInputOf(postPosSaleUC);
    expect(postedInput.lines).toHaveLength(1);
    expect(postedInput.lines[0].itemId).toBe('item_1');
    expect(result.receipt.lines).toEqual(expect.arrayContaining([
      expect.objectContaining({
        itemId: 'item_void',
        status: 'VOIDED',
        voidedBy: 'cashier_1',
        voidReason: 'Customer changed mind',
        lineTotal: 10,
      }),
    ]));
    expect(result.receipt.grandTotal).toBe(10);
  });

  it('blocks a voided line when cashier policy requires manager approval and no override is supplied', async () => {
    const { useCase, postPosSaleUC, policyEngine } = setup({ draftGrand: 10 });
    policyEngine.resolve.mockImplementation((request: any) => {
      if (request.action === 'managerOverride' && request.context?.overrideAction === 'VOID_LINE') {
        return Promise.resolve({ allowed: false, requiresApproval: true, resolvedBy: ['CashierRolePolicy.managerOverride.VOID_LINE.requiresApproval'] });
      }
      return Promise.resolve({ allowed: true, requiresApproval: false, resolvedBy: ['test'] });
    });

    await expect(run(useCase, [{ method: 'CASH', amount: 10 }], {
      actor: { userId: 'cashier_1', roleId: 'cashier-jr' },
      lines: [
        { itemId: 'item_1', itemCode: 'ITEM-1', itemName: 'Widget', uom: 'ea', qty: 1, unitPrice: 10 },
        {
          itemId: 'item_void',
          itemCode: 'VOID-1',
          itemName: 'Removed item',
          uom: 'ea',
          qty: 1,
          unitPrice: 5,
          status: 'VOIDED',
          voidedBy: 'cashier_1',
          voidedAt: '2026-06-22T10:00:00.000Z',
          voidReason: 'Wrong item',
        },
      ],
    })).rejects.toThrow(/Manager approval is required for POS void line/);

    expect(postPosSaleUC.execute).not.toHaveBeenCalled();
  });

  it('allows manager-approved discounts when cashier policy requires an override', async () => {
    const { useCase, postPosSaleUC, policyEngine } = setup({ draftGrand: 9 });
    policyEngine.resolve.mockImplementation((request: any) => {
      if (request.action === 'managerOverride' && request.context?.overrideAction === 'DISCOUNT_OVERRIDE') {
        return Promise.resolve({
          allowed: request.context?.approvedOverride === true,
          requiresApproval: request.context?.approvedOverride !== true,
          resolvedBy: ['CashierRolePolicy.managerOverride.DISCOUNT_OVERRIDE.requiresApproval'],
        });
      }
      return Promise.resolve({ allowed: true, requiresApproval: false, resolvedBy: ['test'] });
    });

    await run(useCase, [{ method: 'CASH', amount: 9 }], {
      actor: { userId: 'cashier_1', roleId: 'cashier-jr' },
      lines: [{
        itemId: 'item_1',
        qty: 1,
        unitPrice: 10,
        discountType: 'AMOUNT',
        discountValue: 1,
        managerOverrideId: 'mgr_override_1',
      }],
    });

    const postedInput = postedInputOf(postPosSaleUC);
    expect(postedInput.lines[0]).toMatchObject({ discountType: 'AMOUNT', discountValue: 1 });
  });

  it('blocks sale line discount limits until a manager override id is supplied', async () => {
    const { useCase, postPosSaleUC, policyEngine } = setup({ draftGrand: 8 });
    policyEngine.resolve.mockImplementation((request: any) => {
      if (request.action === 'saleLineControls') {
        return Promise.resolve({
          allowed: Boolean(request.context?.approvedOverrideId),
          requiresApproval: !request.context?.approvedOverrideId,
          resolvedBy: ['CashierRolePolicy.maxLineDiscountPercent.exceeded'],
        });
      }
      return Promise.resolve({ allowed: true, requiresApproval: false, resolvedBy: ['test'] });
    });

    await expect(run(useCase, [{ method: 'CASH', amount: 8 }], {
      actor: { userId: 'cashier_1', roleId: 'cashier-jr' },
      lines: [{ itemId: 'item_1', qty: 1, unitPrice: 10, discountType: 'PERCENT', discountValue: 20 }],
    })).rejects.toThrow(/Manager approval is required for POS price, discount, or tax override limits/);

    expect(postPosSaleUC.execute).not.toHaveBeenCalled();

    await run(useCase, [{ method: 'CASH', amount: 8 }], {
      actor: { userId: 'cashier_1', roleId: 'cashier-jr' },
      lines: [{
        itemId: 'item_1',
        qty: 1,
        unitPrice: 10,
        discountType: 'PERCENT',
        discountValue: 20,
        managerOverrideId: 'mgr_override_1',
      }],
    });

    const postedInput = postedInputOf(postPosSaleUC);
    expect(postedInput.lines[0]).toMatchObject({ discountType: 'PERCENT', discountValue: 20 });
  });

  it('persists price and tax override flags on receipt line audit snapshots', async () => {
    const { useCase } = setup({ draftGrand: 10 });
    const result = await run(useCase, [{ method: 'CASH', amount: 10 }], {
      lines: [{
        itemId: 'item_1',
        qty: 1,
        unitPrice: 10,
        priceOverride: true,
        taxOverride: true,
        managerOverrideId: 'mgr_override_1',
      }],
    });

    expect(result.receipt.lines[0]).toMatchObject({
      priceOverride: true,
      taxOverride: true,
      managerOverrideId: 'mgr_override_1',
    });
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

  it('rejects before posting when a non-cash register settlement account is missing', async () => {
    const { useCase, postPosSaleUC } = setup({
      settings: {
        paymentMethods: [
          { code: 'CASH', settlementAccountId: '', requiresReference: false, allowsChange: true, isEnabled: true },
          { code: 'BANK_TRANSFER', settlementAccountId: '', requiresReference: true, allowsChange: false, isEnabled: true },
        ],
      },
    });
    (postPosSaleUC.execute as jest.Mock).mockClear();
    await expect(run(useCase, [{ method: 'BANK_TRANSFER', amount: 10, reference: 'BANK-1' }], {
      lines: [{ itemId: 'item_1', qty: 1, unitPrice: 10 }],
    })).rejects.toThrow(/Configure BANK_TRANSFER settlement account on POS register POS-01/);
    expect(postPosSaleUC.execute).not.toHaveBeenCalled();
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

  it('applies POS nearest-0.05 cash rounding before posting and records the rounding account', async () => {
    const { useCase, postPosSaleUC } = setup({
      settings: { cashRounding: 'nearest_05' },
      draftGrand: 10.02,
      posted: makePostedSale({ subtotal: 10.02, grandTotal: 10.02, roundedGrandTotal: 10, cashRoundingAdjustmentBase: -0.02 }),
    });

    const result = await run(useCase, [{ method: 'CASH', amount: 10 }]);

    const postedInput = postedInputOf(postPosSaleUC);
    expect(postedInput.payments[0]).toMatchObject({ method: 'CASH', amount: 10 });
    expect(postedInput.cashRoundingAdjustmentBase).toBe(-0.02);
    expect(postedInput.cashRoundingAccountId).toBe('short-acc');
    expect(result.change).toBe(0);
    expect(result.receipt.grandTotal).toBe(10);
  });

  it('records POS receipt creation through the audit engine after a completed sale', async () => {
    const { useCase, auditEngine } = setup({ draftGrand: 10 });
    await run(useCase, [{ method: 'CASH', amount: 10 }]);

    expect(auditEngine.record).toHaveBeenCalledWith(expect.objectContaining({
      companyId: 'cmp_test',
      entity: expect.objectContaining({ type: 'POS_RECEIPT', number: 'R-000001' }),
      action: 'CREATE',
      actor: expect.objectContaining({ userId: 'cashier_1' }),
      after: expect.objectContaining({
        receiptNumber: 'R-000001',
        postedDocumentId: 'pos_sale_1',
        voucherIds: ['v_1'],
      }),
    }));
  });

  describe('Credit Sale Policies', () => {
    it('rejects credit sale if allowCreditSales=false', async () => {
      const { useCase } = setup({ settings: { allowCreditSales: false } });
      await expect(run(useCase, [], { isCreditSale: true, customerId: 'cust-1' }))
        .rejects.toThrow(/Credit sales are not allowed by POS settings/);
    });

    it('rejects credit sale if customer is missing or walk-in', async () => {
      const { useCase } = setup({ settings: { allowCreditSales: true, walkInCustomerId: 'walk-in' } });
      await expect(run(useCase, [], { isCreditSale: true }))
        .rejects.toThrow(/Credit sale requires a selected customer/);

      await expect(run(useCase, [], { isCreditSale: true, customerId: 'walk-in' }))
        .rejects.toThrow(/Credit sales cannot be made to the walk-in customer/);
    });

    it('rejects credit sale if creditSaleManagerOverride=true and no manager approval', async () => {
      const { useCase, policyEngine } = setup({ settings: { allowCreditSales: true, creditSaleManagerOverride: true } });
      policyEngine.resolve.mockImplementation((req: any) => {
        if (req.action === 'managerOverride' && req.context?.overrideAction === 'CREDIT_SALE') {
          return Promise.resolve({ allowed: false, requiresApproval: true });
        }
        return Promise.resolve({ allowed: true, requiresApproval: false });
      });

      await expect(run(useCase, [], { isCreditSale: true, customerId: 'cust-1' }))
        .rejects.toThrow(/Manager approval is required for POS credit sale/);
    });

    it('completes credit sale posting with 0 payments and records manager override when required', async () => {
      const { useCase, postPosSaleUC } = setup({ settings: { allowCreditSales: true, creditSaleManagerOverride: true }, draftGrand: 10 });
      const result = await run(useCase, [], { isCreditSale: true, customerId: 'cust-1', managerOverrideId: 'mgr-1' });
      const postedInput = postedInputOf(postPosSaleUC);
      expect(postedInput.payments).toEqual([]);
      expect(result.receipt.grandTotal).toBe(10);
      expect(result.receipt.grandTotal).toBe(10);
      expect(result.change).toBe(0);
    });

    it('completes credit sale posting and bypasses receipt payment total checks', async () => {
      const { useCase, postPosSaleUC } = setup({ settings: { allowCreditSales: true }, draftGrand: 50 });
      const result = await run(useCase, [], { isCreditSale: true, customerId: 'cust-1' });
      const postedInput = postedInputOf(postPosSaleUC);
      expect(postedInput.payments).toEqual([]);
      expect(result.change).toBe(0);
      expect(result.receipt.grandTotal).toBe(50);
    });
  });
});
