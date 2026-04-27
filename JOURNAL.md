# Development Journal

> Append new entries at the top. One entry per work session.
> This log is used by all AI agents to understand recent project history.

---

## 2026-04-28 (Tue) — 0.1h
**Task:** Fix Onboarding Redirect Race Condition (Task 47)
**Agent:** OpenCode
**What I Did:**
- User reported intermittent redirect to `/onboarding/plan` after backend rebuild + refresh
- Root cause: `RequireOnboarding` guard treated any non-401 API error as "needs onboarding" and redirected immediately
- During backend startup, connection refused/502/timeout errors triggered the redirect
- Added 3 retries with exponential backoff (1.5s, 3s, 4.5s) for network errors
- Added "Connecting to server..." loading message during retries
- TypeScript compilation passes with zero errors
- Created completion report at `1-TODO/done/47-onboarding-redirect-race-condition-fix.md`
**Result:** ✅ Done
**Next:** Awaiting next task from user.

---

## 2026-04-28 (Tue) — 2.5h
**Task:** Forms Designer — Module Status + Catalog Sync (Task 46) — Iteration 2
**Agent:** OpenCode
**What I Did:**
- User reported forms still appearing after first fix — traced to `CreateCompanyUseCase.ts` (onboarding path)
- Found THREE code paths creating forms before init: EnableModuleForCompanyUseCase (fixed), CreateCompanyUseCase (still creating), and module init (correct)
- Removed `syncCompanyVoucherTemplatesFromSystem()` from `CreateCompanyUseCase.ts` (line 229-236)
- Updated `OnboardingController.ts` constructor call
- Updated `CreateCompanyUseCase.test.ts` — removed voucher repo mocks
- Verified `npm run build` passes with zero errors
- IMPORTANT: Existing test companies have stale forms data — need to clear Firestore emulator data before QA
**Result:** ✅ Done — forms now ONLY created during module initialization
**Next:** Clear emulator data, create fresh company, verify uninitialized modules show NO forms.

---

## 2026-04-28 (Tue) — 2.0h
**Task:** Forms Designer — Module Status + Catalog Sync (Task 46)
**Agent:** OpenCode
**What I Did:**
- Diagnosed why Sales Invoice/Sales Order forms appeared in Forms Designer before Sales module init
- Root cause: voucher types seeded at company creation (all 13 templates), Forms Designer only checked bundle entitlement not initialization state
- Added `useCompanyModules` hook to `ToolsFormsDesignerPage.tsx` for real initialization status detection
- Created `ModuleStatusBanner.tsx` — shows exact reason why forms aren't visible with "Initialize" button linking to setup wizard
- Added `loadSystemVoucherTypes()` service to read from `system_metadata/voucher_types/items` platform catalog
- Integrated system catalog with adoption status: Active (adopted), Available (in catalog, not adopted), Custom (user-cloned)
- Added "Available in Catalog" section to `DocumentFormDesigner.tsx` with "Adopt & Customize" buttons
- Added backend `POST /company-admin/modules/:module/sync-voucher-types` endpoint for catalog sync
- Deprecated legacy Accounting Forms Designer — now redirects to `/tools/forms-designer`
- Verified both backend and frontend builds pass with zero errors
- Created completion report at `1-TODO/done/46-forms-designer-module-status-catalog-sync.md`
**Result:** ✅ Done
**Next:** Manual browser QA on Forms Designer with uninitialized/initialized modules. Then select next task from ROADMAP.md.

---

## 2026-04-27 (Mon) — 0.3h
**Task:** Fix Module lifecycleStatus Availability Cache (Task 45)
**Agent:** OpenCode
**What I Did:**
- Diagnosed the "Module is not ready: lifecycleStatus is draft" 503 error that appeared after SuperAdmin updates modules from draft → ready
- Identified root cause: `tenantContextMiddleware.ts` line 97 assigned unfiltered `finalModules` to `tenantContext.modules` instead of availability-filtered `capabilityParentModules`
- Identified systemic root cause: `ModuleAvailabilityService` had no cache staleness detection — in-memory `availabilityMap` held stale lifecycleStatus values indefinitely
- Fixed `tenantContextMiddleware.ts:97` to use the filtered list
- Added 30-second TTL auto-refresh to `ModuleAvailabilityService` with concurrent-rebuild guard
- Added `ensureCacheFresh()` to `companyModuleGuard` to auto-refresh before checking availability
- Simplified confusing NOT_READY/SUSPENDED/AVAILABLE branches in `AuthPermissionsController`
- Added `runModuleStartupValidation()` to `runServer.ts` for local dev parity
- Verified `npm run build` passes with zero errors
- Created completion report at `1-TODO/done/45-module-lifecyclestatus-availability-fix.md`
**Result:** ✅ Done
**Next:** Select a new task from `ROADMAP.md` or `1-TODO/` based on the product owner's priority.

