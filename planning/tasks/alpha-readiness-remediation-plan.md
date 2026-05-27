# Alpha-Readiness Remediation Plan

**Created:** 2026-05-19
**Source audit:** Second-pass audit of Sales/Purchases vs confirmed architecture (Task #1)
**Status:** Plan only — no code changes until user approval per chunk
**Goal:** Close all 12 P0 findings before first launch for trading-company customers
**Note:** No production/customer data exists yet — all changes are forward-only, no migrations/backfills needed.

---

## Confirmed architecture (the bar we're hitting)

1. Accounting **Engine** mandatory; Accounting **UI** optional. Sales/Purchases must always use the Engine.
2. Multi-currency is an Accounting capability — Sales/Purchases must not duplicate FX logic.
3. Workflow mode (SIMPLE/OPERATIONAL) is a default; voucherType/form/persona is the source of truth.
4. COGS skip must be classified into 5 valid reasons + 1 invalid (missing account = throw).
5. No `skipAccountValidation` bypass.
6. Posting must be auditable — admin can answer "why".

---

## P0 inventory (12 items) — sequenced by dependency

```
PR1 ── Foundation: Engine init guard
        P0-1 Engine-init hard requirement on Sales/Purchases init
        P0-2 Hard-throw at post if Engine not initialized

PR2 ── Foundation: Auditability infrastructure
        P0-6 PostingLog entity + write on every voucher
        P0-7 cogsPostingStatus + skipReason on SI/PI/DN lines

PR3 ── Strict posting (depends on PR1 + PR2)
        P0-3 Remove skipAccountValidation flag (6 callers)
        P0-4 COGS branch (e) — throw on missing Revenue/COGS/Inventory/Tax account
        P0-5 Sales persona governance hard-throw (match Purchases)

PR4 ── Operational safety (independent, can run parallel)
        P0-8 Idempotency-Key header on all post/payment endpoints
        P0-9 allowNegativeStock enforcement in RecordStockMovementUseCase

PR5 ── Multi-currency completion (depends on PR2 for skip-reason logging)
        P0-10 Multi-currency requires FX gain/loss accounts configured
        P0-11 Realized FX gain/loss posting on settlement when rate differs

PR6 ── Security (independent, can run parallel)
        P0-12 Firestore production security rules (expires 2026-06-01)
```

**Total estimate:** 6 PRs over ~3 weeks of focused work. PR2 (PostingLog) and PR6 (rules) are the largest. PR4 and PR6 are parallel-safe and can start day 1.

---

## PR1 — Accounting Engine guard (with auto-init)

**Goal:** Make it structurally impossible to use Sales/Purchases without the Accounting **Engine** initialized — while leaving the Accounting **UI/App** visibility as an independent, optional concern.

**Architectural clarification (do not confuse these):**
- **Accounting Engine** = mandatory backend infrastructure: chart of accounts, voucher posting service, ledger repository, voucher types seeded, fiscal year set, base currency seeded. Must be initialized for ANY Sales/Purchases activity.
- **Accounting UI/App** = optional user-facing module: navigation entry, journal/voucher screens, reports. Can be hidden while the Engine runs in the background.

The current `companyModule.accounting.initialized` flag conceptually represents the Engine state (it's set by `InitializeAccountingUseCase` after chart-of-accounts + voucher types + fiscal year are seeded). PR1 makes this explicit in the code and separates UI visibility cleanly.

| Item | Scope |
|---|---|
| **Files** | [SalesSettingsUseCases.ts](backend/src/application/sales/use-cases/SalesSettingsUseCases.ts) (~208), [PurchaseSettingsUseCases.ts](backend/src/application/purchases/use-cases/PurchaseSettingsUseCases.ts) (~221), [SalesInvoiceUseCases.ts](backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts) (675, 1425-1428), [PurchaseInvoiceUseCases.ts](backend/src/application/purchases/use-cases/PurchaseInvoiceUseCases.ts) (457, 1044-1047), [InitializeAccountingUseCase.ts](backend/src/application/accounting/use-cases/InitializeAccountingUseCase.ts) |
| **No schema change** | `CompanyModule` already has `initialized` and `isEnabled`. For the `accounting` module specifically, document the semantics: `initialized=true` means **Engine is ready** (chart of accounts seeded, voucher types copied, fiscal year created, base currency set). `isEnabled` is the admin's on/off toggle and is irrelevant to posting — the Engine runs regardless. No code in posting paths should ever consult `isEnabled` for the accounting module. |
| **New helper use case** | `EnsureAccountingEngineInitialized(companyId)` in `backend/src/application/accounting/use-cases/`. Checks `engineInitialized`. If false: invokes `InitializeAccountingUseCase` with safe defaults (default chart-of-accounts template, current fiscal year, company base currency from `companyRepo`). Idempotent — re-running on an already-initialized company is a no-op. |
| **New error class** | `AccountingEngineUnavailableError` in `backend/src/domain/accounting/errors/`. Thrown only when the Engine cannot be initialized (e.g., company base currency not set, COA template missing, required configuration absent). NOT thrown for UI-hidden state. |
| **Change A — Init flow** | First step of `InitializeSales` and `InitializePurchases`: call `EnsureAccountingEngineInitialized(companyId)`. If it succeeds (existing or newly initialized), continue. If it throws `AccountingEngineUnavailableError`, propagate. Do NOT check `uiEnabled` at all. |
| **Change B — Post-time guard** | `PostSalesInvoiceUseCase` / `PostPurchaseInvoiceUseCase`: replace the silent-skip branch (SalesInvoiceUseCases.ts:1114-1119) with `EnsureAccountingEngineInitialized` call. Engine missing/unusable → throw `AccountingEngineUnavailableError`. Engine present → always post the voucher. UI visibility (`uiEnabled`) is irrelevant to posting — the voucher is always written. |
| **Rename `isAccountingEnabled`** | Rename the helper method to `isAccountingEngineReady` across all 10 call sites (SalesInvoice, DeliveryNote, SalesReturn, PurchaseInvoice ×2, PurchaseReturn ×2, GoodsReceipt ×2, StockAdjustment). Same logic (reads `companyModule.accounting.initialized`), clearer name. |
| **Acceptance criteria** | 1. `InitializeSales` on a fresh company auto-initializes the Engine and continues — no manual Accounting init step required. 2. `InitializeSales` throws `AccountingEngineUnavailableError` only when Engine cannot be initialized (e.g., no base currency). 3. SI post with Engine ready and `uiEnabled=false` still writes the voucher and ledger entries (UI hidden but books correct). 4. SI post with Engine missing throws — never marks POSTED silently. 5. Re-calling `EnsureAccountingEngineInitialized` on an already-initialized company is a no-op (idempotency test). |
| **Tests** | `EnsureAccountingEngineInitialized.test.ts` — new file. Cases: fresh company → initializes; already initialized → no-op; missing base currency → throws. `InitializeSalesUseCase.test.ts` — case: fresh company auto-inits Engine then completes Sales init. `PostSalesInvoiceUseCase.test.ts` — case: `uiEnabled=false, engineInitialized=true` still posts voucher (asserts voucherId not null). Same for Purchases. |
| **MD updates** | [docs/architecture/accounting.md](docs/architecture/accounting.md) — new top-level section "Accounting Engine vs Accounting UI" explaining the two are independent. Document `engineInitialized` (always required) vs `uiEnabled` (cosmetic). [docs/architecture/sales.md](docs/architecture/sales.md) / [docs/architecture/purchases.md](docs/architecture/purchases.md) — "Prerequisites" section: "Accounting Engine is auto-initialized on first Sales/Purchases init. The Accounting UI may remain hidden." |
| **Risk** | Low — guard auto-recovers via Engine init. Only fails when underlying config (base currency, COA template) is absent, which is a real misconfiguration. |

---

## PR2 — PostingLog + skip-reason fields

**Goal:** The single highest-leverage P0. Every other fix in PR3/PR5 writes structured data here. Enables GL Impact UI (P1) directly.

| Item | Scope |
|---|---|
| **New entity** | `PostingLog` in `backend/src/domain/accounting/entities/PostingLog.ts` |
| **Schema** | `{ id, companyId, sourceModule, sourceType, sourceId, voucherIds[], strategy, decisions[ { lineId, lineNo, accountResolutions: { revenue, cogs, inventory, tax, ar/ap }, each with {resolvedId, fallbackLevel, skipReason?} }], warnings[], postedAt, postedBy, idempotencyKey? }` |
| **Repository** | `IPostingLogRepository` + Firestore impl at `companies/{cid}/posting_logs/{id}`. Prisma impl mirrors. Index on `(sourceModule, sourceType, sourceId)`. |
| **Write site** | `SubledgerVoucherPostingService.postInTransaction` — accept a `PostingDecisionRecord` arg from caller, persist in same Firestore transaction as the voucher. |
| **New line fields** | Add to `SalesInvoiceLine`, `PurchaseInvoiceLine`, `DeliveryNoteLine`: `cogsPostingStatus: 'POSTED' \| 'SKIPPED_POSTED_AT_DN' \| 'SKIPPED_SERVICE_ITEM' \| 'SKIPPED_DEFERRED_POLICY' \| 'SKIPPED_UNSETTLED_COST' \| null`. Set inside `PostSalesInvoiceUseCase` / `PostDeliveryNoteUseCase` based on which branch fired. `SKIPPED_UNSETTLED_COST` requires `inventorySettings.allowDeferredCost=true` (new field, default false); otherwise posting throws. Missing account mapping is NEVER a valid skip reason — it always throws `AccountMappingError`. |
| **Settlement back-ref** | Add `settlementVoucherIds: string[]` to `SalesInvoice` and `PurchaseInvoice`. Update PaymentSyncUseCases to append. |
| **Read API** | New endpoint `GET /tenant/accounting/posting-logs?sourceId=<id>` for the future GL Impact UI. |
| **Acceptance criteria** | 1. Every POSTED SI/PI/DN/GRN/SR/PR/Payment produces exactly one PostingLog row. 2. PostingLog written inside the same Firestore transaction as the voucher (atomic). 3. Query by sourceId returns full decision tree. 4. cogsPostingStatus populated on every line of every posted SI. |
| **Tests** | `PostingLog.test.ts` — entity invariants. `PostSalesInvoiceUseCase.test.ts` — add assertions on PostingLog content for each scenario (S1-S14 from matrix). Same for PurchasesInvoice, DN, GRN, returns. |
| **MD updates** | New doc `docs/architecture/posting-log.md` — schema, write/read contracts, skip-reason taxonomy. Reference from sales.md / purchases.md / accounting.md. |
| **Risk** | Medium — touches every posting path. Mitigated by full test coverage before merge. |

---

## PR3 — Strict posting (depends on PR1 + PR2)

**Goal:** Convert silent skips and dead flags into hard errors. PostingLog (PR2) gives us a place to record the warning when it's intentional.

| Item | Scope |
|---|---|
| **P0-3 Remove skipAccountValidation** | Files: PurchaseInvoiceUseCases.ts:753, SalesReturnUseCases.ts:869,912, DeliveryNoteUseCases.ts:518, PurchaseReturnUseCases.ts:937,991, GoodsReceiptUseCases.ts:529, StockAdjustmentUseCases.ts:323. Delete `skipAccountValidation:true` from these calls. Remove the param from `SubledgerVoucherPostingService.postInTransaction` signature. Ledger validation already unconditional, so no behavior change — just deletes dead code. |
| **P0-4 COGS branch (e) throw** | SalesInvoiceUseCases.ts:943-947 — when `resolveCOGSAccountsSync` returns null AND `cogsPostingStatus` would NOT be one of the four intentional reasons (POSTED_AT_DN, SERVICE_ITEM, DEFERRED_POLICY, UNSETTLED_COST-with-allowDeferredCost=true), throw `AccountMappingError({ itemId, fallbackChain })`. Same for Revenue (line 1217), Tax (line 932). Same audit on PurchaseInvoiceUseCases.ts for Inventory account silent-empty-string (line ~849). **Missing account is never deferrable** — it's always a hard error. |
| **Deferred-cost rule** | Missing cost basis (`costBasis = 'MISSING'`) blocks posting UNLESS `inventorySettings.allowDeferredCost=true`. When allowed, posting continues with `cogsPostingStatus = SKIPPED_UNSETTLED_COST`, a warning string on PostingLog, and the StockMovement marked `costSettled=false` (already exists). A `SettleDeferredCostUseCase` is required (P1-5) to later resolve these — the P0 just opens the path. |
| **P0-5 Sales persona governance** | SalesInvoiceUseCases.ts:232 — replace silent pass with `throw new PersonaNotAllowedError(...)`. Match the explicit pattern at PurchaseInvoiceUseCases.ts:232. |
| **New errors** | `AccountMappingError`, `PersonaNotAllowedError` in `backend/src/domain/accounting/errors/` with `code`, `message`, structured `details` (itemId, fallbackChain, persona, formType). |
| **Acceptance criteria** | 1. No grep hits for `skipAccountValidation:true` anywhere. 2. SI post with item lacking Revenue/COGS/Inventory account throws actionable error with fallback chain in message. 3. SI created with disabled persona throws. 4. Existing 18+ test suites still pass; new tests added per fix. |
| **Tests** | `SalesInvoiceUseCases.test.ts` — add cases: missing Revenue, missing COGS account, disabled persona. Same for PurchaseInvoice. Verify error type and `details`. |
| **MD updates** | sales.md / purchases.md — replace "silently skips if unmapped" wording with "throws AccountMappingError". Add the new error codes to a "Posting errors" appendix. |
| **Risk** | Low — forward-only behavior tightening. |

---

## PR4 — Operational safety (parallel-safe)

| Item | Scope |
|---|---|
| **P0-8 Idempotency** | New middleware `idempotencyKeyMiddleware` at `backend/src/api/middlewares/`. Applies to: `POST /sales/invoices/:id/post`, `POST /sales/invoices/create-and-post`, `POST /sales/invoices/:id/record-payment`, `POST /sales/delivery-notes/:id/post`, `POST /sales/returns/:id/post`, and Purchases equivalents (8 endpoints total). Store at `companies/{cid}/idempotency_keys/{key}` with response snapshot, TTL 24h, body-hash check. Replay cached response on duplicate key; reject 409 on same key + different body. |
| **P0-9 allowNegativeStock** | `RecordStockMovementUseCase.processOUT` — read `inventorySettings.allowNegativeStock`. If false and `qtyAfter < 0`, throw `NegativeStockError({itemId, warehouseId, qtyBefore, requested})`. Today this setting exists but is never checked. |
| **Acceptance criteria** | 1. Two POSTs with same Idempotency-Key + same body return identical response, only one voucher created. 2. Same key + different body → 409. 3. Missing key on a POST endpoint → 400 (configurable: warn-only first week, then enforce). 4. Stock OUT below zero with setting off → throws; with setting on → allowed and movement annotated. |
| **Tests** | New `IdempotencyMiddleware.test.ts`. `RecordStockMovementUseCase.test.ts` — add negative-stock cases for both setting values. |
| **MD updates** | New section in [docs/architecture/api.md](docs/architecture/api.md) (or accounting.md) — "Idempotency Keys: required for all posting endpoints". |
| **Risk** | Low — forward-only. |

---

## PR5 — Multi-currency completion (depends on PR2)

| Item | Scope |
|---|---|
| **P0-10 Engine-config requirement** | SalesInvoiceUseCases.ts:342, PurchaseInvoiceUseCases.ts equivalent. When `currency !== companyBaseCurrency`, query `accountingSettingsRepo.get(companyId)`; if `!defaultFXGainAccountId \|\| !defaultFXLossAccountId`, throw `EngineConfigMissingError`. |
| **New settings fields** | Add `defaultFXGainAccountId`, `defaultFXLossAccountId` to `AccountingSettings` (or wherever company-level financial settings live). Add a small wizard step in the Accounting init UI to map them. |
| **P0-11 FX gain/loss on settlement** | PaymentSyncUseCases.ts:190-217. When `paymentDate.exchangeRate !== invoice.exchangeRate`, compute `diffBase = settlementAmountDoc * (paymentRate - invoiceRate)`. Post a third voucher line: Cr `defaultFXGainAccountId` if diff > 0, Dr `defaultFXLossAccountId` if diff < 0. Record decision in PostingLog (uses PR2). Same for Purchase payments. |
| **Acceptance criteria** | 1. Cannot create a multi-currency SI/PI without FX accounts configured. 2. Payment in different-rate scenario produces 3-line voucher with FX gain/loss. 3. Same-rate payment posts 2-line as before (no FX line). 4. Sum of all settlements + FX gain/loss reconciles to invoice grand total in base currency. |
| **Tests** | New `MultiCurrencySettlement.test.ts` — gain scenario, loss scenario, zero-diff scenario, mixed-currency reject when FX not configured. |
| **MD updates** | Update [docs/architecture/accounting.md](docs/architecture/accounting.md) multi-currency section to document FX-account requirement. New section in sales.md / purchases.md "Multi-currency prerequisites". |
| **Risk** | Low — forward-only; covered by tests. |

---

## PR6 — Firestore production security rules (parallel-safe, independent)

| Item | Scope |
|---|---|
| **Files** | `firestore.rules` (likely in repo root or `firebase/`). |
| **Approach** | Replace dev-open rules with company-scoped + role-aware: `match /companies/{cid}/{document=**} { allow read, write: if request.auth.token.companyId == cid && hasRole(request.auth, 'X') }`. Per-collection refinements (vouchers read-only after POSTED, settings admin-only, etc.). |
| **Acceptance criteria** | 1. Cross-tenant read denied. 2. Cross-tenant write denied. 3. Non-authenticated read/write denied for all collections. 4. Posted voucher updates denied even by owner. 5. Emulator test suite passes 100%. |
| **Tests** | New `firestore-rules.test.ts` using `@firebase/rules-unit-testing`. Cover: tenant A reads tenant A ✓, tenant A reads tenant B ✗, posted voucher mutation ✗, anonymous read ✗, every collection. |
| **Pre-deploy check** | Ensure all backend service-account writes carry correct auth claims. Run emulator suite locally before each rule change. |
| **MD updates** | New `docs/architecture/security-rules.md` documenting model + how to add rules for new collections. |
| **Risk** | Medium — wrong rule = dev lockout. Mitigate: emulator test suite green before push. |

---

## Cross-cutting test coverage to add (rolls up across PRs)

These 5 round-trip integration tests from prior verification — write once, run in CI for every PR:

1. **Purchase round-trip:** PO → GRN → PI → vendor payment. Assert inventory↑, GRNI cleared, AP zero, cash↓, PostingLog complete.
2. **Sales round-trip:** SO → DN → SI → customer payment. Assert inventory↓, COGS posted, AR zero, cash↑, PostingLog complete.
3. **Returns round-trip:** Buy 10 → sell 5 → customer returns 2 → vendor returns 1. Assert stock=6, all four GL ledgers balance.
4. **SIMPLE direct sale:** SIMPLE company + stock item, direct SI post. Assert atomic inventory+GL, COGS posted with `cogsPostingStatus=POSTED`.
5. **Multi-currency cycle:** EUR invoice → USD payment at different rate. Assert FX gain/loss line, no balance drift.

Add to `backend/src/tests/integration/round-trips/`.

---

## Suggested PR sequence and timeline

| Week | PRs in flight | Reviewable size |
|---|---|---|
| 1 | PR1 (Engine guard) + PR6 (Firestore rules) + PR4 (idempotency + negative stock) | 3 small PRs in parallel |
| 2 | PR2 (PostingLog) — single largest PR | 1 large PR, full week |
| 3 | PR3 (Strict posting) + PR5 (FX) — both depend on PR2 | 2 medium PRs |
| End of week 3 | All P0 closed. Round-trip tests in CI. Pre-alpha go/no-go decision. |

---

## What this plan does NOT cover

- **P1 items** (GL Impact UI, AR/AP aging, backend P&L, period lock, statements, deferred-cost settlement, three-way match, PI discounts, valuation as-of-date, init unification) — separate plan after P0 closes.
- **P2 items** (FIFO, landed cost, withholding tax, etc.) — V2 backlog.
- **Architectural rewrites** — none needed. All P0s are guards, validations, and logging on top of the existing sound foundation.

---

## Approval gate

Before starting any PR, confirm the PR sequence above (especially that PR1+PR4+PR6 run in week 1 in parallel).

No code work begins until signed off.
