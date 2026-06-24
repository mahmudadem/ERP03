# Task 267 — System Core Engine Management and Boundary Remediation Plan

**Date:** 2026-06-24  
**Owner goal:** Make shared ERP logic live in System Core engines, keep modules independent, and expose engine-owned settings through every consuming module without duplicated rules.  
**Task type:** Architecture audit + execution plan first, then small implementation slices.  
**Estimated audit/planning time:** 1.5-2.5h.  
**Estimated full remediation:** 4-8 focused slices, likely 2-5 days depending on voucher-output regression work.  
**Current status:** Plan created. Do not start implementation until the owner confirms the first slice.

---

## 1. Problem Statement

ERP03 already has a System Core layer, but it is not yet consistently enforced across all modules.

The target architecture is:

> Engines own shared truth, rules, calculations, controls, and invariants. Modules own screens, workflows, and module-specific orchestration.

This matters because a POS-only tenant, Sales-only user, or Purchases-only user must still get correct accounting, tax, stock, policy, and approval behavior even when the Accounting, Inventory, or another module UI is hidden.

The specific owner concern is policy resolution:

- A tenant may have a general company policy.
- A module may override that policy for its own workflow.
- POS may allow terminal ledger effects without approval.
- Sales and Purchases may require approval for similar financial effects.
- That means policy resolution must be a shared engine concern, not local module logic.

---

## 2. Non-Negotiable Architecture Rules

Every agent must follow these rules.

1. **Do not put shared business logic inside modules.**
   - Shared calculations, policy decisions, approval routing, posting rules, stock movement rules, tax resolution, numbering, audit emission, and money rounding belong in `backend/src/application/system-core/*`.

2. **Modules orchestrate only.**
   - A module use-case may gather context, call engines, and shape responses.
   - It must not re-implement the shared rule locally.

3. **One engine-owned store, multiple module doorways.**
   - If POS and Sales consume the same shared policy, there must be a POS settings doorway and a Sales settings doorway.
   - Both must write to the same neutral store.
   - API routes must be permission-gated for the owning module, not hidden behind another module's `moduleInitializedGuard`.

4. **Accounting engine always acts. Accounting app is optional.**
   - Do not gate posting correctness on whether the Accounting UI module is visible.
   - `IAccountingBridge` must be the cross-module financial-event interface.

5. **No direct new use of legacy posting services from source modules.**
   - New code must not call `SubledgerVoucherPostingService.postInTransaction(...)` or `PostingGateway.record(...)` from Sales/Purchases/POS/Inventory source modules.
   - Bridge migration of existing legacy call sites must be done one module at a time with golden voucher-output tests.

6. **Stock movement creation belongs to Inventory Core.**
   - No new `new StockMovement(...)`, `StockLevel.createNew(...)`, or `StockLevel.fromJSON(...)` outside Inventory Core/inventory-owned internals.

7. **Boundary tests are mandatory.**
   - Any remediation slice must strengthen `backend/src/tests/architecture/SystemCoreBoundaries.test.ts`.
   - Never weaken, skip, or delete a guard to make a change pass.

8. **Do not change accounting output accidentally.**
   - Posting, tax, stock valuation, COGS, AP/AR, settlement, and period-lock behavior must remain byte-for-byte or behaviorally equivalent unless a slice explicitly says otherwise.

---

## 3. Current State Snapshot

### 3.1 Already Exists

System Core contracts exist:

- `IAccountingBridge`
- `IApprovalEngine`
- `IAuditEngine`
- `ICommercialCore`
- `IDocumentCore`
- `IFxEngine`
- `IInventoryCore`
- `IMoneyCore`
- `INumberingEngine`
- `IPolicyEngine`
- `IPrintLayoutCore`
- `ITaxEngine`

Extracted or mostly extracted engines:

- Money / rounding
- Tax calculation
- Numbering
- Commercial pricing, discount, promotions, margin guard
- Document persona/editability
- Print layout

Hybrid/wrapper engines:

