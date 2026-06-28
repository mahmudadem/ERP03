# Architecture: Accounting Module

**Last updated:** 2026-06-18
**Status:** Implemented (core), with explicitly deferred features listed below.
**Code-near docs:** [`backend/src/domain/accounting/ARCHITECTURE.md`](../../backend/src/domain/accounting/ARCHITECTURE.md), [`backend/src/domain/accounting/CORRECTIONS.md`](../../backend/src/domain/accounting/CORRECTIONS.md)

---

## Purpose

The Accounting module is the financial system of record. Every transaction in ERP03 that affects money — whether it originates in Sales, Purchases, Inventory, or as a direct manual voucher — ultimately produces ledger entries posted via this module.

It owns:
- The chart of accounts (CoA)
- Voucher creation, approval, posting, correction
- The general ledger (append-only, posted entries)
- Financial reports (P&L, Balance Sheet, Trial Balance, etc.)
- Period lock and fiscal-year boundaries
- FX revaluation and multi-currency
- Cost centers
- Recurring vouchers
- The forms designer (user-defined voucher layouts)

## Accounting Engine vs Accounting App/UI

These are two independent concepts. **Never conflate them.**

- **Accounting Engine** = backend infrastructure for full voucher and ledger posting. Chart of accounts, voucher posting service (`PostVoucherUseCase` / `SubledgerVoucherPostingService`), ledger repository, voucher types/forms, fiscal year, base currency seed. Must be initialized for source modules to produce full GL entries. State: `companyModule.accounting.initialized === true`.
- **Accounting App/UI** = optional user-facing module. The navigation entry, journal screens, voucher list, reports. A tenant may run POS or operational modules without exposing these screens. State: `companyModule.accounting.isEnabled` (admin toggle).
- **Accounting Bridge** = System Core recording seam for source-module financial events. When the Accounting Engine is initialized (`companyModule.accounting.initialized === true`), it uses the full posting engine and produces vouchers/ledger entries. When the Accounting Engine is not initialized (the company is not linked to accounting), it records a minimal `PostingLog` journal event so the operational financial event is still durable, but no GL voucher is created. The Accounting App/UI visibility toggle (`isEnabled`) never gates this decision — only engine readiness does.

**Implications:**
- Sales/Purchases initialization auto-invokes `EnsureAccountingEngineInitialized` (which calls `InitializeAccountingUseCase` with safe defaults: `coaTemplate=standard`, calendar fiscal year, base currency from the company record). If the Engine cannot be initialized (no base currency on the company, no default COA template), it throws `AccountingEngineUnavailableError`.
- Existing Sales/Purchases/Inventory full-posting use cases still check `companyModule.accounting.initialized` or module readiness before writing GL.
- POS financial events use `IAccountingBridge`: an initialized Accounting Engine means full voucher posting; an uninitialized Accounting Engine means minimal-journal event capture.
- Minimal-journal records are not financial statements. They preserve the audit trail of operational events while the Accounting Engine is not initialized (company not linked to accounting). A future replay/migration policy is required before those minimal records become ledger vouchers.

## COA Template Baseline (Perpetual-Ready Defaults)

Template seeding now includes generic catch-all posting defaults needed by Purchases/Sales integrations, so new companies do not need manual account creation before posting:

- AP default posting child (for company-level fallback)
- Revenue default posting account (`Sales Revenue` where template structure supports generic sales)
- COGS default posting child (`Cost of Goods Sold - General` where cost-of-sales grouping exists)
- GRNI default account for templates that support perpetual inventory flows

Implementation source:
- `backend/src/application/accounting/templates/COATemplates.ts`
- `backend/src/application/accounting/templates/IndustryCOATemplates.ts`
- `backend/src/seeder/seedSystemMetadata.ts`
- SQL launch seed: `backend/prisma/seeds/seedCOATemplates.ts`

Notes:
- Channel- or industry-specific accounts remain available and can still override defaults.
- Simplified template keeps a lean structure, but now includes a GRNI default (`203`) for setup compatibility.
- Wizard/account-mapping steps should still validate required defaults at runtime and surface actionable warnings if a required mapping does not resolve.
- In SQL mode, `ChartOfAccountsTemplate.code` is the stable seed identity. The company wizard reads live template options from `ChartOfAccountsTemplateRepository`; `system_metadata.coa_templates` is retained only as a lightweight legacy manifest whose ids mirror the stable codes.

## SQL Launch Seed Decisions (Epic 275)

The v1 SQL seed catalog deliberately excludes the AI Assistant module and `ai-assistant.*` permissions because AI is off for the first Supabase/PostgreSQL launch. The seed also deletes stale AI module/permission rows left by earlier pre-audit seed runs so a fresh or reused launch database has the same v1 catalog.

SYSTEM voucher type definitions store display-only extras (`voucherType`, `persona`, and `sidebarGroup`) in `layout._meta` rather than separate columns. `PrismaVoucherTypeDefinitionRepository` hydrates those fields from `_meta` when SYSTEM templates are copied into tenant voucher types/forms, so the document/form sidebar behavior remains available without duplicating schema fields.

