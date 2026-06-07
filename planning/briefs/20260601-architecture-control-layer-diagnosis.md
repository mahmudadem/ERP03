# Brief: Architecture Control Layer Diagnosis
**For:** Second-check architecture agent (`erp-backend-architect`, `erp-frontend-architect`, `erp-api-contract`, then `erp-reviewer`)
**From:** Codex
**Date:** 2026-06-01
**Status:** Diagnosis only. Do not implement from this brief without a second check and approved remediation plan.

## Context

Mahmud raised a product-owner concern that ERP03 feels architecturally messy around:

- governance layer
- business rules layer
- engine rules layer
- warning layer

I inspected the current repo state enough to answer whether that concern is real. Verdict: yes, the concern is valid. ERP03 has several useful control mechanisms, but their authority boundaries are not clean enough for a financial system. The biggest issue is not that the project has many layers. ERP systems need multiple layers. The issue is that similar concepts are implemented in different places with overlapping names, inconsistent runtime enforcement, and unclear "source of truth" rules.

This brief is intentionally not a fix plan. It is a diagnostic handoff for a second agent to verify before the team chooses the repair sequence.

## Current Repo State Noted

- Working branch during diagnosis: `feat/init-wizard-forms-selection`.
- Worktree is already dirty with many unrelated modified/untracked files. Do not assume this brief is the only change in the tree.
- Existing planning focus remains Task 132 chrome/native hardening. This brief does not change `planning/ACTIVE.md`.
- I ran one targeted architecture test:
  - `npm --prefix backend test -- --runInBand backend/src/tests/architecture/AccountingBoundary.test.ts`
  - Result: failed, with six accounting-boundary violations in Sales/Purchases reporting use cases.

## Executive Diagnosis

ERP03 currently has at least five control concepts that partially overlap:

1. **Backend hard accounting invariants**
   - Example: `VoucherValidationService.validateCore()` and `validateAccounts()`.
   - These protect double-entry balance, account existence, posting account role, active account status, etc.

2. **Backend configurable posting policies**
   - Example: `AccountingPolicyRegistry`, `ApprovalRequiredPolicy`, `PeriodLockPolicy`, `AccountAccessPolicy`, `CostCenterRequiredPolicy`.
   - These are intended to enforce company-level controls at posting time.

3. **Backend document workflow/governance policy**
   - Example: `DocumentPolicyResolver` for SIMPLE/OPERATIONAL workflow, direct/linked/service persona allowance, governance rules, inventory accounting mode decisions.

4. **Frontend validation/business rules/warnings**
   - Example: `frontend/src/modules/accounting/validation/DocumentValidator.ts`.
   - This calls some frontend rules "Business Rules" and "System Warnings", but it is client-side and cannot be an accounting authority.

5. **Engines and designers**
   - Accounting engine, Inventory cost engine, Promotions engine, Forms/Designer engine, scheduled tasks engine.
   - Some engines are production pathways; some are plans or scaffolding. The distinction is not always obvious.

The architecture needs a control taxonomy cleanup before adding more complex ERP flows. Otherwise future agents may add features to the wrong layer.

## Confirmed Findings

### F1. `DocumentPolicyResolver` is too broad and mixes unrelated decisions

Evidence:

- `backend/src/application/common/services/DocumentPolicyResolver.ts`
  - Lines 25-31 resolve inventory accounting mode.
  - Lines 33-47 resolve workflow UI visibility.
  - Lines 49-91 decide delivery note, goods receipt, invoice, return accounting behavior.
  - Lines 98-103 include `enforceWorkflowAccountingCompatibility()` but it currently does nothing.
  - Lines 133-410 handle sales and purchase invoice persona governance.

Diagnosis:

This one class is simultaneously a workflow resolver, inventory accounting-mode mapper, subledger posting rule helper, and governance-persona resolver. That makes it hard for another agent to know whether it is:

- a document workflow policy source,
- an inventory accounting policy source,
- a posting engine rule source,
- or a UI visibility helper.

Accounting risk:

Medium. The class is not inherently wrong, but its broad ownership makes future changes risky. A developer could change a workflow/UI rule and accidentally alter posting behavior.

