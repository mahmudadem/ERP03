# Platform Architecture Audit — Engine vs App Separation

**Date:** 2026-06-21
**Trigger:** POS work paused. The POS/Sales coupling found in [POS audit §10](./pos-module-independence-and-engines-audit.md) was a symptom of a platform-wide problem: **application modules own or embed shared engines.** This audit asks, for every cross-cutting capability, whether it is a true engine, a module-owned implementation, a UI-only setting, duplicated, or missing.
**Method:** code-only, repo-wide. Every claim cites an exact file/line that was read. Per the directive: **if a capability exists only inside Accounting, Sales, Purchases, POS, or Inventory, it is classified `embedded`, not `independent`.** No engine is assumed to exist without code proof.
**Status:** Audit only — **no code, no migrations, no file moves, and no edits to any other doc.** This is the one new file.

**Companion documents:**
- [System Core / Shared Engines Audit](./system-core-shared-engines-audit.md) — first-pass engine inventory.
- [POS audit §9 — Commercial Rules & Promotions](./pos-commercial-rules-and-promotions-audit.md)
- [POS audit §10 — Module Independence & Persona Integrity](./pos-module-independence-and-engines-audit.md)
- [System Core / Shared Engines Master Plan](../architecture/system-core-shared-engines-master-plan.md) — target architecture decisions.

> **One-line verdict:** Exactly **two** capabilities are true shared engines today — **Accounting/Financial posting** (`PostingGateway` + subledger posters) and **Inventory** (`ISalesInventoryService`). The **Approval system is real but accounting-voucher-shaped**, not a generic workflow engine. **Tax codes are shared data but tax *calculation* is embedded in Sales and duplicated in Purchases.** Document Core, Numbering, Money/Rounding, Commercial, and a unified Policy Engine are **embedded or missing.** Several capabilities exist only as **UI settings** (approval strict-mode, POS cash rounding) with no engine behind them.

---

## A. Current architecture summary

Backend is layered `domain/ → application/ → infrastructure/`, with per-module folders (`sales`, `purchases`, `inventory`, `accounting`, `pos`, `system`, `core`, `shared`, `common`). A thin shared layer exists:

- `domain/core/` — `Company`, `CompanySettings`, `Currency`, `ExchangeRate`, `CurrencyPrecisionHelpers`.
- `domain/shared/entities/` — `Party`, `TaxCode`, `PartyItemPrice`, `PaymentHistory`.
- `application/common/services/` — `DocumentPolicyResolver`, `SettingsResolver`, `PostedDocumentEditGuard`.
- `application/accounting/services/` — `PostingGateway`, `SubledgerVoucherPostingService`, `SubledgerDocumentPoster` (financial core).
- `application/accounting/policies/` — `AccountingPolicyRegistry` + posting policies (`ApprovalRequiredPolicy`, `PeriodLockPolicy`, `AccountAccessPolicy`, `CostCenterRequiredPolicy`).
- `application/inventory/contracts/` — `ISalesInventoryService` (inventory core boundary).

**The commercial and document-shaping logic — pricing, discount, tax math, line/total calc, document identity/persona, numbering, money rounding — is not in this shared layer.** It lives inside Sales domain entities/services and is re-implemented in Purchases and (by pass-through) POS. There is no `system-core/` namespace owning cross-domain business rules.

### Engine-by-engine classification

