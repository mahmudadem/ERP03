# 267 — Engine Management API Doorways (Task 267-D)

**Date:** 2026-06-25
**Branch:** `codex/267-system-core-boundary-audit`
**Owner goal:** Expose the shared engine-owned `PolicyConfig` (created in Task 267-C) through safe backend API doorways — a company-wide Controls & Policies matrix plus per-module doorways for POS / Sales / Purchases, each permission-gated to its own module, writing the same neutral store, with no module route depending on another module being enabled.
**Slice:** 267-D only.
**Estimated time:** 2-4h (initial) + 0.6h (CTO corrections) = ~2.5-4.6h.

---

## 1. Summary

Implemented the engine management API doorways for the typed `PolicyConfig` defined in Task 267-C. The slice is **additive** — it does not change any existing route, controller, validator, persistence, or business logic. The legacy `POSPolicy` and `SellingPolicy` doorways continue to work unchanged. No posting, inventory movement, or item/catalog code was touched.

The shared store is now backed by a new Firestore implementation of `IPolicyConfigRepository`. Every module's policy doorway and the company-wide matrix write to the **same** `PolicyConfig` document per company (at `companies/{companyId}/systemCorePolicies/{companyId}`). The `PolicyEngine` was wired to consult that repository through its existing optional 4th constructor argument, so `resolveTyped(...)` is now backed by persisted rules out of the box.

A POS-only tenant, a Sales-only tenant, or a Purchases-only tenant can each manage the rules their module consumes without depending on any other module being enabled. Cross-module rules are rejected at the validator boundary with a 400 so a module can never silently rewrite another module's rules.

**CTO corrections applied 2026-06-25** (see § 13): the module doorway GET no longer returns unscoped TENANT rules and no longer rewrites their module tag; the module doorway PUT now preserves unscoped TENANT rules (including a hard period-lock); the Firestore repository now THROWS on a corrupt document so the engine's fail-closed `PolicyConfig.repositoryError` path is reachable instead of silently default-allowing. The corrections are pinned by 4 new tests.

## 2. Why this slice

Per the audit at [audits/267-system-core-boundary-inventory.md](../../audits/267-system-core-boundary-inventory.md), the policy-resolution concern was the largest hybrid on the engine map and was explicitly called out as the highest-priority remediation. Task 267-C added the typed `PolicyConfig` foundation; Task 267-D is the doorway slice called out in the execution plan:

> "Slice 267-D — Engine Management API Doorways. `GET/PUT /tenant/settings/controls/policies` and per-module policy routes. Each route is permission-gated to its own module and never hidden behind another module's `moduleInitializedGuard`."

Without doorways, the typed config is unreachable from any UI, and the owner-flagged POS-vs-Sales-vs-Purchases approval example cannot be expressed as a one-line rule per module. This slice is the smallest change that makes the doorways exist.

## 3. Files

### New
- `backend/src/infrastructure/firestore/repositories/system-core/FirestorePolicyConfigRepository.ts` — Firestore implementation. One `PolicyConfig` document per company, key path `companies/{companyId}/systemCorePolicies/{companyId}`. A missing document returns `null`; a present-but-corrupt document now **THROWS** (see § 13) so `PolicyEngine.resolveTyped` reaches its fail-closed `PolicyConfig.repositoryError` path. A small `isPolicyConfigShape` guard validates the raw payload BEFORE the lenient `PolicyConfig.fromJSON` runs.
- `backend/src/api/validators/policyConfig.validators.ts` — **neutral** shape validator. Exports `validateUpdatePolicyConfigInput` (full-matrix) and `validateAndFilterModuleRules(body, moduleName)` (per-module filter that force-stamps the module tag and rejects cross-module tags with 400). Untagged incoming rules are force-stamped to the current module (the validator contract — pinned by `validateAndFilterModuleRules` in the controller PUT flow). Lives in the neutral `api/validators/` directory so no module imports another module's validator.
- `backend/src/api/controllers/system-core/PolicyConfigController.ts` — controller for the company-wide matrix. Tenant isolation: `companyId` is taken from `req.tenantContext.companyId` (or `req.user.companyId`), never from the body.
- `backend/src/api/routes/settings.controls.routes.ts` — Express router mounted at `/settings/controls` on the tenant router, so the final route is `/tenant/settings/controls/policies`. Gated by `ownerOrPermissionGuard('system.company.manage')` so owners automatically bypass the permission check.
- `backend/src/tests/infrastructure/firestore/system-core/FirestorePolicyConfigRepository.test.ts` — 7 tests pinning the save/load contract, missing-document null return, entity-boundary guard, transaction path, full multi-rule round-trip, **THROWS on a malformed stored document (CTO 267-D)**, and **THROWS on a stored document whose rules fail entity validation (CTO 267-D)**.
- `backend/src/tests/api/controllers/system-core/PolicyConfigController.test.ts` — 5 tests for the company-wide matrix: GET (existing + default), PUT (full multi-module write, malformed rule rejection, forged-companyId rejection).
- `backend/src/tests/api/controllers/pos/PosPolicyConfigController.test.ts` — 6 tests for the POS doorway: GET returns ONLY POS-tagged rules (does NOT include unscoped TENANT rules), GET returns default empty, PUT writes POS rules and preserves rules for other modules, **PUT preserves an existing unscoped TENANT hard rule (CTO 267-D)**, PUT rejects cross-module rule, forged-companyId rejection.
- `backend/src/tests/api/controllers/sales/SalesPolicyConfigController.test.ts` — same 6 tests for the Sales doorway.
- `backend/src/tests/api/controllers/purchases/PurchasePolicyConfigController.test.ts` — same 6 tests for the Purchases doorway.

