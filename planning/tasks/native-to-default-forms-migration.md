# Native → Default Forms Migration

**Created:** 2026-05-30
**Status:** Design note (no code commitment yet)
**Owner:** Product (decisions) + Engineering (execution)
**Related:** [Task 135 — Field Component Library](./135-field-component-library.md), item #5 of the 2026-05-30 roadmap

## Three sources of forms

Across the app, "forms" come from three places. The terminology below is the contract — agents and docs use these names verbatim.

| Term | Where it lives | What it is |
|---|---|---|
| **Native forms** | Hardcoded in [frontend/src/config/moduleMenuMap.ts](../../frontend/src/config/moduleMenuMap.ts) and their `pages/` components | The current full-featured surface. Lists, detail pages, lifecycle actions, integrations (WhatsApp send, payment record, attachments, ...) |
| **Default forms** | `voucher_forms` collection, rows with `isDefault` / `isSystemGenerated` / `isLocked` true. Seeded by [CompanyVoucherTemplateSyncService](../../backend/src/application/system/services/CompanyVoucherTemplateSyncService.ts) from the [seedSystemVoucherTypes.ts](../../backend/src/seeder/seedSystemVoucherTypes.ts) catalog | Locked templates a tenant can activate. The future surface — assembled from Field Library components. Today they are a junior subset of native capability. |
| **Cloned forms** | `voucher_forms` collection, rows without the default flags. Created by users via "Clone" / "Add Custom Form" | User customisations of a default. Inherit composition rules from the default, so they grow as the Field Library grows. |

## Direction

**Native is senior today. Default is the future.** The migration is not a switch — defaults catch up to native by *gaining* components from the Field Library. Once every action a native exposes is reachable through Field Library components, the native list page can retire to "Reports" (or be deleted) and the default form takes over.

Cloned forms ride along automatically: anything the default learns to do, every clone of it can do.

## Current capability gap (native vs. default)

Per voucher type the gap is roughly:

| Capability | Native | Default today | Field Library component needed |
|---|---|---|---|
| List/browse (paged, sorted, filtered, status chips) | ✅ | ❌ | `list-surface` or default-driven list-page renderer |
| Status badges (DRAFT / POSTED / CANCELLED) | ✅ | n/a | bound to list-surface |
| Create single record | ✅ | ✅ | — |
| Edit single record | ✅ | ✅ | — |
| Post / approve / cancel / void buttons | ✅ | partial | `lifecycle-action` |
| Record payment against invoice | ✅ | ❌ | `record-payment-action` |
| WhatsApp send | ✅ | ❌ | `send-whatsapp-action` |
| Email/Telegram send | partial | ❌ | `send-message-action` (multi-channel) |
| Attach file / view attachments | ✅ | partial | `attachments-panel` |
| Print / download PDF | ✅ | ✅ via template | — |
| Drill-down to source/related documents | ✅ | ❌ | `related-docs-panel` |
| Permission gating on actions | ✅ | partial | hook into existing RBAC |
| Audit-log viewer (per-record) | ✅ | ❌ | `audit-log-panel` |
| Period-lock override flow | ✅ on SI/DN/SR | ❌ | `period-lock-override-action` |
| Backorder / partial-fulfillment UX | partial | ❌ | TBD |
| Promotion evaluation banner | ❌ (deferred) | ❌ | TBD |

This is not exhaustive — fill it in per voucher type as the migration proceeds.

## Sidebar grouping policy (implemented 2026-05-30)

Per-module sidebar shape after the rename:

```
Overview
[high-frequency master data]
Forms              ← native list pages + cloned forms the user tags "Forms"
Default Forms      ← every default form, grouped here regardless of stored sidebarGroup
[custom user-named groups]   ← cloned forms with any other sidebarGroup
Other Forms        ← cloned forms whose sidebarGroup is blank (catch-all)
Reports
Tools
Settings
```

Rules implemented in [useSidebarConfig.ts](../../frontend/src/hooks/useSidebarConfig.ts):

- **Native forms** sit under the static `Forms` group declared in moduleMenuMap.
- **Default forms** always render under a single top-level `Default Forms` group per module. Their stored `sidebarGroup` field is ignored — the seed-tagged "Documents"/"Vouchers" history no longer drives placement.
- **Cloned forms** honor user-chosen `sidebarGroup` verbatim. If it matches `Forms`, they fold into the static Forms group; otherwise they render as their own group; blank → `Other Forms`.
- Dynamic groups are inserted right **after** the static `Forms` group (so Default Forms → user-named → Other Forms sit between Forms and Reports), not appended at the end of the section.

This grouping makes the duplicate "Sales Order" / "Sales Orders" pair *legible* — they're in different groups under different headings — rather than removing one. The duplication is a temporary, honest signal that the migration isn't done.

## Migration plan (high level)

Sequence the work per voucher type. For each voucher type pick a target like Sales Invoice (Direct):

1. **Capability audit** — fill in the matrix above. List exactly which actions/integrations the native exposes that the default does not.
2. **Field Library components** — for each missing action, design and ship a Field Library entry that wraps the action so the default form can mount it. Each one is a small task. Library version bumps per change (see Task 135 decision 6.3).
3. **Default form parity build** — update the default voucher template (super-admin Forms Designer) to mount the new components. Confirm clones inherit them.
4. **Side-by-side QA** — run the same business flow through the native and through the default. Sign off when default behavior matches.
5. **Retirement** — once the product owner certifies parity, remove the native entry from `moduleMenuMap.ts`. The default form's sidebar entry under `Default Forms` becomes the single surface. Native page components either delete or move under `Reports` for read-only access if the list view is still useful.
6. **Cloned-form regression** — confirm any tenant clones of the default still work (they will, structurally, but spot-check the largest tenants).

Do this one voucher type at a time. Don't ship a partial migration ("create works but post doesn't") — defaults stay junior until they are *fully* at parity for that type.

## Out of scope for this design note

- Detailed Field Library component specs (per-component design lives in Task 135 follow-ups or new tasks).
- The list-surface architecture (default-driven list pages). Needs its own design pass — it's a bigger piece than a single component.
- Multi-tenant / RBAC implications of retiring natives. Will surface during the per-voucher-type audit.
- Reports tab restructuring once natives retire.

## Open questions

- Does retiring a native page mean deleting its route, or 301'ing to the default form's URL? Tenants with bookmarks need a path.
- For voucher types with no native list page (none today, but possible), what's the default group? Likely `Default Forms` still.
- How does the super-admin's Forms Designer surface the "this default is at parity, native can retire" signal? Worth a small UI affordance later — possibly a "Replaces native" checkbox on the template that the agents reference during retirement.

## Decision log

- **2026-05-30** — Naming locked: native / default / cloned forms. Sidebar groups renamed "Documents" → "Forms". Defaults always group under "Default Forms" regardless of stored `sidebarGroup`. Decision driven by user observation that the suppression attempt removed working functionality from the sidebar.
