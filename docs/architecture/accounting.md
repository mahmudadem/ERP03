# Architecture: Accounting Module

**Last updated:** 2026-06-01
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

- **Accounting Engine** = mandatory backend infrastructure. Chart of accounts, voucher posting service (`PostVoucherUseCase`), ledger repository, voucher types/forms, fiscal year, base currency seed. Must be initialized for any Sales/Purchases/Inventory posting to write GL entries. State: `companyModule.accounting.initialized === true`.
- **Accounting App/UI** = optional user-facing module. The navigation entry, journal screens, voucher list, reports. A tenant may run Sales/Purchases without exposing these screens. State: `companyModule.accounting.isEnabled` (admin toggle). **This flag is irrelevant to posting** — posting paths must never consult it.

**Implications:**
- Sales/Purchases initialization auto-invokes `EnsureAccountingEngineInitialized` (which calls `InitializeAccountingUseCase` with safe defaults: `coaTemplate=standard`, calendar fiscal year, base currency from the company record). If the Engine cannot be initialized (no base currency on the company, no default COA template), it throws `AccountingEngineUnavailableError`.
- All posting use cases (`PostSalesInvoiceUseCase`, `PostPurchaseInvoiceUseCase`, etc.) check `companyModule.accounting.initialized` via `isAccountingEngineReady`. If false (and `createAccountingEffect=true`), they throw `AccountingEngineUnavailableError` — never silently mark a document POSTED without GL.
- Hiding the Accounting UI from the navigation **does not bypass** voucher creation. The books are correct regardless of what the user sees.

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

Notes:
- Channel- or industry-specific accounts remain available and can still override defaults.
- Simplified template keeps a lean structure, but now includes a GRNI default (`203`) for setup compatibility.
- Wizard/account-mapping steps should still validate required defaults at runtime and surface actionable warnings if a required mapping does not resolve.

## Architectural Principles

1. **Posting strategies, not handlers.** Each voucher type has a posting strategy (`JournalEntryStrategy`, `PaymentVoucherStrategy`, `SalesInvoiceStrategy`, etc.). The single `PostVoucherUseCase` resolves the strategy and applies it. New voucher types add a strategy; the posting pipeline does not change.
2. **Ledger always in base currency.** A voucher can be in any currency, but ledger entries are converted to the company base currency at posting time. FX amounts are tracked per line. The frontend cannot override this.
3. **Immutable posted entries.** Once a voucher is posted, its ledger lines are immutable. Mistakes are corrected via the **Reverse & Replace** flow ([CORRECTIONS.md](../../backend/src/domain/accounting/CORRECTIONS.md)), which creates a paired reversal voucher and (optionally) a replacement DRAFT.
4. **Repository pattern.** All persistence is behind interfaces (`IVoucherRepository`, `ILedgerRepository`, `IAccountRepository`, etc.) so the system can migrate from Firestore to SQL without touching domain or application code.
5. **Policy enforcement at every posting gate.** `PostVoucherUseCase` applies posting policies for manual Accounting vouchers. `SubledgerVoucherPostingService` applies the same policy registry for automatic vouchers originating in Sales, Purchases, and Inventory. Core invariants, account validity, company policies, and override checks must run before ledger rows are written.
6. **Final ledger boundary is also guarded.** Because a cross-module caller once bypassed the normal posting gate, `ILedgerRepository.recordForVoucher()` now also invokes `VoucherValidationService.validateCore()` and `validateAccounts()` before any ledger rows are persisted. This is the non-negotiable last line of backend defense.

## Key Use Cases

| Use case | Purpose |
|---|---|
| `CreateVoucherUseCase` / `UpdateVoucherUseCase` | Draft voucher CRUD; runs validation; does NOT post. |
| `PostVoucherUseCase` | Single posting gate. Resolves strategy, applies policies, writes ledger lines. |
| `SubledgerVoucherPostingService` | Shared automatic posting gate for Sales, Purchases, and Inventory. Generates voucher lines, validates core/account rules, applies `AccountingPolicyRegistry`, then writes ledger/voucher records. |
| `ApproveVoucherUseCase` | DRAFT → APPROVED transition (if `ApprovalRequiredPolicy` is active). |
| `ReverseAndReplaceVoucherUseCase` | Correction flow. Creates reversal voucher, optionally a replacement DRAFT. Links via `correctionGroupId`. |
| `GetTrialBalanceUseCase` | Hierarchical ledger-sourced report by account classification. |
| `GetProfitAndLossUseCase`, `GetBalanceSheetUseCase`, etc. | One use case per report. All read from the immutable ledger. |
| `CalculateFXRevaluationUseCase` + `GenerateFXRevaluationVoucherUseCase` | Computes unrealized FX gain/loss on foreign-currency balances; emits a DRAFT revaluation voucher. |
| `GetConsolidatedTrialBalanceUseCase` | Multi-company consolidation with FX conversion to a reporting currency. |
| `CreateRecurringTemplateUseCase` | Templated vouchers that auto-generate on schedule. |