### Modified (additive)
- `backend/src/infrastructure/di/bindRepositories.ts` — imports the new repository and the new binding, adds `policyConfigRepository` to the DI container, and wires the existing 4th constructor argument of `PolicyEngine` so the new repository is used by `resolveTyped(...)`.
- `backend/src/api/server/tenant.router.ts` — mounts the new `settings.controls.routes.ts` at `/settings/controls`.
- `backend/src/api/routes/pos.routes.ts` — adds `GET/PUT /policies` routes (gated by `pos.settings.manage`).
- `backend/src/api/routes/sales.routes.ts` — adds `GET/PUT /policies` routes (gated by `sales.settings.manage`).
- `backend/src/api/routes/purchases.routes.ts` — adds `GET/PUT /policies` routes (gated by `purchase.settings.manage`).
- `backend/src/api/controllers/pos/PosController.ts` — adds `getPolicies` + `updatePolicies` static methods. The GET filter is `rule.module === 'pos'` (no unscoped TENANT rules; no module-tag rewrite). The PUT `preservedRules` filter is `rule.module !== 'pos'` (preserves every other rule including unscoped TENANT hard rules). (CTO 267-D corrections.)
- `backend/src/api/controllers/sales/SalesController.ts` — same pattern with the `'sales'` module tag. (CTO 267-D corrections.)
- `backend/src/api/controllers/purchases/PurchaseController.ts` — same pattern with the `'purchases'` module tag. (CTO 267-D corrections.)
- `backend/src/tests/architecture/SystemCoreBoundaries.test.ts` — adds one new **non-failing** export/structure guard verifying the new repository file is in place. No existing guard was weakened or deleted.

## 4. Routes and permissions

| URL | Method | Permission | Gated by | Notes |
| --- | --- | --- | --- | --- |
| `/tenant/settings/controls/policies` | GET / PUT | `system.company.manage` (owner bypass) | `ownerOrPermissionGuard` | Company-wide matrix. Full rule set. |
| `/tenant/pos/policies` | GET / PUT | `pos.settings.manage` | `permissionGuard` | POS-scoped. Rejects non-POS rules. Module mounted via `companyModuleGuard('pos')` + tenant middleware; no `moduleInitializedGuard` (POS has no setup wizard). |
| `/tenant/sales/policies` | GET / PUT | `sales.settings.manage` | `permissionGuard` | Sales-scoped. Rejects non-Sales rules. Module-mounted via `companyModuleGuard('sales')`; the existing `moduleInitializedGuard('sales')` applies (Sales has a setup wizard). The doorway only depends on Sales being initialized — never on POS, Purchases, or Accounting. |
| `/tenant/purchases/policies` | GET / PUT | `purchase.settings.manage` | `permissionGuard` | Purchases-scoped. Rejects non-Purchases rules. Module-mounted via `companyModuleGuard('purchase')`; the existing `moduleInitializedGuard('purchase')` applies. Only depends on Purchases being initialized. |

**Single source of truth:** all four routes read and write the same `PolicyConfig` document per company. Module doorways filter on read and merge-on-write so saving a POS-scoped rule does not erase a Sales-scoped rule (and vice versa).

