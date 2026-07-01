# Architecture: SQL/PostgreSQL Lane — Schema↔Repository Reconciliation

**Last updated:** 2026-06-30
**Status:** Implemented (Epic 275 — SQL readiness remediation)
**Scope:** `backend/src/infrastructure/prisma/repositories/**` + `backend/prisma/schema.prisma` + `backend/src/domain/**` (entities consumed by the SQL repos)

---

## Purpose

This document records the design rules and current state of the PostgreSQL/Prisma repository layer. It exists because the SQL lane previously had a structural gap between the domain entities (source of truth) and the Prisma schema — masked by ~520 `as any` casts that disabled compile-time checking. The reconciliation work is captured in detail in `planning/done/275-sql-remediation-report.md` (this session). The rules that must hold going forward are recorded here.

---

## Repository Layer Rules

### 1. `transaction?: unknown` in the interface, `Prisma.TransactionClient` in the Prisma impl

The shared DB-agnostic interface (used by both Firestore and Prisma implementations) keeps `transaction?: unknown` so the application layer can pass a backend-agnostic handle. Each implementation casts at the boundary:

```ts
// Prisma impl
async createFoo(foo: Foo, _transaction?: unknown): Promise<void> {
  const tx = (_transaction as Prisma.TransactionClient) ?? this.prisma;
  await tx.foo.create({ ... });
}
```

The `as Prisma.TransactionClient` cast is a **type-asserted boundary cast**, not a mask. `as any` is forbidden anywhere in the repository layer.

### 2. No `as any` casts anywhere

The `as any` cast was the original sin — it hid schema↔repo mismatches that became runtime `PrismaClientValidationError` dialogs. The 520-cast baseline has been reduced to 0. Casts will not be re-added. Stripping is part of the verification command (see §6).

### 3. Domain entity is the source of truth for shape

When a column is missing from the schema but the domain needs it, the schema is updated (pre-alpha; no production data). When the schema has columns the domain doesn't use, the repo drops them. The domain layer is never stripped to match the schema.

### 4. Json columns require `as unknown as Prisma.InputJsonValue`

Prisma's `Json` column type is intentionally narrow. Writing a typed array/object directly triggers TS2352 ("may be a mistake"). Use:

```ts
decisions: log.decisions as unknown as Prisma.InputJsonValue
```

Reading a Json column requires either an explicit cast `as MyShape` or a narrow interface for the JSON shape.

### 5. Scalar `companyId` + `company: { connect }` is forbidden on the same input

Prisma's `Without<UncheckedCreate, Create>` pattern disallows mixing scalar foreign keys and relation `connect` in the same `data:` object. Pick one. For most modules, the chosen form is the **relation** (`company: { connect: { id: ... } }`) — but only when no *other* relation field on the same row is required (e.g. `salesOrderId` scalar + `salesOrder` relation in the same input). When that conflict exists, fall back to scalar `companyId` and use the unchecked form.

### 6. Use `Prisma.TransactionClient` for nested transaction calls

If a public repository method accepts a transaction and uses it for **all** writes (most transactional repos do), the parameter type at the implementation boundary must be `Prisma.TransactionClient`. The shared interface stays `unknown`; the cast is at the boundary only.

---

## Schema (key models touched by the reconciliation)

### Models with new columns (added 2026-06-30)

- **`GoodsReceipt`** — `warehouseId String?`, `voucherId String?`
- **`GoodsReceiptLine`** — `lineNo Int @default(1)`, `unitCostDoc Float @default(0)`, `moveCurrency String @default("USD")`, `fxRateMovToBase Float @default(1.0)`, `fxRateCCYToBase Float @default(1.0)`, `stockMovementId String?`
- **`DeliveryNote`** — `warehouseId String?`, `cogsVoucherId String?`
- **`DeliveryNoteLine`** — `lineNo Int @default(1)`, `unitCostBase Float @default(0)`, `lineCostBase Float @default(0)`, `moveCurrency String @default("USD")`, `fxRateMovToBase Float @default(1.0)`, `fxRateCCYToBase Float @default(1.0)`, `stockMovementId String?`
- **`PurchaseReturn`** — `purchaseInvoiceId String?`, `goodsReceiptId String?`, `purchaseOrderId String?`, `returnContext String @default("DIRECT")`, `warehouseId String?`, `reason String?`, `voucherId String?`
- **`SalesReturn`** — `salesInvoiceId String?`, `deliveryNoteId String?`, `salesOrderId String?`, `returnContext String @default("DIRECT")`, `reason String?`, `revenueVoucherId String?`, `cogsVoucherId String?`
- **`LedgerEntry`** — `reconciliationId String?`, `bankStatementLineId String?`
- **`Voucher`** — `reversalOfVoucherId String?` (with self-relation `VoucherReversal`)
- **`Item`** — `uomConversions UomConversion[]` (back-relation for the new UomConversion.itemId FK)

### Models reshaped

