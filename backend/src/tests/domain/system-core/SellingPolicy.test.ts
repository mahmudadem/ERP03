import { SellingPolicy } from '../../../domain/system-core/entities/SellingPolicy';

/** Task 264 — shared company-level selling policy (below-cost / minimum-margin). */
describe('SellingPolicy', () => {
  it('defaults to the protective REQUIRE_APPROVAL mode with overrides allowed', () => {
    const policy = SellingPolicy.createDefault('cmp_1');
    expect(policy.belowCostMode).toBe('REQUIRE_APPROVAL');
    expect(policy.allowManagerOverride).toBe(true);
    expect(policy.minMarginPercent).toBeUndefined();
  });

  it('rejects an unknown belowCostMode and falls back to REQUIRE_APPROVAL', () => {
    const policy = new SellingPolicy({ companyId: 'cmp_1', belowCostMode: 'NONSENSE' as any });
    expect(policy.belowCostMode).toBe('REQUIRE_APPROVAL');
  });

  it('accepts the three valid modes and a numeric minimum margin', () => {
    expect(new SellingPolicy({ companyId: 'c', belowCostMode: 'BLOCK' }).belowCostMode).toBe('BLOCK');
    expect(new SellingPolicy({ companyId: 'c', belowCostMode: 'ALLOW' }).belowCostMode).toBe('ALLOW');
    const withMargin = new SellingPolicy({ companyId: 'c', minMarginPercent: 15 });
    expect(withMargin.minMarginPercent).toBe(15);
  });

  it('treats allowManagerOverride === false as an absolute control', () => {
    const policy = new SellingPolicy({ companyId: 'c', allowManagerOverride: false });
    expect(policy.allowManagerOverride).toBe(false);
  });

  it('round-trips through toJSON/fromJSON', () => {
    const original = new SellingPolicy({
      companyId: 'cmp_1',
      belowCostMode: 'ALLOW',
      minMarginPercent: 10,
      allowManagerOverride: false,
    });
    const restored = SellingPolicy.fromJSON(original.toJSON());
    expect(restored.belowCostMode).toBe('ALLOW');
    expect(restored.minMarginPercent).toBe(10);
    expect(restored.allowManagerOverride).toBe(false);
  });

  it('requires a companyId', () => {
    expect(() => new SellingPolicy({ companyId: '' })).toThrow(/companyId/);
  });
});
