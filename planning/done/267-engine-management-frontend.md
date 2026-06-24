# Task 267-E — Engine Management Frontend (Controls & Policies UI doorways)

**Branch:** `codex/267-system-core-boundary-audit` (uncommitted)
**Date:** 2026-06-25
**Status:** ✅ Built + verified. Not committed (per owner instruction). `opencode.json` not touched.

## 1. Goal

Build the four frontend UI doorways to the typed `PolicyConfig` API created in Task 267-D — one company-wide matrix and one per-module Controls editor for POS, Sales, and Purchases — using business wording, shared UI components, full i18n, and toast feedback on every save. No posting, tax, stock, ledger, or approval behavior changes.

## 2. What changed (files)

### New files
- `frontend/src/locales/en/controls.json` — new shared `controls` i18n namespace (en).
- `frontend/src/locales/ar/controls.json` — Arabic.
- `frontend/src/locales/tr/controls.json` — Turkish.
- `frontend/src/api/controlsPoliciesApi.ts` — neutral company-wide API client (`getControlsPolicies` / `updateControlsPolicies`). No companyId in any body.
- `frontend/src/components/shared/PolicyRulesEditor.tsx` — reusable business-language matrix table + add/delete + advanced accordion. `allowedModule` prop locks the module tag for module doorways.
- `frontend/src/components/shared/ModuleControlsTab.tsx` — self-contained load/save/discard body a module Settings tab hosts.
- `frontend/src/modules/settings/pages/ControlsAndPoliciesPage.tsx` — company-wide matrix page (`/settings/controls-and-policies`).
- `docs/user-guide/settings/controls-and-policies.md`
- `docs/user-guide/pos/controls.md`
- `docs/user-guide/sales/controls.md`
- `docs/user-guide/purchases/controls.md`
- `planning/done/267-engine-management-frontend.md` (this file)

### Edited files
- `frontend/src/i18n/config.ts` — register the `controls` namespace in resources + `ns` (en/ar/tr).
- `frontend/src/router/routes.config.ts` — lazy-import `ControlsAndPoliciesPage` and register route `/settings/controls-and-policies` (gated `system.company.manage`), inside the SETTINGS section next to `/settings/approval`.
- `frontend/src/modules/settings/pages/SettingsHomePage.tsx` — add a "Controls and Policies" link (ListChecks icon) in the workflow group, between Approval Workflow and Sales Settings.
- `frontend/src/api/posApi.ts` — import typed Policy types; add `getPolicies` / `updatePolicies` against `/tenant/pos/policies`.
- `frontend/src/api/salesApi.ts` — import typed Policy types; add `getPolicies` / `updatePolicies` against `/tenant/sales/policies`.
- `frontend/src/api/purchasesApi.ts` — import typed Policy types; add `getPolicies` / `updatePolicies` against `/tenant/purchase/policies` (module id is `purchase`, singular).
- `frontend/src/modules/pos/pages/PosSettingsPage.tsx` — add a **Controls** tab (`ListChecks` icon) rendering `<ModuleControlsTab module="pos" …>`.
- `frontend/src/modules/sales/pages/SalesSettingsPage.tsx` — add **Controls** to `TabId` and a Controls tab rendering `<ModuleControlsTab module="sales" …>`.
- `frontend/src/modules/purchases/pages/PurchaseSettingsPage.tsx` — add **controls** to `TabId` and a Controls tab rendering `<ModuleControlsTab module="purchases" …>`.
- `frontend/src/locales/en/common.json` — add `settings.home.links.controls.title` = "Controls and Policies".
- `frontend/src/locales/ar/common.json` — add the same key in Arabic.
- `frontend/src/locales/tr/common.json` — add the same key in Turkish.
- `docs/architecture/policy-engine.md` — §9 added: UI doorway file map, invariants, permissions.
- `planning/ACTIVE.md` — updated current task + next action.
- `planning/JOURNAL.md` — session summary appended.

No backend files touched. No `opencode.json` touched (verified).

## 3. Acceptance criteria — checklist

- [x] **Company Settings → Controls and Policies** — full matrix editor over `GET/PUT /tenant/settings/controls/policies`, gated by `system.company.manage`.
- [x] **POS → Settings → Controls** — POS-only editor over `GET/PUT /tenant/pos/policies`; only POS-tagged rules shown; unscoped / company-wide / Sales / Purchases rules are NOT shown and NOT editable here (backend already filters GET and preserves on PUT; the UI only renders what GET returns).
- [x] **Sales → Settings → Controls** — Sales-only editor over `GET/PUT /tenant/sales/policies`.
- [x] **Purchases → Settings → Controls** — Purchases-only editor over `GET/PUT /tenant/purchase/policies`.
- [x] Business wording — "engine" never appears in user copy.
- [x] Existing settings page patterns reused (`ModuleSettingsLayout`, `Card`, `ConfirmDialog`, `UnsavedChangesBanner`, `react-hot-toast`).
- [x] Shared UI component reused — `PolicyRulesEditor`/`ModuleControlsTab` under `frontend/src/components/shared/`.
- [x] i18n keys for every new visible string — new `controls` namespace in en/ar/tr, registered in `i18n/config.ts`; plus one new common link label per locale.
- [x] Every save shows toast success/error — `toast.success`, `toast.error`, and `toast(msg,{icon:'ℹ️'})` for discard.
- [x] No posting, tax, stock, ledger, or approval behavior changes — slice is UI-only.
- [x] No frontend sends a forged `companyId` — none of the API clients put a `companyId` in the body; the axios client attaches `x-company-id` from the active-company context; the backend resolves `companyId` from `tenantContext.companyId` and ignores body-level companyId.
- [x] Module UIs do not round-trip inherited/unscoped tenant rules as module rules — the backend GET filter (CTO 267-D) returns only module-tagged rules; the UI renders exactly what the doorway returns.

