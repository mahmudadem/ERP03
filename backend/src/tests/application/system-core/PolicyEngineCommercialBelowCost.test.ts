import { PolicyEngine } from '../../../application/system-core/PolicyEngine';

/**
 * Task 264 — the Policy Engine exposes the shared below-cost rule as
 * scope:'commercial', action:'belowCostSale'. It delegates the verdict to the
 * Commercial Core (which resolves the company SellingPolicy and does the math),
 * so any module can ask the same question and get the same answer.
 */
describe("PolicyEngine commercial/belowCostSale (Task 264)", () => {
  const posPolicyRepo = { getPolicy: jest.fn().mockResolvedValue(null) } as any;

  it('maps the Commercial Core verdict (blocked) into a deny result', async () => {
    const commercialCore = {
      validateCostMargin: jest.fn().mockResolvedValue({ allowed: false, requiresApproval: true, reason: 'BELOW_COST' }),
    } as any;
    const engine = new PolicyEngine(posPolicyRepo, undefined, commercialCore);

    const result = await engine.resolve({
      scope: 'commercial',
      action: 'belowCostSale',
      companyId: 'cmp_1',
      context: { itemId: 'item_1', unitPriceBase: 10, unitCostBase: 12, source: 'pos' },
    });

    expect(result.allowed).toBe(false);
    expect(result.requiresApproval).toBe(true);
    expect(result.resolvedBy).toContain('CommercialCore.belowCost.BELOW_COST');
    expect(commercialCore.validateCostMargin).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 'cmp_1', itemId: 'item_1', unitPriceBase: 10, unitCostBase: 12, source: 'pos' })
    );
  });

  it('maps an allowed verdict through', async () => {
    const commercialCore = {
      validateCostMargin: jest.fn().mockResolvedValue({ allowed: true, requiresApproval: false, reason: 'OK' }),
    } as any;
    const engine = new PolicyEngine(posPolicyRepo, undefined, commercialCore);

    const result = await engine.resolve({
      scope: 'commercial',
      action: 'belowCostSale',
      companyId: 'cmp_1',
      context: { itemId: 'i', unitPriceBase: 100, unitCostBase: 60 },
    });

    expect(result).toMatchObject({ allowed: true, requiresApproval: false });
  });

  it('defaults to allow when no Commercial Core is wired (does not silently block)', async () => {
    const engine = new PolicyEngine(posPolicyRepo);
    const result = await engine.resolve({
      scope: 'commercial',
      action: 'belowCostSale',
      companyId: 'cmp_1',
      context: { itemId: 'i', unitPriceBase: 10, unitCostBase: 12 },
    });
    expect(result.allowed).toBe(true);
    expect(result.resolvedBy).toContain('CommercialCore.notConfigured');
  });
});