## Architectural Principles

1. **Posting strategies, not handlers.** Each voucher type has a posting strategy (`JournalEntryStrategy`, `PaymentVoucherStrategy`, `SalesInvoiceStrategy`, etc.). The single `PostVoucherUseCase` resolves the strategy and applies it. New voucher types add a strategy; the posting pipeline does not change.
2. **Ledger always in base currency.** A voucher can be in any currency, but ledger entries are converted to the company base currency at posting time. FX amounts are tracked per line. The frontend cannot override this.
3. **Posted entries are protected.** In Strict mode, once a voucher is posted its ledger lines are immutable and mistakes are corrected via **Reverse & Replace** ([CORRECTIONS.md](../../backend/src/domain/accounting/CORRECTIONS.md)). If Flexible mode deliberately allows posted edit/delete, the resulting ledger replace/delete still goes through the guarded `PostingGateway` and the same accounting policies.
4. **Repository pattern.** All persistence is behind interfaces (`IVoucherRepository`, `ILedgerRepository`, `IAccountRepository`, etc.) so the system can migrate from Firestore to SQL without touching domain or application code.
5. **Policy enforcement at every posting gate.** `PostVoucherUseCase` applies posting policies for manual Accounting vouchers. `SubledgerVoucherPostingService` applies the same policy registry for automatic vouchers originating in Sales, Purchases, and Inventory. Core invariants, account validity, company policies, and override checks must run before ledger rows are written.
6. **One guarded ledger door.** Application code must not mutate the ledger repository directly. `PostingGateway` is the only production caller allowed to invoke `ILedgerRepository.recordForVoucher()`, `deleteForVoucher()`, or `markReconciled()`, and the architecture test fails if a second path appears.

## Key Use Cases

| Use case | Purpose |
|---|---|
| `CreateVoucherUseCase` / `UpdateVoucherUseCase` | Draft voucher CRUD; runs validation; does NOT post. |
| `PostVoucherUseCase` | Single posting gate. Resolves strategy, applies policies, writes ledger lines. |
| `SubledgerVoucherPostingService` | Shared automatic posting gate for Sales, Purchases, and Inventory. Generates voucher lines, validates core/account rules, applies `AccountingPolicyRegistry`, then writes ledger/voucher records. |
| `ApproveVoucherUseCase` | DRAFT → APPROVED transition (if `ApprovalRequiredPolicy` is active). |
| `ReverseAndReplaceVoucherUseCase` | Correction flow. Creates reversal voucher, optionally a replacement DRAFT. Links via `correctionGroupId`. |
| `GetTrialBalanceUseCase` | Hierarchical ledger-sourced report by account classification. |
| `GetProfitAndLossUseCase`, `GetBalanceSheetUseCase`, `GetTradingAccountUseCase` | One use case per report. Reports read from the immutable ledger; `PERIODIC` mode may add report-time inventory valuation overrides without posting a closing journal. |
| `CalculateFXRevaluationUseCase` + `GenerateFXRevaluationVoucherUseCase` | Computes unrealized FX gain/loss on foreign-currency balances; emits a DRAFT revaluation voucher. |
| `GetConsolidatedTrialBalanceUseCase` | Multi-company consolidation with FX conversion to a reporting currency. |
| `CreateRecurringTemplateUseCase` | Templated vouchers that auto-generate on schedule. |

## Repository Interfaces (key)

- `IVoucherRepository` — voucher CRUD, find by status / date / type
- `ILedgerRepository` — ledger entry reads plus low-level mutation primitives. Production application code must reach mutation methods only through `PostingGateway`.
- `IAccountRepository` — chart of accounts, account-active checks
- `ICompanyModuleSettingsRepository` — base currency, exchange rates, policy flags, default accounts

All Firestore implementations live under `backend/src/infrastructure/firestore/repositories/`. Domain and application layers must NEVER import these directly — only via the DI container.

## Posting Security Boundary

### Normal path

The intended accounting path is:

1. A source module builds a voucher draft or subledger voucher.
2. The module calls the Accounting posting service / `PostVoucherUseCase`.
3. `VoucherValidationService.validateCore()` verifies invariant rules:
   - at least two lines
   - debit and credit balance
   - valid non-negative amounts
   - account IDs present
   - currency/base-currency consistency
4. `VoucherValidationService.validateAccounts()` verifies every voucher line account:
   - account exists in the same company
   - account is `POSTING`, not `HEADER`
   - account is `ACTIVE`
   - account has not been replaced
   - account has no children
5. Posting policies run, then `PostingGateway` writes or replaces ledger rows.

There are two business entry points into this boundary:

- Manual Accounting vouchers use `PostVoucherUseCase`.
- Source-module postings use `SubledgerVoucherPostingService`.

Both converge on `PostingGateway` before any ledger mutation. This keeps future controls, such as cost-center rules, account access, period locks, and approval-related posting guards, from becoming Sales-only or manual-voucher-only behavior.

### Discovered bypass and fix

