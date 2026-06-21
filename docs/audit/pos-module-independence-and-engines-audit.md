# POS Audit — Section 10: Module Independence, Shared Engines & Persona Integrity

**Date:** 2026-06-21
**Scope:** Does the shipped POS module (Task 247) behave as an *independent application module* that consumes *shared internal cores/engines*, with the **document persona as the source of truth** — or is it a UI veneer hard-wired into the Sales App?
**Method:** code-only; every claim cites an exact file/line. "Missing" = no implementing code found.
**Status:** Section 10 of the POS audit (companion to [Section 9 — Commercial Rules & Promotions](./pos-commercial-rules-and-promotions-audit.md)). Findings only — *no code/schema/migration changes made.*

> **One-line verdict:** POS is **not** an independent module over shared engines. It is a **cart adapter bolted onto the Sales App.** Three of the stated red-line rules are **violated in code today**: (1) the backend **silently converts `POS_DIRECT_SALE` into a normal `sales_invoice`**; (2) **`SalesSettings` controls POS behavior** (the POS toggle writes a governance rule *into* `SalesSettings`); (3) the required **shared engines (Commercial/Pricing/Tax/Discount/Policy/Numbering/Audit) do not exist as cores** — the logic lives inside the Sales invoice entity and Sales use cases.

---

## Target architecture (from the directive) vs. current code

| # | Required rule | Current state | Verdict |
|---|---|---|---|
| 1 | Enabling POS must not require enabling the Sales App | Entitlement layer: independent (all modules seeded `dependencies: []`). **Functional layer: hard dependency** on Sales use cases + `SalesSettings`. | 🟡 Partial / functionally violated |
| 2 | POS uses shared internal cores/engines | No engines exist as cores; tax/discount/COGS math is embedded in `SalesInvoice` + Sales use cases. | ❌ Missing |
| 3 | Accounting App disabled → POS still sells; events via minimal accounting bridge | No "minimal accounting bridge". POS posts the **full** Sales→voucher path. Accounting *engine* is always-on (engine ≠ UI), so it partially matches, but there is no bridge abstraction or "accounting-off" sell path. | 🟡 Partial |
| 4 | Inventory App disabled → POS sells services; stock items use Inventory Core internally | POS forces every line to `register.warehouseId` and posts through the inventory-aware SI path; no explicit "inventory-app-off" branch. | 🟡 Partial |
| 5 | POS uses POS-specific policies; `SalesSettings` must NOT control POS | **`UpdatePosSettingsUseCase` writes into `SalesSettings.governanceRules`**; POS direct sale is gated by `SalesSettings`. | ❌ Violated |
| 6 | `CompanyCommercialPolicy` defaults; `POSPolicy`/`POSTerminalPolicy`/`CashierRolePolicy`/`ItemPolicy`/`PromotionPolicy` may restrict | None of these policy entities exist. | ❌ Missing |
| 7 | Persona is source of truth: `SALES_DIRECT_INVOICE` / `SALES_LINKED_INVOICE` / `POS_DIRECT_SALE` | Persona enum is `direct \| linked \| service`. No `POS_DIRECT_SALE`. | ❌ Missing |
| 8 | Backend must never silently convert `POS_DIRECT_SALE` → normal sales invoice | POS sets `voucherType:'sales_invoice'`, `persona:'direct'`, `formType:'pos_sale'` and posts a Sales Invoice. | ❌ **Violated** |

---

## Detail & evidence

### Rule 8 + 7 — Silent persona conversion (the headline violation)

The persona type system has **no POS persona**. `DocumentPolicyResolver` only knows `'direct' | 'linked' | 'service'` ([DocumentPolicyResolver.ts:137-216](../../backend/src/application/common/services/DocumentPolicyResolver.ts:137)). There is no `POS_DIRECT_SALE`, `SALES_DIRECT_INVOICE`, or `SALES_LINKED_INVOICE` typed persona anywhere.

POS therefore **collapses** the POS sale into a Sales Invoice:

```ts
// CompletePosSaleUseCase.ts:201-208
source: 'pos',
voucherType: 'sales_invoice',   // ← canonical Sales voucher
formType: 'pos_sale',           // ← POS marker kept only as a tag
persona: 'direct',              // ← POS persona flattened to 'direct'
```

The code comment is explicit that this is a *conversion to avoid rejection*: "`voucherType` MUST be the canonical `'sales_invoice'` … CreateSalesInvoiceUseCase … would otherwise reject `'pos_sale'` as an invalid voucher type" ([CompletePosSaleUseCase.ts:202-205](../../backend/src/application/pos/use-cases/CompletePosSaleUseCase.ts:202)). The test even asserts the conversion: `expect(input.voucherType).toBe('sales_invoice')` ([CompletePosSale.test.ts:201](../../backend/src/tests/application/pos/CompletePosSale.test.ts:201)).

