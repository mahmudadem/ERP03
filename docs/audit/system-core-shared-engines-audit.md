# System Core / Shared Engines — Architecture Audit

**Date:** 2026-06-21
**Trigger:** POS work paused. The discovery in [POS audit §10](./pos-module-independence-and-engines-audit.md) — POS coupled to Sales — turned out to be a symptom. The real question: **are the shared business engines owned by a System/Shared Core, or are they embedded inside application modules (Sales especially)?**
**Method:** code-only, repo-wide. Every claim cites an exact file/line. Per the directive: an engine that exists only as logic inside `SalesInvoice` or a Sales use case is classified **embedded, not independent.** No engines are invented.
**Status:** Architecture audit only — *no code, no migrations, no file moves.*

> **One-line verdict:** Two real shared cores exist — **Accounting/Financial** (`PostingGateway` + `Subledger*PostingService`) and **Inventory** (`ISalesInventoryService` contract + costing services). Everything else — **Document, Numbering, Money/Rounding, Tax, Commercial, Policy, Audit** — is **embedded in modules (overwhelmingly Sales)** or **missing**. Sales is acting as a de-facto commercial core that POS and Purchases reach into or duplicate. `roundMoney` alone is copy-pasted **17 times**.

---

## A. Current architecture summary

The backend is layered `domain/ → application/ → infrastructure/` with per-module folders (`sales`, `purchases`, `inventory`, `accounting`, `pos`, …). There **is** a thin shared layer:

- `domain/core/` — `Company`, `CompanySettings`, `Currency`, `ExchangeRate`, `CurrencyPrecisionHelpers`, `User`.
- `application/core/` — `ExchangeRateService`, company/currency/user use-cases.
- `application/common/services/` — `DocumentPolicyResolver`, `SettingsResolver`, `PostedDocumentEditGuard`.
- `application/shared/` — `PartyUseCases`, `TaxCodeUseCases`, `PartyAccountCodeRenderer`.
- `domain/shared/entities/` — `Party`, `PartyItemPrice`, `TaxCode`, `PaymentHistory`.
- `application/accounting/services/` — `PostingGateway`, `SubledgerVoucherPostingService`, `SubledgerDocumentPoster` (the financial core).
- `application/inventory/contracts/InventoryIntegrationContracts.ts` — `ISalesInventoryService` (the inventory core boundary).

**But the *commercial* logic — pricing, discount, tax math, line/total calculation, document identity, numbering, money rounding — is not in any of these.** It lives inside the Sales domain entities (`SalesInvoice.ts`) and Sales services/use-cases, and is independently re-implemented in Purchases and POS. There is no `System Core` namespace that owns cross-domain business rules.

---

## B. Engines that already exist independently

| Engine | Where | Notes |
|---|---|---|
| **Accounting / Financial Core** | `application/accounting/services/PostingGateway.ts`, `SubledgerVoucherPostingService.ts`, `SubledgerDocumentPoster.ts` | ✅ Genuinely shared. Consumed by **sales** (`SalesInvoiceUseCases`, `SalesReturnUseCases`, `DeliveryNoteUseCases`, `PaymentSyncUseCases`), **purchases** (`GoodsReceiptUseCases`, `PurchaseInvoiceUseCases`, `PurchaseReturnUseCases`, `PaymentSyncUseCases`), **inventory** (`StockAdjustment/Transfer/Revaluation/OpeningStock`), **pos** (`PosShiftUseCases` over/short). No `module-enabled` gate on posting → engine runs regardless of Accounting *UI*. |
| **Inventory Core** | `application/inventory/contracts/InventoryIntegrationContracts.ts` (`ISalesInventoryService.processIN/processOUT`), `RecordStockMovementUseCase`, `InventoryValuationService`, `ItemCostingStatsService`, `domain/inventory/errors/NegativeStockError.ts` | ✅ Best-bounded business core. Sales/Purchases consume via the **contract**; no direct `stockLevelRepository`/`stockMovementRepository` writes found in `application/sales`, `application/purchases`, or `application/pos`. Costing, negative-stock policy, warehouse validation live here. **Caveats** in §D. |
| **Currency / FX (partial)** | `domain/core/Currency.ts`, `ExchangeRate.ts`, `CurrencyPrecisionHelpers.ts`; `application/core/services/ExchangeRateService.ts` | 🟡 Conversion + precision helpers exist as a core — but documents **don't route rounding through it** (see §C Money). |

