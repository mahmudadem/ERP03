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

const baseSalesInvoice = (): SalesInvoice =>
  SalesInvoice.fromJSON({
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
    paidAmountBase: 10,
    outstandingAmountBase: 0,
    voucherId: 'v_1',
    cogsVoucherId: null,
    subtotalBase: 10,
    taxTotalBase: 0,
    grandTotalBase: 10,
    subtotalDoc: 10,
    taxTotalDoc: 0,
    grandTotalDoc: 10,
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
        unitPriceDoc: 10,
        lineTotalDoc: 10,
        unitPriceBase: 10,
        lineTotalBase: 10,
        taxRate: 0,
        taxAmountDoc: 0,
        taxAmountBase: 0,
        taxCode: '',
        revenueAccountId: 'rev',
      },
    ],
  });

describe('CompletePosSaleUseCase', () => {
  it('rejects when no shift is open', async () => {
    const settings = makeSettings();
    const shiftRepo = { getById: jest.fn().mockResolvedValue(makeShift({ status: 'CLOSED' })) };
    const settingsRepo = { getSettings: jest.fn().mockResolvedValue(settings), saveSettings: jest.fn() };
    const registerRepo = { getById: jest.fn().mockResolvedValue(makeRegister()) };
    const receiptRepo = { create: jest.fn() };
    const paymentRepo = { create: jest.fn() };
    const cashMovementRepo = { create: jest.fn() };
    const tx = { runTransaction: async (fn: any) => fn({}) };
    const sales = { execute: jest.fn() };
    const useCase = new CompletePosSaleUseCase(
      shiftRepo as any, settingsRepo as any, registerRepo as any, receiptRepo as any, paymentRepo as any, cashMovementRepo as any, tx as any, sales as any
    );
    await expect(
      useCase.execute({
        companyId: 'cmp_test',
        registerId: 'reg_1',
        shiftId: 'shift_1',
        lines: [{ itemId: 'item_1', qty: 1, unitPrice: 10 }],
        payments: [{ method: 'CASH', amount: 10 }],
        actor: { userId: 'cashier_1' },
      })
    ).rejects.toThrow(/No open shift/);
  });

  it('rejects when another cashier is acting', async () => {
    const settings = makeSettings();
    const shiftRepo = { getById: jest.fn().mockResolvedValue(makeShift({ cashierUserId: 'OTHER' })) };
    const settingsRepo = { getSettings: jest.fn().mockResolvedValue(settings), saveSettings: jest.fn() };
    const registerRepo = { getById: jest.fn().mockResolvedValue(makeRegister()) };
    const receiptRepo = { create: jest.fn() };
    const paymentRepo = { create: jest.fn() };
    const cashMovementRepo = { create: jest.fn() };
    const tx = { runTransaction: async (fn: any) => fn({}) };
    const sales = { execute: jest.fn() };
    const useCase = new CompletePosSaleUseCase(
      shiftRepo as any, settingsRepo as any, registerRepo as any, receiptRepo as any, paymentRepo as any, cashMovementRepo as any, tx as any, sales as any
    );
    await expect(
      useCase.execute({
        companyId: 'cmp_test',
        registerId: 'reg_1',
        shiftId: 'shift_1',
        lines: [{ itemId: 'item_1', qty: 1, unitPrice: 10 }],
        payments: [{ method: 'CASH', amount: 10 }],
        actor: { userId: 'cashier_1' },
      })
    ).rejects.toThrow(/own shift/);
  });

  it('rejects mismatched payment total', async () => {
    const settings = makeSettings();
    const shiftRepo = { getById: jest.fn().mockResolvedValue(makeShift()) };
    const settingsRepo = { getSettings: jest.fn().mockResolvedValue(settings), saveSettings: jest.fn() };
    const registerRepo = { getById: jest.fn().mockResolvedValue(makeRegister()) };
    const receiptRepo = { create: jest.fn() };
    const paymentRepo = { create: jest.fn() };
    const cashMovementRepo = { create: jest.fn() };
    const tx = { runTransaction: async (fn: any) => fn({}) };
    const sales = { execute: jest.fn() };
    const useCase = new CompletePosSaleUseCase(
      shiftRepo as any, settingsRepo as any, registerRepo as any, receiptRepo as any, paymentRepo as any, cashMovementRepo as any, tx as any, sales as any
    );
    await expect(
      useCase.execute({
        companyId: 'cmp_test',
        registerId: 'reg_1',
        shiftId: 'shift_1',
        lines: [{ itemId: 'item_1', qty: 1, unitPrice: 10 }],
        payments: [{ method: 'CARD', amount: 5 }], // 5 != 10 grand total
        actor: { userId: 'cashier_1' },
      })
    ).rejects.toThrow(/must equal the receipt grand total/);
  });

  it('rejects a CARD payment that produces change', async () => {
    const settings = makeSettings();
    const shiftRepo = { getById: jest.fn().mockResolvedValue(makeShift()) };
    const settingsRepo = { getSettings: jest.fn().mockResolvedValue(settings), saveSettings: jest.fn() };
    const registerRepo = { getById: jest.fn().mockResolvedValue(makeRegister()) };
    const receiptRepo = { create: jest.fn() };
    const paymentRepo = { create: jest.fn() };
    const cashMovementRepo = { create: jest.fn() };
    const tx = { runTransaction: async (fn: any) => fn({}) };
    const sales = { execute: jest.fn() };
    const useCase = new CompletePosSaleUseCase(
      shiftRepo as any, settingsRepo as any, registerRepo as any, receiptRepo as any, paymentRepo as any, cashMovementRepo as any, tx as any, sales as any
    );
    await expect(
      useCase.execute({
        companyId: 'cmp_test',
        registerId: 'reg_1',
        shiftId: 'shift_1',
        lines: [{ itemId: 'item_1', qty: 1, unitPrice: 10 }],
        payments: [
          { method: 'CARD', amount: 5, reference: 'AUTH-1' },
          { method: 'CARD', amount: 5, reference: 'AUTH-2', changeGiven: 5 },
        ],
        actor: { userId: 'cashier_1' },
      })
    ).rejects.toThrow(/Only CASH may give change/);
  });

  it('rejects a CARD payment without a reference when requiresReference is on', async () => {
    const settings = makeSettings();
    const shiftRepo = { getById: jest.fn().mockResolvedValue(makeShift()) };
    const settingsRepo = { getSettings: jest.fn().mockResolvedValue(settings), saveSettings: jest.fn() };
    const registerRepo = { getById: jest.fn().mockResolvedValue(makeRegister()) };
    const receiptRepo = { create: jest.fn() };
    const paymentRepo = { create: jest.fn() };
    const cashMovementRepo = { create: jest.fn() };
    const tx = { runTransaction: async (fn: any) => fn({}) };
    const sales = { execute: jest.fn() };
    const useCase = new CompletePosSaleUseCase(
      shiftRepo as any, settingsRepo as any, registerRepo as any, receiptRepo as any, paymentRepo as any, cashMovementRepo as any, tx as any, sales as any
    );
    await expect(
      useCase.execute({
        companyId: 'cmp_test',
        registerId: 'reg_1',
        shiftId: 'shift_1',
        lines: [{ itemId: 'item_1', qty: 1, unitPrice: 10 }],
        payments: [{ method: 'CARD', amount: 10 }],
        actor: { userId: 'cashier_1' },
      })
    ).rejects.toThrow(/requires a reference/);
  });

  it('completes a single-tender CASH exact sale with CASH_FULL settlement', async () => {
    const settings = makeSettings();
    const shift = makeShift();
    const register = makeRegister();
    const shiftRepo = { getById: jest.fn().mockResolvedValue(shift) };
    const settingsRepo = { getSettings: jest.fn().mockResolvedValue(settings), saveSettings: jest.fn() };
    const registerRepo = { getById: jest.fn().mockResolvedValue(register) };
    const receiptRepo = { create: jest.fn().mockResolvedValue(undefined) };
    const paymentRepo = { create: jest.fn().mockResolvedValue(undefined) };
    const cashMovementRepo = { create: jest.fn().mockResolvedValue(undefined) };
    const tx = { runTransaction: async (fn: any) => fn({}) };
    const sales = { execute: jest.fn().mockResolvedValue(baseSalesInvoice()) };
    const useCase = new CompletePosSaleUseCase(
      shiftRepo as any, settingsRepo as any, registerRepo as any, receiptRepo as any, paymentRepo as any, cashMovementRepo as any, tx as any, sales as any
    );

    const result = await useCase.execute({
      companyId: 'cmp_test',
      registerId: 'reg_1',
      shiftId: 'shift_1',
      lines: [{ itemId: 'item_1', qty: 1, unitPrice: 10 }],
      payments: [{ method: 'CASH', amount: 10 }],
      actor: { userId: 'cashier_1' },
    });

    expect(sales.execute).toHaveBeenCalled();
    const [, settlement] = sales.execute.mock.calls[0];
    expect(settlement.settlementMode).toBe('CASH_FULL');
    expect(settlement.settlements[0].paymentMethod).toBe('CASH');
    expect(settlement.settlements[0].amountBase).toBe(10);
    expect(result.change).toBe(0);
    expect(result.salesInvoiceNumber).toBe('SI-0001');
  });

  it('completes a split CASH+CARD sale with MULTI settlement, CASH change netted off', async () => {
    const settings = makeSettings();
    const shift = makeShift();
    const register = makeRegister();
    const shiftRepo = { getById: jest.fn().mockResolvedValue(shift) };
    const settingsRepo = { getSettings: jest.fn().mockResolvedValue(settings), saveSettings: jest.fn() };
    const registerRepo = { getById: jest.fn().mockResolvedValue(register) };
    const receiptRepo = { create: jest.fn().mockResolvedValue(undefined) };
    const paymentRepo = { create: jest.fn().mockResolvedValue(undefined) };
    const cashMovementRepo = { create: jest.fn().mockResolvedValue(undefined) };
    const tx = { runTransaction: async (fn: any) => fn({}) };
    const sales = { execute: jest.fn().mockResolvedValue(baseSalesInvoice()) };
    const useCase = new CompletePosSaleUseCase(
      shiftRepo as any, settingsRepo as any, registerRepo as any, receiptRepo as any, paymentRepo as any, cashMovementRepo as any, tx as any, sales as any
    );

    const result = await useCase.execute({
      companyId: 'cmp_test',
      registerId: 'reg_1',
      shiftId: 'shift_1',
      lines: [{ itemId: 'item_1', qty: 1, unitPrice: 10 }],
      payments: [
        { method: 'CASH', amount: 5 },
        { method: 'CARD', amount: 5, reference: 'AUTH-1' },
      ],
      actor: { userId: 'cashier_1' },
    });

    const [, settlement] = sales.execute.mock.calls[0];
    expect(settlement.settlementMode).toBe('MULTI');
    const cashRow = settlement.settlements.find((s: any) => s.paymentMethod === 'CASH');
    const cardRow = settlement.settlements.find((s: any) => s.paymentMethod === 'CREDIT_CARD');
    expect(cashRow.amountBase).toBe(5);
    expect(cardRow.amountBase).toBe(5);
    expect(result.change).toBe(0);
  });

  it('excludes CASH change from the SI settlement (cash applied = grand total - non-cash)', async () => {
    const settings = makeSettings();
    const shift = makeShift();
    const register = makeRegister();
    const shiftRepo = { getById: jest.fn().mockResolvedValue(shift) };
    const settingsRepo = { getSettings: jest.fn().mockResolvedValue(settings), saveSettings: jest.fn() };
    const registerRepo = { getById: jest.fn().mockResolvedValue(register) };
    const receiptRepo = { create: jest.fn().mockResolvedValue(undefined) };
    const paymentRepo = { create: jest.fn().mockResolvedValue(undefined) };
    const cashMovementRepo = { create: jest.fn().mockResolvedValue(undefined) };
    const tx = { runTransaction: async (fn: any) => fn({}) };
    const sales = { execute: jest.fn().mockResolvedValue(baseSalesInvoice()) };
    const useCase = new CompletePosSaleUseCase(
      shiftRepo as any, settingsRepo as any, registerRepo as any, receiptRepo as any, paymentRepo as any, cashMovementRepo as any, tx as any, sales as any
    );

    // Grand total = 10; customer pays 15 in cash.
    const result = await useCase.execute({
      companyId: 'cmp_test',
      registerId: 'reg_1',
      shiftId: 'shift_1',
      lines: [{ itemId: 'item_1', qty: 1, unitPrice: 10 }],
      payments: [{ method: 'CASH', amount: 15 }],
      actor: { userId: 'cashier_1' },
    });

    const [, settlement] = sales.execute.mock.calls[0];
    expect(settlement.settlementMode).toBe('MULTI');
    expect(settlement.settlements[0].paymentMethod).toBe('CASH');
    expect(settlement.settlements[0].amountBase).toBe(10);
    expect(result.change).toBe(5);
  });

  it('uses settings.walkInCustomerId when no customer is provided', async () => {
    const settings = makeSettings();
    const shift = makeShift();
    const register = makeRegister();
    const shiftRepo = { getById: jest.fn().mockResolvedValue(shift) };
    const settingsRepo = { getSettings: jest.fn().mockResolvedValue(settings), saveSettings: jest.fn() };
    const registerRepo = { getById: jest.fn().mockResolvedValue(register) };
    const receiptRepo = { create: jest.fn().mockResolvedValue(undefined) };
    const paymentRepo = { create: jest.fn().mockResolvedValue(undefined) };
    const cashMovementRepo = { create: jest.fn().mockResolvedValue(undefined) };
    const tx = { runTransaction: async (fn: any) => fn({}) };
    const sales = { execute: jest.fn().mockResolvedValue(baseSalesInvoice()) };
    const useCase = new CompletePosSaleUseCase(
      shiftRepo as any, settingsRepo as any, registerRepo as any, receiptRepo as any, paymentRepo as any, cashMovementRepo as any, tx as any, sales as any
    );

    await useCase.execute({
      companyId: 'cmp_test',
      registerId: 'reg_1',
      shiftId: 'shift_1',
      lines: [{ itemId: 'item_1', qty: 1, unitPrice: 10 }],
      payments: [{ method: 'CASH', amount: 10 }],
      actor: { userId: 'cashier_1' },
    });

    const [input] = sales.execute.mock.calls[0];
    expect(input.customerId).toBe('walk-in-cust');
    expect(input.source).toBe('pos');
    expect(input.formType).toBe('pos_sale');
    expect(input.persona).toBe('direct');
  });
});