Second-check focus:

Verify every caller of `DocumentPolicyResolver` and classify each method into one of these buckets: workflow visibility, persona authorization, inventory accounting timing, posting rule, migration/compatibility helper.

### F2. Backend and frontend duplicate document policy logic

Evidence:

- Backend authority candidate:
  - `backend/src/application/common/services/DocumentPolicyResolver.ts`
- Frontend duplicate:
  - `frontend/src/utils/documentPolicy.ts`
  - Lines 5-16 resolve accounting/workflow mode.
  - Lines 26-65 duplicate direct/linked/service persona policy logic.
  - Lines 79-86 infer operational Sales/Purchase document types by normalized strings.

Diagnosis:

The frontend mirrors backend policy logic instead of consuming a resolved policy contract from the backend. This may be acceptable for display hints, but it is dangerous if developers treat the frontend result as authority.

Accounting/control risk:

Medium to high. A drift between backend and frontend can produce screens that allow a user to start an action the backend blocks, or worse, hide a valid action. The backend still enforces core invoice persona creation today, but UX and governance messaging can drift.

Second-check focus:

Confirm whether any frontend-only policy decisions directly enable save/post actions without backend re-check. In particular, inspect Sales/Purchase invoice create pages and settings pages.

### F3. Sales and Purchases governance evolved differently

Evidence:

- Sales settings page:
  - `frontend/src/modules/sales/pages/SalesSettingsPage.tsx`
  - Lines 83-91 change `allowDirectInvoicing` on workflow change, but do not reconcile a company-scope governance rule.
- Sales settings backend:
  - `backend/src/application/sales/use-cases/SalesSettingsUseCases.ts`
  - Lines 203-229 apply workflow defaults and persist `allowDirectInvoicing`.
  - Lines 386-419 update settings and preserve/replace governance rules, but do not mirror the recent Purchases reconciliation helper.
- Purchases settings page:
  - `frontend/src/modules/purchases/pages/PurchaseSettingsPage.tsx`
  - Lines 24-62 normalize/reconcile the company direct-invoice governance rule.
  - Lines 113-138 keep the direct-invoice toggle and governance rule in sync.
- Purchases settings backend:
  - `backend/src/application/purchases/use-cases/PurchaseSettingsUseCases.ts`
  - Lines 41-69 define `reconcileDirectPurchaseInvoiceGovernanceRules()`.

Diagnosis:

Purchases received a governance cleanup that Sales has not fully mirrored. Sales may still persist legacy `allowDirectInvoicing` behavior without converting it into the explicit governance rule model. The backend `DocumentPolicyResolver` comments say `allowDirectInvoicing` is deprecated as a broad OPERATIONAL override, but Sales UI/backend still expose and persist it.

Accounting/control risk:

Medium. This is mostly workflow authorization clarity, not immediate ledger corruption. But it can create contradictory company settings: OPERATIONAL mode, direct invoice toggle true, no explicit allow rule.

Second-check focus:

Test a Sales company in OPERATIONAL mode with `allowDirectInvoicing=true` and no `governanceRules`. Confirm exactly what the UI shows and what `CreateSalesInvoiceUseCase` allows.

### F4. Subledger posting does not consistently apply configurable accounting policies

Evidence:

- Intended architecture:
  - `docs/architecture/accounting.md`
  - Lines 57-62 say `PostVoucherUseCase` applies posting policies and source modules should call into the accounting posting service.
- Actual subledger service:
  - `backend/src/application/accounting/services/SubledgerVoucherPostingService.ts`
  - Lines 48-54 optionally runs `PeriodLockService` only if injected.
  - Lines 125-130 run `validateCore()` and `validateAccounts()`, then write ledger/voucher.
  - It does not take `AccountingPolicyRegistry` and does not call `validatePolicies()`.
- Policy registry exists:
  - `backend/src/application/accounting/policies/AccountingPolicyRegistry.ts`
  - Lines 42-74 build enabled policies: approval, period lock, account access, cost center required.

Diagnosis:

There are two separate concepts:

