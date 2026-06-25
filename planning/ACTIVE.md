# 🎯 Current Focus

## Task 267-F (SI slice) — Accounting bridge migration: SalesInvoice document vouchers (2026-06-25) [not committed]

**Status:** ✅ Complete on `codex/267-system-core-boundary-audit` — ready to commit.

- **Why:** Follow-up to the DN COGS migration. The `PostSalesInvoiceUseCase` still held a direct `SubledgerVoucherPostingService` field alongside `IAccountingBridge`. Document vouchers (revenue + COGS) were posted via `SubledgerDocumentPoster(postingService, bridge)` with the posting service as fallback.
- **What:**
  - **Golden tests first:** New `SalesInvoiceGoldenVoucher.test.ts` (7 tests) — CapturingBridge pins exact revenue + COGS voucher output (account ids, sides, base/doc amounts, currency, source metadata, period-lock override, minimal mode, PERIODIC mode, output stability). Green before AND after migration → zero drift.
  - **SubledgerDocumentPoster:** `postingService` made optional (backward-compatible — PI/SR still pass both args unchanged).
  - **Migration:** `SalesInvoiceUseCases.ts` — removed `SubledgerVoucherPostingService` import + field + constructor param; `accountingBridge` now **required** (moved before optional params, compile-time enforced); poster constructed as `SubledgerDocumentPoster(undefined, bridge)`. `PostingGateway` retained for settlement (FUP-5, out of scope).
  - **Controller + tests:** 2 controller sites + 4 test files (19+ SI constructions) updated to new constructor signature with `LegacyAccountingBridgeAdapter` as the required bridge.
  - **Architecture guard:** New `267-F (SI)` guard — `SalesInvoiceUseCases.ts` must not import `SubledgerVoucherPostingService`, must use `SubledgerDocumentPoster` + `IAccountingBridge`. 17 existing guards untouched.
  - **Docs:** `accounting.md` (267-F SI section), `module-boundaries.md` (FUP-3), `posting-log.md` (SI row), completion report `planning/done/267-f-sales-invoice-bridge-migration.md`.
- **Verification (all green):**
  - `SalesInvoiceGoldenVoucher.test.ts` — 7/7 PASS
  - `SalesPostingUseCases.test.ts` — 29/29 PASS
  - `SystemCoreBoundaries.test.ts` — 18/18 PASS (17 existing + 1 new)
  - `npm run build` — tsc clean
  - Additional: ErrorTaxonomy + Settlement + RuleError = 14/14 PASS
- **Accounting impact:** None. Golden tests prove identical voucher output.

### Next action

Commit Task 267-F (SI slice). Next bridge-migration slice: **SalesReturnUseCases** (same `SubledgerDocumentPoster` pattern) or **PaymentSyncUseCases** (settlement `PostingGateway` → bridge).

---

## Task 267-F — Accounting bridge migration: Sales DeliveryNote COGS (2026-06-25) [committed a645cc86]

**Status:** ✅ Complete on `codex/267-system-core-boundary-audit` — review fixes applied, ready to commit.

- **Why:** The engine-boundary audit (267-A) found that Sales/Purchases/Inventory use cases still held a direct `SubledgerVoucherPostingService` field alongside `IAccountingBridge`. The task prompt required migrating one module path to bridge-only with golden voucher-output tests first. Sales / DeliveryNote COGS was chosen as the safest first target — it's the simplest, most isolated posting path (single `postFinancialEvent` call, no settlement/`PostingGateway` complexity, no existing golden tests).
- **What:**
  - **Golden tests first:** New `SalesDeliveryNoteGoldenVoucher.test.ts` (7 tests) captures the exact voucher output that flows into the bridge — account ids, debit/credit sides, base/doc amounts, currency metadata, source reference metadata, period-lock override, minimal-mode null-voucher, PERIODIC no-post, and output stability. Written and run green against pre-migration code, then remained green after migration → zero accounting output drift.
  - **Migration:** `DeliveryNoteUseCases.ts` — removed `SubledgerVoucherPostingService` import + the `accountingPostingService` constructor param; changed `postFinancialEvent({ bridge, postingService })` → `postFinancialEvent({ bridge })` (bridge-only). `accountingBridge` is now a **required** constructor param (reordered before `auditEngine?` for TypeScript compliance). `SalesController.postDN` — removed the posting-service local + 12th constructor arg, swapped bridge/auditEngine arg order. 8 existing DN test constructions updated to wire a `LegacyAccountingBridgeAdapter`.
  - **Architecture guard:** New `267-F` guard in `SystemCoreBoundaries.test.ts` — `DeliveryNoteUseCases.ts` must not import `SubledgerVoucherPostingService` or `PostingGateway`, and must use `postFinancialEvent` + `IAccountingBridge`. No existing guard weakened.
  - **Review fixes (P1+P2):** P1 — fixed "Accounting App is enabled/disabled" wording → "Accounting Engine is initialized/not initialized" in `accounting.md`, `system-core.md`, `IAccountingBridge.ts`, and the completion report. P2 — made `accountingBridge` required (was optional despite no fallback), reordered constructor + updated all 11 call sites.
  - **Docs:** `docs/architecture/accounting.md` (cross-module touchpoints + 267-F section + wording fix), `docs/architecture/system-core.md` (wording fix), `docs/architecture/module-boundaries.md` (FUP-3 update), `docs/architecture/posting-log.md` (DN row → bridge-routed), `IAccountingBridge.ts` (wording fix), completion report `planning/done/267-f-accounting-bridge-migration-delivery-note.md`.
- **Verification (all green, run on `D:\DEV2026\ERP03-267-engine-audit`):**
  - `npm --prefix backend test -- --runInBand src/tests/application/sales/SalesDeliveryNoteGoldenVoucher.test.ts` — 7/7 PASS.
  - `npm --prefix backend test -- --runInBand src/tests/architecture/SystemCoreBoundaries.test.ts` — 17/17 PASS (16 existing + 1 new 267-F guard).
  - `npm --prefix backend test -- --runInBand src/tests/application/sales/SalesPostingUseCases.test.ts` — 29/29 PASS.
  - `npm --prefix backend test -- --runInBand src/tests/application/sales` — 27 suites / 287 tests PASS.
  - `npm --prefix backend test -- --runInBand src/tests/application/system-core` — 12 suites / 73 tests PASS.
  - `npm --prefix backend run build` — tsc clean.
- **Accounting impact:** None. Golden tests prove identical voucher output. The bridge already owned the full-vs-minimal decision; this slice only removes the dead-weight fallback dependency from the use case.

### Next action