---

## 2026-04-27 (Mon) — 0.2h
**Task:** Log Data Contract Mismatch Issue
**Agent:** Antigravity (VS Code)
**What I Did:**
- Processed user audio report regarding a mismatch between frontend Voucher Forms and backend Voucher Types (specifically `quantity` vs `invoicedQuantity` in Sales Invoice).
- Created a formal backlog task `1-TODO/43-voucher-data-contract-mismatch.md` to define a strict data contract and fix the save/clone payload mismatch.
- Added the issue to the `ACTIVE.md` Rabbit Holes section to ensure it appears in the Command Center backlog.
**Result:** ✅ Done
**Next:** Select a new task from `ROADMAP.md` or `1-TODO/` (potentially the new Task 43 if prioritized by the product owner).

---

## 2026-04-27 (Mon) — 1.0h
**Task:** Investigate System Fields Rendering in Document Designer
**Agent:** Antigravity (VS Code)
**What I Did:**
- Investigated user report: "selected system fields are not appearing in the final form preview despite being correctly saved in the configuration."
- Analyzed `frontend/src/modules/tools/forms-designer/components/DocumentDesigner.tsx` and identified that `runAutoPlacement` correctly assigns system fields to `uiModeOverrides.sections`.
- Analyzed `frontend/src/modules/accounting/components/shared/GenericVoucherRenderer.tsx` and identified the root cause: The renderer requires `definition.headerFields` to generate `headerFieldMeta`.
- Confirmed that without `headerFieldMeta`, system fields lose their metadata (type, label, `autoManaged` flag), causing them to fail internal visibility and formatting checks in `GenericVoucherRenderer`.
- Proposed a fix: Update `DocumentDesigner` to construct a flat `headerFields` array to synchronize with `uiModeOverrides`, and ensure `isPreview` bypasses visibility checks.
- Created `implementation_plan.md` outlining the required synchronization code.
**Result:** 🔶 Diagnosed — implementation deferred (logged as Rabbit Hole).
**Next:** Select a new task from `ROADMAP.md` or `1-TODO/` based on the product owner's priority.

## 2026-04-27 (Mon) — 0.8h
**Task:** Fix duplicate Accounting voucher types/forms
**Agent:** Codex
**What I Did:**
- Confirmed live emulator data had duplicate default Accounting forms, especially legacy forms with `typeId=ACCOUNTING` plus newer canonical UUID/type forms
- Added a domain voucher form dedupe helper that collapses only system/default/locked forms by logical `module + canonical code`
- Updated Firestore voucher form listing to return deduped default forms while preserving custom user copies
- Fixed Accounting initialization so new default forms use canonical voucher codes instead of stamping every Accounting form as `ACCOUNTING`
- Updated company voucher template sync to skip creation when a logical default already exists and to dedupe legacy/canonical system templates
- Added regression tests for dedupe and template sync behavior
- Verified targeted tests, backend build, frontend build, and emulator repository output
**Result:** ✅ Done
**Next:** Manual browser QA on Accounting voucher lists; optional data cleanup script later for old physical duplicate default documents.

---

## 2026-04-27 (Mon) — 0.1h
**Task:** Create future sidebar permission QA task
**Agent:** Codex
**What I Did:**
- Added `1-TODO/42-sidebar-permission-qa.md`
- Scoped the task to one-permission-at-a-time sidebar visibility and direct-route testing
- Updated `ACTIVE.md` recommended next step to point to Task 42 when ready
**Result:** ✅ Done
**Next:** Start Task 42 later, beginning with Accounting permissions.

---

