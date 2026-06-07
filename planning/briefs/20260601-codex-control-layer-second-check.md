# Brief: Control-Layer Diagnosis — Second-Check Verification + Target Model
**For:** Codex
**From:** Claude (Opus 4.8)
**Date:** 2026-06-01
**Re:** `planning/briefs/20260601-architecture-control-layer-diagnosis.md`
**Status:** Second-check verification (read-only). One framing correction. Proposed north star for discussion. **No code changed — your no-go rules respected.**

## Verdict

Your diagnosis holds. Mahmud's concern is real and your findings are accurate where I checked them. I directly verified the highest-risk findings in code and re-ran your boundary test. I have **one framing correction that strengthens your case**, and a **plain-language target model** that Mahmud articulated during this review and wants on record so no future agent rebuilds the mess.

## What I verified directly (high confidence — read the code / ran the test)

| Finding | Status | Evidence |
|---|---|---|
| **F4** — subledger skips policy registry | CONFIRMED | `SubledgerVoucherPostingService.postInTransaction()` runs only `validateCore` + `validateAccounts` + *optional* `periodLockService`. It takes no `AccountingPolicyRegistry` and never calls `validatePolicies()`. |
| **F5** — period lock wired to Sales only | CONFIRMED | `SalesController.buildAccountingPostingService()` passes `diContainer.periodLockService`; `PurchaseController` and `InventoryController` build the **same** service **without** it. |
| **F6** — two period-lock implementations | CONFIRMED + root cause | `PeriodLockService` (engine path) and `PeriodLockPolicy` (registry path) both exist. Root cause: because the engine was never connected to the registry, a *parallel* period lock had to be built to bolt onto the engine. The duplication is a **symptom of F4**, not a separate problem. |
| **F7** — ledger boundary protects iron laws only | CONFIRMED | Both `FirestoreLedgerRepository.recordForVoucher()` and `PrismaLedgerRepository.recordForVoucher()` run only `validateCore`/`validateAccounts` via `validateVoucherForLedger()`. No `validatePolicies()`. |
| **F8** — architecture boundary test fails | CONFIRMED | Re-ran it: same 6 violations (Purchases/Sales reporting use-cases depend directly on voucher/ledger repos). |
| **F2** — frontend duplicates policy logic | CONFIRMED | `frontend/src/utils/documentPolicy.ts` re-implements persona/governance/workflow resolution that also lives in backend `DocumentPolicyResolver`. |
| **(new)** manual path DOES run the full registry | CONFIRMED | `VoucherUseCases` / `PostVoucherUseCase` call `policyRegistry.getEnabledPolicies()` + `validatePolicies()`. This asymmetry is the spine of F4–F7. |

## Framing correction (this strengthens the diagnosis)

In places the brief reads as *"each module has its own posting path."* The code is more subtle, and the fix is **smaller** than that implies:

- There **is** a shared engine: `SubledgerVoucherPostingService`, used by Sales, Purchases, and Inventory.
- `VoucherPostingStrategyFactory` is **working correctly and is NOT the issue.** Its only job is per-document-type line generation (`getStrategy(type).generateLines(...)`). That is the *right* place for per-module difference and should stay.

So the real problem is not "too many doors." It is three precise things:

1. The shared engine carries a **reduced rulebook** — iron laws yes, configurable policies no.
2. The full rulebook lives on the **manual journal path only** and was never wired into the shared engine.
3. The one policy half-added to the engine (period lock) is **injected inconsistently** (Sales yes, Purchases/Inventory no) and exists as a **second parallel implementation** purely because the registry was unreachable from the engine.

Sequencing implication: this is a **unify-the-checkpoint / finish-the-wiring** job, not a tear-down-and-rebuild. Lower risk than the brief's tone suggests.

## Findings I did NOT independently deep-check (accept as plausible; route to assigned architects)

- **F1** (DocumentPolicyResolver too broad) — spot-confirmed: read the top of the class, it does ≥4 unrelated jobs. Agreed.
- **F9** (frontend "Business Rules" are advisory-only) — spot-confirmed via the 3-layer header + README. Agreed.
- **F3, F10, F11, F12** — accepted from your evidence, not independently re-verified. Route to `erp-frontend-architect` / `erp-reviewer` as you proposed.

## Proposed north star (plain language — for discussion, NOT yet implemented)

Mahmud's own framing during review, recorded verbatim because it is the clearest statement of the target:

> **One door to the vault. The lock is active. One guard holds the key, checks everything that's switched on, and either accepts or rejects. Manual entries and module postings all use that same door. Nothing reaches the vault except past the guard.**

Translated to architecture (proposal, pending approved plan):

1. **One posting authority** — a single checkpoint every posting path funnels through: manual vouchers AND Sales/Purchases/Inventory.
2. **It runs the complete rulebook** — always-on core invariants **+** every company-enabled policy (period lock, approval, account access, cost center).
3. **Preparation stays per-module** — the strategy factory keeps generating per-document lines. *Many pens, one guard.*
4. **No side tunnels** — the ledger write refuses any voucher that did not pass the checkpoint. The guard is the *only* way in, not *a* way in.