- `AccountingPolicyRegistry` / `IPostingPolicy` for configurable accounting policies.
- `SubledgerVoucherPostingService` for Sales/Purchases/Inventory subledger postings.

The subledger service currently does not run the full policy registry. It only runs core/account validation plus optional `PeriodLockService`. Therefore policies like approval requirement, account access, and cost-center requirement may not be uniformly enforced for subledger-originated vouchers.

Accounting/control risk:

High. In a real ERP, Sales/Purchases/Inventory-originated postings must obey the same period lock, approval, cost center, account access, and audit policies as manual vouchers unless there is an explicit, documented exception.

Second-check focus:

Trace each subledger posting path:

- Sales: SI, DN, SR
- Purchases: PI, GRN, PR
- Inventory: stock adjustment, opening stock

For each path, determine which of these runs: `validateCore`, `validateAccounts`, `validatePolicies`, `PeriodLockService`, override audit, PostingLog.

### F5. Period lock is inconsistently wired across source modules

Evidence:

- `PeriodLockService`:
  - `backend/src/application/accounting/services/PeriodLockService.ts`
  - Lines 13-44 check hard fiscal period lock and soft `lockedThroughDate`, with optional override.
- Sales controller:
  - `backend/src/api/controllers/sales/SalesController.ts`
  - Lines 217-236 pass `diContainer.periodLockService` into `SubledgerVoucherPostingService`.
- Purchases controller:
  - `backend/src/api/controllers/purchases/PurchaseController.ts`
  - Lines 168-183 build `SubledgerVoucherPostingService` without `periodLockService`.
- Inventory controller:
  - `backend/src/api/controllers/inventory/InventoryController.ts`
  - Lines 125-132 build `SubledgerVoucherPostingService` without `periodLockService`.
- Docs currently scope the period-lock implementation heavily to Sales:
  - `docs/architecture/sales.md` lines 399-421.
  - `planning/ACTIVE.md` line 153 says enforcement is live for Sales posting paths.

Diagnosis:

Sales period-lock enforcement was added, but the same subledger posting service is used by Purchases and Inventory without the period-lock dependency. This means period lock may protect Sales-originated postings but not Purchase/Inventory-originated postings.

Accounting/control risk:

High. Posting Purchase Invoices, Goods Receipts, Purchase Returns, Stock Adjustments, or Opening Stock into a locked period would violate standard ERP controls if not blocked or explicitly overridden/audited.

Second-check focus:

Write/read-only test first, not a fix:

- Enable period lock.
- Attempt to post a Purchase Invoice/GRN dated on or before locked date.
- Attempt to post Inventory opening stock or adjustment dated on or before locked date.
- Confirm whether backend blocks or permits.

### F6. Period lock exists in two enforcement models

Evidence:

- `PeriodLockPolicy`:
  - `backend/src/domain/accounting/policies/implementations/PeriodLockPolicy.ts`
  - Lines 31-79 returns policy errors through the `IPostingPolicy` system.
- `PeriodLockService`:
  - `backend/src/application/accounting/services/PeriodLockService.ts`
  - Lines 13-44 throws `PeriodLockedError`, supports soft override reason, and checks fiscal period status.

Diagnosis:

The codebase has both a policy implementation and a service implementation for period lock. They overlap, but they do not have the same runtime semantics. `PeriodLockService` has override-aware behavior used by Sales. `PeriodLockPolicy` is used by the accounting policy registry path.

Accounting/control risk:

High if behavior diverges. The same company setting can lead to different results depending on which posting path is used.

Second-check focus:

Compare manual accounting voucher posting vs Sales posting vs Purchase posting for the same locked date. Confirm error type, override availability, audit row creation, and UI feedback.

### F7. Final ledger boundary protects core/account invariants, not all policies

Evidence:

- `FirestoreLedgerRepository.recordForVoucher()`:
  - `backend/src/infrastructure/firestore/repositories/accounting/FirestoreLedgerRepository.ts`
  - Lines 138-140 calls `validateVoucherForLedger()`.
  - Lines 191-198 run `validateCore()` and `validateAccounts()`.