| Capability | Classification | Where it lives (evidence) |
|---|---|---|
| **Accounting / Financial** | ✅ Independent engine | `PostingGateway` ([PostingGateway.ts:60](../../backend/src/application/accounting/services/PostingGateway.ts:60)) is the single mandatory ledger choke point; consumed by sales/purchases/inventory/pos. |
| **Inventory** | ✅ Independent engine (Sales-named) | `ISalesInventoryService.processIN/processOUT` ([InventoryIntegrationContracts.ts](../../backend/src/application/inventory/contracts/InventoryIntegrationContracts.ts)); contract is consumed by Purchases too. |
| **Approval Workflow** | 🟡 Embedded in Accounting (voucher-shaped) | `ApprovalPolicyService` (Smart CC/FA gates) ([ApprovalPolicyService.ts:75](../../backend/src/domain/accounting/policies/ApprovalPolicyService.ts:75)), `ApprovalRequiredPolicy` ([ApprovalRequiredPolicy.ts:17](../../backend/src/domain/accounting/policies/implementations/ApprovalRequiredPolicy.ts:17)); SI/PI re-implement `PENDING_APPROVAL` locally. |
| **Tax** | 🟡 Data shared, calc embedded + duplicated | `TaxCode` shared entity ([TaxCode.ts:32](../../backend/src/domain/shared/entities/TaxCode.ts:32)) + `/tax-codes` shared route ([shared.routes.ts:13](../../backend/src/api/routes/shared.routes.ts:13)); calc in `SalesInvoiceCalculationService` ([:58](../../backend/src/application/sales/services/SalesInvoiceCalculationService.ts:58)), re-implemented in `PurchaseInvoice`. |
| **Numbering** | 🟡 Split & embedded | Voucher sequences in Accounting; document numbers per use-case; POS receipts in `PosSettings`. (engines-audit §C-2) |
| **Money / Rounding** | 🟡 Duplicated | `roundMoney` defined locally ~17× (engines-audit §C-3); grep confirms references across 49 files in sales/purchases/inventory/pos/accounting/shared. Only `VoucherLineEntity` is precision-aware. |
| **Document Core** | ❌ Embedded per entity | Persona enum `'direct'\|'linked'\|'service'` ([DocumentPolicyResolver.ts:137](../../backend/src/application/common/services/DocumentPolicyResolver.ts:137)); no `POS_DIRECT_SALE`. Each module owns its own status/posting-state. |
| **Commercial / Pricing / Discount / Promotions** | ❌ Missing as core; scattered | Sales price lists + `PromotionApplicationService` (unwired); Purchases duplicate price list; POS has none. (POS §9) |
| **Policy Engine** | 🟡 Two disjoint partial systems | `DocumentPolicyResolver` (persona governance, Sales/Purchases) + `AccountingPolicyRegistry` (posting policies). No unified, most-restrictive-wins resolver. |
| **Audit** | 🟡 Partial | `RecordChangeService`/`IAuditLogRepository`; emitted by Sales/Purchases, **not POS**. (engines-audit §C-9) |
| **Company / Tenant / Business Rules** | ❌ Thin data holder, no engine | `CompanySettings` is a flat field bag ([CompanySettings.ts:2](../../backend/src/domain/core/entities/CompanySettings.ts:2)); rules are scattered across module settings + accounting policy config. |

---

## B. Existing engines that are truly independent

Only two pass the "consumed by multiple modules through a boundary, not embedded in one module" test:

### B1. Accounting / Financial posting — ✅
`PostingGateway` is "the single, mandatory choke point in front of every ledger mutation" ([PostingGateway.ts:46-66](../../backend/src/application/accounting/services/PostingGateway.ts:46)). An architecture test forbids any other caller of the ledger-mutation methods ([PostingAuthority.test.ts](../../backend/src/tests/architecture/PostingAuthority.test.ts)). Crucially, it **takes the source document's approval state from the caller** (`ctx.approved`), never inferring it from the voucher's own stamp ([PostingGateway.ts:26-44, 170-186](../../backend/src/application/accounting/services/PostingGateway.ts:26)). It runs the central policy set (`getEnabledPolicies`) before any write ([:159-195](../../backend/src/application/accounting/services/PostingGateway.ts:159)). Consumed by sales, purchases, inventory, and pos (shift over/short).

> **Caveat for §G:** posting has no `module-enabled` gate, so the engine runs while the Accounting UI is hidden — but that is "engine always runs" by construction, not an explicit bridge contract. There is **no** minimal accounting bridge.

### B2. Inventory — ✅ (mis-named)
`ISalesInventoryService.processIN/processOUT` is the boundary; Sales and Purchases consume it via the contract, not by touching stock repositories. Costing, negative-stock policy, and warehouse validation live behind it. The name `ISalesInventoryService` encodes a Sales bias even though Purchases is also a consumer — it should be a neutral `IInventoryCore` (engines-audit §D-8).

---

