# Phase 1 — Transaction Atomicity Fixes

> **Priority:** 🔴 P0 — Data corruption risk
> **Claims Fixed:** B (voucherRepo.save outside tx), C (deleteForVoucher not passed tx)
> **Estimated Effort:** 1 day
> **Dependencies:** None

---

## Business Context

The Firestore transaction system requires ALL reads and writes within a transaction callback to use the `transaction` object. Currently, `voucherRepo.save()` always performs a standalone write (no `transaction` parameter), and `deleteForVoucher` is called without passing the transaction in the edit-posted flow. This means:

- If Firestore retries a transaction, the voucher may reflect POSTED status while ledger entries were rolled back
- Edit-posted flow can leave an account with deleted ledger entries but a still-POSTED voucher if a failure occurs after step 1

These are **silent data corruption risks** that undermine accounting integrity.

---

## Current State

### Problem B: `FirestoreVoucherRepositoryV2.save()` has no transaction parameter

**File:** `backend/src/infrastructure/firestore/repositories/accounting/FirestoreVoucherRepositoryV2.ts` (line 22)

```typescript
async save(voucher: VoucherEntity): Promise<VoucherEntity> {
    const data = voucher.toJSON();
    // ... currency index ...
    await this.getCollection(voucher.companyId).doc(voucher.id).set(data, { merge: true });
    return voucher;
}
```

**Impact:** Every call to `voucherRepo.save()` inside a `transactionManager.runTransaction()` callback is NOT bound to the transaction. This affects:
- `CreateVoucherUseCase.execute()` — lines 480, 546
- `UpdateVoucherUseCase.execute()` — lines 827, 833
- `PostVoucherUseCase` (if it exists as separate file)

### Problem C: `deleteForVoucher` called without transaction

**File:** `backend/src/application/accounting/use-cases/VoucherUseCases.ts` (line 824)

```typescript
// Inside runTransaction callback:
await this.ledgerRepo.deleteForVoucher(companyId, voucherId);  // ← no transaction!
await this.voucherRepo.save(updatedVoucher);                   // ← also no transaction!
await this.ledgerRepo.recordForVoucher(updatedVoucher, transaction);  // ← has transaction
```

The `deleteForVoucher` method in `FirestoreLedgerRepository` already accepts an optional `transaction` parameter (line 140). The call site simply fails to pass it.

---

## Implementation Plan

### Step 1: Add `transaction` parameter to `IVoucherRepository.save()`

**File:** `backend/src/domain/accounting/repositories/IVoucherRepository.ts`

Add an optional `transaction` parameter to the `save` method signature:

```typescript
save(voucher: VoucherEntity, transaction?: any): Promise<VoucherEntity>;
```

> **Note:** Use `any` for the transaction type to keep the domain layer database-agnostic (no Firestore imports). The infrastructure layer will cast to `admin.firestore.Transaction`.

### Step 2: Update `FirestoreVoucherRepositoryV2.save()` to accept and use transaction

**File:** `backend/src/infrastructure/firestore/repositories/accounting/FirestoreVoucherRepositoryV2.ts`

Change `save()` to accept optional `transaction`:

```typescript
async save(voucher: VoucherEntity, transaction?: admin.firestore.Transaction): Promise<VoucherEntity> {
    const data = voucher.toJSON();
    
    const currencies = new Set<string>();
    currencies.add(voucher.currency.toUpperCase());
    voucher.lines.forEach(line => currencies.add(line.currency.toUpperCase()));
    data._allCurrencies = Array.from(currencies);

    const docRef = this.getCollection(voucher.companyId).doc(voucher.id);
    
    if (transaction) {
      transaction.set(docRef, data, { merge: true });
    } else {
      await docRef.set(data, { merge: true });
    }
    
    return voucher;
}
```

### Step 3: Thread `transaction` through all call sites in `VoucherUseCases.ts`

**File:** `backend/src/application/accounting/use-cases/VoucherUseCases.ts`

#### CreateVoucherUseCase.execute() (inside `runTransaction` callback)

Line 480 — change:
```typescript
await this.voucherRepo.save(voucher);
```
to:
```typescript
await this.voucherRepo.save(voucher, transaction);
```

Line 546 — change:
```typescript
await this.voucherRepo.save(postedVoucher);
```
to:
```typescript
await this.voucherRepo.save(postedVoucher, transaction);
```

