import { PolicyEngine } from '../../../application/system-core/PolicyEngine';
import { POSPolicy } from '../../../domain/pos/entities/POSPolicy';

describe('PolicyEngine POS direct sale policy', () => {
  it('uses most-restrictive-wins and only approved override can escape a terminal deny', async () => {
    const policy = new POSPolicy({
      companyId: 'cmp_test',
      allowPosDirectSales: true,
      terminalPolicies: [{ registerId: 'reg-deny', allowDirectSales: false }],
    });
    const repo = { getPolicy: jest.fn().mockResolvedValue(policy) };
    const engine = new PolicyEngine(repo as any);

    await expect(engine.resolve({
      scope: 'pos',
      action: 'directSale',
      companyId: 'cmp_test',
      context: { registerId: 'reg-ok' },
    })).resolves.toMatchObject({ allowed: true, requiresApproval: false });

    await expect(engine.resolve({
      scope: 'pos',
      action: 'directSale',
      companyId: 'cmp_test',
      context: { registerId: 'reg-deny' },
    })).resolves.toMatchObject({ allowed: false, requiresApproval: false });

    await expect(engine.resolve({
      scope: 'pos',
      action: 'directSale',
      companyId: 'cmp_test',
      context: { registerId: 'reg-deny', approvedOverride: true },
    })).resolves.toMatchObject({ allowed: true, requiresApproval: false });
  });

  it('blocks cashier roles that require approval until an approved override is present', async () => {
    const policy = new POSPolicy({
      companyId: 'cmp_test',
      allowPosDirectSales: true,
      cashierRolePolicies: [{ roleId: 'cashier-jr', requireApprovalForDirectSales: true }],
    });
    const repo = { getPolicy: jest.fn().mockResolvedValue(policy) };
    const engine = new PolicyEngine(repo as any);

    await expect(engine.resolve({
      scope: 'pos',
      action: 'directSale',
      companyId: 'cmp_test',
      context: { cashierRoleId: 'cashier-jr' },
    })).resolves.toMatchObject({ allowed: false, requiresApproval: true });

    await expect(engine.resolve({
      scope: 'pos',
      action: 'directSale',
      companyId: 'cmp_test',
      context: { cashierRoleId: 'cashier-jr', approvedOverride: true },
    })).resolves.toMatchObject({ allowed: true, requiresApproval: false });
  });
});