---

## C. Engines that are missing (or only embedded)

### 1. Document Core — ❌ embedded
No shared document entity/lifecycle. Each module defines its own (`SalesInvoice`, `PurchaseInvoice`, `SalesReturn`, …) with its own status/posting-state fields. The only shared slivers are `DocumentPolicyResolver` (persona governance) and `SubledgerDocumentPoster` (posting abstraction). **Persona/document-type is `'direct' | 'linked' | 'service'`** ([DocumentPolicyResolver.ts:137-216](../../backend/src/application/common/services/DocumentPolicyResolver.ts:137)) — there is **no `POS_DIRECT_SALE` / `SALES_DIRECT_INVOICE` / `SALES_LINKED_INVOICE`** source-of-truth type, which is exactly why POS is forced to masquerade as `sales_invoice` ([POS audit §10](./pos-module-independence-and-engines-audit.md)).

### 2. Numbering Engine — 🟡 split & embedded
- Accounting owns **voucher** sequences: `application/accounting/use-cases/VoucherSequenceUseCases.ts`, `infrastructure/firestore/repositories/accounting/FirestoreVoucherSequenceRepository.ts`, `api/controllers/accounting/VoucherSequenceController.ts`.
- **Document numbers** are generated inside each module's use-cases (`SalesInvoiceUseCases`, `SalesOrderUseCases`, `QuoteUseCases`, `DeliveryNoteUseCases`, `PurchaseInvoiceUseCases`, `PurchaseOrderUseCases`, `GoodsReceiptUseCases`, …).
- **POS receipt numbering** is its own thing in `domain/pos/entities/PosSettings.ts:48-49,109-114`.
- No single numbering engine; **no per-branch / per-terminal / per-voucher-type** numbering scheme.

### 3. Money / Currency / Rounding Core — 🟡 partial; rounding embedded & duplicated
Currency/FX exists (§B). But **rounding is copy-pasted 17×** as a local `roundMoney`, almost all hardcoded to 2 decimals and **bypassing `CurrencyPrecisionHelpers`**:
`domain/sales/entities/SalesInvoice.ts:167`, `SalesOrder.ts:93`, `SalesReturn.ts:93`, `DeliveryNote.ts:53`, `CommissionEntry.ts:11`; `domain/purchases/entities/PurchaseInvoice.ts:158`, `PurchaseOrder.ts:75`, `PurchaseReturn.ts:76`, `GoodsReceipt.ts:43`; `domain/shared/entities/PaymentHistory.ts:26`; `application/sales/services/SalesInvoiceCalculationService.ts:7`; `application/sales/use-cases/QuoteUseCases.ts:13`, `SalesOrderUseCases.ts:23`, `SalesPostingHelpers.ts:3`; `application/purchases/use-cases/PurchaseOrderUseCases.ts:14`, `PurchasePostingHelpers.ts:3`; plus `application/pos/use-cases/CompletePosSaleUseCase.ts:19`. The **only** precision-aware variant is `domain/accounting/entities/VoucherLineEntity.ts:42` (`roundMoney(value, decimals)`). POS **cash rounding** is stored-only ([POS audit §9 B](./pos-commercial-rules-and-promotions-audit.md)).

### 4. Tax Engine — ❌ embedded & duplicated
- Sales tax math (inclusive/exclusive back-calc, line tax, totals) lives in `application/sales/services/SalesInvoiceCalculationService.ts` and `domain/sales/entities/SalesInvoice.ts`.
- Purchases re-implement tax inside `domain/purchases/entities/PurchaseInvoice.ts` (+ `PurchaseOrder`, `PurchaseReturn`) and `application/purchases/use-cases/PurchasePostingHelpers.ts`.
- `TaxCode` *entity* is shared (`domain/shared/entities/TaxCode.ts`, `application/shared/use-cases/TaxCodeUseCases.ts`) but **calculation is not.**
- **Invoice-level discount tax impact is broken** (DISCOUNT charge forced `taxRate=0`, never allocated to lines — [POS audit §9 B](./pos-commercial-rules-and-promotions-audit.md), `SalesInvoice.ts:525,535`).
- **Purchase recoverable vs non-recoverable input tax: MISSING** (grep for `recoverable`/`inputTax` finds nothing on the tax path). No shared Tax Engine.

