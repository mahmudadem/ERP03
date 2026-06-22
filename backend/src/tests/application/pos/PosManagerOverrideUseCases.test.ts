import { CreatePosManagerOverrideUseCase } from '../../../application/pos/use-cases/PosManagerOverrideUseCases';

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
});
