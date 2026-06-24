# 267 — Policy Resolution Engine foundation (Task 267-C)

**Date:** 2026-06-25  
**Branch:** `codex/267-system-core-boundary-audit`  
**Owner goal:** Make every shared policy decision — tenant default, module override, role/user/context rule, hard system rule — flow through one engine-owned resolver, behavior-preserving.  
**Slice:** 267-C only.  
**Estimated time:** ~3-4h. Actual: see JOURNAL entry.

---

## 1. Summary

Implemented the typed Policy Resolution Engine foundation in `application/system-core/*`. The existing `IPolicyEngine.resolve({ scope, action, ... })` string-scope facade is preserved untouched; a new `IPolicyEngine.resolveTyped(...)` is added next to it. The new path consults an engine-owned `PolicyConfig` document and a pure-function `PolicyResolver` that walks the precedence chain (hard → tenant → module → role → user → context → approved override) and returns a fully populated `PolicyResolveResult` with `decision`, `reasonCode`, `effectiveRuleId`, and optional `approvalSubject`.

The slice is intentionally **foundation-only** — no DI churn, no Firestore repository, no migration of call sites, no UI. Those land in slices 267-D / 267-E / 267-F / 267-G with golden tests and per-module audit.

## 2. Why this slice first

Per `planning/audits/267-system-core-boundary-inventory.md`, the policy-resolution concern was the largest hybrid on the engine map. The owner-flagged POS-vs-Sales-vs-Purchases approval example ("POS terminal direct sale can post without approval, but Sales / Purchases invoice posting requires approval over a threshold") cannot be expressed as a data-driven rule without first having a typed resolver. The foundation is the smallest change that makes that example possible, with the smallest possible blast radius.

## 3. Files

### New
- `backend/src/domain/system-core/entities/PolicyConfig.ts` — neutral typed entity. `PolicyRule` is `id + module + action + scope + effect + isHard + requireApprovalAbove + conditions + approvalSubject + reasonCode + priority`.
- `backend/src/repository/interfaces/system-core/IPolicyConfigRepository.ts` — neutral store interface (`getConfig` / `saveConfig`).
- `backend/src/application/system-core/policy/PolicyResolver.ts` — pure precedence engine. Returns a `PolicyResolveResult` and a per-rule `trace` for audit.
- `backend/src/tests/application/system-core/PolicyResolver.test.ts` — 14 precedence tests pinning the brief's required scenarios plus role/user/context precedence, approved-override semantics, and null-config behaviour.
- `backend/src/tests/application/system-core/PolicyEngineTypedResolution.test.ts` — 7 wired-engine tests covering `resolveTyped` end-to-end (missing companyId, missing repo, repository throws, hard-vs-module cross-rule, legacy facade preserved).
- `docs/architecture/policy-engine.md` — architecture doc for incoming SWEs and the future slice author.

### Extended (additive)
- `backend/src/application/system-core/contracts/IPolicyEngine.ts` — `PolicyResolveResult` gains **optional** `decision?`, `reasonCode?`, `effectiveRuleId?`, `approvalSubject?`. New `TypedPolicyResolveRequest` + `PolicyDecision`. New `resolveTyped(request)` method on the interface.
- `backend/src/application/system-core/PolicyEngine.ts` — accepts an optional 4th ctor argument `IPolicyConfigRepository`. New `resolveTyped(...)` method that loads the config (or falls back to default-empty) and delegates to `PolicyResolver`. The legacy `resolve(...)` body is **byte-for-byte unchanged**.
- `backend/src/application/system-core/adapters/LegacyPolicyEngineAdapter.ts` — implements `resolveTyped` as a safe default-allow so the legacy adapter still satisfies the extended `IPolicyEngine` interface.
- `backend/src/tests/architecture/SystemCoreBoundaries.test.ts` — one new **non-failing** export/structure guard verifying the foundation files are in place. No existing guard was weakened or deleted.

## 4. Behaviour preservation (the critical contract)

The brief's hard line: **do not change the legacy `resolve()` outputs**. Confirmed by re-running the legacy suites as part of verification — they pass without any source change. Specifically:

- `src/tests/application/pos/PolicyEnginePosPolicy.test.ts` — green (4 tests).
- `src/tests/application/system-core/PolicyEngineCommercialBelowCost.test.ts` — green (3 tests).
- `src/tests/architecture/SystemCoreBoundaries.test.ts` — green (14 + 1 new non-failing guard).

The new optional fields on `PolicyResolveResult` are additive; existing tests that use `toMatchObject({ allowed, requiresApproval })` continue to match.

## 5. Precedence engine contract (the new behaviour)

```
hard rule (any scope) → absolute, cannot be overridden.
TENANT default         → company-wide rule.
MODULE override        → per-module rule.
ROLE override          → per-role rule (conditions.match.roleId).
USER override          → per-user rule (conditions.match.userId).
CONTEXT override       → per-register / terminal / warehouse / branch / voucherType rule.
Approved override      → clears non-hard BLOCK / REQUIRE_APPROVAL.
```

Within a level, the most restrictive effect wins (`BLOCK > REQUIRE_APPROVAL > ALLOW`); ties break by `priority` desc. A matched level overrides the previous level's choice (more specific wins).

