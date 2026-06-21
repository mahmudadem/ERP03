# System Core Architecture

**Status:** Epic 250 in progress. This document starts with the Phase 0 interface seams and will be expanded as phases 250b-250l land.

## Boundary

System Core is the shared-engine layer for business logic used by multiple ERP apps. Application modules such as Sales, Purchases, POS, Inventory UI, and Accounting UI should orchestrate user workflows over System Core interfaces instead of importing each other's internals.

Phase 0 introduced contracts under `backend/src/application/system-core/contracts/` and legacy adapters under `backend/src/application/system-core/adapters/`. The adapters deliberately keep current behavior while creating stable seams for later phases.

## Phase 0 Interfaces

- `IDocumentCore` - document identity, persona, state transition, and editability seam.
- `INumberingEngine` - common sequence/number request seam.
- `IMoneyCore` - precision-aware rounding, cash rounding, and base conversion seam.
- `ITaxEngine` - line and charge tax calculation seam over existing Sales calculation logic.
- `ICommercialCore` - price and discount calculation seam.
- `IPolicyEngine` - shared policy resolution seam over current document and accounting policy resolvers.
- `IApprovalEngine` - approval decision seam over current accounting approval behavior.
- `IAccountingBridge` - financial event recording seam over current subledger posting.
- `IAuditEngine` - audit recording seam over `RecordChangeService`.
- `IInventoryCore` - neutral alias over the existing `ISalesInventoryService` contract.

## Adapter Rule

Phase 0 adapters may delegate to legacy implementations. They must not move business logic or change consumer behavior. Later phases replace adapter internals or rewire consumers one task at a time.

## Document Persona

Phase 1 starts making document persona a System Core identity instead of a module-local string. `IDocumentCore` exposes the canonical enum `SALES_DIRECT_INVOICE`, `SALES_LINKED_INVOICE`, `POS_DIRECT_SALE`, and `SERVICE` while `DocumentPolicyResolver` keeps legacy `direct`, `linked`, and `service` reads compatible.

For 250b, POS writes `documentPersona: 'POS_DIRECT_SALE'` into the Sales compatibility payload. The legacy Sales posting path still uses `voucherType: 'sales_invoice'` and legacy `persona: 'direct'` until 250d replaces the POS entry point, but the durable POS persona is persisted on `SalesInvoice.documentPersona` and copied into revenue, COGS, and settlement voucher metadata. Reporting/read paths can therefore identify POS direct sales through `metadata.documentPersona` without treating `formType: 'pos_sale'` as the only marker.

Accounting boundary: 250b does not alter posting math, account resolution, tax calculation, inventory movement quantity/cost logic, AR settlement, approval, period-lock, or voucher balancing. It only carries the canonical document persona alongside the existing posting path.

## Policy Engine And POS Policy

250c moves POS direct-sale authorization out of Sales Settings. The company POS toggle now persists to `POSPolicy.allowPosDirectSales` through `IPosPolicyRepository`, and POS sale completion asks `IPolicyEngine.resolve({ scope: 'pos', action: 'directSale', ... })` before building the Sales compatibility document.

The minimum policy model is POS-owned:

- `POSPolicy` is the company-level default.
- `POSTerminalPolicy` can deny direct sale for a register even when the company default allows it.
- `CashierRolePolicy` can require approval for direct sale; until the Approval Engine phase wires approved decisions, the policy engine blocks the sale unless `approvedOverride` is present in context.

POS uses most-restrictive-wins. A narrower policy can tighten a broader allow, but it cannot loosen a broader deny; an explicit approved override is the only escape from a deny. This keeps POS authorization independent from Sales `governanceRules` while preserving existing Sales posting compatibility until 250d removes the POS-to-Sales use-case dependency.
## Current Guardrail

`backend/src/tests/architecture/SystemCoreBoundaries.test.ts` now exists. As of 250d, the POS sale-path ban is active for `CompletePosSaleUseCase` and `PostPosSaleUseCase`; those files must not import Sales application or Sales domain internals. The folder-wide POS-to-Sales import ban remains skipped until 250d2 because POS returns are the next explicit decoupling slice.
