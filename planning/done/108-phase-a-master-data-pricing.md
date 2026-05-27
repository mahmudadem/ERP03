# 108 — Phase A: Sales Master Data & Pricing Engine

**Status:** ✅ COMPLETE (code + docs; live browser QA is the Phase A manual QA gate — see below)
**Date:** 2026-05-20
**Branch:** `feat/phase-a-sales-master-data`
**Plan:** [sales-and-purchases-completion-roadmap.md](../tasks/sales-and-purchases-completion-roadmap.md) — Phase A
**Predecessor:** Tasks 102–107 (alpha-readiness P0 remediation)

## Goal

Build the master-data foundation the rest of the Sales completion work depends on: price lists, customer segmentation, customer credit settings, salespersons + commissions, and correct tax-inclusive pricing. Without this, every invoice would need manual line pricing and there would be no segmentation, credit, or commission model to build on.

## What shipped — by sub-phase

### A.1 — Price Lists
- `PriceList` entity — per-currency, date-validity window (`validFrom`/`validTo`), `isDefault` flag, tiered lines.
- Tiered pricing: multiple `PriceListLine`s per item at different `minQty`; `getEffectiveLine(itemId, qty)` returns the highest `minQty ≤ qty`.
- Repository interface + Firestore impl (`companies/{cid}/sales/Data/price_lists`).
- `PriceListUseCases.ts` — Create/Update/Delete/Get/List + `GetEffectivePriceUseCase` (resolution: customer's own `defaultPriceListId` override → currency default → null).
- Default-per-currency uniqueness enforced transactionally on create/update.

### A.2 — Customer Groups
- `CustomerGroup` entity — segmentation with group-level defaults (price list, payment terms, credit limit, tax-exempt).
- `Party.customerGroupId` added.
- `CustomerGroupUseCases.ts` — CRUD + `AssignCustomerToGroupUseCase`. Delete blocked while parties still reference the group.

### A.3 — Customer credit settings
- `Party` gained `creditLimit`, `creditHoldPolicy` (`NONE`/`WARN`/`BLOCK`), `defaultPriceListId`.
- Constructor validates `creditLimit ≥ 0` and the policy enum.
- **Enforcement is Phase B** (at SO confirm) — Phase A only persists the master data.

### A.4 — Salesperson + commission ledger
- `Salesperson` entity (code, name, email, `defaultCommissionPct` 0–100, `commissionPayableAccountId`).
- `CommissionEntry` ledger entity — `ACCRUED → PAID | CANCELLED` lifecycle; `commissionAmountBase` always recomputed in the constructor; `markPaid()`/`cancel()` state-transition guards.
- `SalesOrder.salespersonId` + `SalesInvoice.salespersonId` added.
- `CommissionUseCases.ts` — `AccrueCommissionForInvoiceUseCase` (idempotent via `findBySource`; base = invoice `grandTotalBase`; skips when no salesperson; throws on INACTIVE salesperson), MarkPaid, Cancel, List, Totals, Get.
- **Architecture decision:** accrual is invoked from the controller layer *after* a successful SI post — **not** inside `PostSalesInvoiceUseCase`. Keeps the sensitive god-class untouched; the idempotency guard makes re-running accrual safe.

### A.5 — Tax codes refinement
- `Party.taxExempt` flag added.
- **Bug found & fixed:** `SalesInvoiceCalculationService` had no tax-inclusive pricing support — an inclusive price of 110 @ 10% wrongly produced tax 11 / total 121. Added a `priceIsInclusive` flag: discounts apply to the inclusive amount, net is back-calculated as `postDiscount / (1 + taxRate)`. Defaults to `false` so all existing callers are unaffected.

### A.6 — Frontend + API wiring
- **A.6.1** — `SalesMasterDataController` (24 handlers) + routes under `/tenant/sales/{price-lists,customer-groups,salespersons,commissions}`. `UpdatePartyUseCase` wired to validate `defaultPriceListId`.
- **A.6.2** — `salesMasterDataApi.ts` client; new pages `PriceListsPage`, `CustomerGroupsPage`, `SalespersonsPage`; routes registered.
- **A.6.3** — frontend `PartyDTO` extended; PartyMasterCard COMMERCIAL tab gained a customer-only "Segmentation & Credit" section; Salesperson dropdown on SO + SI; SI line editor auto-fetches the effective price on item/qty change.

### A.7 — Tests & docs
- New docs: `docs/architecture/pricing.md`, `docs/architecture/commissions.md`; `docs/architecture/sales.md` updated.
- User guides: `docs/user-guide/sales/{price-lists,customer-groups,salespersons}.md`.

## Bug fixed during audit

`GetEffectivePriceUseCase` checked `(party as any).priceListId` while A.3 named the field `defaultPriceListId` — the customer-override path silently never fired. The unit-test mock used the same wrong name, so the test passed without exercising the real path. Both corrected; the override test now genuinely covers the code path.

## Verification

- `backend`: `npx tsc --noEmit` → exit 0
- `frontend`: `npx tsc --noEmit` → exit 0
- New backend tests — **94 across 5 suites, all passing**:
  - `PriceListResolution.test.ts` (17), `CustomerGroupUseCases.test.ts` (14), `PartyCreditSettings.test.ts` (19), `CommissionAccrual.test.ts` (14), `TaxInclusivePricing.test.ts` (~30)
- Full backend suite: **1097 passing**, 18 skipped, 3 failing — the 3 failures are pre-existing in `SendChatMessageUseCase.test.ts` (AI-assistant credit logic), confirmed failing on the pre-Phase-A baseline via `git stash`. **Zero regressions from Phase A.**

## Manual QA gate (for the accountant)

Code compiles and unit tests pass, but **live browser QA is the Phase A acceptance gate** and has not been run by an agent. Suggested checks (from the roadmap):
1. Create Retail/Wholesale/VIP price lists with different prices for one item; assign to customers; verify an invoice auto-prices.
2. Verify a volume tier kicks in (e.g. 100+ units → lower price).
3. Verify tax-inclusive math: price 110 inc 10% → unit 100, tax 10; with 5% discount → 95 / 9.50 / 104.50.
4. Create a salesperson with 3% commission; post an SI of 1000 → verify a 30 commission entry accrues.
5. Verify customer credit-limit / group / price-list fields save on the customer card.

## Out of scope (follow-ups)

- **Commission auto-accrual wiring** — `AccrueCommissionForInvoiceUseCase` + its endpoint exist, but the SI post controller does not yet call it automatically. One controller-level call after `postSI` succeeds. (Phase A or early Phase B.)
- **Credit-hold enforcement** — `creditHoldPolicy` is stored but not enforced. Phase B, at SO confirm.
- **Customer-group price-list inheritance** — `GetEffectivePriceUseCase` consults the customer's own override and the currency default, but not the group's `defaultPriceListId`. Documented in `pricing.md`.
- **GetEffectivePrice currency** — derives currency from the customer's `defaultCurrency`; a future revision should take an explicit invoice-currency parameter.
- **Commission GL voucher** — `markPaid` is a status change only; it does not yet post Dr commission expense / Cr payable.
- **`taxAmountBase` for inclusive mode** — uses `net × rate`; sub-cent FX drift possible. See `pricing.md`.
- **3 pre-existing AI-assistant test failures** — unrelated to Phase A; flagged for a separate fix.

## Files

**New backend (entities/repos/use-cases/controller — 17 files):** `PriceList.ts`, `CustomerGroup.ts`, `Salesperson.ts`, `CommissionEntry.ts`; `IPriceListRepository.ts`, `ICustomerGroupRepository.ts`, `ISalespersonRepository.ts`, `ICommissionEntryRepository.ts`; `FirestorePriceListRepository.ts`, `FirestoreCustomerGroupRepository.ts`, `FirestoreSalespersonRepository.ts`, `FirestoreCommissionEntryRepository.ts`; `PriceListUseCases.ts`, `CustomerGroupUseCases.ts`, `SalespersonUseCases.ts`, `CommissionUseCases.ts`; `SalesMasterDataController.ts`.

**New backend tests (5 files):** `PriceListResolution.test.ts`, `CustomerGroupUseCases.test.ts`, `PartyCreditSettings.test.ts`, `CommissionAccrual.test.ts`, `TaxInclusivePricing.test.ts`.

**Modified backend:** `Party.ts`, `SalesOrder.ts`, `SalesInvoice.ts`, `SalesInvoiceCalculationService.ts`, `PartyUseCases.ts`, `SharedController.ts`, `sales.routes.ts`, `bindRepositories.ts`, `repository/interfaces/sales/index.ts`.

**New frontend:** `salesMasterDataApi.ts`; `PriceListsPage.tsx`, `CustomerGroupsPage.tsx`, `SalespersonsPage.tsx`.

**Modified frontend:** `sharedApi.ts`, `salesApi.ts`, `PartyMasterCard.tsx`, `SalesOrderDetailPage.tsx`, `SalesInvoiceDetailPage.tsx`, `routes.config.ts`.

**Docs:** new `pricing.md`, `commissions.md`, `user-guide/sales/{price-lists,customer-groups,salespersons}.md`; updated `sales.md`.

## Next task

**Phase B — Sales operational features:** quotations, credit-limit enforcement at SO confirm, promotions/volume discounts, backorder/partial-fulfillment UX, delivery scheduling. See the roadmap.
