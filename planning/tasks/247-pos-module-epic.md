# Task 247 — Retail POS Module (Epic Index + Builder Conventions)

**Owner decision:** Option C (Hybrid) — POS owns the operational layer; every completed POS sale posts an official **`direct`-persona Sales Invoice** through the existing Sales use cases. See [POS_MODULE_ARCHITECTURE_DECISION.md](../../docs/architecture/POS_MODULE_ARCHITECTURE_DECISION.md).
**Status:** Ready for implementation (phased). Owner has approved the architecture; per-phase business answers in §5 below.
**Branch convention:** one branch + PR per phase, e.g. `feat/247a-pos-foundations`.

> READ THIS FILE FIRST, then your phase file (`247a`…`247e`). Do not skip §1–§4 — they encode hard project rules the CTO/reviewer will block on.

---

## 0. Phase map (build in order, one PR each)

| Phase | File | Scope | Depends on |
|-------|------|-------|------------|
| P0 | [247a-pos-foundations.md](./247a-pos-foundations.md) | Delete stub; permissions; `PosRegister`/`PosSettings`/`PosShift` domain+repos+DI; `PosModule` mount; settings & register pages | — |
| P1 | [247b-pos-shift-lifecycle.md](./247b-pos-shift-lifecycle.md) | Open/Close/ForceClose shift, cash movements, X report, over/short voucher | P0 |
| P2 | [247c-pos-core-sale.md](./247c-pos-core-sale.md) | `CompletePosSale` → direct SI + settlement; cashier screen; receipt print/reprint | P0, P1 |
| P3 | [247d-pos-returns.md](./247d-pos-returns.md) | `CompletePosReturn` → `AFTER_INVOICE` sales return; return page | P2 |
| P4 | [247e-pos-reports-and-docs.md](./247e-pos-reports-and-docs.md) | Z report + 6 more reports (all `ReportContainer`); i18n sweep; DoD docs | P1–P3 |

---

## 1. Non-negotiable architecture rules (CTO will block merge otherwise)

1. **Layered clean architecture, SQL-migration-ready.** Domain entities have **no** Firestore/Prisma imports. Repository **interfaces** live in `backend/src/repository/interfaces/pos/`; Firestore impls in `backend/src/infrastructure/firestore/repositories/pos/`; Prisma impls in `backend/src/infrastructure/prisma/repositories/pos/`. Wire both behind a `diContainer` getter in `backend/src/infrastructure/di/bindRepositories.ts` (copy the `posShiftRepository`/`posOrderRepository` getter pattern at lines ~728–738).
2. **Controllers are thin.** They read `req.user.companyId`/`uid`/`email`, validate input, build a use case from `diContainer`, call it, map to DTO, return `{ success, data }`. Copy the exact shape of `backend/src/api/controllers/sales/SalesController.ts`.
3. **NEVER write POS-local GL/inventory/tax/COGS logic.** Sales effects MUST go through the existing Sales use cases (P2/P3). Over/short and cash drawer GL go through `SubledgerVoucherPostingService` (P1). Re-implementing posting is an automatic reject.
4. **Respect the persona source-of-truth rule.** POS posts `persona:'direct'`. If `DocumentPolicyResolver.isSalesInvoicePersonaAllowed` returns false for the company, the Sales use case throws `PersonaNotAllowedError` — **do not catch-and-convert**. Surface it. P0 ships the governance toggle that makes `direct` allowed for POS.
5. **Multi-tenant.** Every entity has `companyId`; every repo read is `(companyId, id)`-scoped. Never a global-by-id read.
6. **Transactions.** Any multi-write op uses `diContainer.transactionManager.runTransaction`, **reads-before-writes** (all `get`s before any `set`). The Sales use cases already own their posting transaction — POS use cases call them, they do **not** wrap the SI post in a second transaction.
7. **Compiled `lib/` is what runs.** Backend changes need `npm --prefix backend run build` (tsc→`lib/`) before the emulator reflects them. `tsc --noEmit` is not enough for runtime verification. (Memory: `backend_emulator_serves_compiled_lib`.)
8. **No production data exists.** No migrations/backfills needed; you may change schemas freely. (Memory: `project_no_production_data`.)

## 2. Frontend rules (reviewer `erp-reviewer` blocks on these)

1. **Shared selectors only** for master-data refs: `ItemSelector`, `WarehouseSelector`, `PartySelector`, `PartyAccountSelector` (`frontend/src/components/shared/selectors/`). `DatePicker` from `frontend/src/modules/accounting/components/shared/`. **No raw text inputs for IDs.**
2. **`ConfirmDialog`/`useConfirm`** for every state-changing action (open/close shift, complete sale, void, post return). Tone `danger`/`warning`/`info`.
3. **Toast on every action result** (`react-hot-toast`): `toast.success` / `toast(msg,{icon:'ℹ️'})` / `toast.error`. No silent actions.
4. **i18n** — every user-facing string in `frontend/src/i18n/` for **en, ar, tr**. RTL must work. No hardcoded strings.
5. **Reports** — every report page uses `<ReportContainer>` (`frontend/src/components/reports/ReportContainer.tsx`) AND its route is added to `frontend/src/config/moduleMenuMap.ts` under `pos` → `Reports`. CI (`frontend/scripts/check-reports.mjs`) fails otherwise.
6. **Routing/sidebar** — pages live in `frontend/src/modules/pos/pages/`, API client in `frontend/src/api/posApi.ts`, sidebar entries in `moduleMenuMap.ts` under the `pos` group, routes registered in the app router next to other module routes.
7. **UI-mode aware** — list/detail/report pages must accept the `isWindow` prop and work in both route mode and windows mode (copy an existing page; see exemplars below).

