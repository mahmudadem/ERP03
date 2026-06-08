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

## Finding 3 — Standalone Sales Return blocked in PERPETUAL mode 🟠 → SOLUTION: opt-in flag + cost-resolution chain

[SalesReturnUseCases.ts:519](../../backend/src/application/sales/use-cases/SalesReturnUseCases.ts:519): a DIRECT/standalone return throws *"Standalone returns require a source document in Real-Time Costing mode"* whenever `accountingMode === 'PERPETUAL'`.

**Why the block exists (and why it's defensible):** a perpetual return must value the returned goods to debit Inventory and reverse COGS. A **linked** return inherits the cost from its source line ([SalesReturnUseCases.ts:624,656](../../backend/src/application/sales/use-cases/SalesReturnUseCases.ts:624) — `line.unitCostBase || sourceLine.unitCostBase || 0`, which correctly inherits even a deferred 0). A **standalone** return has no source line, so the code currently has no cost-resolution path → it blocks rather than guess. The block is therefore doing real protective work, not just being annoying. (This corrects an earlier note here that suggested simply allowing it at avg cost — the real need is a *cost-resolution path*, gated behind an explicit opt-in.)

**The legitimate need:** returns of goods sold **before the system existed** (or in another system) — there is no source document to link, but the customer is physically returning goods that must enter stock.

### Solution: an optional, off-by-default setting

Add an Inventory setting (next to the existing `allowDeferredCost`):

> **Allow direct sales returns with unknown cost** — *(default OFF)*
> When ON, a standalone sales return is permitted in perpetual costing even without a source invoice/delivery note. The returned goods are valued using the cost-resolution chain below. When OFF (default), standalone returns in perpetual stay blocked and the user must link a source document.

The setting's help text must explain the behaviour so the user can **predict** it (see "Behaviour to surface in the UI" below) — never a silent cost guess.

### Cost-resolution chain (when the flag is ON, standalone perpetual return)

Resolve the returned-unit cost in priority order:
1. **User-entered cost** on the return line — most accurate; use when the operator knows it.
2. **Current moving-average cost** of the item — the sensible default; adding a unit *at* the average leaves the average unchanged.
3. **Last-known purchase cost** — fallback when avg is 0 but purchase history exists.
4. **Zero** — only if nothing is known; **warn** the user it will lower the moving average (a 0-cost unit pollutes the average for every future sale).

### Correct journal entry (standalone return, avg cost $10, refund $15)

```
Dr Sales Returns (contra-revenue)   15     un-record the sale (price given back)
   Cr Cash / Customer Credit         15     the refund
Dr Inventory                         10     goods back at resolved cost (avg)
   Cr COGS                           10     restore the cost
```
Net P&L = −15 + 10 = **−$5** (the margin lost on the return). The inventory leg is valued at cost (avg); the credit side is **COGS**, not Accounts Payable (it is a return, not a purchase).

> Reporting nuance (smaller, separate choice): for truly off-system returns there is no matching original sale, so booking the refund to **Sales Returns (contra-revenue)** slightly distorts returns-vs-sales ratios. Some businesses prefer an **Adjustments** account instead. Make the refund-side account configurable or documented.

### Behaviour to surface in the UI (so the user can predict it)

When the flag is ON and the user creates a standalone perpetual return, show inline: "This item will enter stock at **<resolved cost> (source: entered / average / last-known / zero)**. Returns valued at zero cost will lower the item's average cost." Let them override the cost.

### Related gap — deferred-cost settlement: CONFIRMED MISSING → [Task 185](./185-deferred-cost-settlement.md)

Verified by code dig (2026-06-08): the deferred-cost mechanism can **defer** and **report** but never **settle**. `settledQty`/`unsettledQty` are set once at creation and never mutated; the `'SETTLEMENT'` movement type is never created (only a `default:` fallback); `GetUnsettledCostReportUseCase` is read-only; no use case recognizes deferred COGS. Consequence: sales made before their cost exists keep **COGS understated / inventory & profit overstated, indefinitely**. Filed as its own High-severity task [185](./185-deferred-cost-settlement.md).

## Finding 4 — PI date: voucher date vs posted-at (needs clarification) 🟡

Screenshot: PI-00010 has **Invoice Date 2026-06-07** but **Posted At 6/8/2026**, both showing `02:14 AM`; the voucher is dated 07/06. Voucher-date = document date and posted-at = actual post time is *correct* behavior. The same `02:14 AM` on both, and the 6/7↔6/8 split, hint at a possible **timezone / midnight-rollover** display issue. **Pending Mahmud's clarification on what specifically reads wrong** before investigating date handling.

---

## Merge note

None of the above blocks merging the Task 178 refactor (PR #5) — they are pre-existing and the refactor is proven behavior-preserving (607 tests + exact-shape characterization). File/fix these independently.