Commit Task 267-F after review. Then choose the next bridge-migration slice: **SalesInvoiceUseCases** (SI revenue + COGS via `SubledgerDocumentPoster` → make poster's `postingService` optional, remove the field from SI use case) or move to **267-G** (Inventory core ownership completion) or **267-H** (Catalog/Item engine plan).

---

## Task 267-E — Engine Management Frontend (2026-06-25) [committed 7119d26c]

**Status:** ✅ Committed on `codex/267-system-core-boundary-audit` (`7119d26c`). `opencode.json` not touched.

- **Why:** The typed `PolicyConfig` store (267-C) and its four API doorways (267-D) had no user-facing surface. Each consuming module needs its own permission-gated Controls screen so a POS-only / Sales-only / Purchases-only tenant can each manage the rules it consumes, while company-wide rules live in a single matrix page. The 🚩 litmus test ("If this tenant had ONLY the POS module enabled, could a POS-only user still set this?") now passes at the UI layer.
- **What:** Four UI doorways, all using business wording (the word "engine" never appears in user copy):
  - **Company Settings → Controls and Policies** — new page `ControlsAndPoliciesPage.tsx` at `/settings/controls-and-policies` (gated `system.company.manage`), linked from the Settings home "workflow" group. Full matrix editor over `GET/PUT /tenant/settings/controls/policies`, including unscoped TENANT rules.
  - **POS → Settings → Controls** tab, **Sales → Settings → Controls** tab, **Purchases → Settings → Controls** tab — each renders a self-contained `ModuleControlsTab` that calls its own `/tenant/{pos,sales,purchase}/policies` doorway. The module tag is locked in the shared `PolicyRulesEditor`; the backend already filters GET to module-tagged rules only and force-stamps / rejects cross-module tags on PUT.
  - New shared `controls` i18n namespace (en/ar/tr) holding every visible string (titles, columns, action labels, scope/effect labels, toasts, confirmations). Registered in `i18n/config.ts`. Plus one new `settings.home.links.controls.title` per locale.
  - New neutral API client `controlsPoliciesApi.ts` (company-wide) and `getPolicies`/`updatePolicies` on `posApi` / `salesApi` / `purchasesApi`. No frontend ever sends a `companyId` in the request body — the axios client attaches `x-company-id` from the active-company context.
  - Shared components: `PolicyRulesEditor.tsx` (business-language matrix table + add/delete + Advanced accordion) and `ModuleControlsTab.tsx` (load/save/discard body), both under `frontend/src/components/shared/`.
  - Docs: `docs/architecture/policy-engine.md` §9 added (UI doorway file map, invariants, permissions); user guides `docs/user-guide/{settings,pos,sales,purchases}/controls*.md`; completion report `planning/done/267-engine-management-frontend.md`.
- **Verification (all green, run on `D:\DEV2026\ERP03-267-engine-audit`):**
  - `npm --prefix frontend run typecheck` — tsc --noEmit PASS.
  - `npm --prefix frontend run build` — vite build PASS (`built in 28.79s`; only the pre-existing chunk-size warning remains).
  - `npm --prefix backend test -- --runInBand src/tests/api/controllers/pos src/tests/api/controllers/sales src/tests/api/controllers/purchases src/tests/api/controllers/system-core src/tests/infrastructure/firestore/system-core` — 5 suites / 30 tests PASS.
  - `npm --prefix backend test -- --runInBand src/tests/architecture/SystemCoreBoundaries.test.ts` — 16/16 PASS (no backend guard weakened; the slice is UI-only).

### Next action

Proceed to **Slice 267-F — Accounting bridge migration with golden voucher-output tests**. Verify that every document poster (SI, PI, SR, PR, DN, GRN, stock adjustments, opening stock, revaluation) routes through `IAccountingBridge` with golden voucher-output parity tests.

---

## Task 267-D — Engine Management API Doorways (2026-06-25) [CTO corrections applied 2026-06-25, committed 7119d26c]

**Status:** ✅ Committed on `codex/267-system-core-boundary-audit` (`7119d26c`).

---

## Task 267-C — Policy Resolution Engine foundation (2026-06-25) [committed 7119d26c]

**Status:** ✅ Committed on `codex/267-system-core-boundary-audit` (`7119d26c`).

- **Why:** The policy-resolution concern was the largest hybrid on the engine boundary map. A typed, data-driven precedence engine is the smallest change that makes the owner-flagged POS-vs-Sales-vs-Purchases approval example (POS terminal direct sale can post without approval; Sales / Purchases invoice posting requires approval over a threshold) expressible as one rule per module — and the smallest change that stops modules from growing the old `switch` over `(scope, action)` tuples.
- **What:** New `PolicyConfig` entity, neutral `IPolicyConfigRepository` interface, pure `PolicyResolver` precedence engine (hard → tenant → module → role → user → context → approved override), `IPolicyEngine.resolveTyped(...)` extension, and 21 new tests. The legacy `IPolicyEngine.resolve({ scope, action, ... })` facade is preserved byte-for-byte. No posting, inventory movement/costing, frontend, or catalog is touched.
- **Verification:** All four required commands green — `application/system-core` full sweep, `PolicyEnginePosPolicy` + `PolicyEngineCommercialBelowCost`, `SystemCoreBoundaries`, `npm run build`. 14 existing architecture guards still pass; one new non-failing export guard added.
- **Docs:** [done/267](./done/267-policy-resolution-engine-foundation.md); `docs/architecture/policy-engine.md`.

### Next action

Proceed to **Slice 267-F — Accounting bridge migration with golden voucher-output tests**.

---

## Task 267 — System Core engine management execution plan (2026-06-24)

**Status:** ✅ 267-A audit completed. ✅ 267-C (foundation), 267-D (API doorways), 267-E (UI doorways) all committed in `7119d26c` on `codex/267-system-core-boundary-audit`.

- **Why:** Owner wants a mistake-resistant handoff so cheaper execution agents can audit and remediate module independence, shared engines, policy resolution, and engine management UI without guessing.
- **What:** Created a detailed slice plan at [tasks/267](./tasks/267-system-core-engine-management-execution-plan.md), completed the engine-boundary audit at [audits/267](./audits/267-system-core-boundary-inventory.md), wrote the first implementation brief at [briefs/20260624-policy-resolution-engine-builder-brief](./briefs/20260624-policy-resolution-engine-builder-brief.md), and implemented the typed Policy Resolution Engine foundation (267-C) per that brief.
- **Scope:** Foundation is shipped (additive, behaviour-preserving). Remaining work in this epic: 267-D (engine management API doorways), 267-E (management UI), 267-F (Accounting bridge migration with golden tests), 267-G (Inventory core ownership completion), 267-H (Catalog/Item engine plan + implementation).

### Next action

Proceed to **Slice 267-F — Accounting bridge migration with golden voucher-output tests**. All of 267-C/D/E are committed in `7119d26c`.

---

## Task 266 — POS tax-account configuration error clarity (2026-06-24)

**Status:** ✅ Fixed on `main` (uncommitted).

- **Why:** Owner QA hit POS posting error: `No tax account configured ... Tax code undefined needs salesTaxAccountId configured.` The accounting gate was correct, but the message was not actionable when tax was manually entered without a resolved active Sales/Both tax code.
- **What:** POS still requires output tax to map through `TaxCode.salesTaxAccountId`. `PostPosSaleUseCase` now distinguishes:
  - resolved tax code exists but lacks Sales Tax Account → name that tax code;
  - positive tax amount but no active Sales/Both tax code resolved → tell the user to assign the item default Sales Tax Code or select an active sales tax code before posting.
- **Verification:** `npm test -- --runInBand src/tests/application/pos/PostPosSale.test.ts` passed (20/20); backend `npm run build` passed.
- **Docs:** [done/266](./done/266-pos-tax-account-error-message.md); `docs/architecture/pos.md`; `docs/user-guide/pos/selling.md`.

### Next action

Owner: open **Settings → Tax Codes**, set **Sales Tax Account** for the tax code used by item `e9a00617-1aaf-4719-bd3f-bf9ba877cbd3`, confirm the item has that **Default Sales Tax Code**, then rerun the POS sale. This should either post or expose the next real POS configuration blocker.

---

## Task 265 — POS Keyboard Shortcuts (2026-06-23)

**Status:** ✅ Built on `main` (uncommitted).

- **Why:** Faster actions at the POS terminal using keyboard shortcuts (F12, Delete, etc.). The owner requested shortcuts with default bindings, register-level overrides, and user-level preferences so cashiers can personalize their terminal flow.
- **What:** Added `keyboardShortcuts` JSON to `PosRegister` schema and `posShortcuts` JSON to `UserPreferences`. Built `usePosKeyboardShortcuts` hook to intercept keystrokes with priority (User > Register > Default). Built `PosKeyboardShortcutsDialog.tsx` for capturing keys. Added configuration to `PosRegistersPage` for managers and `PosTerminalPage` context bar for cashiers.
- **Verification:** Frontend built successfully (`npm run build`). No typescript or syntax errors.
- **Docs:** [done/265](./done/265-pos-keyboard-shortcuts.md); `docs/architecture/pos.md` (Frontend Data Contract); user guide `docs/user-guide/pos/keyboard-shortcuts.md`.

### Next action

Commit Task 265 on `main`. Owner: Review the shortcuts dialog in the POS terminal and test keybindings like `F12` to trigger the Payment dialog.

---## Task 264 — Shared below-cost Selling Policy for POS + Sales (2026-06-23)

**Status:** ✅ Built on `main` (uncommitted). 261 + 262 + 263 are now **committed** (`b917f3c4`, `039b0594`).

- **Why:** Owner QA hit "below allowed cost/margin and requires approval" (INFRA_999) at POS. This is a *business rule*, not a bug — but it was hardcoded into POS only, unconfigurable, and absent from Sales. Owner asked for one shared, configurable policy consumed by both apps via the engine architecture.
- **What:** New company-wide **SellingPolicy** (`belowCostMode` = BLOCK / REQUIRE_APPROVAL / ALLOW, `minMarginPercent?`, `allowManagerOverride`). `CommercialCore.validateCostMargin` is policy-aware (self-resolves via DI delegate → **POS unchanged**). `PolicyEngine` gained `scope:'commercial', action:'belowCostSale'`. **Sales attached** in `PostSalesInvoiceUseCase` (line revenue vs line cost, blocks before vouchers). API `GET/PUT /tenant/sales/selling-policy`; UI card in **Sales → Settings → Sales Policy** (governs POS too). Default `REQUIRE_APPROVAL` preserves prior POS behaviour; now also guards Sales (pre-alpha, no migration).
- **Verification:** 20 new tests; sweep system-core + sales + pos = 72 suites / 618 tests green; backend+frontend typecheck + `npm run build` clean.
- **Docs:** [done/264](./done/264-shared-below-cost-selling-policy.md); `docs/architecture/system-core.md` (Selling Policy) + `sales.md` + `pos.md`; user guide `docs/user-guide/sales/below-cost-selling-policy.md`.

**Follow-up (2026-06-24):** Owner flagged that the policy was only editable from Sales — breaks POS independence. Fixed: POS now has its own doorway (**POS → Settings → Below-cost selling policy**, `GET/PUT /tenant/pos/selling-policy`) to the same shared store; neutral validator so POS doesn't import Sales. Documented the rule in `AGENTS.md` (🚩 shared-config doorway) + auto-memory.

### Next action

Commit Task 264 (incl. the POS doorway + AGENTS.md rule) on `main`. Owner: set the policy to **Allow** from **POS → Settings → Below-cost selling policy** (or Sales Settings) to clear the below-cost block during QA, then re-run a full POS sale + a below-cost Sales invoice to confirm both honour it. Pre-existing POS-settings WIP + unrelated frontend WIP remain uncommitted by design.

---

## Task 263 — Fix `Receipt requires depositToAccountId` (INFRA_999) on POS settlement/refund (2026-06-23)

**Status:** ✅ Fixed on `main` (uncommitted, with 261 + 262 and the pre-existing POS-settings WIP).

- **Why:** Owner QA — POS sale failed at the settlement leg with "Receipt requires depositToAccountId" (INFRA_999); third blocker in the posting chain.
- **Root cause:** `ReceiptVoucherStrategy` only treats pre-built lines as canonical when each has `amount > 0`. POS settlement (`RECEIPT`) and refund (`PAYMENT`) lines carried `baseAmount`/`docAmount` but no `amount`, so the strategy fell into its `depositToAccountId`/`payFromAccountId` builder and threw.
- **Fix:** Added `amount` to the POS settlement + refund canonical lines (documented canonical contract). No shared accounting-strategy change.
- **Verification:** new `PosCanonicalVoucherLines.test.ts` (real strategies) + pos/accounting sweep = 52 suites / 348 tests green; `npm run build` clean.
- **Docs:** [done/263](./done/263-pos-settlement-refund-canonical-voucher-lines.md); `docs/architecture/pos.md` §3.

### Next action

Commit 261 + 262 + 263 (+ the staged POS-settings WIP if intended) on `main`. Re-run a full POS sale end-to-end in the terminal to confirm the whole chain now posts. Discard the superseded `PostPosReturn.test.ts` worktree.

---

## Task 262 — Fix Firestore `all reads before writes` (INFRA_005) on POS posting (2026-06-23)

**Status:** ✅ Fixed on `main` (uncommitted, with the 261 fix and the pre-existing POS-settings WIP).

- **Why:** Owner QA hit a blocking INFRA_005 ("Firestore transactions require all reads to be executed before all writes") when completing a POS sale.
- **Root cause:** POS posted inventory via the stateful `processOUT`, which reads the stock level *through* the transaction then writes; a multi-line cart therefore read after a write — forbidden by Firestore.
- **Fix:** POS sale + return now follow the Sales pattern — bare-read prefetch, pure `computeStockOutMovement` / `computeStockReturnInMovement`, write-only transaction phase. Negative-stock enforcement (POS BLOCK + company flag) moved up front. No costing/accounting math change.
- **Verification:** pos+sales+inventory+architecture = 62 suites / 517 tests green; `npm run build` clean → `lib/` updated.
- **Docs:** [done/262](./done/262-pos-posting-firestore-read-before-write.md); `docs/architecture/pos.md` §3.

### Next action

Commit 261 + 262 (+ the staged POS-settings WIP if intended) on `main`. Discard the superseded `PostPosReturn.test.ts` worktree.

---

## Task 261 — Fix `Invalid referenceType: POS_DIRECT_SALE` at POS posting (2026-06-23)

**Status:** ✅ Fixed on `main` (uncommitted with the other dirty POS-settings changes).

- **Why:** Owner QA hit a blocking "Critical Error — Invalid referenceType: POS_DIRECT_SALE" (INFRA_999) when completing a POS sale.
- **Root cause:** Validation drift in `backend/src/domain/inventory/entities/StockMovement.ts` — the `ReferenceType` type had `POS_DIRECT_SALE` / `POS_RETURN`, but the runtime `REFERENCE_TYPES` guard array (checked by the entity constructor) did not. Added both values.
- **Verification:** `PostPosSale.test.ts` + `RecordStockMovementUseCase.test.ts` green (38); backend `npm run build` clean → recompiled to `lib/`.
- **Docs:** [done/261](./done/261-pos-direct-sale-referencetype-validation.md); `docs/modules/inventory/SCHEMAS.md` enum aligned.

### Next action

Commit this fix (plus the staged POS-settings WIP if intended) on `main`. Separately: repair the stale `PostPosReturn.test.ts` constructor (needs the 8th `posSettingsRepo` arg) — test-only, production wiring already correct.

---

## Task 259 — POS shortcuts and control buttons (2026-06-23)

**Status:** ✅ Implemented on branch `codex/pos-shortcuts-control-buttons`.

- **Why:** The owner requested the full POS shortcuts/control-buttons package one slice at a time: backend layout models/resolver/API, safe command registry/execution, terminal runtime wiring, admin/settings UI, receipt print/reprint integration, docs, and verification.
- **What changed:** Added configurable POS product shortcut layouts/nodes and control button layouts/buttons; Firestore repository + DI; runtime resolver with USER → REGISTER → BRANCH → COMPANY priority; allowlisted command registry with permission/prerequisite checks; POS terminal shortcut/control rendering; dedicated `POS -> Shortcuts` page with group editing and bulk item assignment; receipt print/reprint payload integration with the shared print-layout engine.
- **Docs:** [planning/tasks/259-pos-shortcuts-control-buttons.md](./tasks/259-pos-shortcuts-control-buttons.md), [planning/done/259-pos-shortcuts-control-buttons.md](./done/259-pos-shortcuts-control-buttons.md), [docs/architecture/pos-shortcuts-control-buttons.md](../docs/architecture/pos-shortcuts-control-buttons.md), [docs/user-guide/pos/shortcuts-and-control-buttons.md](../docs/user-guide/pos/shortcuts-and-control-buttons.md).
- **Verification:** Focused POS layout tests green (`PosLayoutUseCases.test.ts`: 4 tests); backend typecheck/build green; frontend typecheck/build green. Frontend build has only existing browser-data/chunk-size warnings.
- **Accounting impact:** Terminal configuration/control only. No posting, tax, COGS, inventory valuation, settlement routing, period-lock, voucher, or approval-engine semantics changed. Reprint approval/audit remains enforced.
- **Follow-ups:** Physical printer/cash-drawer device execution remains a hardware runtime integration.
- **Actual time:** ~5.6h.

## Next action

Commit `codex/pos-shortcuts-control-buttons`, then merge as requested.

## Task 257 — POS manager overrides via the Approval Engine (2026-06-22)

**Status:** ✅ Implemented on branch `feat/pos-readiness-and-negative-stock` (on top of the 251/256/258 bundle).

- **Why:** Closed the gate-#8 deviation — POS manager overrides only checked that an approval *token* was present (trust-the-screen). No real approver-identity, authority, or self-approval check; couldn't hold PENDING.
- **What changed:** Overrides route through `IApprovalEngine.evaluate(...)`. New `PosManagerOverrideApprovalPlugin` → PENDING (no approver) / REJECTED (self-approval or approver lacking `pos.override.approve`) / APPROVED (distinct authorised manager). `CreatePosManagerOverrideUseCase` mints `approvedOverrideId` **only on APPROVED**. New `pos.override.approve` permission; plugin wired in DI with authority via `PermissionChecker`. Policy Engine still decides *whether*; Approval Engine decides *who* + outcome. `below_cost_sale` unchanged.
- **Docs:** [planning/tasks/257-...](./tasks/257-pos-manager-override-via-approval-engine.md), [planning/done/257-...](./done/257-pos-manager-override-via-approval-engine.md), `docs/architecture/pos.md` §6a.
- **Verification:** 23 suites / 144 tests green (pos + system-core + permission-catalog); backend typecheck + build clean.
- **Accounting impact:** Control hardening only.

## Task 258 — POS-specific negative-stock policy (2026-06-22)

**Status:** ✅ Implemented on the POS readiness working tree.

- **Why:** "The remaining backend safety gap" from the POS commercial-rules audit — POS inherited the company-wide `InventorySettings.allowNegativeStock` flag, so a company allowing negative stock for back-office invoicing would let the physical till oversell.
- **What changed:** New `PosSettings.negativeStockPolicy` (`BLOCK` default | `ALLOW`). `PostPosSaleUseCase` pre-checks the selling-warehouse level (`IInventoryCore.preFetchStockLevel`, aggregated per item/warehouse) and throws `NegativeStockError` before any write and on the dry-run preview when `BLOCK`; `ALLOW`/absent defers to the company flag. POS can only be stricter than the company flag, never looser. Threaded through `CompletePosSaleUseCase`, update use-case, validator, DTO, settings UI, en/ar/tr i18n.
- **Docs:** [planning/tasks/258-pos-negative-stock-policy.md](./tasks/258-pos-negative-stock-policy.md), [planning/done/258-pos-negative-stock-policy.md](./done/258-pos-negative-stock-policy.md), `docs/architecture/pos.md` §4a, `docs/user-guide/pos/setup.md`.
- **Verification:** `PostPosSale.test.ts` 18/18 (+5 new); full POS suite 14 suites / 97 tests green; backend typecheck/build clean; POS frontend files typecheck clean (pre-existing unrelated `UserPreferencesContext.tsx` errors remain in the dirty tree); en/ar/tr `pos.json` valid.
- **Accounting impact:** Control hardening only. No posting/tax/COGS/valuation/settlement/period-lock/approval-semantics change.
- **Deferred:** `ALLOW_WITH_APPROVAL` → Task 257 (Approval Engine).

## Task 251 — POS QA readiness and settlement routing (2026-06-22)

**Status:** ✅ Slices 1-16 updated locally on branch/worktree `codex/pos-qa-readiness` / `D:\DEV2026\ERP03-pos-readiness`; `origin/main` merged locally on 2026-06-22 and validation is in progress.

- **Why:** POS resumed after System Core, and the owner asked for a requirements gap plan plus a ready-to-test guide. During audit, two accounting-control gaps were found: Payment Methods report placeholders and settlement routing drift between docs/UI (register-level) and code (settings-level).
- **What changed:** POS sale/refund settlement accounts now come from the active register; missing non-cash register accounts block before posting; Payment Methods report aggregates stored payment rows and nets CASH change; promotions are hard-disabled by default; POS stock refs use POS-specific identities; the terminal now voids cart lines with reason/user/time instead of hard-deleting them, persists voided lines on the receipt audit trail, excludes them from posting totals, and prevents returning them; POS policy now has manager-override action hooks for void, price override, discount override, tax override, return, and reprint, with sale/return/reprint backend enforcement where payload support exists; registers now persist default price list id, allowed cashiers, and hardware profile id, with allowed cashiers enforced on shift open; shift close now stores expected/counted/variance by payment method and marks fully balanced shifts `RECONCILED`; cashier role policies now support max discount percent/amount and price/tax override limits, sale completion blocks over-limit lines unless manager-approved, and the override audit report returns void/discount/price/tax exception rows; POS returns now subtract prior returns before validating remaining returnable quantity; posted receipt void creates a POS return for remaining active quantities before marking the receipt `VOIDED`; POS exchange creates a linked POS return and replacement POS sale with one `exchangeId` and reports net due/refund; POS hold/recall stores suspended carts server-side as `HELD`, `RECALLED`, or `CANCELLED` without posting stock, receipt, payment, or ledger activity; Override Audit now has a dedicated POS report page; POS Returns now has a cashier-facing Exchange mode; POS sale posting blocks inactive/POS-disabled/POS-blocked items, non-discountable item discounts, expired items, expiry-tracked items without selected expiry, and batch/lot/serial-controlled items; Top Selling Items report ranks completed receipt lines by item and excludes voided lines; receipt reprints now enforce reprint approval policy, write audit rows, and appear in Reprint Audit; Cancelled Receipts lists only POS receipts marked `VOIDED` after reversal; the Terminal and Returns pages now capture audited manager approval ids and attach them to voids, sale overrides, returns, and exchanges.
- **Docs:** [planning/tasks/251-pos-qa-readiness-and-requirements-gap-plan.md](./tasks/251-pos-qa-readiness-and-requirements-gap-plan.md), [planning/done/251-pos-qa-readiness.md](./done/251-pos-qa-readiness.md), [planning/qa/pos-owner-test-guide.md](./qa/pos-owner-test-guide.md), [planning/qa/golden-paths/06-pos.md](./qa/golden-paths/06-pos.md).
- **Verification:** POS focused suites green (10 suites / 71 tests before hold/recall), System Core boundary guard green (13 tests), backend typecheck/build green, frontend typecheck/build green. Slice 1 void-line tests green (`CompletePosSale` + `CompletePosReturn`: 2 suites / 21 tests). Slice 2 manager-override focused tests green (`PolicyEnginePosPolicy` + `CompletePosSale` + `CompletePosReturn`: 3 suites / 28 tests). Slice 3 shift/register focused test green (`PosShiftUseCases`: 1 suite / 11 tests). Slice 4 shift reconciliation focused test green (`PosShiftUseCases`: 1 suite / 12 tests). Slice 5 policy/audit focused tests green (`CompletePosSale` + `PolicyEnginePosPolicy` + `PosReporting`: 3 suites / 29 tests). Slice 6 receipt-void focused test green (`CompletePosReturn`: 1 suite / 10 tests). Slice 7 exchange focused test green (`CompletePosExchange`: 1 suite / 3 tests). Slice 8 hold/recall focused test green (`PosHeldCartUseCases`: 1 suite / 5 tests). Slice 9 report guard/frontend typecheck/build green. Slice 10 exchange UI: exchange test, report guard, frontend typecheck/build green. Slice 11 item guards: `PostPosSale` 1 suite / 10 tests green; backend typecheck/build green. Slice 12 Top Selling Items: `PosReporting` 1 suite / 7 tests, report guard, backend typecheck/build, frontend typecheck/build green. Slice 13 Reprint Audit: `ReprintPosReceiptUseCase` + `PosReporting` 2 suites / 10 tests, backend typecheck/build, report guard, frontend typecheck/build green. Slice 14 Cancelled Receipts: `PosReporting` 1 suite / 9 tests, backend typecheck/build, report guard, frontend typecheck/build green. Slice 15 manager approval capture: `PosManagerOverrideUseCases` + `CompletePosExchange` 2 suites / 6 tests, backend build, frontend report guard, and frontend production build green. Slice 16 expiry/batch guards: `PostPosSale` 1 suite / 13 tests and backend build green. Merge validation after `origin/main`: `npx prisma generate` green; backend build green; focused POS + System Core/AccountingBridge/FX/inventory-init/print-layout tests green (19 suites / 121 tests); full backend suite green (195 passed / 197 total suites, 1683 passed / 1701 total tests, existing 2 skipped suites / 18 skipped tests); frontend report guard, typecheck, and production build green.
- **Accounting impact:** Cash/card/bank settlement routing now matches market-standard register-level drawer control; manager approval capture and item selling guards add audit/control evidence only. No tax, COGS, inventory valuation, settlement math, approval engine semantics, or period-lock behavior changed.
- **Next:** Merge commit, push branch, then PR/merge to `main`.
- **Actual time:** ~16.2h so far.

## Task 256 — Shared Print Layout Engine and Designer (2026-06-22)

**Status:** ✅ V1 implemented locally on branch/worktree `feat/engines-always-on` / `D:\DEV2026\ERP03`.

- **Why:** Owner clarified the print designer must be a company-level always-on engine consumed by POS, Sales, and other modules, not a static POS receipt template.
- **What changed:** Added `IPrintLayoutCore`, `PrintLayoutCore`, company print-layout template persistence, `/tenant/print-layouts` API routes, and `/tools/print-layout-designer`. The designer supports paper presets, visible safe area, dynamic field binding, bill-table component editing, long-bill overflow behavior, table header colors, drag/resize, styling, save/load, and JSON import/export.
- **Docs:** [docs/architecture/print-layout-engine.md](../docs/architecture/print-layout-engine.md), [docs/user-guide/settings/print-layout-designer.md](../docs/user-guide/settings/print-layout-designer.md), [planning/tasks/256-shared-print-layout-engine.md](./tasks/256-shared-print-layout-engine.md), [planning/done/256-shared-print-layout-engine.md](./done/256-shared-print-layout-engine.md).
- **Verification:** Focused backend tests passed (2 suites / 4 tests), backend build passed, frontend typecheck passed, and frontend production build passed. Existing bundle/browser-data warnings remain.
- **Accounting impact:** UI/template engine only. No posting, tax, COGS, AR/AP, inventory valuation, payment, period-lock, or approval behavior changed. Layout scripts are intentionally blocked; layouts can bind only to approved schemas.
- **Next:** Wire POS receipt runtime rendering as the first consumer, then Sales Invoice.
- **Actual time:** ~2.75h.

## System Core / Shared Engines Transformation — Epic 250 (2026-06-21)

**Status:** ✅ **ALL ENGINE PHASES (0–4) COMPLETE & CTO-audited (2026-06-21)** — 250a–250l done. Epic 250 implementation finished; remaining work is wrap-up docs + merge + named follow-ups. **Branch:** `feat/system-core-transformation` (worktree `D:\DEV2026\ERP03-system-core`).

> **CTO audit of Phase 4 (250k + 250l-1/2/3) — PASS WITH CAVEATS (2026-06-21).** Full backend suite **186/186 suites, 1616 tests, 0 failures, no new skips** (was 1597 at Phase 3 — additive). Golden SI/PI totals preserved.
> - **250k Accounting Bridge** — PASS. Minimal-journal mode selects full vs minimal by Accounting App activation (T7); full-mode payload unchanged. *Follow-up: Sales/Purchases/Inventory posters not yet all routed behind `IAccountingBridge` (documented in the task's delivered-scope note).*
> - **250l-2 Cost-margin guard** — PASS (clean). `validateCostMargin` does real margin math, honours approved overrides, and routes `below_cost_sale` to `IApprovalEngine` (blocks unless APPROVED).
> - **250l-1 Pricing/discount** — PASS (partial, documented). SI/PI line discount/amount calc routes through `ICommercialCore`; **SO/PO/SR/PR still use local helpers** (acceptance criterion explicitly left unchecked). Additive; golden totals unchanged.
> - **⚠️ 250l-3 Promotions — PASS WITH REQUIRED FOLLOW-UP (the weak spot).** The promotion model is only `priority` + "one BXGY + one threshold per line" — the **mandatory stacking/cap model is NOT implemented** (`maxDiscountAmount/Percent`, `exclusivePromotion`, `canStackWith`, `appliesBeforeTax/After`, best-selection, promoted-return handling — all still missing per POS audit §9 G). The 250l gate says reject-if-no-stacking-model; I am accepting the *re-homing* only because it is **default-dormant** (POS `applyPromotions` is a no-op unless a `promotionRuleReader` is wired AND rules exist) and additive (existing behavior unchanged, golden green). **HARD REQUIREMENT: do NOT enable POS/Sales promotion application in production until the stacking/cap model lands.** Tracked as follow-up FUP-1.
> - **Process note:** Codex was instructed to do 250k only and hard-stop; it ran all of 250l unattended too. Work landed green, but the per-slice CTO gate I wanted on the riskiest task did not happen — and 250l-3's gap is exactly the kind of thing that gate exists to catch. Reinforce "do only the authorized scope" in the next brief.

> **250k status (2026-06-21):** implemented minimal-journal mode in `IAccountingBridge` and removed the remaining POS direct subledger posting path (shift over/short now goes through the bridge). Full mode delegates unchanged to `SubledgerVoucherPostingService`; Accounting App disabled records a transactional `PostingLog` minimal event. Focused bridge/POS/architecture tests, backend typecheck/build, and full backend suite are green (184/186 suites, 1,600/1,618 tests; skips unchanged). **Scope caveat:** Sales/Purchases/Inventory still use their established posting service workflows; moving every source-module poster behind the bridge is a future module-by-module migration with golden voucher checks.
> **250l-1 status (2026-06-21):** `CommercialCore` now owns SI/PI line discount/amount calculation and POS product search calls `ICommercialCore.resolvePrice` with item sale-price fallback. Focused golden regressions are green (7 suites / 80 tests), backend typecheck/build is green, and full backend suite is green (186/188 suites, 1,607/1,625 tests; skips unchanged). **Scope caveat:** SO/PO/SR/PR local discount helpers and unified Sales/Purchases price-list resolution remain follow-ups after the posting-sensitive SI/PI path is audited.
> **250l-2 status (2026-06-21):** `CommercialCore.validateCostMargin` now routes below-cost/min-margin checks to `IApprovalEngine`; POS sale posting calls it after Inventory Core resolves actual unit cost. Focused tests are green (5 suites / 38 tests), backend typecheck/build are green, and the full backend suite is green (186/188 suites, 1,612/1,630 tests; skips unchanged). Unknown/zero cost does not block to avoid false service/unsettled-cost failures.
> **250l-3 status (2026-06-21):** `CommercialCore.applyPromotions` now owns the promotion evaluator. Sales' promotion service delegates to it; POS posting applies threshold discounts/free-goods before tax and posting. Focused tests are green (6 suites / 69 tests), backend typecheck/build are green, and the full backend suite is green (186/188 suites, 1,616/1,634 tests; skips unchanged). Committed.

> **CTO audit of 250i / 250j — PASS (2026-06-21):** 250i — one `INumberingEngine` serves vouchers + all Sales/Purchase documents + POS receipts; every module consumes it; no sequence resets. 250j — `IInventoryCore` is canonical (`ISalesInventoryService`/`IPurchasesInventoryService` now `@deprecated` aliases); COGS accumulation moved to the core (`resolveCOGSAccounts` + `addToCOGSBucket` in `InventoryIntegrationContracts`/`SalesInventoryService`), Sales calls them (local `AccumulatedCOGS` gone). **Full backend suite: 183/183 suites, 1597 tests, 0 failures, no new skips** — golden COGS + numbering preserved.
> **250j caveat / follow-up (Rabbit Hole):** the task's promised architecture test "Sales no longer imports inventory domain entities" was NOT added; `SalesInvoiceUseCases` still imports `Item`/`StockLevel`/`StockMovement` for **stock-OUT orchestration + revenue resolution** (legitimately Sales' posting concern, out of 250j's COGS scope). Accepted as PASS since the CTO reject conditions (COGS totals / accumulation ownership) are clear. **Follow-up:** a future task could move stock-OUT orchestration behind `IInventoryCore` so Sales drops the inventory-domain imports entirely — not blocking; candidate for post-epic or a Phase-4 add-on.

> **CTO audit of 250h — PASS (2026-06-21):** tax math now lives in `system-core/tax/TaxEngine.ts`; `SalesInvoiceCalculationService` delegates to it and `PurchaseInvoice` imports `calculateTaxLineAmounts` (no module re-implements tax). The two previously-broken/missing capabilities exist + tested: `allocateInvoiceDiscount` (invoice-discount tax allocation) and `recoverable` (purchase recoverable vs non-recoverable input tax). **Full backend suite: 182/182 suites, 1592 tests, 0 failures, no new skips** (was 1586 at Phase 2 — golden SI/PI tax regressions unchanged → behavior preserved).

- **Why:** POS paused. Three audits proved a platform-wide problem — application modules own/embed shared engines. We are separating **Engines (System Core)** from **Apps (orchestrators)** from **UI surfaces**, and unblocking POS.
- **Owner override of the feature freeze:** the 2026-06-13 freeze forbids refactors. The owner (Mahmud) has explicitly authorized this transformation and paused POS for it — this epic proceeds as an owner-sanctioned exception, same pattern as prior freeze exceptions logged in JOURNAL.
- **Plan:** [planning/tasks/250-system-core-transformation-epic.md](./tasks/250-system-core-transformation-epic.md). Phase files 250a–250l.
- **Reference:** [Platform Architecture Audit](../docs/audit/platform-architecture-engine-vs-app-audit.md) (§A–N) · [System Core Master Plan](../docs/architecture/system-core-shared-engines-master-plan.md).
- **Execution model:** **Codex** is the executing agent (not a Claude-spawned subagent). It picks up [planning/briefs/20260621-codex-system-core-transformation.md](./briefs/20260621-codex-system-core-transformation.md), implements one phase task at a time (one builder per file area), and hands back after each phase. CTO (Claude) audits each against the task's acceptance criteria + the 10 architecture tests (audit §N) before marking the phase done.
- **Phase order:** 0 seams (250a) → 1 POS-blocking **250b→c→d→e in sequence** → 2 money/audit (250f/g) → 3 tax/numbering/inventory (250h/i/j) → 4 bridge/commercial (250k/l).
- **Where I left off:** 250l-3 is committed and full-suite green. Hard-stop here for CTO audit of 250k/250l. Completion reports: [250f](./done/250f-money-core.md), [250g](./done/250g-audit-engine.md), [250h](./done/250h-tax-engine.md), [250i](./done/250i-numbering-engine.md), [250j](./done/250j-inventory-core-tidy.md), [250k](./done/250k-accounting-bridge.md), [250l](./done/250l-commercial-core.md).
- **CTO audit (2026-06-21):** 250a/b/c spot-audited against their gates — PASS. Verified: no `ISalesSettingsRepository` or `pos_direct_sale_form_allow` left in POS src (250c); `POS_DIRECT_SALE` persona threaded through resolver + `IDocumentCore` + POS sale + tests (250b); seams/adapters + architecture guard present (250a). Codex's hard-stop at 250d was correct.
- **CTO ruling on the 250d blocker:** chose **narrow 250d + add returns task** (owner-confirmed). 250d = POS **sale** path only, with a sale-path-scoped import guard; new task **[250d2](./tasks/250d2-pos-return-posting-entry-point.md)** decouples POS **returns** and then flips the folder-wide POS→Sales ban. Phase-1 sequence is now **b → c → d → d2 → e**.
- **CTO audit of Phase 1 (250d/d2/e) — PASS (2026-06-21):** verified in code, not just reports — POS sale (`CompletePosSaleUseCase`) and return (`CompletePosReturnUseCase`) import **no** Sales use-cases/entities; folder-wide `application/pos/`→Sales import guard is enabled with **zero skips** and green; `IAccountingBridge` (`LegacyAccountingBridgeAdapter`) + `PostPosSaleUseCase`/`PostPosReturnUseCase` exist; approval engine **wraps** `ApprovalPolicyService` (not duplicated) and evaluates a non-voucher subject (`below_cost_sale` → PENDING, T6). **Full backend suite: 180/180 suites, 1577 tests, 0 failures, no new skips** (was 1571 at 250c — delta = new POS/approval tests only). T2 (POS posts without Sales use-cases) tested for both sale and return.
- **CTO audit of Phase 2 (250f/250g) — PASS (2026-06-21):** verified in code — only the core helper (`system-core/money/roundMoney.ts`) + the intentionally-kept `VoucherLineEntity` define `roundMoney` (all ~17 local copies gone); POS cash rounding applied via `roundCash` and posted to over/short accounts; audit routes through `IAuditEngine` (`LegacyAuditEngineAdapter` wraps `RecordChangeService`); **no module calls `RecordChangeService` directly**; POS emits audit for sale/return/register/settings (asserted in `CompletePosSale`/`CompletePosReturn` tests). **Full backend suite: 181/181 suites, 1586 tests, 0 failures, no new skips** (was 1577 at Phase 1 — delta = money + audit tests only).
- **Next — epic wrap-up (owner decision on sequencing):**
  1. **Wrap-up docs:** ✅ done — `docs/architecture/system-core.md`, `module-boundaries.md` (new), `pos-independence.md` all exist. §N test coverage verified present + green (dedicated engine tests for Money/Tax/Numbering/Approval/Commercial/AccountingBridge + `SystemCoreBoundaries`/`PolicyEnginePosPolicy`/POS persona+independence tests; full suite 1616 green).
  2. **Merge to `main`** (owner approval) — and reconcile the **uncommitted POS QA WIP still sitting on `main`** that we branched away from.
  3. **Resume POS feature work** (the original goal) on top of the now-correct engines.
- **Named follow-ups (post-epic hardening) — status after the 2026-06-22 containment-audit fix pass:**
  - **FUP-1 (gating) — ✅ HARDENED.** Promotions are now blocked in production by a real hard gate, not just "no rules exist": `arePromotionsEnabledInProduction()` in `CommercialCore.ts` defaults OFF (`ERP_PROMOTIONS_ENABLED=true` to flip) and is checked at all 3 production apply sites (`PostPosSaleUseCase.applyPromotions`, direct-SI, SO). Still must NOT flip ON until the stacking/cap model (maxDiscount, exclusive, best-selection, appliesBeforeTax/After, promoted-return) lands and is audited.
  - **FUP-2 — ✅ DONE.** SI/PI/SO/PO/SR/PR line discount/amount math is centralised on `resolveLineDiscountAmount` in `CommercialCore`; all six document entities delegate. Golden totals unchanged; +1 test.
  - **FUP-3 — ✅ DONE (document vouchers).** All 10 document posters route through `IAccountingBridge` (full-vs-minimal) and are **active in production**: DeliveryNote, GoodsReceipt, PurchaseReturn, StockAdjustment, StockTransfer, OpeningStock, InventoryRevaluation, **and SI/PI/SR** (controllers wired 2026-06-22; byte-identical full-mode posting proven by parity tests in `SubledgerDocumentPoster.test.ts` AND a live emulator round-trip).
  - **FUP-5 — ✅ DONE.** Settlement/payment receipts (SI/PI invoice settlement + the `record-payment` PaymentSync paths, sales + purchases) now route through `IAccountingBridge.recordPreBuiltVoucher` (Option A — bridge accepts a pre-assembled `VoucherEntity`). Full mode runs the existing `PostingGateway.record` verbatim; minimal mode records a minimal journal, no GL voucher. Verified: parity tests in `AccountingBridge.test.ts`, full suite 1630 green, AND a **live emulator record-payment → balanced receipt voucher (Dr Cash / Cr AR)**.
  - **NEW — Task 252 (`x-company-id` header precedence):** found in live QA. Header is ignored on tenant module routes (active company wins) — **not a data leak** (data stays within the user's own memberships); multi-company switching affected. Needs runtime instrumentation of auth middleware; scoped in `planning/tasks/252-tenant-company-header-precedence.md`. Not blocking.
  - **FUP-4 (from 250j) — ✅ DONE.** Stock-OUT/return costing extracted to inventory core (`computeStockOutMovement`/`computeStockReturnInMovement`); Sales no longer constructs `StockMovement`/`StockLevel`; architecture guard added.
  - **Approval item-4 — ✅ DONE.** Voucher-posting approval requirement routed through `IApprovalEngine` in `SubledgerVoucherPostingService`; proven equivalent to the legacy config formula (+4 parity tests).
- **Estimate:** ~3–5 weeks of execution + CTO audit between phases.

---

## Repo status — everything merged, branches pruned (2026-06-21)

- ✅ **All feature work through Task 247 is merged into `origin/main` and local `main` (in sync at `e8ea3a34`, 0 ahead / 0 behind).** The "NOT merged to main" notes further down this file are historical and no longer reflect reality. Verified merged (some via squash, which hides them from `git merge-base --is-ancestor`): 242 strict pricing, 243-A/B/C+D pricing, 245 UX sweep, 246/246B Gross Profit, 247 POS.
- ✅ **Stale remote branches pruned** — deleted 22 confirmed-merged branches from origin, plus the superseded AI-UI branch (archived, see below). **What every remaining branch/tag is, so this is never a mystery again:**

| Ref | What it is | Status / decision |
|---|---|---|
| `origin/main` | Trunk. All shipped work. `CLAUDE.md` now names this as the working branch. | Active. |
| `origin/codex/phase-f-vendor-groups` | **Parked feature WIP.** Net-new purchase-side **Request-for-Quotation (RFQ)** backend scaffold: `PurchaseRFQ` domain entity, `PurchaseRFQUseCases`, Firestore repo, `IPurchaseRFQRepository` (~1,100 lines). No frontend. NOT in main; main only has *Sales* Quotations, which is a different feature. | **Kept.** 3 weeks old, WIP, conflicts only in DI wiring (mechanical). Finish it if Purchase RFQ is on the roadmap, otherwise formally close. |
| `tag archive/ai-provider-uiux-rebuild-2026-05-16` | The old `claude/rebuild-ai-provider-uiux-I0gh1` branch — a wholesale rewrite of the AI provider/models/certification pages (~2,600 lines). | **Archived as a tag, branch deleted.** It was 5 weeks stale and superseded: main has since edited those same pages independently, so merging would revert newer work. Recoverable via `git checkout <tag>` only if the rebuild's design is ever wanted. |
- **No code in the build queue.** Remaining items are verification + optional polish:
  - Owner browser-QA of merged-but-untested features: Task 223 Inventory Revaluation, Task 245 UX sweep, Task 247 POS (run the script in [planning/done/247-pos-module.md](./done/247-pos-module.md)).
  - Documented optional follow-ups: POS payment-method aggregation (placeholder zeros), POS receipt/return audit `recordCreate` hook, purchases error-taxonomy mirror, SR/PR net post-discount line totals.

---

## Task 246 complete - error-taxonomy 4xx merged into current main context (2026-06-21)

- ✅ **PR #27 conflict resolution:** merged current `origin/main` into `feat/246-error-taxonomy`. The only conflict was this planning file; code merged cleanly.
- ✅ **Task 246** — business-rule rejections now return structured **400** responses instead of 500/`INFRA_999` for the wired Sales/voucher paths.
- Real change: added `SALES_INVALID_STATE` / `SALES_ALREADY_POSTED`; wired `SalesInvoiceUseCases`, `SubmitVoucherUseCase`, and `VoucherEntity.submit` to domain rule errors; duplicate-code master-data guards now return `VAL_DUPLICATE_ENTRY` as 400.
- Accounting/control decision: re-posting a POSTED invoice returns a clean **400 `SALES_ALREADY_POSTED`** and does not silently no-op, preserving duplicate-posting protection.
- Verification before conflict resolution: backend build; `ErrorTaxonomyBusinessRuleMapping.test.ts` 4/4; sales + accounting + domain-accounting 61 suites / 505 tests.
- Follow-up remains explicit: purchases mirror has the `PurchaseRuleError` class but throw sites are not broadly converted because no QA-confirmed 500 leak was proven there.

## Task 247 — POS Module (all 5 phases) complete on `feat/247-pos-module` (2026-06-20)

- ✅ **All 5 phases shipped and pushed (NOT merged to main):**
  - **247a** foundations — registers, settings, governance toggle (commit `c52f6e36`)
  - **247b** shift lifecycle — open/close/forceClose, cash movements, over/short voucher, X report (commit `441603ea`)
  - **247c** core sale — `CompletePosSaleUseCase` calls the existing `CreateAndPostSalesInvoiceUseCase` with `persona:'direct', source:'pos', formType:'pos_sale'` (commit `6daaeb0d`)
  - **247d** returns — `CompletePosReturnUseCase` calls `CreateSalesReturnUseCase` + `PostSalesReturnUseCase` with `AFTER_INVOICE` (commit `04b34693`)
  - **247e** reports — 6 reports via `<ReportContainer>` (Z, Daily, Payment Methods, Cashier Sales, Over/Short, Receipt History) + Unsettled Costs link + i18n sweep (commit `d99c2b85`)
- ✅ **Cross-phase quality gates (final run):** backend typecheck/build clean, backend tests 174/176 suites + 1559/1559 tests + 18 skipped, frontend typecheck/build clean (check-reports 29 routes, check-no-confirm, check-sod-approve all pass), i18n en/ar/tr `pos` namespace complete.
- ✅ **Self-audit** vs epic §7 rubric rolled up in the per-phase completion reports and the final handoff ([planning/done/247-pos-module.md](./done/247-pos-module.md)).
- ✅ **Architectural decisions honored:**
  - No Firestore/Prisma in `domain/` or `application/`.
  - No duplicated sales/tax/COGS/inventory posting in POS code. Only the over/short voucher is a direct GL write and it goes through `SubledgerVoucherPostingService`.
  - `PersonaNotAllowedError` is surfaced, never caught-and-converted.
  - `workflowMode` is never mutated. The Allow POS direct sales toggle is the only way to enable POS direct sales; it inserts/removes a form-scoped governance rule.
- 🟡 **Known limitations (not blockers):** Payment method aggregation report returns placeholder zeros (per-receipt payments are visible); POS-side `recordCreate` for receipts/returns/settings is a follow-up; offline mode is out of V1; `cashRounding` is stored only; `branchId` is a free-text string on the register.
- 🛑 **NOT merged to main** — owner and CTO audit first.

## Next action (owner + CTO)
Run the consolidated manual TEST SCRIPT in [planning/done/247-pos-module.md](./done/247-pos-module.md#consolidated-manual-test-script-owner-runnable) end-to-end on a fresh company with the POS module entitled. Each step is a single API call or a single UI flow. The cash-drawer / over-short paths are the headline to exercise first; the split-payment and CASH-change paths are the second headline.
## Task 246B complete - Sales Gross Profit report UI ready for owner QA (2026-06-20)

- ✅ **Done on `codex/246-sales-gross-profit-ui`:**
  - Added two Sales report pages under the mandatory `ReportContainer` shell:
    - `/sales/reports/gross-profit/by-document`
    - `/sales/reports/gross-profit/by-item`
  - Added Sales -> Reports menu entries for **Gross Profit by Document** and **Gross Profit by Item**.
  - Added `salesReportingApi.getGrossProfitByDocument()` and `getGrossProfitByItem()` client methods.
  - Filters: date range, document scope, shared item selector, document currency, row limit.
  - Mixed document-currency groups display `docCurrencyBreakdown[]` instead of a fake summed currency amount.
  - Updated architecture/user docs and completion report.
- ✅ **Owner QA fix (2026-06-21):** Gross Profit by Item now resolves the item UUID to the item master label (`code - name`) before returning report rows, while keeping the UUID as the stable backend group key. The item report table no longer prints the UUID under the item label. This is a display/reporting fix only.
- ✅ **Verification:** `npm --prefix frontend run check:reports` ✅, `npm --prefix frontend run typecheck` ✅, `npm --prefix frontend run build` ✅.
- ✅ **QA fix verification:** `npm --prefix backend test -- --runInBand src/tests/application/reporting/GrossProfitReportUseCases.test.ts` ✅, `npm --prefix backend run typecheck` ✅, `npm --prefix backend run build` ✅, `npm --prefix frontend run typecheck` ✅.
- **Accounting/ERP impact:** UI/reporting only. No GL voucher, COGS posting, inventory valuation, tax, AR/AP, FX revaluation, period lock, or approval behavior changed.

## Next action

Open a PR for `codex/246-sales-gross-profit-ui`, then owner QA should test both pages from Sales -> Reports using default filters, sales-invoice-only, sales-return-only, item filter, document-currency filter, and a mixed-currency grouping.

## Task 246 PR review fixes ready - Sales Gross Profit Facts & Reports (backend-first slice) (2026-06-20)

- ✅ **Done on `codex/246-sales-gross-profit-facts` (5 incremental commits + review-fix commit):**
  - Slice 1: `SalesProfitLineFact` entity + interface + Firestore + Prisma + DI + 17 direction tests.
  - Slice 2: `RecordSalesProfitLineFactsUseCase` + wired into SI/SR/PI/PR posting inside the existing transaction. 8 tests.
  - Slice 3: `GetGrossProfitByDocumentUseCase` + `GetGrossProfitByItemUseCase` + `SalesGrossProfitController` + 2 routes (`/reports/gross-profit/by-document`, `/reports/gross-profit/by-item`).
  - Slice 4/5: architecture/user docs and completion report.
  - Review-fix slice: Prisma client now generates before backend typecheck/build; Firestore date filters are applied before `limit`; sales reports default to SI/SR only; mixed document-currency rows expose `docCurrencyBreakdown` instead of silently summing currencies.
- ✅ **Verification after PR review fixes:** `npm --prefix backend run typecheck` ✅, focused reporting tests 33/33 ✅, `npm --prefix backend run build` ✅, full backend suite 168/170 suites passed / 1508 tests passed / 18 skipped ✅.
- ✅ **Scope/model locked (2026-06-20):**
  - **Type-agnostic fact storage** — facts for SI, SR, PI, PR. Sales report endpoints default to SI/SR only; PI/PR are explicit-filter only.
  - **Absolute + direction** — `amount + 'IN'|'OUT'` per metric. Reports show IN/OUT separately.
  - **No broad dimensions** on fact rows. Only `documentNumber` (display).
- **Known v1 limitation:** SR/PR entities don't persist net post-discount, post-tax line totals. SR/PR profit facts use gross amounts. Documented as a follow-up.
- **Freeze note:** Task was marked "post-freeze candidate". Owner explicitly authorized this work despite the 2026-06-13 freeze.

## Prior next action

PR #29 was merged; this follow-up frontend slice is complete. Documented follow-ups remain: SR/PR net line totals, `EntityDimensionAssignment` model for branch/region/salesperson reports, dedicated `'reporting.salesProfit.view'` permission, custom Form Designer document type integration, optional purchase/all-document management report.

## Task 245 UX sweep complete - cherry-picked onto current main, PR-ready (2026-06-19)

- ✅ **Task 245 notes NOTE-01,02,03,04,05,07,12,13** implemented on branch `feat/245-ux-polish-sweep-rebased` (NOTE-06 was already merged separately).
- **PR #26 conflict resolution:** merged latest `origin/main` after Task 223 / PR #28 landed. The only real conflict was this planning file; Task 245 code files merged cleanly.
- **Provenance / audit note:** same as 223 — the original branch `codex/245-ux-polish-sweep-2` was forked from `58d476b3` (243-A) before 243-B/243-C+D merged and never rebased. Feature commit **cherry-picked onto current `main`** (zero code conflicts — it does not overlap 243-B/C+D or Task 223 files); 243-B/243-C+D and Task 223 verified present.
- Note: the 245 done report `planning/done/245-ux-polish-sweep.md` had already (wrongly) ridden onto main inside PR #23; this PR makes that report's claims actually true by landing the code.
- Spot-checked: NOTE-01 (onboarding COA/costing/warehouse/workflow overrides — backend regression test added), NOTE-12 (Quick Add removed), NOTE-13 (activate/deactivate toggle) all present.
- Verification before conflict resolution: backend `tsc` build ✅; `SimpleTradingCompanyInitializer.test.ts` 4/4 ✅; frontend typecheck ✅; frontend production build ✅.
- ⚠️ **Not yet owner-tested** — needs a browser pass over Customers list, Items page, UOM page, and the onboarding wizard.

## Task 223 complete - Inventory Revaluation (value-only cost correction) merged via PR #28 (2026-06-20)

- ✅ **Task 223 only** was implemented on branch `codex/223-inventory-revaluation-fresh` and merged into `main` through PR #28.
- New document: `Inventory → Forms → Revaluations` reuses the Stock Adjustment scaffold visually but has different business behavior:
  - Quantity is never changed. The line table has qty/current avg cost/current value as read-only; **only New Avg Cost is editable**.
  - Reasons: `COST_CORRECTION`, `BASIS_CHANGE`, `MIGRATION_FIX`, `WRITE_OFF`, `OTHER`.
  - Costing basis awareness: `WAREHOUSE` revalues the named level; `GLOBAL` re-prices every level to the new company average.
  - Mode-aware posting:
    - `INVOICE_DRIVEN` / `PERPETUAL`: balanced `JOURNAL_ENTRY` voucher through `SubledgerVoucherPostingService` (Dr/Cr Inventory Asset vs `InventorySettings.defaultInventoryRevaluationAccountId`). Period-lock + approval honored via the same `PostingGateway` as every other inventory-origin write.
    - `PERIODIC`: sub-ledger average cost updated, **no daily Inventory Asset GL voucher** — report-time `Inventory Valuation` uses the new basis.
  - Sub-ledger write + GL post + revaluation status update are wrapped in one `transactionManager.runTransaction` so a GL failure rolls the sub-ledger write back.
  - Hard guards: missing revaluation account blocks posting in live modes (readable error), zero qty blocks posting, posted cannot be re-edited or re-posted (DRAFT-only).
- Backend additions:
  - Domain entity `InventoryRevaluation` (DRAFT/POSTED, append-only audit fields, 2-/6-decimal normalization).
  - `IInventoryRevaluationRepository` + Firestore + Prisma impls.
  - New Prisma models `InventoryRevaluation` + `InventoryRevaluationLine` with company/status/date indexes, plus the matching inverse relation on `Item`.
  - Use cases: `CreateInventoryRevaluationUseCase` (re-reads sub-ledger to authoritatively snapshot qty/avg cost), `PostInventoryRevaluationUseCase` (in-transaction write + GL post), `ListInventoryRevaluationsUseCase`, `GetInventoryRevaluationUseCase`.
- Frontend additions:
  - `frontend/src/modules/inventory/pages/InventoryRevaluationPage.tsx` — list + scaffold form, uses `DocumentDetailScaffold` + `ClassicLineItemsTable` + `OperationalListLayout` + shared `ItemSelector` / `WarehouseSelector` / `DatePicker` + shared `ConfirmDialog` (warning tone) for post; toasts on every server response.
  - 3 routes (`/inventory/revaluations`, `/new`, `/:id`), sidebar entry under `Inventory → Forms → Revaluations` (Scale icon, `inventory.stock.adjust` permission), `inventoryApi` methods + DTOs + reason enum, i18n key `revaluations` in en/ar/tr.
- Audit hardening added before PR:
  - Revaluation detail reads are tenant-scoped by `(companyId, id)`.
  - Historical inventory valuation, period as-of valuation, and stock reconciliation replay posted revaluations alongside stock movements.
  - WAREHOUSE mode updates `Item.costingStats.avgCost` as the weighted item-level average across all warehouses.
  - GLOBAL mode draft UI can create company-wide lines without requiring a warehouse.
  - The Revaluations page has full `en/ar/tr` i18n keys, not just sidebar text.
- Verification:
  - `npm --prefix backend run typecheck` — clean.
  - `npm --prefix backend run build` — clean (`npx prisma generate` re-run for the new schema models).
  - `npm --prefix backend test` — **166 suites passed / 2 suites skipped / 0 failures; 1492 tests passed / 18 skipped / 1510 total**.
  - `npm --prefix frontend run typecheck` — clean.
  - `npm --prefix frontend run build` — clean (existing bundle-size / Browserslist / baseline-data warnings only).
- Docs:
  - [docs/architecture/inventory-revaluation.md](../docs/architecture/inventory-revaluation.md) — new technical doc.
  - [docs/user-guide/inventory/inventory-revaluation.md](../docs/user-guide/inventory/inventory-revaluation.md) — new end-user walkthrough.
  - [planning/done/223-inventory-revaluation.md](./done/223-inventory-revaluation.md) — completion report.
- **Not yet owner-tested** — needs a browser pass over `/inventory/revaluations` (web + windows modes) to confirm: a) revalue-up posts balanced voucher + sub-ledger avg updates, b) revalue-down reverses GL direction, c) PERIODIC skip works, d) the readiness rail and post confirm dialog look right.

