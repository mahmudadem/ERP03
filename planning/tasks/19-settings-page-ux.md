# 19 — Settings Page UX Fix

> **Priority:** P1 (tied to existing TODO #1)
> **Estimated Effort:** 2 days
> **Dependencies:** None
> **Source:** TODO item #1 — "fix how this works and save settings"

---

## Problem Statement (from TODO)

> Those must be topic-related buttons. No auto-save for all pages. And the "How This Works" should instruct users how this specific setting affects the system.

Currently:
- The settings page may be auto-saving all sections at once
- The "How This Works" / instruction buttons are generic, not topic-specific
- Users don't understand how each individual setting affects system behavior

---

## Current State

- ✅ `AccountingSettingsPage.tsx` exists (1235 lines) — has multiple tabs/sections
- ✅ `SectionHeader` component has a per-section save button
- ✅ Instructions system exists (`InstructionsButton`, `generalSettingsInstructions`, etc.)
- ❌ Save may apply globally rather than per-section
- ❌ Instructions may not clearly explain how each setting changes system behavior
- ❌ Page is massive (77KB) — should be split for maintainability

---

## Requirements

### Functional
1. **Per-section save** — Each settings section (General, Currencies, Policies, Payment Methods, Cost Centers, Fiscal Year) has its own independent Save button
2. **Section-specific instructions** — Each "How This Works" button shows instructions relevant to THAT section only, explaining the business impact
3. **Dirty state tracking** — Show unsaved changes indicator per section
4. **Validation per section** — Validate only the section being saved

### Non-Functional
5. **Split into sub-components** — Break the 1235-line file into smaller components:
   - `GeneralSettingsSection.tsx`
   - `CurrenciesSettingsSection.tsx`
   - `PoliciesSettingsSection.tsx`
   - `PaymentMethodsSection.tsx`
   - `CostCenterSettingsSection.tsx`
   - `FiscalYearSettingsSection.tsx`

---

## Implementation Plan

### Step 1: Audit Current Save Behavior

**File:** `frontend/src/modules/accounting/pages/AccountingSettingsPage.tsx`

Review `handleSave(section?: string)` — verify it sends only the changed section's data. If it sends everything, refactor to only send the relevant subset.

### Step 2: Refactor into Sub-Components

Split each tab's content into its own component file:
```
frontend/src/modules/accounting/components/settings/
  GeneralSettingsSection.tsx
  CurrenciesSettingsSection.tsx
  PoliciesSettingsSection.tsx
  PaymentMethodsSection.tsx
  NotificationsSettingsSection.tsx   (for plan #22)
```

Each sub-component:
- Receives current config as props
- Has its own local state for edits
- Has its own Save button
- Has its own "How This Works" button with relevant instructions

### Step 3: Enhance Instructions Content

Review and rewrite each instruction set to be **business-impact focused**:
- General: "These settings define your base currency and company defaults. Changing the base currency after posting vouchers will NOT retroactively convert amounts."
- Currencies: "Currencies listed here are available for multi-currency voucher entry. Exchange rates are used at the time of voucher creation."
- Policies: "Policies control what happens during voucher workflow. Enabling 'Financial Approval' means all vouchers must be approved by a manager before posting."
- etc.

### Step 4: Add Dirty State Indicators

Each section tracks if user made changes:
- Show unsaved dot/badge on section tab
- Warn on navigation away if unsaved changes exist
- Disable save button when no changes made

---

## Verification Plan

### Manual
1. Open Settings → change a General setting → verify only General section shows "unsaved"
2. Save General → verify Currencies section is unaffected
3. Click "How This Works" on Policies → verify instructions explain the business impact
4. Navigate away with unsaved changes → verify warning dialog appears

---

## Acceptance Criteria

- [ ] Each section saves independently
- [ ] "How This Works" shows section-specific instructions
- [ ] Instructions explain business impact, not just technical details
- [ ] Unsaved changes indicator works per section
- [ ] Settings page split into maintainable sub-components
- [ ] No regression in existing settings functionality