## 3. Copy-from exemplars (read these before writing the analogous POS file)

| You are writing | Copy structure from |
|---|---|
| Domain entity (validation, toJSON/fromJSON) | `backend/src/domain/inventory/entities/InventoryRevaluation.ts`, `backend/src/domain/sales/entities/SalesSettings.ts` |
| Repo interface | `backend/src/repository/interfaces/sales/ISalesInvoiceRepository.ts` |
| Firestore repo + mapper | `backend/src/infrastructure/firestore/repositories/pos/FirestorePOSRepositories.ts` (existing), `.../sales/FirestoreSalesInvoiceRepository.ts` |
| Prisma repo | `backend/src/infrastructure/prisma/repositories/pos/PrismaPosShiftRepository.ts` (existing) |
| Use case (settings) | `backend/src/application/sales/use-cases/SalesSettingsUseCases.ts` |
| Use case that posts a balanced voucher | `PostInventoryRevaluationUseCase` class **inside** `backend/src/application/inventory/use-cases/InventoryRevaluationUseCases.ts` (Task 223) — the template for the over/short voucher |
| Use case calling Sales | `CreateAndPostSalesInvoiceUseCase` in `backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts` |
| Controller | `backend/src/api/controllers/sales/SalesController.ts` (esp. `createAndPostSI`, `buildPostSalesInvoiceUseCase`, `postReturn`) |
| Routes | `backend/src/api/routes/sales.routes.ts` + `backend/src/api/routes/pos.routes.ts` |
| Module mount | `backend/src/modules/sales/SalesModule.ts` + `backend/src/modules/index.ts` |
| Validators | `backend/src/api/validators/sales.validators.ts` |
| DTOs | `backend/src/api/dtos/SalesDTOs.ts` |
| Frontend settings page | `frontend/src/modules/sales/pages/SalesSettingsPage.tsx` |
| Frontend scaffold list+detail | `frontend/src/modules/inventory/pages/InventoryRevaluationPage.tsx` (Task 223) |
| Frontend report page | `frontend/src/modules/sales/pages/ArAgingReportPage.tsx` |
| Frontend API client | `frontend/src/api/salesApi.ts` |

## 4. How POS sale posting works (the key integration — memorize before P2)

```
Cart (POS)                         →  CreateSalesInvoiceInput
  { itemId, qty, unitPrice,           {
    lineDiscount, taxCodeId,            companyId, customerId: <walk-in or selected>,
    warehouseId }                       invoiceDate: today, source: 'pos',
                                        formType: 'pos_sale', persona: 'direct',
POS payments                            lines: [...], createdBy: cashierUserId }
  [{method, amount, ref}]
                                     →  SettlementInput
                                        single tender  → { settlementMode:'CASH_FULL', settlements:[{...}] }
                                        split          → { settlementMode:'MULTI', settlements:[{method, amountBase, settlementAccountId?, reference}] }

CompletePosSaleUseCase:
  1. assert open shift for register (throw if none)
  2. build CreateSalesInvoiceInput + SettlementInput from cart/payments
  3. salesInvoice = CreateAndPostSalesInvoiceUseCase.execute(input, settlementInput, undefined, {userId,userEmail})
        → this ALREADY does: revenue+tax voucher, COGS voucher, inventory OUT, AR, and
          one receipt voucher (Dr cash/card account, Cr AR) per settlement row.
  4. persist PosReceipt + PosPayment[] linked to salesInvoice.id / .invoiceNumber
  5. return { receipt, salesInvoiceId, salesInvoiceNumber, change }
```

- **Payment-method → account mapping** is `SalesSettings.paymentMethodConfigs[]` (`{ method:'CASH'|'BANK_TRANSFER'|'CHECK'|'CREDIT_CARD'|'OTHER', settlementAccountId, isEnabled }`). POS reuses this; if a settlement row omits `settlementAccountId`, the Sales use case resolves it from `paymentMethodConfigs` by `paymentMethod`. **POS "CARD" maps to `CREDIT_CARD`; "Bank Transfer" → `BANK_TRANSFER`; "Custom" → `OTHER`.**
- `CASH_FULL` requires exactly one settlement row equal to the outstanding. Use it only for single-tender exact-cash/card. For cash-with-change or any split, use `MULTI` (the change is handled at the drawer/POS layer, not the SI — the SI settlement total must equal the receipt grand total).
- **Uncosted stock-out**: the Sales post already throws `UnsettledCostError`/handles `costBasis:MISSING` per inventory policy. POS does nothing special; surface the error to the cashier and (P4) the Unsettled Cost report.
- **Mount point**: registering `PosModule` (metadata.id `'pos'`) auto-mounts the router at `/tenant/pos/...` via `backend/src/api/server/tenant.router.ts:46-47` behind `companyModuleGuard('pos')`. Frontend `posApi` calls `/tenant/pos/...`.

