# 215 — Allocation grid GL-account display, document-specific row colors, shared charges component

**Date:** 2026-06-12
**Branch:** `feat/overpayment-credit-balance`
**Type:** UI bug-fix + code-health refactor (no accounting behavior change)

## Context

Three follow-ups from the SI/PI whole-invoice charges work (reports 209/210), picked up
together while the owner was away ("do those"):

1. **GL Account column showed raw ids.** In the allocation grid, charge rows added in the
   current session carried a display label (`CODE — Name`), but rows **loaded from the server**
   only carried the account id — so the GL Account cell rendered `2fff6a1e-…` instead of the
   account name.
2. **Row colors bled across documents.** Report 214 made row *highlights* in-memory/per-document
   but deliberately left row *colors* persisted as a per-table preference (Task 201). Because the
   `localStorage` key is keyed by a shared `tableId` and addressed by row index, coloring row 2 in
   one Sales Invoice made row 2 appear colored in **every** Sales Invoice. The owner asked to make
   colors consistent with highlights.
3. **~400 duplicated lines.** The SI and PI allocation grid + add/edit modal were near-identical
   copies in two pages.

## What was done

### 1. GL account label resolution (SI + PI)
- Added `useAccounts()` to both detail pages; `accountLabelFor()` now resolves a charge's account
  id to `CODE — Name` via `getAccountById` when no in-session label is present, falling back to the
  raw id (then the default-account label) only if the account can't be resolved.
- SI uses `revenueAccountId`; PI uses `accountId` — each page's resolver keeps its own field name.

### 2. Row colors made document-specific (transient)
- In `ClassicLineItemsTable`, `rowColors` no longer reads from / writes to `localStorage`; it is now
  in-memory only, exactly like `highlightedRows`. Removed the `rowColorStorageKey` and its persist
  effect; updated the comments. This **reverses** the Task 201/214 "persisted per-table preference"
  decision per owner request, so colors now scope to the open document and reset on navigation.

### 3. Shared `DocumentChargesAllocation` component
- New `frontend/src/components/shared/DocumentChargesAllocation.tsx` exporting:
  - `DocumentChargesAllocation` — the allocation grid (Type / Description / GL Account / Amount + base).
  - `DocumentChargeModal` — the single Add/Edit Charge-or-Discount modal.
  - `ChargeModalState`, `ChargeAllocationRow` types.
- **Purely presentational.** Pages keep all charge state, totals math, and posting payloads. They
  pass display-ready rows (account label + base amount already computed), the modal state, and
  callbacks. Per-module differences are props: i18n namespace prefix (`tns`), allowed GL
  classifications, and context labels. All i18n keys already exist under both
  `sales.invoiceDetail.*` and `purchases.invoiceDetail.*` in `common.json`, so rendered strings are
  unchanged.
- SI and PI now render `<DocumentChargesAllocation>` / `<DocumentChargeModal>`; their duplicated grid
  and modal JSX (and the now-orphaned `AccountSelector`, `DocumentSecondaryPanel`,
  `DocumentEmptyPanel`, `Plus`, `Pencil`, `Trash2` imports) were removed.

## Files changed
- `frontend/src/components/shared/DocumentChargesAllocation.tsx` (new)
- `frontend/src/components/shared/ClassicLineItemsTable.tsx` (row colors transient)
- `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`
- `frontend/src/modules/purchases/pages/PurchaseInvoiceDetailPage.tsx`
- `docs/architecture/sales.md`, `docs/architecture/purchases.md`

## Accounting boundary
UI/presentation only. No posting, tax, AR/AP, settlement, inventory valuation, approval,
period-lock, audit, DTO, repository, or ledger behavior changed. The charge state shape, totals
math, and `buildPayload` charge maps are untouched in both pages — only the JSX that renders them
moved into the shared component, and the GL-account cell now shows a resolved name instead of an id.

## Verification
- `tsc --noEmit` (frontend): clean.
- `npm run build` (frontend): green — check:reports / check:no-confirm / check:sod-approve + tsc +
  vite build all pass. (Pre-existing >500 kB main-chunk warning is unrelated.)

## Manual QA needed (owner-driven pass — covers the shared component directly)
On a fresh template-seeded tenant (SYCO out of scope):
1. **GL display:** Create an SI, Add Charge with a GL account, save & reopen → the GL Account column
   reads `CODE — Name`, not a raw id. Repeat on a Purchase Invoice. Edit a loaded row → modal
   pre-fills the account.
2. **Row colors:** In the SI line table, color a row, navigate to a different Sales Invoice → the
   other invoice's rows are **not** colored. Reload → colors reset (now transient, like highlights).
3. **Charges parity:** Add/Edit/Remove charge and discount on both SI and PI; confirm totals,
   base-currency amounts, and the green CHARGE / rose DISCOUNT styling all render as before, and the
   posted GL still balances (charge credits/discount debits on SI; charge debits/discount credits on PI).
