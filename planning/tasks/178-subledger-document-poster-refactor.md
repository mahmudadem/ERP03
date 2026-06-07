# 178 — `SubledgerDocumentPoster` refactor (consolidate the duplicated middle layer of SI / PI / SR / PR posting)

**Status:** Stages A ✅ + B ✅ + C ✅ + D1 ✅ done (2026-06-07, branch `feat/subledger-document-poster`) · Stage D2 (PR) + E open
**Owner:** Claude (Opus 4.7)

**Stage D split into D1 (SR ✅) + D2 (PR, pending):**
- **D1 ✅ Sales Return migrated (2026-06-07):** all three SR vouchers — COGS reversal (inventory debit / COGS credit), revenue reversal (revenue + tax debit, AR + restocking-fee credit), and the refund voucher (AR debit / settlement credit) — now post through `SubledgerDocumentPoster`. Added a `settlement` member to `AccountRole` for the refund's cash/bank credit. Behaviour preserved — **250 sales tests + 607 in the full posting sweep pass, 0 failures**.
- **D2 ⏳ Purchase Return — deliberately split out.** PR is the riskiest of the four: each voucher line carries a per-line `effectiveRate` (the poster currently has no FX passthrough on `SubledgerVoucherLine`), it has three distinct posting branches (AFTER_INVOICE / BEFORE_INVOICE / DIRECT), and a running-balance loop that appends a balancing AP line. Migrating it faithfully needs the poster extended to carry per-line `effectiveRate`/currency and careful handling of the balance loop — worth its own focused pass rather than an end-of-session rush. Until D2 lands, PR keeps its direct `postInTransaction` calls (still correct, just not yet consolidated).

**Stage C ✅ (SI migrated, 2026-06-07):** both Sales Invoice vouchers — the revenue voucher (AR debit + discount/revenue/charge/tax) and the COGS voucher (COGS debit / inventory credit) — now post through `SubledgerDocumentPoster`. SI's upstream bucket accumulation (`revenueCredits`/`taxCredits`/`discountDebits` Maps + `addToBucket`) is **kept as-is**; only the final voucher-line assembly + `postInTransaction` calls were swapped for `SubledgerPostingEntry[]` + `poster.post()`. Behaviour preserved — **237 sales tests + 607 in the full posting sweep pass, 0 failures**. (Folding SI's inline buckets into `poster.accumulateByAccount` + removing the local `VoucherAccumulatedLine`/`addToBucket` is left for Stage E so this stage stays a behaviour-preserving swap.)

**Design note from Stage B:** the poster's `assembleLines` does **not** force accumulation — it preserves caller granularity (PI keeps one debit line per source line for drill-down). Accumulation is an opt-in `SubledgerDocumentPoster.accumulateByAccount(entries)` helper for callers that want one line per account (SI revenue/tax/discount buckets, returns).

**Stage B ✅ (PI migrated, 2026-06-07):** `CreateAndPostPurchaseInvoiceUseCase` now builds a `SubledgerPostingEntry[]` plan (per-line inventory/expense debit + tax debit, then AP credit) and posts via `new SubledgerDocumentPoster(this.accountingPostingService).post(...)`. Removed the local duplicate `VoucherAccumulatedLine` interface. Behaviour preserved — **69 purchases tests + 601 in the accounting/sales/purchases sweep pass, 0 failures**. Missing debit/AP accounts now raise a uniform `AccountMappingError` (was a generic "accountId is required").
**Origin:** Mahmud observation, 2026-06-06 — "we are repeating ourselves." During a single QA session, four near-identical bugs were patched in four parallel posting paths.
**Scope:** Backend only. No API contract change, no frontend code change.
**Effort:** ~1–2 days (high-churn refactor; all posting tests re-validate behaviour).
**Predecessors:** Posting-Authority Stages 0–7 ([155–161](./done/)) — gateway, rejection contract, period-lock unification all assumed in place.
**Blocks (intentionally pre-empts):** Phase F RFQ + Phase G three-way match would otherwise add a 5th and 6th parallel copy of the duplicated logic. Land 178 first.

---

## Problem

