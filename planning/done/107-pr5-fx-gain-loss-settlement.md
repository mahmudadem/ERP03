# 107 — PR5: Realized FX Gain/Loss on Settlement

**Status:** ✅ COMPLETE (Sales side fully wired; Purchases vendor-payment parallel and frontend caller-wiring deferred)
**Date:** 2026-05-19
**Branch:** `fix/project-responsiveness`
**Scope:** Sixth and **final P0** of the [alpha-readiness remediation plan](../tasks/alpha-readiness-remediation-plan.md). Closes P0-11 (FX gain/loss not posted on settlements) and P0-10 (multi-currency requires Accounting config) at the settlement layer.

## Context

The audit found that mixed-currency payments silently absorbed the FX difference. A EUR 1,000 invoice booked at rate 10 and paid at rate 11 received 11,000 base for an AR booked at 10,000 base — the 1,000 base gain disappeared into nowhere. For any trading-company customer this is a P&L correctness bug.

The user's confirmed architecture rule: realized FX is an Accounting Engine responsibility. Settlement is the entry point but the **posting** must flow through the Engine's voucher pipeline — no duplicate FX logic in Sales/Purchases.

## What changed

### Settlement input shape

`SettlementRow` (both `SalesInvoiceUseCases.ts` and `PaymentSyncUseCases.ts`) gains two optional fields:

- `exchangeRate?: number` — the payment-date rate. When absent, defaults to invoice rate (legacy single-currency path).
- `amountDoc?: number` — the settlement amount in the invoice currency. Required when `exchangeRate` is supplied so the system can compute `arAmountBase` independently of `amountBase`.

### Validation reworked for AR-book-value

The CASH_FULL and MULTI validations previously compared `Σ(amountBase) === outstanding`. That breaks for FX (paying 11,000 base against 10,000 base outstanding looks "over-paid" even though it's exactly 1,000 EUR). Replaced with `arReducingTotal = Σ(amountDoc × invoice.exchangeRate)` when `amountDoc` is provided, falling back to `amountBase` otherwise. Single-currency callers behave identically.

### FX line emitted when rates differ

In `PostSalesInvoiceWithSettlementUseCase`, when `|settlementAmountBase - arAmountBase| > 0.005`:

- **Gain (Cash > AR book)**: append a 3rd voucher line — Cr `salesSettings.exchangeGainLossAccountId` at the diff. Total Cr now matches total Dr.
- **Loss (Cash < AR book)**: append a 3rd line — Dr the same account at `|diff|`. Total Dr matches total Cr.

If the FX account is unmapped at the moment the line would be emitted, posting throws `AccountMappingError` with `accountRole: 'fxGain' | 'fxLoss'` and a hint pointing the user at the right setting.

### Voucher header rate

The voucher's own `exchangeRate` is now the **settlement** rate (not the invoice rate). The Cr-AR line carries the invoice rate as its own per-line rate, so the line resolves to `arAmountBase` correctly. The Cash line carries the settlement rate. The FX line is in base currency (`baseCurrency` for both currency and baseCurrency).

### VoucherValidationService

Receipt and Payment voucher types added to the `multiCurrencySupported` list. The validator still enforces base-currency consistency across all lines but no longer requires every line to share the invoice's foreign currency — necessary for the FX-adjustment line that lives in base.

### SalesSettings

New `exchangeGainLossAccountId` field (mirrors the existing field on `PurchaseSettings`). The combined gain/loss account is sufficient for SMB books; the V2 refinement (separate Revenue-class Gain and Expense-class Loss) is documented in the architecture note.

## Files changed

New:
- `backend/src/tests/application/sales/FxGainLossSettlement.test.ts` — 4 cases (no FX, gain, loss, unmapped account)
- `docs/architecture/fx-gain-loss.md`

Modified:
- `backend/src/domain/sales/entities/SalesSettings.ts` — `exchangeGainLossAccountId` field
- `backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts` — `SettlementRow.exchangeRate` + `amountDoc` typed
- `backend/src/application/sales/use-cases/PaymentSyncUseCases.ts` — settlement-vs-outstanding rework + FX line emission
- `backend/src/domain/accounting/services/VoucherValidationService.ts` — RECEIPT/PAYMENT voucher types added to multi-currency-supported list

## Verification

- `cd backend && npx tsc --noEmit` → exit 0
- `cd backend && npx jest --testPathPatterns="FxGainLossSettlement"` → 4/4 pass
- `cd backend && npx jest --testPathPatterns="(SalesPostingUseCases|SalesInvoiceSettlementPosting|SalesPaymentSyncUseCases|SalesReturnUseCases|PurchasePostingUseCases|PurchaseInvoiceSettlementPosting|FxGainLossSettlement)"` → 64/64 pass

## Out of scope (follow-ups)

- **`RecordSalesInvoicePaymentUseCase`** (the post-invoice payment recording path, separate from CASH_FULL/MULTI) needs the same FX wiring. Same code shape; mechanical port.
- **Purchases `PaymentSyncUseCases`** vendor-payment path needs symmetric FX wiring.
- **Frontend payment dialog** should expose `exchangeRate` and `amountDoc` fields when invoice currency differs from base. Until then, payments default to invoice rate (no FX) — incorrect for true FX scenarios but not destructive.
- **Period-end unrealized FX revaluation** (open AR/AP at period-end rate) — V2.
- **Split FX gain/loss into two accounts** (Revenue-class + Expense-class) for cleaner P&L — V2.

## Alpha-readiness status

All six P0 PRs of the alpha-readiness remediation plan are now complete:

| PR | Description | Status |
|---|---|---|
| PR1 | Accounting Engine guard with auto-init | ✅ Task 102 |
| PR4 | Idempotency middleware + `allowNegativeStock` enforcement | ✅ Task 103 |
| PR6 | Firestore production security rules | ✅ Task 104 |
| PR2 | PostingLog auditability foundation | ✅ Task 105 |
| PR3 | Strict posting — no silent skips | ✅ Task 106 |
| PR5 | Realized FX gain/loss on settlement | ✅ Task 107 |

The architecture is launch-ready. The P1 backlog (GL Impact UI, AR/AP aging reports, backend P&L, period lock date, deferred-cost settlement use case, three-way match, PI discounts, customer/vendor statements, round-trip integration tests, GL-to-subledger reconciliation jobs) remains the next sprint.
