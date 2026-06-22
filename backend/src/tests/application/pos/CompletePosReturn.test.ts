import { CompletePosReturnUseCase, VoidPosReceiptUseCase } from '../../../application/pos/use-cases/CompletePosReturnUseCase';
import { PosReceipt } from '../../../domain/pos/entities/PosReceipt';
import { PosShift } from '../../../domain/pos/entities/PosShift';
import { PosRegister } from '../../../domain/pos/entities/PosRegister';
import { PosSettings } from '../../../domain/pos/entities/PosSettings';

const makeReceipt = (lines?: any[]): PosReceipt =>
  PosReceipt.fromJSON({
    id: 'rcp_1',
    companyId: 'cmp_test',
    shiftId: 'shift_old',
    registerId: 'reg_1',
    receiptNumber: 'R-000001',
    status: 'COMPLETED',
    customerId: 'cust_1',
    lines: lines || [
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
    settlementAccountIds: { CARD: 'card-reg-acc' },
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const setup = (overrides: { shift?: PosShift; postedReturn?: any; receiptLines?: any[]; previousReturns?: any[] } = {}) => {
  const receipt = makeReceipt(overrides.receiptLines);
  const shift = overrides.shift || makeOpenShift();
  const receiptRepo = { getById: jest.fn().mockResolvedValue(receipt), updateStatus: jest.fn().mockResolvedValue(undefined) };
  const returnRepo = { create: jest.fn().mockResolvedValue(undefined), list: jest.fn().mockResolvedValue(overrides.previousReturns || []) };
  const shiftRepo = { getById: jest.fn().mockResolvedValue(shift), getOpenShiftForRegister: jest.fn().mockResolvedValue(shift) };
  const settingsRepo = {
    getSettings: jest.fn().mockResolvedValue(PosSettings.fromJSON({
      companyId: 'cmp_test',
      paymentMethods: [
        { code: 'CASH', settlementAccountId: '', requiresReference: false, allowsChange: true, isEnabled: true },
        { code: 'CARD', settlementAccountId: '', requiresReference: true, allowsChange: false, isEnabled: true },
      ],
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
  const policyEngine = { resolve: jest.fn().mockResolvedValue({ allowed: true, requiresApproval: false, resolvedBy: ['test'] }) };
  const auditEngine = { record: jest.fn().mockResolvedValue(undefined) };
  const useCase = new CompletePosReturnUseCase(
    receiptRepo as any,
    returnRepo as any,
    shiftRepo as any,
    settingsRepo as any,
    cashMovementRepo as any,
    registerRepo as any,
    tx as any,
    postPosReturn as any,
    policyEngine as any,
    auditEngine as any
  );
  return { useCase, receipt, receiptRepo, postPosReturn, returnRepo, cashMovementRepo, policyEngine, auditEngine };
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
    ).rejects.toThrow(/exceeds remaining returnable qty/);
    expect(postPosReturn.execute).not.toHaveBeenCalled();
  });

  it('rejects return qty greater than remaining qty after prior POS returns', async () => {
    const { useCase, postPosReturn } = setup({
      previousReturns: [{ lines: [{ itemId: 'item_a', qty: 1 }] }],
    });

    await expect(
      useCase.execute({
        companyId: 'cmp_test',
        originalReceiptId: 'rcp_1',
        registerId: 'reg_1',
        lines: [{ itemId: 'item_a', qty: 2 }],
        refundMethod: 'CASH',
        actor: { userId: 'cashier_1' },
      })
    ).rejects.toThrow(/exceeds remaining returnable qty 1/);
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
    const { useCase, cashMovementRepo, postPosReturn } = setup();
    await useCase.execute({
      companyId: 'cmp_test',
      originalReceiptId: 'rcp_1',
      registerId: 'reg_1',
      lines: [{ itemId: 'item_a', qty: 1 }],
      refundMethod: 'CARD',
      actor: { userId: 'cashier_1' },
    });
    expect(postPosReturn.execute).toHaveBeenCalledWith(expect.objectContaining({
      settlementAccountId: 'card-reg-acc',
    }));
    expect(cashMovementRepo.create).not.toHaveBeenCalled();
  });

  it('does not allow returns against receipt lines that were voided before posting', async () => {
    const { useCase, postPosReturn } = setup({
      receiptLines: [
        { itemId: 'item_a', itemCode: 'A', itemName: 'A', qty: 1, uom: 'ea', unitPrice: 10, lineDiscount: 0, lineTotal: 10, salesInvoiceLineId: 'pos_line_a' },
        {
          itemId: 'item_void',
          itemCode: 'VOID-1',
          itemName: 'Removed item',
          qty: 3,
          uom: 'ea',
          unitPrice: 4,
          lineDiscount: 0,
          lineTotal: 12,
          status: 'VOIDED',
          voidedBy: 'cashier_1',
          voidReason: 'Customer changed mind',
        },
      ],
    });

    await expect(
      useCase.execute({
        companyId: 'cmp_test',
        originalReceiptId: 'rcp_1',
        registerId: 'reg_1',
        lines: [{ itemId: 'item_void', qty: 1 }],
        refundMethod: 'CASH',
        actor: { userId: 'cashier_1' },
      })
    ).rejects.toThrow(/exceeds remaining returnable qty 0/);
    expect(postPosReturn.execute).not.toHaveBeenCalled();
  });

  it('voids a completed receipt by returning all remaining active lines and marking the receipt VOIDED', async () => {
    const { useCase, receiptRepo, returnRepo, postPosReturn } = setup({
      previousReturns: [{ lines: [{ itemId: 'item_a', qty: 1 }] }],
      postedReturn: {
        returnId: 'ret_void_1',
        returnNumber: 'RET-VOID-0001',
        refundTotal: 15,
        lines: [],
        voucherIds: ['v_void_1'],
      },
    });
    const voidUseCase = new VoidPosReceiptUseCase(receiptRepo as any, returnRepo as any, useCase);

    const result = await voidUseCase.execute({
      companyId: 'cmp_test',
      receiptId: 'rcp_1',
      registerId: 'reg_1',
      refundMethod: 'CASH',
      actor: { userId: 'cashier_1' },
    });

    expect(postPosReturn.execute).toHaveBeenCalledWith(expect.objectContaining({
      lines: [
        { itemId: 'item_a', qty: 1 },
        { itemId: 'item_b', qty: 1 },
      ],
    }));
    expect(receiptRepo.updateStatus).toHaveBeenCalledWith('cmp_test', 'rcp_1', 'VOIDED', { tx: true });
    expect(result.posReturn.returnNumber).toBe('RET-VOID-0001');
  });

  it('blocks POS returns when cashier policy requires manager approval and no override is supplied', async () => {
    const { useCase, postPosReturn, policyEngine } = setup();
    policyEngine.resolve.mockResolvedValueOnce({
      allowed: false,
      requiresApproval: true,
      resolvedBy: ['CashierRolePolicy.managerOverride.RETURN.requiresApproval'],
    });

    await expect(
      useCase.execute({
        companyId: 'cmp_test',
        originalReceiptId: 'rcp_1',
        registerId: 'reg_1',
        lines: [{ itemId: 'item_a', qty: 1 }],
        refundMethod: 'CASH',
        actor: { userId: 'cashier_1', roleId: 'cashier-jr' },
      })
    ).rejects.toThrow(/Manager approval is required for POS return/);
    expect(postPosReturn.execute).not.toHaveBeenCalled();
  });

  it('passes manager-approved POS returns through to posting', async () => {
    const { useCase, postPosReturn, policyEngine } = setup();

    await useCase.execute({
      companyId: 'cmp_test',
      originalReceiptId: 'rcp_1',
      registerId: 'reg_1',
      lines: [{ itemId: 'item_a', qty: 1 }],
      refundMethod: 'CASH',
      managerOverrideId: 'mgr_override_1',
      actor: { userId: 'cashier_1', roleId: 'cashier-jr' },
    });

    expect(policyEngine.resolve).toHaveBeenCalledWith(expect.objectContaining({
      scope: 'pos',
      action: 'managerOverride',
      context: expect.objectContaining({
        overrideAction: 'RETURN',
        approvedOverrideId: 'mgr_override_1',
      }),
    }));
    expect(postPosReturn.execute).toHaveBeenCalled();
  });

  it('records POS return creation through the audit engine after a completed return', async () => {
    const { useCase, auditEngine } = setup();
    await useCase.execute({
      companyId: 'cmp_test',
      originalReceiptId: 'rcp_1',
      registerId: 'reg_1',
      lines: [{ itemId: 'item_a', qty: 1 }],
      refundMethod: 'CASH',
      reason: 'Customer return',
      actor: { userId: 'cashier_1', userEmail: 'cashier@example.com' },
    });

    expect(auditEngine.record).toHaveBeenCalledWith(expect.objectContaining({
      companyId: 'cmp_test',
      entity: expect.objectContaining({ type: 'POS_RETURN', id: 'ret_1', number: 'RET-000001' }),
      action: 'CREATE',
      reason: 'Customer return',
      actor: expect.objectContaining({ userId: 'cashier_1', userEmail: 'cashier@example.com' }),
      after: expect.objectContaining({
        originalReceiptNumber: 'R-000001',
        postedReturnId: 'ret_1',
        voucherIds: ['v_1'],
      }),
    }));
  });
});
