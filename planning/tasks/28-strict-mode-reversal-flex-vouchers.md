# 28 — Strict-Mode Reversal for Flex-Created Vouchers

> **Priority:** P1 (High)
> **Estimated Effort:** 2–3 days
> **Dependencies:** Voucher Actions system, PostingLockPolicy

---

## Business Context

When the system transitions from **Flexible Mode** (no approval required) to **Strict Mode** (approval required), vouchers that were originally created and posted under Flex mode carry a `postingLockPolicy` of `FLEXIBLE_LOCKED`. Under Strict Mode:

- **Edit** and **Delete** are correctly **blocked** for these vouchers (you can't retroactively modify a posted entry).
- However, the **Reverse** action is the professional accounting way to correct a posted voucher — it creates a mirror-image entry that zeroes out the original. This should **always** be allowed on posted vouchers regardless of which mode they were created under.

### The Problem

Currently, a voucher created under Flex Mode and later found in a Strict-Mode environment may not surface the **Reverse** button prominently enough, or may confuse the user because Delete is disabled but there's no clear corrective path. The system must ensure:

1. **Reverse** is always available for posted, non-reversed vouchers — even if the current mode is Strict.
2. **Delete** is blocked under Strict Mode for any posted voucher (existing behavior — keep it).
3. Both **VoucherWindow** (desktop-style) and **Web modal** views must expose the Reverse action clearly.
4. The user should see a clear message explaining why Delete is unavailable and that Reverse is the correct alternative.

---

## Current State

- ✅ Reverse action exists in `voucherActions.ts` — shown for posted, non-reversed, non-reversal vouchers
- ✅ Delete is blocked for `STRICT_LOCKED` vouchers
- ⚠️ Delete shows as **enabled** (greyed but visible) for `FLEXIBLE_LOCKED` vouchers — even under Strict Mode
- ⚠️ No tooltip or guidance telling the user "Use Reverse instead of Delete under Strict Mode"
- ❌ No explicit handling of the Flex→Strict transition scenario

---

## Requirements

### Functional

1. **Reverse must always be available** for any posted, non-reversed voucher — regardless of `postingLockPolicy` or current mode
2. **Delete must be fully hidden** (not just disabled) for posted vouchers when current mode is Strict — regardless of whether the voucher was created under Flex
3. **Both VoucherWindow and VoucherEntryModal** must surface Reverse as a primary or clearly visible action for posted vouchers under Strict Mode
4. **Tooltip / banner** on posted FLEXIBLE_LOCKED vouchers when in Strict Mode: _"This voucher was posted under Flexible Mode. Deletion is not allowed in Strict Mode. Use Reverse to correct it."_
5. The reversal voucher should follow the **Strict Mode workflow** (created as Draft → Submit → Approve → Post)

### Non-Functional

- No backend changes to the reversal logic itself (reversal already works)
- Only UI action visibility and guidance needs updating
- Must not break Flex-mode behavior (Delete should still work in Flex mode for FLEXIBLE_LOCKED vouchers if the toggle allows it)

---

## Implementation Plan

### Step 1: Update `voucherActions.ts`

**File:** `frontend/src/modules/accounting/utils/voucherActions.ts`

Changes:
- **REVERSE action** (line ~225): Ensure it is never hidden by mode logic. Currently it's already shown for all posted vouchers — verify no mode-based filtering is applied.
- **DELETE action** (line ~249): When `isStrict` and voucher is posted, set `isHidden: true` (not just `isEnabled: false`). Currently it shows greyed out — should be fully hidden under strict.
- **Add tooltip logic**: When a posted FLEXIBLE_LOCKED voucher is viewed under Strict Mode, add a contextual tooltip to the REVERSE action: _"Correct this voucher by creating a reversing entry"_.

### Step 2: Update VoucherWindow (Desktop View)

**File:** `frontend/src/modules/accounting/components/VoucherWindow.tsx` (or equivalent)

- Ensure the Reverse button is rendered from `getVoucherActions()` (it should already be — verify)
- For posted vouchers under Strict Mode: show a subtle info banner at the top:
  _"This voucher is posted. In Strict Mode, use Reverse to make corrections."_

### Step 3: Update VoucherEntryModal (Web View)

**File:** `frontend/src/modules/accounting/components/VoucherEntryModal.tsx` (or equivalent)

- Same as Step 2 — ensure Reverse button is visible and info guidance is shown

### Step 4: Backend Validation (Verify Only)

**File:** `backend/src/application/accounting/use-cases/VoucherUseCases.ts`

- Verify that the `reverseVoucher` use case does **not** check posting lock policy (it shouldn't — reversals create a NEW voucher, they don't modify the original)
- Verify that under Strict Mode, the generated reversal voucher starts as DRAFT (not auto-posted)

---

## Acceptance Criteria

- [ ] Posted voucher created under Flex Mode shows **Reverse** action when system is now in Strict Mode
- [ ] Posted voucher created under Flex Mode does **NOT** show Delete when system is in Strict Mode
- [ ] Reverse action is visible in both VoucherWindow and Web modal views
- [ ] Reversing a voucher under Strict Mode creates a **DRAFT** reversal (subject to approval workflow)
- [ ] Tooltip or info banner guides the user to use Reverse instead of Delete
- [ ] Existing Flex-mode behavior is unchanged (Delete still allowed for FLEXIBLE_LOCKED if toggle permits)
- [ ] Reversal voucher correctly zeroes out the original entry after being posted
