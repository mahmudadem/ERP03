# System Core Architecture

**Status:** Epic 250 in progress. This document starts with the Phase 0 interface seams and will be expanded as phases 250b-250l land.

> **For agents/SWEs:** the enforced engine boundaries and the "where does new logic go?" decision protocol live in **`AGENTS.md` → System Core / Engine Red Lines** and **→ New Feature "Where does this logic go?"**. Read those before adding or moving business logic. The boundaries are enforced by `backend/src/tests/architecture/SystemCoreBoundaries.test.ts`.

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

## Audit Engine

250g routes application-module audit emission through `IAuditEngine`. The legacy implementation remains `RecordChangeService` behind `LegacyAuditEngineAdapter`, but Sales, Purchases, POS, and controllers no longer construct or import that service directly.

The canonical call shape is:

```ts
auditEngine.record({
  companyId,
  entity: { type, id, number },
  action: 'CREATE' | 'UPDATE' | 'POST' | 'PERIOD_LOCK_OVERRIDE',
  actor: { userId, userEmail },
  before,
  after,
  reason,
  approval,
});
```

Sales and Purchases use `auditEngineLegacyHelpers.ts` to preserve their existing create/update/post/period-lock payloads while moving the transport to the System Core engine. POS now emits audit records for:

- completed POS receipts;
- completed POS returns;
- POS settings updates;
- POS register create/update.

`SystemCoreBoundaries.test.ts` guards against application modules and controllers importing `RecordChangeService` directly.

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

## Tax Engine

250h moves the shared line/charge tax math into `application/system-core/tax/TaxEngine.ts` behind `ITaxEngine`. The old `SalesInvoiceCalculationService` remains only as a compatibility wrapper so existing Sales call sites keep their API while the implementation is owned by System Core.

The engine now owns:

- `calcLine(...)` for exclusive/inclusive price splitting, line discounts, document/base tax, and currency-aware rounding.
- `calcCharge(...)` for header/charge tax.
- `allocateInvoiceDiscount(...)` for proportional invoice-discount allocation by eligible net line total, excluding gift, tax-exempt, and non-discountable lines.
- `recoverable(...)` for purchase input tax recoverability classification.

Sales Invoice and Purchase Invoice entity normalization both call the shared calculation path. Purchase Invoice creation and posting tax-freeze paths also use `calculateTaxLineAmounts(...)`, and POS preview/sale posting now calls `ITaxEngine` instead of carrying local line-tax formulas. This preserves existing SI/PI/POS totals while enforcing a single calculation source for the audited invoice and POS paths.

Accounting boundary: 250h does not automatically apply invoice-level discount allocation to posted document totals. The allocation API is available and tested, but applying it to live SI/PI totals changes tax and grand totals and must be done as an explicit business/accounting slice.

## Numbering Engine

250i makes `application/system-core/numbering/NumberingEngine.ts` the allocator for voucher numbers, Sales/Purchase document numbers, recurring Sales Invoice numbers, and POS receipt numbers. The engine implements `INumberingEngine.next(...)` with explicit scope keys:

- `scope: 'company'` for accounting vouchers and Sales/Purchase documents.
- `scope: 'branch'` with `branchId` for future branch-local sequences.
- `scope: 'terminal'` with `terminalId` for POS receipt sequences.

The engine stores sequence state through the existing `IVoucherSequenceRepository` implementations. This is intentionally a repository-generalization step rather than a destructive schema rename: Firestore and Prisma continue using their proven atomic sequence storage while System Core owns the allocation contract. Formats now support arbitrary `{COUNTER:n}` widths so legacy vouchers keep 4 digits, Sales/Purchase documents keep 5 digits, and POS receipts keep 6 digits.

Existing module settings fields such as `siNumberNextSeq`, `poNumberNextSeq`, and `receiptNextSeq` are used as lazy seed values the first time a unified sequence is allocated, then mirrored forward for settings-screen compatibility. This preserves pre-alpha sequence continuity without a production data migration.

Accounting boundary: 250i changes number allocation ownership only. It does not alter voucher posting, tax, COGS, AR/AP, payment status, period locks, approvals, or inventory valuation.

## Inventory Core

250j makes `IInventoryCore` the canonical contract for shared inventory posting support. `ISalesInventoryService` and `IPurchasesInventoryService` remain as deprecated type aliases for one phase, but active Sales, Purchases, and POS consumers now type against `IInventoryCore`.

