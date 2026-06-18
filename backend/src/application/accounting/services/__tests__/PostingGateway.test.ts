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

  it('replaces posted voucher ledger rows behind the same guarded door', async () => {
    const ledgerRepo = {
      deleteForVoucher: jest.fn(async () => undefined),
      recordForVoucher: jest.fn(async () => undefined),
    } as any;
    const validation = makeValidationService();
    const registry = {
      getConfig: jest.fn(async () => ({ policyErrorMode: 'FAIL_FAST' })),
      getEnabledPolicies: jest.fn(async () => [{ id: 'p', name: 'p', validate: jest.fn() }]),
    } as any;
    const gateway = new PostingGateway(ledgerRepo, validation as any, registry);

    await gateway.replaceForVoucher(makeVoucher(), { userId: 'u-1', approved: true }, 'tx-1');

    expect(validation.validateCore).toHaveBeenCalledTimes(1);
    expect(validation.validatePolicies).toHaveBeenCalledTimes(1);
    expect(ledgerRepo.deleteForVoucher).toHaveBeenCalledWith('c-1', 'v-1', 'tx-1');
    expect(ledgerRepo.recordForVoucher).toHaveBeenCalledWith(expect.objectContaining({ id: 'v-1' }), 'tx-1');
  });

  it('blocks replace before deleting old rows when a policy rejects', async () => {
    const ledgerRepo = {
      deleteForVoucher: jest.fn(async () => undefined),
      recordForVoucher: jest.fn(async () => undefined),
    } as any;
    const validation = makeValidationService();
    validation.validatePolicies.mockRejectedValueOnce(new Error('PERIOD_LOCKED'));
    const registry = {
      getConfig: jest.fn(async () => ({ policyErrorMode: 'FAIL_FAST' })),
      getEnabledPolicies: jest.fn(async () => [{ id: 'period-lock', name: 'period-lock', validate: jest.fn() }]),
    } as any;
    const gateway = new PostingGateway(ledgerRepo, validation as any, registry);

    await expect(
      gateway.replaceForVoucher(makeVoucher(), { userId: 'u-1', approved: true })
    ).rejects.toThrow('PERIOD_LOCKED');

    expect(ledgerRepo.deleteForVoucher).not.toHaveBeenCalled();
    expect(ledgerRepo.recordForVoucher).not.toHaveBeenCalled();
  });

  it('runs policies before deleting voucher ledger rows', async () => {
    const ledgerRepo = { deleteForVoucher: jest.fn(async () => undefined) } as any;
    const validation = makeValidationService();
    const registry = {
      getConfig: jest.fn(async () => ({ policyErrorMode: 'FAIL_FAST' })),
      getEnabledPolicies: jest.fn(async () => [{ id: 'p', name: 'p', validate: jest.fn() }]),
    } as any;
    const gateway = new PostingGateway(ledgerRepo, validation as any, registry);

    await gateway.deleteVoucherLedger(makeVoucher(), { userId: 'u-1', approved: true }, 'tx-1');

    expect(validation.validateCore).not.toHaveBeenCalled();
    expect(validation.validatePolicies).toHaveBeenCalledTimes(1);
    expect(ledgerRepo.deleteForVoucher).toHaveBeenCalledWith('c-1', 'v-1', 'tx-1');
  });

  it('marks reconciled ledger entries only through the gateway surface', async () => {
    const ledgerRepo = { markReconciled: jest.fn(async () => undefined) } as any;
    const validation = makeValidationService();
    const gateway = new PostingGateway(ledgerRepo, validation as any);

    await gateway.markLedgerEntryReconciled({
      companyId: 'c-1',
      ledgerEntryId: 'le-1',
      reconciliationId: 'rec-1',
      bankStatementLineId: 'line-1',
      userId: 'u-1',
    });

    expect(ledgerRepo.markReconciled).toHaveBeenCalledWith('c-1', 'le-1', 'rec-1', 'line-1');
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
