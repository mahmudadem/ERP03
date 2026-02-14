# 03 — Fiscal Year / Period Management

> **Priority:** P0 (Critical)
> **Estimated Effort:** 3–5 days
> **Dependencies:** None (but Balance Sheet [01] should ideally be done first)

---

## Business Context

Fiscal Year management is foundational to professional accounting. Without it:
- You cannot **close a year** (zero out P&L accounts into Retained Earnings)
- You cannot **prevent posting to closed periods**
- You cannot generate **comparative reports** (FY2025 vs FY2026)
- You cannot enforce **period boundaries** beyond the raw `PeriodLockPolicy` date

Currently the system has a `PeriodLockPolicy` that prevents posting before a manually-set `lockedThroughDate`, but there's no formal concept of fiscal years or periods.

---

## Current State

- ✅ `PeriodLockPolicy` prevents posting to locked dates
- ✅ Settings page has period lock date configuration
- ✅ Voucher dates are validated
- ❌ No `FiscalYear` entity
- ❌ No fiscal period definitions (monthly, quarterly)
- ❌ No year-end closing journal generation
- ❌ No fiscal year selection in reports
- ❌ No period status tracking (Open, Closed, Locked)
- ❌ No setting to define fiscal year start month

---

## Requirements

### Functional

1. **Define Fiscal Year:**
   - Company can define fiscal year start month (e.g., January for calendar year, April for Apr–Mar)
   - System auto-generates 12 monthly periods per fiscal year
   - Each period has a status: `OPEN`, `CLOSED`, `LOCKED`

2. **Period Management:**
   - Close a period (prevents new postings, allows corrections with elevated permission)
   - Reopen a period (with audit trail)
   - Lock a period permanently (no further changes even with admin permissions)

3. **Year-End Close:**
   - Generate closing journal entry: debit all Revenue accounts, credit all Expense accounts → net to Retained Earnings
   - Create opening balances for the next fiscal year (carry forward BS accounts)
   - Mark the fiscal year as "Closed"

4. **Reports Integration:**
   - Reports should allow fiscal year selection (not just from/to dates)
   - Support comparative view (this year vs last year)

### Non-Functional
- Must integrate with existing `PeriodLockPolicy` (replace raw date with period-based locking)
- Backward compatible — existing vouchers don't need migration

---

## Data Model

### FiscalYear Entity

**File:** `backend/src/domain/accounting/entities/FiscalYear.ts` (NEW)

```typescript
export enum FiscalYearStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  LOCKED = 'LOCKED'
}

export enum PeriodStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  LOCKED = 'LOCKED'
}

export interface FiscalPeriod {
  id: string;              // e.g., "2026-01"
  name: string;            // e.g., "January 2026"
  startDate: string;       // "2026-01-01"
  endDate: string;         // "2026-01-31"
  status: PeriodStatus;
  closedAt?: Date;
  closedBy?: string;
}

export class FiscalYear {
  constructor(
    public readonly id: string,           // e.g., "FY2026"
    public readonly companyId: string,
    public readonly name: string,          // e.g., "Fiscal Year 2026"
    public readonly startDate: string,     // "2026-01-01"
    public readonly endDate: string,       // "2026-12-31"
    public readonly status: FiscalYearStatus,
    public readonly periods: FiscalPeriod[],
    public readonly closingVoucherId?: string, // JE that closed this year
    public readonly createdAt?: Date,
    public readonly createdBy?: string
  ) {}

  // Get period for a given date
  getPeriodForDate(date: string): FiscalPeriod | undefined { ... }

  // Check if a date falls in an open period
  isDatePostable(date: string): boolean { ... }

  // Close a period
  closePeriod(periodId: string, closedBy: string): FiscalYear { ... }

  // Close the entire fiscal year
  close(closedBy: string, closingVoucherId: string): FiscalYear { ... }
}
```

### Repository Interface

**File:** `backend/src/repository/interfaces/accounting/IFiscalYearRepository.ts` (NEW)

```typescript
export interface IFiscalYearRepository {
  findByCompany(companyId: string): Promise<FiscalYear[]>;
  findById(companyId: string, id: string): Promise<FiscalYear | null>;
  findActiveForDate(companyId: string, date: string): Promise<FiscalYear | null>;
  save(fiscalYear: FiscalYear): Promise<void>;
  update(fiscalYear: FiscalYear): Promise<void>;
}
```

---

## Implementation Plan

### Step 1: Create Domain Entity + Repository

- Create `FiscalYear.ts` entity (as above)
- Create `IFiscalYearRepository.ts` interface
- Create `FirestoreFiscalYearRepository.ts` implementation
- Register in DI container

### Step 2: Create Use Cases

**File:** `backend/src/application/accounting/use-cases/FiscalYearUseCases.ts` (NEW)

