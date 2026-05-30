# 136 — Sidebar form grouping policy

**Date:** 2026-05-30
**Agent:** Claude (Opus 4.7)
**Branch:** `feat/init-wizard-forms-selection`
**Status:** ✅ Implemented (pending visual QA + commit)
**Related design note:** [planning/tasks/native-to-default-forms-migration.md](../tasks/native-to-default-forms-migration.md)

## Context

Earlier this session we attempted to fix "duplicated voucher menu entries" by suppressing system-default voucher form shortcuts from the sidebar when their `voucherType` already had a static module-nav counterpart. That was the wrong direction: defaults are the *future* surface (assembled from Field Library components) and natives are *senior today*, but the product owner intends defaults to win once they reach parity. Suppressing defaults hid working activation that the user had deliberately switched on.

This report supersedes the (uncommitted) suppression work. The suppression was reverted before commit.

## Change

Instead of suppressing one of the two layers, make both layers *legibly distinct* in the sidebar. Names locked in:

- **Native forms** — entries in `moduleMenuMap.ts` (list pages).
- **Default forms** — `voucher_forms` rows with `isDefault` / `isSystemGenerated` / `isLocked`.
- **Cloned forms** — `voucher_forms` rows without those flags.

Sidebar grouping policy:

| Source | Sidebar group | Detail |
|---|---|---|
| Native forms | `Forms` (renamed from `Documents`) | Static, declared in moduleMenuMap.ts |
| Default forms | `Default Forms` | Always grouped here; their stored `sidebarGroup` field is ignored |
| Cloned forms (custom sidebarGroup) | The user's chosen group | If matches `Forms`, folds into native group; else own group |
| Cloned forms (no sidebarGroup) | `Other Forms` | New catch-all so blank-sidebarGroup clones never strand at sidebar root |

Within each module section the canonical order is:

```
[Overview, master data]            — unchanged
Forms                              — native list pages
Default Forms                      — all default forms
[user-named custom groups]         — e.g. user-typed "Vouchers" or "Approvals"
Other Forms                        — clones with no sidebarGroup
Reports, Tools, Settings           — unchanged
```

Dynamic groups are inserted right after the static `Forms` group, sorted by `FORM_GROUP_RANK` (Default Forms → user-named → Other Forms), so they no longer get appended at the end of the section past `Settings`.

### Files changed

- [frontend/src/config/moduleMenuMap.ts](../../frontend/src/config/moduleMenuMap.ts)
  - Renamed every `label: 'Documents'` group to `label: 'Forms'` (sales, purchase, accounting, inventory).
  - Header comment rewritten to describe the new three-source policy.
- [frontend/src/hooks/useSidebarConfig.ts](../../frontend/src/hooks/useSidebarConfig.ts)
  - Replaced the wrong-direction `STATIC_VOUCHER_TYPE_COVERAGE` suppression with three named constants `DEFAULT_FORMS_GROUP = 'Default Forms'`, `NATIVE_FORMS_GROUP = 'Forms'`, `OTHER_FORMS_GROUP = 'Other Forms'`, plus a `FORM_GROUP_RANK` map for ordering.
  - `buildDynamicFormGroups` now routes default forms to `Default Forms` unconditionally; cloned forms with a `sidebarGroup` use it (folds into static `Forms` when label matches); cloned forms without `sidebarGroup` fall into `Other Forms` instead of being stranded as root items.
  - Dynamic group injection inserts the new groups right after the static `Forms` index (rank order: Default Forms → user-named → Other Forms), so they appear before Reports/Tools/Settings instead of after.
  - Added label-key map entries for `Forms` → `sidebar.forms`, `Default Forms` → `sidebar.defaultForms`, `Other Forms` → `sidebar.otherForms` (i18n falls back to the literal label when translation missing).
  - Distinct group icons: `Layers` for Default Forms, `Files` for Other Forms, `FolderOpen` for everything else, `FileText` retained for legacy "Vouchers" group.
- [frontend/src/hooks/useVoucherTypes.ts](../../frontend/src/hooks/useVoucherTypes.ts)
  - `SidebarFormEntry` carries `voucherType`, `isDefault`, `isSystemGenerated`, `isLocked` (added in the reverted suppression work — kept because the new policy still needs the default-flag bits).
  - Both API and legacy fallback paths populate the new fields.