- Inventory Core: some COGS/account-resolution helpers moved; movement/costing still delegates legacy inventory use-cases.
- Approval Engine: real subject plugin architecture exists; legacy accounting approval still wrapped.
- Policy Engine: real POS/commercial/accounting/document-policy facade exists, but not a full general tenant-default/module-override resolver.
- Accounting Bridge: POS uses it; Sales/Purchases/Inventory still have direct legacy posting paths.
- Audit Engine: stable engine seam in front of legacy audit writer.
- FX Engine: stable seam over already-centralized core FX logic.

Shared setting doorway example already fixed:

- `SellingPolicy` is a shared store.
- Sales has `/tenant/sales/selling-policy`.
- POS has `/tenant/pos/selling-policy`.
- Both write the same policy.

### 3.2 Known Gaps

1. **No full generic policy-resolution model.**
   - Current `IPolicyEngine.resolve(...)` is a string scope/action facade.
   - It does not yet model company default -> module override -> role/user/register/context override -> hard rule resolution consistently.

2. **Accounting Bridge not consumed by all source modules.**
   - Sales, Purchases, and Inventory still directly use `SubledgerVoucherPostingService` or `PostingGateway` in several use-cases/controllers.

3. **Purchases still owns some stock movement/level construction.**
   - Purchase Invoice, Goods Receipt, and Purchase Return still construct stock-level/movement entities directly.

4. **Catalog/Item engine is missing as a first-class System Core engine.**
   - Item management/search is still mostly Inventory-module-shaped.
   - A POS-only tenant still risks being blocked from item/tax/account mapping setup.

5. **Shared settings doorway rule is not fully audited.**
   - Selling policy was corrected.
   - Other shared settings may still be reachable only from one module.

6. **Engine management UI model is not formalized.**
   - Need a layered UI contract:
     - Company Settings -> Controls and Policies for full matrix.
     - POS Settings -> POS-specific controls.
     - Sales Settings -> Sales-specific controls.
     - Purchases Settings -> Purchases-specific controls.
     - Accounting/Admin screens for accounting-wide controls.

---

## 4. Target Engine UI Management Model

### 4.1 Principle

Do not expose "System Core" as a developer-looking feature to normal users.

Users should see business words:

- Approval
- Posting
- Discount limits
- Price override
- Tax override
- Return approval
- Credit limit
- Three-way match
- Period lock
- Stock negative policy

The UI is only a doorway. The engine owns the configuration and decision.

### 4.2 Doorway Levels

1. **Company Settings -> Controls and Policies**
   - Full policy matrix.
   - For company admin, controller, owner, CFO.
   - Shows every module's rules in one place.
   - Useful for audit and setup.

2. **POS -> Settings -> Controls**
   - POS direct sale policy.
   - Price override.
   - Discount override.
   - Tax override.
   - Return approval.
   - Reprint approval.
   - Register/cashier-role overrides.
   - Below-cost selling policy if POS consumes it.

3. **Sales -> Settings -> Controls**
   - Sales invoice posting approval.
   - Below-cost selling policy.
   - Credit-limit override.
   - Discount limits.
   - Direct invoice allowed/blocked.
   - Return/cancel approval.

4. **Purchases -> Settings -> Controls**
   - Purchase invoice approval.
   - Vendor bill approval by amount.
   - Goods receipt approval.
   - Price variance approval.
   - Three-way-match tolerance.
   - Return approval.

5. **Accounting -> Settings -> Controls**
   - Posting approval defaults.
   - Period lock override.
   - Manual voucher approval.
   - Year-end/fiscal controls.

### 4.3 Backend Route Shape

Use one neutral store and multiple routes:

```text
system-core policy config store
  IPolicyConfigRepository

Company-wide doorway:
  GET/PUT /tenant/settings/controls/policies

Module doorways:
  GET/PUT /tenant/pos/policies
  GET/PUT /tenant/sales/policies
  GET/PUT /tenant/purchases/policies
  GET/PUT /tenant/accounting/policies
```

Each module route:

- filters the same shared config to that module's relevant rules;
- validates only that module's editable fields;
- is gated by that module's settings permission;
- is not hidden behind another module's initialization/enablement;
- never imports another module's controller/validator.

---