Use cases to create:
```
CreateFiscalYearUseCase     — Define a new fiscal year with auto-generated periods
ListFiscalYearsUseCase      — List all fiscal years for a company
ClosePeriodUseCase          — Close a monthly period
ReopenPeriodUseCase         — Reopen a closed (not locked) period
CloseYearUseCase            — Generate year-end closing JE + mark year closed
```

`CloseYearUseCase` logic:
1. Get all Revenue accounts (classification = REVENUE) → sum net balances
2. Get all Expense accounts (classification = EXPENSE) → sum net balances
3. Net Income = Revenue - Expenses
4. Create a closing JE:
   - Debit all Revenue accounts (zeroing them)
   - Credit all Expense accounts (zeroing them)
   - Debit or Credit "Retained Earnings" account for the net
5. Post the closing journal entry
6. Mark the fiscal year as CLOSED
7. Auto-create next fiscal year if desired

### Step 3: Update PeriodLockPolicy

**File:** `backend/src/domain/accounting/policies/implementations/PeriodLockPolicy.ts`

Enhance to check fiscal period status when available:
```typescript
validate(ctx: PostingPolicyContext): PolicyResult {
  // If fiscal year management is enabled, check period status
  if (ctx.fiscalYear) {
    const period = ctx.fiscalYear.getPeriodForDate(ctx.voucherDate);
    if (!period) return { ok: false, error: { code: 'NO_FISCAL_PERIOD', ... } };
    if (period.status !== 'OPEN') return { ok: false, error: { code: 'PERIOD_CLOSED', ... } };
  }
  // Fallback to raw date check
  ...
}
```

### Step 4: Create API Endpoints

**File:** `backend/src/api/routes/accounting.routes.ts`

```typescript
// Fiscal Years
router.get('/fiscal-years', permissionGuard('accounting.settings.read'), FiscalYearController.list);
router.post('/fiscal-years', permissionGuard('accounting.settings.write'), FiscalYearController.create);
router.post('/fiscal-years/:id/close-period', permissionGuard('accounting.settings.write'), FiscalYearController.closePeriod);
router.post('/fiscal-years/:id/reopen-period', permissionGuard('accounting.settings.write'), FiscalYearController.reopenPeriod);
router.post('/fiscal-years/:id/close-year', permissionGuard('accounting.settings.write'), FiscalYearController.closeYear);
```

### Step 5: Settings Page — Fiscal Year Configuration

**File:** `frontend/src/modules/accounting/pages/AccountingSettingsPage.tsx`

Add a new "Fiscal Year" tab/section:
- Define fiscal year start month
- View list of fiscal years with status
- Buttons to close periods, close year
- Create next fiscal year
- Visual status indicators (Open/Closed/Locked) for each month

### Step 6: Frontend — Fiscal Year API Functions

**File:** `frontend/src/api/accountingApi.ts`

```typescript
listFiscalYears(): Promise<FiscalYear[]>;
createFiscalYear(data: { name: string; startDate: string; endDate: string }): Promise<FiscalYear>;
closePeriod(fyId: string, periodId: string): Promise<FiscalYear>;
reopenPeriod(fyId: string, periodId: string): Promise<FiscalYear>;
closeYear(fyId: string): Promise<{ closingVoucherId: string }>;
```

---

## Verification Plan

### Automated
1. **Unit test** — `backend/src/tests/domain/accounting/entities/FiscalYear.test.ts`
   - Test period generation from start/end dates
   - Test `getPeriodForDate` lookup
   - Test period closure state transitions
   - Test year closure only possible when all periods closed
   - Command: `cd backend && npx jest --testPathPattern=FiscalYear.test`

2. **Integration test** — `backend/src/tests/application/accounting/use-cases/CloseYearUseCase.test.ts`
   - Test closing JE generation (revenue/expense zeroed out, retained earnings updated)
   - Command: `cd backend && npx jest --testPathPattern=CloseYearUseCase`

### Manual
1. Go to Accounting → Settings → Fiscal Year
2. Create a fiscal year (e.g., FY2026, Jan–Dec)
3. Verify 12 periods are generated
4. Close a period → verify voucher creation for that period is blocked
5. Reopen the period → verify vouchers can be created again
6. Close all periods → close the year
7. Verify a closing JE was auto-generated
8. Verify Revenue and Expense accounts have zero balance for the closed year

---

## Acceptance Criteria

- [ ] Fiscal year entity created with 12 auto-generated periods
- [ ] Period status: Open → Closed → Locked transitions work
- [ ] Posting to a closed period is blocked (with clear error message)
- [ ] Year-end close generates correct closing journal entry
- [ ] Retained Earnings account updated with net P&L
- [ ] UI shows fiscal year status with period indicators
- [ ] Backward compatible — existing vouchers unaffected
- [ ] PeriodLockPolicy enhanced to use fiscal periods when available
