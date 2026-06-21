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

## Current Guardrail

`backend/src/tests/architecture/SystemCoreBoundaries.test.ts` now exists. The POS-to-Sales import ban is intentionally skipped until 250d, because the current POS sale path still imports Sales use cases and that coupling is the target of Phase 1.
