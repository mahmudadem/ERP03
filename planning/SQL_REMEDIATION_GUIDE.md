# SQL Lane Remediation Guide — Prisma Schema ↔ Repository Mismatches

> **Status:** SQL lane is **NOT deploy-ready and NOT test-ready.** A green build is meaningless here — see root cause.
> **Author:** investigation session 2026-06-30 (Claude, worktree `codex/sql-readiness-wip-20260628`).
> **For:** the agent picking up the SQL fix work. Read this top-to-bottom before touching code.

---

## 1. Root cause (read this first)

The Prisma schema (`backend/prisma/schema.prisma`) and the repository layer
(`backend/src/infrastructure/prisma/repositories/**`) were written to **different shapes of the
same entities** and never reconciled. The mismatch is hidden because the repositories contain
**520 `as any` casts across 95 files** — almost every `data:` / `where:` object passed to Prisma is
cast to `any`, which switches off the exact compile-time type-checking that would have caught the
problem.

Consequence:

- `npm run build` / `tsc --noEmit` passes with **0 errors**.
- Prisma is the **first layer that actually validates the queries**, and it does so **at runtime**,
  throwing `PrismaClientValidationError` (the "Critical Error / INFRA_999" dialogs the product owner
  is seeing — e.g. `Argument userId is missing`, `Unknown argument itemId`).

**This is not a handful of typos. It is a structural gap between schema and code.**

---

## 2. How to reproduce the definitive list (do this first, then re-run to verify fixes)

The static count undercounts. The authoritative method is to strip the masking casts and let
TypeScript + the generated Prisma client report every mismatch. **It is fully revertible** — the repo
files are git-tracked.

