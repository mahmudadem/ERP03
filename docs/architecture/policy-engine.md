# Policy Resolution Engine

**Status:** Foundation slice (Task 267-C). Behavior-preserving; the legacy `IPolicyEngine.resolve(...)` string-scope facade keeps working untouched.

**Owner goal:** Make every shared policy decision — a tenant default, a module override, a role/user/context rule, a hard system rule — flow through one engine-owned resolver so a POS-only tenant, a Sales-only tenant, and a Purchases-only tenant all answer the same question with the same answer.

---

## 1. The old way (pre-267)

`IPolicyEngine.resolve(request)` was a string-scope facade. The engine held a `switch` over `(scope, action)` tuples, dispatched to four compatibility adapters (POS policy, Selling policy, Accounting policy registry, Document policy resolver), and defaulted to **ALLOW** for anything it didn't recognise.

This is too small for the platform:

- It cannot model "company default → module override → role/user/register/context override" precedence.
- It cannot return a structured decision (`ALLOW` / `BLOCK` / `REQUIRE_APPROVAL`) with a `reasonCode` and an `effectiveRuleId`.
- It cannot attach an `ApprovalSubject` so the engine hands off cleanly to `IApprovalEngine` instead of asking each module to wire its own approval handoff.
- Adding a new module action meant growing the `switch` instead of registering a data-driven rule.

## 2. The new foundation (Task 267-C)

A **typed**, **data-driven** precedence engine that lives in System Core. The legacy facade still works; the new path is additive.

### 2.1 Domain model

`backend/src/domain/system-core/entities/PolicyConfig.ts` — a `PolicyConfig` is one document per company containing a list of `PolicyRule` records. A rule has:

| Field            | Purpose                                                                                |
| ---------------- | -------------------------------------------------------------------------------------- |
| `id`             | Stable identifier, used in `effectiveRuleId` and audit.                                |
| `module`         | Optional module tag (`'pos'`, `'sales'`, `'purchases'`, `'accounting'` …).              |
| `action`         | The verb being decided (`'directSale'`, `'invoicePosting'`, `'priceOverride'` …).      |
| `scope`          | `'TENANT' \| 'MODULE' \| 'ROLE' \| 'USER' \| 'CONTEXT'`.                               |
| `effect`         | `'ALLOW' \| 'BLOCK' \| 'REQUIRE_APPROVAL'`.                                            |
| `isHard`         | When `true`, the rule cannot be overridden by lower scopes or by an approved override. |
| `requireApprovalAbove` | Threshold shortcut: REQUIRE_APPROVAL is only emitted above this amount.          |
| `conditions`     | `{ amount?: { op, value }, match?: { registerId?, roleId?, … } }`.                     |
| `approvalSubject`| Optional `IApprovalEngine.ApprovalSubject` handoff metadata.                           |
| `reasonCode`     | Stable code for audit / UIs / i18n.                                                    |
| `priority`       | Tie-breaker within a scope.                                                            |

### 2.2 Repository

`backend/src/repository/interfaces/system-core/IPolicyConfigRepository.ts` — neutral store. One `PolicyConfig` per company. A Firestore implementation is intentionally **deferred** to a later slice so this foundation stays pure (no DI churn, no migration noise). A future slice can add `FirestorePolicyConfigRepository` and wire it into `bindRepositories.ts` without touching any policy logic.

### 2.3 Contract extension (additive)

`backend/src/application/system-core/contracts/IPolicyEngine.ts`:

- `PolicyResolveResult` gains **optional** fields: `decision?`, `reasonCode?`, `effectiveRuleId?`, `approvalSubject?`. Existing callers that only read `allowed / requiresApproval / resolvedBy` compile and run unchanged.
- New request/result types: `TypedPolicyResolveRequest`, `PolicyDecision`.
- New method: `resolveTyped(request): Promise<PolicyResolveResult>`. Returns a fully populated result for new callers.