## 5. Behaviour preservation (the critical contract)

The brief's hard line: **do not change the legacy `IPolicyEngine.resolve()` outputs, do not touch the existing POS / SellingPolicy doorways, and do not touch posting/inventory/frontend**. Confirmed by re-running the legacy suites as part of verification — they pass without any source change. Specifically:

- `src/tests/application/pos/PolicyEnginePosPolicy.test.ts` — 4/4 pass.
- `src/tests/application/system-core/PolicyEngineCommercialBelowCost.test.ts` — 3/3 pass.
- `src/tests/architecture/SystemCoreBoundaries.test.ts` — 16/16 pass (15 existing + 1 new non-failing guard for 267-D).
- `src/tests/application/system-core` full sweep — 13 suites / 82 tests pass.
- `src/tests/application/pos` full sweep — 15 suites / 111 tests pass (no regression in any existing POS suite).
- `src/tests/application/sales` full sweep — 26 suites / 280 tests pass.
- `src/tests/application/purchases` full sweep — 9 suites / 85 tests pass.
- `src/tests/infrastructure` — 2 suites / 10 tests pass.
- `src/tests/api` — 9 suites / 39 tests pass.
- `src/tests/application` (full sweep) — 127 suites / 1225 tests pass.
- `npm run build` — TypeScript clean.

The new typed path is wired so that any module can opt in by either (a) calling `engine.resolveTyped(...)` directly, or (b) registering adapter rules that re-express its existing compatibility source as `PolicyConfig` rules. Existing `POSPolicy`, `SellingPolicy`, `AccountingPolicyRegistry`, and `DocumentPolicyResolver` are unchanged.

## 6. Module independence contract

The brief was emphatic: "A shared setting needs a doorway in EVERY module that uses it — not just one. … If this tenant had ONLY the POS module enabled, could a POS-only user still set this?" This slice makes that litmus test pass:

- The POS `/policies` route lives on the POS module router. It does not import Sales, Purchases, or Accounting validators or controllers. It uses the neutral `policyConfig.validators.ts` + the POS module's own `pos.settings.manage` permission.
- The Sales `/policies` route is gated only by Sales's own setup state (via `moduleInitializedGuard('sales')`) and `sales.settings.manage`. It does not depend on POS / Purchases / Accounting being enabled.
- The Purchases `/policies` route is gated only by Purchases's own setup state and `purchase.settings.manage`. It does not depend on POS / Sales / Accounting being enabled.
- The company-wide matrix is gated by `system.company.manage` (owner bypass) and is reachable even when only the POS module is enabled.

The validator contract — a per-module doorway cannot accept a rule tagged for another module — is pinned in the per-module controller tests (`PUT rejects rules tagged for another module with a 400`).

## 7. Tenant isolation contract

- The `companyId` is always resolved from `req.tenantContext.companyId` / `req.user.companyId`. The request body is NEVER allowed to override the company id.
- Pinned by the per-controller test `PUT uses the auth companyId — tenant isolation` (one per module + one for the company-wide matrix).
- A `PolicyConfig` document is keyed by `companyId`; a forged `companyId` in the body is silently dropped, and the controller stamps the auth context's companyId on every persisted rule.

## 8. Forbidden areas (NOT touched)

Verified explicitly:
- No `SubledgerVoucherPostingService.postInTransaction` or `PostingGateway.record` from a new code path.
- No new `new StockMovement(...)` / `new StockLevel(...)` / `StockLevel.createNew(...)` / `StockLevel.fromJSON(...)` (architecture guard still passes; same 14 existing sales/POS guards and the new 267-D guard are green).
- No Sales / Purchases / Inventory posting code touched.
- No `POSPolicy` or `SellingPolicy` persistence removed. Their repositories, controllers, routes, and validators are byte-for-byte unchanged.
- No frontend code touched.
- No `opencode.json` modification.

## 9. Risks / known follow-ups