### 5. Commercial Core — ❌ missing as a core; pieces scattered
- Pricing: `application/sales/use-cases/PriceListUseCases.ts` + `domain/sales/entities/PriceList.ts` (sales), and a **separate** `application/purchases/use-cases/PurchasePriceListUseCases.ts` + `domain/purchases/entities/PurchasePriceList.ts` (purchases). `CustomerGroup` in sales.
- Line + discount calculation: inside `SalesInvoice.ts` + `SalesInvoiceCalculationService.ts`.
- Promotions: `application/sales/services/PromotionApplicationService.ts` — **sales-only, unwired, advisory** ([promotions.md](../architecture/promotions.md)).
- Invoice-discount allocation to lines, flash sales, BXGY-in-document, coupons, cost/margin validation, below-cost policy: **all missing** ([POS audit §9](./pos-commercial-rules-and-promotions-audit.md)).

### 6. Policy Engine — 🟡 partial, Sales/Purchase-centric
- `application/common/services/DocumentPolicyResolver.ts` resolves persona governance for **Sales & Purchases only**, reading `SalesSettings`/`PurchaseSettings`. `SettingsResolver.ts` + `PostedDocumentEditGuard.ts` round out the shared layer.
- Precedence is **most-specific-wins** (form → branch → company → base), **not "most-restrictive-wins"** as required ([DocumentPolicyResolver.ts:176-216](../../backend/src/application/common/services/DocumentPolicyResolver.ts:176)).
- **Missing:** `CompanyCommercialPolicy`, `POSPolicy`, `InventoryPolicy`, `AccountingPolicy`, `ItemPolicy`, `CashierRolePolicy`, `TerminalPolicy`, and a unified manager-override / approval-requirement model. POS authorization is wrongly expressed as a **SalesSettings governance rule** ([PosSettingsUseCases.ts:99-119](../../backend/src/application/pos/use-cases/PosSettingsUseCases.ts:99)).

### 7. Inventory Core — ✅ exists (see §B); caveats in §D.

### 8. Accounting / Financial Core — ✅ exists (see §B); but **no minimal accounting bridge** (grep finds none). Financial events post via the *full* voucher path, not a lightweight bridge. Because posting has no `module-enabled` check, events **can** be recorded while the Accounting *UI* is hidden — which matches the intent, but by accident of "engine always runs," not by an explicit bridge contract.

### 9. Audit Engine — 🟡 partial
`application/system/services/RecordChangeService.ts` + `IAuditLogRepository`/`PrismaAuditLogRepository` exist and `recordCreate` is emitted by **sales** (`SalesInvoiceUseCases`, `SalesOrderUseCases`, `SalesReturnUseCases`, `DeliveryNoteUseCases`) and **purchases** (`PurchaseInvoiceUseCases`). **Not emitted by POS.** **Missing entirely:** price-override / tax-override / discount-override audit, manager-approval audit, unified document-lifecycle audit, void/cancel audit ([POS audit §9 I](./pos-commercial-rules-and-promotions-audit.md)).

---

## D. Logic currently embedded in the wrong module

