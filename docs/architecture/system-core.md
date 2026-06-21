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

## Approval Engine

250e promotes approval to a subject-agnostic System Core seam. `ApprovalEngine` evaluates `ApprovalSubject` records through `ApprovalSubjectRegistry` plug-ins. Subjects can be voucher-based (`accounting_voucher`) or non-voucher operational approvals such as `below_cost_sale`, `price_override`, `discount_override`, `tax_override`, or `pos_manager_override`.

The existing accounting Smart FA/CC logic was not duplicated. It is wrapped by `LedgerCustodyApprovalPlugin`, which supports only `accounting_voucher` and delegates to `ApprovalPolicyService.evaluateSmartGates(...)`. `SubmitVoucherUseCase` now asks the approval engine for the accounting voucher decision, then consumes the same `ApprovalGateResult` metadata as before, preserving voucher status transitions and notification behavior.

Non-voucher subjects currently use the generic engine fallback: a payload with `requiresApproval: true` returns `PENDING`, and the calling module decides which action to block until an approved override exists. Concrete override capture and UI flows remain later Commercial Core/POS work.

## Money Core

250f makes `application/system-core/money/roundMoney.ts` the single backend rounding authority for the audited money paths. It wraps `CurrencyPrecisionHelpers.roundByCurrency` and keeps an omitted-currency fallback of `USD` so existing two-decimal document totals remain behavior-preserving while callers migrate to passing the real currency.

The helper now owns:

- `roundMoney(value, currency = 'USD')`
- `roundCash(value, currency, rule)`
- `toBase(value, currency, rate, baseCurrency)`

The audited local `roundMoney` copies in Sales, Purchases, POS, shared payment history, and seed scripts were removed. `VoucherLineEntity.roundMoney(value, decimals)` remains as the low-level accounting precision primitive used by `CurrencyPrecisionHelpers`; it is intentionally allowed by the architecture guard.

POS sale completion now applies `PosSettings.cashRounding` before payment validation. Rounding differences are posted in the POS revenue voucher so AR and settlement stay balanced:

- positive rounding difference credits `cashOverAccountId`;
- negative rounding difference debits `cashShortAccountId`;
- if the needed account is missing, the sale is blocked before posting.

This keeps cash rounding auditable without adding a new account setting in the Phase 2 slice.

## Current Guardrail

`backend/src/tests/architecture/SystemCoreBoundaries.test.ts` now exists. As of 250d2, the folder-wide POS application guard is active: files under `backend/src/application/pos/` must not import Sales application or Sales domain internals. POS sale and return posting both route through POS-owned use-cases over `IInventoryCore` and `IAccountingBridge`.
