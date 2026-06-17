# Task 233 — Inventory document forms on the scaffold + blocking-error UX

> Owner-requested during GP02 UI follow-up (2026-06-16). Pilot one page first (owner decision).
> **Order locked:** Transfers → Adjustments → Opening Stock.

## Goal

Bring the inventory **document** pages up to the Sales pattern:
- A **list page** styled like `SalesInvoicesListPage`, with a unified **New** button (same styling on list + form).
- A **form page** built on `DocumentDetailScaffold` (named sections + side rail), like `SalesInvoiceDetailPage`.
- Predictable **policy blocks** (negative stock) are caught **before** posting, with a way forward — never the critical error modal after the fact.

## Done in this session (prerequisite infra — task 5, COMPLETE + verified)

- `errorHandler.showOperationError(err)`: policy/validation blocks → non-alarming **warning**; system errors → blocking modal. Critical modal is no longer used for policy limits.
- `NegativeStockError` now renders **readable** item + warehouse labels (`ITEM-A — Item A`, `MAIN — Main Warehouse`) and carries structured `context`; all **4** throw sites in `RecordStockMovementUseCase` (incl. the GLOBAL transfer path that was first missed) pass labels. `AppError` gained optional `context`.
- i18n `errors.NEGATIVE_STOCK_BLOCKED` + `errorModal.*` chrome in en/ar/tr; `ErrorModal` title/button translated.
- Verified: backend build clean, `NegativeStockEnforcement` 7/7, frontend typecheck clean. Live-confirmed by owner that the modal/i18n work (the UUID label bug was the missed GLOBAL throw site, now fixed).

## Reference patterns (recon)

- Scaffold: `frontend/src/components/shared/DocumentDetailScaffold.tsx`. Key props: `title, subtitle, icon, backLabel, onBack, badges, newAction, headerTools, banner, sections{banner,control,header,lines,secondary,attachments,custom}, sideRail|railSections{info,readiness,settlement,totals}, footerSummary|footerActions|footerSections, isWindow`. Helper primitives exported (DocumentHeaderGrid/Field, DocumentRailFocus/KeyValueList/Checklist/Totals, DocumentFooterTotalsStrip, DocumentStatusBanner, etc.).
- Sales reference: list `frontend/src/modules/sales/pages/SalesInvoicesListPage.tsx`, detail `SalesInvoiceDetailPage.tsx`.
- Current inventory pages (combined list+form, NOT on scaffold): `OpeningStockPage.tsx` (845 lines), `StockTransfersPage.tsx` (617), `StockAdjustmentPage.tsx` (339). Routes: `/inventory/transfers`, `/inventory/adjustments`, `/inventory/opening-stock` in `frontend/src/router/routes.config.ts`.

## Transfers rebuild (pilot — task 6)

1. **Scaffold form** (sections + rail) replacing the current Card layout. Reuse all existing state/save/complete/costing logic (VALUED vs FLAT, edit draft, undo). Header section: source/dest warehouse, date, mode, notes. Lines section: shared line table (item, qty, [VALUED: landed cost]). Rail: source/dest summary, readiness checklist, totals.
2. **List** restyled to the Sales list pattern; unified **New** button. Columns must show readable **warehouse code/name** (not UUID) and item/qty/direction; add a doc-number column.
3. **Pre-flight negative-stock guard** (owner decisions locked):
   - Inline availability hint on any line whose qty exceeds source on-hand (negative stock off).
   - Guard the **Complete** action: if a line would drive source < 0, open a **warning** dialog (NOT the critical modal) with:
     - **Back** → open the draft to edit the quantity.
     - **Save as Draft** → close, leave it as an unposted draft (nothing lost).
   - Backend guard stays as the last-resort safety net (now a warning via `showOperationError`).
4. **Mode-aware Complete confirm** message: FLAT → "posts the paired stock movements (no accounting entry)"; VALUED → mention the transfer-clearing entry. (Current text always implies an accounting entry — misleading for FLAT; owner flagged via screenshot.)
5. i18n en/ar/tr for all new copy.

## Adjustments + Opening Stock rollout (task 7)

Same scaffold + list-restyle + unified New button + readable names + i18n. Adjustments: readable warehouse in list, item/qty/direction columns, and clearer **NEW QTY** labelling (it's a target count, not a delta — root of the GP02 data-entry detour; ADJ QTY is the computed delta).

## Verify

Per page: frontend typecheck + production build; do not regress posting (backend inventory suite green). Owner reviews the Transfers pilot before rollout. Do NOT restart the Firebase emulator (in-memory `GP01 Trading Co` test tenant lives there).