#### UpdateVoucherUseCase.execute() (inside `runTransaction` callback)

Line 824 — change:
```typescript
await this.ledgerRepo.deleteForVoucher(companyId, voucherId);
```
to:
```typescript
await this.ledgerRepo.deleteForVoucher(companyId, voucherId, transaction);
```

Line 827 — change:
```typescript
await this.voucherRepo.save(updatedVoucher);
```
to:
```typescript
await this.voucherRepo.save(updatedVoucher, transaction);
```

Line 833 (non-posted path) — change:
```typescript
await this.voucherRepo.save(updatedVoucher);
```
to:
```typescript
await this.voucherRepo.save(updatedVoucher, transaction);
```

### Step 4: Thread `transaction` through PostVoucherUseCase (if separate)

Search for any other `PostVoucherUseCase` class or any other use case that calls `voucherRepo.save()` inside a `runTransaction()` callback. Fix all instances.

Use this search command to find all call sites:
```bash
cd backend && npx grep -rn "voucherRepo.save\|this\.voucherRepo\.save" src/application/ src/api/
```

### Step 5: Update `IVoucherRepository` interface for `delete` method as well

Check if `delete()` is also called inside transactions and needs the same treatment.

### Step 6: Verify `ITransactionManager` passes transaction to callbacks correctly

**File:** Locate `ITransactionManager` implementation (likely in `backend/src/infrastructure/firestore/`)

Confirm that `runTransaction(callback)` passes the Firestore `Transaction` object to the callback. Verify the type matches what repos expect.

---

## Files Changed

| File | Change |
|------|--------|
| `backend/src/domain/accounting/repositories/IVoucherRepository.ts` | Add optional `transaction` param to `save()` |
| `backend/src/infrastructure/firestore/repositories/accounting/FirestoreVoucherRepositoryV2.ts` | Use `transaction.set()` when tx provided |
| `backend/src/application/accounting/use-cases/VoucherUseCases.ts` | Thread `transaction` to all `save()` and `deleteForVoucher()` calls inside tx callbacks |
| Any other use case with `voucherRepo.save` inside `runTransaction` | Same pattern |

---

## Verification Plan

### Automated Tests

1. **Existing tests must pass:**
   ```bash
   cd backend && npx jest --testPathPattern="VoucherPersistence|GovernancePolicy" --no-coverage
   ```

2. **New test: Transaction atomicity** — Create or add to `backend/src/tests/application/accounting/use-cases/VoucherPersistence.test.ts`:
   - Test that `save()` receives a `transaction` argument when called inside `runTransaction`
   - Test that `deleteForVoucher()` receives a `transaction` argument in the edit-posted path
   - Mock the transaction manager to capture args

### Manual Verification

1. **TypeScript compilation:**
   ```bash
   cd backend && npx tsc --noEmit
   ```
   Must compile cleanly with no type errors.

2. **Search for remaining unsafe calls:**
   ```bash
   cd backend && grep -rn "\.save(" src/application/ | grep -v "transaction"
   ```
   Should return 0 results inside `runTransaction` callbacks.

---

## Acceptance Criteria

- [ ] `IVoucherRepository.save()` accepts an optional `transaction` parameter
- [ ] `FirestoreVoucherRepositoryV2.save()` uses `transaction.set()` when transaction is provided
- [ ] ALL `voucherRepo.save()` calls inside `runTransaction` callbacks pass the `transaction`
- [ ] `deleteForVoucher()` in `UpdateVoucherUseCase` line 824 passes the `transaction`
- [ ] `npx tsc --noEmit` passes cleanly
- [ ] Existing tests pass
- [ ] No `voucherRepo.save(...)` call inside a `runTransaction` callback omits the `transaction` parameter
- [ ] Completion report created at `1-TODO/done/34-phase1-completion-report.md`

---

## STRICT RULES FOR EXECUTOR

1. **DO NOT** add any new features. This is a fix-only phase.
2. **DO NOT** change any business logic. Only thread the `transaction` parameter.
3. **DO NOT** change any method signatures beyond adding the optional `transaction` param.
4. **DO NOT** modify frontend code.
5. **DO NOT** change test expectations — only add new tests.
6. Keep `transaction` as `any` type in domain/application layers (no Firestore imports).
