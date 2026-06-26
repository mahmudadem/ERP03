# Audit 267-A - System Core Engine Boundary Inventory

**Date:** 2026-06-24  
**Worktree:** `D:\DEV2026\ERP03-267-engine-audit`  
**Branch:** `codex/267-system-core-boundary-audit`  
**Audit owner:** Codex  
**Scope:** Read-only architecture audit for engine/module boundaries, shared engine management doorways, and policy-resolution readiness.

---

## Executive Finding

ERP03 already has a real System Core layer, but the system is only partially compliant with the rule "engines own shared logic; modules own workflow/UI." POS is the cleanest consumer. Sales, Purchases, and Inventory still carry legacy direct posting and stock-construction paths.

The next implementation should **not** start by migrating all posting. That is too risky without golden voucher-output tests. The safest first build slice is:

1. Add a typed, generic **Policy Resolution Engine foundation** behind the existing `IPolicyEngine`.
2. Preserve current POS/SellingPolicy/AccountingPolicyRegistry behavior through compatibility adapters.
3. Add company/module/action policy config and resolution precedence tests.
4. Only then expose management doorways and migrate callers.

---

## Baseline Status

`git status --short --branch`

```text
## codex/267-system-core-boundary-audit
```

Architecture boundary test:

```powershell
npm --prefix backend test -- --runInBand src/tests/architecture/SystemCoreBoundaries.test.ts
```

Result: passed, 14/14.

---

## Boundary Inventory Table