## Repository Interfaces (key)

- `IVoucherRepository` — voucher CRUD, find by status / date / type
- `ILedgerRepository` — ledger entry read and controlled posting persistence via `recordForVoucher()`. Direct callers are allowed only through DI and still pass the final `VoucherValidationService` guard before write.
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
5. Posting policies run, then ledger rows are written.

There are two entry points into this boundary:

- Manual Accounting vouchers use `PostVoucherUseCase`.
- Source-module postings use `SubledgerVoucherPostingService`.

Both must use `AccountingPolicyRegistry` before ledger persistence. This keeps future controls, such as cost-center rules, account access, period locks, and approval-related posting guards, from becoming Sales-only or manual-voucher-only behavior.

### Discovered bypass and fix

Manual QA found a critical bypass in the Sales receipt settlement path. Sales created a receipt `VoucherEntity`, marked it posted, and called `ledgerRepo.recordForVoucher()` / `voucherRepo.save()` directly. The Accounting validation rule was correct, but this path skipped `VoucherValidationService.validateAccounts()`, so a HEADER account selected through a free-text UI field reached the ledger.

The fix has two layers:

- Sales receipt paths now validate before ledger, voucher, payment-history, or invoice-status writes.
- `ILedgerRepository.recordForVoucher()` now runs `VoucherValidationService.validateCore()` and `validateAccounts()` itself in both Firestore and SQL implementations.

This means future backend callers cannot reach the ledger with an invalid voucher or non-posting account just by forgetting to use the higher-level posting service.

### Remaining security gap

The backend is now protected, but TypeScript cannot stop writes made outside the backend process. Any actor with direct Firestore/SQL write credentials, emulator access, admin SDK access, or overly broad service-account permissions could still bypass application-layer validation and write ledger documents directly.

Required infrastructure hardening before production:

- Firestore/SQL credentials must be held only by the backend runtime and controlled migration/seeding jobs.
- Frontend clients must never have direct write permission to ledger, voucher, account, or accounting settings collections/tables.
- Firestore security rules / SQL permissions must deny client-side writes to ledger paths and restrict admin SDK usage to trusted service accounts.
- Production seeding and maintenance scripts must use the same DI-wired repositories or explicit accounting validation services.
- Add periodic integrity checks that scan posted ledger rows for non-posting, inactive, missing, replaced, or parent accounts.

This is a defense-in-depth rule: the application validates at the posting service and the ledger repository; infrastructure must still prevent direct database writes that bypass the application entirely.

## Voucher Correction Flow (Reverse & Replace)

See [CORRECTIONS.md](../../backend/src/domain/accounting/CORRECTIONS.md) for the canonical reference.

Summary:
- A posted voucher cannot be edited.
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

## Frontend

- Module root: [`frontend/src/modules/accounting/`](../../frontend/src/modules/accounting/)
- Key pages: Vouchers list/detail, Chart of Accounts, Cost Centers, Approvals, Reports (one page per report), Recurring Vouchers, Forms Designer, Settings.
- Forms designer produces user-defined voucher layouts via the `designer-engine` package (`frontend/src/designer-engine/`).

## Cross-Module Touchpoints

- **Sales** → posts AR + Revenue + (conditionally) COGS through `SubledgerVoucherPostingService`, which now runs the shared accounting policy registry before ledger write.
- **Purchases** → posts Inventory/Expense + AP through `SubledgerVoucherPostingService`, which now runs the shared accounting policy registry before ledger write.
- **Inventory** → Opening Stock can post an inventory-valuation voucher through `SubledgerVoucherPostingService`, which now runs the shared accounting policy registry before ledger write. COGS auto-posting from sales delivery is **not yet implemented** — Sales posts COGS directly today.
- **Multi-company** → consolidated reports reach across companies via `GetConsolidatedTrialBalanceUseCase`.

## What Is NOT Implemented

| Feature | Why deferred |
|---|---|
| **Trading Account report** | Requires CoA sub-classification (SALES vs COGS) which is not yet in the account model. |
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
