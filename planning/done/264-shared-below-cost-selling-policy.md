# Task 264 — Shared below-cost Selling Policy (POS + Sales)

**Status:** ✅ Complete
**Date completed:** 2026-06-23
**Branch:** `main`
**Time spent:** ~2.5h
**Linked plan:** _(none — owner-driven during QA; follows the POS posting chain [261](./261-pos-direct-sale-referencetype-validation.md)/[262](./262-pos-posting-firestore-read-before-write.md)/[263](./263-pos-settlement-refund-canonical-voucher-lines.md), but this is a feature, not a bug)_
**Linked architecture doc:** [`docs/architecture/system-core.md`](../../docs/architecture/system-core.md) → *Selling Policy*; [`sales.md`](../../docs/architecture/sales.md); [`pos.md`](../../docs/architecture/pos.md)
**Linked user guide:** [`docs/user-guide/sales/below-cost-selling-policy.md`](../../docs/user-guide/sales/below-cost-selling-policy.md)

---

## Definition of Done — Checklist

- [x] Code merged _(on `main`)_
- [x] `docs/architecture/system-core.md` updated — new *Selling Policy* section; `sales.md` + `pos.md` cross-references
- [x] `docs/user-guide/sales/below-cost-selling-policy.md` created
- [x] This completion report
- [x] `planning/JOURNAL.md` appended
- [x] `planning/ACTIVE.md` updated

---

## 1. Technical Developer View

### The question this answered

During QA the owner hit *"POS sale line ITEM-001 is below allowed cost/margin and requires approval"* (INFRA_999). Unlike the three preceding fixes, this was a **business rule working as designed** — but it was hardcoded into POS only (`CommercialCore.validateCostMargin` always treated below-cost as REQUIRE_APPROVAL), had **no configuration**, and Sales had **no equivalent guard at all**. The owner asked, in the language of the new engine architecture: *can one policy be consumed by several modules, and how do we attach it to Sales?*

Answer: yes — the Policy Engine is already multi-module. So below-cost was promoted from a hardcoded POS behaviour to a **shared, company-wide, configurable Selling Policy** consumed by both POS and Sales.

### What was built

**Shared policy (new):**
- `backend/src/domain/system-core/entities/SellingPolicy.ts` — company-level entity. `belowCostMode: 'BLOCK' | 'REQUIRE_APPROVAL' | 'ALLOW'` (default `REQUIRE_APPROVAL`), optional `minMarginPercent`, `allowManagerOverride` (default true).
- `backend/src/repository/interfaces/system-core/ISellingPolicyRepository.ts` + `backend/src/infrastructure/firestore/repositories/system-core/FirestoreSellingPolicyRepository.ts` (one doc per company; Firestore-only — no Prisma/SQL path yet, pre-alpha).

**Engine (policy-aware, minimal blast radius):**
- `ICommercialCore` / `CommercialCore` — `CostMarginValidationContext` gains `belowCostMode` + `allowManagerOverride`; `validateCostMargin` resolves the SellingPolicy via a new DI delegate (`resolveSellingPolicyDelegate`) unless pinned in the context, then applies the 3 modes: `ALLOW` short-circuits; `BLOCK` refuses outright (no approval route); `REQUIRE_APPROVAL` keeps the existing `below_cost_sale` Approval Engine routing. `allowManagerOverride === false` makes any violation absolute. **Default (no policy/delegate) = REQUIRE_APPROVAL**, so prior behaviour is preserved exactly.
- `LegacyCommercialCoreAdapter` — passes the new delegate through.
- `PolicyEngine` — new `scope: 'commercial', action: 'belowCostSale'` branch delegating to the Commercial Core (cross-module façade, mirrors how `scope:'accounting'` approval policy is shared). Constructor gains an optional `commercialCore`.
- DI (`bindRepositories.ts`) — `sellingPolicyRepository` getter; `commercialCore` getter wires the selling-policy delegate from that repo; `policyEngine` receives `commercialCore`.

**Attach points:**
- **POS** — `PostPosSaleUseCase` is **unchanged**; because the Commercial Core self-resolves the policy, the existing `validateCostMargin` call is now policy-driven.
- **Sales** — `PostSalesInvoiceUseCase` gains an optional `commercialCore` and, after Phase 1D computes line cost, runs the guard per tracked line comparing **line net revenue vs line cost** (both base currency, so UOM-agnostic), throwing before any voucher is written when blocked. Both `SalesController` construction sites pass `diContainer.commercialCore`.