| Concern | Current owner | Expected engine | State | Module consumers | Doorways present | Violations / evidence | Recommended slice |
|---|---|---|---|---|---|---|---|
| Money rounding | System Core money | `IMoneyCore` / `roundMoney` | Extracted | Sales, Purchases, POS, Accounting | Not a direct UI setting | Architecture guard exists for local `roundMoney` helpers in `backend/src/tests/architecture/SystemCoreBoundaries.test.ts:64`. No blocker found in this audit. | No immediate work. Keep guard. |
| Tax calculation | System Core tax | `ITaxEngine` | Extracted for audited SI/PI/POS paths | Sales, Purchases, POS | Tax-code config is shared route | `backend/src/api/routes/shared.routes.ts:13-16` exposes tax codes through shared routes. POS tax-account error fix keeps account mapping owned by tax code. | No immediate engine extraction. Later: verify tax-code UI doorways for POS-only setup. |
| Numbering | System Core numbering | `INumberingEngine` | Extracted | Accounting, Sales, Purchases, POS | Numbering config not audited here | POS receipt guard exists in `SystemCoreBoundaries.test.ts:178-183`. | No immediate work. Keep guard. |
| Commercial discount/price/margin | System Core commercial | `ICommercialCore` | Mostly extracted | Sales, Purchases, POS | Sales and POS have SellingPolicy doorways | One POS-local discount helper remains: `backend/src/application/pos/use-cases/CompletePosSaleUseCase.ts:468` calls local `calculateDiscountAmount`; helper defined at `:512`. This duplicates Commercial Core line-discount logic. Maintainability-risk, possible accounting-risk if preview/post diverges. | Slice 267-D1: replace POS local helper with `ICommercialCore.calcDiscount` or equivalent, with POS receipt-total regression. |
| Shared below-cost selling policy | System Core domain + Commercial Core | `SellingPolicy` via Commercial Core / Policy Engine | Extracted enough for current scope | POS, Sales | POS: `backend/src/api/routes/pos.routes.ts:21-22`; Sales: `backend/src/api/routes/sales.routes.ts:31-32` | Doorway rule is satisfied for POS + Sales. Frontend pages exist: `frontend/src/modules/pos/pages/PosSettingsPage.tsx:470-538`; `frontend/src/modules/sales/pages/SalesSettingsPage.tsx:542-609`. Some Sales strings are hardcoded, which is UI/i18n debt, not engine blocker. | No backend change. Later UI i18n cleanup. |
| Policy resolution | `PolicyEngine` facade plus POSPolicy, SellingPolicy, AccountingPolicyRegistry, DocumentPolicyResolver | Generic `IPolicyEngine` with typed policy config and precedence | Hybrid/incomplete | POS, Sales, Purchases, Accounting | POS policy route, POS/Sales SellingPolicy, Accounting policy route | `IPolicyEngine` is generic string scope/action only: `backend/src/application/system-core/contracts/IPolicyEngine.ts:1-15`. `PolicyEngine` hardcodes scope branches and defaults allow: `backend/src/application/system-core/PolicyEngine.ts:7-59`. POS policy is POS-specific store: `backend/src/domain/pos/entities/POSPolicy.ts:93-137`. No tenant-default -> module-override -> role/user/register/context model. Accounting-control risk and maintainability-risk. | Slice 267-B/C: design and implement typed PolicyConfig + resolver precedence, preserving existing behavior. |
| Approval evaluation | System Core approval engine + plugins | `IApprovalEngine` | Hybrid | Accounting, POS, future Sales/Purchases approvals | Approval UI not audited here | `ApprovalEngine` exists at `backend/src/application/system-core/approval/ApprovalEngine.ts:9-25`. Accounting voucher path still wraps legacy approval via `LegacyApprovalEngineAdapter` and `LedgerCustodyApprovalPlugin` references. This is acceptable during rollout but not fully native. | After policy foundation: add policy-to-approval subject mapping tests; do not rewrite voucher approval yet. |
| Accounting posting bridge | POS and bridge adapter; legacy module posting elsewhere | `IAccountingBridge` for source-module financial events | Wrapper, partially consumed | POS, Sales, Purchases, Inventory, Accounting | Accounting policy config route exists | POS is bridged. Sales/Purchases/Inventory still import/directly build `SubledgerVoucherPostingService` or `PostingGateway`: Sales controller `backend/src/api/controllers/sales/SalesController.ts:60,222-235`; SI use case `backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts:60,72,956,975,2043`; Purchases controller `backend/src/api/controllers/purchases/PurchaseController.ts:70,177-190`; PI use case `backend/src/application/purchases/use-cases/PurchaseInvoiceUseCases.ts:46,49,540,1363,1664`; Inventory controller `backend/src/api/controllers/inventory/InventoryController.ts:80,141-142`. Accounting-risk if migration is rushed; current behavior is legacy-approved but boundary-incomplete. | Slice 267-F: plan golden voucher-output tests first. Migrate one module at a time through `IAccountingBridge`. |
| Inventory stock movement/core | Inventory Core and legacy inventory use-cases | `IInventoryCore` should own stock movement construction/costing APIs | Hybrid | Sales, Purchases, POS, Inventory | Inventory UI only; item/stock setup under Inventory | Purchases constructs stock state directly: `PurchaseInvoiceUseCases.ts:627,638,641,772`; `GoodsReceiptUseCases.ts:305,313,407`; `PurchaseReturnUseCases.ts:633,804`. Inventory-owned internals also construct stock, which is allowed. Accounting/valuation-risk if changed without golden tests. | Slice 267-G: extend Inventory Core write/compute APIs for purchase in/out flows, then remove purchase constructors with valuation regressions. |
| Catalog / items | Inventory module routes/controllers | New `ICatalogCore` / item catalog engine | Missing first-class engine | POS, Sales, Purchases, Inventory | Inventory item UI only; list/detail can route visually to sales/purchases paths | Item API sits under inventory route, which is module-initialized guarded: `backend/src/api/routes/inventory.routes.ts:13`; item endpoints `:18-23`. POS/Sales/Purchases consume items, but a POS-only tenant may not be able to manage item default tax/account mappings. Tenant-isolation and operations-risk. | Slice 267-H: separate catalog engine/routes/permissions from Inventory module. Do not mix with policy slice. |
| Shared settings doorways | Mixed | Each consuming module must expose its own doorway to shared engine-owned config | Partially enforced | All modules | SellingPolicy fixed; tax codes shared route; item setup not fixed | `moduleInitializedGuard` applies to Sales/Purchases/Inventory route roots: `sales.routes.ts:25`, `purchases.routes.ts:21`, `inventory.routes.ts:13`. SellingPolicy avoided POS dependency by adding `pos.routes.ts:21-22`; item management still violates the POS-only setup litmus. | Add architecture guard for shared-config doorways after each shared config is catalogued. Start with Catalog/Items and PolicyConfig. |
| Engine management UI | Module settings pages plus Accounting settings | Layered UI: Company Settings full matrix + module-specific doorways | Missing formal model | Company admin, POS manager, Sales manager, Purchasing manager, Controller | POS/Sales policy doorways exist for SellingPolicy; no full Controls & Policies matrix | Frontend module settings exist in menu map: `frontend/src/config/moduleMenuMap.ts:156,194,238`. POS/Sales have below-cost controls, Purchases has procurement policy but no generic shared policy UI. No company-level controls matrix. UI/maintainability-risk. | Slice 267-E after backend policy config: add Company Settings -> Controls and module-specific policy pages/tabs. |
| System Core boundary enforcement | Architecture test | `SystemCoreBoundaries.test.ts` | Partial | All source modules | N/A | Test currently guards POS strongly and Sales stock construction, but does not fail Purchases stock constructors or direct Sales/Purchases/Inventory posting service imports. Evidence: test passed despite violations above. Maintainability-risk. | Add guards incrementally with allowlists or after each remediation. Do not add failing guards before implementation unless marked `.todo`. |

---

## Risk Classification

### Accounting-risk

- Direct legacy posting in Sales/Purchases/Inventory outside `IAccountingBridge`.
- Purchases constructing stock movements and levels directly.
- POS-local discount helper if it can diverge from Commercial Core.
- Generic policy model missing for approval/posting/override decisions.

### Tenant-isolation / module-independence risk

- Item/catalog setup is behind `moduleInitializedGuard('inventory')`.
- Shared settings are not systematically audited for per-module doorways.
- Policy route model is fragmented between POS, Sales, and Accounting.