- `PrismaLedgerRepository.recordForVoucher()`:
  - `backend/src/infrastructure/prisma/repositories/accounting/PrismaLedgerRepository.ts`
  - Lines 60-62 call `validateVoucherForLedger()`.
  - Lines 87-94 run `validateCore()` and `validateAccounts()`.
- No ledger repository path calls `validatePolicies()`.

Diagnosis:

The ledger repository is a good last line of defense for double-entry and account postability, but it is not a final line of defense for period lock, approval, cost center, or account-access policies. Any code path that calls `recordForVoucher()` directly and does not run policies can bypass configurable controls.

Accounting/control risk:

High. The lower boundary stops invalid vouchers, but not unauthorized/closed-period postings.

Second-check focus:

List all direct `ledgerRepo.recordForVoucher()` calls and verify whether they explicitly ran `validatePolicies()` before write.

### F8. Existing architecture boundary test fails

Evidence:

Command run:

```powershell
npm --prefix backend test -- --runInBand backend/src/tests/architecture/AccountingBoundary.test.ts
```

Result:

- `application\purchases\use-cases\PurchasesReportingUseCases.ts: Direct IVoucherRepository dependency`
- `application\purchases\use-cases\PurchasesReportingUseCases.ts: Direct ILedgerRepository dependency`
- `application\purchases\use-cases\PurchasesReportingUseCases.ts: Direct voucherRepo usage`
- `application\sales\use-cases\ReceivablesReportingUseCases.ts: Direct IVoucherRepository dependency`
- `application\sales\use-cases\ReceivablesReportingUseCases.ts: Direct ILedgerRepository dependency`
- `application\sales\use-cases\ReceivablesReportingUseCases.ts: Direct voucherRepo usage`

Related files:

- `backend/src/tests/architecture/AccountingBoundary.test.ts`
  - Lines 17-34 ban direct voucher/ledger repository dependencies in Sales/Purchases/Inventory use cases.
- `backend/src/application/purchases/use-cases/PurchasesReportingUseCases.ts`
  - Lines 1-5 import accounting statement/voucher/ledger concepts.
- `backend/src/application/sales/use-cases/ReceivablesReportingUseCases.ts`
  - Lines 8-16 import accounting voucher/ledger concepts.

Diagnosis:

The repo already knows the boundary is being violated. These are read-side reports, so the immediate posting risk is lower than direct writes, but the architecture still leaks Accounting internals into Sales/Purchases application services.

Accounting/control risk:

Medium. Reporting can become inconsistent if each module reconstructs accounting meaning directly instead of using accounting report/read-model contracts.

Second-check focus:

Decide whether the boundary test is too strict for reporting, or whether Sales/Purchases should depend on accounting read use cases/services instead of repositories/entities.

### F9. Frontend "Business Rules" are client-only but sound authoritative

Evidence:

- `frontend/src/modules/accounting/validation/DocumentValidator.ts`
  - Lines 1-8 define a 3-layer architecture: structural, business rules, system warnings.
  - Lines 85-137 evaluate business rules and dynamic rules.
  - Lines 148-172 define cascade: form > company > system defaults.
  - Lines 225-229 show `enforceCreditLimit` as a placeholder returning false.
- `frontend/src/modules/accounting/validation/README.md`
  - Lines 14-23 call Layer 2 "Business Rules" and describe block/warn outcomes.
  - Lines 144-145 explicitly say all validation is frontend-only and backend has separate posting validators.
- `frontend/src/modules/accounting/components/VoucherWindow.tsx`
  - Lines 919-930 combines old frontend validation and new frontend validation into `canSave` and warnings.

Diagnosis:

The frontend rule system is useful for UX, but "Business Rules" is a dangerous name if it is not backend-authoritative. It can block buttons in the browser, but it cannot be trusted for ledger correctness.

Accounting/control risk:

Medium. If a developer adds credit limit, below-cost, warehouse, or source-document controls only here, API callers or altered clients can bypass them.

Second-check focus:

For each frontend business rule, identify whether there is an equivalent backend use-case/posting rule. If not, label it "advisory UI validation" until backend enforcement exists.

### F10. Warning concepts are fragmented

Evidence examples:

- Posting audit warnings:
  - `backend/src/domain/accounting/entities/PostingLog.ts`
  - `docs/architecture/posting-log.md`
- Frontend validation warnings:
  - `frontend/src/modules/accounting/validation/DocumentValidator.ts`
  - `frontend/src/modules/accounting/validation/SalesValidator.ts`
  - `frontend/src/modules/accounting/validation/JournalValidator.ts`
- FX/rate deviation warnings:
  - `backend/src/application/core/services/ExchangeRateService.ts`
  - `frontend/src/api/accountingApi.ts`
- Frontend feedback taxonomy:
  - `docs/architecture/frontend-toast-taxonomy.md`
  - Lines 23-34 define eight feedback categories.
- AI/runtime warnings:
  - Many `backend/src/application/ai-assistant/*` uses of warning levels and runtime warnings.

Diagnosis:

"Warning" currently means several different things:

- advisory validation warning before save,
- policy block shown as a warning,
- posting-time audit warning,
- exchange-rate deviation warning,
- AI/model/runtime warning,
- generic UI feedback tone.

These should not all share the same mental bucket. Posting warnings especially need audit semantics and possibly user acknowledgement.

Accounting/control risk:

Medium to high depending on context. A warning that affects ledger confidence, such as unsettled cost or skipped COGS, is not the same as a UI hint.

Second-check focus:

Create an inventory of warning producers and classify them as: advisory UI, blocking policy, posting audit, setup warning, runtime/system warning.

### F11. Forms/designer engine state is confusing

Evidence:

- `docs/architecture/document-forms-plan.md`
  - Lines 397-410 say `designer-engine/components/` is unused scaffolding and `GenericVoucherRenderer` is the real production renderer.
- Actual code exports dynamic components:
  - `frontend/src/designer-engine/index.ts` exports `DynamicFormRenderer` and `DynamicVoucherRenderer`.
- Production renderer is large and widely used:
  - `frontend/src/modules/accounting/components/shared/GenericVoucherRenderer.tsx`
  - Search result showed file length ending around line 4100.
- Multiple designer routes/pages exist:
  - Accounting forms designer, unified tools forms designer, sales/purchase voucher designer wrappers, legacy paths.

Diagnosis:

The repo has a real production renderer, a designer-engine package with unused component scaffolding, and multiple designer entrypoints. This creates high onboarding confusion and increases the chance an agent edits an unused renderer or adds rules to the wrong engine.

Accounting/control risk:

Medium. The risk becomes high if dynamic forms are allowed to affect posting behavior. Current AGENTS.md says Voucher Designer is UI/schema only and dynamic posting scripts are a red line.

Second-check focus:

Map each forms/designer route to the actual runtime renderer. Mark unused scaffolding explicitly, or remove/hide it if safe.

### F12. The term "engine" is overloaded

Evidence:

- `docs/architecture/sales.md` describes Accounting as hidden engine for Sales.
- `docs/architecture/inventory.md` describes Inventory as cost engine.
- `docs/architecture/promotions.md` describes promotions engine.
- `planning/tasks/scheduled-tasks-engine.md` describes scheduled tasks engine.
- `docs/architecture/document-forms-plan.md` describes runtime form engine.

Diagnosis:

"Engine" currently means:

- hidden module dependency,
- financial posting authority,
- cost calculation service,
- rule evaluator,
- scheduler,
- renderer.

This is not a code bug by itself, but it creates architectural fog.

Second-check focus:

Recommend naming categories before any refactor: "module engine", "posting pipeline", "costing service", "policy resolver", "scheduler", "renderer".

## Suggested Control Taxonomy For Discussion Only

This is not the final plan. It is a vocabulary proposal for the second-check agent to validate.

1. **Core invariants**
   - Backend only.
   - Never configurable.
   - Examples: balanced voucher, valid account, active posting account, tenant/company isolation.

2. **Posting policies**
   - Backend only authority.
   - Company configurable.
   - Examples: period lock, approval required, cost center required, account access, closed fiscal period.

3. **Document workflow policy**
   - Backend authority with frontend display contract.
   - Examples: SIMPLE/OPERATIONAL, direct/linked/service persona allowance, required source document rules.