```
   click [Post]
       │
       ▼
 ┌─────────────────────────────────────────┐
 │ 1. Use case (per module)                │  ◄─ duplicated 4×
 └──────────────────┬──────────────────────┘
                    │
                    ▼
 ┌─────────────────────────────────────────┐
 │ 2. Resolve accounts per line role       │  ◄── DUPLICATED ❌
 │    revenue / COGS / inventory / tax /   │     (one copy in
 │    AR or AP / discount / GRNI           │      each use case)
 │    ❗ Missing tax account →              │
 │       AccountMappingError               │
 └──────────────────┬──────────────────────┘
                    │
                    ▼
 ┌─────────────────────────────────────────┐
 │ 3. Build voucher lines                  │  ◄── DUPLICATED ❌
 │    Debit Net / Tax  •  Credit Net+Tax   │
 └──────────────────┬──────────────────────┘
                    │
                    ▼
 ┌─────────────────────────────────────────┐
 │ 4. PostingGateway.post(...)             │  ◄── SHARED ✓
 │    (Stage 4 — the one door)             │
 └──────────────────┬──────────────────────┘
                    │
       ┌────────────┼────────────┐
       ▼            ▼            ▼
  Approval     Period Lock   Other policies   SHARED ✓
       │            │            │
       └────────────┼────────────┘
                    ▼
 ┌─────────────────────────────────────────┐
 │ 5. SubledgerVoucherPostingService       │  ◄── SHARED ✓
 │    balance check + persist voucher      │
 └──────────────────┬──────────────────────┘
                    │
                    ▼
 ┌─────────────────────────────────────────┐
 │ 6. Ledger entries + stock movements     │  ◄── SHARED ✓
 │    Document status → POSTED             │
 └──────────────────┬──────────────────────┘
                    │
                    ▼
 ┌─────────────────────────────────────────┐
 │ 7. RecordChangeService.recordPost(...)  │  ◄── SHARED writer,
 │    (audit row, empty changes[] today —  │      but called from
 │     Task 169 Finding A)                 │      each use case ❌
 └─────────────────────────────────────────┘
```

The architecture has correct shared infrastructure at the bottom (gateway, strategies, balance check) and at the top (entities, repositories). The **middle layer** — walking a posted document into a balanced voucher with audit — is duplicated four times:

- `backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts`
- `backend/src/application/purchases/use-cases/PurchaseInvoiceUseCases.ts`
- `backend/src/application/sales/use-cases/SalesReturnUseCases.ts`
- `backend/src/application/purchases/use-cases/PurchaseReturnUseCases.ts`

Each one re-implements:
- `accountCache` + `resolveAccountCached` helper (literally the same shape).
- Per-line account resolution loop for revenue / COGS / inventory / tax / AR–AP / discount / GRNI.
- "Missing account" decision: throw `AccountMappingError` vs silently skip. The four copies diverged silently for months — single-session QA found four versions of the same bug:
  - **PI line:** silent skip → INFRA_999 unbalanced voucher (fixed 2026-06-06).
  - **SI line:** correctly threw, but message showed the tax-code UUID (fixed 2026-06-06).
  - **SI charge:** silent skip (fixed 2026-06-06).
  - **SR line:** pushed `accountId: ''` into the bucket (fixed 2026-06-06).
  - **PR line:** raw `Error("Tax code <UUID> has no purchase tax account")` → INFRA_999 (fixed 2026-06-06).
- Voucher-line construction (debit Net + debit Tax + credit gross with the right `metadata.sourceModule`/`sourceType`).
- `RecordChangeService.recordPost(...)` invocation. (Audit `changes[]` is empty today — Task 169 Finding A is a parallel four-copy fix waiting to happen.)

Result: every future cross-cutting fix is N parallel patches and grows with each new posting path.

---

## Target architecture

```
  PostSalesInvoiceUseCase / PI / SR / PR
       │
       ▼
  ┌─────────────────────────────────────┐
  │  SubledgerDocumentPoster            │  ◄── new, one copy
  │  ────────────────────────           │
  │  Owns:                              │
  │   • Account-id resolution per role  │
  │   • AccountMappingError on missing  │
  │   • Voucher-line construction       │
  │     (debit Net + Tax, credit gross) │
  │   • Audit hand-off (recordCreate/   │
  │     recordPost with real changes[]) │
  │   • Hand-off to PostingGateway      │
  └────────────────┬────────────────────┘
                   │
                   ▼
        existing PostingGateway, policies,
        SubledgerVoucherPostingService,
        ledger + stock writers
```

Per-use-case code shrinks to:

```ts
class PostSalesInvoiceUseCase {
  async execute(input) {
    const si = await this.repo.get(input.id);
    await this.subledgerDocumentPoster.post({
      document:       si,
      voucherType:    VoucherType.SALES_INVOICE,
      accountRoles:   ['revenue', 'tax', 'AR', 'COGS', 'inventory'],
      taxSide:        'sales',          // ← which TaxCode field
      approvalContext: input.approvalContext,
      periodLockOverride: input.periodLockOverride,
      audit: { actor: input.actor },
    });
    return this.repo.markPosted(si.id);
  }
}
```