## 5. Execution Slices

Do not attempt all slices in one agent run. Each slice must be independently testable.

### Slice 267-A — Read-Only Engine Boundary Inventory

**Goal:** Produce a current, evidence-backed map of shared logic ownership before changing behavior.

**Estimated time:** 1.5-2.5h.

**Agent type:** cheap read-only explorer/architect.

**Files to read:**

- `AGENTS.md`
- `planning/ACTIVE.md`
- `planning/JOURNAL.md`
- `planning/PRIORITIES.md`
- `planning/VISION.md`
- `docs/architecture/engines-vs-modules.md`
- `docs/architecture/system-core.md`
- `backend/src/tests/architecture/SystemCoreBoundaries.test.ts`
- `backend/src/application/system-core/**`
- focused source module use-cases under:
  - `backend/src/application/pos/use-cases/`
  - `backend/src/application/sales/use-cases/`
  - `backend/src/application/purchases/use-cases/`
  - `backend/src/application/inventory/use-cases/`
  - `backend/src/api/routes/`
  - `backend/src/api/controllers/`

**Commands:**

```powershell
git status --short --branch
rg "SubledgerVoucherPostingService|PostingGateway|postInTransaction\(" backend/src/application backend/src/api -n
rg "new StockMovement|new StockLevel|StockLevel\.createNew|StockLevel\.fromJSON" backend/src/application backend/src/api -n
rg "function calculateDiscountAmount|const calculateDiscountAmount|calculateDiscountAmount\(" backend/src/application -n
rg "moduleInitializedGuard" backend/src/api/routes -n
rg "IPolicyEngine|PolicyEngine|IApprovalEngine|ApprovalEngine|SellingPolicy|POSPolicy|CashierRolePolicy" backend/src -n
npm --prefix backend test -- --runInBand src/tests/architecture/SystemCoreBoundaries.test.ts
```

**Output required:**

Create `planning/audits/267-system-core-boundary-inventory.md` with this table:

| Concern | Current owner | Expected engine | State: extracted/hybrid/wrapper/missing | Module consumers | Doorways present | Violations | Recommended slice |
|---|---|---|---|---|---|---|---|

**Acceptance criteria:**

- No code changes.
- Every violation has file/line evidence.
- Every shared setting identifies all consuming modules and all existing/missing management doorways.
- Explicitly classify whether each issue is accounting-risk, tenant-isolation-risk, maintainability-risk, or UI-only.

**Stop conditions:**

- If the working tree contains unrelated user changes, report them and do not touch those files.
- If architecture tests fail before changes, capture the failure as baseline.

---

### Slice 267-B — Policy Resolution Engine Design

**Goal:** Design the generic policy model before implementation.

**Estimated time:** 1-2h.

**Agent type:** backend architect, read-only except docs.

**Create/update:**

- `planning/tasks/267b-policy-resolution-engine.md`
- `docs/architecture/policy-engine.md`

**Required design:**

Policy resolution must support this order:

1. Hard system/accounting rules.
2. Tenant/company default.
3. Module default.
4. Module override.
5. Role override.
6. User override where allowed.
7. Register/terminal/warehouse/branch context override where applicable.
8. Transaction context: amount, document type, risk, cost/margin, period, payment method.
9. Approval outcome from `IApprovalEngine`.

**Policy decision result must include:**

```ts
{
  allowed: boolean;
  requiresApproval: boolean;
  decision: 'ALLOW' | 'BLOCK' | 'REQUIRE_APPROVAL';
  reasonCode: string;
  resolvedBy: string[];
  effectiveRuleId?: string;
  approvalSubject?: ApprovalSubject;
  audit: {
    companyId: string;
    module: string;
    action: string;
    actorUserId?: string;
    contextSummary: Record<string, unknown>;
  };
}
```

**Must cover examples:**

- POS sale ledger effect through POS terminal can post without approval.
- Sales invoice posting requires approval over configurable threshold.
- Purchase invoice requires approval over configurable threshold.
- POS price override requires manager approval for cashier role.
- Sales below-cost sale follows shared SellingPolicy.
- Period hard lock cannot be overridden by module policy.