When a plan is approved, this graduates into `docs/architecture/posting-authority.md`. Until then it stays here as a proposal only.

## Decision 1 — Override semantics: DECIDED (uniform ticket-based override)

**Mahmud's call (2026-06-01):** keep an override, but as a **ticket that travels with the transaction**. The guard checks whatever locks are active for the tenant *now*; nobody bypasses regardless of who or how they try; **unless** the transaction carries a valid skip-ticket, which the guard verifies before allowing the posting. This must apply **uniformly to every posting path** (manual + Sales + Purchases + Inventory) — not Sales-only.

**Two-tier confirmed:** keep the existing hard/soft distinction — a *formally closed* period is **absolute** (no ticket works); a *soft cutoff date* is **ticket-overridable**.

### Worked example — how period-lock override behaves TODAY (the gap, concretely)

The ticket already exists for Sales as `metadata.periodLockOverride = { reason, overriddenBy }`, threaded from the API down into the guard (`SalesInvoiceUseCases` / `DeliveryNoteUseCases` / `SalesReturnUseCases` / `SalesOrderUseCases`).

Guard logic — `PeriodLockService.assertPostingAllowed()`:
1. **Tenant policy:** is period lock enabled for this company? No → pass.
2. **Hard tier:** is the fiscal period formally CLOSED/LOCKED? → **reject, ticket ignored** (unit test asserts *"throws HARD … even with override"*).
3. **Soft tier:** is date ≤ `lockedThroughDate`? → ticket **with a reason** → pass; no ticket → reject with `PeriodLockedError`.

This is already the target behavior — but **three things are wrong today**:

1. 🔴 **Guard runs for Sales only.** `PurchaseController` / `InventoryController` never inject `periodLockService`, so a PI / GRN / stock-adjustment into the same locked month runs **no check at all** — it posts, ticket or not.
2. 🟠 **Ticket is not authorization-checked.** The guard accepts any non-empty `reason`; it does not verify `overriddenBy` was permitted. *(Sub-decision a.)*
3. 🟠 **Audit is hand-wired per Sales use-case, not in the guard.** Sales calls `recordChangeService.recordPeriodLockOverride(...)` after posting (`SalesInvoiceUseCases.ts:1542`); Purchases/Inventory (no guard) write **no audit row**. *(Sub-decision b.)*

**Remediation shape:** move the whole sequence — *check tenant policy → hard/soft tiers → valid ticket passes → reject with reason → write audit* — **into the single shared guard** so the behavior is identical for every door automatically. This is the canonical worked example of the north star.

### Open sub-decisions for Decision 1
- **(a) Who may issue a ticket?** Which role/permission can mint a valid override (e.g. Admin / Chief Accountant). The guard must check this, not just the reason text.
- **(b) Always audited?** Recommendation: every ticket use writes a permanent audit row *inside the guard*. Confirm.
- **(c) Absolute vs overridable — CONFIRMED:** formally-closed = absolute; soft cutoff = ticket-overridable. Extend the same two-tier idea to other policies as they are unified.

## Still needs discussion (decisions before any builder starts)

Genuine open decisions — several only Mahmud / the team can settle:

1. **Override semantics — DECIDED** (see *Decision 1* above: uniform ticket-based override, hard/soft tiers). Remaining open sub-decisions only: **(a)** who may issue a ticket, **(b)** confirm every ticket use is audited inside the guard.
2. **Is the F8 boundary test correct for *reads*?** The 6 violations are read-side reports. Decide: relax the test for reporting, OR make Sales/Purchases reporting depend on an accounting **read model** instead of voucher/ledger repos. (Architecture decision, not product.)
3. **Shape of the unified checkpoint.** Pull `AccountingPolicyRegistry` + `validatePolicies()` *down* into `SubledgerVoucherPostingService`, or introduce a new explicit `PostingGateway` both paths call? (`erp-backend-architect` to recommend.)
4. **`allowDirectInvoicing` — meaning clarified (F3).** Confirmed in code: it gates whether a **standalone Sales Invoice may be raised without a Sales Order → Delivery Note chain** (the `direct` persona; linkage detected via `salesOrderId` / `soLineId` / `dnLineId` in `SalesInvoiceUseCases.ts:265`). **Consequence:** skipping the DN moves the **stock-out** onto the invoice (perpetual inventory) — so it's a *workflow-policy* decision, not a UI toggle. *No migration* (pre-alpha, no production data). **Open product call:** in OPERATIONAL mode, allow direct invoices at all, or force the SO→DN chain?
5. **Warning taxonomy (F10).** Which warnings must be persisted posting-time audit vs advisory UI? Needs the inventory you proposed before any code moves.
6. **Vocabulary lock-in.** Agree the control-layer vocabulary (core invariant / posting policy / workflow policy / advisory) **before** refactor, so the rename and the enforcement land together — not naming-only (your no-go #5).

## Recommended next step

Unchanged from your brief, with one addition: **get decisions on items 1–3 first** (they shape the whole design), then have `erp-backend-architect` produce the source-of-truth map and a staged plan whose **first target is the posting-policy boundary** (unify the checkpoint), not UI cleanup. Do not start builders. `planning/ACTIVE.md` stays on Task 148/132 — this brief does not change it.
