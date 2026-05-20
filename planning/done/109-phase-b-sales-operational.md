# 109 — Phase B: Sales Operational Features

**Status:** ✅ COMPLETE (code + docs; live browser QA deferred — see below)
**Date:** 2026-05-20
**Branch:** `feat/phase-a-sales-master-data`
**Plan:** [sales-and-purchases-completion-roadmap.md](../tasks/sales-and-purchases-completion-roadmap.md) — Phase B
**Predecessor:** Task 108 (Phase A — master data & pricing)

## Goal

Build the day-to-day sales operational layer on top of the Phase A master data: quotations, credit control, promotions, and delivery scheduling. This is what a salesperson actually does before the accountant ever sees an invoice.

## What shipped — by sub-phase

### B.0 — Commission auto-accrual
`SalesController.postSI` / `createAndPostSI` / `updateAndPostSI` now call `AccrueCommissionForInvoiceUseCase` after a successful post. **Non-fatal** — a commission failure is logged and never fails the invoice-post response. Closes the Phase A follow-up.

### B.1 — Quotations
- `Quote` entity — header + lines, lifecycle `DRAFT → SENT → ACCEPTED → REJECTED / EXPIRED / CONVERTED`, `version` numbering, `originQuoteId` linking revisions, `validUntil` expiry, state-transition methods.
- `QuoteUseCases` — CRUD, Send/Accept/Reject, `ReviseQuoteUseCase` (clones to version+1, marks the old quote REJECTED), `ConvertQuoteToSalesOrderUseCase` / `ConvertQuoteToSalesInvoiceUseCase` (require ACCEPTED status, delegate to the existing SO/SI create use cases).
- Repository + Firestore impl.

### B.2 — Credit-limit enforcement
- `CreditCheckService` — `currentExposure` = Σ `outstandingAmountBase` of the customer's POSTED invoices; `projectedExposure = currentExposure + orderAmount`.
- `ConfirmSalesOrderUseCase` rebuilt — applies the customer's `creditHoldPolicy`: `NONE` = no enforcement, `WARN` = confirm + flag, `BLOCK` = throw `CreditLimitExceededError` unless `{ override: { reason } }` is supplied (which persists a `CreditOverride` audit record). Customers with no `creditLimit` are never enforced.
- New `CreditOverride` entity + repository, `CreditLimitExceededError`.

### B.3 — Promotions engine
- `PromotionRule` entity — `BUY_X_GET_Y` and `THRESHOLD_DISCOUNT`, scope ALL/ITEMS/CATEGORIES, date validity, priority.
- `PromotionApplicationService` — pure evaluator. **Manual line discounts always take precedence** over auto threshold discounts. At most one of each mechanic per line.
- `PromotionUseCases` — CRUD + `EvaluatePromotionsUseCase`.

### B.4 — Delivery scheduling + operational API
- `promisedDate` added to `SalesOrder` + `DeliveryNote`.
- `GetAgedBacklogUseCase` — lists CONFIRMED / PARTIALLY_DELIVERED orders past their `promisedDate` with `daysOverdue`.
- `SalesOperationalController` (24 handlers) + routes under `/tenant/sales/{quotes,promotions,credit-overrides,aged-backlog}`.

### B.5 — Frontend
- `QuotationsPage` (list) + `QuotationDetailPage` (status-driven action buttons: Send / Accept / Reject / Revise / Convert).
- `PromotionsPage` — promotion-rule admin.
- `AgedBacklogPage` — overdue-orders report.
- SO detail page: credit-override modal when a BLOCK error is returned; WARN banner on the WARN outcome.
- `promisedDate` field added to SO + DN detail forms.
- New `salesOperationalApi` client.

### B.6 — Docs
- New architecture docs: `quotations.md`, `credit-control.md`, `promotions.md`; `sales.md` updated.
- User guides: `quotations.md`, `credit-limits.md`, `promotions.md`.

## Audit catches (fixed during review)

- SO detail page WARN banner read `creditCheck.limit`; the backend field is `creditLimit`. Fixed.

## Verification

- `backend` + `frontend`: `npx tsc --noEmit` → exit 0
- New backend tests — **56 across 4 suites, all passing**: `QuoteLifecycle` (12), `CreditLimitEnforcement` (12), `PromotionEngine` (22), `AgedBacklog` (10).
- Full backend suite: **1153 passing**, 18 skipped, 3 failing — the 3 are the pre-existing `SendChatMessageUseCase` AI-credit failures carried from before Phase A. **Zero regressions from Phase B.**

## Manual QA gate (deferred — needs human verification)

Per the user's instruction, phase QA gates are not being run by an agent. These need eventual live verification:
1. Quote → Send → Accept → Convert-to-Order; verify the SO carries the quote's prices.
2. Revise a SENT quote → v2 is DRAFT, old quote is REJECTED.
3. Set a customer creditLimit + BLOCK policy; confirm an over-limit SO → blocked; override with a reason → confirms + audit record created.
4. Configure a buy-5-get-1 promotion; evaluate an order with qty 5 → free line suggested.
5. Set a past `promisedDate` on a confirmed SO → it appears in the Aged Backlog.

## Out of scope (follow-ups)

- **Promotion auto-application** — `PromotionApplicationService` + `EvaluatePromotionsUseCase` are built and tested, but promotions are **not yet auto-invoked inside SO/SI creation**. A caller must hit `POST /sales/promotions/evaluate` explicitly. Wiring it into the SO/SI create flow (apply free-goods + discounts automatically) is a follow-up.
- **Credit check at direct-SI creation** — enforcement is at SO confirm only. A direct Sales Invoice created without an SO is not credit-checked yet.
- **Backorder / partial-fulfillment UX** — the backend already supports partial delivery; a dedicated frontend workflow (backorder remaining / on-hold) was not built in B.5. Deferred.
- **Quote numbering** — uses a `Q-<timestamp>-<random>` fallback; `SalesSettings` has no quote-number sequence. A proper sequence (mirroring SO/SI/DN numbering) is a follow-up.
- **ReviseQuoteUseCase** — cleanly handles a SENT quote only (it force-rejects the prior version via `markRejected`, which requires SENT). Revising from other statuses throws a less-clear entity error. An explicit guard would improve the message.
- 3 pre-existing `SendChatMessageUseCase` test failures — unrelated; already flagged for a separate fix.

## Next task

**Phase C — Sales finance & reporting:** AR Aging report, Customer Statements, Customer Ledger, sales reports (by customer / item / salesperson), backend P&L, inventory valuation as-of-date. See the roadmap.
