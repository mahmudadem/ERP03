# Posting Authority — Manual QA Script (Stages 0–7)

**For:** Mahmud (product owner) — run this when you wake up to confirm the whole posting-authority
epic works end to end.
**Branch:** `main` (worktree `D:/DEV2026/ERP03-posting-authority`).
**What this covers:** the entire "one guard at the ledger door" epic — approval centralization,
the single posting gateway, period-lock unification, and the uniform rejection contract.

> **No production data exists (pre-alpha).** Use a demo/seeded tenant. Nothing here is destructive
> beyond test documents you create.

---

## Part A — Automated checks (fastest confidence, ~2 min)

Run these first. If all green, the architecture invariants hold and you can trust the manual flows.

```bash
cd D:/DEV2026/ERP03-posting-authority/backend

# 1. Everything compiles
npx tsc --noEmit                       # expect: no output, exit 0

# 2. The posting-authority guardrails (the architecture is enforced, not just hoped for)
npx jest --testPathPatterns="(PostingAuthority|PostingGateway|RejectionContract)"
#    expect: 3 suites pass. Key assertions:
#      - "ledger recordForVoucher is only called through the PostingGateway"  ← no bypass
#      - "PostingGateway requires an explicit reason to skip the policy set"  ← no silent exemption
#      - "the guard derives approval from the caller, not a self-stamped voucher status"
#      - rejection contract maps every guard error to { guard, code, message, fieldHints }

# 3. The approval + posting suites
npx jest --testPathPatterns="(SalesPostingUseCases|PurchasePostingUseCases|ApprovalRequiredPolicy|PeriodLock)"
#    expect: all pass

# 4. (optional) the whole backend suite
npx jest                               # expect: ~139 suites pass, 0 failed
```

```bash
cd D:/DEV2026/ERP03-posting-authority/frontend
npx tsc --noEmit                       # expect: no output, exit 0
```

**One-liner proof of "no bypass":** every place that skips the policy set is greppable and labelled —

```bash
cd D:/DEV2026/ERP03-posting-authority
grep -rn "enforcePolicies: false" backend/src   # each hit has an exemptionReason next to it
grep -rn "\.recordForVoucher(" backend/src/application backend/src/api  # ONLY PostingGateway.ts
```

---

## Part B — Manual UI/flow checks

Start the app the usual way (backend + frontend dev servers) and sign in to a seeded tenant as an
admin.

### B1. Stage 2c — the per-module approval toggle is GONE from module settings
1. Go to **Sales → Settings**. 
   - ✅ There is **no** "Require Approval Before Posting" toggle anymore.
2. Go to **Purchases → Settings**.
   - ✅ Same — the toggle is gone.
3. Go to **Settings → Accounting → Policies** (the central policy config).
   - ✅ Approval is controlled **here** now (a single place), not per module.

### B2. Stages 2b + 4 — approval is enforced at the gateway (reactive parking)
*Precondition:* in **Settings → Accounting → Policies**, enable **Require approval before posting**
(and make sure the voucher type you'll test is not in the exempt list).
1. Create a **Sales Invoice** and try to **Post** it.
   - ✅ It does **not** hit the ledger. It is **parked as `PENDING_APPROVAL`** (no financial effect:
     no ledger entries, no stock movement).
2. Open the parked invoice and click **Approve**.
   - ✅ It now **posts** — ledger entries appear, status becomes `POSTED`.
3. Repeat 1–2 for a **Purchase Invoice**.
   - ✅ Same behaviour: park on post, post on approve.
4. Now **disable** "Require approval before posting" and post a fresh invoice.
   - ✅ It posts straight through (no parking).

> What you're verifying: the approval decision lives in ONE place (accounting policy), and an
> unapproved post is rejected *before* any ledger write, then transactionally parked.

### B3. Stage 3 — period lock behaves identically everywhere
*Precondition:* lock a past accounting period (Accounting → period management).
1. Try to post a **manual Journal Voucher** dated inside the locked period.
   - ✅ Rejected with a period-lock error.
2. Try to post a **Sales Invoice** dated inside the locked period.
   - ✅ Rejected the **same way** (same error code/behaviour).
3. Try a **Purchase Invoice** dated inside the locked period.
   - ✅ Rejected the same way.
4. If your build exposes the **override reason** field: post a Sales Invoice into the locked period
   **with an override reason**, with `allowPeriodLockOverride` enabled in accounting config.
   - ✅ Accepted (the override is a `{ reason, overriddenBy }` payload, accepted by the accounting
     guard — not a separate "ticket").

### B4. Stage 5 — every refusal says WHICH guard refused and WHY
Use the browser dev-tools **Network** tab (or the error toast/dialog) to inspect the API response
body when a post is rejected.
1. Trigger a **period-lock** rejection (B3 step 2).
   - ✅ Response `error` contains `guard: "accounting"` and `code: "PERIOD_LOCKED"`.
2. Trigger an **approval-required** rejection (B2 step 1, before approving).
   - ✅ Response contains `guard: "accounting"` and `code: "APPROVAL_REQUIRED"`.
3. Trigger a **credit-limit** rejection: set a customer credit limit, `creditHoldPolicy = BLOCK`,
   then confirm a Sales Order that exceeds it **without** an override.
   - ✅ HTTP **422**, response contains `guard: "sales"` and `code: "CREDIT_LIMIT_EXCEEDED"` plus the
     numeric details (limit / exposure / order amount).

### B5. Regression sweep — the system-generated postings still work
These are the paths intentionally left policy-exempt (Stage 4b will tighten them); confirm they still
post cleanly:
1. **Pay a Sales Invoice** (record a receipt) → ✅ receipt voucher posts; payment recorded.
2. **Pay a Purchase Invoice** (record a payment) → ✅ payment voucher posts.
3. **Year-end close** a fiscal year (if exposed in your build) → ✅ closing voucher posts; year closes.
4. A normal **manual Journal Voucher** in an open period → ✅ posts normally.

---

## Part C — What "pass" means

| Area | Pass criteria |
|---|---|
| Compile | backend + frontend `tsc` clean |
| Architecture guardrails | `PostingAuthority` / `PostingGateway` / `RejectionContract` suites green |
| Approval | parks unapproved, posts on approve, single config location |
| Period lock | identical rejection across manual / sales / purchases; override accepted when allowed |
| Rejection contract | every refusal carries `guard` + `code` |
| Regression | settlements / closings / manual JV still post |

If anything in Part B misbehaves, capture the API response body (it now includes `guard` + `code`) and
the document/voucher type — that's enough to pinpoint which guard and which policy.

---

## Known limitation (by design, not a bug)

Settlement receipts/payments, payment-sync, bank-rec adjustments, and year-end closing/reversal
vouchers currently **skip the policy set** (they still pass the gateway door + the iron-law balance
checks). Each is explicitly flagged in code with an `exemptionReason`. Folding them into the full
policy set is **Stage 4b** — a separate, behavioural follow-up that should get an `erp-reviewer` pass
first. So: if you post a back-dated *settlement* into a locked period and it is NOT rejected, that is
the known exemption, not a regression.
