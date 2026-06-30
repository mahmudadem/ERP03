# Task 278x — Localized Default Voucher and Form Names

**Completed:** 2026-06-30  
**Actual time:** ~2.1 hours, including worktree correction  
**Status:** Complete locally in `ERP03-unified`; not committed, pushed, or deployed

## Technical Developer View

### Problem

Company initialization copies system voucher/form templates whose persisted
names are English. Forms Management had a private partial translation map, but
the sidebar, initialization wizards, document pages, and filters still rendered
the raw English names.

### Implementation

- Added `frontend/src/utils/voucherDisplayName.ts` as the shared display-name
  resolver. Stable codes select translations; tenant custom names are preserved.
- Added complete EN/AR/TR names for all 16 seeded voucher templates and five
  built-in native form labels.
- Wired localization into:
  - voucher/form hooks and dynamic sidebar entries;
  - module initialization catalog cards;
  - Forms Management;
  - dynamic document pages;
  - voucher definition loading;
  - journal form filters.
- Added `check-voucher-locales.mjs`; frontend builds now fail if a seeded
  default lacks an EN, AR, or TR name.

### Accounting and data impact

None. Voucher/form codes remain unchanged and continue to drive posting,
numbering, document identity, and repository lookups. Localization is
display-only. No tenant data was migrated or overwritten.

### Worktree correction

The first implementation pass was mistakenly made in the SQL-readiness
worktree. The scoped patch was moved to `D:\DEV2026\ERP03-unified`, and every
file from this task was removed from the SQL worktree. Its pre-existing
untracked `_sqlServer.ts` file was preserved.

## End-User View

When the user selects Arabic, shipped vouchers and forms now appear with clear
Arabic names such as `قيد يومية`, `سند صرف`, `سند قبض`, and
`فاتورة مبيعات مباشرة`. English and Turkish users see the corresponding names.
Company-created or renamed forms retain their custom names.

## Verification

- Locale JSON parsing: passed for EN/AR/TR.
- Voucher locale guard: 16/16 seeded templates covered; Arabic resolution and
  custom-name preservation checks passed.
- Frontend typecheck: passed.
- Frontend production build: passed.
- `SystemCoreBoundaries.test.ts` and
  `CompanyVoucherTemplateSyncService.test.ts`: 31/31 passed.
- Local browser smoke confirmed the production-lane app starts in Arabic.
  Authenticated form/sidebar visual QA remains an owner handoff check.
- `graphify update .` could not run because the Graphify CLI is unavailable.

## Owner QA

1. Use a company with Arabic selected.
2. Open Accounting, Sales, and Purchase initialization and verify all available
   voucher types are Arabic rather than English-only.
3. Complete initialization and inspect Forms Management and the sidebar.
4. Switch to English and Turkish; shipped default names should switch language.
5. Create or rename a custom form and switch languages; its name must not change.

## Documentation

- Technical: `docs/architecture/document-forms-plan.md`
- User guide: `docs/user-guide/forms-management.md`