1. **Money rounding** — should be in a Money Core; instead 17 local copies (§C-3). Risk: inconsistent precision across modules.
2. **Tax calculation** — should be a Tax Engine; instead in Sales (`SalesInvoiceCalculationService`, `SalesInvoice`) and re-implemented in Purchases (§C-4).
3. **Pricing / discount / promotions** — should be a Commercial Core; instead Sales-owned, Purchases-duplicated, POS-absent (§C-5).
4. **Document identity / persona / posting-state** — should be a Document Core; instead per-entity, with persona enum that omits POS (§C-1).
5. **Document numbering** — should be a Numbering Engine; instead per-use-case + a separate accounting voucher-sequence service + POS-local receipt numbering (§C-2).
6. **POS authorization** — lives in `SalesSettings.governanceRules` instead of a POSPolicy (§C-6, [POS audit §10](./pos-module-independence-and-engines-audit.md)).
7. **COGS accumulation** — partly inside `application/sales/use-cases/SalesInvoiceUseCases.ts` (`AccumulatedCOGS`, lines ~252+, inventory-account resolution at ~517) rather than wholly inside the Inventory Core; Sales imports inventory domain entities directly (`Item`, `StockLevel`, `StockMovement` at `SalesInvoiceUseCases.ts:25-27`).
8. **Inventory contract is Sales-named** — `ISalesInventoryService` (`InventoryIntegrationContracts.ts`) is consumed by Purchases too; the name encodes a Sales bias that should be a neutral `IInventoryCore`.

---

## E. Required System Core boundaries (target)

A `system-core/` (or `shared-core/`) layer owning cross-domain business rules, consumed by every user-facing module:

- **Document Core** — document identity, document-type/persona (incl. `POS_DIRECT_SALE`, `SALES_DIRECT_INVOICE`, `SALES_LINKED_INVOICE`), status, posting-state, shared lifecycle rules.
- **Numbering Engine** — one sequence service with scope keys (company / branch / terminal / voucher-type / document-type); absorbs voucher sequences + document numbers + POS receipts.
- **Money Core** — currency, base conversion (reuse `ExchangeRateService`), and **one** precision-aware `round`/`roundCash` using `CurrencyPrecisionHelpers`.
- **Tax Engine** — inclusive/exclusive, line tax, charge/discount tax impact + allocation, purchase recoverable/non-recoverable. Consumed by Sales, Purchases, POS.
- **Commercial Core** — pricing/price-lists, line calc, discount calc, invoice-discount allocation, promotions/flash-sales/BXGY/coupons, cost/margin & below-cost policy.
- **Policy Engine** — company/module/item/role/terminal policies with **most-restrictive-wins** + override/approval.
- **Inventory Core** — keep; rename contract to neutral `IInventoryCore`; pull COGS accumulation in.
- **Accounting/Financial Core** — keep; add an explicit **Minimal Accounting Bridge** contract so modules emit financial events without depending on the Accounting App UI.
- **Audit Engine** — one entry point for lifecycle + override + approval + void/cancel audit, consumed by all modules incl. POS.

---

## F. Required interfaces/contracts between modules and engines

Modules should depend on **interfaces**, not each other's entities/use-cases. Minimum contract set:

- `IDocumentCore` — `createIdentity(type, persona)`, `transition(state)`, `assertEditable()` (absorbs `PostedDocumentEditGuard`).
- `INumberingEngine` — `next({ companyId, scope, branchId?, terminalId?, docType })`.
- `IMoneyCore` — `round(value, currency)`, `roundCash(value, currency, rule)`, `toBase(value, ccy, rate)`.
- `ITaxEngine` — `calcLine(input)`, `calcCharge(input)`, `allocateInvoiceDiscount(lines, discount)`, `recoverable(taxCode)`.
- `ICommercialCore` — `resolvePrice(ctx)`, `calcDiscount(ctx)`, `applyPromotions(cart, policy)`, `validateCostMargin(line, policy)`.
- `IPolicyEngine` — `resolve(scope, action, context) → { allowed, requiresApproval, resolvedBy }` with most-restrictive-wins.
- `IInventoryCore` — already exists as `ISalesInventoryService.processIN/processOUT`; rename + add cost/margin reads.
- `IAccountingBridge` — `recordFinancialEvent(event)` (full posting when Accounting enabled; minimal journal otherwise).
- `IAuditEngine` — `record({ entity, action, before, after, actor, reason, approval })`.

Each application module (Sales, Purchases, Inventory, POS, Accounting) becomes a **user-facing orchestrator** over these contracts and owns only its UI/workflow specifics + persistence wiring.

