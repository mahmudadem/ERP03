# System Core / Shared Engines — Master Architecture Plan

**Date:** 2026-06-21
**Status:** Master architecture plan — **decisions only. No code, no migrations, no file moves.**
**Owner:** System Core / Shared Engines (new boundary defined by this document)
**Supersedes scope of:** ad-hoc engine ownership inside the Sales App.

## Source audits (authoritative references)

This plan does not re-derive findings; it builds on the three code-only audits. Every "why" traces to them:

- [System Core / Shared Engines Audit](../audit/system-core-shared-engines-audit.md) — which engines exist, which are embedded, which are missing.
- [POS Audit §9 — Commercial Rules & Promotions](../audit/pos-commercial-rules-and-promotions-audit.md) — POS is a thin cart→Sales-Invoice pass-through; no commercial engine.
- [POS Audit §10 — Module Independence & Persona Integrity](../audit/pos-module-independence-and-engines-audit.md) — POS silently converts to `sales_invoice`, is governed by `SalesSettings`, has no engines.

Related existing docs to update on implementation: [pos.md](./pos.md), [sales.md](./sales.md), [purchases.md](./purchases.md), [inventory.md](./inventory.md), [accounting.md](./accounting.md), [pricing.md](./pricing.md), [promotions.md](./promotions.md), [POS_MODULE_ARCHITECTURE_DECISION.md](./POS_MODULE_ARCHITECTURE_DECISION.md).

> **One-line thesis:** POS is not broken in isolation — it exposed that **Sales is acting as a de-facto commercial core**. The fix is to define a **System Core** that owns cross-module business engines, make application modules thin orchestrators, and unblock POS by fixing three structural lies (wrong persona, Sales-owned authorization, Sales-owned posting path) *before* building more POS surface.

---

## 1. System Core boundary (the governing decision)

### Decision

Introduce a **System Core / Shared Core** layer that **owns all cross-module business engines**. Application modules (Sales, Purchases, Inventory UI, Accounting UI, POS) become **user-facing orchestrators** that depend on System Core **interfaces** — never on each other's entities or use-cases.

### The rule (state it, enforce it)