**Acceptance criteria:**

- No implementation yet unless owner explicitly authorizes.
- Includes migration plan from current `PolicyEngine.ts`.
- Includes repository shape, route shape, UI doorway shape, and test plan.
- Identifies which current policies stay as compatibility adapters during rollout.

---

### Slice 267-C — Implement Generic Policy Config Store and Resolver

**Goal:** Add the neutral engine store and resolver while preserving existing behavior.

**Estimated time:** 3-5h.

**Agent type:** backend builder only.

**Likely files:**

- `backend/src/application/system-core/contracts/IPolicyEngine.ts`
- `backend/src/application/system-core/PolicyEngine.ts`
- `backend/src/application/system-core/policy/*`
- `backend/src/domain/system-core/entities/PolicyConfig.ts`
- `backend/src/repository/interfaces/system-core/IPolicyConfigRepository.ts`
- Firestore/Prisma repository implementations if both persistence stacks are active for this entity.
- `backend/src/infrastructure/di/bindRepositories.ts`
- `backend/src/tests/application/system-core/PolicyEngine*.test.ts`
- `backend/src/tests/architecture/SystemCoreBoundaries.test.ts`

**Implementation rules:**

- Preserve the existing `resolve(request)` method initially.
- Add typed resolver methods or typed request models without breaking callers.
- Wrap existing `POSPolicy`, `SellingPolicy`, `AccountingPolicyRegistry`, and `DocumentPolicyResolver` as compatibility sources.
- Do not remove old policy documents until migration is explicitly planned.

**Tests required:**

- Tenant default allow/block/require approval.
- Module override wins only where allowed.
- Hard rule beats module/user override.
- POS terminal no-approval example.
- Sales/Purchases approval threshold example.
- `resolvedBy`/audit chain is complete.
- Existing POS policy tests still pass.

**Verification:**

```powershell
npm --prefix backend test -- --runInBand src/tests/application/system-core
npm --prefix backend test -- --runInBand src/tests/application/pos src/tests/application/sales src/tests/application/purchases
npm --prefix backend test -- --runInBand src/tests/architecture/SystemCoreBoundaries.test.ts
npm --prefix backend run build
```

---

### Slice 267-D — Engine Management API Doorways

**Goal:** Expose shared policy config through full company settings and module-specific settings routes.

**Estimated time:** 2-4h.

**Agent type:** backend builder.

**Routes required:**

- `GET/PUT /tenant/settings/controls/policies`
- `GET/PUT /tenant/pos/policies`
- `GET/PUT /tenant/sales/policies`
- `GET/PUT /tenant/purchases/policies`
- optional: `GET/PUT /tenant/accounting/policies`

**Rules:**

- Each module route must be gated by its own settings permission.
- No module route may depend on another module being enabled.
- Validators must be neutral or module-local, never imported from another module.
- All routes write one neutral policy config store or compatibility-backed store.

**Tests required:**

- POS policy route works when only POS is enabled.
- Sales policy route works when only Sales is enabled.
- Purchases policy route works when only Purchases is enabled.
- Company settings route can see all rules.
- Tenant isolation: company A cannot read/write company B policy.
- Permission denied cases.

---

### Slice 267-E — Engine Management Frontend

**Goal:** Add management UI doorways without exposing technical engine language to normal users.

**Estimated time:** 4-8h depending on UI scope.

**Agent type:** frontend builder.

**Pages/tabs:**

- Company Settings -> Controls and Policies.
- POS Settings -> Controls.
- Sales Settings -> Controls.
- Purchases Settings -> Controls.
- Accounting Settings -> Controls if accounting controls are in scope.

**UI rules:**

- Use business language, not "System Core".
- No duplicate policy state in frontend.
- Every save must show toast success/error.
- Use existing settings page layout and i18n.
- No hardcoded user-facing strings.
- Avoid nested cards.
- Keep controls dense and operational, not marketing-style.

**Required UX:**

- Full matrix page for power admins.
- Module pages show only the rules that module consumes.
- A module-only admin can edit module-relevant shared settings without enabling another module UI.
- Read-only explanation should state when a rule is inherited from company default vs overridden locally.