- **`Budget`** — was a single `accountId/amount/period` row. Now: `name`, `lines Json` (BudgetLine[]), `status`, `version`, `createdBy/updatedBy`. The flat `accountId/amount/period` columns are gone.
- **`CompanyGroup`** — was a simple `name/description/parentId/companyId` row with required `companyId`. Now: `members Json` (CompanyGroupMember[]), `reportingCurrency`, `createdBy`, `companyId` is **nullable** (a CompanyGroup is a group of companies, not owned by one).
- **`UomConversion`** — added `itemId String?` (FK to Item, so per-item conversions are possible), `active Boolean @default(true)`. The unique constraint now includes `itemId` — `@@unique([companyId, itemId, fromUomId, toUomId])`.
- **`InventoryPeriodSnapshot`** — was per-item rows (`itemId/warehouseId/qty/...`). Now: one row per period with `periodEndDate DateTime`, `snapshotData Json` (InventoryPeriodSnapshotLine[]), `totalValueBase`, `totalItems`. The `@@unique([companyId, period])` enforces one row per company per period.

### Models that were *not* changed but had repo-side fixes

- **`AuditLog`** — repo now writes field-level diff into the existing `meta Json?` column instead of a set of `fieldName/oldValue/newValue/performedBy/performedAt` columns the schema never had. The audit history is preserved; the design choice is documented at the call site in `PrismaAccountRepository.recordAuditEvent`.

---

## Verification (Definition of Done)

The reconciliation is verified by:

```bash
cd backend

# 0. baseline — should be 0 (with casts in place)
npx tsc --noEmit 2>&1 | grep -c "error TS"

# 1. strip ` as any` from every repo (revertible)
node -e '...strip script...'

# 2. the authoritative count: must be 0 with the casts gone
npx tsc --noEmit 2>&1 | grep "error TS" | tee /tmp/sql_errors.txt | wc -l

# 3. ALWAYS revert when done inspecting
git checkout -- src/infrastructure/prisma/repositories
```

The reconciliation is accepted when step 2 yields **0 errors with 0 `as any` casts**. As of 2026-06-30, this is true.

---

## Round-trip verification (real Postgres)

```bash
cd backend
DB_TYPE=SQL npx ts-node --transpile-only scripts/sql-integration-275e.ts
# ALL 25 INTEGRATION CHECKS PASSED on real Postgres

DB_TYPE=SQL npm run smoke:companies
# 2 companies created end-to-end: 48-acct COA, 16 voucher types/forms, balanced journal
```

---

## Why this exists (history)

The first SQL-readiness milestone (Epic 275 sub-tasks 275a/275b/275c/275d/275e) shipped a Prisma repository twin for every Firestore repo, but the schema and the domain entities had drifted apart. The build was green because of 520 `as any` casts that hid the schema↔repo mismatches; Prisma rejected the queries at runtime as `PrismaClientValidationError`. This reconciliation closes the gap by bringing the schema up to the domain (per the product owner's 2026-06-30 decision: code is truth), removing the masking casts, and verifying with the cast-stripped sweep.

See `planning/SQL_REMEDIATION_GUIDE.md` for the full triage and `planning/done/275-sql-remediation-report.md` for the per-item resolution log.

---

## Request-path DB-agnosticism (2026-07-01)

The repository layer being DB-aware is not enough: the **request path** (controllers,
routes, services, use-cases) must also resolve everything through the DI container
(`diContainer`) so `DB_TYPE` is honored. Any code that instantiates a `Firestore*` repo
directly, or calls `admin.firestore()` / `admin.database()` unconditionally, silently
talks to Firebase even in SQL mode — a green build hides it, and it surfaces only at
runtime (wrong DB, or a hang).

**Rule:** in the request path, never `new Firestore…()` and never call `admin.database()`
unconditionally. Resolve repos/services via `diContainer.*`. If a piece is inherently
Firebase-only (e.g. Realtime DB push), provide a no-op/alternative for the SQL lane and
branch on `DB_TYPE`.

Fixes applied under this rule:
- **`FirebaseRealtimeDispatcher` → `NullRealtimeDispatcher` when `DB_TYPE==='SQL'`**
  (`infrastructure/di/bindRepositories.ts`). `notify()` is `await`ed before the HTTP
  response in create/update controllers; the Firebase dispatcher calls
  `admin.database().ref().update()`, which blocks forever when no Realtime DB exists
  (SQL lane) — freezing the request. Notifications still persist via the Prisma
  notification repo; only the RTDB *push* is skipped.
- **`CompanyController`** now resolves `diContainer.companyRepository` (was hardwired
  `FirestoreCompanyRepository` at module load).
- **`SettingsController`** (`/accounting/policy-config` GET+PUT) branches on `DB_TYPE`:
  SQL routes through `diContainer.accountingPolicyConfigProvider` (read) and
  `companyModuleSettingsRepository` (write, `company_module_settings` moduleId=`accounting`);
  the Firebase path is unchanged.

**Audit command** (should return only DB-branched Firebase else-branches):
```bash
grep -rln "new Firestore\|admin.firestore()\|admin.database()" \
  backend/src/api/controllers backend/src/api/routes backend/src/application backend/src/domain
```

### Frontend note
Some frontend services still read Firestore directly (bypassing the API), which breaks
them in SQL mode. They are being ported to the existing backend endpoints (which are
DB-agnostic and work in both lanes). Ported: `accounting/services/voucherTypesService.ts`
(→ `voucherTypeManagementApi.catalog`). Remaining: `voucher-wizard/services/voucherWizardService.ts`,
`voucher-wizard/validators/uniquenessValidator.ts`,
`tools/forms-designer/services/documentDesignerService.ts`,
`tools/forms-designer/validators/uniquenessValidator.ts`.