`requireApprovalAbove` is a threshold shortcut: `REQUIRE_APPROVAL` is only emitted if the request's `context.amount` exceeds the threshold; below the threshold the rule degrades to `ALLOW`. This is what makes "Sales invoice posting requires approval over 10k" a one-line rule.

## 6. Test evidence

Run on `D:\DEV2026\ERP03-267-engine-audit`:

```
npm --prefix backend test -- --runInBand src/tests/application/system-core
  → PolicyResolver.test.ts: 14/14 pass
  → PolicyEngineTypedResolution.test.ts: 7/7 pass
  → PolicyEngineCommercialBelowCost.test.ts: 3/3 pass
  → CommercialCoreBelowCostPolicy.test.ts: 8/8 pass
  → All other system-core suites: green
  → (full report captured in JOURNAL entry)

npm --prefix backend test -- --runInBand src/tests/application/pos/PolicyEnginePosPolicy.test.ts src/tests/application/system-core/PolicyEngineCommercialBelowCost.test.ts
  → PolicyEnginePosPolicy.test.ts: 4/4 pass
  → PolicyEngineCommercialBelowCost.test.ts: 3/3 pass

npm --prefix backend test -- --runInBand src/tests/architecture/SystemCoreBoundaries.test.ts
  → All 14 existing guards pass
  → 1 new non-failing export guard added (267-C: Policy Resolution Engine foundation files are in place) — passes

npm --prefix backend run build
  → tsc clean, lib/ rebuilt
```

(Final tallies are in the JOURNAL entry for this slice.)

## 7. Accounting / control impact

**None.** The foundation is additive. The legacy `IPolicyEngine.resolve({ scope, action, ... })` outputs are byte-for-byte identical. No `POSPolicy` or `SellingPolicy` persistence is removed. No `SubledgerVoucherPostingService` / `PostingGateway` / `StockMovement` / `StockLevel` is touched. No frontend is touched. No item / catalog route is touched.

The new typed path is wired so that a future module can opt in by either (a) calling `engine.resolveTyped(...)` directly, or (b) registering adapter rules that re-express its existing compatibility source as `PolicyConfig` rules.

## 8. Risks / known follow-ups

- **Firestore repository not implemented in this slice.** Intentionally deferred to a persistence slice so this slice stays pure (no DI churn, no migration noise). When it lands, it goes in `backend/src/infrastructure/firestore/repositories/system-core/FirestorePolicyConfigRepository.ts` and is registered in `bindRepositories.ts`. The `IPolicyConfigRepository` interface is shaped to match `ISellingPolicyRepository` / `IPosPolicyRepository` to make the implementation mechanical.
- **No `IPolicyConfigRepository` DI wiring yet.** Same reason. The constructor argument is optional; existing call sites compile unchanged. When wiring lands, it threads through `bindRepositories.ts.policyEngine` exactly like the existing `posPolicyRepository` and `commercialCore` dependencies.
- **Adapter rules for the existing compatibility sources** (`POSPolicy`, `SellingPolicy`, `AccountingPolicyRegistry`, `DocumentPolicyResolver`) are NOT in this slice. They land with the engine-management doorway slice (267-D) so a module-by-module migration can be reviewed with golden voucher-output tests.
- **Audit emission is not implemented in this slice.** The new path returns `decision / reasonCode / effectiveRuleId / approvalSubject`; emitting them through `IAuditEngine` lands with the management-UI slice once the doorways exist.

## 9. Documentation produced

- **Solo developer:** `planning/ACTIVE.md` (current focus updated), `planning/JOURNAL.md` (session summary appended), this completion report.
- **Future developers:** `docs/architecture/policy-engine.md` — precedence contract, compatibility sources, files added/changed, what is NOT in this slice, test coverage.
- **End users:** No user-facing change in this slice. The end-user docs will land with the management-UI slice (267-E).

## 10. Definition of Done — every feature

- [x] Code merged (work landed on `codex/267-system-core-boundary-audit`, all verification commands green).
- [x] `docs/architecture/policy-engine.md` created.
- [ ] `docs/user-guide/<module>/<feature>.md` — **N/A for this slice** (no user-facing change). Will land with 267-E.
- [x] `planning/done/267-policy-resolution-engine-foundation.md` — this file.
- [x] `planning/JOURNAL.md` appended with session summary.
- [x] `planning/ACTIVE.md` updated with next task (267-D, engine management API doorways).

## 11. Reviewer blockers (from the brief)

Checked each:

- any posting output changes? — **No.** Legacy `resolve()` outputs byte-for-byte identical; no posting code touched.
- any source module gains new shared policy logic outside System Core? — **No.** New code lives entirely in `application/system-core/*`, `domain/system-core/*`, and `repository/interfaces/system-core/*`.
- existing POS / SellingPolicy behavior changes? — **No.** Compatibility sources untouched; their `resolve()` branches unchanged.
- unknown old `scope/action` behavior changes from default allow? — **No.** `PolicyResolver` returns `ALLOW` with `PolicyConfig.noMatchingRule` when no rule matches, matching the pre-267 facade default.
- tests or boundary guards are weakened? — **No.** All 14 existing architecture guards pass; one new non-failing guard added.
- docs are missing? — **No.** Architecture doc + this completion report both present.
