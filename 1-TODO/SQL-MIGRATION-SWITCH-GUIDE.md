# SQL Migration Switch Guide

> **READ THIS BEFORE ATTEMPTING THE SWITCH FROM FIRESTORE TO SQL**

**Last Updated:** 2026-04-20  
**Migration Status:** Infrastructure Complete, Untested  
**Branch:** `feat/database-agnostic`

---

## 1. Overview

### What This Migration Is

The ERP platform supports **dual-database mode** via a single environment variable toggle:

```env
DB_TYPE=FIRESTORE  # Default — uses Firestore (Google Cloud)
DB_TYPE=SQL        # Uses PostgreSQL via Prisma ORM
```

When `DB_TYPE=SQL`, **every repository** in the system switches from Firestore to PostgreSQL. The switch is all-or-nothing — there is no per-module toggle.

### Current State

| Component | Status |
|-----------|--------|
| Prisma Schema (74 models) | ✅ Complete |
| Prisma Repositories (85 files) | ✅ Complete, zero stubs |
| DI Container SQL Toggles | ✅ 85/85 bindings |
| TypeScript Compilation | ✅ Zero errors |
| Test Suite (324 tests) | ✅ 322 pass, 2 pre-existing failures |
| **SQL Integration Tests** | ❌ **None exist yet** |
| **SQL Smoke Tests** | ❌ **Never run against real DB** |

### What Stays Firebase

These components are **inherently Firebase-dependent** and will NOT switch to SQL:

| Component | Why |
|-----------|-----|
| `tokenVerifier` | Firebase Authentication |
| `realtimeDispatcher` | Firebase Cloud Messaging for push notifications |

---

## 2. Pre-Flight Checklist

Before attempting the switch, verify ALL of the following:

### Environment
- [ ] PostgreSQL database is provisioned and accessible
  - **Local:** `postgresql://postgres:password@localhost:5432/erp_db`
  - **Supabase:** Get connection string from Settings → Database → Connection string → URI
- [ ] `DATABASE_URL` is set in `backend/.env`
- [ ] `DB_TYPE` is currently set to `FIRESTORE` (or unset — it defaults to Firestore)
- [ ] Firebase Admin SDK is configured (for auth, which stays Firebase)

### Code Health
- [ ] All 324 existing tests pass: `cd backend && npm test`
  - **Expected:** 322 pass, 2 fail (`SalesSettingsUseCases.test.ts` — pre-existing, unrelated to migration)
- [ ] TypeScript compiles cleanly: `cd backend && npx tsc --noEmit`
- [ ] You are on the `feat/database-agnostic` branch

### Database
- [ ] Schema has been pushed: `cd backend && npx prisma db push`
- [ ] System seed data has been loaded (see Section 3, Step 2)

---

## 3. Step-by-Step Switch Procedure

### Step 1: Push Schema to Database

```bash
cd backend

# Generate Prisma client
npx prisma generate

# Push schema to database (creates all tables)
npx prisma db push

# OR for production with migrations:
npx prisma migrate dev --name initial-migration
```

**Verify:** No errors. Check your database — you should see 74 tables.

### Step 2: Seed System Data

The existing seeders write to Firestore. For SQL, you need to seed:

**Minimum required seed data:**
- System voucher type definitions (Journal Entry, Payment, Receipt, etc.)
- Module registry entries
- Permission registry entries
- Bundle/plan registries (if using company wizard)

**Option A:** Run existing seeders and manually copy critical data
**Option B:** Create SQL-specific seeders (recommended for production)

```bash
# Example: Seed system voucher types (modify to use Prisma instead of Firestore)
npx ts-node src/seeder/seedSystemVoucherTypes.ts
```

**Note:** The seeder currently uses Firestore. You'll need to temporarily modify it to use Prisma, or create a new SQL seeder.

### Step 3: Switch the Toggle

```bash
# In backend/.env
DB_TYPE=SQL
```

### Step 4: Verify TypeScript Still Compiles

```bash
cd backend
npx tsc --noEmit
```

**Expected:** Zero errors. If there are errors, they are likely import path issues — fix before proceeding.

### Step 5: Run Smoke Tests (Critical Paths)

Test these flows manually or via API calls. Each one exercises multiple repositories:

#### Smoke Test 1: Company + User
```
1. Create a company
2. Create a user
3. Assign user to company with a role
4. Get company users list
```

#### Smoke Test 2: Accounting — Accounts
```
1. Create a parent account (e.g., "Assets")
2. Create a child account (e.g., "Cash")
3. Get account by ID
4. List accounts by classification
5. Update account name
6. Verify hierarchy (parent → children)
```

#### Smoke Test 3: Accounting — Vouchers
```
1. Create a draft voucher with 2 lines (debit + credit)
2. Get voucher by ID
3. Update voucher
4. Submit for approval
5. Approve voucher
6. Verify ledger entries were created
7. Check trial balance
```

#### Smoke Test 4: Inventory — Stock
```
1. Create an item
2. Create a warehouse
3. Record opening stock
4. Verify stock level
5. Record a stock movement (IN)
6. Verify stock level updated
7. Record a stock movement (OUT)
8. Verify stock level updated
```

#### Smoke Test 5: Sales — Invoice
```
1. Create a party (customer)
2. Create a sales order
3. Create a sales invoice from the order
4. Post the invoice
5. Verify voucher was created
6. Verify ledger entries
```

#### Smoke Test 6: Purchases — Invoice
```
1. Create a party (vendor)
2. Create a purchase order
3. Create a goods receipt
4. Create a purchase invoice
5. Post the invoice
6. Verify voucher was created
7. Verify ledger entries
```

### Step 6: Run Full Test Suite

```bash
cd backend
npm test
```

**Expected:** Same results as Firestore (322 pass, 2 fail). If more tests fail, investigate — the Prisma repos may have bugs.

### Step 7: Manual Frontend Testing

1. Start the backend: `cd backend && npm run serve`
2. Start the frontend: `cd frontend && npm run dev`
3. Log in and test every module through the UI
4. Pay special attention to:
   - Accounting: creating and posting vouchers
   - Inventory: stock movements and adjustments
   - Sales/Purchases: full document flows

---

## 4. Known Issues & Gotchas

### 4.1 Schema Strictness

**Firestore** accepts any field, any type, any structure. **PostgreSQL** enforces:
- NOT NULL constraints
- Foreign key constraints
- Type constraints (strings, numbers, dates)
- Unique constraints

**What this means:** Code that "works" in Firestore may fail in SQL because:
- A required field is missing (`createdBy`, `companyId`, etc.)
- A field has the wrong type (string where number expected)
- A foreign key reference doesn't exist

**How to identify:** Look for Prisma errors like:
```
Null constraint violation on the fields: (`createdBy`)
Foreign key constraint failed on the field: `accountId`
```

**How to fix:** Ensure all required fields are populated before calling `save()`.

### 4.2 Complex Operations Most Likely to Fail

| Operation | Why It's Risky |
|-----------|---------------|
| **Voucher posting** | Creates ledger entries, updates account balances — multi-table transaction |
| **Stock movement recording** | Updates stock levels with optimistic concurrency, calculates moving average cost |
| **Sales/Purchase invoice posting** | Creates vouchers + stock movements + ledger entries in one flow |
| **Year-end close** | Complex accounting operations across fiscal years |
| **FX revaluation** | Multi-currency calculations with exchange rates |

**Test these FIRST and most thoroughly.**

### 4.3 SettingsResolverSQL Is a Stub

The `SettingsResolverSQL` class returns `null` for all methods. This works for repositories that don't need Firestore collection paths, but could cause issues if any code path depends on resolved settings.

**Symptom:** `Cannot read property 'X' of null` errors when accessing settings.

**Fix:** If you encounter this, update `SettingsResolverSQL` to return actual values instead of `null`.

### 4.4 No Integration Tests for Prisma Repos

All 324 tests mock Firestore repositories. The 85 Prisma repositories have **zero test coverage**.

**Recommendation:** Before switching, write at least one integration test per module against a real PostgreSQL database.

### 4.5 Pre-Existing Test Failures

`SalesSettingsUseCases.test.ts` has 2 failing tests. These were failing **before** the migration and are unrelated to SQL. They fail because no SALES system templates are seeded in the test environment.

### 4.6 ModuleSettingsDefinition & ModulePermissionsDefinition

These models were changed from per-company to global (no `companyId`) during the migration. If your Firestore data has per-company definitions, they won't migrate correctly.