### Maintainability-risk

- `PolicyEngine` branch logic grows by scope/action instead of data-driven config.
- Boundary tests pass while known violations remain.
- Engine management UI is not formalized.

### UI-only / lower risk

- Some settings labels for selling policy appear hardcoded in Sales/POS pages and should be moved to i18n during UI implementation.

---

## Recommended Implementation Order

### 1. Policy Resolution Engine foundation

Why first:

- It addresses the owner's concrete POS vs Sales/Purchases approval example.
- It has smaller accounting blast radius than bridge migration.
- It creates a model later used by engine management UI.

Deliver:

- `PolicyConfig` neutral domain model.
- `IPolicyConfigRepository`.
- Typed policy resolution request/result.
- Precedence engine: hard rule -> tenant default -> module override -> role/user/register/context override -> approval handoff.
- Compatibility with existing POSPolicy, SellingPolicy, AccountingPolicyRegistry, DocumentPolicyResolver.
- Tests proving no current behavior changed.

### 2. Policy management API doorways

Deliver:

- Company Settings full policy matrix route.
- POS/Sales/Purchases/Accounting module-specific policy routes.
- Permission-gated per module.
- No module route hidden behind another module's `moduleInitializedGuard`.

### 3. Policy management UI

Deliver:

- Company Settings -> Controls and Policies.
- POS/Sales/Purchases/Accounting module settings controls.
- Business labels, no "engine" wording for users.
- i18n complete.

### 4. POS local commercial helper cleanup

Deliver:

- Replace `CompletePosSaleUseCase.calculateDiscountAmount` with Commercial Core.
- Add receipt total regression.

### 5. AccountingBridge migration plan and golden tests

Deliver before code:

- Golden voucher-output tests for Sales, Purchases, Inventory.
- Compare account ids, sides, amounts, source metadata, approval/period-lock behavior.

### 6. One-module-at-a-time AccountingBridge migration

Order:

1. Sales.
2. Purchases.
3. Inventory.
4. Payment sync direct `PostingGateway` paths.

### 7. Purchase stock ownership migration

Deliver:

- Extend `IInventoryCore` APIs for purchase receipt/return movement construction.
- Remove direct Purchases `StockMovement` / `StockLevel` construction.
- Add valuation regressions.

### 8. Catalog / Item engine plan and implementation

Deliver:

- `ICatalogCore`.
- Shared item routes not under Inventory module guard.
- POS/Sales/Purchases/Inventory item-management doorways.
- Permission model independent of Inventory visibility.

---

## First Builder Task - Exact Scope

The first cheaper implementation agent should **not** touch posting, inventory stock movement, frontend UI, or item catalog.

It should implement only:

> **Policy Resolution Engine foundation, behavior-preserving.**

Allowed files/areas:

- `backend/src/domain/system-core/entities/PolicyConfig.ts`
- `backend/src/application/system-core/contracts/IPolicyEngine.ts`
- `backend/src/application/system-core/PolicyEngine.ts`
- `backend/src/application/system-core/policy/*`
- `backend/src/repository/interfaces/system-core/IPolicyConfigRepository.ts`
- Firestore repository for policy config if persistence is included in the slice
- DI registration if repository is included
- `backend/src/tests/application/system-core/*Policy*.test.ts`
- `backend/src/tests/architecture/SystemCoreBoundaries.test.ts` only for non-failing/export guards
- `docs/architecture/policy-engine.md`
- planning docs for completion

Do not touch:

- Sales/Purchases/Inventory posting code.
- `SubledgerVoucherPostingService`.
- `PostingGateway`.
- Inventory movement/costing use-cases.
- Frontend settings pages.
- Existing `POSPolicy` persistence removal.
- Existing `SellingPolicy` persistence removal.

Required behavior:

- Existing `resolve({ scope, action, ... })` callers still work.
- Unknown scope/action must preserve current default behavior unless the task explicitly changes it. Current default is allow.
- Existing POS policy tests still pass.
- Existing Commercial below-cost policy tests still pass.
- Existing accounting approval tests still pass.

Required new tests:

- tenant default blocks an action;
- module override requires approval;
- hard rule blocks even when module override allows;
- POS terminal direct sale no-approval example;
- Sales invoice posting requires approval over threshold;
- Purchase invoice posting requires approval over threshold;
- result includes `decision`, `reasonCode`, `resolvedBy`, and effective rule metadata without removing old `allowed/requiresApproval`.

---

## Verification Commands for First Builder

```powershell
npm --prefix backend test -- --runInBand src/tests/application/system-core
npm --prefix backend test -- --runInBand src/tests/application/pos/PolicyEnginePosPolicy.test.ts src/tests/application/system-core/PolicyEngineCommercialBelowCost.test.ts
npm --prefix backend test -- --runInBand src/tests/architecture/SystemCoreBoundaries.test.ts
npm --prefix backend run build
```