Manual QA found a critical bypass in the Sales receipt settlement path. Sales created a receipt `VoucherEntity`, marked it posted, and called `ledgerRepo.recordForVoucher()` / `voucherRepo.save()` directly. The Accounting validation rule was correct, but this path skipped `VoucherValidationService.validateAccounts()`, so a HEADER account selected through a free-text UI field reached the ledger.

The fix has three layers:

- Sales receipt paths now validate before ledger, voucher, payment-history, or invoice-status writes.
- `ILedgerRepository.recordForVoucher()` now runs `VoucherValidationService.validateCore()` and `validateAccounts()` itself in both Firestore and SQL implementations.
- `PostingGateway` is now the only production application path allowed to call ledger mutation methods; `PostingAuthority.test.ts` blocks any future direct `recordForVoucher`, `deleteForVoucher`, or `markReconciled` caller outside the gateway.

This means future backend callers cannot add another application-layer route to the ledger just by forgetting to use the guarded posting service.

### Remaining security gap

The backend is now protected, but TypeScript cannot stop writes made outside the backend process. Any actor with direct Firestore/SQL write credentials, emulator access, admin SDK access, or overly broad service-account permissions could still bypass application-layer validation and write ledger documents directly.

Required infrastructure hardening before production:

- Firestore/SQL credentials must be held only by the backend runtime and controlled migration/seeding jobs.
- Frontend clients must never have direct write permission to ledger, voucher, account, or accounting settings collections/tables.
- Firestore security rules / SQL permissions must deny client-side writes to ledger paths and restrict admin SDK usage to trusted service accounts.
- Production seeding and maintenance scripts must use the same DI-wired repositories or explicit accounting validation services.
- Add periodic integrity checks that scan posted ledger rows for non-posting, inactive, missing, replaced, or parent accounts.

This is a defense-in-depth rule: the application validates at the posting service and the ledger repository; infrastructure must still prevent direct database writes that bypass the application entirely.

### Tenant isolation for voucher routes

- Voucher URLs use the internal voucher UUID (`#/accounting/vouchers/:id/view`) rather than the human voucher number because voucher numbers can repeat across companies.
- The UUID is not the security boundary. Every Accounting API request must resolve the company from the authenticated user context and verify company membership before controllers or repositories run.
- `authMiddleware` now fails closed for a caller-supplied `x-company-id` that the user is not a member of (`403 COMPANY_ACCESS_DENIED`). A stale stored active company without membership is stripped to `null` so tenant routes cannot silently use it.
- Voucher and ledger repositories remain company-scoped (`companies/{companyId}/accounting/Data/...` in Firestore), so a valid voucher UUID from another company does not resolve through the current company's repository path.

## Voucher Correction Flow (Reverse & Replace)

See [CORRECTIONS.md](../../backend/src/domain/accounting/CORRECTIONS.md) for the canonical reference.