**API + UI:**
- `GET/PUT /tenant/sales/selling-policy` (`SalesController.getSellingPolicy`/`updateSellingPolicy`, validator `validateUpdateSellingPolicyInput`, route in `sales.routes.ts`).
- Frontend `salesApi.getSellingPolicy`/`updateSellingPolicy` + `SellingPolicyDTO`; a "Below-cost selling policy" card in **Sales → Settings → Sales Policy** (mode dropdown, min-margin %, allow-override toggle). The card states it is company-wide and also governs POS.

### Why the policy lives in Sales Settings (not POS Settings)

It is a single company-wide commercial control. Putting it on `PosSettings` or `SalesSettings` alone would let two module settings drift. It is its own `SellingPolicy` store; the UI is hosted in Sales (the canonical commercial module) but the route comment, card copy, and docs all make the cross-module ownership explicit. Sales had no below-cost guard before, so there was nothing there to toggle — confirming the rule's home is the shared engine layer.

### Default & behaviour change

Default `REQUIRE_APPROVAL` preserves POS's prior behaviour. It **now also guards Sales invoices**, which were previously unguarded. Pre-alpha, no production data → no migration. Setting `ALLOW` unblocks below-cost selling for **both** apps from one place.

### Files Changed

**Backend (new):** `domain/system-core/entities/SellingPolicy.ts`, `repository/interfaces/system-core/ISellingPolicyRepository.ts`, `infrastructure/firestore/repositories/system-core/FirestoreSellingPolicyRepository.ts`.
**Backend (edited):** `application/system-core/contracts/ICommercialCore.ts`, `application/system-core/commercial/CommercialCore.ts`, `application/system-core/adapters/LegacyCommercialCoreAdapter.ts`, `application/system-core/PolicyEngine.ts`, `infrastructure/di/bindRepositories.ts`, `application/sales/use-cases/SalesInvoiceUseCases.ts`, `api/controllers/sales/SalesController.ts`, `api/validators/sales.validators.ts`, `api/routes/sales.routes.ts`.
**Frontend:** `api/salesApi.ts`, `modules/sales/pages/SalesSettingsPage.tsx`.
**Tests (new):** `tests/domain/system-core/SellingPolicy.test.ts`, `tests/application/system-core/CommercialCoreBelowCostPolicy.test.ts`, `tests/application/system-core/PolicyEngineCommercialBelowCost.test.ts`; `tests/application/sales/SalesPostingUseCases.test.ts` (+2 cases 7c/7d).

### Verification

- [x] `npx tsc --noEmit` backend **and** frontend clean
- [x] `npm run build` (backend tsc → `lib/`) clean — emulator serves the fix
- [x] New unit tests: SellingPolicy (6) + CommercialCore 3-mode (9) + PolicyEngine façade (3) + Sales attach block/allow (2) = 20
- [x] Broad sweep: `system-core` + `sales` + `pos` = **72 suites / 618 tests green**
- [x] Manual: Sales → Settings → Sales Policy shows the card; setting `ALLOW` lets a below-cost POS sale and a below-cost Sales invoice post; `BLOCK`/`REQUIRE_APPROVAL` stop them.

### Known Issues / Follow-ups

- No Prisma/SQL repository for `SellingPolicy` (Firestore-only). Add when/if the SQL path is activated.
- Sales has no per-line "approve below cost" override UI yet, so under `REQUIRE_APPROVAL` a below-cost Sales invoice blocks (POS has the manager-override flow). A Sales-side override/approval surface is a future enhancement.
- `minMarginPercent` is a single company-wide value; per-item/per-category margin floors are out of scope here.

---

## 2. End-User View

### What's New

You can now decide what happens when something is sold **at or below its cost** — and the rule applies to **both** the POS till and Sales invoices, set in one place.

### How to Use It

1. Go to **Sales → Settings → Sales Policy**.
2. Find **Below-cost selling policy** and pick:
   - **Block** — below-cost sales are never allowed.
   - **Require approval** — below-cost sales are stopped until a manager approves (this is how the till behaved before).
   - **Allow** — below-cost sales go through with no interruption.
3. Optionally set a **Minimum gross margin (%)** to also stop thin-margin (not just below-cost) sales.
4. Optionally turn off **Allow manager override** to make the rule absolute.
5. Save. The choice takes effect immediately for new POS sales and Sales invoices.

### Limitations

- The setting is company-wide (not per branch or per item).
- Approving an individual below-cost Sales invoice from the screen isn't available yet — use **Allow** (or **Block**/**Require approval**) to set the behaviour you want.

---

*This report follows the format defined in `AGENTS.md` → Definition of Done.*