## Task 243-C+D complete - right-click price override + Form-Designer parity PR-ready (2026-06-19)

- ✅ **Task 243 Parts C and D only** are implemented on branch `feat/243cd-price-override-and-parity` (4 commits, ~12 files).
- Two right-click affordances on the line-items table, identical on the four native pricing pages (SI/PI/PO) and the Form-Designer renderer (Part D parity):
  - **Right-click the "Unit Price" column header** → pick a document-level source or "Reset to company default". Re-resolves every priced line.
  - **Right-click a single price cell** → pick a per-line source (4 options) or "🔒 Lock (manual, no auto-resolve)". Re-resolves only that line.
- Override state model:
  - Document: existing `form.linePriceSource` is the user-selected source; compared to the new `LINE_PRICE_SOURCE_BASE = 'LAST_PARTY_PRICE'` for the "Override" badge in the column header.
  - Per-line: new transient `line.priceSourceOverride?: LinePriceSource` and `line.priceLocked?: boolean` on the four `EditableLine` types. Stripped from `buildLinePayload` via the existing white-list mappers (warning comments added).
- Shared foundation (Subtask 1):
  - `ClassicLineItemsTable` extended with `columnContextMenus` and `cellContextMenus` props + `ColumnContextMenuItem` type; `ContextMenuState` union extended; `renderContextMenu()` restructured from a catch-all `else` to explicit per-type branches.
  - `ColumnDef` gained `labelExtras` (inline header element) and `labelTitle` (header tooltip).
  - New shared `pricing/createPriceOverrideMenuItems.tsx` factory (per-document + per-line menu items).
  - New shared `pricing/LinePriceOverrideBadge.tsx` (inline pill, `document` / `line` / `lineLocked` variants).
  - i18n: en/tr/ar `common.json` — `pricing.override.*` (10 keys) + `lineItemsTable.menu.columnActions` / `cellActions`. The `ar/common.json` was MISSING the entire top-level `pricing` namespace (architect review caught this — now added).
- Verification:
  - `npm --prefix frontend run typecheck` — passed (clean after every subtask).
  - `npm --prefix frontend run build` — passed (clean; existing bundle-size / Browserslist / baseline-data warnings unchanged).
  - No backend changes — the effective-price endpoints already accept `priceSource` from Task 243-A.
- Docs/report:
  - [docs/architecture/pricing.md](../docs/architecture/pricing.md) — new "Right-click price-override after Task 243-C+D" section.
  - [docs/user-guide/sales/price-override-right-click.md](../docs/user-guide/sales/price-override-right-click.md) (new) — end-user walkthrough.
  - [planning/done/243cd-price-override.md](./done/243cd-price-override.md) — completion report.
- Deferred (out of scope for this PR):
  - **SO** and 5 other native pages (Quotation, Sales Return, Delivery Note, Goods Receipt, Purchase Return) do not have the existing pricing infrastructure (`linePriceSource` + `refreshLinePrices`). Adding the right-click override there would first require introducing the document-level source field.
  - i18n for the menu labels themselves (badge tooltips and toasts are localized; the menu labels are English-only in this version — a future change can accept a `t` function in the factory).

## Next action

Open a PR for `feat/243cd-price-override-and-parity` against `main`.

## Task 245 NOTE-01..05,07,12,13 UX polish sweep PR-ready (2026-06-19)

- ✅ **Task 245 sweep** implemented on branch `codex/245-ux-polish-sweep-2`. Combined 8 independent manual-test findings from `qa/241-manual-test-notes.md` into one PR.
- Scope stayed front-end heavy with one narrow backend add (NOTE-01 starter-policy overrides):
  - **NOTE-05:** `MasterCardLayout` gained `saveNewLabel` / `updateLabel` props; `PartyMasterCard` / `ItemMasterCard` / `WarehouseMasterCard` now show entity-specific save labels.
  - **NOTE-12:** Removed the Quick Add Item inline form from `ItemsListPage`. New Item is the only creation path.
  - **NOTE-13:** Per-row Activate / Deactivate action on the items list. Uses the shared `useConfirm` dialog, gates on `inventory.items.manage`, persists via `inventoryApi.updateItem`, refreshes the list, and toasts the result. Added a status filter alongside the existing search + type filter.
  - **NOTE-07:** `UomsPage` rewritten with explicit `<label htmlFor>` on every field, separate Add vs Edit heading, and Add / Save changes button labels.
  - **NOTE-04:** 4-option Account code format selector inside the Auto-create preview block on `PartyMasterCard`. Three presets (`{parent}-{partyCode}`, `{parent}-{seq3}`, `{parent}.{partyCode}`) + a Custom input. Format is persisted to the company-level Sales/Purchase settings on save.
  - **NOTE-03:** Account Strategy now defaults to `AUTO_CREATE` for new parties when the parent AR/AP account is already configured.
  - **NOTE-02:** `CustomersListPage` rebuilt with 4 KPI cards, search + status filter, richer header, richer table (Credit Limit + inline legal name), and a footer count line.
  - **NOTE-01:** Company Setup wizard gained an **advanced** disclosure with 5 editable policies: Chart of Accounts, Costing basis, Default warehouse code + name, Sales workflow, Purchase workflow. Each field defaults to the mode-recommended value; touched fields survive subsequent mode changes. Backend `SimpleTradingCompanyInitializer.execute` accepts the same overrides as optional fields. Controller validates and rejects unknown enum values with HTTP 400.
- Accounting/ERP impact: UI + wizard presentation only for NOTE-02/03/04/05/07/12/13. NOTE-01's backend change is additive: missing fields fall back to the existing mode-derived default so the unchanged default behaviour is preserved. No GL posting, valuation, tax, AR/AP, approval, or audit trail mutation changed.
- Verification:
  - `npm --prefix frontend run typecheck` passed (the only errors are pre-existing 243-C+D work in `SalesInvoiceDetailPage.tsx` on a parallel worktree; this branch is clean).
  - `npm --prefix frontend run build` passed (existing bundle-size/Browserslist/baseline-data warnings only).
  - `SimpleTradingCompanyInitializer` test: 4/4 passed (3 existing + 1 new NOTE-01 override test).
  - `npm --prefix backend run typecheck` and `npm --prefix backend run build` passed.
- Docs/report:
  - [docs/architecture/onboarding.md](../docs/architecture/onboarding.md) (updated)
  - [docs/architecture/operational-lists.md](../docs/architecture/operational-lists.md) (updated)
  - [docs/architecture/inventory.md](../docs/architecture/inventory.md) (updated)
  - [docs/user-guide/sales/customers-page.md](../docs/user-guide/sales/customers-page.md) (new)
  - [docs/user-guide/settings/uoms-page.md](../docs/user-guide/settings/uoms-page.md) (new)
  - [docs/user-guide/settings/account-code-format-selector.md](../docs/user-guide/settings/account-code-format-selector.md) (new)
  - [docs/user-guide/settings/onboarding-customize-starter-policies.md](../docs/user-guide/settings/onboarding-customize-starter-policies.md) (new)
  - [docs/user-guide/inventory/inventory-items-page.md](../docs/user-guide/inventory/inventory-items-page.md) (new)
  - [planning/done/245-ux-polish-sweep.md](./done/245-ux-polish-sweep.md)

## Task 243-B implemented - per-form settings (2026-06-19)

- ✅ **Task 243-B only** is implemented on branch `codex/243b-form-settings-plan` in isolated worktree `D:\DEV2026\ERP03-243b-document-settings`.
- Scope was revised by owner: settings are **per form instance**, not per document type.
- Forms Management now lists built-in/native forms alongside Form Designer forms and exposes a **Form Settings** action per row.
- Form Settings modal uses vertical tabs:
  - **Account Defaults** first.
  - **Pricing Behavior** second.
- Backend has a company-scoped per-form settings repository/use-case with Firestore and Prisma implementations:
  - native forms use `builtInFormKey` such as `native.sales.invoice`;
  - designer/default/cloned forms use persisted `formId`.
- Pricing Behavior now applies a per-form default line price source to new native Sales Invoice and Purchase Invoice drafts, and to Form Designer-rendered sales/purchase forms when the renderer has a persisted form settings record.
- Designer form clone endpoint copies source form settings to the clone.
- Account Defaults are stored and surfaced but not silently applied to posting-sensitive document fields in this slice.
- Accounting/ERP impact: defaults only. No ledger posting, tax, AR/AP, inventory valuation, stock movement, approval, period-lock, or voucher mutation rules changed.
- Verification:
  - `npm --prefix backend run build` passed.
  - `npm --prefix frontend run typecheck` passed.
  - `npm --prefix frontend run build` passed.
  - `git diff --check` passed with Windows CRLF warnings only.
- Docs/report:
  - [docs/architecture/form-settings.md](../docs/architecture/form-settings.md)
  - [docs/architecture/pricing.md](../docs/architecture/pricing.md)
  - [docs/user-guide/forms-management.md](../docs/user-guide/forms-management.md)
  - [planning/done/243b-per-form-settings.md](./done/243b-per-form-settings.md)

## Task 243-A complete - selectable line price source PR-ready (2026-06-19)

- ✅ **Task 243-A only** is implemented on branch `codex/243a-selectable-pricing-policy`.
- Backend sales and purchase effective-price endpoints now accept an optional document-level `priceSource` override:
  - `PRICE_LIST`
  - `LAST_PARTY_PRICE`
  - `LAST_EVENT`
  - `ITEM_DEFAULT`
- Resolution remains strict per Task 242. If the selected source misses, the line remains manual; no fallback chain was reintroduced.
- Native draft pages now expose **Line price source**:
  - Sales Invoice
  - Purchase Invoice
  - Purchase Order
- Forms Designer-rendered sales/purchase line tables expose the same selector and pass it through the shared line-price resolvers.
- Party-level price-list assignment is reconciled with the existing `Party.defaultPriceListId` field. Customer/vendor master cards already save this field, and the strict `PRICE_LIST` resolver uses it before currency default lists.
- Accounting/ERP impact: price suggestion only. No posting, GL, tax, AR/AP, inventory valuation, approval, period-lock, or audit-record mutation changed.
- Verification:
  - `npm --prefix backend test -- --runTestsByPath src/tests/application/sales/PriceListResolution.test.ts src/tests/application/purchases/PurchasePriceListUseCases.test.ts --runInBand` passed.
  - `npm --prefix frontend run typecheck` passed.
  - `npm --prefix backend run build` passed.
  - `npm --prefix frontend run build` passed with existing bundle-size/Browserslist/baseline-data warnings.