## C. Engines currently embedded inside modules

### C1. Tax calculation — embedded in Sales, duplicated in Purchases
`calculateSalesInvoiceLineAmounts` / `calculateSalesInvoiceTotals` own inclusive/exclusive back-calc, per-line tax, and totals ([SalesInvoiceCalculationService.ts:58-157](../../backend/src/application/sales/services/SalesInvoiceCalculationService.ts:58)). Purchases re-implement equivalent math inside `PurchaseInvoice`. POS does **not** calculate tax — it passes `taxCodeId` into the Sales Invoice path (POS §9). The `TaxCode` *entity* and CRUD are shared; **the calculation is not.** Invoice-level DISCOUNT charges carry no tax and are never allocated to lines ([SalesInvoiceCalculationService.ts:130-135](../../backend/src/application/sales/services/SalesInvoiceCalculationService.ts:130)). See §F.

### C2. Document identity / persona — embedded per entity
`DocumentPolicyResolver` knows only `'direct' | 'linked' | 'service'` ([:137-216](../../backend/src/application/common/services/DocumentPolicyResolver.ts:137)). There is no shared document-type/persona with `POS_DIRECT_SALE` / `SALES_DIRECT_INVOICE` / `SALES_LINKED_INVOICE`. This is exactly why POS masquerades as `sales_invoice` (POS §10).

### C3. Money rounding — embedded & duplicated
`const roundMoney = (v) => Math.round((v + EPSILON) * 100) / 100` appears as a local definition in Sales, Purchases, Inventory, POS, and shared entities (engines-audit §C-3 lists ~17 definition sites; the same hardcoded-2-decimal copy appears at e.g. [SalesInvoiceCalculationService.ts:7](../../backend/src/application/sales/services/SalesInvoiceCalculationService.ts:7)). `CurrencyPrecisionHelpers` exists but documents bypass it.

### C4. Commercial / pricing / discount / promotions — embedded or missing
Line + discount math is inside `SalesInvoiceCalculationService` and `SalesInvoice`. Promotions live in `PromotionApplicationService` (sales-only, unwired, advisory — POS §9 E). Purchases have a **separate** price-list implementation. No shared commercial core; POS has no commercial logic at all.

### C5. Numbering — embedded per module
Accounting owns voucher sequences; each Sales/Purchase use-case generates its own document numbers; POS receipt numbering is local to `PosSettings`. No single engine, no branch/terminal/type scope (engines-audit §C-2).

---

## D. Features that are UI-only settings but should be engine-backed

These have a screen and a stored flag, but no engine logic enforcing them:

| Setting | Stored where | Gap |
|---|---|---|
| **Approval "Strict Mode"** | `CompanySettings.strictApprovalMode` ([CompanySettings.ts:3](../../backend/src/domain/core/entities/CompanySettings.ts:3)); UI = [ApprovalSettingsPage.tsx](../../frontend/src/modules/settings/pages/ApprovalSettingsPage.tsx) | The page describes **voucher** behavior only ("vouchers start as Draft… must be approved before they can be locked"). It is an accounting-voucher toggle dressed as a platform "Approval Workflow Settings" page. No non-voucher subject can be configured here. |
| **POS cash rounding** | `PosSettings.cashRounding` | Stored only, **never applied** at sale time (POS §9 B). A pure UI value with no Money/Rounding engine consuming it. |
| **POS direct-sale authorization** | Written into `SalesSettings.governanceRules` by `UpdatePosSettingsUseCase` (POS §10 rule 5) | A POS toggle whose authority lives in **another module's** settings object — no POSPolicy engine. |
| **Per-module "Voucher Types" approval-exempt** | Surfaced by `Sales/Purchase/AccountingVoucherTypesSettingsPage.tsx` | Three module UIs configure a single accounting-owned concept (`approvalExemptVoucherTypes`); the resolution is accounting's ([AccountingPolicyRegistry.ts:87](../../backend/src/application/accounting/policies/AccountingPolicyRegistry.ts:87)). |

---

## E. Approval workflow — current state and target state

### Current state (code-verified)

**Approval is real but accounting-voucher-shaped.** There are two layers:

1. **Voucher approval gate (the "engine").** `ApprovalPolicyService` implements four operating modes from two flags — Financial Approval (FA) and Custody Confirmation (CC) — and "Smart CC" logic that only requires confirmation from the receiving-side custodian of ASSET accounts ([ApprovalPolicyService.ts:75-220](../../backend/src/domain/accounting/policies/ApprovalPolicyService.ts:75)). `SubmitVoucherUseCase` evaluates gates at submit time, freezes the requirement in metadata, and transitions `DRAFT → PENDING | APPROVED` ([SubmitVoucherUseCase.ts:48-166](../../backend/src/application/accounting/use-cases/SubmitVoucherUseCase.ts:48)). `ApproveVoucherUseCase`/`RejectVoucherUseCase` are simple state transitions ([VoucherApprovalUseCases.ts:24-127](../../backend/src/application/accounting/use-cases/VoucherApprovalUseCases.ts:24)) — explicitly "**No workflow engine. No conditional logic. No approval chains.**" ([:13](../../backend/src/application/accounting/use-cases/VoucherApprovalUseCases.ts:13)).

2. **How approval blocks the ledger.** `ApprovalRequiredPolicy` is an `IPostingPolicy` that rejects posting unless `status === APPROVED`, with per-voucher-type exemptions ([ApprovalRequiredPolicy.ts:27-46](../../backend/src/domain/accounting/policies/implementations/ApprovalRequiredPolicy.ts:27)). `PostingGateway` runs it before every ledger write, and reads the **caller's real approval state**, not the voucher's stamp ([PostingGateway.ts:170-186](../../backend/src/application/accounting/services/PostingGateway.ts:170)).

3. **Document-level approval is replicated per module, not shared.** Sales Invoice and Purchase Invoice each carry their **own** `'DRAFT' | 'PENDING_APPROVAL' | 'POSTED' | 'CANCELLED'` status ([SalesInvoiceUseCases.ts:206](../../backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts:206); [PurchaseInvoiceUseCases.ts:223](../../backend/src/application/purchases/use-cases/PurchaseInvoiceUseCases.ts:223)). When posting hits the approval gate, the use-case parks the document as `PENDING_APPROVAL` ([SalesInvoiceUseCases.ts:1695-1700](../../backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts:1695)) and a dedicated `ApproveSalesInvoiceUseCase` re-enters the post flow with `approvalContext` ([:2199-2230](../../backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts:2199)). The **trigger** is accounting-owned (`AccountingPolicyRegistry.isApprovalRequiredForVoucherType` ([:87](../../backend/src/application/accounting/policies/AccountingPolicyRegistry.ts:87))), but the **parking/approve mechanics are copy-implemented in each module.**

**Findings:**
- **Approval subjects today:** accounting vouchers, Sales Invoices, Purchase Invoices (all via voucher-type config). **Not** approvable: purchase orders, inventory adjustments, POS manager override, price/discount/tax override, below-cost sale. None of those exist (POS §9 D, A).
- **Approval statuses:** voucher `DRAFT/PENDING/APPROVED/REJECTED/POSTED`; document `DRAFT/PENDING_APPROVAL/POSTED/CANCELLED`. Two separate status vocabularies.
- **Where rules live:** accounting policy config (`AccountingPolicyConfig`: `financialApprovalEnabled`, `custodyConfirmationEnabled`, `faApplyMode`, `cc*`, `approvalRequired`, `approvalExemptVoucherTypes`) + `CompanySettings.strictApprovalMode`. All accounting-scoped.
- **Independent module use:** ❌ A module cannot define an approval requirement for a non-voucher action. Approval is keyed on voucher type; the only generic hook a module gets is "is this voucher type approval-required?".
- **Generic vs accounting-specific:** **Accounting-specific.** The gate semantics (FA/CC, custodians, ASSET classification) are accounting concepts; there is no subject-agnostic workflow engine.

### Target state

Approval Workflow becomes a **shared System Core engine** with subject-agnostic contracts:

- `IApprovalEngine.evaluate(subject, context) → { decision: APPROVED | REJECTED | PENDING, requiredApprovers, gates }`.
- A **subject** is any `{ type, id, payload }` — `accounting_voucher`, `sales_invoice`, `purchase_invoice`, `purchase_order`, `inventory_adjustment`, `pos_manager_override`, `price_override`, `discount_override`, `tax_override`, `below_cost_sale`.
- The **engine decides** approved/rejected/pending; the **module decides what action is blocked** until the decision resolves.
- **Accounting posts only after** the relevant approval completes when policy requires it — exactly today's `ApprovalRequiredPolicy` gate, but fed by the shared engine's decision rather than accounting-only config.
- The current Smart-CC/FA logic becomes **one approval policy plug-in** ("ledger custody/financial approval"), not the whole engine.

---

## F. Tax — current state and target state

### Current state
- **Tax codes are defined as shared data.** `TaxCode` is in `domain/shared/entities/` ([TaxCode.ts:32](../../backend/src/domain/shared/entities/TaxCode.ts:32)) with `scope: PURCHASE | SALES | BOTH`, rate, type, inclusive flag, and separate purchase/sales tax account ids. CRUD is on the **shared** route `/tax-codes` ([shared.routes.ts:13-16](../../backend/src/api/routes/shared.routes.ts:13)) via `SharedController`, not inside Sales or Purchases.
- **Tax calculation is embedded in Sales** (`SalesInvoiceCalculationService`) and **re-implemented in Purchases** (`PurchaseInvoice`). POS does no tax math — it routes `taxCodeId` through the Sales Invoice (POS §9).
- **Known defects:** invoice-level discount has no tax allocation (DISCOUNT charges are tax-free, [SalesInvoiceCalculationService.ts:130-135](../../backend/src/application/sales/services/SalesInvoiceCalculationService.ts:130)); purchase recoverable vs non-recoverable input tax is missing (engines-audit §C-4).

### Target state
- **Tax Engine owns tax calculation** (`ITaxEngine.calcLine / calcCharge / allocateInvoiceDiscount / recoverable`). Sales, POS, and Purchases consume it; they may only **apply or override** tax per policy, never re-implement the math.
- **Tax master-data management UI belongs to System / Finance / Tax Settings** — already true at the data/route layer; keep it there and stop modules from owning calculation.
- **Module-specific tax policies** (e.g. "POS may not change tax code", "Sales may override with reason") resolve through the Policy Engine (§H), not through embedded conditionals.

---

## G. Accounting engine vs Accounting app — current state and target state

### Current state — **both, mixed**
- The **engine** (`PostingGateway` + subledger posters + policy set) is effectively always-on: posting has **no `module-enabled` gate**, so events are recorded even when the Accounting UI is not the active surface. Sales posting only requires the engine to be *initialized* ([SalesInvoiceUseCases.ts:985-993](../../backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts:985), `AccountingEngineUnavailableError` on NOT_INITIALIZED).
- But the **app and engine are not cleanly separated**: there is **no `IAccountingBridge`**. Modules post through the full voucher path. "Engine always runs" is true by *absence of a gate*, not by an explicit contract, and the Accounting policy config doubles as the platform's approval config (§E) — an app concern leaking into an engine.

### Target rule
- **Accounting Engine must be always available to other modules for financial events** — a stable `IAccountingBridge.recordFinancialEvent(event)` that any enabled module can call regardless of the Accounting App's activation.
- **Accounting App is only the UI/reporting/management consumer** (ledger, TB, CoA, statements, voucher screens).
- **Disabling the Accounting App must hide accounting UI and reports but must not prevent other enabled apps from recording financial events.** Today this holds *accidentally*; the target makes it contractual.

---

## H. Policy ownership and policy resolution target

### Current state — two disjoint partial systems
1. **`DocumentPolicyResolver`** — persona governance for **Sales & Purchases only**, reading `SalesSettings`/`PurchaseSettings.governanceRules`. Precedence is **most-specific-wins** (base → company → branch → form) ([DocumentPolicyResolver.ts:176-216](../../backend/src/application/common/services/DocumentPolicyResolver.ts:176)).
2. **`AccountingPolicyRegistry`** — posting policies (approval, period lock, account access, cost center) for **vouchers only** ([AccountingPolicyRegistry.ts:42-79](../../backend/src/application/accounting/policies/AccountingPolicyRegistry.ts:42)).

