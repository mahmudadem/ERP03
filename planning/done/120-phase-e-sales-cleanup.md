# Phase E — Sales Cross-Cutting Cleanup: Completion Report

**Date:** 2026-05-24
**Agent:** OpenCode (orchestrator)
**Branch:** `feat/phase-e-sales-cleanup`
**Commits:**
- `ea63437f` — E.1 Quote sequence numbering
- `fddba058` — E.2 AI-assistant test stabilization
- `1e88194b` — E.3 Promotion evaluator auto-invocation
- `815f674d` — E.4 Credit check on direct Sales Invoices
- `64a10ac6` — E.5 Backorder/partial-fulfillment frontend UX

---

## Technical Developer View

### E.1 — Quote Sequence Numbering
**Problem:** Quotes used `Q-<timestamp>-<random>` numbering, making them unsortable and unprofessional.

**Solution:** Added `quoteNumberPrefix` (default: `'QT'`) and `quoteNumberNextSeq` (default: `1`) to `SalesSettings` entity, mirroring the existing SO/DN/SI/SR pattern. Updated `generateDocumentNumber()` to support `'QT'` doc type. Wired `CreateQuoteUseCase` and `ReviseQuoteUseCase` to fetch settings and allocate sequences atomically.

**Files changed:**
- `backend/src/domain/sales/entities/SalesSettings.ts` — Added 2 fields
- `backend/src/application/sales/use-cases/SalesOrderUseCases.ts` — Extended `docType` union
- `backend/src/application/sales/use-cases/QuoteUseCases.ts` — Replaced fallback, injected settings repo
- `backend/src/api/controllers/sales/SalesOperationalController.ts` — DI wiring
- `backend/src/tests/application/sales/QuoteLifecycle.test.ts` — Updated for new constructor
- `backend/src/tests/application/sales/QuoteSequence.test.ts` — NEW: 5 sequence tests
- `frontend/src/api/salesApi.ts` — Added DTO fields
- `frontend/src/modules/sales/pages/SalesSettingsPage.tsx` — Added QT row to numbering tab

### E.2 — AI-Assistant Test Stabilization
**Problem:** 3 `SendChatMessageUseCase` tests failing because mock credit ledgers lacked `canAfford()` method (added to `AiCreditLedger` entity later but test mocks not updated).

**Root cause:** `AiCredentialResolver.resolveRuntimeCredential()` calls `ledger.canAfford(creditCost)` at line 118. Mock ledgers only had `hasCredits()` and `balance`, causing `TypeError: ledger.canAfford is not a function` instead of the expected `ApiError.forbidden(403)`.

**Fix:** Added `canAfford: (amount: number) => boolean >= amount >` to all 4 mock ledger objects. Also fixed assertion text from `'No platform runtime credential'` to `'No platform runtime profile or provider credential'` to match the current error message.

**Files changed:**
- `backend/src/tests/application/ai-assistant/SendChatMessageUseCase.test.ts` — 4 mock ledgers + 1 assertion text

### E.3 — Promotion Evaluator Auto-Invocation
**Problem:** Promotions were built but only invocable via explicit API call (`POST /sales/promotions/evaluate`). SO and SI creation didn't auto-apply matching promotions.

**Solution:** Wired `PromotionApplicationService` into `CreateSalesOrderUseCase` and `CreateSalesInvoiceUseCase` (direct persona only). Applied line discounts adjust totals and tax. Free goods lines added with zero price. Manual discounts take precedence (skipped by evaluator). Added `appliedPromotions` summary and per-line `appliedPromotionId/Name/DiscountPct` fields.

**Files changed:**
- `backend/src/domain/sales/entities/AppliedPromotion.ts` — NEW: shared type
- `backend/src/domain/sales/entities/SalesOrder.ts` — Added promotion fields
- `backend/src/domain/sales/entities/SalesInvoice.ts` — Added promotion fields
- `backend/src/application/sales/use-cases/SalesOrderUseCases.ts` — Promotion wiring
- `backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts` — Promotion wiring
- `backend/src/api/controllers/sales/SalesController.ts` — DI wiring
- `backend/src/api/controllers/sales/SalesOperationalController.ts` — DI wiring
- `backend/src/tests/application/sales/PromotionAutoApplication.test.ts` — NEW: 7 tests

### E.4 — Credit Check on Direct Sales Invoices
**Problem:** Credit check only ran at SO confirm. Direct SIs (no SO) bypassed credit enforcement entirely.

**Solution:** Added `CreditCheckService` and `ICreditOverrideRepository` as optional dependencies to `CreateSalesInvoiceUseCase`. For `persona === 'direct'`, check credit limit before saving. Same enforcement pattern as SO: BLOCK (throw `CreditLimitExceededError` 422), WARN (create with warning), or OVERRIDDEN (with audit record). Extended `CreditOverride` entity to support `SALES_INVOICE` source type.