**Verification:**

```powershell
npm --prefix frontend run typecheck
npm --prefix frontend run build
```

---

### Slice 267-F — Accounting Bridge Migration Plan

**Goal:** Plan and then migrate Sales, Purchases, Inventory posting paths behind `IAccountingBridge`.

**Estimated plan time:** 1-2h.  
**Estimated implementation:** 1 module per slice, 3-8h each depending on golden tests.

**Do not implement until 267-A and 267-B are accepted.**

**Migration order:**

1. Sales Invoice / Sales Return / Delivery Note.
2. Purchases Invoice / Purchase Return / Goods Receipt.
3. Inventory adjustment / transfer / opening stock / revaluation.
4. Payment sync direct `PostingGateway` paths.

**Golden tests required before each migration:**

- Same voucher lines.
- Same account ids.
- Same debit/credit sides.
- Same base/doc amounts.
- Same source document metadata.
- Same approval/period-lock behavior.
- Same behavior when Accounting UI is disabled but engine still records event.

---

### Slice 267-G — Inventory Core Ownership Completion

**Goal:** Move purchase-side stock movement and stock-level construction behind Inventory Core.

**Estimated time:** 4-8h.

**Scope:**

- Purchase Invoice.
- Goods Receipt.
- Purchase Return.

**Rules:**

- No direct `new StockMovement(...)` or `StockLevel.createNew/fromJSON` in Purchases after slice.
- Preserve costing/valuation behavior exactly.
- Add architecture guard for Purchases, not just Sales/POS.

**Tests required:**

- PI stock receipt.
- GRN stock receipt.
- PR stock return/out.
- Negative/edge cases currently covered.
- Golden valuation comparisons.

---

### Slice 267-H — Catalog/Item Engine and Doorways Plan

**Goal:** Make item/catalog management an always-on shared engine with module doorways.

**Estimated plan time:** 1-2h.  
**Estimated implementation:** separate epic.

**Why:** POS, Sales, Purchases, and Inventory all consume items. Item default tax/account/price setup cannot be locked behind Inventory-only UI.

**Required plan:**

- `ICatalogCore` / `IItemCatalogCore` contract.
- Neutral item read/search/update use-cases.
- Doorways:
  - Inventory -> Items.
  - POS -> POS Items / Item setup.
  - Sales -> Sales Items.
  - Purchases -> Purchase Items.
  - Company Settings -> Catalog setup if needed.
- Permission model:
  - `catalog.items.view`
  - `catalog.items.manage`
  - module-specific aliases where needed.

---

## 6. Agent Prompt: Cheap Executor / Explorer

Copy this prompt for a read-only cheap agent:

```text
You are working in D:\DEV2026\ERP03.

Your task is Slice 267-A only: create a read-only System Core engine boundary inventory. Do not edit source code.

Read these first:
- AGENTS.md
- planning/ACTIVE.md
- planning/JOURNAL.md
- planning/PRIORITIES.md
- planning/VISION.md
- planning/tasks/267-system-core-engine-management-execution-plan.md
- docs/architecture/engines-vs-modules.md
- docs/architecture/system-core.md
- backend/src/tests/architecture/SystemCoreBoundaries.test.ts

Run:
- git status --short --branch
- rg "SubledgerVoucherPostingService|PostingGateway|postInTransaction\(" backend/src/application backend/src/api -n
- rg "new StockMovement|new StockLevel|StockLevel\.createNew|StockLevel\.fromJSON" backend/src/application backend/src/api -n
- rg "function calculateDiscountAmount|const calculateDiscountAmount|calculateDiscountAmount\(" backend/src/application -n
- rg "moduleInitializedGuard" backend/src/api/routes -n
- rg "IPolicyEngine|PolicyEngine|IApprovalEngine|ApprovalEngine|SellingPolicy|POSPolicy|CashierRolePolicy" backend/src -n
- npm --prefix backend test -- --runInBand src/tests/architecture/SystemCoreBoundaries.test.ts

Create exactly one file:
- planning/audits/267-system-core-boundary-inventory.md

The audit must include a table:
Concern | Current owner | Expected engine | State extracted/hybrid/wrapper/missing | Module consumers | Doorways present | Violations | Recommended slice

Rules:
- No implementation.
- No refactor.
- No broad formatting.
- Every violation must include file and line evidence.
- Classify each violation as accounting-risk, tenant-isolation-risk, maintainability-risk, or UI-only.
- If baseline tests fail, report them as baseline; do not fix.
- If the working tree is dirty, list dirty files and avoid changing them except the new audit file.
```

