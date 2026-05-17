# 12 — Multi-Company Consolidation

> **Priority:** P2 (Medium)
> **Estimated Effort:** 5–7 days
> **Dependencies:** Balance Sheet [01], P&L (exists), Fiscal Year [03]

---

## Business Context

When a user manages multiple companies (e.g., a holding group), they need **consolidated** financial statements that combine all subsidiaries into one view. This involves:
- Summing up all account balances across companies
- Eliminating inter-company transactions (if company A paid company B)
- Presenting a group-level Balance Sheet, P&L, and Trial Balance

---

## Current State

- ✅ System supports multiple companies per user
- ✅ Each company has its own isolated data
- ❌ No consolidation layer
- ❌ No inter-company transaction tracking
- ❌ No group-level reports

---

## Requirements

### Functional
1. **Define group** — Mark which companies belong to a group
2. **Consolidated Trial Balance** — Sum all company trial balances (with currency conversion)
3. **Consolidated P&L** — Sum across companies
4. **Consolidated Balance Sheet** — Sum across companies
5. **Inter-company eliminations** — Tag and auto-eliminate related transactions
6. **Currency handling** — Convert each subsidiary to a common reporting currency

### Non-Functional
- Consolidation is read-only (no data mutation)
- Must handle different fiscal year starts across companies

---

## Implementation Plan

### Step 1: Group Entity
- Create `CompanyGroup` entity (group name, subsidiaries, reporting currency)
- API for managing groups

### Step 2: Consolidation Service
- For each subsidiary: get trial balance, convert to reporting currency
- Sum by standardized account code (requires COA mapping)
- Apply elimination entries

### Step 3: Frontend — Consolidated Reports
- Group selector dropdown
- Consolidated versions of existing reports
- Elimination column showing adjusted values

---

## Acceptance Criteria

- [ ] Company groups can be defined
- [ ] Consolidated Trial Balance sums across subsidiaries
- [ ] Currency conversion applied for different base currencies
- [ ] Inter-company eliminations can be configured
- [ ] Group-level P&L and Balance Sheet available
