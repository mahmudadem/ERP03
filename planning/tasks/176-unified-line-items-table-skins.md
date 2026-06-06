# 176 — Unified Line-Items Table: One Component, Two Skins

**Status:** Open
**Owner:** TBD (frontend agent — UI work, not Claude+Mahmud QA)
**Origin:** Mahmud direction, 2026-06-05 — "create one or two tables that user can flip between, unified across the project for consistency"
**Predecessor:** [8d3e8bc4 — ClassicLineItemsTable + PI migration](../../frontend/src/components/shared/ClassicLineItemsTable.tsx)

## Goal

Every voucher line-items grid in the app uses **one shared component** with **two visual skins** the user can flip between (a per-user preference, like UI mode). No per-voucher table forks, no third skin, no per-column skin overrides.

## Why

PI was migrated to `ClassicLineItemsTable` as the first consumer (commit `8d3e8bc4`). SI / SO / SR / PR / GVR each still own their own ad-hoc tables, so behaviour (keyboard, paste, validation, totals row, RTL) drifts. A single shared component fixes the drift; two skins respect the fact that some users (and some screens) want dense rows and some want comfortable card-style rows.

## Architecture (binding)

1. **One component** — `ClassicLineItemsTable.tsx` stays the only line-items table. Rename to `LineItemsTable.tsx` once it carries both skins.
2. **Two skins, selectable via prop + user preference:**
   - **Classic** (current): dense, sticky header, h-9 cells, native borderless selectors. The "Excel" feel.
   - **Modern** (new): taller rows, card-like row container, soft borders, larger touch targets. The "tablet" feel.
3. **Skin = visual only.** Same columns, same data, same keyboard model. A column visible in Classic is visible in Modern. A column width is the same conceptually (it's column config, not skin config).
4. **User preference lives in `useUserPreferences`** alongside `uiMode` — call it `lineTableSkin: 'classic' | 'modern'`. Default Classic. A TopBar widget (like `UIModeWidget`) lets the user flip.
5. **No third skin.** If a future need argues for one, treat it as a redesign of one of the two — don't grow the list.
6. **No per-column skin overrides.** If a column needs to behave differently in Modern, the column needs redesign, not a special case.

## Migration plan (one voucher per session, in order)

1. Sales Invoice (`SalesInvoiceDetailPage`)
2. Sales Order (`SalesOrderDetailPage`)
3. Sales Return (`SalesReturnDetailPage`)
4. Purchase Return (`PurchaseReturnDetailPage`)
5. Generic Voucher Renderer (GVR) — Classic table mode

Each migration session:
- Map the existing columns to `ColumnDef<T>[]`.
- Verify totals, tax math, keyboard, paste, RTL, and i18n still pass.
- Run typecheck + build + the relevant backend posting tests.
- Write a done-report (`planning/done/NN-<voucher>-line-table-migration.md`) with a QA script.

GVR migration is the last + hardest because GVR is the contract every cloned form uses.

## Out of scope

- Column resize, row context menu, row highlighting (GVR-parity features) — file as follow-ups if/when a consumer needs them.
- Pivoting columns between vouchers (sharing a "Tax Code" column definition across PI/SI). Tempting but creates implicit coupling — keep columns per voucher unless three+ vouchers ask for the exact same column.
- A third skin. Reject on sight.

## Definition of done

- All five voucher detail pages render through the shared `LineItemsTable`.
- `lineTableSkin` preference exists, persists, and flipping it changes the look across all five.
- `frontend && npx tsc --noEmit` clean.
- `frontend && npm run build` clean.
- Backend Sales + Purchase posting test suites pass.
- `docs/architecture/line-items-table.md` documents the contract (one component, two skins, column-config-driven, skin is visual-only).
- `docs/user-guide/preferences/line-table-skin.md` explains the user-facing toggle.
- `planning/done/176-unified-line-items-table-skins.md` summary report covering all five migrations or pointing to the per-voucher reports.

## Notes for the next agent

- Don't try to do all five in one session. PI took a full commit and ~140 lines of diff just to migrate one form — do them one at a time, ship each.
- The `custom` ColumnDef kind is the escape hatch for cell-native selectors (`ItemSelector`, `WarehouseSelector`, etc.). Reuse it; don't invent new ColumnDef kinds for one-off needs.
- Mahmud is **not** doing UI work in this session — he's running Sales/Purchases functional QA with Claude. This task is for a separate UI-focused agent.
