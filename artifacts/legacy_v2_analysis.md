# Legacy vs V2 Entity Analysis

## Executive Summary

The ERP03 backend has **two parallel voucher entity systems** that are causing confusion, bugs, and maintenance headaches. This document analyzes the situation and recommends a migration path.

---

## The Two Systems

### 1. Legacy System (Original)

**Location:** `src/domain/accounting/entities/Voucher.ts` + `VoucherLine.ts`

**Used by:**
| Component | File |
|-----------|------|
| Legacy Repository Interface | `src/repository/interfaces/accounting/IVoucherRepository.ts` |
| Firestore Repository | `src/infrastructure/firestore/repositories/accounting/FirestoreVoucherRepository.ts` |
| Prisma Repository | `src/infrastructure/prisma/repositories/PrismaVoucherRepository.ts` |
| DI Container | `src/infrastructure/di/bindRepositories.ts` |
| Mappers | `src/infrastructure/firestore/mappers/AccountingMappers.ts` |
| DTOs | `src/api/dtos/AccountingDTOs.ts` |

**Structure:**
```typescript
class Voucher {
  id, companyId, type, date, currency, exchangeRate, status,
  totalDebit, totalCredit, createdBy, reference, lines[]
}

class VoucherLine {
  id, voucherId, accountId, description, fxAmount, baseAmount,
  debitFx, creditFx, debitBase, creditBase, ...
}
```

**Characteristics:**
- Mutable (public properties)
- No validation in constructor
- Uses `debitFx`/`creditFx` pattern for amounts
- No `side` property on lines

---

### 2. V2 System (ADR-005 Compliant)

**Location:** `src/domain/accounting/entities/VoucherEntity.ts` + `VoucherLineEntity.ts`

**Used by:**
| Component | File |
|-----------|------|
| V2 Domain Repository Interface | `src/domain/accounting/repositories/IVoucherRepository.ts` |
| V2 Firestore Repository | `src/infrastructure/firestore/repositories/accounting/FirestoreVoucherRepositoryV2.ts` |
| All Use Cases | `src/application/accounting/use-cases/*.ts` |
| All Strategies | `src/domain/accounting/strategies/*.ts` |
| All Handlers | `src/domain/accounting/handlers/*.ts` |
| Validation Service | `src/domain/accounting/services/VoucherValidationService.ts` |
| Ledger Repository | `src/infrastructure/firestore/repositories/accounting/FirestoreLedgerRepository.ts` |

**Structure:**
```typescript
class VoucherEntity {
  readonly id, companyId, voucherNo, type, date, description,
  currency, baseCurrency, exchangeRate, lines[], totalDebit, totalCredit,
  status, metadata, createdBy, createdAt, approvedBy, ...
  
  // Getters
  get canEdit(): boolean
  get isDraft(): boolean
  get isBalanced(): boolean
  
  // Immutable state transitions
  approve(userId): VoucherEntity
  reject(userId, reason): VoucherEntity
}

class VoucherLineEntity {
  readonly id, accountId, side: 'Debit' | 'Credit',
  amount, currency, baseAmount, baseCurrency, exchangeRate
  
  // Getters
  get debitAmount(): number  // Returns baseAmount if side='Debit', else 0
  get creditAmount(): number // Returns baseAmount if side='Credit', else 0
}
```

**Characteristics:**
- Immutable (readonly properties)
- Self-validating (throws in constructor if invalid)
- Uses `side` + `amount` pattern (cleaner)
- Rich domain methods

---

## The Problem: Mixed Usage

**Current Flow (Broken):**

```
Frontend → Controller → CreateVoucherUseCase → VoucherEntity (V2)
                                     ↓
                            voucherRepo.save(VoucherEntity)
                                     ↓
                        FirestoreVoucherRepository (Legacy)
                                     ↓
                      VoucherMapper.toPersistence(???)  ← TYPE MISMATCH!
```

The DI container injects `FirestoreVoucherRepository` (legacy) but use cases create `VoucherEntity` (V2).

### Bugs This Causes:

1. **`canEdit` undefined** - Legacy `Voucher` didn't have this getter (fixed today)
2. **Line mapping errors** - V2 uses `side`/`amount`, Legacy uses `debitFx`/`creditFx` (fixed today)
3. **Timestamp issues** - V2/Legacy have different date handling (fixed today)
4. **Type safety lost** - Everywhere we use `as any` to bypass TypeScript

---

## Recommendation: Migrate to V2 Only

### Option A: Full Migration (Recommended)

**Effort:** Medium (2-3 days)
**Risk:** Low (if done carefully)  
**Benefit:** Eliminates all entity confusion forever

**Steps:**
1. Update DI container to use `FirestoreVoucherRepositoryV2`
2. Update `VoucherMapper` to map V2 entities only
3. Update DTOs to work with V2 entities
4. Remove legacy `Voucher`, `VoucherLine` classes
5. Remove legacy `IVoucherRepository` interface (in repository/interfaces)
6. Rename `VoucherEntity` → `Voucher` (optional, for cleaner names)

### Option B: Bridge Pattern (Quick Fix)

**Effort:** Low (completed today)
**Risk:** Medium (more patches needed over time)
**Benefit:** Immediate stability

**Steps (Done Today):**
1. ✅ Add `canEdit`, `isDraft` to legacy `Voucher`
2. ✅ Update `VoucherMapper.toPersistence` to detect and handle both entity types
3. ✅ Fix timestamp handling for both types

### Option C: Parallel Repositories

**Effort:** Low
**Risk:** High (ongoing confusion)
**Benefit:** None long-term

Keep both systems running in parallel. NOT RECOMMENDED - leads to perpetual bugs.

---

## Files That Need Changes for Full Migration

### Must Update:
| File | Change |
|------|--------|
| `bindRepositories.ts` | Change `voucherRepository` getter to return `FirestoreVoucherRepositoryV2` |
| `AccountingMappers.ts` | Simplify to only handle `VoucherEntity` |
| `AccountingDTOs.ts` | Update imports to use `VoucherEntity` |
| `PrismaVoucherRepository.ts` | Update to implement V2 interface |

### Can Delete After Migration:
| File | Reason |
|------|--------|
| `src/domain/accounting/entities/Voucher.ts` | Replaced by VoucherEntity |
| `src/domain/accounting/entities/VoucherLine.ts` | Replaced by VoucherLineEntity |
| `src/repository/interfaces/accounting/IVoucherRepository.ts` | Replaced by domain interface |
| `src/infrastructure/firestore/repositories/accounting/FirestoreVoucherRepository.ts` | Replaced by V2 |

---

## Immediate Recommendation

For now, **Option B (Bridge Pattern)** has been applied to unblock you. The system should work.

However, I strongly recommend scheduling **Option A (Full Migration)** within the next sprint to:
1. Eliminate ongoing entity confusion
2. Get full type safety back
3. Simplify the codebase
4. Prevent future bugs of this same class

Would you like me to prepare a detailed migration plan or start the full migration now?
