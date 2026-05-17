# 20 — Web ↔ Windows UI Parity

> **Priority:** P1 (tied to existing TODO #2)
> **Estimated Effort:** 2–3 days
> **Dependencies:** None
> **Source:** TODO item #2 — "ensure that UI in both web view and Windows are the same"

---

## Problem Statement (from TODO)

> I noticed that changes and fixes we made is being applied to the Windows view only regarding what buttons we show and what we hide.

The application renders in both a web browser view and a Windows desktop view (likely via Electron or similar). UI changes (button visibility, layout fixes) are sometimes only applied to one view but not the other.

---

## Current State

- ❌ Some buttons/actions appear in Windows view but not Web view (or vice versa)
- ❌ Layout differences between views not tracked
- ❌ No systematic testing of both views

---

## Requirements

### Functional
1. **Audit all accounting pages** — Compare Web vs Windows rendering
2. **Identify discrepancies** — Document what's different
3. **Fix discrepancies** — Ensure identical behavior in both views
4. **Prevent future drift** — Identify why drift occurs and add safeguards

---

## Implementation Plan

### Step 1: Identify the View Detection Mechanism

Search the codebase for how the app detects Web vs Windows context:
- Look for `window.electron`, `process.type`, `navigator.userAgent`, or custom flags
- Check for conditional rendering (e.g., `{isDesktop && <Button ... />}`)
- Document every file that conditionally renders based on platform

### Step 2: Systematic Audit

For each accounting page, compare side by side in Web and Windows:

| Page | Web | Windows | Discrepancy |
|------|-----|---------|-------------|
| Voucher List | | | |
| Voucher Entry | | | |
| Dashboard | | | |
| General Ledger | | | |
| Trial Balance | | | |
| P&L | | | |
| Settings | | | |
| Chart of Accounts | | | |

Document: buttons present/absent, layout differences, action menu items, navigation behavior.

### Step 3: Fix Discrepancies

For each discrepancy:
- Determine which view has the correct behavior
- Apply the fix to the other view
- Test both views

### Step 4: Prevent Future Drift

- Create a shared component for any platform-specific wrappers
- Document the convention: "All UI should be identical unless there's a documented reason for platform-specific behavior"
- Consider using a `PlatformContext` that centralizes the detection

---

## Verification Plan

### Manual
1. Open same page in Web browser and Windows app side-by-side
2. For each accounting page, verify:
   - Same buttons visible
   - Same actions in menus
   - Same layout and spacing
   - Same behavior when clicking
3. Document any remaining intentional differences (if any)

---

## Acceptance Criteria

- [ ] All accounting pages look and behave identically in Web and Windows
- [ ] Platform detection mechanism documented
- [ ] All conditional rendering justified or removed
- [ ] No regression in either view