**Files changed:**
- `backend/src/domain/sales/entities/CreditOverride.ts` — Extended source type union
- `backend/src/domain/sales/errors/CreditLimitExceededError.ts` — Added fields
- `backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts` — Credit check logic
- `backend/src/application/sales/use-cases/QuoteUseCases.ts` — Updated return type
- `backend/src/api/controllers/sales/SalesController.ts` — DI wiring
- `backend/src/api/controllers/sales/SalesOperationalController.ts` — DI wiring
- `backend/src/api/errors/errorHandler.ts` — Error mapping
- `backend/src/tests/application/sales/CreditCheckOnDirectSI.test.ts` — NEW: 7 tests
- `backend/src/tests/application/sales/PromotionAutoApplication.test.ts` — Updated return type
- `frontend/src/api/salesApi.ts` — Added creditOverrideReason
- `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx` — Override dialog + WARN banner

### E.5 — Backorder / Partial-Fulfillment Frontend UX
**Problem:** Backend supports partial fulfillment but frontend didn't show fulfillment progress or backorder actions.

**Solution:** Added fulfillment visibility to DN and SO detail pages. DN shows Ordered vs Delivered columns with Partial/Fulfilled badges when linked to an SO. SO shows per-line progress bars and aggregate fulfillment stats. "Create Backorder DN" button on partially-delivered notes.

**Files changed:**
- `frontend/src/modules/sales/pages/DeliveryNoteDetailPage.tsx` — Fulfillment badges + backorder button
- `frontend/src/modules/sales/pages/SalesOrderDetailPage.tsx` — Fulfillment progress section
- `frontend/src/locales/en/common.json` — 10 i18n keys
- `frontend/src/locales/ar/common.json` — 10 Arabic keys
- `frontend/src/locales/tr/common.json` — 10 Turkish keys

---

## End-User View

### Quote Numbers Are Now Sequential
Sales quotes now use proper sequential numbering (QT-00001, QT-00002, etc.) instead of random timestamps. You can configure the prefix and starting number in **Sales Settings → Document Numbering**.

### AI Assistant Stability
The AI assistant's credit system is now fully tested and stable. All 35 `SendChatMessage` tests pass, fixing 3 previously failing credit-mode tests.

### Promotions Apply Automatically
When you create a Sales Order or a direct Sales Invoice, promotion rules (Buy X Get Y, Threshold Discount) are now automatically evaluated and applied. You'll see:
- **Line discounts** automatically applied with the promotion name shown on each line
- **Free goods** added as zero-price line items
- Manual discounts always take priority over auto-applied promotions

### Credit Check on Direct Invoices
If you create a Sales Invoice directly (without a Sales Order) for a customer who has a credit limit:
- **BLOCK policy**: The system prevents the invoice if it would exceed the credit limit. You can override with a reason.
- **WARN policy**: The invoice is created with a warning banner.
- Override audit records are created for compliance tracking.

### Fulfillment Progress Visibility
- **Delivery Note detail**: When a DN is linked to a Sales Order, you now see the ordered quantity next to the delivered quantity. Lines are labeled "Partial" (amber) or "Fulfilled" (green). A "Create Backorder Delivery Note" button appears for partially-shipped orders.
- **Sales Order detail**: A new "Fulfillment Progress" section shows per-line delivery progress with visual bars and aggregate statistics (total ordered, total delivered, overall percentage).

## Documentation Updated

| Document | Change |
|----------|--------|
| `docs/architecture/sales.md` | Updated status line + "What Is NOT Implemented" table (3 Phase E items moved to Implemented) |
| `docs/user-guide/sales/promotions.md` | Added auto-application section (how promotions now auto-apply on SO/SI creation) |
| `docs/user-guide/sales/credit-limits.md` | Added direct SI credit check + override FAQ entries |
| `docs/user-guide/sales/backorder-fulfillment.md` | NEW — fulfillment progress + backorder DN creation guide |
| `docs/user-guide/sales/README.md` | Added link to backorder-fulfillment guide |
| `planning/done/120-phase-e-sales-cleanup.md` | This completion report |

---

## Test Results Summary

| Suite | Tests | Result |
|-------|-------|--------|
| QuoteLifecycle | 14 | ✅ Pass |
| QuoteSequence | 5 | ✅ Pass |
| PromotionAutoApplication | 7 | ✅ Pass |
| CreditCheckOnDirectSI | 7 | ✅ Pass |
| CreditLimitEnforcement | 12 | ✅ Pass |
| SendChatMessageUseCase | 35 | ✅ Pass |
| AiModelCertificationUseCase | 8 | ✅ Pass |
| All Sales tests | 248 | ✅ Pass |
| **Total** | **290** | **✅ All green** |

---

## Known Follow-ups

- Email delivery execution remains a follow-up channel under the D.8 messaging provider abstraction
- `record_change_logs` Firestore composite index needs production deployment
- Free-canvas invoice designer is deferred (controlled template model in use)
- Frontend dev server not started (brief rule: no servers in parallel worktree)