### 2.4 Precedence engine

`backend/src/application/system-core/policy/PolicyResolver.ts` — pure function, no I/O. Given a `PolicyConfig` and a `TypedPolicyResolveRequest`, it returns a `PolicyResolveResult` and a `trace` of every rule that was considered (matched or not).

Precedence (highest first):

1. **Hard rules** at any scope — absolute; cannot be overridden.
2. **TENANT** (company-wide default).
3. **MODULE** (per-module override).
4. **ROLE** (per-role override, matched by `conditions.match.roleId`).
5. **USER** (per-user override, matched by `conditions.match.userId`).
6. **CONTEXT** (per-register / terminal / warehouse / branch / voucherType override).
7. **Approved override** (clears non-hard BLOCK / REQUIRE_APPROVAL).

At each level the most restrictive effect wins (`BLOCK > REQUIRE_APPROVAL > ALLOW`); ties break by `priority` desc. A matched level overrides the previous level's choice (more specific wins).

`requireApprovalAbove` is a threshold shortcut: when set, `REQUIRE_APPROVAL` is only emitted if the request's `context.amount` exceeds the threshold; below the threshold the rule degrades to `ALLOW`.

### 2.5 Engine wiring

`backend/src/application/system-core/PolicyEngine.ts` — the `PolicyEngine` now optionally takes an `IPolicyConfigRepository` as its 4th constructor argument. The legacy `resolve(...)` keeps its 1–3 argument signature working (all existing call sites compile unchanged). The new `resolveTyped(...)` is the typed entry point.