## 2026-04-27 (Mon) — ?h
**Task:** Fix custom company-role Accounting access
**Agent:** Codex
**What I Did:**
- (no details)
**Result:** ✅ Done

**Next:** (TBD)

---


## 2026-04-27 (Mon) — 0.6h
**Task:** Fix custom company-role Accounting access
**Agent:** Codex
**What I Did:**
- Added backend derivation of `moduleBundles` from selected company role permissions
- Updated Company Admin role create/update to persist derived `moduleBundles`
- Mirrored selected permissions into `explicitPermissions` and `resolvedPermissions` on create/update so deep permission checks use the saved role permissions
- Added regression tests for Accounting permission-derived module access and metadata-only role updates
- Verified targeted module-access tests still pass
- Verified backend and frontend builds
**Result:** ✅ Done
**Next:** Manually test by creating a fresh Accounting role, assigning it to a non-owner user, and confirming the sidebar and `/accounting` route work.

---

## 2026-04-27 (Mon) — 0.8h
**Task:** Fix recursive sidebar permission filtering
**Agent:** Codex
**What I Did:**
- Changed sidebar filtering to recursively apply each link's own permission instead of relying on top-level parent filtering
- Pruned empty parent groups after child filtering
- Assigned dynamic Accounting voucher/form sidebar entries the appropriate route permission
- Fixed sidebar/route permission mismatches for Inventory links
- Removed dead sidebar links with no matching route: inventory valuation, HR attendance/payroll, POS sessions
- Added route-level permissions for HR Employees, POS Terminal, CRM, Manufacturing, and Projects placeholder routes
- Added permission catalog entries for CRM/POS/Manufacturing/Projects placeholder permissions
- Normalized Manufacturing and Projects permission IDs so their prefixes match module IDs
- Updated onboarding seed permission IDs for those placeholder modules
- Verified sidebar route-permission audit returns 0 issues
- Verified `npm run build` in both `frontend/` and `backend/`
**Result:** ✅ Done
**Next:** Fix company role create/update to persist derived `moduleBundles`; without that, custom Accounting roles can still have permissions but no Accounting module access.

---

## 2026-04-27 (Mon) — 0.4h
**Task:** Analyze company user Accounting access 403/sidebar issue
**Agent:** Codex
**What I Did:**
- Traced Accounting route guards and sidebar filtering in the frontend
- Traced `/auth/me/permissions` module filtering in the backend
- Confirmed custom company role create/update stores selected `permissions` but not `moduleBundles`
- Identified why direct `/accounting` route returns 403: the route requires `requiredModule: 'accounting'`, and the user role grants no Accounting module
**Result:** 🔶 Diagnosed — implementation recommended
**Next:** Persist derived `moduleBundles` on company role create/update and add a regression test for custom Accounting roles

---

## 2026-04-27 (Sun) — 3.5h
**Task:** Full Project Audit + Vision + Gap Analysis + Roadmap
**Agent:** Antigravity (VS Code)
**What I Did:**
- Scanned entire codebase — all 8 modules, 126 routes, 18 backend controllers
- Conducted product Q&A with Product Owner — created `VISION.md`
- Deep traced 7 user journeys end-to-end
- Full gap scan: checked for payments, tax, discounts, quotations, print/PDF, serial/batch, email, credit limits, costing, reorder points, multi-currency, negative stock, year-end close
- Found many features are MORE complete than expected (tax, payment terms, credit limits, costing, VoucherPrintView, multi-currency, fiscal year close)
- Identified 6 real gaps: payment recording gate, invoice PDF, discounts, quotations, email, security rules
- Created final ROADMAP.md: 7 phases, 56+ test scenarios, testing-first approach
- Updated AGENTS.md to require VISION.md + ROADMAP.md reading
- Key insight from Product Owner: payment gate must live IN Sales/Purchases, not Accounting
- Overall completion: ~65%
**Result:** ✅ Done — planning complete
**Next:** Phase 1, Task 1.1 — Fix Forms Designer. Then test everything in 1B-1F.

---

