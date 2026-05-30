# Settings Architecture

## Purpose

ERP03 settings are grouped by business purpose so operators can find control-sensitive configuration without knowing the internal module structure. The settings hub is the entry point for cross-module settings, while module settings pages continue to own their detailed save flows.

## Taxonomy

The v1 settings taxonomy is:

- General: company profile, appearance, menu behavior, notification defaults.
- Workflow: approval behavior and document flow controls for Sales and Purchases.
- Accounting and Tax: posting defaults, currencies, inventory accounting, and tax codes.
- Access and Advanced: roles, user assignments, AI settings, and advanced administration.

The taxonomy is surfaced in `frontend/src/modules/settings/pages/SettingsHomePage.tsx`. It does not move the underlying routes or permissions; it gives users a predictable hub that links to the existing configuration pages.

## Shared Layout

`frontend/src/components/shared/ModuleSettingsLayout.tsx` is the shared layout for module-level settings pages. It provides:

- Header, tab navigation, and content region.
- Horizontal tab scrolling on smaller screens and sidebar tabs on desktop.
- Global unsaved-change save/discard bar.
- i18n keys for shared save/discard copy.
- Mode-aware spacing using `useUserPreferences().uiMode`.

New module settings pages should use `ModuleSettingsLayout` unless they have a documented exception. Settings that affect posting, workflow, tax, permissions, or financial controls should include clear helper text on the exact tab where the setting is changed.

## Accounting and Control Notes

Settings pages are control surfaces. Workflow, approval, account defaults, tax, currency, and role settings can change posting behavior or user authority. UI changes in this area must preserve:

- Existing route permissions.
- Existing backend validation and save payloads.
- Visible unsaved-change warnings.
- Toast feedback for save/discard/server errors.
- Predictable grouping across Sales, Purchases, Accounting, Inventory, and company settings.

## File Map

- `frontend/src/modules/settings/pages/SettingsHomePage.tsx` - settings hub taxonomy.
- `frontend/src/components/shared/ModuleSettingsLayout.tsx` - shared settings page shell.
- `frontend/src/locales/*/common.json` - settings hub and shared layout strings.
- `frontend/src/router/routes.config.ts` - underlying settings routes and permission guards.
