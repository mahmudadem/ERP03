# 09 — Bank Reconciliation

> **Priority:** P2 (Medium)
> **Estimated Effort:** 5–7 days
> **Dependencies:** Account Statement Report [02] (must exist first)

---

## Business Context

Bank reconciliation is the process of **matching** your book (ledger) entries against the actual bank statement to find discrepancies. Every business must do this monthly (or more frequently) to:
- Detect errors or fraud
- Identify unrecorded transactions (bank fees, interest)
- Ensure the book balance matches the bank balance
- Satisfy auditor requirements

Without reconciliation, there's no way to trust that the cash accounts are accurate.

---

## Current State

- ✅ Account Statement exists (after [02] is implemented)
- ✅ Ledger entries track all transactions per account
- ❌ No bank statement import capability
- ❌ No reconciliation entity/workflow
- ❌ No matching engine
- ❌ No reconciled/unreconciled status on ledger entries
- ❌ No reconciliation report

---

## Requirements

### Functional
1. **Bank statement import** — Upload CSV/OFX file with bank transactions
2. **Matching engine** — Auto-match bank lines to ledger entries (by amount, date proximity, reference)
3. **Manual matching** — User can manually match unmatched items
4. **Unreconciled items** — Show outstanding items on both sides (items in book but not bank, items in bank but not book)
5. **Reconciliation summary** — Book balance ± adjustments = Bank balance
6. **Reconciliation status** — Mark ledger entries as "Reconciled" with reconciliation ID
7. **Historical reconciliations** — View past reconciliation results
8. **Create adjustment entries** — Auto-create JE for bank charges, interest, etc.

### Non-Functional
- Must handle banks with different CSV formats (configurable column mapping)
- Matching should be smart but user has final say
- Reconciliation status does not affect posting (it's a verification layer)

---

## Data Model

### BankStatement

```typescript
interface BankStatement {
  id: string;
  companyId: string;
  accountId: string;       // The bank account being reconciled
  bankName: string;
  statementDate: string;
  importedAt: Date;
  importedBy: string;
  lines: BankStatementLine[];
}

interface BankStatementLine {
  id: string;
  date: string;
  description: string;
  reference?: string;
  amount: number;         // Positive = deposit, Negative = withdrawal
  balance?: number;       // Running balance from bank
  matchedLedgerEntryId?: string;
  matchStatus: 'UNMATCHED' | 'AUTO_MATCHED' | 'MANUAL_MATCHED';
}
```

### Reconciliation

```typescript
interface Reconciliation {
  id: string;
  companyId: string;
  accountId: string;
  bankStatementId: string;
  periodEnd: string;
  bookBalance: number;
  bankBalance: number;
  adjustments: ReconciliationAdjustment[];
  status: 'IN_PROGRESS' | 'COMPLETED';
  completedAt?: Date;
  completedBy?: string;
}
```

---

## Implementation Plan

### Step 1: Domain Entities
- Create `BankStatement.ts`, `Reconciliation.ts` entities
- Create repository interfaces

### Step 2: Import Engine
- CSV parser with configurable column mapping
- OFX parser (standard bank format)
- Store imported statements in Firestore

### Step 3: Matching Engine
- Auto-match by exact amount + date within 3 days
- Auto-match by reference number
- Score-based matching for ambiguous cases
- Return unmatched items for manual review

### Step 4: API Endpoints
```
POST   /accounting/bank-statements/import         — Upload CSV/OFX
GET    /accounting/bank-statements                 — List statements
GET    /accounting/reconciliation/:accountId       — Get current reconciliation
POST   /accounting/reconciliation/:accountId/match — Match a bank line to ledger entry
POST   /accounting/reconciliation/:accountId/complete — Finalize reconciliation
POST   /accounting/reconciliation/:accountId/adjust — Create adjustment entry
```

### Step 5: Frontend — Reconciliation Page
- Split-view: Book entries (left) vs Bank entries (right)
- Drag-and-drop or click-to-match interface
- Color-coded: Green (matched), Yellow (auto-matched), Red (unmatched)
- Summary footer: Book balance ± adjustments = Bank balance
- Import button for bank statement upload

---

## Verification Plan

### Manual
1. Import a test CSV with bank transactions
2. Navigate to Reconciliation page for the bank account
3. Verify auto-matching finds obvious matches
4. Manually match remaining items
5. Create an adjustment entry for a bank fee
6. Complete the reconciliation
7. Verify the summary shows balanced (book = bank after adjustments)

---

## Acceptance Criteria

- [ ] Bank statement CSV import works with configurable column mapping
- [ ] Auto-matching correctly identifies obvious matches by amount + date
- [ ] Manual matching interface allows click-to-match
- [ ] Unmatched items displayed clearly on both sides
- [ ] Reconciliation summary shows book vs bank balance
- [ ] Adjustment entries can be created for bank charges/interest
- [ ] Historical reconciliations viewable
- [ ] Ledger entries marked as reconciled
