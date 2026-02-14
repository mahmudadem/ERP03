# 07 — Voucher Numbering Sequences

> **Priority:** P1 (High)
> **Estimated Effort:** 2 days
> **Dependencies:** None

---

## Business Context

In professional accounting, voucher numbers must be:
- **Sequential** — JE-001, JE-002, JE-003 (no random IDs)
- **Gap-free** — Missing numbers raise audit red flags
- **Unique per type** — Each voucher type has its own sequence (JE-, PV-, RV-)
- **Optionally reset per fiscal year** — JE-2026-001, JE-2027-001

The current system generates voucher numbers but there's no atomic counter, no gap detection, and no configurable format. This is an **audit compliance issue** — any external auditor will flag gap-filled or out-of-sequence voucher numbers.

---

## Current State

- ✅ Voucher types have prefix (JE-, PV-, RV-, OB-)
- ✅ Voucher number stored on `VoucherEntity.voucherNo`
- ❌ No dedicated sequence/counter collection in Firestore
- ❌ No atomic increment (risk of duplicates under concurrency)
- ❌ No configurable format (prefix-year-sequence, etc.)
- ❌ No gap detection or reporting

---

## Requirements

### Functional
1. Atomic sequence counter per voucher type per company
2. Configurable format: `{PREFIX}-{COUNTER}` or `{PREFIX}-{YYYY}-{COUNTER}`
3. Optional: reset counter annually (when fiscal year management exists)
4. Gap detection report (list missing numbers in a range)
5. Admin ability to set the next number (for migration from legacy systems)

### Non-Functional
- Must be atomic/transaction-safe (Firestore transactions)
- No duplicates even under concurrent voucher creation
- Backward compatible (existing vouchers keep their numbers)

---

## Implementation Plan

### Step 1: Backend — Sequence Counter Entity + Repository

**File:** `backend/src/domain/accounting/entities/VoucherSequence.ts` (NEW)

```typescript
export interface VoucherSequence {
  id: string;           // e.g., "JE" or "JE-2026"
  companyId: string;
  prefix: string;       // "JE"
  year?: number;        // 2026 (if year-based reset)
  lastNumber: number;   // Current counter value
  format: string;       // "{PREFIX}-{COUNTER:4}" or "{PREFIX}-{YYYY}-{COUNTER:4}"
  updatedAt: Date;
}
```

**File:** `backend/src/repository/interfaces/accounting/IVoucherSequenceRepository.ts` (NEW)

```typescript
export interface IVoucherSequenceRepository {
  getNextNumber(companyId: string, prefix: string, year?: number): Promise<string>;
  getCurrentSequence(companyId: string, prefix: string): Promise<VoucherSequence | null>;
  setNextNumber(companyId: string, prefix: string, nextNumber: number): Promise<void>;
  listSequences(companyId: string): Promise<VoucherSequence[]>;
}
```

**File:** `backend/src/infrastructure/firestore/repositories/accounting/FirestoreVoucherSequenceRepository.ts` (NEW)

Key implementation detail — use Firestore transaction for atomic increment:
```typescript
async getNextNumber(companyId: string, prefix: string, year?: number): Promise<string> {
  const docRef = db.collection('companies').doc(companyId)
    .collection('voucherSequences').doc(year ? `${prefix}-${year}` : prefix);
  
  return db.runTransaction(async (txn) => {
    const doc = await txn.get(docRef);
    const current = doc.exists ? doc.data()!.lastNumber : 0;
    const next = current + 1;
    txn.set(docRef, { prefix, lastNumber: next, year, updatedAt: new Date() }, { merge: true });
    
    const padded = String(next).padStart(4, '0'); // e.g., "0001"
    return year ? `${prefix}-${year}-${padded}` : `${prefix}-${padded}`;
  });
}
```

### Step 2: Integrate into Voucher Creation

**File:** `backend/src/application/accounting/use-cases/VoucherUseCases.ts` (MODIFY — `CreateVoucherUseCase`)

Replace current voucher number generation with:
```typescript
const voucherNo = await this.sequenceRepo.getNextNumber(companyId, prefix, fiscalYear);
```

### Step 3: Settings Configuration

**File:** `frontend/src/modules/accounting/pages/AccountingSettingsPage.tsx` (MODIFY)

Add "Voucher Numbering" section:
- View current sequences per voucher type
- Toggle: reset counters annually
- Set next number (admin-only, for migration)
- Format preview: "JE-0042" or "JE-2026-0042"

### Step 4: Gap Detection Report (Optional)

**File:** `backend/src/application/accounting/use-cases/VoucherNumberingUseCases.ts` (NEW)

```typescript
export class DetectVoucherGapsUseCase {
  async execute(companyId: string, prefix: string, fromNumber: number, toNumber: number) {
    // Query all voucher numbers with this prefix in range
    // Find missing numbers
    // Return list of gaps
  }
}
```

---

## Verification Plan

### Automated
1. **Unit test** — `backend/src/tests/domain/accounting/VoucherSequence.test.ts`
   - Test atomic increment produces sequential numbers
   - Test format generation with padding
   - Test year-based reset
   - Command: `cd backend && npx jest --testPathPattern=VoucherSequence`

### Manual
1. Create 5 vouchers rapidly → verify sequential numbers (JE-0001 through JE-0005)
2. Open two browser tabs → create vouchers simultaneously → verify no duplicate numbers
3. Check Settings → Voucher Numbering → verify current counter displays correctly
4. Set next number to 100 → create a voucher → verify it gets JE-0100

---

## Acceptance Criteria

- [ ] Voucher numbers are sequential and gap-free under normal operation
- [ ] Concurrent creation doesn't produce duplicate numbers
- [ ] Numbers can be reset annually (when fiscal year management is enabled)
- [ ] Admin can view and adjust the current counter
- [ ] Format is configurable (at least prefix + zero-padded counter)
- [ ] Existing vouchers retain their current numbers