**This is precisely the prohibited behavior:** a `POS_DIRECT_SALE` becomes an ordinary `sales_invoice` at the backend boundary, with `formType:'pos_sale'` surviving only as a label, not as the source of truth.

### Rule 5 — `SalesSettings` controls POS behavior

`UpdatePosSettingsUseCase` takes an `ISalesSettingsRepository` dependency and **mutates `SalesSettings.governanceRules`** whenever the POS toggle changes ([PosSettingsUseCases.ts:99-119](../../backend/src/application/pos/use-cases/PosSettingsUseCases.ts:99)): it inserts/removes a `{ scope:'form', formType:'pos_sale', action:'allow', persona:'direct' }` rule with id `pos_direct_sale_form_allow`. At sale time, `CreateSalesInvoiceUseCase` authorizes the POS sale via `DocumentPolicyResolver.isSalesInvoicePersonaAllowed(salesSettings, 'direct', { formType:'pos_sale' })` — i.e. **POS is permitted or denied by SalesSettings**, not by a POS policy.

Two consequences:
- **SalesSettings is the authority over POS** — direct violation of "SalesSettings must not control POS behavior."
- **Hard coupling to Sales config:** the sync is wrapped in `if (salesSettings) { … }` ([:101](../../backend/src/application/pos/use-cases/PosSettingsUseCases.ts:101)). If Sales is not configured, enabling POS direct sales **silently no-ops**, and `PersonaNotAllowedError` will then block every POS sale. POS cannot function without SalesSettings existing and carrying the right governance rule.

### Rule 1 — Enabling POS without Sales

- **Entitlement layer is independent:** modules are seeded with `dependencies: []` ([seedOnboardingData.ts:325](../../backend/src/seeder/seedOnboardingData.ts:325)); `companyModuleGuard('pos')` only checks that *pos* itself is enabled/available ([companyModuleGuard.ts:17-78](../../backend/src/api/middlewares/guards/companyModuleGuard.ts:17)) and does not require *sales*. `PosModule` declares no dependency ([PosModule.ts:6-11](../../backend/src/modules/pos/PosModule.ts:6)).
- **But the code hard-depends on Sales:** `CompletePosSaleUseCase` is constructed with `CreateSalesInvoiceUseCase` + `PostSalesInvoiceUseCase` ([:94-96](../../backend/src/application/pos/use-cases/CompletePosSaleUseCase.ts:94)), and `UpdatePosSettingsUseCase` requires `ISalesSettingsRepository`. So a tenant with POS enabled but Sales disabled would have POS routes mounted yet be unable to enable or complete a sale.

**Net:** POS is independent on paper, Sales-dependent in practice.

### Rules 3 & 4 — Accounting / Inventory decoupling

