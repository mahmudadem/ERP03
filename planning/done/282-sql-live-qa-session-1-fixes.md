# 282 — SQL Live-QA Session #1: three lifecycle bugs found & fixed (2026-07-02)

**Context:** first owner-driven browser walkthrough of the full lifecycle on the SQL stack
(local Postgres + standalone Express + Auth emulator + Vite), per `ROADMAP-PILOT.md` Phase 1.
Owner clicked from signup onward; CTO diagnosed from server logs live; fixes executed by agent.

## Session scorecard (what worked on SQL before any fixes)

Signup ✅ → login ✅ → plan selection ✅ → company creation ✅ → bundle ✅ → accounting init ✅ →
inventory items & opening-stock *entry* ✅. Every failure below was found *by clicking*, in code
paths no automated test covered.

## Bug 1 — Purchases & Sales init wizards deadlocked (BOTH lanes, incl. production)

- **Symptom:** wizard errors: `Module 'purchase' is not initialized` on
  `GET /tenant/purchase/voucher-types/catalog`.
- **Root cause:** the catalog route sat *behind* `moduleInitializedGuard`, but since the
  voucherTypesService port (Epic 275 last-mile, commit `42bcbb46`) the **init wizard itself** calls
  it pre-initialization — chicken-and-egg. Accounting has no such guard (why its wizard worked).
- **Fix:** moved `GET /voucher-types/catalog` above the guard in `purchases.routes.ts` and
  `sales.routes.ts` (param-injection middleware intact; comment added). `POST /voucher-types/install`
  deliberately left guarded — wizards never call it pre-init (install happens inside `/initialize`
  via `selectedVoucherTypes`).
- ⚠️ **Firebase-impact: Class A (shared code, both lanes).** The live production app has this bug for
  any new company running the Purchases/Sales wizard → **needs production deploy.**

## Bug 2 — GRNI validation contract mismatch (frontend vs backend)

- **Symptom:** `Default GRNI account is required for perpetual purchasing workflows.` on
  `POST /tenant/purchase/initialize` for a combination the wizard allows.
- **Root cause:** frontend (correctly) requires GRNI only when `workflowMode==='OPERATIONAL' &&
  accountingMode==='PERPETUAL'` (invoice-driven GRNs post no GL); backend required it for ALL
  perpetual setups (`PurchaseSettingsUseCases.ts` create + update paths).
- **Fix:** backend conditions aligned to the frontend contract at both sites; posting-time guard in
  `GoodsReceiptUseCases.ts:489` still protects actual GRN postings. Class A — both lanes.

## Bug 3 — OpeningStockDocument schema↔repository mismatch (SQL lane)

- **Symptom:** `PrismaClientValidationError: Unknown argument 'postedAt'` on
  `POST /tenant/inventory/opening-stock-documents/:id/post`.
- **Root cause:** `model OpeningStockDocument` lacked 6 document-level columns the repository
  writes (`postedAt`, `warehouseId`, `createAccountingEffect`, `openingBalanceAccountId`,
  `voucherId`, `totalValueBase`). Hidden from `tsc` by the untyped-payload pattern
  (`const updateData: any = {}`). Escaped Epic 275 because that sweep targeted `as any` casts.
- **Fix (rule: code/domain is truth):** columns added to schema (types mirror siblings; nullable
  where domain-optional); `createDocument` now persists all six (were silently dropped on create);
  `prisma db push` + `generate` clean; migration captured:
  `backend/prisma/migrations/20260702000000_opening_stock_document_fields_275/`.
- **Verified:** tsc 0; schema synced. Live post-retest pending (owner ended session first) —
  covered by the lifecycle smoke gate (Task 283).

## Systemic response (owner challenge: "can't you discover these before me?")

Yes — two of three were machine-discoverable. Instituted:
1. **Task 281 (running):** typed-payload sweep — re-type all ~37 untyped Prisma payload bags across
   ~25 repo files to generated Prisma input types; every hidden column mismatch becomes a compile
   error. Kills Bug-3's whole class.
2. **Task 283 (next):** API-level lifecycle smoke (`smoke:lifecycle`) — robot walkthrough of
   signup→company→bundle→init×4→post one doc of each type→POS day, against SQL, in minutes.
   Would have caught Bugs 1–3. Becomes a **gate** before human QA and before any deploy.

## Manual QA script (rerun to verify this task)

1. Fresh signup at the landing page (any new email) → plan → create company → POS-ish bundle.
2. Purchases init wizard: voucher-type list must show types (not empty/error); choose
   PERPETUAL accounting + invoice-driven workflow WITHOUT a GRNI account → must complete.
3. Sales init wizard: same catalog check.
4. Inventory: create item, opening stock document with lines → **post it** → status POSTED,
   no INFRA/validation dialog; if accounting effect enabled, voucher created & balanced.

## Files changed

`backend/src/api/routes/purchases.routes.ts`, `backend/src/api/routes/sales.routes.ts`,
`backend/src/application/purchases/use-cases/PurchaseSettingsUseCases.ts`,
`backend/prisma/schema.prisma`,
`backend/src/infrastructure/prisma/repositories/inventory/PrismaOpeningStockDocumentRepository.ts`,
`backend/prisma/migrations/20260702000000_opening_stock_document_fields_275/`.

**Deploy note:** Bugs 1–2 are live in the Firebase production lane → schedule prod deploy after
the lifecycle gate passes on both-lane verification.