- Docs/report:
  - [docs/architecture/pricing.md](../docs/architecture/pricing.md)
  - [docs/user-guide/sales/pricing-policy-selection.md](../docs/user-guide/sales/pricing-policy-selection.md)
  - [planning/done/243a-selectable-pricing-policy.md](./done/243a-selectable-pricing-policy.md)

## Next action

Open the PR, then continue Task 243-B only after this PR lands because B builds on the selectable policy contract.

## Task 245 NOTE-06 complete - master-data list refresh PR opened (2026-06-19)

- Implemented only [Task 245 NOTE-06](./tasks/245-master-data-ux-polish-backlog.md): master-data lists refresh after successful create/save for customers, vendors, items, and warehouses.
- Scope stayed frontend-only:
  - route-mode saves pass a `masterDataRefreshToken` back to list pages;
  - Windows-mode master-card wrappers call the originating list reload callback before closing;
  - item windows keep the Task 244 `itemId` handoff so existing cards hydrate correctly.
- Accounting/ERP impact: none to posting, GL, taxes, inventory valuation, tenant isolation, permissions, or backend data model.
- Verification:
  - `npm --prefix frontend run typecheck` passed.
  - `npm --prefix frontend run build` passed.
- Docs/report:
  - [docs/architecture/operational-lists.md](../docs/architecture/operational-lists.md)
  - [docs/user-guide/lists/master-data-list-refresh.md](../docs/user-guide/lists/master-data-list-refresh.md)
  - [planning/done/245-note06-master-data-list-refresh.md](./done/245-note06-master-data-list-refresh.md)
- Remaining Task 245 notes are intentionally not implemented in this slice.

## Next action

Merge the NOTE-06 bugfix after review/CI. After that, pick the next independent Task 245 note only if explicitly authorized, because most remaining notes are UX polish rather than bug fixes.

## Task 244 NOTE-11 UOM conversion delete fixed -> PR pending (2026-06-19)

- ✅ **Task 244 NOTE-11 only** is implemented on branch `codex/244-note11-uom-delete-unused`.
- Root cause: the delete route reached `ManageUomConversionsUseCase.delete()`, but that use case only set `active: false`; the item-card list still returned inactive conversions, so the row stayed visible and looked undeletable.
- Fix: unused conversion delete now performs a real repository delete after the existing backend impact guard confirms no posted movements use it.
- UX hardening: the item card now checks live impact before delete, refuses used rows with visible feedback, confirms unused deletion, refreshes the conversion table, and shows toast feedback.
- Docs/report updated: `docs/architecture/inventory.md`, `docs/user-guide/inventory/README.md`, and `planning/done/244-note11-uom-delete-unused.md`.
- Verification: focused backend regression/build and frontend typecheck passed.
- Task 244 status: NOTE-08, NOTE-09, NOTE-10, and NOTE-14 are merged; NOTE-11 is this PR.
- **Next recommendation:** merge this narrow NOTE-11 fix after review, then resume 241 cross-UOM QA scenarios 8-10.

## Task 244 NOTE-10 complete - UOM duplicate conversion guard PR-ready (2026-06-19)

- ✅ **[244 NOTE-10 — UOM conversions allow duplicate From→To pairs](./tasks/244-item-uom-card-bugfix-cluster.md)** is implemented on branch `codex/244-note10-uom-duplicate-guard`.
- Backend `ManageUomConversionsUseCase` now rejects a second active conversion for the same item and `From UOM -> To UOM` pair after resolving UOM ids/codes.
- Item Master Card now pre-detects a duplicate draft pair and directs users to update the existing row factor instead of creating an ambiguous second factor.
- Inactive/deleted conversions do not reserve the pair, so a valid pair can be recreated after deletion.
- Docs/report updated: [inventory architecture](../docs/architecture/inventory.md), [inventory user guide](../docs/user-guide/inventory/README.md), [done/244-note10-uom-duplicate-guard.md](./done/244-note10-uom-duplicate-guard.md).
- Verification completed:
  - `npm --prefix backend test -- --runTestsByPath src/tests/application/inventory/UomConversionUseCases.test.ts`
  - `npm --prefix backend run build`
  - `npm --prefix frontend run typecheck`
- Task 244 status: NOTE-08, NOTE-09, and NOTE-14 are merged; NOTE-11 is a separate PR; NOTE-10 is this PR.
- **Next recommended action:** review/merge this NOTE-10 PR independently, then rebase/merge NOTE-11 because it touches the same UOM conversion management files.

## Task 244 NOTE-09 complete - UOM conversions visible in Web + Windows item cards (2026-06-19)

- ✅ **[244 NOTE-09 — Item UOM Conversions section Web/Windows parity](./tasks/244-item-uom-card-bugfix-cluster.md)** is implemented on branch `codex/244-note09-uom-web-windows-parity`.
- Scope stayed narrow: Windows item-card openings now pass/read the selected item id consistently (`data.itemId`, with a legacy `data.id` fallback). No UOM conversion math, duplicate guards, delete behavior, line-UOM selector behavior, backend posting, inventory valuation, or accounting logic changed.
- Nearby audit completed: `ItemMasterCard.tsx` has no `isWindow`/Windows conditional hiding the **Managed UOM Defaults**, **Item UOM Conversions**, or other nearby item-card sections. The parity issue was the Windows item-card identity payload, not a separate hidden section branch.
- Docs updated: [inventory architecture](../docs/architecture/inventory.md), [inventory user guide](../docs/user-guide/inventory/README.md), and completion report [done/244-note09-uom-web-windows-parity.md](./done/244-note09-uom-web-windows-parity.md).
- Verification completed:
  - `npm --prefix frontend run typecheck` ✅
  - `npm --prefix frontend run build` ✅
- Task 244 status: NOTE-08 and NOTE-14 are merged; NOTE-10/11 are in separate PRs; NOTE-09 is this PR.
- **Next recommended action:** merge this narrow PR, then rebase/merge NOTE-10 and NOTE-11 independently because they change item-card conversion management behavior.

## Task 244 NOTE-14 line UOM picker fixed -> PR pending (2026-06-19)

- **Task 244 NOTE-14 only** is implemented on branch `codex/244-note14-line-uom-picker`.
- Root cause: the shared `UomSelector` called the item-conversions API but treated the response as a raw array; when the frontend client returned a wrapped payload, conversions were discarded and the picker showed only the item base UOM.
- Fix: `UomSelector` now unwraps item/conversion API responses and fetches item UOMs even when the current option list only contains the base UOM.
- Expected result: if an item has a BOX to PCS conversion, PCS appears as a selectable UOM on sales and purchase document lines.
- Accounting/control impact: no posting, ledger, tax, valuation, stock-movement, approval, period-lock, or item-card conversion-management behavior changed. Existing line payload shape remains `uomId` / `uom`.
- Docs/report updated: `docs/architecture/inventory.md`, `docs/user-guide/inventory/item-uom-selection.md`, and `planning/done/244-note14-line-uom-picker.md`.
- Verification: `npm --prefix frontend run typecheck` and `npm --prefix frontend run build` passed. Build still reports existing bundle-size/Browserslist/baseline-data warnings.
- Task 244 status: NOTE-08 is merged; NOTE-09/10/11 are in separate PRs; NOTE-14 is this PR.
- **Next recommendation:** merge this narrow NOTE-14 fix after review, then rebase/merge the remaining Task 244 PRs because some share docs/planning and conversion-management files.

## Task 244 NOTE-08 item-card hydration fixed -> merged (2026-06-19)

- ✅ **Task 244 NOTE-08 only** is implemented on branch `codex/244-note08-item-card-hydration`.
- Root cause: Windows-mode item list opened item windows with `data.id`, while `ItemCardWindow` passed only `data.itemId` into `ItemMasterCard`; existing items therefore opened as blank new-item forms.
- Fix: `ItemCardWindow` now passes `win.data?.itemId ?? win.data?.id`, preserving compatibility with both payload shapes.
- Docs/report updated: `docs/architecture/inventory.md`, `docs/user-guide/inventory/item-master-card.md`, and `planning/done/244-note08-item-card-hydration.md`.
- Verification: frontend typecheck/build and PR CI passed.

## Task 242 complete - strict pricing-policy resolution ready for PR (2026-06-19)

- ✅ **[242 — Strict pricing-policy resolution](./tasks/242-strict-pricing-policy-resolution.md)** is implemented on branch `codex/242-strict-pricing-policy-resolution`.
- Sales and purchase effective-price resolvers are now strict to the configured policy:
  - `LAST_PARTY_PRICE` uses only the same customer/vendor + item memory.
  - `PRICE_LIST` uses only the relevant price list.
  - `ITEM_DEFAULT` uses only the item default price.
  - A miss returns blank/null for manual entry; no cross-source fallback to `LAST_EVENT` or another source.
- Default line-price policy is now `LAST_PARTY_PRICE` in inventory initialization, domain defaults, legacy fallback normalization, inventory settings update fallback, and the Simple Trading starter.
- Verification completed:
  - Focused backend suites green: 4 suites / 51 tests.
  - `npm --prefix backend run build` green.
  - Compiled-backend Firestore emulator smoke `backend/scripts/task242-emulator-smoke.cjs` green: returning parties resolved, new parties blank.
- Docs updated: [pricing architecture](../docs/architecture/pricing.md), [party/item price memory guide](../docs/user-guide/sales/party-item-price-memory.md), sales/purchase price-list guides, and the company starter guide.
- Completion report: [done/242-strict-pricing-policy-resolution.md](./done/242-strict-pricing-policy-resolution.md).
- **Next recommended action:** review/merge PR for Task 242, then continue with [243 — Pricing policy management](./tasks/243-pricing-policy-management.md) only after Task 242 is landed.

## Task 241 implemented + owner-tested → PR #14 open; follow-up tasks 242–245 created (2026-06-19)

