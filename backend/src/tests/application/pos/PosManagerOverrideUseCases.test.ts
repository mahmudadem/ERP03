import { CreatePosManagerOverrideUseCase } from '../../../application/pos/use-cases/PosManagerOverrideUseCases';
import { ApprovalEngine } from '../../../application/system-core/approval/ApprovalEngine';
import { ApprovalSubjectRegistry } from '../../../application/system-core/approval/ApprovalSubjectRegistry';
import { PosManagerOverrideApprovalPlugin } from '../../../application/system-core/approval/plugins/PosManagerOverrideApprovalPlugin';

// Build an Approval Engine with the POS override plugin. `managers` is the set of
// userIds that hold pos.override.approve authority.
const makeApprovalEngine = (managers: string[] = ['mgr_1']) => {
  const registry = new ApprovalSubjectRegistry();
  registry.register(
    new PosManagerOverrideApprovalPlugin(async (_companyId, userId) => managers.includes(userId))
  );
  return new ApprovalEngine(registry);
};

describe('CreatePosManagerOverrideUseCase', () => {
  it('creates an auditable manager override id', async () => {
    const auditEngine = { record: jest.fn().mockResolvedValue(undefined) };
    const useCase = new CreatePosManagerOverrideUseCase(auditEngine as any);

    const result = await useCase.execute({
      companyId: 'cmp_test',
      action: 'RETURN',
      managerUserId: 'mgr_1',
      managerName: 'Manager One',
      reason: 'Damaged item return approved',
      context: { receiptId: 'rcp_1' },
      actor: { userId: 'cashier_1', userEmail: 'cashier@example.com' },
    });

    expect(result.managerOverrideId).toMatch(/^mgr_override_/);
    expect(result.action).toBe('RETURN');
    expect(result.managerUserId).toBe('mgr_1');
    expect(auditEngine.record).toHaveBeenCalledWith(expect.objectContaining({
      companyId: 'cmp_test',
      entity: expect.objectContaining({
        type: 'POS_MANAGER_OVERRIDE',
        id: result.managerOverrideId,
      }),
      action: 'CREATE',
      reason: 'Damaged item return approved',
      actor: { userId: 'cashier_1', userEmail: 'cashier@example.com' },
      approval: {
        managerOverrideId: result.managerOverrideId,
        managerUserId: 'mgr_1',
        action: 'RETURN',
      },
      after: expect.objectContaining({
        managerOverrideId: result.managerOverrideId,
        managerUserId: 'mgr_1',
        cashierUserId: 'cashier_1',
        context: { receiptId: 'rcp_1' },
      }),
    }));
  });

  it('requires manager identity and reason', async () => {
    const useCase = new CreatePosManagerOverrideUseCase({ record: jest.fn() } as any);

    await expect(useCase.execute({
      companyId: 'cmp_test',
      action: 'VOID_LINE',
      managerUserId: '',
      reason: 'Approved',
      actor: { userId: 'cashier_1' },
    })).rejects.toThrow(/Manager approver is required/);

    await expect(useCase.execute({
      companyId: 'cmp_test',
      action: 'VOID_LINE',
      managerUserId: 'mgr_1',
      reason: '',
      actor: { userId: 'cashier_1' },
    })).rejects.toThrow(/Manager approval reason is required/);
  });

  describe('Approval Engine enforcement (Task 257)', () => {
    it('mints the token when an authorized manager (≠ cashier) approves', async () => {
      const auditEngine = { record: jest.fn().mockResolvedValue(undefined) };
      const useCase = new CreatePosManagerOverrideUseCase(auditEngine as any, makeApprovalEngine(['mgr_1']));

      const result = await useCase.execute({
        companyId: 'cmp_test',
        action: 'PRICE_OVERRIDE',
        managerUserId: 'mgr_1',
        reason: 'Price match approved',
        actor: { userId: 'cashier_1' },
      });

      expect(result.managerOverrideId).toMatch(/^mgr_override_/);
      expect(auditEngine.record).toHaveBeenCalled();
    });

    it('REJECTS self-approval (approver is the acting cashier) and mints no token', async () => {
      const auditEngine = { record: jest.fn() };
      const useCase = new CreatePosManagerOverrideUseCase(auditEngine as any, makeApprovalEngine(['cashier_1']));

      await expect(useCase.execute({
        companyId: 'cmp_test',
        action: 'VOID_LINE',
        managerUserId: 'cashier_1',
        reason: 'Self approve attempt',
        actor: { userId: 'cashier_1' },
      })).rejects.toThrow(/cannot approve their own POS override/);

      expect(auditEngine.record).not.toHaveBeenCalled();
    });

    it('REJECTS an approver without override authority and mints no token', async () => {
      const auditEngine = { record: jest.fn() };
      const useCase = new CreatePosManagerOverrideUseCase(auditEngine as any, makeApprovalEngine(['mgr_1']));

      await expect(useCase.execute({
        companyId: 'cmp_test',
        action: 'TAX_OVERRIDE',
        managerUserId: 'not_a_manager',
        reason: 'Unauthorized approver',
        actor: { userId: 'cashier_1' },
      })).rejects.toThrow(/not authorized to approve POS overrides/);

      expect(auditEngine.record).not.toHaveBeenCalled();
    });
  });
});

describe('PosManagerOverrideApprovalPlugin', () => {
  const plugin = new PosManagerOverrideApprovalPlugin(async (_c, userId) => userId === 'mgr_1');
  const ctx = { companyId: 'cmp_test', actorUserId: 'cashier_1' };

  it('owns the four reserved POS override subject types', () => {
    expect(plugin.supports('pos_manager_override')).toBe(true);
    expect(plugin.supports('price_override')).toBe(true);
    expect(plugin.supports('discount_override')).toBe(true);
    expect(plugin.supports('tax_override')).toBe(true);
    expect(plugin.supports('below_cost_sale')).toBe(false);
    expect(plugin.supports('accounting_voucher')).toBe(false);
  });

  it('PENDING when approval is required but no approver is present', async () => {
    const result = await plugin.evaluate(
      { type: 'pos_manager_override', id: 'x', payload: { requiresApproval: true, action: 'VOID_LINE', cashierUserId: 'cashier_1' } },
      ctx
    );
    expect(result.decision).toBe('PENDING');
  });

  it('REJECTED on self-approval', async () => {
    const result = await plugin.evaluate(
      { type: 'pos_manager_override', id: 'x', payload: { requiresApproval: true, cashierUserId: 'cashier_1', approverUserId: 'cashier_1' } },
      ctx
    );
    expect(result.decision).toBe('REJECTED');
  });

  it('REJECTED when the approver lacks authority', async () => {
    const result = await plugin.evaluate(
      { type: 'price_override', id: 'x', payload: { requiresApproval: true, cashierUserId: 'cashier_1', approverUserId: 'someone_else' } },
      ctx
    );
    expect(result.decision).toBe('REJECTED');
  });

  it('APPROVED for a distinct, authorized manager', async () => {
    const result = await plugin.evaluate(
      { type: 'price_override', id: 'x', payload: { requiresApproval: true, cashierUserId: 'cashier_1', approverUserId: 'mgr_1' } },
      ctx
    );
    expect(result.decision).toBe('APPROVED');
  });
});
