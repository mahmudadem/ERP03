import { LegacyApprovalEngineAdapter } from '../../../application/system-core/adapters/LegacyApprovalEngineAdapter';

/**
 * Item 4: the accounting_voucher approval REQUIREMENT decision is now resolved through the unified
 * IApprovalEngine (LegacyApprovalEngineAdapter) inside SubledgerVoucherPostingService.resolveApproved.
 * These tests prove the engine decision is byte-for-byte equivalent to the legacy inline config
 * formula it replaced: approvalRequired && !exempt.includes(type)  →  blocks (not approved).
 */
describe('Item 4: voucher posting approval routed through IApprovalEngine (parity)', () => {
  const makeRegistry = (approvalRequired: boolean, exempt: string[] = []) => ({
    isApprovalRequiredForVoucherType: async (_companyId: string, voucherType: string) =>
      approvalRequired && !exempt.includes(voucherType),
  });

  const decideApproved = async (registry: any, voucherType: string): Promise<boolean> => {
    const engine = new LegacyApprovalEngineAdapter(registry);
    const result = await engine.evaluate(
      { type: 'accounting_voucher', id: 'v1', payload: { voucherType } },
      { companyId: 'c1', voucherType }
    );
    return result.decision === 'APPROVED';
  };

  it('approval OFF → approved (posts)', async () => {
    expect(await decideApproved(makeRegistry(false), 'journal_entry')).toBe(true);
  });

  it('approval ON, type not exempt → not approved (blocks)', async () => {
    expect(await decideApproved(makeRegistry(true), 'journal_entry')).toBe(false);
  });

  it('approval ON, type exempt → approved (posts)', async () => {
    expect(await decideApproved(makeRegistry(true, ['journal_entry']), 'journal_entry')).toBe(true);
  });

  it('engine decision equals the legacy config formula for every combination', async () => {
    for (const required of [true, false]) {
      for (const exempt of [[] as string[], ['journal_entry']]) {
        const legacyApproved = !(required && !exempt.includes('journal_entry'));
        expect(await decideApproved(makeRegistry(required, exempt), 'journal_entry')).toBe(legacyApproved);
      }
    }
  });
});
