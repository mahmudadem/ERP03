# 147 — Sidebar Forms Grouping Rework

**Branch:** `feat/init-wizard-forms-selection`
**Date:** 2026-05-31

## Why

The v1 sidebar policy suppressed every system default form across all modules.
Accounting was the worst hit: a fresh tenant saw an empty Accounting sidebar
because accounting *is* vouchers, and all of them were defaults. The user
flagged the bug when reviewing the Forms Management page for Accounting after
the Sales work had passed QA.

## What changed

### Policy (now documented)

New authoritative doc: [`docs/architecture/sidebar-forms-grouping.md`](../../docs/architecture/sidebar-forms-grouping.md).

| Module               | Native (hard-coded) | Default (shipped, locked)     | Cloned / custom               |
| -------------------- | ------------------- | ----------------------------- | ----------------------------- |
| **Accounting**       | Approval Center at root; All Vouchers prepended inside Vouchers | **Vouchers** group | **Vouchers** group |
| **Sales / Purchases**| `Forms` group (list pages) | **Default Forms** group | **Root of module sidebar** (until user picks a group) |

Vocabulary fixed: *native* / *default* / *cloned*. The seed placeholder
`sidebarGroup: "Documents"` is treated as unset at runtime so per-module
defaulting kicks in without a data migration.

### Code

- [`frontend/src/hooks/useSidebarConfig.ts`](../../frontend/src/hooks/useSidebarConfig.ts)
  - `buildDynamicFormGroups` rewritten with `effectiveGroup(form)` defaulting.
  - Default-form suppression removed — activated defaults flow into the sidebar.
  - Groupless clones emit as **top-level sidebar leaves** (no nested "Other Forms" group).
  - `OTHER_FORMS_GROUP` constant deleted; `VOUCHERS_GROUP` and
    `SEED_PLACEHOLDER_GROUP` introduced.
  - Accounting Vouchers group dynamically prepends an *All Vouchers* entry.
  - `dynamicGroupRank` now takes a `SidebarItem` (so root leaves get
    `ROOT_LEAF_RANK = 1.5`, between Default Forms and Vouchers).
- [`frontend/src/config/moduleMenuMap.ts`](../../frontend/src/config/moduleMenuMap.ts)
  - Removed the static `Forms` group from Accounting.
  - Approval Center promoted to a root-level item in Accounting.
  - All Vouchers moved out of moduleMenuMap (now injected dynamically into the
    Vouchers group).

### Docs

- Added [`docs/architecture/sidebar-forms-grouping.md`](../../docs/architecture/sidebar-forms-grouping.md)
  (vocabulary, per-module target, current implementation, follow-ups).
- Updated [`docs/user-guide/forms-management.md`](../../docs/user-guide/forms-management.md)
  with a *Where forms appear in the sidebar by default* table.

## Definition of Done

- [x] Code merged
- [x] `docs/architecture/sidebar-forms-grouping.md` created
- [x] `docs/user-guide/forms-management.md` updated
- [x] `planning/done/147-sidebar-forms-grouping-rework.md` (this file)
- [x] `planning/JOURNAL.md` entry appended
- [x] `planning/ACTIVE.md` updated

## Manual QA

1. **Accounting sidebar** — open Accounting. You should see, in order:
   *Overview · Chart of Accounts · Approval Center · Vouchers ▸ · Reports ▸ ·
   Tools ▸ · Settings*. There should be **no `Forms` group**. Expand
   **Vouchers** — first entry is *All Vouchers*, then every activated default
   (Journal Entry, Payment Voucher, Receipt Voucher, Opening Balance…) and any
   clones tagged with the Vouchers group.
2. **Sales sidebar** — install a default form (e.g. Quotation) via
   Forms Management → Sales and activate it. A **Default Forms** group should
   appear right after `Forms` containing the activated entry. Native list
   pages (Quotations / Sales Orders / Delivery Notes / Sales Invoices /
   Sales Returns) remain inside the static `Forms` group untouched.
3. **Groupless clone** — clone any sales form, leave the *Sidebar Group*
   picker empty (or pick "Documents" then unset), activate it. It should
   render as a **top-level sidebar leaf** under Sales, between
   *Default Forms* and *Reports* — not inside an Other Forms wrapper.
4. **User-assigned group still wins** — set a clone's Sidebar Group to
   "Approvals" (custom). It moves into its own *Approvals* submenu.
5. **No duplicate All Vouchers** — confirm the Vouchers group lists
   *All Vouchers* only once (the dynamic prepend, not a leftover static
   entry).

## Follow-ups (non-blocking)

- Update [`backend/src/seeder/seedSystemVoucherTypes.ts`](../../backend/src/seeder/seedSystemVoucherTypes.ts)
  to write per-module defaults (`Vouchers` for accounting, `Default Forms`
  for the rest) instead of the global `Documents` placeholder.
- Remove `Documents` from the preset chips in
  [`FormCard.tsx`](../../frontend/src/modules/tools/forms-designer/components/FormCard.tsx)
  since the runtime treats it as unset.