Summary:
- A posted voucher is normally treated as immutable, but in Flexible mode the `Allow Edit/Delete Posted` setting can permit editing or deletion for vouchers that were posted under Flexible lock policy.
- Period lock still wins: if the voucher date is inside a locked period, editing remains blocked even when posted edits are otherwise allowed.
- The user invokes `POST /api/v1/companies/:companyId/accounting/vouchers/:id/correct` with an optional flag to also create a replacement.
- Backend creates a reversal voucher (lines with debit/credit swapped, defaulting to the original voucher's date so period alignment is preserved).
- If a replacement was requested, a DRAFT copy of the original is created. The user edits and posts it manually.
- Both reversal and replacement carry a shared `correctionGroupId` for audit/reporting.
- All standard policies (approval, period lock, account-active) apply to the reversal.

## Period Lock & Fiscal Year

- `PeriodLockPolicy` enforces a `lockedThrough` date — posting to any date <= this date is blocked unless a soft-lock override is explicitly allowed.
- A soft-lock override is not a separate ticket record. It is an override payload on the posting request: a reason plus the user who performed the override. The policy accepts it only when `allowPeriodLockOverride !== false`.
- The API layer remains responsible for role/permission authorization before it creates that override payload. The current Sales posting endpoints check owner/permission access before sending `periodLockOverride` into the posting service.
- Fiscal periods with `LOCKED` or `CLOSED` status are hard stops in the shared policy path. They are not bypassed by soft-lock override metadata.
- Reversal vouchers default to the original voucher's date so reversing a closed-period entry does not silently move the impact into a new period.

## Multi-Currency

- Each company has a base currency.
- Vouchers can be created in any currency; the FX rate is captured at posting time.
- Ledger amounts are stored in base currency; the original currency and rate are stored per line.
- **FX revaluation** computes unrealized gain/loss on foreign-currency account balances and produces a DRAFT revaluation voucher the user reviews and posts.
- **Consolidation** (multi-company): `GetConsolidatedTrialBalanceUseCase` aggregates across companies and converts to a reporting currency.

## Periodic report-time trading layer

Epic 240 Phase 5 adds the missing accounting-reporting layer for `InventorySettings.accountingMode = PERIODIC`.

Rules:

- `INVOICE_DRIVEN` and `PERPETUAL` reports keep their existing ledger-driven behavior.
- `PERIODIC` reports perform a **virtual close at read time** using `InventoryValuationService`. This is a reporting override, not a journal-posting workflow.

Implemented periodic behavior:

- **Balance Sheet**
  - inventory is overridden with report-time valuation at the requested `asOfDate`
  - the default policy is `AVERAGE`
  - the override is applied inside the use case before section totals are built, so parent balances stay mathematically correct
  - **virtual close (keeps the statement balanced):** the inventory uplift `Σ(valuation − raw GL inventory balance)` has no posted journal, so the *same delta* is booked into **Current Year Earnings** on the equity side. Without this the asset side would rise while equity stayed flat and the Balance Sheet would not balance. The resulting retained-earnings figure equals periodic net profit (`Sales − COGS`), so the statement ties by construction.
- **Trading Account**
  - formula: `Sales − (Opening Inventory + Net Purchases − Closing Inventory)`
  - opening inventory = valuation at the day before the report's `fromDate`
  - closing inventory = valuation at `toDate`
  - net purchases come from the ledger accounts tagged for periodic purchase flow
- **Profit & Loss**
  - the raw purchases expense bucket is replaced with the computed periodic cost of sales
  - the response exposes the periodic breakdown so the UI/export can show the formula transparently

**Valuation policy for statements.** The Balance Sheet, Trading Account, and P&L are *always* valued at `AVERAGE` (the costing method of record) so the three statements agree with each other and the books tie. The standalone **Inventory Valuation report** is the only surface that lets a user switch pricing policy (`AVERAGE` ↔ `LAST_PURCHASE`) — that is for analysis, not for the statutory statements.

**Both reporting paths are wired.** The dedicated report controllers and the `ReportRunner` (which powers the AI-assistant report tools) both construct the report use cases with the valuation service, so periodic companies get identical numbers regardless of entry point.

This keeps the books honest for simple trading companies:

- stock quantities still come from immutable inventory movements
- sales / purchases still come from immutable ledger rows
- no hidden closing journal is manufactured behind the user's back

If the company wants an actual posted period-close voucher, that remains a separate future workflow.

## Frontend

- Module root: [`frontend/src/modules/accounting/`](../../frontend/src/modules/accounting/)
- Key pages: Vouchers list/detail, Chart of Accounts, Cost Centers, Approvals, Reports (one page per report), Recurring Vouchers, Forms Designer, Settings.
- Voucher document inspection and ledger-effect inspection are separate routes:
  - `#/accounting/vouchers/:id/view` renders the source voucher record: header, status, source lines, audit metadata, and workflow actions.
  - `#/accounting/vouchers/:id/ledger` renders the read-only posted ledger impact for that voucher by calling `GET /tenant/accounting/reports/general-ledger?voucherId=:id`.
- The ledger-impact route must stay read-only. It displays actual posted ledger rows only; draft/unposted vouchers show an empty state rather than a simulated preview.
- Voucher and ledger-impact detail routes expose a read-only previous/current/next panel. The panel intentionally ignores list filters and resolves neighboring vouchers from the company voucher collection using the repository's default order (`date desc`, then stable ID ordering where supported). It does not query by human voucher number and it does not mutate vouchers or ledger rows.
- Forms designer produces user-defined voucher layouts via the `designer-engine` package (`frontend/src/designer-engine/`).

## Cross-Module Touchpoints

- **Sales** → posts AR + Revenue + (conditionally) COGS. The DeliveryNote COGS path, SalesInvoice document voucher path (revenue + COGS), SalesReturn document voucher path (revenue reversal + COGS reversal), and Sales PaymentSync record-payment receipt path now route through `IAccountingBridge`-only (Task 267-F). All paths apply the full-vs-minimal decision: full GL voucher when the Accounting Engine is initialized, minimal `PostingLog` event when not.
- **Purchases** → posts Inventory/Expense + AP through `postFinancialEvent` / `SubledgerDocumentPoster` + the bridge; settlement through `bridge.recordPreBuiltVoucher` (FUP-5). Goods Receipt, Purchase Invoice, Purchase Return, and Purchases PaymentSync record-payment vouchers now route through `IAccountingBridge`-only (Task 267-F GRN + PI + PR + Purchases PaymentSync slices).
- **Inventory** → Opening Stock, Stock Adjustment, Stock Transfer, and Inventory Revaluation route through `postFinancialEvent` + the bridge. Still holds a `SubledgerVoucherPostingService` field as fallback — migration to bridge-only is a follow-up slice.
- **Inventory** → `InventoryValuationService` now also feeds the periodic reporting bridge: Balance Sheet inventory override, Trading Account, Profit & Loss periodic cost-of-sales, and the Inventory Valuation report's pricing-policy view.
- **Multi-company** → consolidated reports reach across companies via `GetConsolidatedTrialBalanceUseCase`.

## Accounting Bridge Migration — Task 267-F (DeliveryNote COGS + SalesInvoice + SalesReturn + Sales PaymentSync)

**Date:** 2026-06-25
**Slice:** Sales / DeliveryNote COGS and SalesInvoice document voucher paths migrated to bridge-only.

The `PostDeliveryNoteUseCase` previously held a direct `SubledgerVoucherPostingService` field and passed `{ bridge, postingService }` to the `postFinancialEvent` helper — the posting service was the fallback when no bridge was wired. As of 267-F, the use case depends **only** on `IAccountingBridge`:

- The `SubledgerVoucherPostingService` constructor param and import were removed entirely.
- The `postFinancialEvent` call passes `{ bridge }` only — the bridge owns the full-vs-minimal decision.
- The `SalesController.postDN` handler no longer constructs a `SubledgerVoucherPostingService` for the DN path; it passes `SalesController.buildAccountingBridge()` directly.
- An architecture guard (`267-F` in `SystemCoreBoundaries.test.ts`) pins this: `DeliveryNoteUseCases.ts` must not import `SubledgerVoucherPostingService` or `PostingGateway`, and must use `postFinancialEvent` + `IAccountingBridge`.

**Golden voucher-output tests** (`SalesDeliveryNoteGoldenVoucher.test.ts`, 7 tests) capture the exact voucher output that flows into the bridge — account ids, debit/credit sides, base/doc amounts, currency metadata, source reference metadata, period-lock override forwarding, and minimal-mode null-voucher behavior. These tests were written **before** the migration, run green against the pre-migration code (where the bridge was already wired), and remain green after — proving no accounting output drift.

**What was NOT changed in the DeliveryNote slice:** `PaymentSyncUseCases` (Sales), and all Purchases/Inventory posting paths still held direct posting fallbacks. Later 267-F slices migrated SI, SR, Sales PaymentSync, GRN, PI, PR, and Purchases PaymentSync as documented below. Inventory remains a follow-up slice.

### SalesInvoice document voucher migration (267-F SI slice)

The `PostSalesInvoiceUseCase` previously held a direct `SubledgerVoucherPostingService` field and constructed `new SubledgerDocumentPoster(this.accountingPostingService, this.accountingBridge)` — the posting service was the fallback when no bridge was wired. As of the 267-F SI slice, the use case depends **only** on `IAccountingBridge` for document voucher posting:

- The `SubledgerVoucherPostingService` import and `accountingPostingService` constructor param were removed entirely.
- The `accountingBridge` constructor param is now **required** (moved before the optional params, compile-time enforced).
- The poster is constructed as `new SubledgerDocumentPoster(undefined, this.accountingBridge)` — bridge-only, no legacy fallback.
- `SubledgerDocumentPoster.postingService` was made optional (backward-compatible) — PI/SR still pass both args unchanged.
- An architecture guard (`267-F (SI)` in `SystemCoreBoundaries.test.ts`) pins this: `SalesInvoiceUseCases.ts` must not import `SubledgerVoucherPostingService`, must use `SubledgerDocumentPoster` + `IAccountingBridge`.
- Golden voucher-output tests (`SalesInvoiceGoldenVoucher.test.ts`, 7 tests) capture the exact revenue + COGS voucher output — account ids, sides, base/doc amounts, currency, source metadata, period-lock override, minimal mode, PERIODIC mode, and output stability. Written before migration, green after → zero accounting output drift.
- Note: `PostingGateway` remains for the settlement receipt path (FUP-5 sanctioned pattern) — out of scope for this slice.

### SalesReturn document voucher migration (267-F SR slice)

The `PostSalesReturnUseCase` previously held a direct `SubledgerVoucherPostingService` field and constructed `new SubledgerDocumentPoster(this.accountingPostingService, this.accountingBridge)` — the posting service was the fallback when no bridge was wired. As of the 267-F SR slice, the use case depends **only** on `IAccountingBridge` for document voucher posting (revenue reversal + COGS reversal):

- The `SubledgerVoucherPostingService` import and `accountingPostingService` constructor param were removed entirely.
- The `accountingBridge` constructor param is now **required** (moved before the optional params, compile-time enforced).
- The poster is constructed as `new SubledgerDocumentPoster(undefined, this.accountingBridge)` — bridge-only, no legacy fallback.
- `SubledgerDocumentPoster.postingService` was already made optional in the 267-F SI slice (backward-compatible) — PI/PR still pass both args unchanged; no change to the poster in this slice.
- The `SalesController.postReturn` handler no longer constructs a `SubledgerVoucherPostingService` for the SR path; it passes `SalesController.buildAccountingBridge()` directly (required position before the optional audit/log repos).
- An architecture guard (`267-F (SR)` in `SystemCoreBoundaries.test.ts`) pins this: `SalesReturnUseCases.ts` must not import `SubledgerVoucherPostingService`, must use `SubledgerDocumentPoster` + `IAccountingBridge`.
- Golden voucher-output tests (`SalesReturnGoldenVoucher.test.ts`, 7 tests) capture the exact COGS-reversal + revenue-reversal voucher output — account ids, sides, base/doc amounts, currency, source metadata, period-lock override forwarding, BEFORE_INVOICE (COGS-only) behavior, minimal mode (null voucher ids), foreign-currency REVENUE/COGS split, PERIODIC mode (no COGS), and output stability. Written before migration, run green against the pre-migration code (where the poster already preferred the bridge), and remain green after → zero accounting output drift.

### Sales PaymentSync receipt migration (267-F Sales PaymentSync slice)

`PostSalesInvoiceWithSettlementUseCase` / `RecordSalesInvoicePaymentUseCase` already assembled receipt vouchers and called `accountingBridge.recordPreBuiltVoucher(...)`, but still held an optional bridge fallback: if no bridge was supplied, the use case constructed the ledger gateway directly and saved the voucher itself. As of this slice:

- `accountingBridge` is now a required constructor dependency for both Sales PaymentSync use cases.
- `PaymentSyncUseCases.ts` no longer imports or constructs `PostingGateway` directly.
- Full-mode receipt persistence is encapsulated in `PreBuiltVoucherFullPoster.postPreBuiltVoucherFullMode(...)` and is only invoked by the `postFull` callback passed into `recordPreBuiltVoucher`.
- `SalesController.recordPayment` passes `SalesController.buildAccountingBridge()` in the required bridge position.
- An architecture guard (`267-F (Sales PaymentSync)` in `SystemCoreBoundaries.test.ts`) pins this: `PaymentSyncUseCases.ts` must not import `PostingGateway`, and must use `recordPreBuiltVoucher` + `IAccountingBridge`.
- Golden voucher-output tests (`SalesPaymentSyncGoldenVoucher.test.ts`, 3 tests) capture the exact prebuilt receipt voucher handed to the bridge, minimal-mode null GL link behavior, and realized FX gain line output.

### Goods Receipt voucher migration (267-F GRN slice)

`PostGoodsReceiptUseCase` previously held a direct `SubledgerVoucherPostingService` field and passed `{ bridge, postingService }` to `postFinancialEvent(...)`. As of this slice:

- The `SubledgerVoucherPostingService` import and posting-service constructor param were removed from `PostGoodsReceiptUseCase`.
- `accountingBridge` is now required for posting.
- The `postFinancialEvent` call passes `{ bridge }` only; no legacy posting fallback remains.
- `PurchaseController.postGRN` no longer constructs a posting service for the GRN post path and passes `PurchaseController.buildAccountingBridge()` directly.
- `UnpostGoodsReceiptUseCase` keeps only a narrow local voucher-deletion interface for reversing an already-posted GRN; the post path is bridge-only.
- An architecture guard (`267-F (GRN)` in `SystemCoreBoundaries.test.ts`) pins this: `GoodsReceiptUseCases.ts` must not import `SubledgerVoucherPostingService` or pass a `postingService` fallback.
- Golden voucher-output tests (`GoodsReceiptGoldenVoucher.test.ts`, 3 tests) capture the exact Inventory/GRNI voucher output sent to the bridge, minimal-mode null voucher id behavior, and PERIODIC no-post behavior.

### Purchase Invoice document voucher migration (267-F PI slice)

`PostPurchaseInvoiceUseCase` previously held a direct `SubledgerVoucherPostingService` field and constructed `new SubledgerDocumentPoster(this.accountingPostingService, this.accountingBridge)` for document voucher posting. As of this slice:

- The `SubledgerVoucherPostingService` import and `accountingPostingService` constructor param were removed from `PostPurchaseInvoiceUseCase`.
- `accountingBridge` is now a required constructor dependency.
- The document-voucher poster is constructed as `new SubledgerDocumentPoster(undefined, this.accountingBridge)` — bridge-only, no legacy fallback.
- Purchase settlement payment vouchers call `accountingBridge.recordPreBuiltVoucher(...)` directly. The `PostingGateway` remains inside the full-mode `postFull` closure so the bridge still owns the full-vs-minimal decision.
- `PurchaseController.postPI` and the shared PI builder pass `PurchaseController.buildAccountingBridge(true)` in the required bridge position.
- `UnpostPurchaseInvoiceUseCase` keeps only a narrow local voucher-deletion interface for reversing an already-posted PI; the post path is bridge-only.
- An architecture guard (`267-F (PI)` in `SystemCoreBoundaries.test.ts`) pins this: `PurchaseInvoiceUseCases.ts` must not import `SubledgerVoucherPostingService`, must use `SubledgerDocumentPoster` + `IAccountingBridge`, and must route prebuilt settlement vouchers through `recordPreBuiltVoucher`.
- Golden voucher-output tests (`PurchaseInvoiceGoldenVoucher.test.ts`, 3 tests) capture the exact Expense/Tax/AP voucher output sent to the bridge, no-accounting-effect behavior, and output stability.

### Purchase Return document voucher migration (267-F PR slice)

`PostPurchaseReturnUseCase` previously held a direct `SubledgerVoucherPostingService` field and passed `{ bridge, postingService }` into `postFinancialEvent(...)`. As of this slice:

- The `SubledgerVoucherPostingService` import and posting-service constructor param were removed from `PostPurchaseReturnUseCase`.
- `accountingBridge` is now a required constructor dependency.
- Both Purchase Return voucher branches call `postFinancialEvent({ bridge })` only: AFTER_INVOICE/DIRECT AP reversal and BEFORE_INVOICE GRNI reversal.
- `PurchaseController.postReturn` no longer constructs a posting service for the PR post path and passes `PurchaseController.buildAccountingBridge()` directly.
- `UnpostPurchaseReturnUseCase` keeps only a narrow local voucher-deletion interface for reversing an already-posted PR; the post path is bridge-only.
- An architecture guard (`267-F (PR)` in `SystemCoreBoundaries.test.ts`) pins this: `PurchaseReturnUseCases.ts` must not import `SubledgerVoucherPostingService` or pass a `postingService` fallback.
- Golden voucher-output tests (`PurchaseReturnGoldenVoucher.test.ts`, 5 tests) capture exact AP/return/tax reversal output, GRNI/Inventory reversal output, no-accounting-effect behavior, minimal-mode null voucher id, and output stability.

### Purchases PaymentSync payment voucher migration (267-F Purchases PaymentSync slice)

`PostPurchaseInvoiceWithSettlementUseCase` / `RecordPurchaseInvoicePaymentUseCase` already assembled payment vouchers and called `accountingBridge.recordPreBuiltVoucher(...)`, but still held an optional bridge fallback: if no bridge was supplied, the use case constructed the ledger gateway directly and saved the voucher itself. As of this slice:

- `accountingBridge` is now a required constructor dependency for both Purchases PaymentSync use cases.
- `PaymentSyncUseCases.ts` no longer imports or constructs `PostingGateway` directly.
- Full-mode payment voucher persistence is encapsulated in `PreBuiltVoucherFullPoster.postPreBuiltVoucherFullMode(...)` and is only invoked by the `postFull` callback passed into `recordPreBuiltVoucher`.
- `PurchaseController.recordPayment` passes `PurchaseController.buildAccountingBridge()` in the required bridge position.
- An architecture guard (`267-F (Purchases PaymentSync)` in `SystemCoreBoundaries.test.ts`) pins this: `PaymentSyncUseCases.ts` must not import `PostingGateway`, and must use `recordPreBuiltVoucher` + `IAccountingBridge`.
- Golden voucher-output tests (`PurchasePaymentSyncGoldenVoucher.test.ts`, 3 tests) capture the exact prebuilt payment voucher handed to the bridge, minimal-mode null GL link behavior, and DEFERRED no-voucher behavior.

### Opening Stock document voucher migration (267-F Inventory Opening Stock slice)

`PostOpeningStockDocumentUseCase` previously held a direct `SubledgerVoucherPostingService` field and passed `{ bridge, postingService }` into `postFinancialEvent(...)` for the optional opening-stock accounting effect. As of this slice:

- The `SubledgerVoucherPostingService` import and posting-service constructor param were removed from `PostOpeningStockDocumentUseCase`.
- `accountingBridge` is now a required constructor dependency for posting.
- The `postFinancialEvent` call passes `{ bridge }` only; no legacy posting fallback remains.
- `InventoryController.postOpeningStockDocument` no longer constructs a posting service for the Opening Stock post path and passes `InventoryController.buildAccountingBridge()` directly.
- The inventory-only branch (`createAccountingEffect === false`) is unchanged: stock is posted without a bridge event and without a GL voucher link.
- An architecture guard (`267-F (Inventory Opening Stock)` in `SystemCoreBoundaries.test.ts`) pins this: `OpeningStockDocumentUseCases.ts` must not import `SubledgerVoucherPostingService`, must not reference `PostingGateway`, and must not pass a `postingService` fallback.
- Golden voucher-output tests (`OpeningStockGoldenVoucher.test.ts`, 5 tests) capture exact Inventory/Opening Equity bridge output, period-lock override metadata, minimal-mode null GL link behavior, PERIODIC asset-account selection, inventory-only no-event behavior, and output stability.

### Stock Adjustment voucher migration (267-F Inventory Stock Adjustment slice)

`PostStockAdjustmentUseCase` previously held an optional direct `SubledgerVoucherPostingService` field, gated voucher creation on that field, and passed `{ bridge, postingService }` into `postFinancialEvent(...)`. As of this slice:

- The `SubledgerVoucherPostingService` import and posting-service constructor param were removed from `PostStockAdjustmentUseCase`.
- `accountingBridge` is now a required constructor dependency for posting.
- The voucher creation gate is based on accounting-effect + accounting mode only; when a voucher is needed, `postFinancialEvent` receives `{ bridge }` only.
- `InventoryController.postStockAdjustment` no longer constructs a posting service for the Stock Adjustment path and passes `InventoryController.buildAccountingBridge()` directly.
- PERIODIC mode remains a no-GL path; stock movements still post and the document links no GL voucher.
- An architecture guard (`267-F (Inventory Stock Adjustment)` in `SystemCoreBoundaries.test.ts`) pins this: `StockAdjustmentUseCases.ts` must not import `SubledgerVoucherPostingService`, must not reference `PostingGateway`, and must not pass a `postingService` fallback.
- Golden voucher-output tests (`StockAdjustmentGoldenVoucher.test.ts`, 4 tests) capture exact gain/loss and inventory voucher output, period-lock override metadata, minimal-mode null GL link behavior, PERIODIC no-post behavior, and output stability.

### Stock Transfer voucher migration (267-F Inventory Stock Transfer slice)

`CompleteStockTransferUseCase` previously held an optional direct `SubledgerVoucherPostingService` field, gated valued-transfer voucher creation on that field, and passed `{ bridge, postingService }` into `postFinancialEvent(...)`. As of this slice:

- The `SubledgerVoucherPostingService` import and posting-service constructor param were removed from `CompleteStockTransferUseCase`.
- `accountingBridge` is now a required constructor dependency for completion.
- Explicit VALUED transfer uplift vouchers call `postFinancialEvent({ bridge })` only.
- `InventoryController.buildCompleteStockTransferUseCase()` no longer constructs a posting service for the Stock Transfer path and passes `InventoryController.buildAccountingBridge()` directly.
- FLAT transfers and VALUED transfers without explicit added cost or revaluation remain no-GL paths.
- An architecture guard (`267-F (Inventory Stock Transfer)` in `SystemCoreBoundaries.test.ts`) pins this: `StockTransferUseCases.ts` must not import `SubledgerVoucherPostingService`, must not reference `PostingGateway`, and must not pass a `postingService` fallback.
- Golden voucher-output tests (`StockTransferGoldenVoucher.test.ts`, 5 tests) capture exact added-cost Inventory/Clearing output, revaluation Inventory/Revaluation output, period-lock override metadata, minimal-mode null GL link behavior, no-uplift no-post behavior, and output stability.

### Inventory Revaluation voucher migration (267-F Inventory Revaluation slice)

`PostInventoryRevaluationUseCase` previously held an optional direct `SubledgerVoucherPostingService` field, gated voucher creation on that field, and passed `{ bridge, postingService }` into `postFinancialEvent(...)`. As of this slice:

- The `SubledgerVoucherPostingService` import and posting-service constructor param were removed from `PostInventoryRevaluationUseCase`.
- `accountingBridge` is now a required constructor dependency for posting.
- Revaluation vouchers call `postFinancialEvent({ bridge })` only.
- `InventoryController.postInventoryRevaluation` no longer constructs a posting service for the revaluation path and passes `InventoryController.buildAccountingBridge()` directly.
- PERIODIC mode remains a no-GL path; the sub-ledger average cost is still updated and the revaluation document links no GL voucher.
- An architecture guard (`267-F (Inventory Revaluation)` in `SystemCoreBoundaries.test.ts`) pins this: `InventoryRevaluationUseCases.ts` must not import `SubledgerVoucherPostingService`, must not reference `PostingGateway`, and must not pass a `postingService` fallback.
- Golden voucher-output tests (`InventoryRevaluationGoldenVoucher.test.ts`, 5 tests) capture exact write-up/write-down Inventory/Revaluation output, period-lock override metadata, minimal-mode null GL link behavior, PERIODIC no-post behavior, and output stability.

### SQL voucher sequence write shape (Task 275e)

Receipt/voucher numbering in SQL mode uses `NumberingEngine` -> `PrismaVoucherSequenceRepository`. Prisma 5 checked create inputs do not allow mixing `company: { connect }` with raw scalar FKs like nullable `fiscalYearId`. Sequence creation therefore writes scalar `companyId` and `fiscalYearId` together. This preserves the same unique key (`companyId`, `voucherType`, `fiscalYearId`) while keeping POS terminal receipt numbering and other scoped sequences valid on PostgreSQL.

## What Is NOT Implemented

| Feature | Why deferred |
|---|---|
| **Automatic period-close voucher** | Periodic reports do a virtual close at read time; ERP03 does not yet generate/post a formal closing inventory or trading-close journal automatically. |
| **Aging report (full bucketing)** | Skeleton exists; receivable/payable bucketing across AR/AP is incomplete. |
| **Bulk corrections** | Single-voucher corrections only. No batch reversal/replace UI. |
| **Correction approval gate** | Reversals post immediately. No separate approval workflow for corrections. |
| **Correction chain visualization** | `correctionGroupId` is stored but no UI shows the chain across original → reversal → replacement. |
| **Intercompany elimination** | Consolidated TB works; full elimination rules (intercompany transactions) not yet implemented. |
| **Subgroup tagging enforcement** | Page exists; tagging rules / filtering need work. |
| **Custody confirmation backend** | UI surfaces it; backend logic is partial. |

## File Map (highest-leverage)

| Concern | Path |
|---|---|
| Posting strategies | `backend/src/domain/accounting/posting-strategies/` |
| Posting gate | `backend/src/application/accounting/use-cases/PostVoucherUseCase.ts` |
| Validation | `backend/src/domain/accounting/services/VoucherValidationService.ts` |
| Correction flow | `backend/src/application/accounting/use-cases/ReverseAndReplaceVoucherUseCase.ts` |
| Reports | `backend/src/application/accounting/use-cases/reports/` |
| Architecture explainer | `backend/src/domain/accounting/ARCHITECTURE.md` |
| Correction rules | `backend/src/domain/accounting/CORRECTIONS.md` |
| Policy configuration guide | `docs/architecture/accounting-policy-configuration.md` |
