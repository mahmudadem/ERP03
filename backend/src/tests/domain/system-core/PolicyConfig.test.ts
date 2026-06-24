import { PolicyConfig, PolicyRule } from '../../../domain/system-core/entities/PolicyConfig';

/**
 * Task 267-C — `PolicyConfig` entity validation.
 *
 * Review feedback (267-C):
 *   - Random rule ids (Math.random) must NOT be used to fill missing ids.
 *   - Missing or blank rule ids must throw at the entity boundary.
 *   - Missing or blank rule actions must also throw (audit / log integrity).
 *   - Missing scope must throw (the resolver walks by scope).
 */
describe('PolicyConfig (Task 267-C validation)', () => {
  it('createDefault returns an empty rule set with the given companyId', () => {
    const cfg = PolicyConfig.createDefault('cmp_x');
    expect(cfg.companyId).toBe('cmp_x');
    expect(cfg.rules).toEqual([]);
  });

  it('accepts a well-formed rule', () => {
    const rule: PolicyRule = {
      id: 'r1',
      scope: 'MODULE',
      module: 'pos',
      action: 'directSale',
      effect: 'ALLOW',
    };
    const cfg = new PolicyConfig({ companyId: 'cmp_x', rules: [rule] });
    expect(cfg.rules).toHaveLength(1);
    expect(cfg.rules[0].id).toBe('r1');
  });

  it('rejects a rule with a missing id', () => {
    expect(() => new PolicyConfig({
      companyId: 'cmp_x',
      rules: [{ id: '', scope: 'TENANT', action: 'a', effect: 'ALLOW' } as PolicyRule],
    })).toThrow(/PolicyRule id is required/);
  });

  it('rejects a rule with a whitespace-only id', () => {
    expect(() => new PolicyConfig({
      companyId: 'cmp_x',
      rules: [{ id: '   ', scope: 'TENANT', action: 'a', effect: 'ALLOW' } as PolicyRule],
    })).toThrow(/PolicyRule id is required/);
  });

  it('rejects a rule with an undefined id (never silently mints one)', () => {
    // This is the explicit regression for the review finding: previously
    // `normalizeRule` would call `Math.random()` to mint an id when the
    // caller forgot one. That made rule identity non-deterministic and
    // broke audit / `effectiveRuleId` references. The entity must throw.
    expect(() => new PolicyConfig({
      companyId: 'cmp_x',
      rules: [{ id: undefined as any, scope: 'TENANT', action: 'a', effect: 'ALLOW' } as PolicyRule],
    })).toThrow(/PolicyRule id is required/);
  });

  it('rejects a rule with a missing action', () => {
    expect(() => new PolicyConfig({
      companyId: 'cmp_x',
      rules: [{ id: 'r1', scope: 'TENANT', action: '', effect: 'ALLOW' } as PolicyRule],
    })).toThrow(/action is required/);
  });

  it('rejects a rule with a missing scope', () => {
    expect(() => new PolicyConfig({
      companyId: 'cmp_x',
      rules: [{ id: 'r1', scope: undefined as any, action: 'a', effect: 'ALLOW' } as PolicyRule],
    })).toThrow(/scope is required/);
  });

  it('trims a well-formed id (no random fallback)', () => {
    const cfg = new PolicyConfig({
      companyId: 'cmp_x',
      rules: [{ id: '  r1  ', scope: 'TENANT', action: 'a', effect: 'ALLOW' } as PolicyRule],
    });
    expect(cfg.rules[0].id).toBe('r1');
  });

  it('rejects a companyId that is missing or blank', () => {
    expect(() => new PolicyConfig({ companyId: '', rules: [] })).toThrow(/companyId is required/);
    expect(() => new PolicyConfig({ companyId: '   ', rules: [] })).toThrow(/companyId is required/);
  });
});
