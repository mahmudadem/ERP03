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

  it('requires manager approval for configured POS override actions only', async () => {
    const policy = new POSPolicy({
      companyId: 'cmp_test',
      allowPosDirectSales: true,
      cashierRolePolicies: [{
        roleId: 'cashier-jr',
        managerOverrideActions: ['VOID_LINE', 'DISCOUNT_OVERRIDE', 'RETURN', 'REPRINT'],
      }],
    });
    const repo = { getPolicy: jest.fn().mockResolvedValue(policy) };
    const engine = new PolicyEngine(repo as any);

    await expect(engine.resolve({
      scope: 'pos',
      action: 'managerOverride',
      companyId: 'cmp_test',
      context: { cashierRoleId: 'cashier-jr', overrideAction: 'VOID_LINE' },
    })).resolves.toMatchObject({ allowed: false, requiresApproval: true });

    await expect(engine.resolve({
      scope: 'pos',
      action: 'managerOverride',
      companyId: 'cmp_test',
      context: { cashierRoleId: 'cashier-jr', overrideAction: 'VOID_LINE', approvedOverrideId: 'mgr_approval_1' },
    })).resolves.toMatchObject({ allowed: true, requiresApproval: false });

    await expect(engine.resolve({
      scope: 'pos',
      action: 'managerOverride',
      companyId: 'cmp_test',
      context: { cashierRoleId: 'cashier-jr', overrideAction: 'PRICE_OVERRIDE' },
    })).resolves.toMatchObject({ allowed: true, requiresApproval: false });
  });

  it('requires approval when POS sale line controls exceed cashier role limits', async () => {
    const policy = new POSPolicy({
      companyId: 'cmp_test',
      allowPosDirectSales: true,
      cashierRolePolicies: [{
        roleId: 'cashier-jr',
        maxLineDiscountPercent: 10,
        maxLineDiscountAmount: 15,
        allowPriceOverride: false,
        allowTaxOverride: false,
      }],
    });
    const repo = { getPolicy: jest.fn().mockResolvedValue(policy) };
    const engine = new PolicyEngine(repo as any);

    await expect(engine.resolve({
      scope: 'pos',
      action: 'saleLineControls',
      companyId: 'cmp_test',
      context: { cashierRoleId: 'cashier-jr', discountPercent: 5, discountAmount: 5 },
    })).resolves.toMatchObject({ allowed: true, requiresApproval: false });

    await expect(engine.resolve({
      scope: 'pos',
      action: 'saleLineControls',
      companyId: 'cmp_test',
      context: { cashierRoleId: 'cashier-jr', discountPercent: 20, discountAmount: 20, priceOverride: true },
    })).resolves.toMatchObject({ allowed: false, requiresApproval: true });

    await expect(engine.resolve({
      scope: 'pos',
      action: 'saleLineControls',
      companyId: 'cmp_test',
      context: {
        cashierRoleId: 'cashier-jr',
        discountPercent: 20,
        discountAmount: 20,
        priceOverride: true,
        approvedOverrideId: 'mgr_override_1',
      },
    })).resolves.toMatchObject({ allowed: true, requiresApproval: false });
  });
});