**Misplacements found:**
- **POS authorization stored in `SalesSettings.governanceRules`** ([UpdatePosSettingsUseCase] writes a `pos_direct_sale_form_allow` rule — POS §10 rule 5). A module-scoped policy lives in **another module's** settings object.
- No `CompanyCommercialPolicy`, `POSPolicy`, `POSTerminalPolicy`, `CashierRolePolicy`, `ItemPolicy`, `PromotionPolicy`, `InventoryPolicy` (engines-audit §C-6, POS §10).
- Precedence is most-specific-wins, **not most-restrictive-wins** as the target requires.

### Target
- **Policy Engine is shared** (`IPolicyEngine.resolve(scope, action, context) → { allowed, requiresApproval, resolvedBy }`).
- **Modules own module-specific policy definitions but not resolution logic.** Examples:
  - `SalesPolicy` may *allow* below-cost sales; `POSPolicy` may *block* them; `POSTerminalPolicy` may be stricter than `POSPolicy`; `CashierRolePolicy` may require manager approval for discounts above a threshold.
  - **The most restrictive applicable policy wins** unless an explicit approval override is allowed (which routes to the Approval Engine, §E).
- `DocumentPolicyResolver` (persona) and the posting policy set both become plug-ins behind `IPolicyEngine`.

---

## I. UI ownership matrix

Three UI layers, each with a strict edit scope. **A module settings screen may configure module-scoped policies, but must not own the shared engine.**

### A. Engine management UI (System / Finance scope — manages engine-wide master data & rules)

| Surface | Owns / may edit | Current location (evidence) | Verdict |
|---|---|---|---|
| Tax Settings | Tax codes, rates, inclusive defaults, tax accounts | `/tax-codes` shared route ([shared.routes.ts:13](../../backend/src/api/routes/shared.routes.ts:13)); no dedicated System "Tax Settings" page found | 🟡 Data shared, but no clear engine-level UI home |
| Approval Workflow Designer | Subjects, gates, approver roles, thresholds | Only `ApprovalSettingsPage` (voucher strict-mode toggle) | ❌ No designer; voucher-only |
| Numbering Sequences | Sequence scopes (company/branch/terminal/type) | Accounting `VoucherSequenceController` + per-module + POS-local | 🟡 Fragmented |
| Currency / Rounding Settings | Base currency, precision, cash-rounding rules | `CompanyCurrencySettings.tsx`; `CompanySettings.baseCurrency` | 🟡 Currency yes, rounding rule no |
| Audit Log | Read-only lifecycle/override/approval trail | `IAuditLogRepository`; no POS coverage | 🟡 Partial |
| Company Policy Templates | Company-default commercial/approval policies | None | ❌ Missing |

### B. Module settings UI (module scope — configures module-scoped policy, never the engine)

| Surface | May edit | Current location | Verdict |
|---|---|---|---|
| Sales Settings | Sales workflow mode, sales-scoped persona governance | [SalesSettingsPage.tsx](../../frontend/src/modules/sales/pages/SalesSettingsPage.tsx) | ⚠️ Currently also stores **POS** authorization (must stop — POS §10) |
| POS Settings | POS-scoped policy, terminals, cash rounding, receipt numbering | [PosSettingsPage.tsx](../../frontend/src/modules/pos/pages/PosSettingsPage.tsx) | ⚠️ Writes into SalesSettings; cashRounding unused |
| Purchase Settings | Purchase workflow, purchase persona governance | [PurchaseSettingsPage.tsx](../../frontend/src/modules/purchases/pages/PurchaseSettingsPage.tsx) | 🟡 OK in principle |
| Inventory Settings | Accounting mode, negative-stock policy | [InventorySettingsPage.tsx](../../frontend/src/modules/inventory/pages/InventorySettingsPage.tsx) | 🟡 OK |
| Accounting Settings | Approval mode, period lock, posting policy config | [AccountingSettingsPage.tsx](../../frontend/src/modules/accounting/pages/AccountingSettingsPage.tsx) | ⚠️ Hosts the **platform** approval config (should move to Engine UI when approval generalizes) |