---

## G. Migration / refactor plan ordered by risk (lowest → highest)

> No production data exists (pre-alpha) — so this is about *correctness and rework cost*, not data migration. Tests must pin behavior before each step.

1. **Money Core (lowest risk, mechanical).** Replace the 17 `roundMoney` copies with one precision-aware helper. Behavior-preserving; high test coverage already exists on totals.
2. **Audit Engine consolidation (low).** Standardize `recordCreate` into one `IAuditEngine`; add override/approval/lifecycle hooks; wire POS. Additive.
3. **Tax Engine extraction (low-med).** Lift `SalesInvoiceCalculationService` tax math into `ITaxEngine`; have Purchases consume it; add discount-allocation + recoverable. Pin with golden totals.
4. **Numbering Engine (med).** Unify voucher sequences + document numbers + POS receipts behind `INumberingEngine` with branch/terminal/type scope.
5. **Document Core + persona (med, POS-blocking).** Introduce document-type/persona incl. `POS_DIRECT_SALE`; stop the POS→`sales_invoice` conversion; route POS posting natively.
6. **Policy Engine (med, POS-blocking).** Promote `DocumentPolicyResolver` to `IPolicyEngine`; add POS/Item/Terminal/Cashier policies + most-restrictive-wins + approval; remove POS→SalesSettings writes.
7. **Inventory Core tidy (low-med).** Rename `ISalesInventoryService` → `IInventoryCore`; move COGS accumulation out of `SalesInvoiceUseCases`.
8. **Commercial Core (highest risk).** Re-home pricing/discount/promotions/cost-margin from Sales into `ICommercialCore`; wire Sales + Purchases + POS. Touches the most posting-sensitive math — do last, behind tests.
9. **Accounting bridge (med).** Add explicit `IAccountingBridge`; keep full posting as its default implementation.

---

## H. What must be fixed BEFORE POS implementation continues

The POS-blocking items are the ones that, if not fixed, get **baked into POS data shape and authorization** and make every later POS feature wrong-by-construction:

1. **Document Core persona integrity (plan step 5).** A shared document-type/persona including `POS_DIRECT_SALE`, and POS posting **as itself** — not silently converted to `sales_invoice` ([POS audit §10 rule 8](./pos-module-independence-and-engines-audit.md)).
2. **Policy Engine minimum + POS decoupling (plan step 6).** A `POSPolicy` owned by POS; remove the `UpdatePosSettingsUseCase` writes into `SalesSettings.governanceRules`; POS authorization must not be a Sales governance rule.
3. **POS posting entry point.** Decide POS posts through the **Accounting/Financial Core (or a POS posting use-case)** rather than `CreateSalesInvoiceUseCase`, so POS stops depending on Sales use-cases.

These three remove the structural lies (wrong persona, Sales-owned authorization, Sales-owned posting path) before more POS surface is built on them. Steps 1–2 of the plan (Money, Audit) are cheap and may be done alongside but are not strictly blocking.

## I. What can wait until after POS V1

- **Tax Engine** extraction (step 3) — POS V1 can keep delegating tax to the current Sales calc *via the Document/posting boundary*, provided persona is correct.
- **Numbering Engine** unification (step 4) — POS receipt numbering already works locally.
- **Inventory Core** rename + COGS move (step 7) — Inventory Core already functions via contract.
- **Commercial Core** (step 8) — the big one; POS V1 can ship without promotions/cost-margin (they're already absent — [POS audit §9](./pos-commercial-rules-and-promotions-audit.md)).
- **Accounting bridge** (step 9) — the always-on engine covers V1; the explicit bridge is a hardening step.
- **Money Core** dedup (step 1) — desirable, but not user-visible; can trail POS V1 if needed.

---

## See also
- [POS audit §9 — Commercial Rules & Promotions](./pos-commercial-rules-and-promotions-audit.md)
- [POS audit §10 — Module Independence & Persona Integrity](./pos-module-independence-and-engines-audit.md)
- [docs/architecture/promotions.md](../architecture/promotions.md), [docs/architecture/pricing.md](../architecture/pricing.md)