4. **Operational business rules**
   - Backend authority where financial/control impact exists.
   - Frontend may pre-check for UX.
   - Examples: credit limit, below cost, over-delivery, over-invoicing, required warehouse, tax eligibility.

5. **Advisory warnings**
   - May be frontend or backend, but must be labeled advisory.
   - Never treated as audit evidence unless persisted.

6. **Posting audit warnings**
   - Backend persisted.
   - Must be tied to posting result, source document, and ledger/voucher IDs.
   - Examples: unsettled cost, skipped COGS, deferred valuation.

7. **UI feedback taxonomy**
   - Frontend presentation contract only.
   - It should display the category returned by backend, not invent accounting meaning.

## Second-Check Agent Assignment Recommendation

Use read-only agents first:

1. `erp-backend-architect`
   - Verify F1, F4, F5, F6, F7, F8.
   - Produce a source-of-truth map for backend controls.

2. `erp-frontend-architect`
   - Verify F2, F3, F9, F10, F11.
   - Identify frontend-only rules that sound authoritative.

3. `erp-api-contract`
   - Check whether backend exposes resolved policy enough for frontend to avoid duplicating policy logic.
   - Check error response shape for policy/validation/setup/permission/critical categories.

4. `erp-reviewer`
   - Review the diagnosis and rank actual remediation risks before any builder starts.

Do not use builders yet.

## Suggested Verification Commands

```powershell
git status --short --branch
rg -n "DocumentPolicyResolver|governanceRules|allowDirectInvoicing|workflowMode" backend/src frontend/src docs/architecture planning/tasks
rg -n "SubledgerVoucherPostingService|AccountingPolicyRegistry|validatePolicies|PeriodLockService|PeriodLockPolicy|recordForVoucher" backend/src
rg -n "BusinessRulesConfig|RuleOutcome|systemWarnings|businessWarnings|DocumentValidator" frontend/src
rg -n "GenericVoucherRenderer|DynamicFormRenderer|DynamicVoucherRenderer|designer-engine" frontend/src docs/architecture planning/tasks
npm --prefix backend test -- --runInBand backend/src/tests/architecture/AccountingBoundary.test.ts
```

## Immediate No-Go Areas Until Plan Is Approved

- Do not merge governance and posting policy code in one broad refactor.
- Do not remove frontend validation; reclassify authority first.
- Do not expose branch-scoped governance as active unless source documents carry reliable branch context.
- Do not let Forms Designer rules affect posting unless backend-owned enforcement exists.
- Do not "fix" only naming. The real issue is enforcement consistency.
- Do not implement a dynamic posting engine. AGENTS.md explicitly keeps dynamic engine postponed unless requested.

## Minimum Acceptance Criteria For A Future Fix Plan

The future plan should not begin until the second-check agent can answer these:

1. Which backend path is the single authority for all financial postings?
2. Which policies must apply to manual Accounting vouchers and to source-module postings?
3. Which rules are allowed to remain frontend-only advisory checks?
4. Which backend endpoint returns resolved document workflow/persona policy to the frontend?
5. What is the migration behavior for existing `allowDirectInvoicing` settings?
6. What is the warning taxonomy, especially for persisted posting warnings?
7. Which forms/designer components are production and which are scaffold/deprecated?
8. What test proves Purchases and Inventory cannot post into locked periods?
9. What architecture test proves source modules do not bypass Accounting policy gates?
10. What docs must be updated so future agents do not recreate the same mess?

## Final Diagnosis

Mahmud's concern is correct. ERP03 has a real control-layer architecture problem. The system contains valuable pieces, but they are not composed under a clean authority model. The most serious confirmed risks are:

1. Subledger posting does not consistently run the same configurable accounting policies as manual voucher posting.
2. Period lock enforcement appears Sales-specific rather than module-wide.
3. Frontend "business rules" can be mistaken for authoritative ERP controls.
4. Backend/frontend governance logic is duplicated and can drift.
5. Existing architecture boundary tests already fail.

The second-check should confirm these findings and then propose a staged remediation plan. The safest first remediation target is likely the backend posting-policy boundary, not UI cleanup.
