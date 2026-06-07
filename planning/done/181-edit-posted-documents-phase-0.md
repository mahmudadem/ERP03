# 181 — Editing posted documents, Phase 0 (non-financial fields editable on POSTED)

**Status:** ✅ Done
**Date:** 2026-06-07
**Branch:** `feat/init-wizard-forms-selection`
**Task:** [179 — Editing posted documents](../tasks/179-editing-posted-documents.md), Phase 0.

## Why

QA surfaced that a POSTED Sales/Purchase Invoice could not be edited **at all** — not even its notes — because both update use cases hard-blocked anything except DRAFT (`if (status !== 'DRAFT') throw`). The product decision (see Task 179) is: a posted invoice's **paperwork** is always editable; its **money** obeys the accounting edit mode. Phase 0 builds the foundation: non-financial fields editable on POSTED, every financial change refused with a clear error (no silent in-place rewrite that would desync the document from its ledger voucher).

Phase 0 stops short of the layered Mode A/B resolver, reverse, and amend — those are Phases 1–6. The net effect today is "Mode B minus the reverse button": posted invoices are non-financial-editable, financial-locked everywhere. Safe default.

## What landed

**Shared guard (no per-module duplication):**
- [`PostedDocumentEditGuard.ts`](../../backend/src/application/common/services/PostedDocumentEditGuard.ts) — `assertPostedNonFinancialEditOnly({ status, entityLabel, changedFinancialFields })`, plus pure helpers `scalarChanged` and `lineSignaturesEqual`.

**SI + PI update use cases:**
- On POSTED, detect which financial fields the payload would actually change (scalars by value compare; lines/charges by an order-independent financial signature using effective `incoming ?? existing` values).
- If any financial field changed → throw `POSTED_FINANCIAL_EDIT_BLOCKED` (`ACC_011`) naming the fields and pointing to reverse/amend.
- If none → apply only the non-financial fields. Financial apply blocks (party, date, currency, FX, lines, charges) are gated to `isDraft` so a posted document's amounts are never re-touched here.
- DRAFT behaviour unchanged; PENDING_APPROVAL / CANCELLED / REVERSED stay blocked as before.

**PI audit gap closed (it never had update audit):**
- Added `PURCHASE_INVOICE` to `RecordChangeEntityType`.
- Wired `RecordChangeService` into `UpdatePurchaseInvoiceUseCase` + the `updatePI` controller endpoint (added `getUserEmail` to `PurchaseController`). PI edits now record a before/after audit row, matching SI.

**Error code:** `ErrorCode.POSTED_FINANCIAL_EDIT_BLOCKED = 'ACC_011'`.

## Non-financial vs financial split (as implemented)

| | Non-financial (editable on POSTED) | Financial (DRAFT only) |
|---|---|---|
| SI | salesperson, customerInvoiceNumber, dueDate, notes | customer, invoiceDate, currency, exchangeRate, lines, charges |
| PI | vendorInvoiceNumber, dueDate, notes | vendor, invoiceDate, currency, exchangeRate, lines |

## Verification

- `backend && npx tsc --noEmit` clean.
- New `PostedDocumentEditGuard.test.ts` — 9 tests, green.
- Sales + Purchases + audit suites — **322 tests pass** (1 unrelated suite, `RecurringInvoiceUseCases.test.ts`, fails to parse due to the `uuid` ESM/Jest transform issue — pre-existing, not in this changeset).
- Posting-authority + gateway + rejection-contract + guard suites — **28 tests pass**.

## Known limitations (by design — later phases of Task 179)

- No UI yet exposes posted-invoice editing — Task 177 owns the affordances + severity-driven ErrorModal so this surfaces as "Error" not "Critical Error".
- No Mode A/B resolver, no reverse button, no amend-and-repost. Financial corrections still require creating a Return (credit note) manually.
- Edge-case guards (#6–#16 in Task 179: settlement/paid, period-lock re-post, stock re-apply, document relationships, concurrency) are not in Phase 0 — they arrive with the financial-edit phases that actually re-post.

## QA script (when UI lands, or via API now)

1. Post a Sales Invoice. Open it. Change **notes** / **salesperson** → save.
   - Expected: saves; status stays POSTED; an audit row records the change.
2. On the same posted SI, attempt to change a **line qty** or **currency** via the update API.
   - Expected: `POSTED_FINANCIAL_EDIT_BLOCKED` — "Cannot change financial fields on a posted sales invoice: lines. Reverse the document or submit an approved amendment instead."
3. Repeat 1–2 for a Purchase Invoice (notes/vendorInvoiceNumber editable; lines/vendor blocked). Confirm the PI edit now appears in Change History (previously PI had no update audit at all).
4. Confirm a DRAFT invoice still edits fully (no regression).