- **Firestore-only persistence.** The `IPolicyConfigRepository` interface supports both Firestore and a future Prisma/SQL implementation (mirroring `ISellingPolicyRepository`). A Prisma impl is not in this slice — same pre-alpha posture as the SellingPolicy / PosPolicy repositories.
- **Accounting doorway deferred.** Per the brief, the Accounting doorway is "only if it fits existing accounting settings patterns without broad refactor." The existing `/tenant/accounting/policy-config` route already serves accounting-specific `Account` settings via a different store; this slice does NOT replace it. Adding a `module: 'accounting'` doorway is a follow-up that can land with the engine management UI slice (267-E).
- **No adapter rules yet.** `POSPolicy`, `SellingPolicy`, `AccountingPolicyRegistry`, and `DocumentPolicyResolver` are still the source of truth for their domains. The legacy `resolve({ scope, action, ... })` facade is unchanged. Adapter rules that re-express these compatibility sources as `PolicyConfig` rules are a follow-up and can land with the management-UI slice.
- **No audit emission yet.** The new path returns the same `decision / reasonCode / effectiveRuleId / approvalSubject` that the typed engine already produces; emitting them through `IAuditEngine` lands with the management-UI slice once the doorways are in place and a use site is wired.

## 10. Documentation produced

- **Solo developer:** this completion report, `planning/JOURNAL.md` (session summary appended), `planning/ACTIVE.md` (current focus updated to 267-D).
- **Future developers:** `docs/architecture/policy-engine.md` (already exists from Task 267-C) lists the foundation files and the doorway contract; this completion report documents the new files and the routes/permissions.
- **End users:** No user-facing change in this slice. End-user docs land with 267-E (the management-UI slice).

## 11. Definition of Done — every feature

- [x] Code merged (work landed on `codex/267-system-core-boundary-audit`, all required verification commands green).
- [x] `docs/architecture/policy-engine.md` updated to reflect the new repository and the doorway contract.
- [ ] `docs/user-guide/<module>/<feature>.md` — **N/A for this slice** (no user-facing change). Will land with 267-E.
- [x] `planning/done/267-engine-management-api-doorways.md` — this file.
- [x] `planning/JOURNAL.md` appended with session summary.
- [x] `planning/ACTIVE.md` updated with current focus (267-D) and the next task (267-E).

## 12. Reviewer blockers (from the brief)

Checked each:

- shared logic added inside Sales/Purchases/POS/Inventory instead of System Core? — **No.** All shared logic lives in `application/system-core/*`, `domain/system-core/*`, and `infrastructure/firestore/repositories/system-core/*`. The new controller `PolicyConfigController` lives in `api/controllers/system-core/`, mirroring the engine-owned seam.
- module route for shared config hidden behind another module's enablement? — **No.** Each module route is gated by its own module's `permissionGuard` (and the existing per-module `moduleInitializedGuard` for Sales/Purchases — never for another module). The POS route has no `moduleInitializedGuard`, matching the existing POS pattern (POS has no setup wizard).
- POS-only, Sales-only, or Purchases-only tenant can manage the policy it consumes? — **Yes.** Each module's `/policies` route is reachable when only that module is enabled (no cross-module dependencies).
- posting, tax, COGS, stock valuation, AP/AR, settlement, or period-lock behavior changed? — **No.** No posting code touched.
- direct new `SubledgerVoucherPostingService` or `PostingGateway` source-module usage introduced? — **No.** Architecture guard `250k: POS financial events must route through IAccountingBridge` still passes.
- new `StockMovement` / `StockLevel` construction introduced outside inventory core? — **No.** Architecture guard `FUP-4: Sales must not construct inventory sub-ledger movements/levels` still passes.
- user-facing frontend strings hardcoded? — **N/A** (no frontend in this slice).
- tests or boundary guards weakened? — **No.** All 14 existing architecture guards pass; one new non-failing guard added.
- docs missing? — **No.** Architecture doc + this completion report both present.
- `opencode.json` modified? — **No.** Forbidden, not touched.
- legacy `POSPolicy` / `SellingPolicy` routes/handlers changed? — **No.** Their routes, controllers, and validators are byte-for-byte unchanged.
- **module doorway corrupts unscoped company-wide/tenant rules?** — **No.** The module GET no longer includes unscoped TENANT rules and no longer rewrites their module tag. The module PUT now preserves unscoped TENANT rules (including hard rules). Pinned by 3 new tests (`PUT preserves an existing unscoped TENANT hard rule (CTO 267-D)` per module) and the rewritten "GET returns ONLY `<module>`-tagged rules (does NOT include unscoped TENANT rules)" tests.
- **repository fails open on a malformed document?** — **No.** `getConfig` now throws on a present-but-corrupt document so the engine's fail-closed `PolicyConfig.repositoryError` path is reachable. A missing document is still `null` (the default-allow fallback is correct for "no config yet"). Pinned by 2 new tests (`THROWS on a malformed stored document` and `THROWS on a stored document whose rules fail entity validation`).

