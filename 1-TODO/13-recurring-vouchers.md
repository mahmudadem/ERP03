# 13 — Recurring Vouchers

> **Priority:** P3 (Lower)
> **Estimated Effort:** 3 days
> **Dependencies:** Voucher Numbering [07]

---

## Business Context

Many business transactions repeat on a fixed schedule — rent, salaries, depreciation, loan payments, insurance premiums. Instead of manually creating these every month, users should be able to define a **recurring voucher template** that auto-generates vouchers on a schedule.

---

## Current State

- ✅ Voucher creation and posting works
- ✅ Voucher designer allows custom form templates
- ❌ No recurring/scheduled voucher concept
- ❌ No scheduler or cron-like mechanism in the backend

---

## Requirements

### Functional
1. **Define recurring template** — Based on an existing voucher, define recurrence (monthly, quarterly, annually)
2. **Auto-generation** — System creates draft vouchers on the scheduled date
3. **Review before posting** — Generated vouchers land in Draft status for review
4. **Recurrence settings**: frequency, start date, end date (or # of occurrences), day of month
5. **Pause/Resume** — Ability to pause a recurring voucher
6. **History** — See all vouchers generated from a template

### Non-Functional
- Generation can be triggered by a scheduled job (cron) or on-login check
- Auto-generated vouchers are normal vouchers (same lifecycle)

---

## Implementation Plan

### Step 1: Data Model
```typescript
interface RecurringVoucherTemplate {
  id: string;
  companyId: string;
  name: string;                    // "Monthly Rent"
  sourceVoucherId: string;         // Original voucher to copy
  frequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  dayOfMonth: number;              // e.g., 1 for the 1st
  startDate: string;
  endDate?: string;
  maxOccurrences?: number;
  occurrencesGenerated: number;
  nextGenerationDate: string;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  createdBy: string;
  createdAt: Date;
}
```

### Step 2: Backend — Generation Use Case
- Check for templates where `nextGenerationDate <= today`
- For each: copy the source voucher, update date, create as DRAFT
- Advance `nextGenerationDate` to next occurrence

### Step 3: API Endpoints
```
GET    /accounting/recurring-vouchers          — List templates
POST   /accounting/recurring-vouchers          — Create template
PUT    /accounting/recurring-vouchers/:id      — Update template
POST   /accounting/recurring-vouchers/:id/pause  — Pause
POST   /accounting/recurring-vouchers/:id/resume — Resume
POST   /accounting/recurring-vouchers/generate   — Trigger generation (manual or cron)
```

### Step 4: Frontend — Recurring Vouchers Page
- List of templates with status, next date, frequency
- Create from existing voucher ("Make Recurring" action)
- Pause/Resume buttons
- History showing all generated vouchers

---

## Acceptance Criteria

- [ ] Recurring template can be created from a voucher
- [ ] Auto-generation creates draft vouchers on schedule
- [ ] Generated vouchers follow normal workflow (Draft → Post)
- [ ] Pause/Resume works
- [ ] History shows all generated vouchers linked to the template