## 5. Owner business answers (apply these; do not re-ask)

1. **Walk-in customer:** P0 seeds/ensures one company-level "Walk-in / Cash Customer" `Party` (role CUSTOMER); `PosSettings.walkInCustomerId` stores it. Cashier may attach a named customer via `PartySelector` (history/returns only — still cash/card settled).
2. **One SI per receipt** (not batch). Accept higher SI volume.
3. **Receipt numbering:** POS owns a `receiptNumber` series (`PosSettings.receiptPrefix`, default `R`, + nextSeq). The linked SI number is shown on the receipt as the legal reference.
4. **Over/short accounts:** P0 adds two settings fields `cashOverAccountId` / `cashShortAccountId`; if unset at shift close, **block** with a readable error. Seeding dedicated accounts is optional (owner question #4 deferred to a follow-up; manual mapping is acceptable for V1).
5. **Enable POS direct sales:** P0 setup writes a **form-scoped governance rule** (`scope:'form'`, `formType:'pos_sale'`, `action:'allow'`, `persona:'direct'`) into `SalesSettings.governanceRules` via the existing `UpdateSalesSettingsUseCase`, behind an explicit "Allow POS direct sales" toggle on the POS settings page. Never bypass `DocumentPolicyResolver`.
6. **Rounding:** `PosSettings.cashRounding` (default `none`); V1 may stub the UI and apply only `none` — wire the field but rounding math can be a P4 nicety.
7. **Branch:** there is no first-class Branch entity; "branch" is the governance `branchId` string. `PosRegister.branchId` is an optional free string for now (do NOT add a Branch entity).

## 6. Per-phase Definition of Done (every phase)

- [ ] `npm --prefix backend run typecheck` and `npm --prefix backend run build` clean.
- [ ] `npm --prefix backend test` green (add focused tests per phase file).
- [ ] `npm --prefix frontend run typecheck` and `npm --prefix frontend run build` clean (build runs `check-reports.mjs`).
- [ ] i18n keys present in en/ar/tr.
- [ ] `docs/architecture/pos.md` + `docs/user-guide/pos/<feature>.md` updated.
- [ ] `planning/done/247x-*.md` completion report (technical + end-user sections) with the manual QA script (Memory: `feedback_qa_in_task_files`).
- [ ] `planning/JOURNAL.md` appended; `planning/ACTIVE.md` next task set.

---

## 7. CTO AUDIT RUBRIC (used after each phase PR — agents: self-check against this before requesting review)

**A. Architecture integrity**
- [ ] No Firestore/Prisma types imported in `domain/pos/` or `application/pos/`.
- [ ] Repo registered in `bindRepositories.ts` with both SQL + Firestore branches; no `new Firestore...()` outside DI.
- [ ] Controller is thin; no business logic / posting math in controller.
- [ ] No duplicated sales/tax/COGS/inventory posting — confirmed by grep: `application/pos/**` contains **no** `VoucherEntity`, `StockMovement`, tax-rate math, or `ledgerRepository.append` for the *sale* path (over/short voucher in P1 is the only allowed direct GL write and it goes through `SubledgerVoucherPostingService`).

**B. Sales integration correctness (P2/P3)**
- [ ] POS sale calls `CreateAndPostSalesInvoiceUseCase` (or Create+Post pair) with `persona:'direct'`, `source:'pos'`, `formType:'pos_sale'`.
- [ ] Settlement total == receipt grand total; `MULTI` used for split/change, `CASH_FULL` only for single exact tender.
- [ ] `PersonaNotAllowedError` is surfaced, never caught-and-converted.
- [ ] Receipt stores `salesInvoiceId` (link, not a copy of financial truth).
- [ ] Returns use `AFTER_INVOICE` via `salesInvoiceId`; partial qty respected; restock honored by existing policy.

**C. Money/stock safety**
- [ ] No sale without an OPEN shift; one OPEN shift per register enforced at the repo/use-case level.
- [ ] Over/short blocks on missing account; voucher is balanced (Dr/Cr equal).
- [ ] Uncosted stock-out path surfaces the existing error rather than hiding it.

**D. Tenant + audit**
- [ ] All reads `(companyId, id)`-scoped.
- [ ] `RecordChangeService` records POS state changes (shift open/close, sale, return).

**E. UX/standards**
- [ ] Shared selectors + DatePicker + ConfirmDialog + toasts used; no raw ID inputs; no silent actions.
- [ ] Reports use `ReportContainer` + are in `moduleMenuMap` Reports parent.
- [ ] en/ar/tr complete; RTL verified on the cashier screen.

**F. Verification evidence in the PR/report**
- [ ] Backend build + tests output pasted.
- [ ] Frontend typecheck + build output pasted.
- [ ] A real round-trip proof (emulator) for the phase's headline flow.