### 4.7 Array Fields

PostgreSQL supports native `String[]` arrays. The schema uses this for `modules`, `permissions`, `features`, etc. This works correctly with Prisma, but be aware that:
- Empty arrays are stored as `{}` in PostgreSQL
- Array containment queries use `array_contains` in Prisma

---

## 5. Module-by-Module Testing Checklist

Use this checklist to verify each module works correctly in SQL mode.

### Accounting
- [ ] Create account (parent)
- [ ] Create account (child, with parent)
- [ ] Update account
- [ ] List accounts by classification
- [ ] Search accounts
- [ ] Create voucher (draft)
- [ ] Update voucher
- [ ] Submit voucher for approval
- [ ] Approve voucher
- [ ] Post voucher
- [ ] Verify ledger entries created
- [ ] View trial balance
- [ ] View account statement
- [ ] Create fiscal year
- [ ] Create cost center
- [ ] Create budget
- [ ] Create bank statement
- [ ] Reconcile bank statement

### Inventory
- [ ] Create item
- [ ] Update item
- [ ] List items by type
- [ ] Search items
- [ ] Create warehouse
- [ ] Create item category
- [ ] Create UOM
- [ ] Create UOM conversion
- [ ] Record opening stock
- [ ] Record stock movement (IN)
- [ ] Record stock movement (OUT)
- [ ] Verify stock level updated
- [ ] Create stock adjustment
- [ ] Create stock transfer
- [ ] View inventory period snapshot

### Sales
- [ ] Create sales order
- [ ] Update sales order
- [ ] Create delivery note
- [ ] Create sales invoice
- [ ] Post sales invoice
- [ ] Verify voucher created
- [ ] Create sales return
- [ ] Save/load sales settings

### Purchases
- [ ] Create purchase order
- [ ] Update purchase order
- [ ] Create goods receipt
- [ ] Create purchase invoice
- [ ] Post purchase invoice
- [ ] Verify voucher created
- [ ] Create purchase return
- [ ] Save/load purchase settings

### RBAC
- [ ] Create role
- [ ] Assign role to user
- [ ] List company users
- [ ] Disable user
- [ ] Enable user
- [ ] Delete role
- [ ] Check permissions

### Core
- [ ] Create company
- [ ] Update company settings
- [ ] Save user preferences
- [ ] Load user preferences
- [ ] Enable module for company
- [ ] Disable module for company

### HR
- [ ] Create employee
- [ ] List employees
- [ ] Record attendance

### POS
- [ ] Open POS shift
- [ ] Create POS order
- [ ] Close POS shift

---

## 6. Troubleshooting Guide

### Error: "Table does not exist"

```
PrismaClientKnownRequestError: The table `main.accounts` does not exist
```

**Cause:** Schema hasn't been pushed to the database.

**Fix:**
```bash
cd backend
npx prisma db push
```

### Error: "Null constraint violation"

```
Null constraint violation on the fields: (`createdBy`)
```

**Cause:** A required field is missing. Firestore allows null/undefined, SQL doesn't.

**Fix:** Check the Prisma repository's `save()` method. Ensure all required fields are populated. Look at the Firestore version for reference.

### Error: "Foreign key constraint failed"

```
Foreign key constraint failed on the field: `accountId_foreign`
```

**Cause:** You're referencing an account/item/party that doesn't exist in the SQL database.

**Fix:** Ensure the referenced entity exists in SQL before creating the dependent record.

### Error: "Cannot read property 'X' of null"

**Cause:** `SettingsResolverSQL` returns `null`.

**Fix:** Either:
1. Update `SettingsResolverSQL` to return actual values
2. Refactor the code path to not depend on SettingsResolver in SQL mode

### Error: "Record to update not found"

```
PrismaClientKnownRequestError: Record to update not found.
```

**Cause:** Optimistic concurrency conflict (version mismatch) or the record doesn't exist.

**Fix:** Check if the record exists before updating. For stock levels, the `version` field is used for optimistic concurrency.

### Module Works in Firestore but Not SQL

**Debugging steps:**
1. Enable Prisma query logging:
   ```typescript
   // In prismaClient.ts
   const prisma = new PrismaClient({
     log: ['query', 'info', 'warn', 'error']
   });
   ```
