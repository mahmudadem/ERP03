import { CompletePosReturnUseCase } from '../../../application/pos/use-cases/CompletePosReturnUseCase';
import { PosReceipt } from '../../../domain/pos/entities/PosReceipt';
import { PosShift } from '../../../domain/pos/entities/PosShift';

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
      { itemId: 'item_a', itemCode: 'A', itemName: 'A', qty: 2, uom: 'ea', unitPrice: 10, lineDiscount: 0, lineTotal: 20, salesInvoiceLineId: 'sil_a' },
      { itemId: 'item_b', itemCode: 'B', itemName: 'B', qty: 1, uom: 'ea', unitPrice: 5, lineDiscount: 0, lineTotal: 5, salesInvoiceLineId: 'sil_b' },
    ],
    subtotal: 25,
    discountTotal: 0,
    taxTotal: 0,
    grandTotal: 25,
    salesInvoiceId: 'si_1',
    salesInvoiceNumber: 'SI-0001',
    createdBy: 'cashier_1',
    createdAt: new Date(),
  });

// Mock SalesReturn — we don't need the full domain object for the use case tests;
// the use case reads `id`, `returnNumber`, and `grandTotalBase` (authoritative tax-inclusive refund) off it.
const makeSalesReturn = (): any => ({
  id: 'sr_1',
  returnNumber: 'SR-0001',
  grandTotalBase: 11.5, // 10 net + 15% tax — the customer is refunded what they paid
});

