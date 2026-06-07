# 177 — SI & PI detail page redesign (compact layout, shared table, fixed settlement card, posted view, error/warning UX)

**Status:** Open
**Owner:** TBD (UI agent)
**Origin:** Mahmud direction, 2026-06-06 — after a Sales/Purchases functional QA pass closed all math, posting, tax-account, and approval bugs on SI/PI, the **visual** layer of the two detail pages remains the last blocker before SI/PI can be called shippable.
**Scope:** Both `SalesInvoiceDetailPage.tsx` and `PurchaseInvoiceDetailPage.tsx`. Other voucher pages (SR / PR / SO) are out of scope here — they pick up the same patterns via [Task 176](./176-unified-line-items-table-skins.md).
**Predecessors:**
- [Task 176](./176-unified-line-items-table-skins.md) — Unified line-items table (one component, two skins). This task assumes the shared `ClassicLineItemsTable` (rename: `LineItemsTable`) is the only table component.
- [Task 169 Finding B](./169-audit-history-empty-and-flexible-label.md) — "Flexible" badge column label clean-up; in scope for the posted-view header here.

## Why now

Functional QA on SI/PI is essentially done:
- Inclusive/exclusive math correct on both ([commit e89611e1](https://example/), [Task 168](./168-si-total-mismatch-critical.md)).
- Line Total column = Net + Tax on both (this session).
- Tax-account-missing now throws `AccountMappingError` with the tax-code label, not `INFRA_999` (this session).
- Approval flow (Stage 2b) parks unapproved invoices and posts through the Approval Center.

The only thing actively blocking sign-off is that **the pages look broken**: layout is loose, settlement and posted views are unusable, and error vs warning are visually identical. This task fixes that.

## Requirements (binding)

### R1 — Compact, grouped layout
- The current page is too loose: each card is overly tall, vertical rhythm doesn't read, the eye can't take it in at a glance.
- Group fields by purpose, not by historical addition order. Recommended groups:
  - **Identification** (number, status chip, dates, currency / exchange rate)
  - **Parties** (customer/vendor, salesperson, payment terms)
  - **Line items** (the shared table)
  - **Charges & discounts** (additions, doc-level discount, freight)
  - **Totals** (subtotal, tax, grand total, base-currency mirror)
  - **Settlement** (mode, methods, allocation)
  - **Attachments** (queue + uploaded)
  - **Approval & audit** (status banner, history)
- Reduce card padding and vertical spacing across the page so the whole document fits a typical laptop viewport without scrolling away the totals.
- No new design language. Use existing tokens, density of `ClassicLineItemsTable` rows (h-9) as the baseline.

### R2 — Use the shared line-items table everywhere on these pages
- The editable line table must be `ClassicLineItemsTable` (already in PI). Migrate SI's editable table to it in this task; the rest of Task 176's voucher list (SO/SR/PR/GVR) is a separate session.
- The **read-only** "Lines" card shown on posted invoices (currently a bespoke `<table>` in both SI and PI) must also use the same shared component in a read-only variant (no Add row, no inline edits). One source of truth for line rendering across edit and posted views.

### R3 — Fix the Settlement card
- Currently overflows / is partially hidden at the bottom of the page.
- Move Settlement into its own card with predictable vertical position (above Attachments, below Totals) and make it collapsible by default for documents with mode = `DEFERRED` so the page stays compact.
- For `CASH_FULL` / `MULTI`, the Settlement card is expanded by default so the user sees what's recorded.
- The Settlement allocation grid must be horizontally scrollable inside the card — never let it push the page width.

### R4 — Posted invoice view
- The posted view currently reuses the editable layout with disabled inputs. That's why it "looks like shit" — inputs are framed and gridded but inert, totals float oddly, action buttons sit in odd places.
- Build a dedicated **posted view** treatment:
  - No input frames. Values render as plain text in a denser grid.
  - Top banner shows: status chip, voucher link (open the underlying ledger voucher), `Edit Policy` (the renamed FLEXIBLE/RIGID column per Task 169 Finding B), period-lock status, and **approval** (who/when).
  - Bottom action bar shows only the legal actions for a POSTED document (Reverse, Pay/Receive, Send, Clone, Print, etc.). Hide Save/Cancel/Discard entirely — they don't apply.
  - The audit trail's empty Field/Before/After is a separate task ([Task 169 Finding A](./169-audit-history-empty-and-flexible-label.md)); this task only ensures the History button placement makes sense in the posted view.

### R5 — Error vs Warning UX
- The shared `ErrorModal` always renders a red icon + bold "Critical Error" title regardless of severity.
- Drive the title and icon from `error.severity`:
  - `INFO` → blue info icon, "Information"
  - `WARNING` → amber triangle, "Warning"
  - `ERROR` → red circle, "Error"
  - `CRITICAL` → red circle filled, "Critical Error" (kept for true infra failures)
- The new `AccountMappingError` and similar business errors (`severity: ERROR`) must surface as **Error**, not Critical Error. This is the dialog the user sees today when posting fails — it should not look like the server crashed.
- A warning-class case to handle visibly: customer credit limit close to threshold, period-lock soft-override prompt.

### R6 — Phantom empty rows on SI line table
- The SI line-items table renders ~10 trailing empty rows (`1 — — 0.00 No Discount 0 No Tax —`). The row mapper is iterating past actual lines. Confirm the fix is structural (`form.lines.map` should not pad), not just a CSS hide.

### R7 — Totals strip alignment
- The bottom Subtotal / Tax / Grand Total / base-currency mirrors are wrapping awkwardly at typical viewport widths. They must align right, use a single horizontal strip on desktop, and stack cleanly on narrow widths.

## Out of scope

- SO / SR / PR detail page redesign (separate task; same patterns will be ported once SI/PI sign off).
- GVR migration to `ClassicLineItemsTable` (Task 176).
- Audit trail field-level diff for CREATE/POST events (Task 169 Finding A).
- Any change to posting math, approval logic, tax-account resolution, period-lock policy, settlement engine, or backend contracts. **Visual only.**
- Generic Voucher Renderer changes.
- Mobile-specific layouts beyond "doesn't break at narrow widths" — full mobile polish is a later pass.

## Definition of done

- SI detail page (draft + posted) and PI detail page (draft + posted) render compactly, with grouped cards, and use the shared `ClassicLineItemsTable` (or `LineItemsTable` post-rename) for both editable and read-only line rendering.
- Settlement card placement + collapse behaviour matches R3; allocation grid is contained.
- Posted-invoice view matches R4 (plain values, no disabled inputs, clean action bar).
- `ErrorModal` renders severity-appropriate icon + title for INFO / WARNING / ERROR / CRITICAL.
- SI phantom empty rows are gone.
- Frontend `npx tsc --noEmit` clean. `npm run build` clean.
- No regression in: posting flow (Stage 2b approval), inclusive/exclusive math, tax-account error surfacing, period-lock override, settlement on save.
- `docs/user-guide/sales/sales-invoice.md` + `docs/user-guide/purchases/purchase-invoice.md` updated with screenshots of the new layout.
- Done report `planning/done/177-si-pi-detail-page-redesign.md` with QA script covering: create draft, save, post (with approval), view posted, error (no tax account), warning (credit close to limit), settlement DEFERRED vs CASH_FULL, posted view actions.

## Notes for the next agent

- The user has been clear all session that **UI changes are not Claude's responsibility** in this conversation. This task was filed by Claude after a math/posting QA session and reflects Mahmud's punch list — talk to Mahmud for design preferences (he leans toward Apex-inspired Classic density).
- The PI form was just migrated to `ClassicLineItemsTable` in commit `8d3e8bc4`. SI is the next migration target; piggyback that on this task.
- Don't try to do SO/SR/PR in the same pass — Task 176's "one voucher per session" rule applies. SI + PI is one session because the two pages share so much visual grammar.
- Use the same severity → icon/title map in `ErrorModal` everywhere; don't fork the modal.