## 2026-04-27 (Mon) — 0.8h
**Task:** Fix broken company user access flow
**Agent:** Codex
**What I Did:**
- Documented later plan/bundle ownership cleanup in `1-TODO/39-plan-bundle-ownership-cleanup.md`
- Changed company user add/invite use case to reject unknown emails instead of creating placeholder global users
- Preserved existing-user access grant behavior by creating company membership only for real users
- Changed onboarding routing so users with company access are not forced into user-level plan selection
- Updated company admin UI copy from "Invite User" to "Add User"
- Verified backend and frontend builds
**Result:** ✅ Done
**Next:** If users were already invited before this fix and cannot sign up, create a cleanup script for old placeholder `user_*` records and related company memberships

---

## 2026-04-27 (Mon) — 0.2h
**Task:** Confirm invite-user persistence behavior
**Agent:** Codex
**What I Did:**
- Traced `POST /company-admin/users/invite` through `CompanyUsersController` into `InviteCompanyUserUseCase`
- Confirmed missing emails create a placeholder `User` through `userRepository.createUser`
- Confirmed Firestore stores that placeholder in the top-level `users` collection
- Confirmed company membership is also created under `companies/{companyId}/users/{userId}`
**Result:** ✅ Done
**Next:** Review whether invite should create placeholder users or use a dedicated invitation record/status model

---

## 2026-04-27 (Sun) — 1.5h
**Task:** Full Project Audit + Product Vision
**Agent:** Antigravity (VS Code)
**What I Did:**
- Scanned entire codebase — all 8 modules, 126 routes, 18 backend controllers
- Created comprehensive audit: Accounting ~90%, Inventory ~80%, Sales ~75%, Purchases ~75%
- Overall completion: ~65%
- Conducted product Q&A with Product Owner — captured full vision
- Created `VISION.md` — the product bible (who uses it, how it works, what's the goal)
- Key insights captured: "simple for simple, pro for pro", module-as-engine concept, approval system, Forms Designer purpose
- Updated AGENTS.md to require reading VISION.md
- Updated 00-MASTER-PLAN.md with real module data
**Result:** ✅ Done
**Next:** Resume Forms Designer (active WIP), then fix Voucher Save for Sales/Purchase, then Firestore Security Rules

---

## 2026-04-27 (Sun) — 1h
**Task:** Audit & Update Master Plan
**Agent:** Antigravity (VS Code)
**What I Did:**
- Audited all 27 master plan items against actual codebase
- Confirmed 22/27 original items are done + 5 bonus plans (34-38)
- Found Plan 17 (Opening Balance) and Plan 18 (Balance Enforcement) are already implemented
- Found Plan 19 (Settings UX) is done via ModuleSettingsLayout
- Identified 8 truly remaining items
- Rewrote 00-MASTER-PLAN.md with accurate status
- Flagged: Firestore security rules expire June 1, 2026!
**Result:** ✅ Done
**Next:** Resume Forms Designer work (most recent active dev), then tackle Firestore Security Rules before June 1

---

## 2026-04-26 (Sat) — 2h
**Task:** Build Command Center Dashboard + Organize Development Process
**Agent:** Antigravity (VS Code)
**What I Did:**
- Created ACTIVE.md, JOURNAL.md, and AGENTS.md workflow system
- Built Command Center dashboard (localhost:5555) with project status, progress, subscriptions
- Created ERP03.bat launcher for one-click startup of all services
- Configured all 3 AI agents as autonomous CTOs
- Established the 3-Type Rule for handling discovered issues
**Result:** ✅ Done
**Next:** Audit master plan (outdated since Feb 2026)

---

## 2026-04-26 (Sat) — Session 0: Process Setup
**Task:** Organize development process
**Agent:** Antigravity (VS Code)
**What I Did:**
- Created `ACTIVE.md`, `JOURNAL.md`, and `AGENTS.md`
- Established the "5-Minute Resume" workflow
- Configured all 3 AI agents (OpenCode, Codex, Antigravity) to read ACTIVE.md first
**Result:** ✅ Process framework in place
**Next:** Pick first task from MASTER-PLAN and begin work

---

<!-- TEMPLATE — copy this for each new session:

## YYYY-MM-DD (Day) — Xh
**Task:** (task name)
**Agent:** (which AI agent / IDE)
**What I Did:**
- (bullet points)
**Result:** ✅ Done / 🔶 Partial / ❌ Blocked
**Commit:** (hash if committed)
**Next:** (what to do next session)

-->