describe('CompletePosReturnUseCase', () => {
  it('rejects return qty greater than sold qty', async () => {
    const receipt = makeReceipt();
    const shift = PosShift.fromJSON({
      id: 'shift_new',
      companyId: 'cmp_test',
      registerId: 'reg_1',
      cashierUserId: 'cashier_1',
      status: 'OPEN',
      openedAt: new Date(),
      openingFloat: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const receiptRepo = { getById: jest.fn().mockResolvedValue(receipt) };
    const returnRepo = { create: jest.fn() };
    const shiftRepo = { getById: jest.fn().mockResolvedValue(shift), getOpenShiftForRegister: jest.fn().mockResolvedValue(shift) };
    const settingsRepo = { getSettings: jest.fn() };
    const cashMovementRepo = { create: jest.fn() };
    const tx = { runTransaction: async (fn: any) => fn({}) };
    const useCase = new CompletePosReturnUseCase(
      receiptRepo as any, returnRepo as any, shiftRepo as any, settingsRepo as any, cashMovementRepo as any, tx as any,
      { execute: jest.fn() } as any,
      { execute: jest.fn() } as any
    );
    await expect(
      useCase.execute({
        companyId: 'cmp_test',
        originalReceiptId: 'rcp_1',
        registerId: 'reg_1',
        lines: [{ itemId: 'item_a', qty: 5 }], // > sold qty 2
        refundMethod: 'CASH',
        actor: { userId: 'cashier_1' },
      })
    ).rejects.toThrow(/exceeds sold qty/);
  });

  it('rejects returns when the current shift on the register is closed', async () => {
    const receipt = makeReceipt();
    const shift = PosShift.fromJSON({
      id: 'shift_new',
      companyId: 'cmp_test',
      registerId: 'reg_1',
      cashierUserId: 'cashier_1',
      status: 'CLOSED',
      openedAt: new Date(),
      openingFloat: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const receiptRepo = { getById: jest.fn().mockResolvedValue(receipt) };
    const returnRepo = { create: jest.fn() };
    const shiftRepo = { getById: jest.fn().mockResolvedValue(shift), getOpenShiftForRegister: jest.fn().mockResolvedValue(shift) };
    const settingsRepo = { getSettings: jest.fn() };
    const cashMovementRepo = { create: jest.fn() };
    const tx = { runTransaction: async (fn: any) => fn({}) };
    const useCase = new CompletePosReturnUseCase(
      receiptRepo as any, returnRepo as any, shiftRepo as any, settingsRepo as any, cashMovementRepo as any, tx as any,
      { execute: jest.fn() } as any,
      { execute: jest.fn() } as any
    );
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

  it('attaches to the current open shift even if the original shift is closed', async () => {
    const receipt = makeReceipt();
    const originalShiftClosed = PosShift.fromJSON({
      id: 'shift_old',
      companyId: 'cmp_test',
      registerId: 'reg_1',
      cashierUserId: 'cashier_1',
      status: 'CLOSED',
      openedAt: new Date(),
      openingFloat: 100,
      closedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const newShift = PosShift.fromJSON({
      id: 'shift_new',
      companyId: 'cmp_test',
      registerId: 'reg_1',
      cashierUserId: 'cashier_1',
      status: 'OPEN',
      openedAt: new Date(),
      openingFloat: 50,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const receiptRepo = { getById: jest.fn().mockResolvedValue(receipt) };
    const returnRepo = { create: jest.fn().mockResolvedValue(undefined) };
    const shiftRepo = { getById: jest.fn(), getOpenShiftForRegister: jest.fn().mockResolvedValue(newShift) };
    const settingsRepo = { getSettings: jest.fn() };
    const cashMovementRepo = { create: jest.fn().mockResolvedValue(undefined) };
    const tx = { runTransaction: async (fn: any) => fn({}) };
    const salesReturn = makeSalesReturn();
    const useCase = new CompletePosReturnUseCase(
      receiptRepo as any, returnRepo as any, shiftRepo as any, settingsRepo as any, cashMovementRepo as any, tx as any,
      { execute: jest.fn().mockResolvedValue(salesReturn) } as any,
      { execute: jest.fn().mockResolvedValue(salesReturn) } as any
    );
    const result = await useCase.execute({
      companyId: 'cmp_test',
      originalReceiptId: 'rcp_1',
      registerId: 'reg_1',
      lines: [{ itemId: 'item_a', qty: 1 }],
      refundMethod: 'CASH',
      actor: { userId: 'cashier_1' },
    });
    expect(result.posReturn.shiftId).toBe('shift_new');
    expect(result.refundTotal).toBe(11.5); // tax-inclusive refund from the posted Sales Return
    expect(cashMovementRepo.create).toHaveBeenCalled();
  });

  it('does not write a REFUND_CASH movement when refundMethod is CARD', async () => {
    const receipt = makeReceipt();
    const newShift = PosShift.fromJSON({
      id: 'shift_new',
      companyId: 'cmp_test',
      registerId: 'reg_1',
      cashierUserId: 'cashier_1',
      status: 'OPEN',
      openedAt: new Date(),
      openingFloat: 50,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const receiptRepo = { getById: jest.fn().mockResolvedValue(receipt) };
    const returnRepo = { create: jest.fn().mockResolvedValue(undefined) };
    const shiftRepo = { getById: jest.fn(), getOpenShiftForRegister: jest.fn().mockResolvedValue(newShift) };
    const settingsRepo = { getSettings: jest.fn() };
    const cashMovementRepo = { create: jest.fn() };
    const tx = { runTransaction: async (fn: any) => fn({}) };
    const salesReturn = makeSalesReturn();
    const useCase = new CompletePosReturnUseCase(
      receiptRepo as any, returnRepo as any, shiftRepo as any, settingsRepo as any, cashMovementRepo as any, tx as any,
      { execute: jest.fn().mockResolvedValue(salesReturn) } as any,
      { execute: jest.fn().mockResolvedValue(salesReturn) } as any
    );
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

  it('calls the Sales return use cases with the receipt\'s salesInvoiceId', async () => {
    const receipt = makeReceipt();
    const newShift = PosShift.fromJSON({
      id: 'shift_new',
      companyId: 'cmp_test',
      registerId: 'reg_1',
      cashierUserId: 'cashier_1',
      status: 'OPEN',
      openedAt: new Date(),
      openingFloat: 50,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const receiptRepo = { getById: jest.fn().mockResolvedValue(receipt) };
    const returnRepo = { create: jest.fn().mockResolvedValue(undefined) };
    const shiftRepo = { getById: jest.fn(), getOpenShiftForRegister: jest.fn().mockResolvedValue(newShift) };
    const settingsRepo = { getSettings: jest.fn() };
    const cashMovementRepo = { create: jest.fn() };
    const tx = { runTransaction: async (fn: any) => fn({}) };
    const salesReturn = makeSalesReturn();
    const create = { execute: jest.fn().mockResolvedValue(salesReturn) };
    const post = { execute: jest.fn().mockResolvedValue(salesReturn) };
    const useCase = new CompletePosReturnUseCase(
      receiptRepo as any, returnRepo as any, shiftRepo as any, settingsRepo as any, cashMovementRepo as any, tx as any,
      create as any, post as any
    );
    await useCase.execute({
      companyId: 'cmp_test',
      originalReceiptId: 'rcp_1',
      registerId: 'reg_1',
      lines: [{ itemId: 'item_a', qty: 1 }],
      refundMethod: 'CASH',
      actor: { userId: 'cashier_1' },
    });
    const [createInput] = create.execute.mock.calls[0];
    expect(createInput.salesInvoiceId).toBe('si_1');
    expect(createInput.lines[0].salesInvoiceLineId).toBe('sil_a');
    expect(post.execute).toHaveBeenCalledWith('cmp_test', 'sr_1', true, undefined, expect.any(Object));
  });
});
