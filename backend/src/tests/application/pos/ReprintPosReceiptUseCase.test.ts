import { ReprintPosReceiptUseCase } from '../../../application/pos/use-cases/PosReceiptUseCases';
import { PosPayment } from '../../../domain/pos/entities/PosPayment';
import { PosReceipt } from '../../../domain/pos/entities/PosReceipt';

const makeReceipt = (): PosReceipt =>
  PosReceipt.fromJSON({
    id: 'rcp_1',
    companyId: 'cmp_test',
    shiftId: 'shift_1',
    registerId: 'reg_1',
    receiptNumber: 'R-000001',
    status: 'COMPLETED',
    customerId: 'cust_1',
    lines: [{ itemId: 'i1', itemCode: 'A', itemName: 'A', qty: 1, uom: 'ea', unitPrice: 10, lineDiscount: 0, lineTotal: 10 }],
    subtotal: 10,
    discountTotal: 0,
    taxTotal: 0,
    grandTotal: 10,
    createdBy: 'cashier_1',
    createdAt: new Date('2026-06-22T10:00:00.000Z'),
  });

const makePayment = (): PosPayment =>
  PosPayment.fromJSON({
    id: 'pmt_1',
    companyId: 'cmp_test',
    receiptId: 'rcp_1',
    method: 'CASH',
    amount: 10,
    changeGiven: 0,
    createdAt: new Date('2026-06-22T10:00:00.000Z'),
  });

const setup = () => {
  const receiptRepo = { getById: jest.fn().mockResolvedValue(makeReceipt()) };
  const paymentRepo = { listByReceipt: jest.fn().mockResolvedValue([makePayment()]) };
  const policyEngine = { resolve: jest.fn().mockResolvedValue({ allowed: true, requiresApproval: false, resolvedBy: ['test'] }) };
  const auditEngine = { record: jest.fn().mockResolvedValue(undefined) };
  const useCase = new ReprintPosReceiptUseCase(receiptRepo as any, paymentRepo as any, policyEngine as any, auditEngine as any);
  return { useCase, receiptRepo, paymentRepo, policyEngine, auditEngine };
};

describe('ReprintPosReceiptUseCase', () => {
  it('blocks reprint when cashier policy requires manager approval and no override is supplied', async () => {
    const { useCase, policyEngine, auditEngine } = setup();
    policyEngine.resolve.mockResolvedValueOnce({
      allowed: false,
      requiresApproval: true,
      resolvedBy: ['CashierRolePolicy.managerOverride.REPRINT.requiresApproval'],
    });

    await expect(
      useCase.execute({
        companyId: 'cmp_test',
        receiptId: 'rcp_1',
        actor: { userId: 'cashier_1', roleId: 'cashier-jr' },
      })
    ).rejects.toThrow(/Manager approval is required for POS receipt reprint/);
    expect(auditEngine.record).not.toHaveBeenCalled();
  });

  it('records a POS receipt reprint audit row when allowed', async () => {
    const { useCase, paymentRepo, policyEngine, auditEngine } = setup();

    const result = await useCase.execute({
      companyId: 'cmp_test',
      receiptId: 'rcp_1',
      managerOverrideId: 'mgr_override_1',
      reason: 'Customer requested copy',
      actor: { userId: 'cashier_1', userEmail: 'cashier@example.com', roleId: 'cashier-jr' },
    });

    expect(result.receipt.receiptNumber).toBe('R-000001');
    expect(result.payments).toHaveLength(1);
    expect(paymentRepo.listByReceipt).toHaveBeenCalledWith('cmp_test', 'rcp_1');
    expect(policyEngine.resolve).toHaveBeenCalledWith(expect.objectContaining({
      scope: 'pos',
      action: 'managerOverride',
      context: expect.objectContaining({
        overrideAction: 'REPRINT',
        cashierRoleId: 'cashier-jr',
        approvedOverrideId: 'mgr_override_1',
      }),
    }));
    expect(auditEngine.record).toHaveBeenCalledWith(expect.objectContaining({
      companyId: 'cmp_test',
      entity: { type: 'POS_RECEIPT', id: 'rcp_1', number: 'R-000001' },
      action: 'UPDATE',
      reason: 'Customer requested copy',
      actor: { userId: 'cashier_1', userEmail: 'cashier@example.com' },
      approval: { managerOverrideId: 'mgr_override_1' },
      before: { reprintRequested: false },
      after: expect.objectContaining({
        reprintRequested: true,
        managerOverrideId: 'mgr_override_1',
      }),
    }));
  });
});