## 13. CTO corrections applied (2026-06-25)

CTO review of the initial 267-D slice flagged two accounting-control risks that had to be fixed before merge. Both have been fixed in place, with the corrections pinned by new tests. No public API surface changed; the contract is now stricter.

### 13.1 Module doorway no longer corrupts unscoped TENANT rules

**Before (buggy):**
- Module GET filter was `rule.module === undefined || rule.module === '<module>'` followed by `.map((rule) => ({ ...rule, module: '<module>' }))`. Unscoped TENANT rules were returned to a module editor and silently had their module tag rewritten to the module's name. A hard period-lock TENANT rule could be presented as a module-scoped rule on every read.
- Module PUT preservation filter was `rule.module !== undefined && rule.module !== '<module>'`. Every rule without a defined module tag (e.g. an unscoped TENANT hard rule) was silently DELETED on every module save. The company-wide matrix would then show the rule gone, with no audit trail.

**After (correct):**
- Module GET filter is `rule.module === '<module>'` only. The map rewrite is gone. Unscoped TENANT/company-wide rules are owned exclusively by the company-wide matrix.
- Module PUT preservation filter is `rule.module !== '<module>'`. Untagged rules (e.g. a hard unscoped TENANT period lock) survive every module save. Pinned by the new test `PUT preserves an existing unscoped TENANT hard rule (CTO 267-D)` in each of POS / Sales / Purchases controller tests.

### 13.2 Repository no longer fails open on a corrupt document

**Before (buggy):**
- `getConfig` had a `try { return PolicyConfig.fromJSON(data); } catch { return PolicyConfig.createDefault(companyId); }` block. `PolicyConfig.fromJSON` is intentionally lenient (it coerces a non-array `rules` to `[]`), so a corrupt payload like `{ companyId, rules: 'not-an-array' }` would yield an empty rule set, which the resolver would treat as "no rules → ALLOW" — a fail-open grant of permissions the tenant never configured. The engine's `resolveTyped` `repositoryError` fail-closed path was unreachable from this scenario.

**After (correct):**
- `getConfig` runs a strict shape check (`isPolicyConfigShape`) on the raw Firestore payload BEFORE the lenient `PolicyConfig.fromJSON` runs. The check verifies: `data` is a plain object; `companyId` is a non-empty string; `rules` is an array. Any present-but-corrupt document throws an `Error` with a descriptive message. The engine's `resolveTyped` catch surfaces it as `PolicyConfig.repositoryError` (BLOCK) and the audit chain records the degraded mode. A missing document is still `null` (the engine's default-allow fallback is correct for "no config yet", which is NOT the same as "config is corrupt"). Pinned by the new tests `THROWS on a malformed stored document` and `THROWS on a stored document whose rules fail entity validation`.

### 13.3 Corrected verification

All four required verification commands green after the corrections:

- `npm --prefix backend test -- --runInBand src/tests/api/controllers/pos src/tests/api/controllers/sales src/tests/api/controllers/purchases src/tests/api/controllers/system-core src/tests/infrastructure/firestore/system-core` — 5 suites / 30 tests pass (was 26 before the fix; +4 from the new unscoped-TENANT preservation tests and the renamed/expanded repository tests).
- `npm --prefix backend test -- --runInBand src/tests/application/system-core src/tests/domain/system-core/PolicyConfig.test.ts` — 13 suites / 82 tests pass.
- `npm --prefix backend test -- --runInBand src/tests/application/pos/PolicyEnginePosPolicy.test.ts src/tests/application/system-core/PolicyEngineCommercialBelowCost.test.ts` — 2 suites / 7 tests pass.
- `npm --prefix backend test -- --runInBand src/tests/architecture/SystemCoreBoundaries.test.ts` — 16/16 pass (14 existing + 1 new 267-C guard + 1 new 267-D guard).
- `npm --prefix backend run build` — TypeScript clean.

Wider regression sweeps: `application/pos` 15/15 / 111, `application/sales` 26/26 / 280, `application/purchases` 9/9 / 85, `infrastructure` 2/2 / 11, `api` 9/9 / 42, `architecture` 3/3 / 24, full `application` sweep 127/127 / 1225.
