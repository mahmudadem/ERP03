# Sidebar Permission Filtering Completion Report

## What Changed

- `frontend/src/hooks/useSidebarConfig.ts`
  - Added recursive filtering for every sidebar item.
  - Prunes parent groups when all children are hidden.
  - Applies permissions to dynamic Accounting voucher/form sidebar links.
- `frontend/src/config/moduleMenuMap.ts`
  - Aligned Inventory sidebar permissions with route guards.
  - Removed dead sidebar links that had no matching route.
  - Updated HR Employees to use the canonical `hr.employees.view` permission.
- `frontend/src/router/routes.config.ts`
  - Added route-level permissions for HR Employees, POS Terminal, CRM, Manufacturing, and Projects placeholder routes.
- `backend/src/config/PermissionCatalog.ts`
  - Added placeholder permission catalog entries for CRM, POS, Manufacturing, and Projects.
- `backend/src/seeder/seedOnboardingData.ts`
  - Normalized Manufacturing and Projects placeholder permission IDs to match module prefixes.

## What Was Tested

- Ran sidebar route-permission audit script: `0` mismatches.
- Ran `npm run build` in `frontend/`.
- Ran `npm run build` in `backend/`.

## Acceptance Criteria Met

- Sidebar filtering is no longer dependent on parent/child menu placement.
- Nested/deeper links are hidden when the user lacks the link's own permission.
- Empty groups are hidden after child links are filtered.
- Direct route guards remain authoritative and still deny unauthorized direct URLs.
- Declared sidebar paths now match route permission metadata.
- Placeholder permission IDs use module-aligned prefixes so company-scoped permission catalogs can expose them correctly.

## Known Follow-Ups

- Custom company roles still need `moduleBundles` derived and persisted from selected permissions. This is the remaining root cause for the original Accounting module 403 issue.
