# 08 — Journal / Day Book Report

> **Priority:** P1 (High)
> **Estimated Effort:** 2 days
> **Dependencies:** None

---

## Business Context

A **Journal** (or Day Book) report shows **vouchers** in chronological order with all their debit/credit lines — it's the fundamental record of all financial transactions. This is different from the General Ledger, which is organized by **account**.

Currently, the `/reports/journal` endpoint reuses `getGeneralLedger` — it returns individual ledger entries rather than vouchers grouped with their lines. A real journal report should show each voucher as a block with its complete entry.

---

## Current State

- ✅ `/reports/journal` route exists
- ✅ `GetJournalUseCase` exists
- ❌ `GetJournalUseCase.execute()` calls `ledgerRepo.getGeneralLedger()` — same as GL, not a real journal
- ❌ No frontend journal page (only General Ledger page exists)
- ❌ No voucher-grouped view

---

## Requirements

### Functional
1. Show vouchers grouped by date, each with its complete debit/credit lines
2. Date range filter
3. Voucher type filter (show only JE, or only PV, etc.)
4. Each voucher block shows: Voucher No, Date, Type, Description, and then the lines table
5. Grand totals at the bottom (total debits, total credits)
6. Print-friendly layout
7. Voucher number links to open the voucher

### Layout
```
═══════════════════════════════════════════════════════════
JOURNAL ENTRIES — January 2026
═══════════════════════════════════════════════════════════

Date: 2026-01-05     Voucher: JE-0001     Type: Journal Entry
Description: Record monthly rent expense
┌──────────────────┬────────────┬────────┬─────────┐
│ Account          │ Description│  Debit │  Credit │
├──────────────────┼────────────┼────────┼─────────┤
│ 5010 - Rent Exp  │ Office rent│ 2,000  │         │
│ 1101 - Cash Bank │ Rent pay   │        │  2,000  │
└──────────────────┴────────────┴────────┴─────────┘

Date: 2026-01-08     Voucher: RV-0003     Type: Receipt Voucher
Description: Customer payment - Invoice #1234
┌──────────────────┬────────────┬────────┬─────────┐
│ Account          │ Description│  Debit │  Credit │
├──────────────────┼────────────┼────────┼─────────┤
│ 1101 - Cash Bank │ Receipt    │ 5,000  │         │
│ 1200 - Acc Recv  │ Inv #1234  │        │  5,000  │
└──────────────────┴────────────┴────────┴─────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTALS                     Debit: 7,000    Credit: 7,000    ✓ Balanced
```

---

## Implementation Plan

### Step 1: Backend — New Journal Query

**File:** `backend/src/repository/interfaces/accounting/ILedgerRepository.ts` (MODIFY)

Add method:
```typescript
getJournal(companyId: string, filters: JournalFilters): Promise<JournalEntry[]>;

interface JournalFilters {
  fromDate?: string;
  toDate?: string;
  voucherType?: string;
}

interface JournalEntry {
  voucherId: string;
  voucherNo: string;
  date: string;
  type: string;
  description: string;
  status: string;
  currency: string;
  lines: JournalLine[];
}

interface JournalLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  description: string;
  debit: number;
  credit: number;
  currency?: string;
  exchangeRate?: number;
}
```

Implementation: query vouchers in date range, then for each voucher load its lines from the ledger, grouped together.

### Step 2: Update Use Case

**File:** `backend/src/application/accounting/use-cases/LedgerUseCases.ts` (MODIFY — `GetJournalUseCase`)

Replace the current implementation that calls `getGeneralLedger` with a call to `getJournal`.

### Step 3: Frontend — Journal Page

**File:** `frontend/src/modules/accounting/pages/JournalPage.tsx` (NEW)

- Date range picker
- Voucher type filter dropdown
- Render each voucher as a card/block with its lines inside
- Grand totals footer
- Print button

### Step 4: Add Route + Navigation

Add to routing and reports menu.

---

## Verification Plan

### Manual
1. Create several vouchers of different types with multiple lines
2. Navigate to Journal report
3. Verify vouchers appear grouped with their lines
4. Verify date range filter works
5. Verify voucher type filter works
6. Verify totals are correct
7. Print → verify layout is clean and each voucher block is together (no page break in the middle)

---

## Acceptance Criteria

- [ ] Journal shows vouchers grouped by date with their lines
- [ ] Date range and type filters work
- [ ] Grand totals displayed (total debit, total credit)
- [ ] Voucher numbers link to voucher detail
- [ ] Print layout keeps voucher blocks together
- [ ] Replaces the current alias implementation
