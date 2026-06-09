# 194 — Settlement: approval-boundary preservation, two-voucher decision, and pay-later dialog

**Date:** 2026-06-09
**Agent:** Claude (Opus 4.8)
**Branch:** `feat/overpayment-credit-balance`
**Related:** [Task 186](../tasks/186-shared-settlement-panel-and-overpayment.md) (shared settlement panel + over-payment), [Task 184 Finding 5](../tasks/184-posting-qa-findings.md) (record-payment button mis-wire), report [193](./193-sales-invoice-settlement-placement.md) (settlement placement).

## Origin

Settlement QA on a real tenant (`cmp_mpqs3ny8_sat8rj`, Financial Approval **ON**). Mahmud reported: paid invoices "always recorded as deferred — the payment never reaches the ledger." Investigation traced this to the approval boundary, not the settlement engine, and surfaced two adjacent issues (a #193 regression and the long-known pay-later button mis-wire).

## What changed (6 commits)

| Commit | Summary |
|---|---|
| `86ba56b9` | **#193 regression fix.** The Post handlers still drove the retired settlement-modal flow: for CASH_FULL/MULTI they called `setShowSettlement(true)` (rendered nothing post-#193) and **reset `settlementRows` to an empty account**, wiping the user's entry so nothing posted. Both SI/PI Post handlers now post directly from the inline `SettlementBlock`, gated on its `onValidityChange` validity. |
| `2e677172` | **Dead-code removal.** Deleted the now-unreachable `renderSettlementCard` + `showSettlement`/`settlementExpanded` (SI) and the two legacy `showSettlement` cards (PI). |
| `ae295800` | **Settlement preserved across the approval boundary (the root cause).** See below. |
| `54a7e07a` | **Docs + Approval Center preview.** Two-voucher decision recorded; Approval Center shows a per-row "Will post PAID / Partial / On credit" preview. |
| `8585e246` | **Pay-later Record Payment/Receipt dialog (Task 184 Finding 5).** See below. |
| (`4673bf9c`) | (earlier in session) i18n sweep for SettlementBlock + scaffold (EN/AR/TR). |

### Root cause: settlement lost across the approval boundary (`ae295800`)

When Financial Approval is enabled, posting a paid invoice throws `APPROVAL_REQUIRED`; the whole posting (invoice voucher **and** receipt/payment voucher) rolls back and the invoice is parked `PENDING_APPROVAL`. The entered settlement was **discarded** — so on later approval the invoice posted on credit and the payment was gone.

Fix: preserve the entered settlement on the parked invoice and replay it on approve.
- New domain-local `pendingSettlement` on `SalesInvoice` + `PurchaseInvoice` (structurally compatible with the application `SettlementInput`; no application→domain import). Round-tripped via `toJSON`/`fromJSON`; Firestore-safe through the mappers' `stripUndefinedDeep`.
- `Post{Sales,Purchase}InvoiceUseCase`: stores `pendingSettlement` when parking (non-DEFERRED only); clears it (`= null`) on any successful post so it can never replay twice.
- `Approve{Sales,Purchase}InvoiceUseCase`: replays `pendingSettlement` — an explicit `settlementInput` on the approval request still wins; otherwise the stored intent is used.
- No effect when approval is off (settlement applies immediately) or for DEFERRED (nothing stored).

### Two-voucher model — decision recorded (`54a7e07a`)

Mahmud asked whether payment-at-posting should be one combined voucher (`Dr A/R partial + Dr Cash / Cr Revenue`). The agreed/implemented model (Task 186) is the **two-voucher roundtrip**: invoice voucher (`Dr A/R / Cr Revenue`) + a **separate linked** receipt/payment voucher (`Dr Cash / Cr A/R`). Both yield identical net balances; two-voucher was chosen for **timing symmetry** (a posted voucher is immutable, so pay-later must be its own voucher — combined would make the same event post differently by timing), standard Sales/Cash-Receipts journal separation, clean bank reconciliation, clean reversal, and clean partial/over-payment. "One transaction" is a **UI grouping** concern, not a posting change. Documented in `docs/architecture/sales.md` ("Voucher model: two-voucher roundtrip") and mirrored in `purchases.md`.

### Pay-later Record Payment/Receipt dialog (`8585e246`, Task 184 Finding 5)

The old "Create Payment/Receipt" button navigated into the generic Accounting voucher editor, which ignored `sourceType`/`sourceId` → a blank voucher that never reconciled to the invoice, and was unreachable for users without the Accounting module. Replaced with a shared on-page `RecordPaymentDialog`:
- Pre-fills party + outstanding; amount defaults to outstanding (partial allowed); method auto-fills the cash/bank account (overridable); uses shared `DatePicker`/`AccountSelector`.
- Calls the existing `recordPayment` endpoint (posts the linked receipt/payment voucher via the same two-voucher engine; reconciles `outstanding`/`paymentStatus`). Stays on the invoice page.
- Over-payment aware (hint when allowed, block + message when not).
- Backend untouched (endpoint + use case already existed, 0 prior UI call sites). PI payload type extended to the full field set; EN/AR/TR strings added.

## Accounting boundary

Posting/tax/AR-AP/inventory/ledger semantics are **unchanged**: the settlement payload shape and the four settlement engines are untouched. New behavior is limited to (a) *preserving and replaying* an already-valid settlement across approval, and (b) *invoking* the existing record-payment use case from the UI. Domain entities stay free of application imports (verified by `AccountingBoundary`/`PostingAuthority` architecture tests).

## Files touched

Backend: `domain/sales/entities/SalesInvoice.ts`, `domain/purchases/entities/PurchaseInvoice.ts`, `application/sales/use-cases/SalesInvoiceUseCases.ts`, `application/purchases/use-cases/PurchaseInvoiceUseCases.ts`, `api/controllers/accounting/VoucherController.ts`, tests (`SalesInvoiceSettlementPosting`, `SalesPostingUseCases`, `PurchaseInvoiceSettlementPosting`).
Frontend: `components/shared/settlement/RecordPaymentDialog.tsx` (new), `modules/sales/pages/SalesInvoiceDetailPage.tsx`, `modules/purchases/pages/PurchaseInvoiceDetailPage.tsx`, `modules/accounting/pages/ApprovalsPage.tsx`, `api/accountingApi.ts`, `api/purchasesApi.ts`, `locales/{en,ar,tr}/common.json`.
Docs: `docs/architecture/sales.md`, `docs/architecture/purchases.md`.

## Verification

- Backend: `npm --prefix backend run build` clean. 50 settlement/posting/payment-sync tests + 28 `AccountingBoundary`/`PostingAuthority`/settings-architecture tests green. New tests: sales parking-preserves-settlement, sales + purchases approve-replays-and-clears.
- Frontend: `npm --prefix frontend run typecheck` + production build green.

## Manual QA

**A — Approval tenant (Financial Approval ON):**
1. New Sales Invoice → 1 line $1000 → Settlement = **Fully paid** + cash account → **Post**.
2. ✅ Invoice parks as **Pending Approval** (payment preserved, not lost).
3. **Accounting → Approval Center → Source Documents** tab → ✅ row shows **"Will post PAID — 1000"**.
4. Approve → ✅ invoice = **POSTED + PAID**, AR settled, a receipt voucher exists in the ledger.

**B — Approval off (immediate):** turn Financial Approval off → repeat step 1 → ✅ posts PAID immediately with the receipt voucher.

**C — Pay-later dialog (posted, unpaid invoice):**
1. Open a posted invoice with outstanding > 0 → **Create Receipt** (SI) / **Create Payment** (PI).
2. ✅ Dialog pre-fills party + outstanding; amount defaults to the balance.
3. Enter a **partial** amount → Record → ✅ status **PARTIALLY_PAID**, balance reduced, linked RV/PV voucher created.
4. Pay the remainder → ✅ status **PAID**, outstanding 0.
5. As a user **without** the Accounting module → ✅ the dialog still works (no navigation into Accounting).

**D — Over-payment (flag on):** record more than outstanding → ✅ hint "extra becomes a {customer/vendor} credit"; party AR/AP goes negative. Flag off → ✅ blocked with a clear message.

## Follow-ups (not in this report)

- Show **payment history** on the invoice page (the `getPaymentHistory` API already exists).
- Optional: group the invoice voucher + its linked receipt in the UI as one "what posted" panel (the presentation answer to the combined-voucher question).