The core still delegates stock movement writes to `RecordStockMovementUseCase`; 250j does not change quantity movement, costing, or valuation formulas. The new responsibility moved into the core is COGS account resolution and COGS bucket accumulation:

- `resolveCOGSAccounts(...)` chooses item-level, category-level, then module-default COGS and inventory asset accounts.
- `addToCOGSBucket(...)` aggregates base COGS amounts by COGS/inventory account pair.
- `ensureInventoryCore(...)` upgrades legacy test doubles/thin adapters at constructor boundaries so old mocks do not reintroduce Sales-owned COGS logic.

Sales Delivery Note, Sales Invoice, and Sales Return posting now call the inventory core for this COGS resolution/accumulation instead of owning local `AccumulatedCOGS` / `COGSBucketLine` helpers. Voucher creation remains in the Sales posting workflow because the voucher timing and source metadata are document-specific.

Accounting boundary: 250j is intended as a pure ownership move. Golden COGS posting regressions for SI/SR/PI/PR and DN were run; COGS amounts, inventory credits/debits, stock movement quantities, tax, AR/AP, and voucher balancing are unchanged.

## Accounting Bridge

250k hardens `IAccountingBridge` from a POS posting seam into the strategy point for financial-event recording. The bridge now selects a recording mode from the tenant's Accounting Engine readiness (`companyModule.accounting.initialized`), **not** from the Accounting App/UI visibility toggle (`isEnabled`):

- `full` when the Accounting Engine is initialized: delegates to the existing `SubledgerVoucherPostingService.postInTransaction(...)`. Voucher and ledger output are unchanged.
- `minimal` when the Accounting Engine is not initialized (company not linked to accounting): writes a `PostingLog` minimal-journal record in the same transaction context when available, and does not post a ledger voucher.

The distinction is intentional: the Accounting App/UI toggle (`isEnabled`) controls UI/management exposure only and must never gate posting correctness; the bridge still records the operational financial event regardless. Minimal records are audit-grade event captures, not full ledger postings; initializing the Accounting Engine later still requires an explicit migration/replay policy before those events become ledger vouchers.

POS sale, return, and shift over/short flows now route through `IAccountingBridge`. `SystemCoreBoundaries.test.ts` blocks POS application/controllers from importing `SubledgerVoucherPostingService` or calling `postInTransaction(...)` directly.

Scope note: Task 267-F is migrating source-module posters behind `IAccountingBridge` in small golden-test slices. Sales DeliveryNote, SalesInvoice, SalesReturn, Sales PaymentSync, Goods Receipt, Purchase Invoice, Purchase Return, Purchases PaymentSync, and Inventory Opening Stock paths are now bridge-only. The remaining Inventory Stock Adjustment, Stock Transfer, and Inventory Revaluation posting paths remain follow-up slices and must keep using golden voucher-output checks before migration.

## Commercial Core

250l-1 starts moving pricing and discount math into `ICommercialCore` without changing posted totals. The new `application/system-core/commercial/CommercialCore.ts` owns:

- `calcDiscount(...)` / `calculateCommercialDiscountAmount(...)` for PERCENT and AMOUNT line discounts with gross clamping.
- `calcLine(...)` / `calculateCommercialLineAmounts(...)` for commercial line amounts. Commercial Core computes the discount amount, then passes that explicit discount to Tax Engine for tax-exclusive/inclusive splitting.
- `resolvePrice(...)` as the shared price-resolution seam.

Sales Invoice and Purchase Invoice normalization now call Commercial Core for line amount calculation. Existing Sales/Purchases price-list persistence and lookup use cases are not merged in this first slice; their behavior is unchanged. POS product search now asks `ICommercialCore.resolvePrice(...)` for the displayed cashier price and falls back to the item `salePrice` when no resolver result exists.

Accounting boundary: 250l-1 is intended as an ownership move. Golden SI/PI line-discount and inclusive-tax regressions were run; line subtotal, discount, tax, grand total, and purchase posting outcomes are unchanged.

250l-2 adds the cost/margin guard to Commercial Core:

- `validateCostMargin(...)` compares base selling price against base unit cost and optional minimum margin percent.
- Healthy margins return `allowed: true`.
- Unknown or zero cost returns `NO_COST` and does not block, avoiding false failures for service/unsettled-cost paths.
- Below-cost or below-minimum-margin results evaluate the `below_cost_sale` approval subject through `IApprovalEngine` unless the caller passes an approved override.