## 4. Verification (all green, run on `D:\DEV2026\ERP03-267-engine-audit`)

### Frontend
- `npm --prefix frontend run typecheck` — **PASS** (tsc --noEmit, no errors).
- `npm --prefix frontend run build` — **PASS** (vite build, `built in 28.79s`; only the existing pre-bundle chunk-size warning remains).

### Backend regression (unchanged slice, run to confirm)
- `npm --prefix backend test -- --runInBand src/tests/api/controllers/pos src/tests/api/controllers/sales src/tests/api/controllers/purchases src/tests/api/controllers/system-core src/tests/infrastructure/firestore/system-core` — **5 suites / 30 tests PASS**.
- `npm --prefix backend test -- --runInBand src/tests/architecture/SystemCoreBoundaries.test.ts` — **16/16 PASS** (14 existing guards + 267-C + 267-D guards, all unchanged).

## 5. Technical notes (for future engineers)

- **API shape.** `GET /tenant/{settings/controls,{pos,sales,purchase}}/policies` → `{ success, data: { companyId, rules: PolicyRule[], createdAt?, updatedAt? } }`. Module doorways return only `module === <module>` rules; the company-wide doorway returns the full matrix including unscoped TENANT rules. `PUT` body is `{ rules: PolicyRule[] }`. The validator force-stamps the module tag on module doorways and rejects cross-module tags with `400`.
- **PolicyRule shape** — see `backend/src/domain/system-core/entities/PolicyConfig.ts`: `{ id, action, scope (TENANT|MODULE|ROLE|USER|CONTEXT), effect (ALLOW|BLOCK|REQUIRE_APPROVAL), module?, reasonCode?, priority?, isHard?, requireApprovalAbove?, conditions?{ amount?, match?, requireApprovedOverride? }, approvalSubject?{ type, id?, payload? } }`.
- **Module tag lock.** When `PolicyRulesEditor` is given `allowedModule`, the "Applies to area" dropdown is hidden and every emitted rule carries the locked module tag. The company-wide page omits `allowedModule`, so it exposes the dropdown (including the "Whole company / no module" option that produces unscoped TENANT rules).
- **i18n self-containment.** The `controls` namespace holds its own `save / saving / discard / loading` action labels, so components using `useTranslation('controls')` never depend on a `common` sub-key that may or may not exist across locales.
- **Purchases URL quirk.** The Purchases module id is `purchase` (singular), so the doorway URL is `/tenant/purchase/policies` — not `/tenant/purchases/policies`. The test file names use "Purchases" but the route uses "purchase". `purchasesApi.getPolicies` uses the singular route.

## 6. End-user summary (for the User Guide)

The system now has a single **Controls and Policies** screen under Settings, plus a **Controls** tab inside POS, Sales, and Purchases Settings. Each is a friendly table where you add a rule that says "what it controls", "who it applies to", and "what happens" (Allow / Block / Require approval). Rules can be made absolute ("Cannot be overridden") and limited to "Only above amount" for approval thresholds. Company-wide rules live only on the company screen; each area's Controls tab only edits that area's rules. On every save you see a toast confirming the result. No existing behaviour (posting, tax, stock, approval engine) changed — this is purely the management surface for rules that were previously backend-only.

## 7. Follow-ups

- A future slice may surface `approvalSubject` (the approval handoff metadata) in the Advanced panel; for now it is preserved on round-trip but not editable from the matrix.
- The shared `PolicyRulesEditor` could later grow a richer "Match by place" editor for `conditions.match`; the backend validator already accepts it.
- When the Accounting doorway is added (267 follow-up), the same `ModuleControlsTab` with `module="accounting"` will drop in unchanged.

## 8. Reviewer-blocker re-check

- shared logic added inside Sales/Purchases/POS/Inventory instead of System Core? — **no** (UI slice; the shared editor lives in `components/shared/`, the policy store stays in System Core).
- module route hidden behind another module's enablement? — **no** (each module's Controls tab is inside its own settings page, which is already module-gated to that module only).
- POS-only / Sales-only / Purchases-only tenant can manage its own rules? — **yes** (each module's Controls tab requires only that module's `*.settings.manage` permission).
- unscoped / other-module rules shown or editable in a module tab? — **no** (the module doorway GET already filters them out; the UI only renders what GET returns).
- frontend sends a forged `companyId`? — **no** (no API client puts `companyId` in the body; the axios client attaches `x-company-id` from the active-company context).
- posting, tax, COGS, stock valuation, AP/AR, settlement, period-lock behavior changed? — **no**.
- tests or boundary guards weakened? — **no** (all 16 architecture guards still pass; no backend code touched).
- `opencode.json` modified? — **no** (forbidden, not touched).