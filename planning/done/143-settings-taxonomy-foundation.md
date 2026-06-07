# 143 - Task 132 Phase 3: Settings taxonomy foundation

Status: Done (2026-05-30)
Branch: `feat/init-wizard-forms-selection`
Source task: [tasks/132-ux-layout-production-hardening.md](../tasks/132-ux-layout-production-hardening.md)

## Scope

Build the first production settings taxonomy slice after sidebar/navigation polish. This slice focused on the cross-module Settings hub and the shared module settings layout, without changing posting logic, backend permissions, route guards, or the frozen top-bar widget system.

## Technical Developer View

Changed files:

- `frontend/src/modules/settings/pages/SettingsHomePage.tsx`
- `frontend/src/components/shared/ModuleSettingsLayout.tsx`
- `frontend/src/locales/en/common.json`
- `frontend/src/locales/ar/common.json`
- `frontend/src/locales/tr/common.json`
- `docs/architecture/settings.md`
- `docs/user-guide/settings/settings-home.md`

What changed:

- Replaced the placeholder Settings Home page with a real hub grouped by business purpose: General, Workflow, Accounting and Tax, Access and Advanced.
- Linked the hub to existing settings routes instead of moving route ownership or bypassing existing route permissions.
- Improved `ModuleSettingsLayout` for mobile and desktop:
  - horizontal tab scrolling on small screens,
  - sidebar tabs on desktop,
  - responsive header/actions,
  - responsive unsaved-change save bar.
- Made shared settings layout copy translatable.
- Added English, Arabic, and Turkish keys for the new settings hub and shared layout strings.
- Documented the settings taxonomy and user guide.

## End-User View

Users now get a real System Settings landing page instead of an empty placeholder. They can find settings by purpose:

- General settings for company profile, appearance, menus, and notifications.
- Workflow settings for approvals, Sales, and Purchases.
- Accounting and Tax settings for posting defaults, currencies, inventory accounting, and tax codes.
- Access and Advanced settings for roles, user assignments, and AI setup.

The actual settings pages still enforce their existing permissions.

## Accounting and Control Notes

No posting logic changed. The value of this slice is discoverability and control clarity: users are less likely to miss workflow, approval, tax, currency, role, or posting-default settings because the hub groups them by business purpose.

## Verification

- `npm --prefix frontend run typecheck` - passed
- `npm --prefix frontend run check:reports` - passed, 21 report routes checked, 0 allowlisted
- `npm --prefix frontend run check:no-confirm` - passed, no raw `window.confirm` / `alert` outside the configured allowlist contract
- `npm --prefix frontend run build` - passed
- Browser smoke: opened `http://127.0.0.1:5173/#/settings`; unauthenticated session redirected to `/#/auth`, confirming route protection still applies. Authenticated visual QA remains in QA Queue.

## Known Follow-Ups

- Normalize Sales and Purchase settings tab names/order more deeply where their concepts overlap.
- Continue Task 132 with operational list/action standardization and remaining raw date-input cleanup.
- Run manual visual QA for Settings Home in classic and Windows UI modes, including Arabic RTL.

## Time Spent

Actual: ~0.7h