2. Compare the Firestore document structure with the Prisma model
3. Check for missing fields, type mismatches, or null values
4. Look at the Prisma repository's `toDomain()` method — it may not be mapping fields correctly

### Performance Is Slow

**Cause:** Missing indexes.

**Fix:** Add `@@index()` to the Prisma schema for frequently queried fields, then:
```bash
npx prisma db push
```

---

## 7. Rollback Procedure

If something goes wrong in SQL mode, rolling back is instant:

### Step 1: Switch Back to Firestore

```bash
# In backend/.env
DB_TYPE=FIRESTORE
# or just remove the line — it defaults to FIRESTORE
```

### Step 2: Restart the Backend

```bash
# Stop the running server
# Then restart
cd backend && npm run serve
```

### Step 3: Verify

```bash
# Run tests to confirm everything works
cd backend && npm test
```

**Important:** Any data written to SQL during the test period will NOT be in Firestore. If you need to preserve SQL data, you'll need a reverse migration script (SQL → Firestore).

---

## 8. Important File Locations

| File | Purpose |
|------|---------|
| `backend/prisma/schema.prisma` | Database schema (74 models) |
| `backend/src/infrastructure/di/bindRepositories.ts` | DI container with all SQL toggles |
| `backend/src/infrastructure/prisma/repositories/` | All 85 Prisma repository implementations |
| `backend/src/infrastructure/prisma/PrismaTransactionManager.ts` | SQL transaction manager |
| `backend/src/infrastructure/prisma/SettingsResolverSQL.ts` | SQL settings resolver (stub) |
| `backend/src/infrastructure/prisma/providers/` | SQL policy providers |
| `backend/src/infrastructure/firestore/repositories/` | Firestore repositories (reference) |
| `backend/src/repository/interfaces/` | Repository interfaces (contracts) |
| `backend/.env` | Environment variables (DB_TYPE, DATABASE_URL) |

---

## 9. Architecture Reference

### Repository Pattern

```
┌─────────────────────────────────────────────────┐
│              Application Layer                   │
│         (Use Cases, Services)                    │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│              DI Container                        │
│  (bindRepositories.ts)                           │
│                                                  │
│  if (DB_TYPE === 'SQL') → PrismaRepository       │
│  else → FirestoreRepository                      │
└──────────┬──────────────────────┬────────────────┘
           │                      │
           ▼                      ▼
┌──────────────────┐  ┌──────────────────────────┐
│  Prisma Repos    │  │  Firestore Repos          │
│  (85 files)      │  │  (72 files)               │
│  → PostgreSQL    │  │  → Firestore              │
└──────────────────┘  └──────────────────────────┘
```

### How the `DB_TYPE` Toggle Works

Every repository getter in `bindRepositories.ts` follows this pattern:

```typescript
get voucherRepository(): IVoucherRepository {
  return DB_TYPE === 'SQL'
    ? new PrismaVoucherRepository(getPrismaClient())
    : new FirestoreVoucherRepositoryV2(getDb(), settingsResolver);
}
```

The application layer calls `diContainer.voucherRepository` — it doesn't know or care which implementation it gets back. Both implement the same `IVoucherRepository` interface.

### Firestore-Only Components

These components are NOT swappable and will always use Firebase:

| Component | Location | Purpose |
|-----------|----------|---------|
| `tokenVerifier` | `backend/src/infrastructure/auth/FirebaseTokenVerifier.ts` | JWT verification via Firebase Auth |
| `realtimeDispatcher` | `backend/src/infrastructure/realtime/FirebaseRealtimeDispatcher.ts` | Push notifications via FCM |
| `firebaseAdmin` | `backend/src/firebaseAdmin.ts` | Firebase Admin SDK initialization |

---

## 10. Quick Reference Commands

```bash
# Generate Prisma client (run after any schema change)
cd backend && npx prisma generate

# Push schema to database (development)
npx prisma db push

# Create and apply migration (production)
npx prisma migrate dev --name description

# Open Prisma Studio (visual database browser)
npx prisma studio

# Run tests
npm test

# Run single test file
npm test -- --testPathPatterns="VoucherEntity"

# TypeScript check
npx tsc --noEmit

# Start backend
npm run serve

# Start Firebase emulators (for local Firestore testing)
npm run emulators
```

---

**END OF GUIDE**
