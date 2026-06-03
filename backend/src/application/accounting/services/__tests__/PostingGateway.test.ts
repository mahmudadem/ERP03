import { PostingGateway } from '../PostingGateway';
import { VoucherStatus, VoucherType } from '../../../../domain/accounting/types/VoucherTypes';

/**
 * Stage 4 behavioural proof for the PostingGateway — the single sanctioned choke point in front of
 * every ledger write. See docs/architecture/posting-authority.md.
 */
describe('PostingGateway', () => {
  const makeVoucher = (overrides: Record<string, any> = {}) =>
    ({
      id: 'v-1',
      companyId: 'c-1',
      voucherNo: 'V-1',
      type: VoucherType.JOURNAL_ENTRY as any,
      date: '2026-06-03',
      baseCurrency: 'USD',
      totalDebit: 100,
      totalCredit: 100,
      status: VoucherStatus.APPROVED,
      isApproved: true,
      lines: [],
      metadata: {},
      postingPeriodNo: undefined,
      ...overrides,
    } as any);

  const makeValidationService = () => ({
    validateCore: jest.fn(),
    validateAccounts: jest.fn(async () => undefined),
    validatePolicies: jest.fn(async () => undefined),
  });

  it('runs the iron laws and writes the ledger on the happy path', async () => {
    const ledgerRepo = { recordForVoucher: jest.fn(async () => undefined) } as any;
    const validation = makeValidationService();
    const gateway = new PostingGateway(ledgerRepo, validation as any);

    await gateway.record(makeVoucher(), { userId: 'u-1' });

    expect(validation.validateCore).toHaveBeenCalledTimes(1);
    expect(ledgerRepo.recordForVoucher).toHaveBeenCalledTimes(1);
  });

  it('runs the policy set with the caller-supplied approval state (approved)', async () => {
    const ledgerRepo = { recordForVoucher: jest.fn(async () => undefined) } as any;
    const validation = makeValidationService();
    const registry = {
      getConfig: jest.fn(async () => ({ policyErrorMode: 'FAIL_FAST' })),
      getEnabledPolicies: jest.fn(async () => [{ id: 'p', name: 'p', validate: jest.fn() }]),
    } as any;
    const gateway = new PostingGateway(ledgerRepo, validation as any, registry);

    await gateway.record(makeVoucher(), { userId: 'u-1', approved: true });

    const ctx = (validation.validatePolicies.mock.calls[0] as any[])[0];
    expect(ctx.status).toBe(VoucherStatus.APPROVED);
    expect(ctx.isApproved).toBe(true);
    expect(ledgerRepo.recordForVoucher).toHaveBeenCalledTimes(1);
  });

  it('derives NOT-approved context from the caller, never the voucher stamp (Law 7)', async () => {
    const ledgerRepo = { recordForVoucher: jest.fn(async () => undefined) } as any;
    const validation = makeValidationService();
    const registry = {
      getConfig: jest.fn(async () => ({ policyErrorMode: 'FAIL_FAST' })),
      getEnabledPolicies: jest.fn(async () => [{ id: 'p', name: 'p', validate: jest.fn() }]),
    } as any;
    const gateway = new PostingGateway(ledgerRepo, validation as any, registry);

    // Voucher carries a forged APPROVED stamp, but the caller says it is NOT approved.
    await gateway.record(makeVoucher({ status: VoucherStatus.APPROVED, isApproved: true }), {
      userId: 'u-1',
      approved: false,
    });

    const ctx = (validation.validatePolicies.mock.calls[0] as any[])[0];
    expect(ctx.status).toBe(VoucherStatus.DRAFT);
    expect(ctx.isApproved).toBe(false);
  });

  it('propagates a policy rejection and does NOT write the ledger', async () => {
    const ledgerRepo = { recordForVoucher: jest.fn(async () => undefined) } as any;
    const validation = makeValidationService();
    validation.validatePolicies.mockRejectedValueOnce(new Error('APPROVAL_REQUIRED'));
    const registry = {
      getConfig: jest.fn(async () => ({ policyErrorMode: 'FAIL_FAST' })),
      getEnabledPolicies: jest.fn(async () => [{ id: 'p', name: 'p', validate: jest.fn() }]),
    } as any;
    const gateway = new PostingGateway(ledgerRepo, validation as any, registry);

    await expect(
      gateway.record(makeVoucher(), { userId: 'u-1', approved: false })
    ).rejects.toThrow('APPROVAL_REQUIRED');
    expect(ledgerRepo.recordForVoucher).not.toHaveBeenCalled();
  });

  it('skips the policy set when exempt — but still runs the iron laws and writes', async () => {
    const ledgerRepo = { recordForVoucher: jest.fn(async () => undefined) } as any;
    const validation = makeValidationService();
    const registry = {
      getConfig: jest.fn(async () => ({ policyErrorMode: 'FAIL_FAST' })),
      getEnabledPolicies: jest.fn(async () => [{ id: 'p', name: 'p', validate: jest.fn() }]),
    } as any;
    const gateway = new PostingGateway(ledgerRepo, validation as any, registry);

    await gateway.record(makeVoucher(), {
      userId: 'u-1',
      enforcePolicies: false,
      exemptionReason: 'system-generated settlement',
    });

    expect(validation.validatePolicies).not.toHaveBeenCalled();
    expect(validation.validateCore).toHaveBeenCalledTimes(1);
    expect(ledgerRepo.recordForVoucher).toHaveBeenCalledTimes(1);
  });

  it('rejects a silent exemption (enforcePolicies=false without a reason)', async () => {
    const ledgerRepo = { recordForVoucher: jest.fn(async () => undefined) } as any;
    const validation = makeValidationService();
    const gateway = new PostingGateway(ledgerRepo, validation as any);

    await expect(
      gateway.record(makeVoucher(), { userId: 'u-1', enforcePolicies: false })
    ).rejects.toThrow(/exemptionReason/);
    expect(ledgerRepo.recordForVoucher).not.toHaveBeenCalled();
  });
});
