# 184 — Posting QA findings (PI/SI/SR smoke, 2026-06-08)

**Status:** Open
**Origin:** Mahmud manual QA during the Task 178 (SubledgerDocumentPoster) merge smoke.
**Important:** All findings here are **pre-existing**, NOT caused by the Task 178 refactor. Verified — each touches code the refactor did not modify; the double-prefix appears on vouchers posted days before the refactor (e.g. `PI-PI-00001` dated 05/06). The refactor (PR #5) is behavior-preserving and safe to merge independently of these.

---

## Finding 1 — Double voucher-number prefix (`PI-PI-00010`) 🟠

The **voucher** number doubles the document prefix. The invoice *list* shows `PI-00010` correctly, but the posted voucher reads `PI-PI-00010` (visible across the AP ledger).

**Cause:** voucher number is built as `` `PI-${pi.invoiceNumber}` `` in [PurchaseInvoiceUseCases.ts](../../backend/src/application/purchases/use-cases/PurchaseInvoiceUseCases.ts), but `pi.invoiceNumber` already carries the tenant's `piNumberPrefix` ("PI-") from `generateDocumentNumber(settings, 'PI')`. So the hardcoded `PI-` in the voucherNo is applied on top of the already-prefixed number.

**Same pattern on:** SI (`` `SI-${si.invoiceNumber}` ``) and SR (`` `SR-REV-${returnNumber}` ``, `` `SR-COGS-...` ``). Check each tenant prefix. Note: unit tests use bare invoice numbers ("00001"), so the bug is invisible in tests — only real tenants with a configured prefix hit it.

**Fix options (pick one, apply consistently across SI/PI/SR + align tests):**
- (a) Make `voucherNo` just `pi.invoiceNumber` (it already has the prefix) → voucher = `PI-00010`. But COGS/REV/REF variants need a suffix scheme (e.g. `${invoiceNumber}-COGS`).
- (b) Strip the document prefix before re-applying, or build voucherNo from the bare sequence + a voucher-specific prefix.
- The COGS/revenue/refund split vouchers (SI-COGS, SR-REV, SR-COGS, SR-REF) need distinct numbers, so a pure "voucherNo = invoiceNumber" won't work for those — design a small consistent scheme.

## Finding 2 — Strict-mode "Post Invoice" button + misleading post feedback 🟠

When central approval is required (strict mode), clicking **Post Invoice** correctly parks the document as `PENDING_APPROVAL` (no ledger write — correct). But:
- The button label still reads **"Post Invoice"** ([PurchaseInvoiceDetailPage.tsx:1796](../../frontend/src/modules/purchases/pages/PurchaseInvoiceDetailPage.tsx:1796)) — should be context-aware ("Submit for Approval" / "Post & Submit") when approval is required.
- The success feedback implies the invoice **was posted** when it is actually only pending approval. (Locate the exact toast — the PI post handler at ~706 doesn't show one itself; likely a global success interceptor or the attachment-save toast. Confirm and make the message reflect the returned status: "Submitted for approval" vs "Posted".)

Frontend. Overlaps with [Task 167 source-doc-pending-approval-ux](./167-source-doc-pending-approval-ux.md) and [Task 177](./177-si-pi-detail-page-redesign.md). Same issue likely on the SI detail page.

## Finding 3 — Standalone Sales Return blocked in PERPETUAL mode 🟠 (product decision)

[SalesReturnUseCases.ts:519](../../backend/src/application/sales/use-cases/SalesReturnUseCases.ts:519): a DIRECT/standalone return throws *"Standalone returns require a source document in Real-Time Costing mode"* whenever `accountingMode === 'PERPETUAL'`.

The rationale is real — perpetual costing needs a **cost basis** for the returned goods, which a standalone return (no source invoice/DN) doesn't carry. But blocking it outright is over-restrictive: real-world perpetual systems **accept** standalone returns and value the returned inventory at the **current moving-average cost** (or an entered cost).

**Decision needed (product):** should perpetual allow standalone returns valued at current average cost? If yes, implement the cost-basis resolution for the standalone-perpetual path (and the COGS-reversal then uses that cost). If no, the error message should at least be clearer about why and what to do.

## Finding 4 — PI date: voucher date vs posted-at (needs clarification) 🟡

Screenshot: PI-00010 has **Invoice Date 2026-06-07** but **Posted At 6/8/2026**, both showing `02:14 AM`; the voucher is dated 07/06. Voucher-date = document date and posted-at = actual post time is *correct* behavior. The same `02:14 AM` on both, and the 6/7↔6/8 split, hint at a possible **timezone / midnight-rollover** display issue. **Pending Mahmud's clarification on what specifically reads wrong** before investigating date handling.

---

## Merge note

None of the above blocks merging the Task 178 refactor (PR #5) — they are pre-existing and the refactor is proven behavior-preserving (607 tests + exact-shape characterization). File/fix these independently.