### C. Transaction UI (may apply/override within policy, never define policy)

| Surface | May edit | Constraint |
|---|---|---|
| Sales Invoice page | Lines, qty, price/discount/tax **within policy** | Override must capture reason + route to Approval Engine when policy requires |
| POS screen | Cart, qty; price/discount/tax only if POSPolicy allows | Currently API accepts ungoverned overrides (POS §9 A) — must be policy-gated |
| Purchase Invoice page | Lines, qty, price/discount/tax within policy | Same override discipline |
| Inventory Adjustment page | Quantities, reasons | Approval subject when policy requires |
| Voucher page | Lines/accounts (DRAFT only) | Submit → Approval Engine; post via gateway |

**Rule restated:** Engine UI edits engine master data and engine-wide rules; Module Settings UI edits module-scoped policy values; Transaction UI may only *apply or override* within the resolved policy and must surface reason capture + approval routing.

---

## J. Required refactor boundaries

1. **Document Core** owns document-type/persona (incl. `POS_DIRECT_SALE`) + status/posting-state + editability. Modules stop defining persona locally.
2. **Tax Engine** owns all tax calculation; Sales/Purchases/POS consume it; `TaxCode` data stays shared.
3. **Approval Engine** is subject-agnostic; the accounting FA/CC gate becomes one plug-in; modules declare subjects and block their own actions.
4. **Policy Engine** unifies `DocumentPolicyResolver` + posting policies; most-restrictive-wins; owns POS/Item/Terminal/Cashier policies; **POS authorization leaves `SalesSettings`.**
5. **Money Core** is the single precision-aware rounding/cash-rounding authority.
6. **Numbering Engine** unifies voucher sequences + document numbers + POS receipts with scope keys.
7. **Accounting Bridge** (`IAccountingBridge`) is the contract every module uses to record financial events, independent of the Accounting App UI.
8. **Inventory Core** keeps its contract; rename `ISalesInventoryService → IInventoryCore`; pull COGS accumulation out of Sales.
9. **Audit Engine** is one entry point consumed by all modules incl. POS.
10. **Company/Tenant Rules** become an explicit policy-template surface, not a flat `CompanySettings` bag.

Every application module depends on these **interfaces**, never on another module's entities/use-cases.

---

## K. What must be fixed BEFORE any further POS / Sales / Purchases feature work

These get baked into data shape and authorization and make later work wrong-by-construction:

1. **Document Core persona integrity** — add `POS_DIRECT_SALE`/`SALES_DIRECT_INVOICE`/`SALES_LINKED_INVOICE`; stop the POS→`sales_invoice` conversion; persona survives to ledger/reporting (POS §10 rules 7/8).
2. **Policy ownership cleanup** — remove `UpdatePosSettingsUseCase` writes into `SalesSettings.governanceRules`; introduce `POSPolicy`/`POSTerminalPolicy`/`CashierRolePolicy`; POS authorization resolves without Sales config (POS §10 rule 5).
3. **POS posting entry point** — POS posts via `IAccountingBridge` / a POS posting use-case, not by constructing `CreateSalesInvoiceUseCase` (POS §10 rule 1).
4. **Approval Engine seam** — before adding POS manager-override / price-override / below-cost flows, define the subject-agnostic approval contract so those subjects are not hardcoded into accounting voucher types. (Today there is literally nowhere to register them — §E.)

These four remove the structural lies (wrong persona, mis-owned authorization, Sales-owned posting, accounting-only approval) that any new POS/Sales/Purchases feature would otherwise inherit.

---

## L. What can wait

- **Tax Engine extraction** — V1 may keep delegating to `SalesInvoiceCalculationService` behind an `ITaxEngine` adapter, provided callers depend on the interface.
- **Numbering Engine unification** — POS receipts + document numbers already work locally; unify later.
- **Money Core dedup** — replacing the ~17 `roundMoney` copies is mechanical and behavior-preserving; not user-visible.
- **Inventory Core rename + COGS move** — the contract already functions.
- **Commercial Core (promotions / cost-margin / coupons)** — already absent on the POS path (POS §9); ship POS V1 without them.
- **Accounting bridge hardening** — the always-on engine covers V1; the explicit `IAccountingBridge` is a hardening step (but its *seam* should exist for POS posting per §K-3).

