import { CompletePosReturnUseCase } from '../../../application/pos/use-cases/CompletePosReturnUseCase';
import { PosReceipt } from '../../../domain/pos/entities/PosReceipt';
import { PosShift } from '../../../domain/pos/entities/PosShift';
import { PosRegister } from '../../../domain/pos/entities/PosRegister';
import { PosSettings } from '../../../domain/pos/entities/PosSettings';

const makeReceipt = (): PosReceipt =>
  PosReceipt.fromJSON({
    id: 'rcp_1',
    companyId: 'cmp_test',
    shiftId: 'shift_old',
    registerId: 'reg_1',
    receiptNumber: 'R-000001',
    status: 'COMPLETED',
    customerId: 'cust_1',
    lines: [
      { itemId: 'item_a', itemCode: 'A', itemName: 'A', qty: 2, uom: 'ea', unitPrice: 10, lineDiscount: 0, lineTotal: 20, salesInvoiceLineId: 'pos_line_a', revenueAccountId: 'rev', cogsAccountId: 'cogs', inventoryAccountId: 'inv', unitCostBase: 4, lineCostBase: 8 },
      { itemId: 'item_b', itemCode: 'B', itemName: 'B', qty: 1, uom: 'ea', unitPrice: 5, lineDiscount: 0, lineTotal: 5, salesInvoiceLineId: 'pos_line_b', revenueAccountId: 'rev', cogsAccountId: 'cogs', inventoryAccountId: 'inv', unitCostBase: 2, lineCostBase: 2 },
    ],
    subtotal: 25,
    discountTotal: 0,
    taxTotal: 0,
    grandTotal: 25,
    salesInvoiceId: 'pos_sale_1',
    salesInvoiceNumber: 'R-000001',
    createdBy: 'cashier_1',
    createdAt: new Date(),
  });

const makeOpenShift = (overrides: Partial<any> = {}) =>
  PosShift.fromJSON({
    id: 'shift_new',
    companyId: 'cmp_test',
    registerId: 'reg_1',
    cashierUserId: 'cashier_1',
    status: 'OPEN',
    openedAt: new Date(),
    openingFloat: 50,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

const makeRegister = () =>
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

const setup = (overrides: { shift?: PosShift; postedReturn?: any } = {}) => {
  const receipt = makeReceipt();
  const shift = overrides.shift || makeOpenShift();
  const receiptRepo = { getById: jest.fn().mockResolvedValue(receipt) };
  const returnRepo = { create: jest.fn().mockResolvedValue(undefined) };
  const shiftRepo = { getById: jest.fn().mockResolvedValue(shift), getOpenShiftForRegister: jest.fn().mockResolvedValue(shift) };
  const settingsRepo = {
    getSettings: jest.fn().mockResolvedValue(PosSettings.fromJSON({
      companyId: 'cmp_test',
      paymentMethods: [{ code: 'CASH', settlementAccountId: 'cash-acc', requiresReference: false, allowsChange: true, isEnabled: true }],
    })),
  };
  const cashMovementRepo = { create: jest.fn().mockResolvedValue(undefined) };
  const registerRepo = { getById: jest.fn().mockResolvedValue(makeRegister()) };
  const tx = { runTransaction: async (fn: any) => fn({ tx: true }) };
  const postPosReturn = {
    execute: jest.fn().mockResolvedValue(overrides.postedReturn || {
      returnId: 'ret_1',
      returnNumber: 'RET-000001',
      refundTotal: 11.5,
      lines: [],
      voucherIds: ['v_1'],
    }),
  };
  const useCase = new CompletePosReturnUseCase(
    receiptRepo as any,
    returnRepo as any,
    shiftRepo as any,
    settingsRepo as any,
    cashMovementRepo as any,
    registerRepo as any,
    tx as any,
    postPosReturn as any
  );
  return { useCase, receipt, postPosReturn, returnRepo, cashMovementRepo };
};

describe('CompletePosReturnUseCase', () => {
  it('rejects return qty greater than sold qty', async () => {
    const { useCase, postPosReturn } = setup();
    await expect(
      useCase.execute({
        companyId: 'cmp_test',
        originalReceiptId: 'rcp_1',
        registerId: 'reg_1',
        lines: [{ itemId: 'item_a', qty: 5 }],
        refundMethod: 'CASH',
        actor: { userId: 'cashier_1' },
      })
    ).rejects.toThrow(/exceeds sold qty/);
    expect(postPosReturn.execute).not.toHaveBeenCalled();
  });

  it('rejects returns when the current shift on the register is closed', async () => {
    const { useCase } = setup({ shift: makeOpenShift({ status: 'CLOSED' }) });
    await expect(
      useCase.execute({
        companyId: 'cmp_test',
        originalReceiptId: 'rcp_1',
        registerId: 'reg_1',
        lines: [{ itemId: 'item_a', qty: 1 }],
        refundMethod: 'CASH',
        actor: { userId: 'cashier_1' },
      })
    ).rejects.toThrow(/closed/);
  });

  it('attaches to the current open shift and posts through POS return posting', async () => {
    const { useCase, postPosReturn, cashMovementRepo } = setup();
    const result = await useCase.execute({
      companyId: 'cmp_test',
      originalReceiptId: 'rcp_1',
      registerId: 'reg_1',
      lines: [{ itemId: 'item_a', qty: 1 }],
      refundMethod: 'CASH',
      actor: { userId: 'cashier_1' },
    });
    expect(result.posReturn.shiftId).toBe('shift_new');
    expect(result.refundTotal).toBe(11.5);
    expect(postPosReturn.execute).toHaveBeenCalledWith(expect.objectContaining({
      companyId: 'cmp_test',
      originalReceipt: expect.any(PosReceipt),
      warehouseId: 'wh1',
      settlementAccountId: 'cash-acc',
      transaction: { tx: true },
    }));
    expect(cashMovementRepo.create).toHaveBeenCalled();
  });

  it('does not write a REFUND_CASH movement when refundMethod is CARD', async () => {
    const { useCase, cashMovementRepo } = setup();
    await useCase.execute({
      companyId: 'cmp_test',
      originalReceiptId: 'rcp_1',
      registerId: 'reg_1',
      lines: [{ itemId: 'item_a', qty: 1 }],
      refundMethod: 'CARD',
      actor: { userId: 'cashier_1' },
    });
    expect(cashMovementRepo.create).not.toHaveBeenCalled();
  });
});
