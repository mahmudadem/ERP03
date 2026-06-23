import { CommercialCore } from '../../../application/system-core/commercial/CommercialCore';

/**
 * Task 264 — the Commercial Core's below-cost guard is now driven by the shared
 * company SellingPolicy (resolved via a delegate) with three modes. These tests
 * pin each mode plus the override semantics. A below-cost line has
 * unitPriceBase(10) < unitCostBase(12).
 */
const belowCost = { companyId: 'cmp_1', itemId: 'item_1', unitPriceBase: 10, unitCostBase: 12 };

describe('CommercialCore below-cost SellingPolicy modes (Task 264)', () => {
  it('ALLOW: below-cost sale posts with no approval call', async () => {
    const approvalEngine = { evaluate: jest.fn() };
    const core = new CommercialCore(undefined, undefined, approvalEngine as any, async () => ({ belowCostMode: 'ALLOW' }));

    const result = await core.validateCostMargin(belowCost);

    expect(result).toMatchObject({ allowed: true, requiresApproval: false, reason: 'BELOW_COST' });
    expect(approvalEngine.evaluate).not.toHaveBeenCalled();
  });

  it('BLOCK: below-cost sale is refused outright and never routes to approval', async () => {
    const approvalEngine = { evaluate: jest.fn() };
    const core = new CommercialCore(undefined, undefined, approvalEngine as any, async () => ({ belowCostMode: 'BLOCK' }));

    const result = await core.validateCostMargin(belowCost);

    expect(result).toMatchObject({ allowed: false, requiresApproval: false, reason: 'BELOW_COST' });
    expect(approvalEngine.evaluate).not.toHaveBeenCalled();
  });

  it('BLOCK is absolute when allowManagerOverride is false — even an approved override cannot pass', async () => {
    const core = new CommercialCore(undefined, undefined, undefined, async () => ({
      belowCostMode: 'BLOCK',
      allowManagerOverride: false,
    }));

    const result = await core.validateCostMargin({ ...belowCost, approvedOverride: true });

    expect(result.allowed).toBe(false);
  });

  it('REQUIRE_APPROVAL (policy default): routes to the approval engine', async () => {
    const approvalEngine = {
      evaluate: jest.fn().mockResolvedValue({ decision: 'PENDING', requiredApprovers: ['m'], gates: [] }),
    };
    // No delegate → defaults to REQUIRE_APPROVAL (preserves pre-policy behaviour).
    const core = new CommercialCore(undefined, undefined, approvalEngine as any);

    const result = await core.validateCostMargin(belowCost);

    expect(result).toMatchObject({ allowed: false, requiresApproval: true, reason: 'BELOW_COST' });
    expect(approvalEngine.evaluate).toHaveBeenCalled();
  });

  it('REQUIRE_APPROVAL: an approved override lets the sale post', async () => {
    const approvalEngine = { evaluate: jest.fn() };
    const core = new CommercialCore(undefined, undefined, approvalEngine as any, async () => ({
      belowCostMode: 'REQUIRE_APPROVAL',
    }));

    const result = await core.validateCostMargin({ ...belowCost, approvedOverride: true });

    expect(result).toMatchObject({ allowed: true, requiresApproval: false });
    expect(approvalEngine.evaluate).not.toHaveBeenCalled();
  });

  it('explicit context belowCostMode overrides the policy delegate', async () => {
    const delegate = jest.fn().mockResolvedValue({ belowCostMode: 'BLOCK' });
    const core = new CommercialCore(undefined, undefined, undefined, delegate);

    const result = await core.validateCostMargin({ ...belowCost, belowCostMode: 'ALLOW' });

    expect(result.allowed).toBe(true);
    // companyId still resolves the delegate (for minMargin/override), but mode is pinned.
  });

  it('minimum-margin from policy blocks a thin-but-above-cost margin under REQUIRE_APPROVAL', async () => {
    const approvalEngine = {
      evaluate: jest.fn().mockResolvedValue({ decision: 'PENDING', requiredApprovers: ['m'], gates: [] }),
    };
    const core = new CommercialCore(undefined, undefined, approvalEngine as any, async () => ({
      belowCostMode: 'REQUIRE_APPROVAL',
      minMarginPercent: 40,
    }));

    // price 100, cost 80 → margin 20% < 40% required
    const result = await core.validateCostMargin({ companyId: 'cmp_1', itemId: 'i', unitPriceBase: 100, unitCostBase: 80 });

    expect(result).toMatchObject({ allowed: false, requiresApproval: true, reason: 'BELOW_MIN_MARGIN' });
  });

  it('no cost known → never blocks regardless of mode', async () => {
    const core = new CommercialCore(undefined, undefined, undefined, async () => ({ belowCostMode: 'BLOCK' }));
    const result = await core.validateCostMargin({ companyId: 'c', itemId: 'i', unitPriceBase: 10, unitCostBase: 0 });
    expect(result).toMatchObject({ allowed: true, requiresApproval: false, reason: 'NO_COST' });
  });
});