---

## 7. Agent Prompt: Backend Policy Builder

Use only after Slice 267-B is accepted.

```text
You are working in D:\DEV2026\ERP03.

Your task is to implement the approved generic Policy Resolution Engine slice only. Do not migrate AccountingBridge or InventoryCore in this slice.

Read:
- AGENTS.md
- planning/ACTIVE.md
- planning/JOURNAL.md
- planning/tasks/267-system-core-engine-management-execution-plan.md
- planning/tasks/267b-policy-resolution-engine.md
- docs/architecture/policy-engine.md
- backend/src/application/system-core/PolicyEngine.ts
- backend/src/application/system-core/contracts/IPolicyEngine.ts
- backend/src/application/system-core/approval/ApprovalEngine.ts
- backend/src/domain/pos/entities/POSPolicy.ts
- backend/src/domain/system-core/entities/SellingPolicy.ts
- backend/src/tests/architecture/SystemCoreBoundaries.test.ts

Implement only:
- neutral policy config entity/repository/engine resolver;
- compatibility with existing POSPolicy, SellingPolicy, AccountingPolicyRegistry, and DocumentPolicyResolver;
- focused tests for resolution precedence and audit trail.

Do not:
- change posting output;
- move Sales/Purchases/Inventory posting paths;
- change approval outcome semantics;
- remove existing policy documents;
- weaken architecture tests.

Verify:
- npm --prefix backend test -- --runInBand src/tests/application/system-core
- npm --prefix backend test -- --runInBand src/tests/application/pos
- npm --prefix backend test -- --runInBand src/tests/architecture/SystemCoreBoundaries.test.ts
- npm --prefix backend run build
```

---

## 8. Reviewer / Starter Agent Audit Prompt

Use this for Codex, OpenCode reviewer, or any starter agent before accepting a builder's work:

```text
You are reviewing Task 267 work in D:\DEV2026\ERP03.

Review stance: find bugs, architectural drift, accounting-control regressions, tenant isolation issues, missing tests, and missing doorways.

Read:
- AGENTS.md
- planning/tasks/267-system-core-engine-management-execution-plan.md
- the specific slice task file
- git diff --stat
- git diff
- backend/src/tests/architecture/SystemCoreBoundaries.test.ts

Block the work if any of these are true:
- shared logic was added inside Sales/Purchases/POS/Inventory instead of System Core;
- module route for shared config is hidden behind another module's enablement;
- POS-only, Sales-only, or Purchases-only tenant cannot manage a policy it consumes;
- posting, tax, COGS, stock valuation, AP/AR, settlement, or period-lock behavior changed without explicit golden tests;
- direct new SubledgerVoucherPostingService or PostingGateway source-module usage was introduced;
- new StockMovement/StockLevel construction was introduced outside inventory core;
- user-facing frontend strings were hardcoded;
- tests or architecture guards were weakened;
- docs/architecture and planning completion docs were not updated for a completed implementation slice.

Required verification evidence:
- exact test commands run;
- pass/fail output summary;
- list of touched files;
- accounting impact statement;
- remaining risks.
```

---

## 9. Recommended Immediate Next Step

Start with **Slice 267-A — Read-Only Engine Boundary Inventory**.

Reason:

- It is safe during the current dirty POS tax-account fix.
- It does not change accounting behavior.
- It gives every cheaper agent an evidence-backed map before implementation.
- It prevents implementing the policy engine while hidden direct posting, stock ownership, and doorway gaps are still unclear.

After 267-A, do **267-B — Policy Resolution Engine Design**.

Only after those two are reviewed should implementation begin.