- [frontend/src/modules/shared/pages/VoucherDesignerPage.tsx](../../frontend/src/modules/shared/pages/VoucherDesignerPage.tsx)
  - Kebab menu's `Sidebar Group` editor: replaced the hardcoded `SIDEBAR_GROUP_PRESETS` chip row with a native `<datalist>` attached to the input. Suggestions come from distinct `sidebarGroup` values already in use across the company's forms, plus canonical seeds (`Forms`, `Vouchers`, `Reports`, `Operations`). `Default Forms` is intentionally excluded — defaults force to that group at render time, so it's not a user-selectable value for a clone.
  - The new `availableSidebarGroups` memo at the page level threads through `InstalledTypeRow` → `FormRow`.
  - Removing the chip row also resolves the kebab overflow — the editor is now compact enough to render fully inside the row card without clipping.

### What the user will see

- Sidebar `Documents` group renamed to `Forms` everywhere. Native list pages (Quotations, Sales Orders, etc.) sit under `Forms`.
- A new `Default Forms` group appears immediately after `Forms`, containing every active default form (Sales Invoice (Direct), Sales Invoice (Linked), Sales Invoice (Service), Sales Order, Sales Return, etc. for Sales).
- The user-cloned `Sales Invoice (Direct) - Copy33333` (sidebarGroup = `VOUCHERS`) appears in its own `Vouchers` group between Default Forms and Other Forms.
- A new `Other Forms` group only appears when there are clones with a blank `sidebarGroup`; otherwise it's hidden. This stops blank-sidebarGroup clones from stranding as root-level items next to Reports/Tools/Settings.
- The visual duplication of "Sales Orders" (under Forms) and "Sales Order" (under Default Forms) is preserved on purpose — they're now in distinct headings that explain why both exist.

## Verification

- `npm --prefix frontend run typecheck` → exit 0
- `npm --prefix frontend run build` → exit 0 (24.13s)

## Manual QA (after commit)

1. **Sales sidebar** — confirm `Forms` group contains the plural native list pages; `Default Forms` group contains the activated locked-default forms (Sales Invoice variants, Sales Order, Sales Return); user clone still under `Vouchers`.
2. **Purchases sidebar** — same shape.
3. **Accounting sidebar** — `Forms` contains Approval Center + All Vouchers; `Default Forms` contains the activated accounting voucher templates.
4. **Inventory sidebar** — `Forms` contains Opening Stock Documents, Adjustments, Transfers.
5. **i18n** — Arabic/RTL renders the new label keys (fall back to "Forms"/"Default Forms" until translations are added).

## Out of scope

- **Native retirement.** Sidebar duplication remains by design. The capability matrix in the design note has to be filled in per voucher type before any native entry can retire.
- **List-surface Field Library component.** Defaults need a way to render list views before they can replace natives for browse-flows. Separate task.
- **i18n strings.** New label keys default to the English literal — Arabic strings to be added in the i18n hardening pass.

## Decision log

- Earlier "suppress defaults" approach was rejected — defaults are deliberately activated functionality, hiding them removed user-visible behavior.
- Defaults are grouped under a single per-module `Default Forms` heading regardless of their stored `sidebarGroup`. This trades stored-field fidelity for predictable IA; tenants who tagged a default with `sidebarGroup="Approvals"` no longer get a custom group for it. Defaults are system templates — the user customises a default by cloning it, and the clone keeps its `sidebarGroup` freedom.
- **2026-05-30 (later same day)** — v1 strategy adopted: natives are the primary surface for the first deployment, defaults are a power-user customization path. **Default Forms sidebar group is now hidden from sidebar rendering** (suppressed in `useSidebarConfig.buildDynamicFormGroups`). Activated defaults remain in Firestore, still appear in Tools → Forms Management, and can still be cloned. Cloned forms continue to render in their user-chosen `sidebarGroup` (or `Other Forms` if blank). The `DEFAULT_FORMS_GROUP` constant + label-key entry are kept in code as the v2 hook point — uncommenting one filter line restores the group when the migration resumes.