- There is **no minimal accounting bridge**. POS posts via `CreateAndPostSalesInvoiceUseCase`, which creates the full revenue/tax/COGS/settlement voucher set through `SubledgerVoucherPostingService`. The accounting *engine* being mandatory while *UI* is optional (the project's established engine-vs-UI split) covers the "events still recorded internally" intent, but there is **no separate bridge** and no "accounting-app-off" code path — POS just runs the same Sales posting.
- **Inventory:** every POS line is forced to `warehouseId: register.warehouseId` ([CompletePosSaleUseCase.ts:216](../../backend/src/application/pos/use-cases/CompletePosSaleUseCase.ts:216)) and posts through the inventory-aware SI path (stock OUT + COGS for stock items; non-stock items skip inventory). There is no explicit "Inventory App disabled → use Inventory Core only" branch; POS assumes a warehouse exists on the register.

### Rules 2 & 6 — Shared engines & POS policies do not exist

- **No engine cores.** Tax-inclusive/exclusive, discount, and line math live **inside the `SalesInvoice` domain entity** (`calculateDiscountAmountDoc`, charge normalization, inclusive handling — see [Section 9](./pos-commercial-rules-and-promotions-audit.md) and `SalesInvoice.ts`). COGS/inventory posting lives in Sales/Inventory use cases. There is **no** standalone `CommercialCore`, `PricingEngine`, `TaxEngine`, `DiscountCalculationEngine`, or `CommercialPolicyEngine` that POS (or Sales) calls as a shared service. POS "reuses" them only by constructing a Sales Invoice.
- **Numbering is not a shared engine.** POS receipt numbering is local to `PosSettings.receiptPrefix` / `receiptNextSeq` ([PosSettings.ts:48-49, 109-114](../../backend/src/domain/pos/entities/PosSettings.ts:48)); Sales Invoice numbering is a separate Sales mechanism. Two independent numbering schemes, no `NumberingEngine`.
- **Audit is not wired for POS.** Generic `AuditLog` infra exists, but POS does not emit `recordCreate` for receipts/returns/settings (documented follow-up; see [Section 9 §I](./pos-commercial-rules-and-promotions-audit.md)). No `AuditEngine` abstraction.
- **No POS policy entities.** `CompanyCommercialPolicy`, `POSPolicy`, `POSTerminalPolicy`, `CashierRolePolicy`, `ItemPolicy`, `PromotionPolicy` — none exist. POS reads `PosSettings` (operational config only: shifts, walk-in customer, over/short accounts, payment methods, receipt numbering) and otherwise inherits Sales/company behavior.

---

## Required audit answers

1. **Is POS an independent module?** No. Entitlement-independent, but code- and config-dependent on the Sales App.
2. **Does enabling POS require Sales?** Not by entitlement, but **yes functionally** — POS cannot enable or complete a direct sale without `SalesSettings` and the Sales use cases.
3. **Do the shared engines exist?** No. The logic is embedded in the Sales invoice entity and Sales/Inventory use cases, not exposed as cores.
4. **Is the persona the source of truth?** No. There is no `POS_DIRECT_SALE` persona; POS is flattened to `persona:'direct'`.
5. **Is `POS_DIRECT_SALE` silently converted to a sales invoice?** **Yes** — confirmed in `CompletePosSaleUseCase` and asserted by its test.
6. **Does `SalesSettings` control POS?** **Yes** — the POS toggle writes a governance rule into `SalesSettings`, which authorizes the POS sale.
7. **Can POS sell with Accounting disabled?** Only because the accounting engine is always-on; there is no minimal bridge or accounting-off path.
8. **Can POS sell with Inventory disabled?** Only services/non-stock implicitly; no explicit Inventory-Core-only path, and the register requires a warehouse.

---

## ✅ Checklist — POS Module Independence & Engines (to be scoped; do NOT implement yet)

### Persona integrity (red-line fixes first)
- [ ] Introduce a first-class persona/document-type enum including `POS_DIRECT_SALE`, `SALES_DIRECT_INVOICE`, `SALES_LINKED_INVOICE`; carry it end-to-end as the source of truth.
- [ ] Stop converting `POS_DIRECT_SALE` → `sales_invoice`. Let the posting layer accept a POS persona/voucher type natively (or route through a POS-owned posting path) instead of masquerading as a Sales Invoice.
- [ ] Add a regression test asserting a POS sale is **not** stored/posted as a plain `sales_invoice` and that `POS_DIRECT_SALE` survives to the ledger/reporting layer.

### Decouple POS from SalesSettings
- [ ] Move POS authorization out of `SalesSettings.governanceRules` into a **POS-owned policy** (`POSPolicy`/`POSTerminalPolicy`/`CashierRolePolicy`).
- [ ] Remove `ISalesSettingsRepository` from `UpdatePosSettingsUseCase`; the POS toggle must not mutate Sales config.
- [ ] Make `allowPosDirectSales` resolve against POS policy even when Sales is disabled/unconfigured.

### Extract shared engines/cores
- [ ] Define `CommercialCore`, `PricingEngine`, `TaxEngine`, `DiscountCalculationEngine`, `CommercialPolicyEngine` as standalone services consumed by both Sales and POS (lift the math out of `SalesInvoice`).
- [ ] Define a shared `NumberingEngine` (POS receipts + Sales documents) and an `AuditEngine` POS actually calls.
- [ ] Add a **MinimalAccountingBridge** so POS records financial events when the Accounting App UI is disabled, hiding ledger/TB/CoA/statements behind app activation only.
- [ ] Add an **Inventory Core** entry point for POS stock validation + stock-OUT independent of Inventory App UI; allow services/non-stock sales with Inventory App disabled.

### Policy model
- [ ] Add `CompanyCommercialPolicy` (defaults) + `POSPolicy`, `POSTerminalPolicy`, `CashierRolePolicy`, `ItemPolicy`, `PromotionPolicy` (progressive restriction), and resolve POS behavior from these — never from `SalesSettings`.

### Activation semantics
- [ ] Confirm/encode that app activation gates **visibility/management only**, while engines run regardless; add tests for POS-on / Sales-off, POS-on / Accounting-off, POS-on / Inventory-off.