`LegacyPolicyEngineAdapter` (used in legacy DI paths that don't have `POSPolicy` or `CommercialCore` available) implements `resolveTyped` as a safe default-allow so it never breaks old callers.

## 3. Compatibility sources

The new engine is **additive**. The existing compatibility sources are unchanged and remain the source of truth for their domains:

- `POSPolicy` (POS direct sales, terminal policies, cashier role policies, manager override actions, sale line controls) — still owned by `IPosPolicyRepository` and consulted by the legacy `resolve({ scope: 'pos', … })` branches.
- `SellingPolicy` (below-cost / minimum-margin) — still owned by `ISellingPolicyRepository` and consulted by the legacy `resolve({ scope: 'commercial', action: 'belowCostSale' })` branch via `ICommercialCore`.
- `AccountingPolicyRegistry` (voucher-type approval) — still consulted by the legacy `resolve({ scope: 'accounting', action: 'postingApprovalRequired' })` branch.
- `DocumentPolicyResolver` (Sales / Purchases invoice personas) — still consulted by the legacy `resolve({ scope: 'sales' | 'purchases', action: 'invoicePersonaAllowed' })` branch.

A future slice can write **adapter rules** that re-express these compatibility sources as `PolicyConfig` rules (one-shot) and migrate call sites. This slice does not touch them.

## 4. Behaviour-preservation contract

The foundation explicitly does NOT change the legacy `resolve(...)` outputs. The brief's verification commands confirm this:

- `npm --prefix backend test -- --runInBand src/tests/application/system-core` — all existing suites pass.
- `npm --prefix backend test -- --runInBand src/tests/application/pos/PolicyEnginePosPolicy.test.ts src/tests/application/system-core/PolicyEngineCommercialBelowCost.test.ts` — all POS + below-cost policy tests pass without modification.
- `npm --prefix backend test -- --runInBand src/tests/architecture/SystemCoreBoundaries.test.ts` — the existing 14 architecture guards pass and one new non-failing export guard is added.
- `npm --prefix backend run build` — TypeScript clean.

## 5. What is NOT in this slice

- No Firestore repository implementation (deferred to a persistence slice).
- No DI wiring change in `bindRepositories.ts` (the constructor argument is optional and existing call sites compile unchanged).
- No migration of POS / Sales / Purchases call sites — those land in slice 267-D (engine management doorways) and 267-F (Accounting bridge migration) with golden tests.
- No UI / API doorway changes — those land in slice 267-D / 267-E.
- No removal of `POSPolicy`, `SellingPolicy`, `AccountingPolicyRegistry`, or `DocumentPolicyResolver`. They are compatibility sources for the legacy facade.

## 6. Files added / changed

| File                                                                                                          | Change                                                                                       |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `backend/src/domain/system-core/entities/PolicyConfig.ts`                                                     | New. Typed entity, rule normalisation, `findRules` precedence sorter.                        |
| `backend/src/repository/interfaces/system-core/IPolicyConfigRepository.ts`                                    | New. Neutral store interface.                                                                |
| `backend/src/application/system-core/contracts/IPolicyEngine.ts`                                              | Extended (additive). New `TypedPolicyResolveRequest`, optional result fields, `resolveTyped`. |
| `backend/src/application/system-core/policy/PolicyResolver.ts`                                                | New. Pure precedence engine + trace.                                                         |
| `backend/src/application/system-core/PolicyEngine.ts`                                                         | Extended (additive). Optional `IPolicyConfigRepository` ctor arg; new `resolveTyped` method. |
| `backend/src/application/system-core/adapters/LegacyPolicyEngineAdapter.ts`                                   | Extended (additive). Implements `resolveTyped` as a safe default-allow.                      |
| `backend/src/tests/application/system-core/PolicyResolver.test.ts`                                            | New. Precedence contract tests (tenant default, module override, hard rule, threshold, role / user / context overrides, approved-override escape hatch). |
| `backend/src/tests/application/system-core/PolicyEngineTypedResolution.test.ts`                                | New. Wired-engine tests for `resolveTyped` (incl. missing companyId, missing repo, repository throws, hard-vs-module cross-rule). |
| `backend/src/tests/architecture/SystemCoreBoundaries.test.ts`                                                 | Extended (additive). One non-failing export/structure guard for the foundation files.        |
| `docs/architecture/policy-engine.md`                                                                          | New. This file.                                                                              |
| `planning/done/267-policy-resolution-engine-foundation.md`                                                    | New. Completion report.                                                                      |
| `planning/ACTIVE.md`, `planning/JOURNAL.md`                                                                  | Updated with the foundation entry.                                                           |

## 7. Test coverage

`PolicyResolver.test.ts` pins every rule the brief calls out:

- Tenant default blocks an action.
- Module override requires approval.
- Hard rule blocks even when module override allows.
- POS terminal direct sale can allow without approval.
- Sales invoice posting requires approval over threshold.
- Purchase invoice posting requires approval over threshold.
- Result includes `decision`, `reasonCode`, `resolvedBy`, and effective rule metadata.
- Role override wins over module override when matching.
- Context override can exempt a specific terminal from a tenant BLOCK.
- Approved override clears non-hard BLOCK but cannot override a hard BLOCK.
- User override wins over role override when both match.
- Null config returns ALLOW with a `PolicyConfig.absent` reasonCode.

`PolicyEngineTypedResolution.test.ts` pins the wired engine:

- Returns BLOCK with `missingCompanyId` when companyId is empty.
- Returns ALLOW (`noMatchingRule`) when no repo is wired and no rules exist.
- Consults the wired `IPolicyConfigRepository` and produces a fully populated result.
- Hard rule wins over module override.
- POS terminal direct sale can allow without approval when module override is ALLOW.
- Legacy `resolve()` facade is unchanged.
- Fails closed with `PolicyConfig.repositoryError` when the repository throws.

## 8. Next slices (NOT in this one)

- **267-D** — Engine management API doorways. `GET/PUT /tenant/settings/controls/policies` and per-module policy routes. Each route is permission-gated to its own module and never hidden behind another module's `moduleInitializedGuard`. ✅ Done (CTO-corrected).
- **267-E** — Engine management UI. Business-language labels, full matrix page + module-specific controls. ✅ Done — see §9 below.
- **267-F** — Accounting bridge migration with golden voucher-output tests.
- **267-G** — Inventory core ownership completion for purchase-side stock movement.
- **267-H** — Catalog / item engine plan and implementation.

## 9. Engine management UI doorways (Task 267-E)

The typed `PolicyConfig` store has four equidistant, independent entry points in the UI. The store is single-source-of-truth; the doorways do not own data, they only edit the slice they are allowed to see.

### 9.1 File map

| Concern | API | Route | Component |
|---|---|---|---|
| Company-wide matrix (full + unscoped TENANT rules) | `GET/PUT /tenant/settings/controls/policies` | `/settings/controls-and-policies` | `frontend/src/modules/settings/pages/ControlsAndPoliciesPage.tsx` |
| POS controls (POS-tagged rules only) | `GET/PUT /tenant/pos/policies` | `/pos/settings` → **Controls** tab | `frontend/src/components/shared/ModuleControlsTab.tsx` |
| Sales controls | `GET/PUT /tenant/sales/policies` | `/sales/settings` → **Controls** tab | `frontend/src/components/shared/ModuleControlsTab.tsx` |
| Purchases controls | `GET/PUT /tenant/purchase/policies` | `/purchases/settings` → **Controls** tab | `frontend/src/components/shared/ModuleControlsTab.tsx` |

Shared building blocks:
- `frontend/src/components/shared/PolicyRulesEditor.tsx` — business-language matrix table + add/delete, with `allowedModule` to lock the module tag for module doorways.
- `frontend/src/components/shared/ModuleControlsTab.tsx` — self-contained load/save/discard body a module settings tab hosts.
- `frontend/src/api/controlsPoliciesApi.ts` — neutral company-wide client (not owned by any module).
- `posApi.getPolicies/updatePolicies`, `salesApi.getPolicies/updatePolicies`, `purchasesApi.getPolicies/updatePolicies` — module-local clients.

### 9.2 Invariants enforced by the UI

- **No forged `companyId`.** None of the API clients put a `companyId` in the request body; the shared axios client attaches `x-company-id` from the active-company context interceptor. The backend ignores any body-level `companyId` and resolves `companyId` from `tenantContext.companyId` (or `user.companyId`), so a client cannot address another tenant's store.
- **Module doorways never show or persist unscoped / other-module rules.** The backend already (a) returns only `module === <module>` rules on GET (CTO 267-D fix) and (b) force-stamps the module tag and rejects cross-module tags with 400 on PUT, while preserving unscoped TENANT rules untouched. The UI renders exactly what the module doorway returns, so unscoped company-wide rules never round-trip from a module editor.
- **Business wording.** The word "engine" never appears in user copy (AGENTS.md rule). All visible strings live in the shared `controls` i18n namespace (`frontend/src/locales/{en,ar,tr}/controls.json`), registered in `i18n/config.ts` alongside the existing namespaces.
- **Toast on every save.** `react-hot-toast` `success` / `error` on each doorway save, matching the existing module-settings convention.
- **Zero posting/tax/stock/ledger/approval behavior changes.** This slice is UI-only; backend regression suites and the `SystemCoreBoundaries` guard are unchanged.

### 9.3 Permissions

| Doorway | Permission | Gate |
|---|---|---|
| Company matrix | `system.company.manage` (owner bypass) | `ownerOrPermissionGuard` |
| POS controls | `pos.settings.manage` | `permissionGuard` |
| Sales controls | `sales.settings.manage` | `permissionGuard` |
| Purchases controls | `purchase.settings.manage` | `permissionGuard` |

A POS-only tenant with `pos.settings.manage` reaches its Controls tab even when Sales, Purchases, and the Company matrix screens are not entitled — the 🚩 litmus test passes for every consuming module.