- **[241 — Party × Item price memory](./tasks/241-party-item-price-memory.md) is implemented and validated** (164 suites / 1460 tests green; compiled-backend emulator smoke green). Committed to branch `feat/241-party-item-price-memory` and opened as **[PR #14](https://github.com/mahmudadem/ERP03/pull/14)** — **not yet merged.**
- **Owner manual test (2026-06-19):** core feature **works live** — PASS-01 (remembers last price for a returning customer), PASS-02 (sensible new-customer fallback). Full log + 18 findings in **[qa/241-manual-test-notes.md](./qa/241-manual-test-notes.md)**.
- **Investigation result:** the blocking bugs hit during the test (item card opens empty; line offers only base UOM) are **PRE-EXISTING — NOT 241 regressions** (those files aren't in the 241 diff; backend item changes are additive-only; the item list returns full data). So **PR #14 is safe to merge on its own merits.**
- **Owner decision DECISION-A:** pricing resolution must be **strict to the chosen policy — no cross-source fallback** (blank on miss); default policy → `LAST_PARTY_PRICE`. → **[Task 242](./tasks/242-strict-pricing-policy-resolution.md)** (recommended on the branch before merge).
- **Follow-up tasks created for other agents:**
  - [242 — Strict pricing-policy resolution](./tasks/242-strict-pricing-policy-resolution.md) (modifies 241; small).
  - [243 — Pricing policy management](./tasks/243-pricing-policy-management.md) (selectable policy, party assignment, right-click per-doc override, document-settings page, native↔designer parity).
  - [244 — Item card + UOM bug-fix cluster](./tasks/244-item-uom-card-bugfix-cluster.md) (pre-existing; unblocks 241 cross-UOM verification).
  - [245 — Master-data & onboarding UX polish backlog](./tasks/245-master-data-ux-polish-backlog.md) (NOTE-01–07, 12, 13).
- **Open decision for owner:** merge PR #14 now (optionally fold 242 in first?).
- **Rabbit hole logged:** `IItemRepository.getItem(id)` remains a global-by-id lookup; smoke uses unique run ids to avoid stale emulator-data collisions; future hardening should consider tenant-scoped item reads.

## AI Settings Page Division & Switch Unification (2026-06-19)

- ✅ **Refactored AI Settings Page Layout (`AiAssistantSettingsPage.tsx`)**:
  - Divided the monolithic layout card into 5 separate settings sections (`Activation Settings`, `Runtime & Provider Setup`, `Model Verification & Registry`, `Advanced AI Constraints`, and `Connection Diagnostics`).
  - Standardized all custom/inline toggle buttons to use the global `<ToggleSwitch />` component with consistent `bg-indigo-600` active colors.
  - Resolved an RTL flex layout bug where manual buttons started in reversed positions or overflowed boundaries.
  - Wrapped sections 2–5 under a separate `ai.isEnabled` opacity/pointer-events constraint, leaving Section 1 (Activation Settings) fully clickable when the module is turned off.
- ✅ **Verification completed**:
  - `npm --prefix frontend run typecheck` passed cleanly.
  - `npm --prefix frontend run build` successfully bundled Vite assets.

## Epic 240 follow-on (owner-authorized 2026-06-18)

- ✅ **Epic 240 final gate is now CLOSED on `codex/240e-report-time-valuation` (`golden-paths-green` = ON).**
- Rebuilt the backend `lib/`, restarted the emulator, re-seeded system metadata once, and re-ran the final periodic closeout on a **brand-new** tenant because the earlier blocked tenant `cmp_mqk28li8_dcor0q` remained permanently untagged after the Trading fix.
- Final fresh periodic proof tenant: `240g Periodic Trading Co Final 1781835450954` (`cmp_mqkatlbu_l8bmja`).
  - Seeded Sales accounts `400/401/402` now carry `plSubgroup=SALES`.
  - Seeded Trading/Purchases accounts `501/50101/50102/50103/50104` now carry `plSubgroup=COST_OF_SALES`.
  - The QA-only sales/purchase access patch was re-applied to this disposable tenant because the `trading-basic` bundle still entitles only accounting + inventory while the starter initializes sales + purchase records.
- Fresh periodic replay is green:
  - Opening stock dated **2026-06-18** posted Dr `10301` / Cr `303` for **1000**.
  - On **2026-06-19**, SO→DN→SI for `10 @ 15` and PO→GRN→PI for `50 @ 10` produced the intended periodic postings: DN/GRN quantity-only, SI = Dr AR / Cr Sales only, PI = Dr Purchases / Cr AP only.
  - Final stock = **140 units @ avg 10**; Inventory Valuation = **1400**; Balance Sheet inventory line `10301` = **1400**.
  - Trading Account now returns `hasData=true` with **Opening 1000 + Net Purchases 500 − Closing 1400 = Cost of Sales 100**, **Sales 150**, **Gross Profit 50**. P&L matches the same periodic computation.
  - GP05 remainder also holds on the fresh tenant: Trial Balance balanced **1650 = 1650**, AR Aging = Customer Statement **150**, AP Aging = Vendor Statement **500**, **GRNI = 0**, and no duplicate-voucher regression observed on the single-pass replay.
- Perpetual comparison tenant `cmp_mqk20i75_09f0tq` remains the prior control proof that GP05 step 4 drift stays at **0** in perpetual mode.

- ✅ **Task 240f complete (current worktree on `codex/240e-report-time-valuation`).**
- Company creation now asks for the inventory/accounting mode once and uses that single answer to seed the starter policy consistently:
  - `PERIODIC` → `periodic_trading` COA, simple direct workflows, global average cost
  - `INVOICE_DRIVEN` → `standard` COA, simple direct workflows, live inventory on invoices
  - `PERPETUAL` → `standard` COA, operational Sales/Purchases workflows, warehouse-level average cost
- Inventory Settings now allows mode changes **only before** the first posted stock or accounting transaction. After the first posted history, mode change is blocked with a readable error and the page shows the lock state.
- Pre-posting mode changes re-run the same starter initializer to re-seed the matching COA + module defaults. This is an **additive reseed**, not destructive chart cleanup, to avoid wiping draft references or weakening audit safety.
- **Audit hardening (2026-06-19):** independent audit found the reseed silently reset the owner's approval mode + fiscal-year settings (pre-posting). Fixed with a `preserveCompanyPolicy` flag — the mode-switch reseed now refreshes COA/module wiring but preserves `strictApprovalMode`, accounting `approvalRequired`/`autoPostEnabled`/`allowEditDeletePosted`, and fiscal-year config. First-time onboarding unchanged. Regression test added; reseed idempotency + lock correctness independently confirmed. See [done/240f](./done/240f-phase6-mode-lock-wizard-coa.md) audit section.
- Verification completed:
  - focused backend suites green (`SimpleTradingCompanyInitializer` incl. preserve test, `InventoryAccountingModeLockService`, `InitializeAccounting`)
  - **full backend suite green: 162 suites / 1455 tests / 0 failures**
  - `npm --prefix backend run build` green
  - `npm --prefix frontend run typecheck` + `npm --prefix frontend run build` green
- Remaining Epic 240 work is now primarily **Phase 7 QA**:
  - fresh-tenant golden-path walkthrough for each mode
  - emulator/browser proof that pre-posting mode switches reseed correctly and post-history switches block

- ✅ **Task 240e complete (current worktree on `main`).**
- `PERIODIC` companies can now produce a **report-time inventory value** without posting a closing journal.
- Added `InventoryValuationService` with policy-aware valuation (`AVERAGE`, `LAST_PURCHASE`) for current and as-of dates.
- Periodic financial reporting is now complete enough to be usable:
  - Balance Sheet inventory is overridden from report-time valuation
  - Trading Account computes `Sales − (Opening Inventory + Net Purchases − Closing Inventory)`
  - Profit & Loss replaces the raw purchases bucket with the periodic cost-of-sales result
  - Inventory Valuation report lets the user pick pricing policy and as-of date
- Verification completed:
  - focused backend suites green (valuation / trading / P&L / balance sheet)
  - `npm --prefix backend run build` green
  - `npm --prefix frontend run typecheck` green
  - `npm --prefix frontend run build` green
- Remaining review still belongs to **Epic 240 Phase 7**:
  - fresh-periodic-tenant golden-path QA
  - emulator/live-flow proof for report outputs, not just unit/build verification

- ✅ **Task 240d complete on branch `codex/240d-periodic-posting-mode`.**
- `PERIODIC` is now a real inventory accounting mode, distinct from `INVOICE_DRIVEN` and `PERPETUAL`.
- Posting behavior now matches the approved simple-trading model:
  - PI → Dr Purchases / Cr AP (+ tax), no Inventory / GRNI line
  - SI → Dr AR / Cr Sales (+ tax), no Inventory / COGS line
  - returns hit contra accounts
  - GRN / DN / adjustments are quantity-only in periodic mode
  - opening stock remains Dr Goods / Opening Inventory / Cr Opening Balance Equity
- Quantity gates were preserved: invoice quantity moves only when a GRN / DN did not already move it.
- Added the `periodic_trading` COA, made the Simple Trading Company starter default to `PERIODIC`, and hid SO / DN / PO / GRN by default for simple companies through sidebar policy wiring.
- Verification completed:
  - targeted periodic/mode suites green
  - full backend suite green: 159 passed / 2 skipped suites, 1,444 passed / 18 skipped tests
  - `npm --prefix backend run build` green
  - `npm --prefix frontend run build` green
  - root `npm run build` is **not defined** in this repo (`build:web` / `build:api` exist instead)

- ✅ **Task 240b complete on branch `codex/240b-discount-cost-basis-fix`.**
- Fixed the Purchase Invoice line-discount cost-basis mismatch for `INVOICE_DRIVEN` and `PERPETUAL` only.
- Backend regression coverage added and green.
- Real round-trip verified against compiled `backend/lib` through the emulator:
  - posted PI subtotal / grand total = `475`
  - stock qty = `50`
  - avg cost base = `9.5`
  - Inventory GL reconciliation drift = `0`
- Backlog note: [223 inventory revaluation](./tasks/223-inventory-revaluation-value-only-correction.md) remains valid only for **value-only revaluation/correction**. The discount mismatch itself is now closed by [240b](./tasks/240b-phase2-discount-cost-basis-fix.md).

- ✅ **Branch consolidation (2026-06-18):** the week-of-work branch (`codex/simple-trading-company-template`, 186 files), the 240 Phase 2 fix, and all the epic-240 plan docs are now merged onto `main` as the single baseline (`main` builds: backend + frontend tsc). Future phases branch fresh from `main`.
- ✅ **Task 240c (Phase 3 — item costing stats) is now on `main`.** Per-item `costingStats` (avgCost / lastPurchaseCost / lastSalePrice, FX-accurate, extensible), `ItemCostingStatsService`, hooks in all IN paths (engine + inline PI + GRN) and sale paths (SI/DN), Firestore+Prisma parity, Item card UI. **No GL posting change.** Full backend suite **1,436 tests pass**; build clean. Report: [done/240c](./done/240c-phase3-item-costing-stats.md).
  - Integration fixes during landing: stale test mocks (`updateItemInTransaction` ×5, `preFetchLevelsByItem` ×3) and the **pre-existing** `PostingAuthority` guard (week's approval-leak hotfix → `resolveApproved`) updated without weakening it.
- **Next recommended task:** Epic 240 is green and closed. The next clean follow-on is [241](./tasks/241-party-item-price-memory.md), which is already parallel-safe because it depends on Phase 3 rather than on any remaining Epic 240 blocker.

---

## 🧊 FEATURE FREEZE + SHIP PLAN (declared 2026-06-13 — overrides all active threads below)

**CTO audit delivered 2026-06-13:** [CTO-AUDIT-2026-06-13.md](./CTO-AUDIT-2026-06-13.md) (Arabic: [CTO-AUDIT-2026-06-13.ar.md](./CTO-AUDIT-2026-06-13.ar.md)). Verdict: v1 build phase is done; the project now ships a pilot instead of building features. **The freeze and the phased ship plan live in [PRIORITIES.md](./PRIORITIES.md) — read that first.**

**Phase 1 (Stabilize) status, 2026-06-13:**
- ✅ Pending work committed (tasks 216–219 + audit) — `c431c90c`, `e16e0785`
- ✅ Verification green: backend 146 suites / 1,365 tests pass; frontend tsc + production build pass
- ✅ CI pipeline created: `.github/workflows/ci.yml` (backend typecheck+tests, frontend typecheck+build, on push/PR to main)
- ✅ Golden-path QA scripts created: [planning/qa/golden-paths/](./qa/golden-paths/README.md) — **these supersede QA-QUEUE.md**
- ✅ Verification detours fixed: sidebar child-icon JSX syntax repaired; AI certification test double now uses deterministic ids
- ✅ Merge to `main` + tag `v0.9-alpha` + push completed — `main` and tag pushed
- 🔶 **Owner action: rerun GP02 after Codex stabilization slice** (~30-45 min). Findings → `planning/qa/findings.md`
- ⬜ Fix remaining GP02 findings, especially warehouse-level average cost / transfer costing audit → then continue GP03 only after GP02 is testable
- ✅ **GP02-step9 negative-stock fully closed (2026-06-14):** default-hardening ([done/230](./done/230-gp02-negative-stock-default-hardening.md)) plus the transfer-path follow-up — `processTRANSFER`/`processTRANSFERGlobal` now enforce `allowNegativeStock` on the source OUT leg (previously only `processOUT` did, so a transfer could drive a warehouse negative). 3 new regression tests; inventory suite 56/56. **Owner: clear the existing negative rows (e.g. correcting transfer/adjustment) and re-confirm step 9.**
- ✅ **GP02 transfer drafts now cancelable (2026-06-15):** added `CancelStockTransferUseCase` + `DELETE /transfers/:id` + UI **Cancel** button so a stuck/incorrect DRAFT transfer can be removed (DRAFT-only; COMPLETED refused). Also clarified the VALUED-transfer GL entry does NOT bypass the one-door guard (posts through `PostingGateway.record()`, APPROVED by the completion action). See [done/230](./done/230-gp02-negative-stock-default-hardening.md).
- ✅ **GP02 stock-transfer simple correction layer (2026-06-15):** DRAFT transfers now support **Edit** and **Delete**; COMPLETED transfers now support **Undo**, which creates/completes a linked reverse transfer instead of deleting posted history. Links: `reversesTransferId` / `reversedByTransferId`; SQL schema parity updated. Tests: transfer-focused backend suite 12/12; backend build + frontend typecheck green. This is the approved pattern for "simple for small companies, controlled for bigger ones": simple action label, audit-safe backend reversal.
- 🔶 **Approval-leak found; interim hotfix shipped + full redesign drafted (2026-06-15):** the guard derived approval from a caller-passed `ctx.approved` boolean defaulting to approved, so Inventory postings (valued transfer, adjustment, opening stock) silently bypassed `ApprovalRequiredPolicy` in strict mode — contradicting Law 7. **Interim fix shipped:** `SubledgerVoucherPostingService.resolveApproved` fails closed for inventory-origin postings (they now BLOCK in strict mode; non-strict unchanged). Found the same latent leak in DN/GRN (PERPETUAL+strict) — left for the full fix. Design note: [briefs/20260615-approval-record-redesign.md](./briefs/20260615-approval-record-redesign.md) (approval = verifiable record the guard checks; SoD + content fingerprint; grant model). Owner decisions locked: require-approval (A) + full fingerprint. **⚠️ Consequence: in strict mode, inventory GL postings now block (no approve UI yet) — disable Financial Approval to keep doing inventory QA, or wait for the full flow. Next: implement the record model phased (brief §5).**
- ✅ **Journaled stock-transfer costing fix implemented (2026-06-15):** approved brief [briefs/20260615-journaled-stock-transfer-costing.md](./briefs/20260615-journaled-stock-transfer-costing.md) is now coded. Automatic `uplift = IN − OUT` is deleted; value beyond source cost posts only from explicit `addedCostBaseAtTransfer` → Transfer Clearing or explicit `revaluationUnitCostBaseAtTransfer` → new `defaultInventoryRevaluationAccountId`. Plain/journaled transfers move at source carrying cost; zero-cost source transfers at zero unless explicitly revalued; GLOBAL pure transfers keep the global average flat; negative-stock guard remains on source OUT in both bases. Verification: focused transfer/settings/global/negative-stock tests 45/45, full inventory/domain slice 13 suites / 76 tests, backend build, frontend typecheck, and compiled-`lib` Firestore emulator smoke passed. Report: [done/231-journaled-stock-transfer-costing.md](./done/231-journaled-stock-transfer-costing.md). **Next:** restart/reload the running stack and rerun GP02 transfer costing on a fresh tenant with accounting enabled.
- ✅ **Simple Trading Company starter template implemented + browser-proven (2026-06-16):** company creation now has a final **Company Setup** step before Review for base currency, timezone, date format, language, and optional **Auto initialize Trading Company - Simple**. With auto-init on, the backend initializes Accounting, Inventory, Sales, and Purchases with a simple trading policy: standard COA, invoice-driven inventory, global moving-average costing, negative stock off, SIMPLE direct invoicing, default linked posting accounts including AP, and a visible Company Policy Summary. Tax is tax-ready only; no country legal rate is silently applied. Browser QA created a fresh `Wholesale Trading` company with Syria defaults (`SYP`, `Asia/Damascus`, `DD/MM/YYYY`, `ar`) and reached the policy summary successfully. Docs: [architecture/onboarding](../docs/architecture/onboarding.md), [user guide](../docs/user-guide/settings/company-starter-template.md), report [done/232](./done/232-simple-trading-company-starter-template.md). **Next:** rerun GP01 from the new company/dashboard, then continue GP02 on that clean tenant.
- ✅ **GP01 rerun on fresh starter tenant — steps 1–11 + 17–19 GREEN (2026-06-16):** Drove GP01 in-browser on a fresh `GP01 Trading Co` (created via the new starter; SYP/Damascus/DD-MM-YYYY). **Steps 1–5 PASS** (new Company Setup wizard step, GLOBAL costing, AP-link → Purchases "Financial Integration Active", full COA incl. Opening Balance Equity/Inventory Revaluation/Adjustment Gain-Loss, all module settings match the policy summary). **Accounting engine PASS:** owner-typed JV (Dr Cash 10101 1,000 / Cr Paid-in Capital 30101 1,000) posted as JOU-0001; Trial Balance Dr 1,000 = Cr 1,000, Balance Sheet Assets 1,000 = Equity 1,000, Cash ledger running balance 1,000 — all tie. Full per-step log in [qa/findings.md](./qa/findings.md) (GP01 2026-06-16 block). **Findings:** (1+2) two raw i18n keys `sidebar.currencies` + `trialBalance.balanced` — **FIXED + verified live** (added to en/ar/tr common.json + accounting.json). (3) **RESOLVED — not a bug (owner confirmed):** posted voucher editable + "Update & Post" is intentional **FLEXIBLE-mode** behavior (re-post routes through the guarded gateway, per GP01-step11b); strict mode / locked periods remain immutable. **Steps 12–16 (period lock + approval) NOT rerun:** they need owner-typed backdated/new vouchers — the line-amount cells resist automation (synthetic input + preview_fill both fail to update React state), so Claude cannot enter amounts unattended. These passed in the 2026-06-14 live retest. **Next when owner is back:** (a) type the vouchers for GP01 steps 12–16 on the fresh tenant; (b) then continue GP02 on the same clean tenant. (Step-10 posted-voucher editability resolved: by-design Flexible-mode behavior.)
- ✅ **Stock Transfers list page standardized (2026-06-17):** Rebuilt the Stock Transfers list page using the shared `OperationalListLayout` and `DataTable` components, standardizing columns, filters, status tabs, sorting, pagination, and kebab row actions. Expandable inline rows display transfer lines and movements. Report: [done/235](./done/235-stock-transfers-list-standardization.md).
- ✅ **Inventory document form scaffold refactor (2026-06-17):** Stock Adjustments and Opening Stock Documents now follow the document workflow pattern: list page → New opens dedicated scaffold form → detail/read route. Opening Stock's **Create Accounting Effect** control sits in the scaffold control section, and its offset account pre-fills from the new `InventorySettings.defaultOpeningBalanceAccountId` while preserving per-document override and backend EQUITY validation. Report: [done/236](./done/236-inventory-document-scaffold-refactor.md). **Next:** browser-check `/inventory/adjustments`, `/inventory/adjustments/new`, `/inventory/opening-stock`, and `/inventory/opening-stock/new` in web/windows modes.
- ✅ **Inventory document hook-order hotfix (2026-06-18):** fixed the remaining route-switch crash on `OpeningStockPage` and `StockAdjustmentPage` by converting the form branch to a computed `formView` and returning it only after all list-side hooks run. `npm --prefix frontend run typecheck` passed. **Still needed:** authenticated browser smoke on the four inventory routes above; the in-app browser reached only the public sign-in surface because it had no active session.
- ✅ **Spinner unification sweep completed (2026-06-16):** Replaced all remaining raw Lucide Loader2 imports and tags across 60 frontend files with our unified themed `<Spinner />` component. Tested and verified type-safety (`npx tsc`) and production Vite assets packaging build compile cleanly with zero errors. Report: [done/234](./done/234-spinner-unification.md).
- ✅ **Voucher Ledger Impact view implemented (2026-06-16):** added read-only `#/accounting/vouchers/:id/ledger` so a user can open a voucher and see the actual posted ledger rows it created. Backend reuses `GET /tenant/accounting/reports/general-ledger?voucherId=:id`; repository path already restricts voucher-impact queries to posted ledger rows. Voucher read view now has **Ledger impact** action. Verification: focused backend test, backend build, frontend typecheck, frontend production build all pass. Docs: [architecture/accounting](../docs/architecture/accounting.md), [user guide](../docs/user-guide/accounting/vouchers-and-ledger-impact.md), report [done/233](./done/233-voucher-ledger-impact-view.md). **Next:** browser-check the new route on a live posted voucher when the stack is running; separately decide whether the older voucher read page should be made Web/Windows-mode aware.
- ✅ **Tenant-isolation detour closed for voucher-link concern (2026-06-16):** voucher repositories were already company-scoped, but `authMiddleware` only warned when a normal user supplied an `x-company-id` they did not belong to. It now fails closed with `403 COMPANY_ACCESS_DENIED`; stale stored active-company values without membership are stripped to `null`. Focused middleware regression test + backend build pass. This protects Accounting voucher/ledger routes and other tenant routes that depend on the shared auth middleware.
- ✅ **Follow-up tenant route audit applied (2026-06-16):** after the voucher-link security question, audited API `companyId` usage. Tenant-context controllers already use authenticated `tenantContext`/`req.user.companyId`; super-admin/platform routes intentionally carry explicit company ids behind platform guards. Patched remaining legacy tenant surfaces: `/api/v1/company-modules/:companyId...`, `/api/v1/tenant/companies/:companyId/module-settings/:moduleId`, and `/api/v1/core/company/settings` now reject/ignore caller-selected company ids for normal users. Added guard/controller regression tests; backend build passes.
- ✅ **Company selector/user-level access regression fixed (2026-06-16):** fail-closed auth correctly rejected stale/unauthorized `x-company-id`, but user-level endpoints are no-company-context endpoints and the frontend global API client was still attaching the old active company header. Backend now strips `x-company-id` for user company/preference routes; frontend skips it for `/auth/me/permissions`, `/user/preferences`, `/users/me/companies`, `/users/me/switch-company`, and `/users/me/active-company`. Keep this exception narrow — do not weaken tenant routes.

**Latest GP02 stabilization slice (2026-06-13):**
- Fixed Item Card price-group persistence by preserving item `metadata` through create/update DTOs.
- Forced SERVICE items to remain non-stock in both frontend and backend.
- Made Stock Adjustment inputs labeled and added visible toast success/error/no-op feedback.
- Changed Stock Adjustment posting so accounting-enabled tenants get a readable blocking error when item GL mappings are missing instead of silently posting stock without a voucher.
- Verification passed: backend build, backend full test suite (146 passed / 2 skipped suites; 1,365 passed / 18 skipped tests), frontend typecheck, frontend production build.
- Completion report: [done/220-gp02-inventory-stabilization-slice.md](./done/220-gp02-inventory-stabilization-slice.md).

**Shell decision (owner, 2026-06-13): main shell IS production. Apex cutover dead.** Remaining Apex visual backports are frozen chrome polish.

---

## Pre-freeze strategy context (kept for history)

**Strategy (2026-05-30):** v1 ships natives as the primary surface. Default Forms / Field Library / cloning preserved as v2 customization path, hidden from sidebar for now. See journal entry "v1 strategy decision" for full reasoning.

**Pre-freeze active threads (all paused by the freeze):**
1. **Task 132 main-shell chrome work** — shell cleanup, sidebar IA polish, settings taxonomy, action safety, RTL/i18n. **Owner decision (2026-06-13): stop Apex tenant-shell cutover work.** Main shell remains production. Reuse only the Apex accordion-sidebar visual treatment inside the main shell accordion mode; do not change the sidebar's existing behavior, route source, permissions, workflow hiding, tenant/module filtering, or flyout mode.
2. **Native functionality retest** — superseded by the [golden-path QA scripts](./qa/golden-paths/README.md), which are the structured version of exactly this thread.
3. **Native UI-mode awareness (per-voucher)** — frozen until post-pilot. Standard in [tasks/132-ux-layout-production-hardening.md](./tasks/132-ux-layout-production-hardening.md) Phase 4.5.

**Latest completion reports:** [127-tailwind-play-theme-and-styling.md](./done/127-tailwind-play-theme-and-styling.md), [128-coa-template-defaults-and-comprehensive-coa.md](./done/128-coa-template-defaults-and-comprehensive-coa.md), [129-phase-f-pi-attachments.md](./done/129-phase-f-pi-attachments.md), [130-phase-f-vendor-groups.md](./done/130-phase-f-vendor-groups.md), [131-purchase-price-lists.md](./done/131-purchase-price-lists.md), [132-topbar-widget-tray-and-unified-settings.md](./done/132-topbar-widget-tray-and-unified-settings.md), [133-fix-designer-wizard-fields.md](./done/133-fix-designer-wizard-fields.md), [134-forms-management-page-polish.md](./done/134-forms-management-page-polish.md), [135a-field-library-phase-a.md](./done/135a-field-library-phase-a.md), [135b-field-library-phase-b.md](./done/135b-field-library-phase-b.md), [135c-field-library-phase-c1.md](./done/135c-field-library-phase-c1.md), [135d-field-library-phase-c2.md](./done/135d-field-library-phase-c2.md), [136-sidebar-form-grouping-policy.md](./done/136-sidebar-form-grouping-policy.md), [138-forms-visual-fixes.md](./done/138-forms-visual-fixes.md), [139-vertical-stepper-wizard.md](./done/139-vertical-stepper-wizard.md), [140-visual-layout-overflow-fixes.md](./done/140-visual-layout-overflow-fixes.md), [143-settings-taxonomy-foundation.md](./done/143-settings-taxonomy-foundation.md), [144-invoice-list-standardization.md](./done/144-invoice-list-standardization.md), [145-voucher-and-item-list-standardization.md](./done/145-voucher-and-item-list-standardization.md), [146-raw-date-input-cleanup.md](./done/146-raw-date-input-cleanup.md), [132-ui-ux-fixes-completion-report.md](./done/132-ui-ux-fixes-completion-report.md), [148-shared-selectors-enforcement.md](./done/148-shared-selectors-enforcement.md), [149-coa-ui-update.md](./done/149-coa-ui-update.md), [150-sales-invoice-page-refinement.md](./done/150-sales-invoice-page-refinement.md), [151-purchase-direct-invoicing-governance.md](./done/151-purchase-direct-invoicing-governance.md), [153-ai-floating-assistant-launcher-toggle.md](./done/153-ai-floating-assistant-launcher-toggle.md), [154-unify-mdi-windows.md](./done/154-unify-mdi-windows.md), [155-posting-authority-decoupling.md](./done/155-posting-authority-decoupling.md), [156-period-lock-unification.md](./done/156-period-lock-unification.md), [157-decouple-reporting-boundary.md](./done/157-decouple-reporting-boundary.md), [158-stage-2c-retire-per-module-approval-flag.md](./done/158-stage-2c-retire-per-module-approval-flag.md), [159-stage-4-posting-gateway.md](./done/159-stage-4-posting-gateway.md), [160-stage-5-uniform-rejection-contract.md](./done/160-stage-5-uniform-rejection-contract.md), [161-stage-6-7-vocabulary-and-future-hooks.md](./done/161-stage-6-7-vocabulary-and-future-hooks.md), [163-apex-ledger-mockup-isolated-preview.md](./done/163-apex-ledger-mockup-isolated-preview.md), [163-apex-ledger-mockup-integration.md](./done/163-apex-ledger-mockup-integration.md), [164-apex-ledger-routing-and-voucher-parity.md](./done/164-apex-ledger-routing-and-voucher-parity.md), [165-apex-ledger-full-sidebar-module-parity.md](./done/165-apex-ledger-full-sidebar-module-parity.md), [166-compact-layout-mode.md](./done/166-compact-layout-mode.md), [167-apex-shell-production-candidate-slice-1.md](./done/167-apex-shell-production-candidate-slice-1.md), [168-apex-shell-route-coverage-and-qa.md](./done/168-apex-shell-route-coverage-and-qa.md), [170-apex-route-sidebar-adapter.md](./done/170-apex-route-sidebar-adapter.md), [171-apex-sales-native-page-mounting.md](./done/171-apex-sales-native-page-mounting.md), [172-priceisinclusive-sweep-and-sod-hardening.md](./done/172-priceisinclusive-sweep-and-sod-hardening.md), [173-apex-shell-prototype-scale-restoration.md](./done/173-apex-shell-prototype-scale-restoration.md), [174-apex-company-settings-sidebar-parity.md](./done/174-apex-company-settings-sidebar-parity.md), [217-list-pages-premium-ui-enhancements.md](./done/217-list-pages-premium-ui-enhancements.md).

**Additional Apex/UI reports (2026-06-05/08/09):** [175-apex-shell-rtl-flyout-positioning.md](./done/175-apex-shell-rtl-flyout-positioning.md), [176-apex-prototype-typography-restoration.md](./done/176-apex-prototype-typography-restoration.md), [177-apex-purchases-inventory-native-page-mounting.md](./done/177-apex-purchases-inventory-native-page-mounting.md), [178-apex-settings-rbac-ai-native-page-mounting.md](./done/178-apex-settings-rbac-ai-native-page-mounting.md), [179-apex-route-coverage-gap-audit.md](./done/179-apex-route-coverage-gap-audit.md), [186-operational-lists-standardization.md](./done/186-operational-lists-standardization.md), [187-sales-invoice-responsive-window-layout.md](./done/187-sales-invoice-responsive-window-layout.md), [188-sales-invoice-allocation-grid-mock-cleanup.md](./done/188-sales-invoice-allocation-grid-mock-cleanup.md), [189-sales-invoice-sticky-footer-totals.md](./done/189-sales-invoice-sticky-footer-totals.md), [191-sales-purchases-document-ui-parity.md](./done/191-sales-purchases-document-ui-parity.md), [195-native-invoice-reference-labels.md](./done/195-native-invoice-reference-labels.md), [199-sales-return-source-control-parity.md](./done/199-sales-return-source-control-parity.md), [200-native-document-table-and-section-parity.md](./done/200-native-document-table-and-section-parity.md). **Note:** Apex cutover is no longer current strategy; these are historical candidate-shell reports only.

**Latest shared table polish report (2026-06-10):** [203-shared-line-table-uom-and-settings.md](./done/203-shared-line-table-uom-and-settings.md).

**Latest line-table feature sweep + line discount (2026-06-11):** [204-line-table-feature-sweep-and-purchase-line-discount.md](./done/204-line-table-feature-sweep-and-purchase-line-discount.md).

**Latest discount display fix (2026-06-12):** [205-discount-type-currency-label.md](./done/205-discount-type-currency-label.md). Shared line discount type selectors now show the active document currency code (for example `SYP`) for amount discounts instead of a hardcoded `$`. Frontend typecheck passed.

**Latest shared selector contract hardening (2026-06-12):** [206-shared-selector-contract-hardening.md](./done/206-shared-selector-contract-hardening.md). Item/Party/Warehouse/UOM/Account/Tax/Discount/Currency selector keyboard and modal focus behavior were standardized; Item/Party/Warehouse `+` now opens native master cards; `CurrencySelector` is exported through shared selectors; `AccountSelectorSimple` now wraps the rich `AccountSelector`; Receipt Voucher and Sales Invoice recurring dates were fixed. Frontend typecheck passed.

**Latest native document New-form guard (2026-06-12):** [207-native-document-new-form-guard.md](./done/207-native-document-new-form-guard.md). `DocumentDetailScaffold` now owns the standard top-tray New document action and shared confirmation modal. Scaffold-backed SI/SO/DN/SR/PI/PO/GRN and saved/edit PR pass page-specific dirty checks so the warning appears only when actual entered data would be lost. Frontend typecheck passed. **Boundary:** Quotation and Purchase Return create remain page-local scaffold outliers; move them onto the scaffold before adding New-button behavior there.


**Deferred to v2 (preserved as roadmap, no code removed):** [tasks/native-to-default-forms-migration.md](./tasks/native-to-default-forms-migration.md), [tasks/137-si-direct-capability-audit.md](./tasks/137-si-direct-capability-audit.md).

**Deferred backlog (owner-confirmed 2026-06-13):** [tasks/223-inventory-revaluation-value-only-correction.md](./tasks/223-inventory-revaluation-value-only-correction.md) — add an **Inventory Revaluation** document to correct a wrong average cost (value-only, quantity unchanged), posting the delta to GL so the sub-ledger stays tied. Identified during GP02 GLOBAL QA: item `001`'s value drift (stock 12,773 vs GL ~0) has no in-app fix today. The costing engine itself is correct; this only adds a correction path.

**Deferred backlog (owner-requested 2026-06-12):** [tasks/per-item-promotions-from-item-card.md](./tasks/per-item-promotions-from-item-card.md) — manage promotions from the **Item Card** (per-item) in addition to the existing system-wide Promotions page; both write to the same promotion-rule store. Logged during Task 204 line-discount QA, alongside discovering that the "ghost line" was a free-goods promotion (now badged `FREE • PROMO`).

**Post-pilot strategic plan (owner-requested 2026-06-13):** [tasks/222-desktop-offline-lan-architecture.md](./tasks/222-desktop-offline-lan-architecture.md) documents the future Desktop / Office Server / Local on This PC architecture. Key decision: Local on This PC is private by default; multi-device local use requires explicit Office Server / LAN promotion with backups, license, device approval, and local authority controls. Architecture docs: [deployment-modes](../docs/architecture/deployment-modes.md), [desktop-shell](../docs/architecture/desktop-shell.md), [local-authority-and-migration](../docs/architecture/local-authority-and-migration.md). User guide: [deployment mode](../docs/user-guide/settings/deployment-mode.md). **Implementation is post-pilot only.**

## 👉 Next agent — start here

**ALL GOLDEN PATHS RUN on one clean tenant (`GP01 Trading Co`, cmp_mqg8ta2c_24c21c) — 2026-06-17. Result: GP01 ✅ (19/19) · GP02 ✅ (12/12) · GP03 ✅ (17/17) · GP04 ✅ (14/14) · GP05 🔶 9/10.** The single blocker to declaring **"golden paths green"** is **GP05 step 4 (inventory reconciliation)**: Inventory GL **1,277.5** vs valuation **1,300**, drift **22.5** — entirely the **known backlog-223** invoice-driven cost-basis gap (GP04's PI debits inventory net of the 5% line discount while stock carries gross avg cost). Reconciliation was perfect through GP02→GP03; only the discounted PI introduced it. Every voucher balances; TB 4950→ (now ~5250 after GP01 control-test JVs); Balance Sheet balanced; AR −27 and AP −47.5 all tie (aging = statement = control); GRNI 0; posting-log + audit-trail + idempotency (no dup) all pass. Full per-step logs in [qa/findings.md](./qa/findings.md) (GP03/GP04/GP05/GP01-12-16 blocks, all 2026-06-17). **This run was autonomous + API-driven** (owner away; documents created via authenticated REST against the Functions emulator, verified in Firestore — the inline line/party selectors resist browser automation).

**To declare golden-paths-green (gates Phase 2 / deploy):** fix or formally accept **backlog 223** (invoice-driven line-discount inventory cost basis) so GP05 step 4 reconciles, then re-run GP05 step 4. Nothing else blocks.

**Bugs found this run (no posting/correctness failures — all books balanced):**
1. **Recurring error-taxonomy bug** — several business-rule rejections return **HTTP 500 / `INFRA_999` "critical"** instead of 4xx: quote lifecycle (DRAFT→accept/convert), over-payment guard, re-submit-pending voucher, idempotent re-post ("Invalid sales invoice state"). Inconsistent: period-lock + approval-required + SI validator correctly return 400. **A fix task was spawned** (task_93b9e9f6). Broaden it to cover the voucher submit/re-post + over-payment cases.
2. Customer/warehouse lists don't auto-refresh after create.
3. API-created manual JVs use `journal_entry-000X` numbering instead of the `JOU-` series.

**Accounting-mapping observations for owner review** (balanced, but presentation): sales discounts → "Sales & Marketing" expense (not contra-revenue) with gross revenue; sales Freight charge → Sales Revenue; purchase Freight → expensed to "Purchases" (not capitalized into inventory cost); over-payment held as negative AR (not a customer-advances liability); SI books line discount gross while SR books it net.

**Tenant state left behind:** Sales workflow = **OPERATIONAL** (couldn't revert to SIMPLE — posted DN-00001 blocks it); Purchases workflow = **OPERATIONAL** (switched for GP04); approval + period lock turned **off**; temporary direct-persona governance rule removed. Data: CUST-1 (AR −27), VEND-1 (AP −47.5), ITEM-A 130 units (MAIN 95 + WH-2 35), plus GP01 control-test JVs. **GP04 ran via OPERATIONAL too — if a SIMPLE-mode purchase pass is wanted, it needs a clean tenant.**

**Next options:** (a) fix/accept backlog 223 → re-check GP05 step 4 → declare golden-paths-green; (b) fix the error-taxonomy bug (task spawned); (c) address the GP02/GP03 display/UX findings. The historical GP01-04 detail blocks below are superseded by this run.

**GP03 (Sales) — 2026-06-17: COMPLETE on the clean `GP01 Trading Co` tenant. ALL 17 STEPS PASS.** Ran the full order-to-cash golden path (cmp_mqg8ta2c_24c21c; SYP / FLEXIBLE). Per owner's choice, documents were created via authenticated REST against the running Functions emulator and verified directly in Firestore (the inline line/party selectors resist browser automation). Covered: CUST-1 + auto AR sub-account `10401-CUST-1`; Quote QT-00001→SO-00001 (confirm, credit check)→DN-00001 (stock −10, COGS deferred)→SI-00001 (10×15, 10% line discount → 135, +Freight 50 −Discount 20 → **165**, CASH-full settle → POSTED+PAID, invoice + receipt RV-0001 + COGS voucher, all balanced); over-payment SI-00002 (settle 1500 → 500 credit; flag-off rejected); pay-later SI-00003 (credit → Record Payment 500 → PARTIALLY_PAID); return SR-00001 (2 units, net 27, stock +2, revenue+COGS reversal). **Books tie:** Inventory GL 950→850 = physical 85×10; CUST-1 statement = AR aging = **−27**; **Trial Balance balanced 4,950 = 4,950**. Full per-step log in [qa/findings.md](./qa/findings.md) (GP03 2026-06-17 block). **No posting/correctness bugs.** Findings to fix: (1) **recurring error-taxonomy bug** — business-rule rejections (quote lifecycle, over-payment) return HTTP 500 / `INFRA_999` "critical" instead of a 4xx domain error; (2) customer list no auto-refresh after create. Accounting-mapping observations for owner review: sales discounts post to **"Sales & Marketing" expense** (not a contra-revenue Sales Discounts account) with gross revenue; invoice Freight charge credited to **Sales Revenue**; over-payment held as **negative AR** (not a customer-advances liability); SI books discount gross while SR books it net. **Workflow/governance note:** OPERATIONAL mode blocks `direct` persona **by design** (base policy SIMPLE={direct,service} / OPERATIONAL={linked,service}; `allowDirectInvoicing` no longer overrides OPERATIONAL). Section B needs OPERATIONAL, Section C needs direct — the script implicitly needs a mode switch; used a temporary allow/direct governance rule for Section C (removed after). **Tenant left in OPERATIONAL** (could not revert to SIMPLE — posted DN-00001 blocks the switch). **Next: GP04 (Purchases) — already passed 2026-06-14 on TESTCO; rerun on this clean tenant — then GP05 cross-module books check.** (GP01 steps 12–16 + the GP02/GP03 display/UX findings + the error-taxonomy bug also remain.)

**GP02 (Inventory) — 2026-06-16: COMPLETE on fresh tenant. ALL 12 STEPS PASS.** Ran the full Inventory golden path on the clean `GP01 Trading Co` tenant (cmp_mqg8ta2c_24c21c; SYP / FLEXIBLE; GLOBAL costing, negative stock OFF, invoice-driven). Verified every step directly against the Firestore emulator (paths: `companies/{cid}/inventory/Data/{items,warehouses,stock_levels,stock_movements}`, `companies/{cid}/accounting/Data/{accounts,ledger,vouchers}`; owner account `qa-gp01-20260616a@test.local` / `Test1234!`). Highlights: opening stock Dr Inventory/Cr Opening Balance Equity 1,000; transfer no-GL (GLOBAL same-cost); damage adjustment Dr Loss/Cr Inventory 50; **negative-stock guard proven both at UI (adjustment NEW QTY clamps ≥0) and engine (transfer rejects oversized OUT)**; valuation qty 95 / value 950; **Trial Balance: Inventory GL 950 = valuation, TB balanced (Dr 3,550 = Cr 3,550)**. Full per-step log in [qa/findings.md](./qa/findings.md) (GP02 2026-06-16 block). **No posting/costing bugs — 5 display/UX findings only:** (1) recent-adjustments list shows raw warehouse UUID + lacks item/qty/direction columns; (2) negative-stock error prints raw item/warehouse UUIDs; (3) "NEW QTY" adjustment column mistakable for a delta — clearer labelling; (4) SRV-1 quick-add defaults currency USD not base SYP; (5) warehouse list no auto-refresh after create. **Owner-driven QA pattern: owner typed line cells on :5173 (inline item selector resists automation); Claude verified via emulator.** Note: GP02 left an extra (canceling) −75/+75 adjustment pair on ITEM-A from a data-entry detour — books net correct (only the legit 50 damage remains). **Next: fix the GP02 display/UX findings, then GP03 (Sales) on this same clean tenant** (GP01 steps 12–16 also still pending owner-typed vouchers).

**GP02 step 9 negative-stock default hardening — 2026-06-14:** Owner fresh-company QA showed stock level qty `-1` even though Inventory Settings visibly had **Allow Negative Stock** unchecked. Code audit found the movement engine correctly blocks when persisted `allowNegativeStock=false`, but new inventory setup/domain/controller defaults were permissive (`true`) and the settings page hid the local section save button, so an unchecked UI state could be mistaken for saved policy. Fix applied: new/hydrated `InventorySettings`, inventory initialization, updateSettings fallback, and the frontend initialization wizard now default to `allowNegativeStock=false`; Inventory Settings sections show their **Save Settings** button. Verification passed: focused negative-stock/default backend tests, backend build, frontend typecheck, and frontend production build. **Next:** restart/hard refresh the running app and rerun GP02 step 9 on the fresh company. If the existing test row already reached `-1`, correct/recreate the test item before judging the retest.

**Account Statement voucher mapping fix — 2026-06-14:** Account Statement report showed raw UUIDs in the VOUCHER column instead of human-readable numbers (e.g., `JV-00001`). Root cause: `FirestoreLedgerRepository.recordForVoucher` wrote `voucherId` but never `voucherNo` to the ledger document. Fix: (1) `voucherNo` is now written to every new ledger entry; (2) `getAccountStatement` batch-fetches voucher documents for any legacy entries without `voucherNo` and back-fills the readable number — no data migration needed. Backend build (`tsc`) green. File changed: `backend/src/infrastructure/firestore/repositories/accounting/FirestoreLedgerRepository.ts`.


**GP01 step 11 period-lock UX + ledger one-door guard — 2026-06-14: PASSED after owner live retest.** Fresh-tenant GP01 rerun found correct accounting behavior but bad UX: posting a last-week JV after locking through yesterday was blocked, but the modal showed only `Request failed with status code 400`. Root cause was `VoucherEntryModal` using Axios `err.message` instead of the structured backend `PERIOD_LOCKED` payload, plus the web-mode Vouchers page preserving the same closed modal instance so old error state could reappear when opening a new voucher. Fix: modal errors now use `errorHandler.normalizeError` + `translateError`; shared `errorHandler.normalizeError` now unwraps Axios backend envelopes before using Axios' generic message; `VoucherEntryModal` resets transient state on each open session; and `VouchersListPage` keys the web-mode modal by voucher type plus voucher id/new state. Backend architecture fix: there is now exactly one production path to ledger mutation, `PostingGateway`. Posted-voucher edit/resync, posted cancel/delete cleanup, subledger voucher cleanup, and bank-reconciliation marking all route through gateway-owned methods; `PostingAuthority.test.ts` fails if future production code calls `ILedgerRepository.recordForVoucher`, `deleteForVoucher`, or `markReconciled` outside the gateway. Frontend typecheck + production build passed; backend full suite passed (150 suites passed / 2 skipped; 1,392 tests passed / 18 skipped) and backend build passed. Owner confirmed GP01 passed live after the frontend hard refresh/retest. **Next:** package this GP01 control-boundary fix set for review/merge, then continue the next golden-path gate on a clean tenant.

**GP05 (Cross-module books check) — 2026-06-14: BLOCKED / NOT GREEN on current TESTCO.** Trial Balance passes (Dr 19,498.01 = Cr 19,498.01), Balance Sheet equation passes, AR ties at 328.00, AP ties to the vendor debit-note position (ledger Dr 47.50 = statement/aging -47.50), GRNI is zero, and SI-00001 posting log/audit trail exist. **Blocking failures:** P&L is distorted because old Opening Stock vouchers credited COGS (50100 credit balance -164.97), and Inventory GL reconciliation fails badly: stock valuation 13,887.43 vs Inventory GL 592.47 (drift 13,294.96). Root causes in TESTCO data: legacy item `001` stock value 12,773.36 with no matching GL, old opening-stock offset selections to COGS / inventory, and pre-fix duplicate PI-00001 receipt residue. **Code guard fixed in this session:** Opening Stock with accounting effect now requires an EQUITY offset account and rejects using the same Inventory Asset account as the offset; focused opening-stock tests, full backend inventory test slice, and backend build passed. **Next:** do not declare golden paths green. Either rerun GP01-GP05 on a fresh tenant after PR #9 + this guard, or approve a controlled TESTCO data repair/revaluation plan. Further UI polish remains frozen.

**Users Sidebar Icon & Homepage Icon Alignment — 2026-06-14:** Updated Users sidebar icon from `'User'` to `'Users'`. Aligned module homepage header icons for Sales (`TrendingUp`), Purchases (`ClipboardList`), Inventory (`Warehouse`), and Accounting (`Landmark`) with their respective sidebar icons, elevating Purchases and Inventory headers to the premium Sales Overview styling standard. Frontend typecheck (`npx tsc --noEmit`) and production build (`npm run build`) verified green.

**GP04 (Purchases) — 2026-06-14: COMPLETE. Steps 1–14 effectively GREEN (step 13 failed then fixed+verified live).** Reports tie out at −47.50: Vendor Statement VEND-1 (BILL PI-00001 495 → PAYMENT PV-0001 495 → DEBIT_NOTE PR-00001 47.50) closing −47.50 = AP Aging −47.50 (unallocated debit note, aging buckets 0) = Trial Balance AP sub-account 20100-VEND-1 −47.50; TB balanced 2616.97=2616.97. **Step 13 bug (PI double-receipt), FIXED:** the *linked* PI re-received 50 units the GRN already received (ITEM-A read 103, true 53) because a PI built from a PO carries `poLineId` but not `grnLineId` (`toEditableLinesFromPurchaseOrder`, PurchaseInvoiceDetailPage.tsx:355) and the posting gate keyed only on `grnLineId`. **Fix:** new `goodsAlreadyReceived(line, po)` = `hasGRNForThisLine(line) || poLine.receivedQty > 0`, used in the three receipt gates + `hasReceiptBackedFlow` (PurchaseInvoiceUseCases.ts). Mode-safe — `clearsGRNI` keys on PERPETUAL, so invoice-driven tenants keep Dr Inventory / Cr AP (value single-counted) and just drop the duplicate qty; PERPETUAL now clears GRNI instead of double-debiting inventory. Regression test 7b; 17/17 posting + 74/74 purchases green; backend rebuilt (lib/). **Live-proven:** fresh PO-00002→GRN-00002→PI-00002 (from PO, no grnLineId) posted with NO second receipt (count stayed 3), then unposted to restore state. **Out of scope (logged):** invoice-driven cost-basis drift (backlog 223) — quantity now correct, only per-unit cost differs by the discount. Detail in [qa/findings.md](./qa/findings.md) GP04-step11..14 + step13-fix. **Next: GP05 cross-module books check (revisit backlog 223 there).** Tenant residue: PO-00002 + DRAFT GRN-00002/PI-00002 (zero posted effect).

**(history) GP04 steps 1–10 PASS (live).** On TESTCO. **Step 9** (record vendor payment) surfaced the **Purchases Record-Payment AP-resolution bug** (same class as GP03-step13a, fixed on Sales but never mirrored): Record Payment 500'd `receivablePayableAccountId is required` because the path never resolved the vendor's own AP sub-account. Fixed+verified live+regression — PI-00001 PAID, PV-0001 linked, Vendor Statement closing 0.00. **Step 10** (Purchase Return of 5) surfaced **3 more bugs, all fixed+verified live**: (a) return fetch didn't inherit the PI unit price (`unitPriceDoc`→`unitCostDoc` map gap → AP would post at 0); (b) the return **dropped the line discount from the GL** (voucher 50/50 gross vs doc net 47.50 — same class as PI/SR), fixed in the recompute + `recalcReturnTotals`; (c) **return unpost** had the same txn read/write ordering blocker as the PI unpost, fixed by mirroring the split. After unpost+repost: voucher Dr AP 47.50 / Cr Inventory 47.50 balanced, stock 108→103. Files: purchases `PaymentSyncUseCases.ts`, `PurchaseController.ts`, `PurchaseReturnUseCases.ts`, `PurchaseReturnDetailPage.tsx`, + 2 test files; backend rebuilt (lib/); 73/73 purchases tests green. **Open observation:** return credits GL inventory at net price while stock leaves at avg cost → GL-vs-stock drift (invoice-driven GRN-gross-vs-PI-net; backlog 223; revisit GP05). **Next: GP04 steps 11–14** (Vendor Statement full → AP Aging → Stock Levels/Movements → Trial Balance), then GP05.
**Visual UI detours fixed — 2026-06-14:** Fixed the `((soLabel))` subtitle placeholder bug, applied correct horizontal padding/spacing to read-only items tables (Delivery Note, Goods Receipt, Sales Order, Sales Return), created a unified themed `<Spinner />` component in `frontend/src/components/ui/Spinner.tsx` (using Option A - Smooth Gradient Sweep as chosen by the developer), replaced all remaining custom border loaders and Lucide `Loader2` direct spinners (including button loaders and global overlay screen loaders) across the application, and fixed the side-rail toggle (collapse) button being half-shown (clipped by overflow-hidden on the aside element) by wrapping the aside in a relative flexbox div container in `DocumentDetailScaffold.tsx`. Both backend and frontend changes are **uncommitted** on branch `fix/purchases-module-gp04` (typecheck and build verified green). Cosmetic follow-up: PI posted-view allocation grid shows "no rows" though charges (freight 30 / disc 10) are intact in the data. Detail in [qa/findings.md](./qa/findings.md).

**Golden-path QA status (2026-06-13):** GP01 ✅ · GP02 ✅ (inventory GLOBAL costing merged, [PR #7](https://github.com/mahmudadem/ERP03/pull/7)) · **GP03 (Sales) ✅ — all 17 steps pass** ([PR #8](https://github.com/mahmudadem/ERP03/pull/8), CI green): full SO→DN→Invoice→COGS→Receipt→Return + over-payment + partial pay-later posts balanced GL with GLOBAL-costed COGS. GP03 found 12 bugs (7 fixed in PR #8, 5 logged) — see [qa/findings.md](./qa/findings.md). **Next: GP04 (Purchases), then GP05 (cross-module books check).** Follow-ups: the empty-trailing-row save-validation bug likely also affects DN/SI/SR/PO/PI/PR pages; plus the 5 logged GP03 bugs (notably the misleading "Allow Direct Invoicing" toggle and the Simple-switch DN guard). Drive GP04 the same way: Claude drives the browser + verifies GL, owner types line items (the line-table cells resist automation).


**Inventory Deep Stabilization (Task 221) — big slice landed 2026-06-13; GLOBAL engine added same day.** Owner
reframed GP02: inventory was built but never tested. Deep scan → epic [tasks/221-inventory-deep-stabilization-epic.md](./tasks/221-inventory-deep-stabilization-epic.md).
**Done + verified (backend `lib/` built; full suite 150 suites / 1380 tests green; frontend tsc + build green):**
Slice 1 adjustment money path (GL valued from real movement cost + dedicated Gain/Loss accounts), Slice 3
Stock Transfer FLAT/VALUED modes (valued uplift → Inventory Transfer Clearing), Slice 4 item Sale/Purchase
price + By-Item stock rollup, Slice 5 UI rebuilds (Adjustment/Transfer/Stock-Levels on the shared line table),
GL↔stock reconciliation report, **and the GLOBAL costing engine** — `RecordStockMovementUseCase` now branches on
`InventorySettings.costingBasis`: GLOBAL keeps one company-wide moving average per item (every warehouse issues
at the same cost; a receipt re-prices all locations), gated so WAREHOUSE (default) is byte-for-byte unchanged.
New `IStockLevelRepository.getLevelsByItemInTransaction`; 7 new engine tests (`GlobalCostingEngine.test.ts`).
Both costing engines are live and selectable in Inventory Settings → Accounting. **Not committed — owner will
retest first** (emulator pass on GLOBAL especially). **Open follow-ups:** (1) flip `allowNegativeStock` default
after pilot decision; (2) stock-reservation wire-or-hide. Owner manual-QA script in the epic file.

**Codex GP02 emulator retest (2026-06-13) — mostly passed, with one ledger-contract detour fixed.** Using local TESTCO (`cmp_mqblxfqy_zmecyl`) and QA suffix `130818`, GLOBAL costing produced one company-wide moving average across warehouses: 10 @ 5 in MAIN + 10 @ 7 in G2 repriced both warehouses to avg 6; later 10 @ 12 repriced both to avg 8.22. Stock Adjustment OUT posted at engine cost 6 despite typed cost 999, negative stock was blocked with `NEGATIVE_STOCK_BLOCKED`, FLAT transfer posted no GL, and VALUED transfer posted only the uplift to Inventory/Transfer Clearing. **Detour fixed:** Stock Adjustment and Valued Transfer voucher lines were missing required V2 fields `amount`, `currency`, and `exchangeRate`; fixed in `StockAdjustmentUseCases.ts` and `StockTransferUseCases.ts`, with tests added/updated. **Verified:** targeted inventory valuation tests passed, backend build passed, full backend Jest passed via `npx jest --maxWorkers=2` from `backend/` (150 suites passed, 2 skipped; 1,380 tests passed, 18 skipped). **Still not a clean ship gate:** reused TESTCO has old pre-fix stock/ledger drift, so whole-tenant Inventory GL Reconciliation is still false (stock 13,119.35 vs GL 346). Next gate: rerun GP02 on a fresh tenant or clean old drift before marking reconciliation passed. Estimated next QA time: 20-30 minutes.

**Icons Comparison Sandbox Page — READY (2026-06-13).** Created an interactive comparison sandbox at `/#/dev/icons-comparison` to preview sidebar/module icon configuration presets side-by-side. Set 6 now features custom colored trend clipboards (green for Sales, red for Purchases) and an enhanced 3D-rotated TwoGears mechanical layout. Includes a live sidebar simulator and JSON code exporter.

**Main Shell Font + Accordion Sidebar Visual Pivot — DONE (2026-06-13, report 218).** Owner stopped Apex cutover work. Main shell now applies `JetBrains Mono` to mono/numeric/code surfaces through the global font token, and main-shell accordion mode borrows the Apex sidebar visual treatment while preserving existing behavior, permissions, routes, workflow hiding, tenant/module filtering, and flyout mode. Frontend typecheck + production build passed. Report: [done/218-main-shell-font-and-sidebar-pivot.md](./done/218-main-shell-font-and-sidebar-pivot.md).

**List Pages Premium UI/UX Enhancements — DONE (2026-06-13, report 217).** Standardized all Sales and Purchase list views to use premium, glassy status and payment badges with inset borders and theme-harmonious colors. Right-aligned the Grand Total column in Sales Invoices. Implemented dynamic coordinate-based React Portal rendering for `DatePicker` inline calendars to eliminate the filter bar's "bouncing" behavior and horizontal flex-row layout vertical scrollbars. Standardized all 9 primary list pages to use the high-density horizontal scrolling single-row filters layout. Report: [done/217-list-pages-premium-ui-enhancements.md](./done/217-list-pages-premium-ui-enhancements.md).

**Sales Dashboard Header Actions — DONE (2026-06-12, report 216).** Added localized "+ Create Sales Order", "+ Create Invoice", "+ Create Sales Return", and "Settings" buttons in the Sales module overview dashboard page header, styled with Plus/Settings icons and fully translated across English, Arabic, and Turkish. Frontend typecheck + production build green. Report: [done/216-sales-dashboard-header-actions.md](./done/216-sales-dashboard-header-actions.md).

**Allocation grid polish + shared charges component — DONE (2026-06-12, report 215).** Three owner-delegated follow-ups from the SI/PI charges work: (1) the allocation grid's **GL Account** column showed raw account ids for charge rows loaded from the server — both SI and PI now resolve the id to `CODE — Name` via `useAccounts().getAccountById`; (2) **row colors** in `ClassicLineItemsTable` are now in-memory/document-specific (like highlights) instead of persisted per-`tableId`, so they no longer bleed across every document of a type (reverses the Task 201/214 decision per owner request); (3) extracted the ~400 duplicated lines of allocation grid + charge/discount modal into the shared, purely-presentational `components/shared/DocumentChargesAllocation.tsx` (`DocumentChargesAllocation` + `DocumentChargeModal`). **Accounting boundary:** UI only — charge state, totals math, and posting payloads unchanged. Frontend typecheck + production build green. Report: [done/215-allocation-grid-gl-display-rowcolor-shared-component.md](./done/215-allocation-grid-gl-display-rowcolor-shared-component.md). **Manual QA needed (owner pass):** GL name on reopen, row-color isolation across documents, SI/PI charge add/edit/remove parity + balanced GL.

**Sales Hub Page Redesign & Reorganization — DONE (2026-06-12, report 213).** Refactored the Sales module overview dashboard into a high-density, performant, and visual split-layout overview module. Organized the workspace below the KPIs into a split left/right layout containing separate Sales Orders (SO) and Sales Invoices (INV) tables (with Number, Date, Customer, Currency, Raw Total, Created By, Created At, Approved At, and Status columns). Styled text-focused KPI cards with base currency suffixes, left border HSL accents, and status dots. Sidebar contains Quick Navigation, compact Recent Activity log widget, and card-style Top Client Accounts with progress lines. Ran tsc and build successfully with 0 errors. Report: [done/213-sales-hub-redesign.md](./done/213-sales-hub-redesign.md).

**Jest `uuid` ESM shim — DONE (2026-06-12, report 211).** `uuid@14` is ESM-only; ts-jest's CJS runtime
couldn't parse it, silently breaking every suite that imported a uuid-using file (e.g. RecurringInvoice's
23 tests never ran). Added `backend/src/tests/shims/uuidShim.ts` + `moduleNameMapper` in `jest.config.js`.
**Full backend suite now green: 146 suites, 1365 tests, 0 failures.** Report:
[done/211-jest-uuid-esm-shim-test-infra.md](./done/211-jest-uuid-esm-shim-test-infra.md).

**Purchase Invoice Charges & Discounts — DONE (2026-06-12, report 210). PI now matches SI.** Mirrored the
SI allocation-grid charges/discounts onto Purchase Invoice full-stack. PI gained the whole `charges[]`
concept (domain/DTO/validator/use-cases) plus the UI (Add Charge/Add Discount modal + grid). GL sides are
flipped for purchases: **CHARGE debits** its account (default purchase-expense; freight/landed cost),
**DISCOUNT credits** its account; AP nets both so the voucher balances (test `6b`). Backend + frontend
typecheck, frontend build, and `jest PurchasePostingUseCases` (15/15) green; browser-verified on
`/purchases/invoices/new`. Report: [done/210-purchase-invoice-charges-discounts-parity.md](./done/210-purchase-invoice-charges-discounts-parity.md).
**Optional follow-up:** a dedicated "Purchase Discounts Received" settings account (today discounts credit
the purchase-expense account, net method).

**Sales Invoice whole-invoice Charges & Discounts — DONE (2026-06-12, report 209).** The allocation
grid is now functional: **Add Charge** / **Add Discount** buttons open one modal (GL account defaulted
from settings, amount, description); saved rows show in the grid and feed the totals. `SalesInvoiceCharge`
gained `kind: CHARGE | DISCOUNT` — charges credit their account (default revenue) and add to the total;
discounts debit the Sales Discount account (`defaultSalesExpenseAccountId`) and subtract. Flat & tax-free
by owner decision (no line-VAT re-proration). Posting reuses the existing `chargeCredits`/`discountDebits`
buckets so the voucher balances automatically (proven by new test `10d`). Backend+frontend typecheck,
frontend build, and `jest SalesPostingUseCases` (23/23) all green. Report:
[done/209-sales-invoice-charges-discounts-allocation-grid.md](./done/209-sales-invoice-charges-discounts-allocation-grid.md).
QA script in [QA-QUEUE.md](./QA-QUEUE.md). **Next: mirror this onto Purchase Invoice** (PI has no charges
at all today — full-stack work).

**Sales Invoice Layout, Fonts, and Translation Fixes (2026-06-12).** Completed font fallbacks (Cairo fallback for Arabic system/mono), swapped Currency and Exchange Rate order in RTL mode, cleaned up duplicate selectors/widgets/locales, added footer "New" button with dirty confirmation check, translated sidebar tooltips/title, and resolved Turkish question marks encoding. Doc updates at docs/architecture/sales.md, docs/user-guide/sales/exchange-rate-and-new-button.md, and done report at 208-sales-invoice-translation-and-layout-fixes.md. Frontend build and typecheck green.

**Sidebar full translation sweep completed (2026-06-12).** All static sidebar menu labels are now fully translated in Arabic, Turkish, and English. Root causes: (1) `"Products & Services"` was never in `labelKeyMap` — it always rendered in English; (2) `"Tools"` group was mapped to `sidebar.tools` but that key was missing from all locale files; (3) ~30 more labels (all Sales, Purchases, and Inventory sub-items) were in the map but missing keys in some locales. Fixed in: `useSidebarConfig.ts` (added `productsAndServices`, `formsManagement`, `'UI Lab 🎨'`, Goods Receipts, Purchase Invoices/Returns, AP/AR Aging, Vendor/Customer Statement, Analytics, Groups, Opening Stock, Adjustments, Transfers, Stock Levels, Movements, Low Stock Alerts, Unsettled Costs, Inventory Valuation, Categories, UOM Master), plus `tools`, `home`, `search`, `uiLab` added to en/ar/tr locale files. Frontend typecheck green (zero errors). **Remaining untranslatable:** dynamic form names (e.g. "Sales Invoice (Direct) - Copy") come from Firestore `form.name` — need `nameAr`/`nameTr` DB fields as a separate feature (v2).

**Next Priority:** Continue **Task 132 main-shell chrome polish** from the production shell. Do not continue Apex feature-flag/cutover work unless the owner explicitly reopens it.


**Line table feature sweep + purchase/SO/SR line discount completed (2026-06-11, Task 204).** Shared `ClassicLineItemsTable` gained Enter-key cell navigation (with scroll-into-view), min-2-decimal numeric display with extra precision preserved, blank-on-zero, auto-select-on-focus, an editable `solveFromTotal` computed-cell API, settings-modal column reorder + table font + alternating row colors, JetBrains Mono wiring, and chrome cleanups (trash column removed, row colors switched to inline RGBA). Per-page parity: new typable `TaxCodeSelector` (with empty-state setup-link CTA) and `DiscountTypeSelector` (combobox + modal fallback) replace native `<select>` across SI/SO/Quotation/PI/PO; both are auto-disabled on rows without an item. Item-clear now resets the whole row; default qty is `0`; SI rail Totals enlarged and shows Subtotal/Discount/Tax/Grand Total (always with Grand Total Base); operational-workflow banner became a header icon-button → modal. **Vertical-slice line discount added to PI/PO/PR (purchases were missing it) and to SO/SR (sales side mirror).** Domain entities apply discount **before tax** so the taxable base is post-discount (EU VAT Art. 79(a) — standard trade-discount treatment); inclusive-tax + discount splits correctly. PR/SR inherit discount from source PI/SI line. DTOs, validators, use-cases, frontend API types, page columns, save/load mappers and back-solve helpers all updated end-to-end. **15 domain tests** added (PI/PO/PR PERCENT, AMOUNT, clamp-at-gross, inclusive-with-discount, round-trip, zero-discount equivalence) — all passing. Report: [done/204-line-table-feature-sweep-and-purchase-line-discount.md](./done/204-line-table-feature-sweep-and-purchase-line-discount.md). Backend + frontend typecheck green. **Accounting boundary:** engine math is the source of truth — use-cases only forward `discountType`/`discountValue`; server-recomputed values are what posts to the ledger. **Out of scope (intentional):** GoodsReceipt (qty-only doc); cash/settlement discount (separate post-invoice mechanism); end-user docs and `docs/architecture/*` updates (separate follow-up). **Manual QA needed:** the 7-page QA script in 204's report (line discount math on each document type, back-solve from Line Total / Net, SR/PR discount inheritance from source).

**Shared line table UOM/settings polish completed (2026-06-10, Task 203).** `ClassicLineItemsTable` now hides numeric zero placeholders on empty working rows, adds table font selection, and adds Line Color 1 / Line Color 2 settings for alternating row colors. New shared `UomSelector` is wired into SI, SO, DN, Quote, PI, PO, GRN, and PR line tables; it defaults from the selected item and only allows item-defined UOMs, with refresh and item-card navigation. Report: [done/203-shared-line-table-uom-and-settings.md](./done/203-shared-line-table-uom-and-settings.md). Frontend typecheck passed. **Accounting boundary:** UI/data-entry only; no posting, tax, inventory valuation, UOM conversion math, AR/AP, settlement, approval, period-lock, audit, backend DTO, repository, or ledger behavior changed. **Manual QA needed:** QA-QUEUE report 203 script in Classic + Windows mode.

**Document scaffold true template adoption — Phases 1–3 DONE (2026-06-10, Task 202).** Audit confirmed the named-section template existed but nothing used it: all 8 scaffold consumers passed free-form `children`/`sideRail`, and Sales Invoice (the reference design) still runs its own duplicated shell. Fixed in owner-decided order: (1) template brought to exact SI parity (`f6ee6ea4` — SI-style footer totals strip, rail-aware footer slots, `banner` body slot, status/notice banner primitives); (2) Purchase Invoice pilot on strict named slots (`a193ddd4`); (3) SO/DN/SR/PO/GRN/PR rollout (`fa683ad8` — GRN posted view newly on the scaffold, SR/PR headers on `DocumentHeaderGrid`, zero legacy scaffold usage left in modules). Same-day follow-up (`ea4f26c0`): rail card **interiors** standardized on SI designs via new primitives (`DocumentRailFocus`/`DocumentRailKeyValueList`/`DocumentRailChecklist`/`DocumentRailTotals`); PI/SO/DN/SR/PO/GRN/PR rails now share one visual language. Report: [done/202-document-scaffold-true-template-adoption-phases-1-3.md](./done/202-document-scaffold-true-template-adoption-phases-1-3.md). Contract doc updated: [docs/architecture/document-scaffold.md](../docs/architecture/document-scaffold.md). Typecheck + production build green per phase. **Accounting boundary:** UI/layout only. **Owner decisions recorded:** Quotation stays page-local; legacy scaffold props kept as escape hatch (convention, not type-enforced). **Manual QA needed:** report 202 script in QA-QUEUE. **Phase 4 DONE same day (`73245f21`, owner-directed ahead of settlement QA):** Sales Invoice itself rebuilt on the template with strict named slots; its duplicated shell (rail state/drawer/edge button/sticky footer/topbar/local Pill-Field-CompactCard) deleted. Task 202 is now COMPLETE — every native Sales/Purchases document page runs on `DocumentDetailScaffold` named sections except Quotation (owner exclusion). **Caveat:** settlement QA (report 194) was not run before the rebuild; if it fails, retest against `ea4f26c0` to attribute the failure to settlement code vs the rebuild.

**Native document shared table/action-tray parity completed (2026-06-09).** Task 200 upgraded `ClassicLineItemsTable` so SI, PI, SO, DN, SR Direct, Quote, PO, GRN, and PR line grids share row right-click actions, table actions from the `#` header, column resizing saved per `tableId`, local UI preferences, blank placeholder-free cells, and edit/view row behavior. `DocumentDetailScaffold` now owns the named **Document action tray** for the compact top icon cluster. Report: [done/200-native-document-table-and-section-parity.md](./done/200-native-document-table-and-section-parity.md). Frontend typecheck and production build passed. `graphify update .` was attempted but `graphify` is unavailable on this PATH. **Accounting boundary:** UI/data-entry parity only; no posting, tax, AP/AR, settlement, inventory valuation, COGS, approval, period-lock, audit, backend DTO, or repository behavior changed. **Manual QA needed:** Classic + Windows mode pass for row/table context menus, resize persistence, UI selector persistence, and linked-source row action disabling across SI, PI, SO, DN, SR, Quote, PO, GRN, and PR.

**Shared line table auto-append regression fixed (2026-06-10).** After Task 200, native document working rows could auto-append indefinitely where page-level `isRowFilled` predicates counted default numeric placeholders as filled rows. The sweep now covers DN, SR Direct, SO, Quote, PO, GRN, PI, and PR consumers: numeric defaults without item/content no longer mark a row filled. The shared row menu also has explicit local row color swatches plus a lighter context-menu shadow. Report: [done/201-dn-sr-line-table-regression-fix.md](./done/201-dn-sr-line-table-regression-fix.md). Frontend typecheck and production build passed. **Accounting boundary:** UI/local-preference behavior only; no document totals, stock movement/receipt behavior, Sales/Purchase Return posting, tax, AR/AP, refund/credit-note settlement, inventory valuation, approval, period-lock, audit, backend DTO, or ledger behavior changed. **Manual QA needed:** DN/SR/SO/Quote/PO/GRN/PI/PR create/edit line tables in Classic and Windows mode, plus row color/clear-color persistence after reload.

**Sales Return source-control parity completed (2026-06-09).** The native Sales Return create page now mirrors the Sales Invoice source pattern: **Return Control** chooses `After Invoice`, `Before Invoice`, or `Direct Return`; the header below changes to the matching posted Sales Invoice picker, posted Delivery Note picker, or direct Customer selector. Report: [done/199-sales-return-source-control-parity.md](./done/199-sales-return-source-control-parity.md). Frontend typecheck passed. **Accounting boundary:** UI/data-entry layout only; no Sales Return posting, tax, AR reversal, credit-note/refund settlement, inventory receipt, COGS reversal, approval, period-lock, audit, or ledger behavior changed. **Manual QA needed:** `Sales -> Returns -> New Return` in Classic and Windows mode, switching all three modes and confirming the header picker changes correctly.

**Native document scaffold/list parity completed (2026-06-09).** Existing dirty work was checkpointed first in commit `65b8400c` (`fix(ui): checkpoint native invoice reference labels [ACTIVE-194]`). Task 196 then standardized native Sales/Purchases document surfaces around the SI/PI patterns: `ClassicLineItemsTable` now supports shared title/header sizing; SO, DN, SR direct lines, Quote lines, PO, GRN, and PR line sections use the shared table shell; GRN draft/edit and PR saved/edit views now use `DocumentDetailScaffold`; Quotations, Goods Receipts, and Purchase Returns lists now use `OperationalListLayout` / `DataTable`. Docs and QA queue updated; report: [done/196-native-document-scaffold-parity.md](./done/196-native-document-scaffold-parity.md). Frontend typecheck and production build passed. **Accounting boundary:** UI/data-entry consistency only; no posting, tax, inventory valuation, settlement, approval, period-lock, AP/AR, or ledger behavior changed. **Manual QA needed:** Classic + Windows mode pass for Quotes, SO, DN, SR, PO, GRN, PR, SI, and PI. **Known caveat:** Quotation detail outer lifecycle header is still page-local; its list and line table are standardized.

**Sectioned document scaffold contract added (2026-06-09).** Task 197 made `DocumentDetailScaffold` a named-section layout contract instead of only an outer shared shell. The body now has fixed slots (`control`, `header`, `lines`, `secondary`, `attachments`, `custom`), the rail has fixed slots (`info`, `readiness`, `settlement`, `totals`, `custom`), and the footer has `totals` / `actions` slots. Each slot supports `show` / `preserveSpace` flags. Legacy `children` and `sideRail` consumers are normalized through `custom` slots so existing pages still compile while future edits split their content into strict slots. Contract doc: [docs/architecture/document-scaffold.md](../docs/architecture/document-scaffold.md). Report: [done/197-sectioned-document-scaffold-contract.md](./done/197-sectioned-document-scaffold-contract.md). **Accounting boundary:** layout-only; no posting, tax, settlement, inventory, approval, period-lock, AP/AR, audit, or ledger behavior changed.

**Native document header density standardized (2026-06-09).** Task 198 added `DocumentHeaderGrid`, `DocumentHeaderField`, and shared header class exports to `DocumentDetailScaffold`. The default native document header now follows the Sales Invoice density: five columns on wide layouts, up to two compact rows for normal header inputs, `h-9` controls, `text-xs` inputs, and `text-[10px]` uppercase labels. SI, PI, SO, DN, Quote, PO, GRN, SR, and PR main header cards were tightened toward this standard. Report: [done/198-document-header-density-standard.md](./done/198-document-header-density-standard.md). **Accounting boundary:** layout-only; no posting, tax, settlement, inventory, approval, period-lock, AP/AR, audit, or ledger behavior changed.

**Settlement: approval-boundary preservation + pay-later dialog (2026-06-09, branch `feat/overpayment-credit-balance`).** Settlement QA on a Financial-Approval tenant exposed that paid invoices "always posted as deferred — payment never reached the ledger." Root cause (confirmed against the live emulator): with approval ON, posting a paid invoice throws `APPROVAL_REQUIRED`, rolls back the whole posting (invoice + receipt voucher) and parks `PENDING_APPROVAL`, **discarding the entered settlement** — so on approval it posted on credit and the payment was lost. Fixed across 6 commits: (1) `86ba56b9` #193 regression — Post handlers drove the retired settlement modal and wiped `settlementRows`, so valid CASH_FULL/MULTI never posted; both SI/PI now post directly from the inline `SettlementBlock`, gated on validity; (2) `2e677172` removed the dead settlement modal/card code; (3) `ae295800` **preserve settlement across approval** — new domain-local `pendingSettlement` on SalesInvoice/PurchaseInvoice, stored on park, replayed by `Approve{Sales,Purchase}InvoiceUseCase`, cleared on successful post (+tests); (4) `54a7e07a` docs — recorded the **two-voucher decision** (invoice voucher + separate linked receipt, not one combined entry; reasons in `sales.md`/`purchases.md`) + Approval Center per-row settlement preview; (5) `8585e246` **pay-later `RecordPaymentDialog` (Task 184 Finding 5)** replacing the broken "Create Payment/Receipt" button that navigated to a blank, never-reconciled Accounting voucher. Report: [done/194-settlement-approval-preservation-and-record-payment.md](./done/194-settlement-approval-preservation-and-record-payment.md). **Accounting boundary:** posting/tax/AR-AP/ledger unchanged — only preserve+replay an already-valid settlement and invoke the existing record-payment use case from the UI. Backend build + 50 settlement/posting/payment-sync + 28 boundary/authority tests green; frontend typecheck + production build green. **Manual QA needed:** scripts A–D in report 194 (restart the backend emulator first). **Payment-history display now done** (`7c0595c0`): a read-only `PaymentHistoryModal` opens from a "Payments" button on posted invoices. **Open follow-up (optional):** group the invoice voucher + linked receipt in the UI as one "what posted" panel.


**Task 186 Part A field-type registration completed + branch committed (2026-06-09).** The shared `<SettlementBlock>` was already built and consumed by both native SI/PI pages; the remaining gap — registering it as a Forms-Designer field type — is now done. Seeded a `settlement` `system_core` HEADER field (`seedFieldLibrary.ts`, scoped to `sales_invoice`/`purchase_invoice`); added `'settlement'` to the frontend `FieldType` union + `settlementContext` on `FieldDefinition`; new `SettlementField.tsx` adapter bridges the renderer's `value`/`onChange` to the block's granular `mode`/`rows`; `DynamicFieldRenderer` mounts it full-width; `documentMapper.mapFieldType` preserves the type. Frontend + backend typecheck clean; 28 settlement/settings/designer tests green. **This branch's accumulated uncommitted work (Apex 167–179, lists 186/190, SI 187–189, parity 191, toggle 192, settlement 193, Task 186 A/B + over-payment) was committed together** — file overlap across tasks made a per-task split impractical; granular history lives in the `planning/done/167…193.md` reports. Transcript-recovery scratch files were gitignored. **Accounting boundary:** the field-type gap is a designer placement marker + adapter over the unchanged `SettlementBlock`; no posting/tax/AR-AP/settlement/approval/period-lock/ledger behavior changed. **Manual QA needed:** the over-payment canonical scenario ($1000 invoice, $1500 paid; flag ON → invoice PAID + $500 party credit; flag OFF → rejected with clear message), plus the #193 settlement-placement visual pass.

**Sales Invoice settlement placement and RTL rail polish completed (2026-06-09).** The native Sales Invoice form now keeps the editable settlement block at the end of the invoice body, after lines and the allocation-grid placeholder, so payment handling happens just before the sticky footer actions. The duplicated lower Attachments and Audit & Warnings body tiles were removed; Attachments remains available from the top paperclip action, and audit/history moved into the compact top icon cluster. Follow-ups tightened the shared SettlementBlock so full-paid mode renders Method, Amount, and Contra Account in one equal-width row, with warnings/errors in the section header; settlement labels now read darker, placeholders stay muted gray, and the mode dropdown is wider. Arabic/RTL rail controls now mirror correctly: the native SI rail and shared `DocumentDetailScaffold` edge trigger, drawer side, inner hide button, rail icon, and back arrow use the left edge in RTL. Frontend typecheck passed. Completion report: [done/193-sales-invoice-settlement-placement.md](./done/193-sales-invoice-settlement-placement.md). **Accounting boundary:** UI placement/presentation only; settlement payload shape, posting, payment vouchers, tax, inventory valuation, approval, period-lock, AR/AP, and ledger behavior did not change. **Manual QA needed:** open `Sales -> Invoices -> New Sales Invoice`, confirm the order is Header -> Lines -> Allocation -> Settlement -> sticky footer, check the attachment/history icons, then switch to Arabic/RTL and verify the rail hide/show drawer works from the left edge.

**Sales Simple-mode SO/DN visibility toggle fixed (2026-06-08).** The Sales Settings checkbox **Show Sales Orders & Delivery Notes anyway** now gets included in the save payload and is covered by a backend regression test, so Simple-mode tenants can expose Sales Orders and Delivery Notes without switching the whole Sales workflow to Operational. Backend focused test, backend build, and frontend typecheck passed. Completion report: [done/192-sales-simple-operational-docs-toggle-fix.md](./done/192-sales-simple-operational-docs-toggle-fix.md). **Accounting boundary:** visibility/settings persistence only; invoice posting, tax, inventory valuation, AR, approval, period-lock, and ledger behavior did not change. **Manual QA needed:** save the toggle in Simple mode, reload Sales Settings, and confirm SO/DN menu visibility remains on.

**Sales/Purchases shared document scaffold parity corrected (2026-06-08).** Sales Returns list now uses the shared `OperationalListLayout` / `DataTable` pattern with quick status pills, inline filters, row actions, company date/time formatting, pagination, and centered scan-friendly cells. `frontend/src/components/shared/DocumentDetailScaffold.tsx` now owns the reusable Sales Invoice-style document skeleton: compact topbar, status/source pills, full-height scroll workspace, responsive right rail with edge drawer, shared body primitives, and persistent footer totals/actions. SO, DN, SR, PI, and PO detail pages render through that shared scaffold with document-specific slots. **PI was corrected again after visual feedback:** create/edit and saved view now use the SI-style internal anatomy too: source controls, compact header, line table region, allocation-grid placeholder, attachments/audit shortcuts, and rail ordered Info -> Posting Readiness/Document Status -> Settlement -> Totals. PI no longer accepts raw `purchaseOrderId`; it loads real POs from a dropdown, and the vendor picker is role-filtered to vendors. Frontend typecheck and production build passed. Completion report: [done/191-sales-purchases-document-ui-parity.md](./done/191-sales-purchases-document-ui-parity.md). **Accounting boundary:** UI/data-entry integrity only; posting, tax, AP/AR, inventory valuation, approval, period-lock, settlement, COGS, and ledger behavior did not change. **Manual QA needed:** Classic + Windows mode visual pass for SR list, PI new/saved view, and then SO/DN/SR/PO internal-anatomy parity.

**Sales Invoice sticky footer totals completed (2026-06-07).** Added an always-visible subtotal / tax amount / grand total strip to the right side of the native Sales Invoice sticky footer. The existing side-rail totals card remains unchanged, so totals are visible both when the rail is open and when the rail is hidden. Frontend typecheck passed. Completion report: [done/189-sales-invoice-sticky-footer-totals.md](./done/189-sales-invoice-sticky-footer-totals.md). **Accounting boundary:** UI visibility only; invoice total formula, tax calculation, posting, settlement, approval, period-lock, AR, inventory, and ledger behavior did not change.

**Sales Invoice allocation grid mock cleanup completed (2026-06-07).** Removed mocked Account Ledger & Financial Taxes Allocation Grid rows and deleted the lower **Charge / Account Name** table from the native Sales Invoice page. The grid now shows a localized empty state until Task 184 implements the controlled allocation contract. Frontend typecheck passed. Completion report: [done/188-sales-invoice-allocation-grid-mock-cleanup.md](./done/188-sales-invoice-allocation-grid-mock-cleanup.md). **Accounting boundary:** no posting, tax, totals, settlement, AR, inventory, approval, period-lock, or ledger behavior changed.

**Sales Invoice responsive window layout fix completed (2026-06-07).** Updated the native Sales Invoice detail page so resized Windows-mode invoice windows and smaller view areas use a single reliable vertical workspace scroll instead of clipping sections in nested fixed-height columns. The side rail is pinned by default only on wide layouts, can be hidden/restored from an edge button, and automatically becomes an edge-triggered drawer in Windows mode or narrow viewports so it does not push over invoice fields. Frontend typecheck/build/check:no-confirm passed. Completion report: [done/187-sales-invoice-responsive-window-layout.md](./done/187-sales-invoice-responsive-window-layout.md). **Manual QA needed:** open a Sales Invoice in Windows mode, resize below the default `1100x750`, and verify header, line items, allocation grid, settlement/totals drawer, and footer actions remain reachable.

**High-Density Single-Row Filters Bar on Standardized Operational Lists completed (2026-06-07).** Converted the filters section on all 5 standardized operational list pages (Sales Invoices, Purchase Invoices, Sales Orders, Purchase Orders, and Delivery Notes) from a multi-row grid into a single horizontal flex-wrap row and removed vertical field labels. Updated `DatePicker.tsx` to support a custom `placeholder` prop so that "Date From" and "Date To" inline placeholders display when values are blank. Frontend typecheck and build passed. Completion report: [done/186-filter-bar-one-row.md](./done/186-filter-bar-one-row.md).

**Quick Status Filters on Standardized Operational Lists completed (2026-06-07).** Integrated a premium quick status filter pills bar with dynamic counts in the shared `OperationalListLayout` component. Updated all 5 standardized operational list pages (Sales Invoices, Purchase Invoices, Sales Orders, Purchase Orders, and Delivery Notes) to fetch document lists from the API without status filters, compute document status counts dynamically (reflecting other active filters like Customer or Payment in real-time), and execute status filtering instantaneously in memory. Removed old static `summaryWidgets` card blocks from Sales/Purchase Orders list pages to utilize the new interactive pill bar instead. Frontend typecheck and build passed. Completion report: [done/186-quick-status-filters-pills.md](./done/186-quick-status-filters-pills.md).

**Next recommended slice: Task 167 Slice 3D** — Apex tenant-shell feature flag & cutover QA (estimated 2-4 hours). Check role-based navigations, company setting footer actions, empty tenant displays, and Arabic RTL visual rendering inside the candidate shell.

**Apex shell RTL flyout positioning, Contrast sidebar hardening & Hover highlights complete (2026-06-05).** Fixed coordinate alignment bugs where submenus overlapped the main sidebar in RTL mode, resolved background color discrepancies by styling spawned flyout submenus with `var(--app-sidebar-surface)`, visually hardened contrast sidebars with semi-transparent white overlays, and replaced the light-blue row hover styling in normal sidebars with theme-agnostic `hover:bg-black/5 dark:hover:bg-white/5` overlays to resolve visual mismatch issues. This avoids visual bleed, invisible text, and invisible active highlights across all presets.

**Apex shell production candidate — RTL Support & Slice 2 complete (2026-06-05).** Fully optimized layout, sidebar, headers, and dashboard widgets to support Right-to-Left (RTL) reading directions dynamically when toggled to Arabic. Spacings use logical gaps, search text commands align cleanly, active indicator borders swap sides, and chevrons rotate in RTL. Documented and completed.

**Apex route/page coverage matrix completed (2026-06-05).** Codex created [planning/briefs/20260605-apex-route-page-coverage-matrix.md](./briefs/20260605-apex-route-page-coverage-matrix.md). Verdict: do not copy main-shell pages. Apex should own shell/chrome, adapt the real `useSidebarConfig()` tree into Apex styling, and embed native production pages for Sales/Purchases/Inventory/Settings/AI operational workflows until Apex-native replacements are fully contract-equivalent. Current risk: Apex module child routes are contained by wildcard routing but many still collapse to module workbench sections instead of exact native pages. **Next recommended slice: Task 167 Slice 3B** — build the Apex route translation helper and sidebar tree adapter, then mount native pages by module. Estimate: 2-3 hours for adapter, then split page mounting by module.

**Apex route/sidebar adapter complete (2026-06-05).** Added `routeMap.ts`, switched Apex sidebar runtime child items to the real `useSidebarConfig()` tree, and preserved the Apex compact/RTL visual shell. Item-level RBAC, workflow hiding, and dynamic form groups now come from the same source as the main shell. Frontend typecheck and production build passed. **Next recommended slice: Task 167 Slice 3C** — mount native production pages inside Apex by module, starting with Sales and Purchases operational list/detail/report/settings routes. Estimate: split into 2-3 hour module slices.

**Apex Sales native page mounting complete (2026-06-05).** Added `NativeSalesRouteMount.tsx` and mounted concrete `/dev/apex-ledger/sales/*` subroutes to the existing native Sales production pages while keeping `/dev/apex-ledger/sales` on the Apex overview. Native route guards are reused, and an Apex-only hash bridge keeps internal native Sales navigations inside `/dev/apex-ledger/sales/...`. Frontend typecheck and production build passed. **Next recommended slice: Task 167 Slice 3C-Purchases/Inventory** — mount native Purchases and Inventory operational pages inside Apex using the same route-mount pattern. Estimate: 2-3 hours per module.

**Apex prototype scale restoration complete (2026-06-05).** Inspected `D:\DEV2026\apex-ledger-erp.zip` and restored the candidate shell toward the prototype sizing: full-height `w-64` sidebar, larger sidebar/header/footer/menu rhythm, `p-6` main workspace, and viewport-bound shell scrolling. Frontend typecheck and production build passed. **Manual QA needed:** compare `/#/dev/apex-ledger` against the prototype in English and Arabic RTL before treating the visual shell as cutover-ready. Estimate: 20-30 minutes visual QA.

**Apex Company Settings sidebar parity complete (2026-06-05).** Apex now mirrors the main shell's footer-level Company Settings block instead of showing the old Apex user/profile footer. Company Admin, currencies, tax-code, notification, and communication settings links route through `/dev/apex-ledger/...` and mount the native protected pages inside Apex. Frontend typecheck and production build passed. **Manual QA needed:** expand the footer in English and Arabic RTL and click every Company Settings child. Estimate: 10-15 minutes.

**Apex prototype typography restoration complete (2026-06-05).** Compared the downloaded prototype source against ERP03 global typography. Apex now loads Inter 400-900 and JetBrains Mono 400-800, scopes the Apex shell to those fonts, and temporarily restores root font scale to 100% while mounted so it is not shrunk by the main shell's 90% global dashboard scale. Frontend typecheck and production build passed. **Manual QA needed:** compare sidebar/topbar/module labels and mono metadata against the downloaded prototype. Estimate: 10-15 minutes.

**Apex Purchases and Inventory native page mounting complete (2026-06-05).** Added shared `NativeModuleRouteMount.tsx` and mounted concrete `/dev/apex-ledger/purchases/*` and `/dev/apex-ledger/inventory/*` subroutes to the existing native production pages while keeping `/dev/apex-ledger/purchases` and `/dev/apex-ledger/inventory` on the Apex workbench overviews. Native route guards are reused, and an Apex-only hash bridge keeps internal native Purchases/Inventory navigations inside `/dev/apex-ledger/...`. Frontend typecheck and production build passed. **Next recommended slice: Task 167 Slice 3C-Settings/RBAC/AI** — mount the remaining native Settings/RBAC and AI pages inside Apex. Estimate: 2-3 hours.

**Apex Settings/RBAC/AI native page mounting complete (2026-06-06).** Extended `NativeModuleRouteMount.tsx` so `/dev/apex-ledger/settings/*` renders native Settings/RBAC pages and `/dev/apex-ledger/ai/*` renders native AI Assistant pages through the existing `/ai-assistant/*` route components. Company Settings footer routes still use `NativeCompanySettingsRouteMount`, and `/dev/apex-ledger/settings/accounting` still mounts the Accounting Settings detail page. Frontend typecheck and production build passed. **Next recommended slice: Task 167 Slice 3D** — add an Apex tenant-shell feature flag and run full cross-role/module/empty-tenant cutover QA. Estimate: 2-4 hours.

**Apex route coverage gap audit complete (2026-06-06).** Rechecked tenant/native route coverage with a stricter route-table audit and fixed all routes that were still falling to Apex placeholders. Accounting Setup, Recurring Vouchers, Cost Centers, Voucher Detail/View/Demo, Voucher Designer, Budgets, Subgroup Tagging, Tools Forms Designer, Companies, Notifications, Company Admin, HR, POS, Super Admin, Company Wizard, CRM, Manufacturing, Projects, and Canvas Dev now route through native production pages inside Apex where no Apex-native page exists. Strict audit result: 185 tenant routes checked, 0 placeholder fallbacks. Follow-up sidebar-link audit found and fixed stale Apex sidebar URLs for Sales Analytics, Aged Backlog, Sales/Purchases Voucher Designer, Purchases Analytics, Low Stock Alerts, Unsettled Costs, Inventory Valuation, Budgets, and Subgroup Tagging. Sidebar audit result: 79 Apex sidebar paths checked, 0 missing route matches. Frontend typecheck and production build passed. **Boundary:** this is route continuity, not Apex visual redesign of every native page; Super Admin still requires separate platform-role QA before default-shell cutover.

**Posting-Authority epic — ALL STAGES 0–7 COMPLETE (2026-06-03).** The "one guard at the ledger door" architecture is fully realized: forged-stamp killed (Stage 1), approval centralized (2a/2b/2c), period-lock unified (3), reporting decoupled (F8), `PostingGateway` is the sole ledger door enforced by an arch test (4), uniform `{ guard, code }` rejection contract (5), vocabulary standardized (6), future hooks documented but unbuilt (7). Reports 155–161. **Only optional follow-up: Stage 4b** — fold the system-voucher exemptions (settlements, payment-sync, bank-rec, year-end closing; `grep "enforcePolicies: false" backend/src`) into the policy set so even those run the full rulebook. Behavioural — run `erp-reviewer` first.

**Posting-Authority Stage 5 — Uniform Rejection Contract (2026-06-03):** Law 5 landed. `toRejectionContract(err)` (`backend/src/domain/shared/errors/RejectionContract.ts`) maps every guard error onto `{ guard, code, message, fieldHints }`; the active error handler now surfaces `guard` + `code` consistently and gained a proper 422 branch for `CreditLimitExceededError`. Full backend suite green (139 suites, 1307 tests). Report: [done/160-stage-5-uniform-rejection-contract.md](./done/160-stage-5-uniform-rejection-contract.md).

**Posting-Authority Stage 4 — PostingGateway / Guard at the Door (2026-06-03):** Built `PostingGateway` (`backend/src/application/accounting/services/PostingGateway.ts`) — the single, mandatory choke point and the **only** code permitted to call `ILedgerRepository.recordForVoucher`. All 11 production posting paths migrated to it. The Sales/Purchase subledger path runs the full policy set **through** the gateway (enforce mode, approval derived from the caller — Law 7). The other 10 system/manual sites carry an explicit `enforcePolicies: false` + mandatory `exemptionReason` (greppable; zero behavioural change). Architecture test now forbids any direct `recordForVoucher` caller. Full backend suite green: **138 suites, 1301 tests, 0 failures.** Report: [done/159-stage-4-posting-gateway.md](./done/159-stage-4-posting-gateway.md). **Next: Stage 4b** — fold the system-voucher exemptions (settlements, payment-sync, bank-rec, year-end closing) into the policy set so even those run the full rulebook (today they pass the door + iron laws only).

**Posting-Authority Stage 2c — Per-Module Approval Flag Retired (2026-06-03):** Removed `requireApprovalBeforePosting` from `SalesSettings`/`PurchaseSettings` (entities, DTOs, use cases) and from the Sales/Purchase Settings UI + API contracts. Approval enforcement is now driven entirely by the central `AccountingPolicyConfig.approvalRequired` + per-type exemptions (Stage 2a). Backend typecheck clean; frontend typecheck clean; 5 affected suites (47 tests) green. The `Stage 2` architecture assertion in `PostingAuthority.test.ts` is now active. Report: [done/158-stage-2c-retire-per-module-approval-flag.md](./done/158-stage-2c-retire-per-module-approval-flag.md).

**Posting-Authority Reporting Decoupling (2026-06-03, Stage 4 / F8):** Decoupled Sales (`ReceivablesReportingUseCases`) and Purchases (`PurchasesReportingUseCases`) reporting from direct imports of `ILedgerRepository` and dependency on `IVoucherRepository` by re-exporting `AccountStatementEntry` from `LedgerUseCases` and injecting `GetVoucherUseCase` instead. Updated controllers and unit tests accordingly. Cleaned up the `AccountingBoundary.test.ts` violations completely. Report: [done/157-decouple-reporting-boundary.md](./done/157-decouple-reporting-boundary.md).

**Posting-Authority Period-Lock Unification (2026-06-03, Stage 3):** Consolidated period locking logic by refactoring `PeriodLockService` to be a thin adapter delegating all checks directly to `PeriodLockPolicy` under the hood. Added architecture test assertion checking that `PeriodLockService` contains no duplicate checks. Report: [done/156-period-lock-unification.md](./done/156-period-lock-unification.md).

**Posting-Authority Decoupling & Reactive Approvals (2026-06-03, Stage 2b):** Decoupled `PostSalesInvoiceUseCase` and `PostPurchaseInvoiceUseCase` from local settings-based approval flags. They now pass the real approval context to `SubledgerVoucherPostingService`. Unapproved postings are rejected by the centralized accounting guard with code `APPROVAL_REQUIRED`, which the use cases catch and handle by transactionally parking the document status as `PENDING_APPROVAL`. Report: [done/155-posting-authority-decoupling.md](./done/155-posting-authority-decoupling.md).

**AI floating launcher toggle completed (2026-06-02):** AI Settings now has **Show Floating AI Launcher**. It persists as `AiProviderConfig.showFloatingAssistant`, defaults ON for old tenants, and the global launcher reads a small chat-permission endpoint so normal chat users respect the admin setting without full settings access. The launcher icon now uses an AI brain/sparkles visual. Report: [done/153-ai-floating-assistant-launcher-toggle.md](./done/153-ai-floating-assistant-launcher-toggle.md). QA item added to [QA-QUEUE.md](./QA-QUEUE.md). No accounting/posting behavior changed.

**Native-detail contract — frontend wins landed (2026-06-01, Task 148):** Quotation frontend
contract complete (`5d8d3f17`); **Delivery Note & Sales Return drafts are now editable**
(`06256cda`) via existing `updateDN`/`updateReturn`. Frontend build/tsc green. The contract
doc's "backend already supports messaging" claim was **wrong** — messaging + attachments are
**Sales-Invoice-only**; non-invoice messaging/attachments, DN/SR Cancel, and quote audit
emission are filed in [tasks/152-sales-doc-messaging-attachments-backend.md](./tasks/152-sales-doc-messaging-attachments-backend.md).
**Next frontend wins (no backend):** (1) backport SO's RBAC credit-override gate to Sales
Invoice Detail — security finding F34; (2) swap SO's bespoke status badge for shared
`StatusChip`; (3) full-page i18n sweep for DN/SR/SO. NOTE: the working tree carries heavy
uncommitted WIP (communications backend module + SI refactor + a stray `frontend/src.zip`)
— commit work with explicit pathspec to avoid bundling it.

**Sales Invoice V2 Card Layout Mockup Alignment (2026-06-01):** Aligned `/dev/sales-invoice-v2` (`SalesInvoiceV2LayoutPage.tsx`) dev mockup to Variant V2 card layout with 5 cards (Core Settings, Financial Details, line items table, actions and allocation grid, totals and actions footer), smart selectors, Syrian tax preset calculations, mock action modals, and simulated lifecycle state switching. Report: [done/150-sales-invoice-page-refinement.md](./done/150-sales-invoice-page-refinement.md).

**Purchase direct invoicing governance fix (2026-06-01):** Purchase Settings now maps the OPERATIONAL **Allow Direct Invoicing** toggle to the explicit company-scope `direct` governance rule required by `DocumentPolicyResolver`. New OPERATIONAL purchase defaults are strict-by-default. Report: [done/151-purchase-direct-invoicing-governance.md](./done/151-purchase-direct-invoicing-governance.md).


**Done report:** [done/142-phase-1-p0-confirms-dates-taxonomy.md](./done/142-phase-1-p0-confirms-dates-taxonomy.md).

**Settings taxonomy foundation (2026-05-30):** Settings Home is now a real hub grouped by business purpose (General, Workflow, Accounting and Tax, Access and Advanced). `ModuleSettingsLayout` has responsive mobile/desktop tabs and translatable unsaved-change copy. Docs: [docs/architecture/settings.md](../docs/architecture/settings.md), [docs/user-guide/settings/settings-home.md](../docs/user-guide/settings/settings-home.md). Report: [done/143-settings-taxonomy-foundation.md](./done/143-settings-taxonomy-foundation.md).

**Invoice list standardization (2026-05-30):** Sales and Purchase invoice lists now share the same operational-list pattern: `PageHeader`, shared `PartySelector` customer/vendor filters, refresh/clear actions, status/payment chips, `EmptyState`, and explicit Open row action. Docs: [docs/architecture/operational-lists.md](../docs/architecture/operational-lists.md), [docs/user-guide/lists/invoice-lists.md](../docs/user-guide/lists/invoice-lists.md). Report: [done/144-invoice-list-standardization.md](./done/144-invoice-list-standardization.md).

**Voucher and item list standardization (2026-05-30):** Accounting Vouchers now uses the shared outer `PageHeader` while keeping its specialized `VoucherFiltersBar`/`VoucherTable`. Inventory Items now has consistent header, search/filter, refresh/clear, empty state, status chips, Open action, and create/load toast feedback. Docs: [docs/architecture/operational-lists.md](../docs/architecture/operational-lists.md), [docs/user-guide/lists/accounting-and-items-lists.md](../docs/user-guide/lists/accounting-and-items-lists.md). Report: [done/145-voucher-and-item-list-standardization.md](./done/145-voucher-and-item-list-standardization.md).

**Raw date input cleanup (2026-05-30):** Remaining native `type="date"` controls were replaced with shared `DatePicker` in Stock Movements, Stock Transfers, Sales Promotions, Sales Price Lists, and generic `DataTableFilter` date-range filters. Raw date scan across `frontend/src` now returns no matches. Docs: [docs/user-guide/lists/date-controls.md](../docs/user-guide/lists/date-controls.md). Report: [done/146-raw-date-input-cleanup.md](./done/146-raw-date-input-cleanup.md).

**Sidebar forms grouping rework (2026-05-31):** Removed the v1 default-suppression rule in `useSidebarConfig`; per-module defaulting now lands accounting forms in **Vouchers** (with *All Vouchers* dynamically prepended), sales/purchase defaults in **Default Forms**, and groupless sales/purchase clones at the **root** of the module sidebar. Accounting's static `Forms` group is gone — *Approval Center* is now a root-level Accounting item. Authoritative policy: [docs/architecture/sidebar-forms-grouping.md](../docs/architecture/sidebar-forms-grouping.md). Report: [done/147-sidebar-forms-grouping-rework.md](./done/147-sidebar-forms-grouping-rework.md).

**Next step:** Native functionality retest. Once the chrome is polished (Task 132 Phase 5 complete), walk every native voucher flow end-to-end per module (create / edit / post / pay / cancel / void / send / attach / audit / period-lock override / credit override). Captures regressions and a real polish backlog.

**Visual Layout Editor Polish & Auto Align (2026-05-30):**
- Fixed 12-to-24 column grid coordinate double-scaling bug by implementing versioned `layoutVersion = 2` checks.
- Refined Properties Panel triggers to only open when the Pencil edit icon is explicitly clicked.
- Added `Width: {span}` labels directly to canvas component boxes for better alignment visibility.
- Defaulted layout placement/missing field span to 6 (4 components per row).
- Implemented the smart **Auto Align** button toolbar action to clean and wrap canvas layouts to sequential rows of span 6 components.

**Field Library Phase C1 is complete**:

1. Forms Management now loads the tenant Field Library read API.
2. The existing saved form shape (`headerFields`, `tableColumns`, `uiModeOverrides`) is unchanged.
3. Current module-specific mandatory/optional semantics are preserved until Phase C2 introduces true Layer 2 type bindings.
4. Required accounting/sales/purchase fields, selector fields, and posting-related controls were not relaxed.

**Field Library Phase C2 is implemented**:

1. Super-admin voucher templates now load the Field Library API.
2. Header/Line authoring offers Field Library entries instead of frontend hardcoded voucher suggestions.
3. Table column suggestions derive from the template's own `layout.lineFields`.
4. Type-level placement/mandatory status is controlled by the voucher template while Field Library remains the official field metadata source.

Phase C1 actual: **~1.9 hours**. Report: [135c-field-library-phase-c1.md](./done/135c-field-library-phase-c1.md).
Phase C2 actual: **~1.2 hours**. Report: [135d-field-library-phase-c2.md](./done/135d-field-library-phase-c2.md).

Remaining Field Library follow-up estimate: **2-4 hours**:
- Add `fieldVersionsSeen` and company-form drift warnings.
- Decide whether the Field Library seed needs tighter `supportedTypes` scoping for super-admin convenience.

---

## Earlier Purchases focus (still open after the Field Library arc)

Piece A and Piece B are complete:

1. Customer/vendor per-party AR/AP account generation is implemented.
2. Backfill is available for existing parties.
3. Customer Statement now uses `GetAccountStatementUseCase` through `Party.defaultARAccountId`.
4. Statement rows are decorated from voucher metadata for source-document and accounting-voucher drill-down.
5. Open Sales Orders can be included as non-balance commitments.

Vendor Statement parity is now also complete:

1. Vendor Statement uses `GetAccountStatementUseCase` through `Party.defaultAPAccountId`.
2. Missing AP account returns `VENDOR_AP_ACCOUNT_MISSING`.
3. AP balances display as positive amount owed while preserving ledger debit/credit sides.
4. Rows are decorated from voucher metadata for Purchases source-document and accounting-voucher drill-down.
5. Open Purchase Orders can be included as non-balance commitments.

Phase F progress:
1. Ledger-backed AR Aging — migrated from Sales-only _buildRawEvents to Accounting ledger with unallocated diff display.
2. AP Aging report — new, mirrors AR Aging for vendors via defaultAPAccountId.
3. Purchases Analytics — purchases-by-vendor + purchases-by-item reports, frontend page with mode toggle.
4. Purchase Audit Log — reused RecordAuditController, wired to /tenant/purchase/audit-log.
5. Dead code cleanup — removed old GetCustomerStatementUseCase and its tests.
6. PI Attachments — tenant-scoped vendor bill/supporting evidence attachments on Purchase Invoices (report 129).
7. Vendor Groups — optional supplier segmentation master data with vendor Party assignment (report 130).
8. Purchase Price Lists — optional currency-specific supplier pricing agreements (report 131).

Remaining parity gaps (prioritized):
- RFQ (Request for Quotation) — bigger feature, 2-3 hours

---

## Earlier focus (archived for context)

**Task:** Sales completion roadmap — **Phases A ✅ B ✅ C ✅ D (all) ✅ E ✅**
**Status:** running phases autonomously (manual QA gates deferred per user instruction)
**Branch:** `feat/phase-a-sales-master-data`
**Plan:** [planning/tasks/sales-and-purchases-completion-roadmap.md](./tasks/sales-and-purchases-completion-roadmap.md)
**Done reports:** [108 — Phase A](./done/108-phase-a-master-data-pricing.md), [109 — Phase B](./done/109-phase-b-sales-operational.md), [110 — Phase C](./done/110-phase-c-sales-finance-reporting.md), [111 — Phase D.2+D.3](./done/111-phase-d-period-lock-audit-log.md), [112 — Phase D.4](./done/112-phase-d4-recurring-invoices.md), [113 — Phase D hardening audit](./done/113-phase-d-audit-hardening.md), [114 — Phase D.5 sales-return enhancements](./done/114-phase-d5-sales-return-enhancements.md), [115 — Phase D.7 invoice templates](./done/115-phase-d7-invoice-templates.md), [116 — Phase D.8 WhatsApp outbound messaging](./done/116-phase-d8-whatsapp-outbound-messaging.md), [117 — D.8 multi-tenant sender-accounts hardening](./done/117-d8-multitenant-messaging-hardening.md), [118 — D.8 Telegram outbound execution](./done/118-d8-telegram-outbound-execution.md), [119 — Phase D.6 invoice attachments](./done/119-phase-d6-invoice-attachments.md), [120 — Phase E sales cleanup](./done/120-phase-e-sales-cleanup.md)

## Where we are

Phases A, B, C are built, type-clean, and unit-tested. Phase D control stack is now complete: D.2 Period Lock, D.3 per-record audit log, D.4 recurring invoices, D.5 sales-return enhancements, D.6 invoice attachments, D.7 controlled invoice templates, and D.8 outbound messaging.

Latest hardening (report 117) corrected D.8 architecture to true multi-tenant behavior:
- per-company sender accounts in `Sales Settings -> Communications`
- encrypted per-account credentials
- multiple sender accounts per company with default/active routing
- invoice send modal supports sender selection per message

Phase D is now functionally closed. Email delivery execution remains a follow-up channel under the tenant-scoped provider/account abstraction.

Commits on `feat/phase-a-sales-master-data`:
- `5949f314` — Phase A (master data & pricing)
- `4e9ce801` — Phase B.0–B.3 checkpoint
- `b9718462` — Phase B.4–B.6
- _(pending)_ — Phase C
- _(pending)_ — Phase C/D commits not yet finalized in this branch snapshot

## Carried-forward follow-ups

- Promotion evaluator built + tested but not auto-invoked in SO/SI creation.
- Credit check enforced at SO confirm only — not on direct SIs.
- Backorder / partial-fulfillment frontend UX deferred.
- Quote numbering uses a `Q-<timestamp>` fallback (no sequence in SalesSettings).
- Commission accrual auto-wired (B.0); credit-hold enforcement live (B.2).
- AI-assistant test failures currently present in full suite: 3 in `SendChatMessageUseCase` (credits/runtime-mode path) + 1 in `AiModelCertificationUseCase` (global recommended query expectation). Unrelated to Sales D8 but now tracked for stabilization.
- D.2 period-lock override UI wired on SI/DN/SR detail pages; SO detail page has History button but no posting (SO confirm already has credit-override flow).
- **D.3 follow-up — SO confirm/cancel/close and SI payment record/status are NOT audited** (only Create/Update/Post/Override are). Add in Phase E if needed.
- **🔥 Scheduled Tasks Engine (HIGH PRIORITY, blocks recurring features across modules)** — D.4 ships templates + a manual "Generate Due" button but NO scheduler. Same gap will hit HR payroll, Accounting recurring vouchers, Purchase recurring POs, system cleanup, etc. Build a single shared engine that every module registers against, not per-feature crons. Spec: [planning/tasks/scheduled-tasks-engine.md](./tasks/scheduled-tasks-engine.md). User-facing notice added to Recurring Invoices page in the meantime.
- **D.2 follow-up — Period-lock override governance (Phase E):**
  - Role-gate the **Override Period Lock** button so only authorized roles (e.g. Controller / CFO / Accounting Manager) see it. Hide for staff/operators.
  - Add a clear option in **Accounting → Settings → Fiscal** under Period Locking:
    - Toggle: **Allow soft-lock overrides** (default ON). When OFF, the override path is fully disabled and the soft lock behaves like a hard lock for all users.
    - Multi-select: **Roles permitted to override** (default: Controller, CFO).
  - Backend must enforce both — UI gating is not enough; the override endpoint must re-check role + the allow-override toggle and reject otherwise (clear error, audit-logged attempt).
- `record_change_logs` Firestore composite index added to `firestore.indexes.json` — must be deployed before production use.
- ✅ **COA template defaults fixed (2026-05-28):**
  - Generic catch-all defaults added across templates for perpetual-mode readiness:
    - AP (`20100 Accounts Payable - General`)
    - Revenue (`400 Sales Revenue` in Standard + aligned revenue defaults in industry templates)
    - COGS (`50100 Cost of Goods Sold - General` where applicable)
    - GRNI (`209` in Standard/industry templates; `203` GRNI in Simplified)
  - Comprehensive template upgraded from placeholder to full enterprise chart.
  - Related commits: `30055d9f`, `4385873d`.
  - Follow-up: add wizard-side validation/auto-create warning when required perpetual defaults do not resolve.
- `PeriodLockService` is now wired into `buildAccountingPostingService()` — enforcement is live for all Sales posting paths.
- D.7 full free-canvas/sketch-board invoice designer is deferred; current model is controlled template selection via Forms Designer templates.

## Sequence (remaining)

1. ✅ **Phase A** — Sales master data + pricing — DONE (report 108)
2. ✅ **Phase B** — Sales operational — DONE (report 109)
3. ✅ **Phase C** — Sales finance & reporting — DONE (report 110)
4. ✅ **Phase D** — Sales auditability & control
   - ✅ D.1 GL Impact modal (pre-built, i18n fixed)
   - ✅ D.2 Period lock date (built + audited + 14 fixes applied)
   - ✅ D.3 Per-record audit log (built + audited + 14 fixes applied)
   - ✅ D.4 Recurring invoices (templated + scheduled, 19 tests)
   - ✅ D.5 Sales-return enhancements — DONE (report 114)
   - ✅ D.6 Document attachments — DONE (report 119)
   - ✅ D.7 Multiple invoice templates (controlled model) — DONE (report 115)
   - ✅ D.8 Outbound messaging — DONE as WhatsApp-first integration (report 116)
   - ✅ D.8 hardening — multi-tenant sender account isolation + encrypted per-company credentials (report 117)
   - ✅ D.8 follow-up — Telegram outbound execution (report 118)
5. ✅ **Phase E** — Sales cross-cutting cleanup — DONE (report 120; merged via 249bb86)
6. **⚠ Sales QA cycle** — Phase C run 2026-05-27, conditionally passing; see [121 — Phase C QA Results](./done/121-phase-c-qa-results.md). 11 findings; 1 report-code bug (credit notes missing from Customer Statement/Ledger), the rest upstream data/COA issues.
7. **Phase F** — Purchases parity — 4-5 days
8. **Phase G** — Purchases-specific (three-way match + vendor master) — 3-4 days
9. **Phase H** — Final hardening — 1 week

## Rabbit Holes

- **Sales Dashboard Scalability**: Switch Sales KPI dashboard calculations from frontend array `.reduce` to backend cloud-function pre-aggregated stats documents (e.g. `company_sales_stats`) when document volume grows past V1 limits.

## Next action

Continue **Task 132 main-shell chrome polish**:
1. Use the main shell as the production shell.
2. Keep Apex work as historical candidate-shell context only.
3. Reuse only selected Apex visual ideas, starting with the accordion sidebar look already applied to the main shell.
