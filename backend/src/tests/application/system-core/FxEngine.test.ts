import { LegacyFxAdapter } from '../../../application/system-core/adapters/LegacyFxAdapter';

/**
 * Task 255: the FX engine seam delegates to the centralized core exchange-rate logic.
 * These prove behaviour-preserving wrapping (same resolution source, same deviation warning,
 * same save round-trip) — not new behaviour.
 */
describe('LegacyFxAdapter (IFxEngine seam)', () => {
  const makeRepo = (overrides: any = {}) => ({
    getLatestRate: jest.fn().mockResolvedValue(null),
    getMostRecentRateBeforeDate: jest.fn().mockResolvedValue(null),
    getRecentRates: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  it('resolveRate returns EXACT_DATE when the repo has an exact rate', async () => {
    const rate = { id: 'er_1', rate: 3.5, fromCurrency: 'USD', toCurrency: 'EUR' };
    const repo = makeRepo({ getLatestRate: jest.fn().mockResolvedValue(rate) });
    const fx = new LegacyFxAdapter(repo as any);

    const result = await fx.resolveRate('cmp_1', 'USD', 'EUR', new Date('2026-06-22'));

    expect(result.source).toBe('EXACT_DATE');
    expect(result.rate).toBe(rate);
  });

  it('resolveRate returns NONE when no rate exists anywhere', async () => {
    const fx = new LegacyFxAdapter(makeRepo() as any);
    const result = await fx.resolveRate('cmp_1', 'USD', 'EUR', new Date('2026-06-22'));
    expect(result.source).toBe('NONE');
    expect(result.rate).toBeNull();
  });

  it('detectDeviations returns a FIRST_RATE advisory when there is no history', async () => {
    const fx = new LegacyFxAdapter(makeRepo() as any);
    const warnings = await fx.detectDeviations('cmp_1', 'USD', 'EUR', 3.5);
    expect(warnings.map(w => w.type)).toContain('FIRST_RATE');
  });

  it('saveReferenceRate persists a positive rate via the repo', async () => {
    const repo = makeRepo();
    const fx = new LegacyFxAdapter(repo as any);

    const saved = await fx.saveReferenceRate({
      companyId: 'cmp_1', fromCurrency: 'usd', toCurrency: 'eur', rate: 3.5, date: new Date('2026-06-22'), userId: 'u_1',
    });

    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(saved.fromCurrency).toBe('USD');
    expect(saved.rate).toBe(3.5);
  });

  it('saveReferenceRate rejects a non-positive rate (unchanged validation)', async () => {
    const fx = new LegacyFxAdapter(makeRepo() as any);
    await expect(
      fx.saveReferenceRate({ companyId: 'cmp_1', fromCurrency: 'USD', toCurrency: 'EUR', rate: 0, date: new Date(), userId: 'u_1' })
    ).rejects.toThrow(/positive/i);
  });
});