POS sale posting now invokes `validateCostMargin(...)` after Inventory Core resolves actual unit cost for a stock OUT. Pending approval blocks the POS sale before vouchers are emitted; an approved override lets posting continue. Normal sale totals and voucher math are unchanged.

### Selling Policy (shared below-cost rule, Task 264)

The below-cost / minimum-margin rule is configured by a single company-wide
**SellingPolicy** (`domain/system-core/entities/SellingPolicy.ts`, stored via
`ISellingPolicyRepository`). It is owned by no module and consumed by several —
the same store drives the POS till and the Sales invoice posting path, so they
can never disagree. It carries:

- `belowCostMode`: `BLOCK` (refuse outright), `REQUIRE_APPROVAL` (block pending a
  manager approval/override — the default, matching pre-policy POS behaviour), or
  `ALLOW` (sell below cost freely).
- `minMarginPercent` (optional): a line below this gross margin is treated like a
  below-cost line.
- `allowManagerOverride` (default true): when false, even an approved override
  cannot bypass a violation (absolute control).

**Consumption.** `CommercialCore.validateCostMargin(...)` resolves this policy
through a DI delegate (unless the caller pins the mode in the context) and does
the margin math + mode application + `below_cost_sale` approval routing. Because
the Commercial Core self-resolves the policy, the POS path needs no change to
honour it. The Policy Engine additionally exposes the rule as a cross-module
façade — `resolve({ scope: 'commercial', action: 'belowCostSale', ... })` —
delegating to the Commercial Core so any module can ask the same question and get
the same verdict (mirrors how `scope: 'accounting'` approval policy is shared).

**Attach points.** POS: `PostPosSaleUseCase` (unchanged call, now policy-driven).
Sales: `PostSalesInvoiceUseCase` runs the guard after Phase 1D computes line cost,
comparing line net revenue vs line cost (both base currency, so UOM-agnostic) and
throwing before any voucher is written when the verdict is blocked.

**Editing doorways (one store, per-module entry points).** The policy is a single
shared store, but — because modules are independent — it has a doorway in **every**
consuming module, never just one: **Sales → Settings → Sales Policy**
(`GET/PUT /tenant/sales/selling-policy`) and **POS → Settings → Below-cost selling
policy** (`GET/PUT /tenant/pos/selling-policy`), each gated by its own module
permission and reachable even if the other module is disabled. Both read/write the
same `SellingPolicy` doc, so there is one source of truth. The request validator
lives in a neutral `api/validators/sellingPolicy.validators.ts` so neither
module's controller imports the other's. See `AGENTS.md` → *Engines vs Modules*
(🚩 shared-config doorway rule).

250l-3 moves promotion evaluation behind `ICommercialCore.applyPromotions(...)`. The neutral core model supports the existing rule mechanics without importing Sales internals:

- Rules evaluate by ascending priority.
- Each line can receive at most one threshold discount and one buy-X-get-Y free-good result.
- Manual line discounts block automatic threshold discounts.
- Buy-X-get-Y free goods become explicit zero-price lines; inventory movement and COGS still run for stock items.

`PromotionApplicationService` remains as a Sales compatibility wrapper over the core evaluator. POS posting now asks Commercial Core for promotions before tax and posting math, so dry-run/payment validation and actual posting see the same promoted cart. POS receives rules through a structural reader supplied by DI; POS code does not import Sales use-cases or Sales domain entities.

## Current Guardrail

`backend/src/tests/architecture/SystemCoreBoundaries.test.ts` now exists. As of 250d2, the folder-wide POS application guard is active: files under `backend/src/application/pos/` must not import Sales application or Sales domain internals. POS sale and return posting both route through POS-owned use-cases over `IInventoryCore` and `IAccountingBridge`.

250h adds tax guardrails: the `ITaxEngine` contract and legacy adapter must not import Sales calculation internals, and POS sale/preview code must not carry local line-tax calculators. 250i adds a POS receipt guard: sale completion must allocate receipt numbers through `INumberingEngine`, not local `receiptPrefix/receiptNextSeq` string construction. 250j adds guards that active inventory consumers use `IInventoryCore` rather than Sales/Purchases-named contracts, and that Sales delegates COGS account resolution and bucket accumulation to inventory core. 250k adds the POS accounting bridge guard described above. 250l-1 blocks Commercial Core from importing Sales calculation internals.
