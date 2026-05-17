# Architecture: Accounting Module

**Last updated:** 2026-05-17
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

## Architectural Principles

1. **Posting strategies, not handlers.** Each voucher type has a posting strategy (`JournalEntryStrategy`, `PaymentVoucherStrategy`, `SalesInvoiceStrategy`, etc.). The single `PostVoucherUseCase` resolves the strategy and applies it. New voucher types add a strategy; the posting pipeline does not change.
2. **Ledger always in base currency.** A voucher can be in any currency, but ledger entries are converted to the company base currency at posting time. FX amounts are tracked per line. The frontend cannot override this.
3. **Immutable posted entries.** Once a voucher is posted, its ledger lines are immutable. Mistakes are corrected via the **Reverse & Replace** flow ([CORRECTIONS.md](../../backend/src/domain/accounting/CORRECTIONS.md)), which creates a paired reversal voucher and (optionally) a replacement DRAFT.
4. **Repository pattern.** All persistence is behind interfaces (`IVoucherRepository`, `ILedgerRepository`, `IAccountRepository`, etc.) so the system can migrate from Firestore to SQL without touching domain or application code.
5. **Policy enforcement at one gate.** `PostVoucherUseCase` applies all policies (`ApprovalRequiredPolicy`, `PeriodLockPolicy`, account-active checks, balance check). Modules that originate vouchers (Sales, Purchases) call into this single gate.

## Key Use Cases

| Use case | Purpose |
|---|---|
| `CreateVoucherUseCase` / `UpdateVoucherUseCase` | Draft voucher CRUD; runs validation; does NOT post. |
| `PostVoucherUseCase` | Single posting gate. Resolves strategy, applies policies, writes ledger lines. |
| `ApproveVoucherUseCase` | DRAFT → APPROVED transition (if `ApprovalRequiredPolicy` is active). |
| `ReverseAndReplaceVoucherUseCase` | Correction flow. Creates reversal voucher, optionally a replacement DRAFT. Links via `correctionGroupId`. |
| `GetTrialBalanceUseCase` | Hierarchical ledger-sourced report by account classification. |
| `GetProfitAndLossUseCase`, `GetBalanceSheetUseCase`, etc. | One use case per report. All read from the immutable ledger. |
| `CalculateFXRevaluationUseCase` + `GenerateFXRevaluationVoucherUseCase` | Computes unrealized FX gain/loss on foreign-currency balances; emits a DRAFT revaluation voucher. |
| `GetConsolidatedTrialBalanceUseCase` | Multi-company consolidation with FX conversion to a reporting currency. |
| `CreateRecurringTemplateUseCase` | Templated vouchers that auto-generate on schedule. |

## Repository Interfaces (key)

- `IVoucherRepository` — voucher CRUD, find by status / date / type
- `ILedgerRepository` — ledger entry read (no direct write; entries are produced by posting strategies)
- `IAccountRepository` — chart of accounts, account-active checks
- `ICompanyModuleSettingsRepository` — base currency, exchange rates, policy flags, default accounts

All Firestore implementations live under `backend/src/infrastructure/firestore/repositories/`. Domain and application layers must NEVER import these directly — only via the DI container.

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

- `PeriodLockPolicy` enforces a `lockedThrough` date — posting to any date ≤ this date is blocked.
- Fiscal periods can be `LOCKED` (post via override) or `CLOSED` (no override). Status is resolved by `resolveFiscalPeriodStatus`.
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

- **Sales** → posts AR + Revenue + (conditionally) COGS via `PostVoucherUseCase` with the `SalesInvoiceStrategy`.
- **Purchases** → posts Inventory/Expense + AP via the `PurchaseInvoiceStrategy`.
- **Inventory** → Opening Stock can post an inventory-valuation voucher when Accounting is enabled. COGS auto-posting from sales delivery is **not yet implemented** — Sales posts COGS directly today.
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