1. **System Core owns shared business logic.** Pricing, discount, tax math, money rounding, document identity/persona, numbering, policy resolution, audit, inventory movement, financial posting are System Core concerns. No application module may *own* any of these.
2. **Application modules are orchestrators.** A module composes engine calls into a user-facing workflow (a screen, a document lifecycle, a report). It owns its UI, its persistence wiring, and its workflow specifics — nothing more.
3. **Modules depend on interfaces, not internals.** A module may call `ITaxEngine`; it may **not** import `SalesInvoiceCalculationService` or construct `CreateSalesInvoiceUseCase` to borrow its math.
4. **No module governs another module.** `SalesSettings` may configure Sales. It must not authorize, gate, or shape POS, Purchases, or any other module's behavior.
5. **Engine ≠ App.** A business engine runs whenever its inputs exist. An "App" is a *UI/management surface* gated by entitlement. Activating or deactivating an App changes what the user can *see and manage* — it never turns an engine off. (This is the project's existing engine-vs-UI split, now generalized to every engine. See §"Engine vs App activation rule" below and the existing [accounting engine vs UI memory].)

### Target layering

```
domain/system-core/            ← shared entities (Document identity/persona, Policy, Money, Tax types, Audit record)
application/system-core/       ← the engines: Document, Numbering, Money, Tax, Commercial, Policy, Audit, Accounting Bridge
application/inventory/contracts ← Inventory Core (already exists as a contract; rename target IInventoryCore)
application/accounting/services ← Accounting/Financial Core (already exists; add bridge contract)

application/sales|purchases|pos ← orchestrators that consume the above via interfaces only
```

> Naming note: the audit uses `system-core/` and `shared-core/` interchangeably. **This plan standardizes on `system-core/`.** The folder move itself is **long-term cleanup** (§5) — V1 introduces the *interfaces* and may leave implementations where they currently live behind adapters.

---

## 2. Required shared engines — responsibilities & minimum contracts

Each engine below states: **responsibility**, **minimum V1 contract**, and **current state** (from the audit). The contract is the *interface* a module depends on; the V1 implementation behind it may be a temporary adapter (§4).

> Interface signatures are illustrative target shapes, not final API. They exist to pin responsibility boundaries.

### 2.1 Document Core — `IDocumentCore`

- **Responsibility:** Document *identity* and *lifecycle*. Owns the document-type / persona enum as the **source of truth**, status, posting-state, and shared editability rules. Absorbs `PostedDocumentEditGuard` and the persona half of `DocumentPolicyResolver`.
- **Minimum contract:**
  - `createIdentity(docType, persona)` → typed identity carrying persona end-to-end.
  - `transition(identity, state)` → guarded status/posting-state change.
  - `assertEditable(identity)` → throws if posted/locked.
- **Persona enum (source of truth, target):** `SALES_DIRECT_INVOICE`, `SALES_LINKED_INVOICE`, `POS_DIRECT_SALE`, plus existing `service`. The persona **must survive to ledger and reporting** — it is never flattened.
- **Current state:** ❌ Embedded. Persona is `'direct' | 'linked' | 'service'` ([DocumentPolicyResolver.ts:137-216](../../backend/src/application/common/services/DocumentPolicyResolver.ts:137)); no `POS_DIRECT_SALE`. This is *why* POS masquerades as `sales_invoice`.

### 2.2 Numbering Engine — `INumberingEngine`

- **Responsibility:** One sequence service for **all** document/voucher/receipt numbers, with scope keys.
- **Minimum contract:** `next({ companyId, docType, scope, branchId?, terminalId? })` → next number for that scope.
- **Absorbs:** accounting `VoucherSequenceUseCases`, per-module document numbering, and `PosSettings` receipt numbering.
- **Current state:** 🟡 Split & embedded — voucher sequences in Accounting, document numbers per-use-case, POS receipts local to `PosSettings`. No per-branch/per-terminal scheme.

### 2.3 Money / Currency / Rounding Core — `IMoneyCore`

- **Responsibility:** One precision-aware rounding authority + base-currency conversion. Eliminates the **17 copy-pasted `roundMoney`** functions.
- **Minimum contract:**
  - `round(value, currency)` — precision from `CurrencyPrecisionHelpers`.
  - `roundCash(value, currency, rule)` — POS cash rounding (currently stored-only, never applied).
  - `toBase(value, currency, rate)` — reuse `ExchangeRateService`.
- **Current state:** 🟡 FX/precision helpers exist as a core, but documents bypass them; rounding duplicated 17×, almost all hardcoded to 2 decimals.

### 2.4 Tax Engine — `ITaxEngine`

- **Responsibility:** All tax math — inclusive/exclusive back-calc, per-line tax, charge tax impact, **invoice-discount allocation to lines**, and purchase recoverable/non-recoverable input tax.
- **Minimum contract:**
  - `calcLine(input)` → line tax.
  - `calcCharge(input)` → charge/header tax.
  - `allocateInvoiceDiscount(lines, discount)` → re-prorated line tax/revenue (fixes the broken `taxRate=0` DISCOUNT model).
  - `recoverable(taxCode)` → recoverable vs non-recoverable.
- **Current state:** ❌ Embedded in `SalesInvoiceCalculationService` + `SalesInvoice`, re-implemented in Purchases. `TaxCode` *entity* is shared; *calculation* is not. Invoice-level discount tax impact is broken; purchase recoverable tax missing.

### 2.5 Commercial Core — `ICommercialCore`

- **Responsibility:** Pricing/price-lists, line calculation, discount calculation, invoice-discount allocation orchestration, promotions/flash-sales/BXGY/coupons, and cost/margin & below-cost policy.
- **Minimum contract:**
  - `resolvePrice(ctx)` → unit price from price list/customer group/etc.
  - `calcDiscount(ctx)` → line/invoice discount.
  - `applyPromotions(cart, policy)` → promotion results (advisory or applied per policy).
  - `validateCostMargin(line, policy)` → below-cost / min-margin verdict.
- **V1 scope:** **minimal line calculation only** behind the interface (§4). Promotions, cost/margin, coupons are explicitly **after POS V1** (they're already absent — POS Audit §9).
- **Current state:** ❌ Missing as a core; pieces scattered across Sales (`PriceListUseCases`, `SalesInvoice`, `PromotionApplicationService` which is sales-only/unwired), duplicated in Purchases.

### 2.6 Policy Engine — `IPolicyEngine`

- **Responsibility:** Resolve "is this action allowed, and does it require approval?" across company/module/item/role/terminal scopes with **most-restrictive-wins**.
- **Minimum contract:** `resolve(scope, action, context)` → `{ allowed, requiresApproval, resolvedBy }`.
- **Precedence rule:** **most-restrictive-wins** (a stricter scope can tighten but never loosen a broader one). This is a deliberate change from the current most-specific-wins.
- **Owns policy entities:** `CompanyCommercialPolicy` (defaults) + `POSPolicy`, `POSTerminalPolicy`, `CashierRolePolicy`, `ItemPolicy`, `PromotionPolicy`, `InventoryPolicy`, `AccountingPolicy`.
- **Current state:** 🟡 `DocumentPolicyResolver` resolves Sales/Purchases persona governance only, most-specific-wins, and POS authorization is wrongly stored as a `SalesSettings` governance rule.

### 2.7 Inventory Core — `IInventoryCore`

- **Responsibility:** Stock validation, stock IN/OUT, costing, negative-stock policy, warehouse validation, and COGS basis.
- **Minimum contract:** existing `processIN` / `processOUT` + add cost/margin reads (`getCostBasis(itemId, warehouseId)`).
- **Decisions:** rename `ISalesInventoryService` → neutral `IInventoryCore` (the Sales-bias name is consumed by Purchases too); pull COGS accumulation out of `SalesInvoiceUseCases`.
- **Current state:** ✅ Exists and is the best-bounded core. Caveats: Sales-named contract; COGS accumulation partly inside Sales.

### 2.8 Accounting / Financial Core — `PostingGateway` / `Subledger*PostingService`

- **Responsibility:** Post financial events (revenue/tax/COGS/settlement vouchers). Already genuinely shared and consumed by sales, purchases, inventory, and pos (over/short).
- **Decision:** keep as-is for V1; full voucher posting remains the default implementation behind the bridge (§2.9).
- **Current state:** ✅ Exists. No `module-enabled` gate, so the engine already runs while the Accounting *UI* is hidden — matches intent.

### 2.9 Accounting Bridge — `IAccountingBridge`

- **Responsibility:** A lightweight contract through which any module emits a financial event, **without depending on the Accounting App UI**. Decouples "record the event" from "manage the ledger."
- **Minimum contract:** `recordFinancialEvent(event)` → full posting when Accounting enabled; minimal journal otherwise.
- **Current state:** ❌ Missing. POS posts the *full* Sales→voucher path. The "always-on engine" covers the intent *by accident*, not by an explicit contract.

### 2.10 Audit Engine — `IAuditEngine`

- **Responsibility:** One entry point for lifecycle + override + approval + void/cancel audit, consumed by **all** modules including POS.
- **Minimum contract:** `record({ entity, action, before, after, actor, reason, approval })`.
- **Current state:** 🟡 `RecordChangeService` + `IAuditLogRepository` exist; `recordCreate` emitted by Sales/Purchases but **not POS**. Override/approval/void audit missing.

---

## 3. POS-blocking fixes (mandatory before POS work continues)

These remove the three **structural lies** (wrong persona, Sales-owned authorization, Sales-owned posting path) that otherwise get baked into POS data shape and authorization, making every later POS feature wrong-by-construction.

### 3.1 Add `POS_DIRECT_SALE` as a real persona / source of truth
- Add `POS_DIRECT_SALE` to the document-type/persona enum in Document Core. It must carry end-to-end (entity → posting → ledger → reporting).
- **Why:** POS Audit §10 rule 7/8 — there is no POS persona today, forcing the masquerade.

### 3.2 Stop converting POS into `sales_invoice` / `direct`
- Remove the `voucherType:'sales_invoice'`, `persona:'direct'`, `formType:'pos_sale'` collapse in [CompletePosSaleUseCase.ts:201-208](../../backend/src/application/pos/use-cases/CompletePosSaleUseCase.ts:201).
- The posting layer must **accept a POS persona natively** (or route through a POS-owned posting path) rather than rejecting `pos_sale`.
- **Why:** POS Audit §10 rule 8 — the conversion is currently asserted by a test ([CompletePosSale.test.ts:201](../../backend/src/tests/application/pos/CompletePosSale.test.ts:201)); that assertion will be **inverted** (§6).

### 3.3 Remove POS authorization from `SalesSettings.governanceRules`
- Remove the `ISalesSettingsRepository` dependency from `UpdatePosSettingsUseCase`; the POS toggle must not insert/remove `pos_direct_sale_form_allow` into `SalesSettings` ([PosSettingsUseCases.ts:99-119](../../backend/src/application/pos/use-cases/PosSettingsUseCases.ts:99)).
- POS sale authorization must resolve against **POS policy**, not `DocumentPolicyResolver.isSalesInvoicePersonaAllowed(salesSettings, …)`.
- **Why:** POS Audit §10 rule 5 — `SalesSettings` is currently the authority over POS, and if Sales is unconfigured, enabling POS silently no-ops then blocks every sale.

### 3.4 Introduce `POSPolicy` / `POSTerminalPolicy` / `CashierRolePolicy`
- Create these as POS-owned policy entities resolved by `IPolicyEngine` (most-restrictive-wins).
- `allowPosDirectSales` resolves against POS policy **even when Sales is disabled/unconfigured**.
- **Why:** POS Audit §10 rule 6 — none of these exist; POS inherits Sales/company behavior.

### 3.5 Create a POS posting entry point independent of `CreateSalesInvoiceUseCase`
- POS must post through the **Accounting/Financial Core (via `IAccountingBridge`)** or a dedicated POS posting use-case — **not** by constructing `CreateSalesInvoiceUseCase` + `PostSalesInvoiceUseCase` ([CompletePosSaleUseCase.ts:94-96](../../backend/src/application/pos/use-cases/CompletePosSaleUseCase.ts:94)).
- For V1, the posting *implementation* may still produce the same voucher set (temporary adapter, §4) — but POS depends on the **bridge interface**, not on Sales use-cases.
- **Why:** POS Audit §10 rule 1 — POS is functionally Sales-dependent today.

### 3.6 Prove POS can be enabled and used without the Sales App enabled
- POS-on / Sales-off must: enable POS direct sales, complete a sale, and post it — with persona `POS_DIRECT_SALE` intact.
- **Why:** This is the acceptance gate for the whole POS-blocking set. Tracked as a test in §6.

---

## 4. Temporary adapters allowed (V1 pragmatism)

For V1, **introduce the interfaces first** and allow temporary adapters behind them. The hard rule: **POS depends on the interface, never on Sales internals.**

| Interface | V1 temporary adapter allowed | Hard constraint |
|---|---|---|
| `ITaxEngine` | May delegate to existing Sales/Purchase tax logic (`SalesInvoiceCalculationService`). | POS calls `ITaxEngine`, not the Sales service directly. |
| `INumberingEngine` | May wrap existing sequence logic (voucher sequences / `PosSettings` receipt seq). | Callers depend on `next(scope)`, not on `PosSettings.receiptNextSeq`. |
| `ICommercialCore` | May support **only minimal line calculation** in V1 (no promotions/cost-margin/coupons). | Surface is the interface; missing features fail closed or are out of scope, not bypassed. |
| `IAccountingBridge` | Default impl = full voucher posting (current path). | POS depends on `recordFinancialEvent`, not on `CreateSalesInvoiceUseCase`. |
| `IInventoryCore` | Keep current `ISalesInventoryService` impl behind the renamed interface. | Neutral name; no direct repo writes from modules. |

**Adapter discipline:** every temporary adapter is a documented seam with a removal target in §5 (long-term cleanup). An adapter is acceptable **only** if swapping it later does not change any module's call sites.

---

## 5. Refactor order

Ordered by lowest→highest risk and by what POS structurally requires. Tests pin behavior before each step (§6). No production data exists, so this is about correctness and rework cost, not data migration.

### Must fix BEFORE POS V1 (POS-blocking)
1. **Document Core persona** — add `POS_DIRECT_SALE`; stop POS→`sales_invoice` conversion; POS posts as itself. *(§3.1, §3.2)*
2. **Policy Engine minimum + POS decoupling** — `POSPolicy`/`POSTerminalPolicy`/`CashierRolePolicy`; remove `UpdatePosSettingsUseCase`→`SalesSettings` writes; authorization via POS policy. *(§3.3, §3.4)*
3. **POS posting entry point** — POS posts via `IAccountingBridge` / POS use-case, not `CreateSalesInvoiceUseCase`. *(§3.5)*
4. **POS-on / Sales-off proof** — acceptance gate. *(§3.6)*

### Can be implemented DURING POS V1 (cheap, additive, not strictly blocking)
5. **Money Core dedup** — replace 17 `roundMoney` copies with one precision-aware helper; apply POS `roundCash`. Behavior-preserving, high existing coverage.
6. **Audit Engine consolidation** — standardize `recordCreate` into `IAuditEngine`; wire POS receipts/returns/settings; add override/approval hooks.
7. **`ITaxEngine` / `INumberingEngine` / `ICommercialCore` interfaces introduced as thin adapters** (§4) so POS depends on contracts even while implementations stay put.

### Can wait AFTER POS V1
8. **Tax Engine extraction** — lift Sales tax math into `ITaxEngine`; Purchases consume it; add discount-allocation + recoverable. (V1 keeps delegating via the adapter.)
9. **Numbering Engine unification** — branch/terminal/type scope. (POS receipt numbering already works locally.)
10. **Inventory Core tidy** — rename `ISalesInventoryService`→`IInventoryCore`; move COGS accumulation out of `SalesInvoiceUseCases`.
11. **Commercial Core (full)** — re-home pricing/discount/promotions/cost-margin from Sales; wire Sales+Purchases+POS. Highest risk; touches posting-sensitive math; do last, behind golden tests.
12. **Accounting bridge hardening** — explicit `IAccountingBridge` with minimal-journal mode for Accounting-UI-off.

### Long-term cleanup
13. **Physical `system-core/` folder move** — relocate engine implementations out of `application/sales` etc. into `application/system-core/`, deleting adapters from step 7 once call sites are stable.
14. **Persona/document model consolidation** — collapse per-entity status/posting-state fields onto Document Core.
15. **Neutral naming sweep** — remove residual Sales-biased names across contracts.

---

## 6. Testing requirements

These tests define "done" for the POS-blocking work. Several **invert existing assertions** that currently lock in the wrong behavior.

| # | Test | Asserts | Replaces / notes |
|---|---|---|---|
| T1 | **Persona integrity** | A POS sale is stored & posted with persona `POS_DIRECT_SALE`; it is **not** converted to a plain `sales_invoice`; persona survives to ledger/reporting. | **Inverts** [CompletePosSale.test.ts:201](../../backend/src/tests/application/pos/CompletePosSale.test.ts:201) which currently asserts `voucherType === 'sales_invoice'`. |
| T2 | **POS without Sales App** | With Sales App disabled/unconfigured, POS can be enabled, can complete a sale, and posts successfully. | New. Acceptance gate for §3.6. |
| T3 | **POSSettings isolation** | Updating POS settings (incl. `allowPosDirectSales`) writes **nothing** into `SalesSettings` / `SalesSettings.governanceRules`. | New. Guards against regression of §3.3. Update [PosSettingsUseCases.test.ts](../../backend/src/tests/application/pos/PosSettingsUseCases.test.ts). |
| T4 | **POS policy can be stricter than Sales** | A `POSPolicy`/`CashierRolePolicy` restriction denies an action that Sales policy would allow (most-restrictive-wins). | New. Validates `IPolicyEngine` precedence. |
| T5 | **POS posting without Sales use-cases** | POS posting calls Inventory Core + Accounting Bridge directly; no `CreateSalesInvoiceUseCase`/`PostSalesInvoiceUseCase` is constructed on the POS path. | New. Validates §3.5 (can assert via dependency wiring / spy). |

Supporting (during/after V1): unit tests for the Money Core rounding helper (golden totals), Audit Engine emission for POS, and — when extracted — golden-total tests pinning Tax Engine and Commercial Core against current Sales output.

---

## 7. Documentation updates

On implementation (not now), create/update:

### New docs
- **`docs/architecture/system-core.md`** — the System Core boundary, the engine inventory, and the interface contracts (§1, §2). This master plan is its design record.
- **`docs/architecture/module-boundaries.md`** — application-module-as-orchestrator rules; the "modules depend on interfaces, not internals" red line; the dependency-direction diagram.
- **`docs/architecture/pos-independence.md`** — POS independence rules: persona integrity, no `SalesSettings` coupling, POS-owned policies, POS posting entry point, and the POS-on/Sales-off guarantee.

### Updated docs
- **[pos.md](./pos.md)** — replace the "POS → Sales Invoice pass-through" description with the `POS_DIRECT_SALE` persona + POS posting path; correct the §3a / §6 follow-ups (audit, policy).
- **[POS_MODULE_ARCHITECTURE_DECISION.md](./POS_MODULE_ARCHITECTURE_DECISION.md)** — record this plan as the binding decision; note the persona/policy/posting changes.
- **[sales.md](./sales.md)** / **[purchases.md](./purchases.md)** — note that tax/money/numbering/commercial logic is migrating to System Core; Sales/Purchases become consumers.
- **[inventory.md](./inventory.md)** — `ISalesInventoryService` → `IInventoryCore` rename and COGS-accumulation move (after-V1).
- **[accounting.md](./accounting.md)** — `IAccountingBridge` contract and the engine-vs-UI activation rule.
- **[promotions.md](./promotions.md)** / **[pricing.md](./pricing.md)** — fold into Commercial Core (after-V1).

### The "Engine vs App activation rule" (document explicitly, everywhere relevant)

> **An App's activation gates visibility and management only. Engines run regardless.**
> - Disabling the Accounting App hides the ledger/TB/CoA/statements UI — financial events are still recorded via `IAccountingBridge`.
> - Disabling the Inventory App hides inventory management — stock items still move stock via `IInventoryCore`; services/non-stock sell freely.
> - Disabling the Sales App must **not** affect POS at all.

This generalizes the project's confirmed accounting engine-vs-UI architecture to every System Core engine.

---

## Appendix — decision summary (one screen)

| Area | Decision |
|---|---|
| **Ownership** | System Core owns all shared business engines; modules are orchestrators over interfaces. |
| **POS persona** | `POS_DIRECT_SALE` is a first-class persona, source of truth, never flattened. |
| **POS authorization** | Owned by `POSPolicy`/`POSTerminalPolicy`/`CashierRolePolicy` via `IPolicyEngine`; never `SalesSettings`. |
| **POS posting** | Through `IAccountingBridge` / POS use-case; never `CreateSalesInvoiceUseCase`. |
| **Policy precedence** | Most-restrictive-wins (changed from most-specific-wins). |
| **V1 adapters** | Allowed behind interfaces; POS depends on the interface, not Sales internals. |
| **Folder move** | Long-term cleanup, not V1. V1 introduces interfaces + adapters in place. |
| **Engine vs App** | Activation gates UI/management only; engines always run. |
| **First gate** | POS-on / Sales-off completes and posts a sale with persona intact (T2). |