The poster knows nothing about Sales vs Purchases; the use case declares its role set and tax side.

---

## Contract for `SubledgerDocumentPoster.post(...)`

```ts
interface SubledgerDocumentPostInput<TDoc> {
  document:           TDoc;                       // any posted entity
  voucherType:        VoucherType;
  accountRoles:       AccountRole[];              // which roles to resolve
  taxSide:            'sales' | 'purchases';      // which TaxCode field to read
  approvalContext?:   ApprovalContext;
  periodLockOverride?: PeriodLockOverride;
  audit:              { actor: Actor; before?: TDoc };
}

interface SubledgerDocumentPostResult {
  voucherId:    string;
  status:       'POSTED' | 'PENDING_APPROVAL';
}
```

`TDoc` must satisfy a small `IPostableDocument` interface (id, companyId, lines[], grandTotalBase, …). SI/PI/SR/PR all already match.

---

## Migration plan

One PR, but staged carefully:

1. ✅ **Land 178a — the new service** with full unit tests, **but unused**. DONE 2026-06-07: [`SubledgerDocumentPoster.ts`](../../backend/src/application/accounting/services/SubledgerDocumentPoster.ts) — declares the canonical `SubledgerVoucherLine` (replacing the 3 duplicate `VoucherAccumulatedLine` interfaces), takes a declarative `SubledgerPostingPlan` of `{ role, accountId?, side, amounts }` entries, and: drops zero-amount entries, throws a uniform `AccountMappingError` for any non-zero entry whose role account is missing (the 4× bug, now one place), accumulates by (account, side), asserts balance (base + doc), and hands off to an injected `ISubledgerPostingService`. 11 unit tests green ([`SubledgerDocumentPoster.test.ts`](../../backend/src/tests/application/accounting/SubledgerDocumentPoster.test.ts)). Wired to nothing — zero risk. **Deferred to migration stages:** audit hand-off (folded in per-document at B–D) and the code→id account *resolution* (stays in callers — they own the repos; the poster only validates resolved-or-undefined ids).
2. **Land 178b — migrate PI** (smallest of the four). Verify all PI posting tests still pass; verify the `INFRA_999` path for missing tax account now surfaces as `ACCOUNT_MAPPING_MISSING`.
3. **Land 178c — migrate SI** (largest; charges + lines + line-discount + invoice-discount paths).
4. **Land 178d** — split: **D1 ✅ SR** (done), **D2 ⏳ PR** (needs poster `effectiveRate` passthrough + handling of its 3 branches and balance loop; deferred).
5. **Land 178e — delete the now-dead helpers in each use case** (`accountCache`, the resolve loops, the voucher-line builders).
6. **Architecture test** asserting no use case outside `SubledgerDocumentPoster` calls `RecordChangeService.recordPost` or constructs voucher lines directly.

Each stage ships green CI independently. Rollback is `git revert` of one stage.

---

## Definition of done

- `backend/src/application/accounting/services/SubledgerDocumentPoster.ts` exists with full unit-test coverage.
- All four use cases (SI, PI, SR, PR) delegate posting to the new service.
- All existing posting tests pass — backend suite `npx jest` green.
- Architecture test refuses direct `recordPost` calls outside the poster.
- `docs/architecture/posting-authority.md` updated with the new layer in the diagram.
- Done report `planning/done/178-subledger-document-poster-refactor.md`.

## Wins this unlocks

- **Task 169 Finding A** (audit empty `changes[]`) becomes a one-line fix in the poster, not four.
- **Task 170 Finding E** (Line Total semantics on the rest of the voucher pages) doesn't grow new bug surface in the backend.
- **Phase F RFQ** and **Phase G three-way match** add new posting paths as ~10-line wrappers, not 400-line use-case copies.
- Every new "what does posting do here?" question has exactly one file to read.

## Out of scope

- Frontend changes. No payload, response, or error shape changes — `RejectionContract` and `AccountMappingError` already standardize that surface.
- Sales Order / Quotation / Delivery Note posting paths (those don't directly hit the ledger today).
- The settlement / payment voucher path (`PaymentVoucherStrategy`) — separate posting strategy, different shape.
- Audit `changes[]` projection (Task 169 Finding A) — surfaces from this refactor as one fix in one place, but track separately so the refactor stays purely structural.
