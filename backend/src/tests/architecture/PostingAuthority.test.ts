import * as fs from 'fs';
import * as path from 'path';

/**
 * Executable guardrails for the Posting Authority architecture.
 * Spec: docs/architecture/posting-authority.md
 * Fix plan: planning/briefs/20260603-posting-authority-fix-plan.md
 *
 * The active `it(...)` tests lock in invariants that are ALREADY correct — keep them green.
 * The `it.todo(...)` entries are the remaining fix-plan targets; the next agent converts each
 * into a real assertion as the corresponding stage lands.
 */

const SRC = path.resolve(__dirname, '../..');

const collectTsFiles = (dir: string): string[] => {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectTsFiles(full));
    else if (entry.isFile() && full.endsWith('.ts')) out.push(full);
  }
  return out;
};

describe('Architecture guard: posting authority', () => {
  // Law 2 / ownership test: credit limit is a Sales concern. The accounting layer must remain
  // entirely ignorant of it. This protects the separation that is currently correct.
  it('the accounting layer contains no knowledge of credit limits', () => {
    const dirs = [
      path.resolve(SRC, 'application/accounting'),
      path.resolve(SRC, 'domain/accounting'),
    ];
    const offenders: string[] = [];
    for (const file of dirs.flatMap(collectTsFiles)) {
      if (/creditLimit|creditHold/i.test(fs.readFileSync(file, 'utf8'))) {
        offenders.push(path.relative(SRC, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  // Law 1: source-module postings must go through the shared guard, which consults the policy
  // registry (true since ac963d32). Since Stage 4 the subledger routes the policy set + ledger
  // write through the PostingGateway with enforcement ON. Locks the regression.
  it('the subledger posting guard runs the policy set through the gateway', () => {
    const file = path.resolve(SRC, 'application/accounting/services/SubledgerVoucherPostingService.ts');
    const content = fs.readFileSync(file, 'utf8');
    expect(content).toMatch(/policyRegistry/);
    expect(content).toMatch(/new PostingGateway/);
    expect(content).toMatch(/enforcePolicies: true/);
  });

  // Stage 1 — Law 7 (DONE): the guard derives approval from the source document's real state, not
  // from a status the posting path stamps on the voucher itself. The subledger input still carries
  // the real `approved` flag; the derivation now lives in the PostingGateway (Stage 4), which all
  // posting paths funnel through.
  // Behavioural proof: application/accounting/services/__tests__/SubledgerVoucherPostingServicePolicy.test.ts
  //                    application/accounting/services/__tests__/PostingGateway.test.ts
  it('the guard derives approval from the caller, not a self-stamped voucher status', () => {
    const subledger = fs.readFileSync(
      path.resolve(SRC, 'application/accounting/services/SubledgerVoucherPostingService.ts'),
      'utf8'
    );
    expect(subledger).toMatch(/approved\?: boolean/);     // input carries the real approval state
    expect(subledger).toMatch(/approved: input\.approved !== false/); // passed honestly to the gateway

    const gateway = fs.readFileSync(
      path.resolve(SRC, 'application/accounting/services/PostingGateway.ts'),
      'utf8'
    );
    expect(gateway).toMatch(/isApproved: approved/);      // policy context derived from it, not forged
  });

  // ── Remaining fix-plan targets (convert each to a real assertion as the stage lands) ─────────

  // Stage 2 — Law/policy scope: the approval decision lives in accounting policy config (with
  // per-type scope/exemptions), NOT as per-module `requireApprovalBeforePosting` settings flags.
  it('Stage 2: approval decision is owned by accounting policy config, not per-module flags', () => {
    const salesInvoiceUseCasesFile = path.resolve(SRC, 'application/sales/use-cases/SalesInvoiceUseCases.ts');
    const purchaseInvoiceUseCasesFile = path.resolve(SRC, 'application/purchases/use-cases/PurchaseInvoiceUseCases.ts');

    const salesContent = fs.readFileSync(salesInvoiceUseCasesFile, 'utf8');
    const purchaseContent = fs.readFileSync(purchaseInvoiceUseCasesFile, 'utf8');

    expect(salesContent).not.toContain('AccountingPolicyRegistry');
    expect(purchaseContent).not.toContain('AccountingPolicyRegistry');

    expect(salesContent).not.toMatch(/settings\.requireApprovalBeforePosting/);
    expect(purchaseContent).not.toMatch(/settings\.requireApprovalBeforePosting/);
  });

  // Stage 3: a single period-lock implementation is the authority (no PeriodLockService vs
  // PeriodLockPolicy divergence).
  it('Stage 3: period lock has one authoritative implementation', () => {
    const file = path.resolve(SRC, 'application/accounting/services/PeriodLockService.ts');
    const content = fs.readFileSync(file, 'utf8');

    // Must import and use PeriodLockPolicy
    expect(content).toContain('PeriodLockPolicy');
    expect(content).toContain('new PeriodLockPolicy');

    // Must NOT have local implementation logic (delegated to policy)
    expect(content).not.toContain('fy.getPeriodForDate');
    expect(content).not.toContain('PeriodStatus.CLOSED');
    expect(content).not.toContain('PeriodStatus.LOCKED');
  });

  // Stage 4 — Law 1/7: recordForVoucher is reachable only through the PostingGateway (no bypass).
  // The gateway is the single, mandatory choke point in front of every ledger write; any other
  // caller would be able to skip the rulebook, so we forbid it at the source level.
  it('Stage 4: ledger recordForVoucher is only called through the PostingGateway', () => {
    // The method may be DECLARED on the ledger repository implementations and CALLED by the
    // gateway. It must not be CALLED anywhere else in production code.
    const allowedCallers = [
      path.resolve(SRC, 'application/accounting/services/PostingGateway.ts'),
    ];
    // Where the method is legitimately declared/implemented (declarations are `recordForVoucher(`
    // without a leading dot, so they don't match a call pattern — listed here for clarity only).
    const offenders: string[] = [];
    for (const file of collectTsFiles(SRC)) {
      // Skip tests (they mock the repo) and the sanctioned caller.
      if (/[\\/]tests[\\/]/.test(file) || /\.test\.ts$/.test(file)) continue;
      if (allowedCallers.includes(file)) continue;
      const content = fs.readFileSync(file, 'utf8');
      // A CALL looks like `.recordForVoucher(` (invoked on a repo instance). Declarations on the
      // repo implementations look like `recordForVoucher(` / `async recordForVoucher(` (no dot).
      if (/\.recordForVoucher\s*\(/.test(content)) {
        offenders.push(path.relative(SRC, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  // Stage 4 — the gateway never lets a policy-skip happen silently: an exemption requires a reason.
  it('Stage 4: PostingGateway requires an explicit reason to skip the policy set', () => {
    const file = path.resolve(SRC, 'application/accounting/services/PostingGateway.ts');
    const content = fs.readFileSync(file, 'utf8');
    expect(content).toMatch(/enforcePolicies === false/);
    expect(content).toMatch(/exemptionReason/);
  });
});