```bash
cd backend

# 0. baseline — confirms casts hide everything (should print 0)
npx tsc --noEmit 2>&1 | grep -c "error TS"

# 1. strip ` as any` everywhere in the repo layer EXCEPT ` as any[` / ` as any<` (those are real type casts)
node -e '
const fs=require("fs"),path=require("path");
function walk(d){let o=[];for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())o=o.concat(walk(p));else if(e.name.endsWith(".ts")&&!e.name.endsWith(".test.ts"))o.push(p);}return o;}
for(const f of walk("src/infrastructure/prisma/repositories")){let s=fs.readFileSync(f,"utf8");s=s.replace(/\s+as\s+any\b(?!\s*[\[<])/g,"");fs.writeFileSync(f,s);}
'

# 2. the real error list
npx tsc --noEmit 2>&1 | grep "error TS" | tee /tmp/sql_errors.txt | wc -l

# 3. ALWAYS revert when done inspecting
git checkout -- src/infrastructure/prisma/repositories
```

As of 2026-06-30 this surfaced **96 errors across 41 files in every module**
(accounting, sales, purchases, inventory, designer, pos, system, super-admin, reporting,
communications, core, shared). Use that as the working backlog. Re-run after each batch of fixes —
the number must trend to 0 **and stay 0 with the casts removed.**

> ⚠️ The strip script above is also how you should *leave* the code eventually: the end-state goal is
> that these repos compile **without** the `as any` casts. Removing the casts permanently (after fixing
> the underlying mismatches) is what prevents this rot from recurring.

---

## 3. The findings, by category — each category has a DIFFERENT fix

### Category A — Real schema/column mismatch → **RUNTIME THROWERS** (highest priority)

These write or read columns that do not exist, or omit required columns. **These are the dialogs the
product owner is hitting.** My recommendation is in the last column.

> ✅ **DECISION RESOLVED (product owner, 2026-06-30): code/domain is the source of truth — bring the
> schema up to match the domain entities.** I verified each "DECISION NEEDED" item against its domain
> entity in `src/domain/**`; in every case the domain class already encodes the intended, fuller shape
> and the Prisma schema is simply behind. No production data exists, so **add the missing columns /
> change the shape + migrate** rather than stripping features out of the code. Specifics below; the
> only remaining freedom is the cosmetic storage choice noted on InventoryPeriodSnapshot.

| File | Problem | Recommended fix direction |
|---|---|---|
| `accounting/PrismaAccountRepository.ts:320` | `auditLog.create` writes `fieldName/oldValue/newValue/performedBy/performedAt` + `company.connect`; omits required `userId`. Schema `AuditLog` only has `action/entityType/entityId/userId/companyId/timestamp/meta`. | **Code → schema.** Pack the field-level diff into `meta` (Json), set `userId` from `event.changedBy`, use `companyId` scalar (not `company.connect`). Field-level audit columns aren't in the schema by design. |
| `accounting/PrismaBudgetRepository.ts:16,32,63` | Writes `lines[]/status/createdBy/updatedBy`; omits required `accountId/amount/period`. Schema `Budget` is a single account-amount-period row. | ✅ **RESOLVED → code is truth.** Domain `Budget` (`src/domain/accounting/entities/Budget.ts`) has `lines: BudgetLine[]` (each with `monthlyAmounts[12]`), `status`, `version`, `createdBy/By`. **Reshape schema `Budget`** to hold lines (Json column **or** a `BudgetLine` child table) + `status`/`version`/`createdBy`; drop the flat `accountId/amount/period` requirement. Migrate. |
| `accounting/PrismaCompanyGroupRepository.ts:13,28` | Writes `members[]/reportingCurrency/createdBy`; omits required `companyId`. Schema `CompanyGroup` has `name/description/parentId/companyId`. | ✅ **RESOLVED → code is truth.** Domain `CompanyGroup` has `members: CompanyGroupMember[]` (min 2) + `reportingCurrency` + `createdBy`; it has **no single `companyId`**. **Add** `reportingCurrency`/`createdBy` columns and a `members` representation (Json or child table); **make schema's `companyId` optional/remove it** (the entity is a group of companies, not owned by one). Migrate. |
| `accounting/PrismaLedgerRepository.ts:268,269,388,389` | Reads `entry.baseAmount` / `entry.amount`; schema `LedgerEntry` has `debit/credit/balance`, no `amount`/`baseAmount`. | ✅ **RESOLVED → code fix (no schema change).** Derive `amount = debit - credit` and `baseAmount` via `exchangeRate`. Confirm sign convention against the accounting engine. |
| `accounting/PrismaLedgerRepository.ts:351` | `update` sets `reconciliationId/bankStatementLineId`; not in schema. | ✅ **RESOLVED → code is truth.** Bank reconciliation is a real feature. **Add nullable `reconciliationId` + `bankStatementLineId` columns** (FK where applicable) to `LedgerEntry`. Migrate. |
| `inventory/PrismaInventoryPeriodSnapshotRepository.ts:34,41` | Upserts `snapshotData(Json blob)/totalValueBase/totalItems`; schema models **per-item rows** (`itemId/warehouseId/qty/...`). | ✅ **RESOLVED → code is truth.** Domain `InventoryPeriodSnapshot` stores the whole period as ONE record: `snapshotData: InventoryPeriodSnapshotLine[]` + `totalValueBase` + `totalItems` + `periodKey`/`periodEndDate`. **Reshape schema to one-row-per-period** with a Json `snapshotData` column. *(Cosmetic freedom: a child-table layout is acceptable if preferred, but the one-row Json form matches the domain and is simplest.)* Migrate. |
| `inventory/PrismaUomConversionRepository.ts` (`getConversionsForItem`, `updateConversion:27`) | Filters/needs `itemId` + `active`; schema `UomConversion` has neither (it's company-level `fromUomId/toUomId/factor`). | ✅ **RESOLVED → code is truth.** Domain `UomConversion` **requires `itemId`** (constructor throws without it) and has `active`. **Add `itemId` (FK to Item) + `active` (default true) columns**; update the `@@unique` to include `itemId`. This is the owner's 2nd screenshot. Migrate. |
| `purchases/PrismaGoodsReceiptRepository.ts:19,20` | Reads `gr.currency/gr.exchangeRate` off domain entity that lacks them. | **Code fix** (domain entity / mapping). Low risk. |
| `purchases/PrismaPurchaseInvoiceRepository.ts:19,84` | Reads `pi.goodsReceiptId` off domain entity that lacks it. | **Code fix** (domain entity / mapping). |
| `sales/PrismaDeliveryNoteRepository.ts:19,20` | Reads `dn.currency/dn.exchangeRate` off domain entity that lacks them. | **Code fix.** |

### Category B — JSON column type-strictness → **type-only, runs fine** (lower priority)

`TS2322: Type 'X[]' is not assignable to type 'JsonNull | InputJsonValue'`. The repo writes a typed
array/object into a `Json` column. **Prisma accepts this at runtime** — these are NOT causing the error
dialogs. The `as any` was just silencing strictness.

- **Fix:** cast with `as Prisma.InputJsonValue` (import `Prisma` from `@prisma/client`) or
  `JSON.parse(JSON.stringify(x))`. Do **not** change the schema.
- **Files:** `accounting/PrismaPostingLogRepository.ts:38`, `communications/PrismaCommunicationsSettingsRepository.ts:26,29`,
  `designer/PrismaFormDefinitionRepository.ts:17,18,30,31`, `designer/PrismaVoucherTypeDefinitionRepository.ts:18,19,40,41`,
  `designer/PrismaFormSettingsRepository.ts:90,93`, `inventory/PrismaItemRepository.ts:18,43`,
  `pos/PrismaPosReceiptRepository.ts:20`, `pos/PrismaPosReturnRepository.ts:20`,
  `sales/PrismaPriceListRepository.ts:40,59`, `sales/PrismaPromotionRuleRepository.ts:56,57,81,82`,
  `purchases/PrismaPurchasePriceListRepository.ts:40,59`, `system/PrismaIdempotencyKeyRepository.ts:41,50`,
  `system/PrismaRecordChangeLogRepository.ts:36,40`.

### Category C — Reading off `JsonValue` / bad spread → **type-only, but verify shape** (lower priority)

`TS2339: Property 'X' does not exist on type 'JsonValue'` and `TS2698: Spread types...`. Code reads a
property off a Json column without narrowing the type.

- **Fix:** define an interface for the JSON shape and cast on read
  (`const v = record.col as MyShape`). Verify the shape matches what's written.
- **Files:** `designer/PrismaFormSettingsRepository.ts:81`, `system/PrismaModuleSettingsDefinitionRepository.ts:17,33`,
  `system/PrismaCompanyModuleSettingsRepository.ts:44`, `core/PrismaUserPreferencesRepository.ts:49,55` (spread),
  `super-admin/PrismaBundleRegistryRepository.ts:86` (spread), `PrismaVoucherRepository.ts:269` (`reversalOfVoucherId` not a `VoucherWhereInput` field — **may be Category A**, verify against schema).

### Category D — 🔴 Type-checking entirely DISABLED (highest hidden risk — check FIRST)

15 repos use `const tx = (_transaction as any) || this.prisma;`. Because `_transaction` is typed
`unknown`, `tx` becomes `unknown`, so **every `tx.<model>.create({ data })` in these files is
completely unchecked — even in normal (non-transaction) operation.** The strip-sweep cannot see
their data-object mismatches; they show only as `Property '<model>' does not exist on type 'unknown'`.
**These are the core ERP transactional documents.** There may be Category-A runtime throwers hiding here.

- **Fix:** type the transaction param properly so checking turns back on, then re-run the sweep:
  ```ts
  import { Prisma, PrismaClient } from '@prisma/client';
  async create(x: Foo, _transaction?: Prisma.TransactionClient): Promise<void> {
    const tx = _transaction ?? this.prisma;   // no `as any`
    await tx.salesOrder.create({ data: { ... } });  // now type-checked
  }
  ```
  Then fix whatever new errors appear (likely more Category A).
- **Files (15):** `inventory/PrismaInventoryRevaluationRepository.ts`, `inventory/PrismaOpeningStockDocumentRepository.ts`,
  `inventory/PrismaStockAdjustmentRepository.ts`, `inventory/PrismaStockMovementRepository.ts`,
  `inventory/PrismaStockLevelRepository.ts`, `purchases/PrismaGoodsReceiptRepository.ts`,
  `purchases/PrismaPurchaseInvoiceRepository.ts`, `purchases/PrismaPurchaseOrderRepository.ts`,
  `purchases/PrismaPurchaseReturnRepository.ts`, `reporting/PrismaSalesProfitLineFactRepository.ts`,
  `sales/PrismaDeliveryNoteRepository.ts`, `sales/PrismaSalesInvoiceRepository.ts`,
  `sales/PrismaSalesOrderRepository.ts`, `sales/PrismaSalesReturnRepository.ts`,
  `sales/PrismaSalesSettingsRepository.ts`, `shared/PrismaPaymentHistoryRepository.ts`.

---

## 4. Decision framework (for "schema is truth" vs "code is truth")

The product owner left this open. Use this rule, and **flag genuine product decisions instead of
guessing** (the rows marked "DECISION NEEDED" above):

1. **No production data exists** (pre-alpha) → migrations are free; "change the schema" is cheap.
2. If the extra fields the code wants are a **real, intended feature** (field-level audit, budget lines,
   bank-rec links, consolidation members, per-item UOM) → **code is truth → add columns + migration**,
   UNLESS an architect says the feature is out of scope for SQL v1.
3. If the extra fields are **leftover/half-built cruft** → **schema is truth → simplify the code.**
4. When unsure which, **stop and ask the product owner** — these change product behaviour. The
   "DECISION NEEDED" rows are exactly those.

---

## 5. Recommended execution order

1. **Category D first** — re-type the 15 tx-pattern repos, re-run the sweep. This reveals the true
   total before you start fixing data objects. (Core ERP flows; highest hidden risk.)
2. **Category A** — the confirmed runtime throwers. All fix directions are now resolved (see the
   ✅ notes in the table — code is truth; add/reshape schema columns + migrate, or apply the small code
   fixes). No owner escalation pending. Group the schema changes into one migration where practical.
3. **Categories B & C** — type-only cleanups; safe to batch.
4. **Remove the `as any` casts permanently** in each file as you fix it. Final acceptance: the
   strip-sweep (Section 2) yields **0 errors** and the casts are gone.

### Definition of Done for this remediation
- [ ] Sweep in §2 reports **0 errors with casts removed**, and the casts are actually deleted (not re-added).
- [ ] Each "DECISION NEEDED" item resolved by the product owner and implemented.
- [ ] Manual round-trip QA in **SQL mode** (`DB_TYPE=SQL` in `.env.local`) for each fixed module —
      remember the emulator serves compiled `lib/`, so `npm run build` before testing.
- [ ] `docs/architecture/<module>.md` notes the schema/repo reconciliation.
- [ ] `planning/JOURNAL.md` + `planning/ACTIVE.md` updated; completion report in `planning/done/`.

---

## 6. Important caveats
- **Do not trust a green build.** Until the `as any` casts are gone, `tsc` proves nothing about Prisma
  correctness. The only valid green is "green with casts stripped."
- **`tsc --noEmit` is not enough to deploy** — the emulator serves compiled `lib/`; run `npm run build`
  and do a real round-trip (per `memory: backend_emulator_serves_compiled_lib`).
- Firestore lane is unaffected (it doesn't use these Prisma repos). This is **SQL-lane only.**