---

## M. Recommended phased refactor plan

> No production data (pre-alpha) — this is about correctness and rework cost. Pin behavior with tests before each phase.

**Phase 0 — Seams only (no behavior change).** Introduce interfaces with adapters over current code: `ITaxEngine`, `INumberingEngine`, `IAccountingBridge`, `IApprovalEngine`, `IPolicyEngine`. Modules begin depending on interfaces; implementations stay put.

**Phase 1 — POS-blocking (must-fix, §K).**
1. Document Core persona incl. `POS_DIRECT_SALE`; stop POS→`sales_invoice` conversion.
2. Policy Engine minimum + POS policies; remove POS→`SalesSettings` writes; most-restrictive-wins.
3. POS posting through `IAccountingBridge`/POS use-case.
4. Approval Engine subject registry; accounting FA/CC becomes a plug-in.

**Phase 2 — Cheap, additive (during V1).**
5. Money Core (dedup rounding; apply POS cash rounding).
6. Audit Engine consolidation; wire POS.

**Phase 3 — After POS V1.**
7. Tax Engine extraction (Sales + Purchases consume; add discount allocation + recoverable).
8. Numbering Engine unification (branch/terminal/type scope).
9. Inventory Core rename + COGS move.

**Phase 4 — Highest risk / long-term.**
10. Commercial Core (pricing/discount/promotions/cost-margin) re-homed and wired to Sales/Purchases/POS.
11. Physical `system-core/` folder move; delete Phase-0 adapters once call sites are stable.

---

## N. Tests required to prove the new architecture

| # | Test | Asserts |
|---|---|---|
| T1 | **Persona integrity** | A POS sale persists/posts as `POS_DIRECT_SALE`; never converted to `sales_invoice`; persona reaches ledger/reporting. *(Inverts the current assertion at [CompletePosSale.test.ts:201](../../backend/src/tests/application/pos/CompletePosSale.test.ts:201).)* |
| T2 | **POS without Sales App** | POS enables, sells, and posts with Sales App disabled/unconfigured. |
| T3 | **POSSettings isolation** | Saving POS settings writes nothing into `SalesSettings`/`governanceRules`. |
| T4 | **Policy most-restrictive-wins** | A `POSTerminalPolicy` denial overrides a permissive `SalesPolicy`; an explicit approved override is the only escape. |
| T5 | **POS posting independence** | POS posting calls Inventory Core + Accounting Bridge; constructs no `CreateSalesInvoiceUseCase`/`PostSalesInvoiceUseCase`. |
| T6 | **Generic approval subjects** | The Approval Engine evaluates a non-voucher subject (e.g. `price_override`, `below_cost_sale`) and returns APPROVED/REJECTED/PENDING; the module blocks the action until resolved. |
| T7 | **Accounting App off, events still recorded** | With Accounting App UI disabled, an enabled module records a financial event via `IAccountingBridge`; ledger/TB/CoA/statements UI is hidden but the event persists. |
| T8 | **Tax Engine single source** | Sales, Purchases, and POS produce identical line tax for the same `TaxCode` input through `ITaxEngine` (golden totals); no module re-implements the math. |
| T9 | **Money Core single rounding** | All modules round through one precision-aware helper; a currency with non-2 precision rounds correctly end-to-end. |
| T10 | **Approval gates posting** | Posting is rejected unless the relevant approval subject is APPROVED, driven by the shared engine (today's `ApprovalRequiredPolicy` behavior, generalized). |

---

## See also
- [System Core / Shared Engines Audit](./system-core-shared-engines-audit.md)
- [POS Audit §9 — Commercial Rules & Promotions](./pos-commercial-rules-and-promotions-audit.md)
- [POS Audit §10 — Module Independence & Persona Integrity](./pos-module-independence-and-engines-audit.md)
- [System Core / Shared Engines Master Plan](../architecture/system-core-shared-engines-master-plan.md)
