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
  // registry (true since ac963d32). Locks the regression.
  it('the subledger posting guard consults the accounting policy registry', () => {
    const file = path.resolve(SRC, 'application/accounting/services/SubledgerVoucherPostingService.ts');
    const content = fs.readFileSync(file, 'utf8');
    expect(content).toMatch(/policyRegistry/);
    expect(content).toMatch(/validatePolicies|validatePostingPolicies/);
  });

  // Stage 1 — Law 7 (DONE): the subledger guard derives approval from the source document's real
  // state (the `approved` input), not from a status the posting path stamps on the voucher itself.
  // Behavioural proof: application/accounting/services/__tests__/SubledgerVoucherPostingServicePolicy.test.ts
  it('the subledger guard derives approval from the caller, not a self-stamped voucher status', () => {
    const file = path.resolve(SRC, 'application/accounting/services/SubledgerVoucherPostingService.ts');
    const content = fs.readFileSync(file, 'utf8');
    expect(content).toMatch(/approved\?: boolean/);   // input carries the real approval state
    expect(content).toMatch(/isApproved: approved/);  // policy context derived from it, not forged
  });

  // ── Remaining fix-plan targets (convert each to a real assertion as the stage lands) ─────────

  // Stage 2 — Law/policy scope: the approval decision lives in accounting policy config (with
  // per-type scope/exemptions), NOT as per-module `requireApprovalBeforePosting` settings flags.
  it.todo('Stage 2: approval decision is owned by accounting policy config, not per-module flags');

  // Stage 3: a single period-lock implementation is the authority (no PeriodLockService vs
  // PeriodLockPolicy divergence).
  it.todo('Stage 3: period lock has one authoritative implementation');

  // Stage 4 — Law 1/7: recordForVoucher is reachable only through the posting guard (no bypass).
  it.todo('Stage 4: ledger recordForVoucher is only reached through the posting guard');
});
