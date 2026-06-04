# Task 162 — Posting Authority Epic Manual QA

**Status:** Open
**Owner:** Mahmud (testing) + Claude (note-taking)
**Why:** The posting-authority epic (Stages 0–7, reports 155–161) shipped to `main` with 1307 automated tests green, but no human has driven the flows end-to-end. This is the highest-risk change in the codebase right now — touches every posting path. Find issues before piling new work on top.

---

## What to test

Six small checks. Total time: ~30 minutes.

### ✅ Check 1 — Approval is required for posting (Sales)

1. Go to **Accounting → Settings** (http://localhost:5173/accounting/settings).
2. Click the **Approval Workflow** tab (shield icon).
3. Turn the **Financial Approval (FA)** toggle ON. Below it, set "Apply To" = **All**. Save.
4. Open **Sales → Invoices → New**.
5. Pick a customer, add one line item, click **Save & Post**.

> Note: The old per-module "Require approval before posting" toggles in Sales / Purchase Settings were retired in Stage 2c. Approval is now configured ONLY in Accounting Settings → Approval Workflow.

**Expected:**
- The invoice doesn't post immediately.
- Status shows **PENDING_APPROVAL** with an amber/yellow chip.
- No ledger entries created. No stock movement.

**If it instead posts straight to POSTED, that's a bug.**

---

### ✅ Check 2 — Approver can complete the post

1. Continue from Check 1. Stay on the same invoice (or open it from the list — it should appear with the amber chip).
2. Click **Save & Post** again (or "Approve & Post" if it shows separately).

**Expected:**
- Status flips to **POSTED**.
- Ledger entries appear (check the **GL Impact** button on the invoice).
- Stock has decremented if the item is stockable.

---

### ✅ Check 3 — Same flow on Purchase Invoice

1. Go to **Purchases → Invoices → New**.
2. Pick a vendor, add a line, **Save & Post**.

**Expected:**
- Status → **PENDING_APPROVAL**, no ledger impact.
- Approve again → **POSTED**, ledger and inventory updated.

---

### ✅ Check 4 — Period lock blocks back-dated posting

1. Go to **Accounting → Settings → Fiscal**. Lock a past month (e.g. set lock-through date to last month).
2. Try to create a Sales Invoice dated **before** the lock date and post it.

**Expected:**
- Posting is blocked with a clear error: "Period is locked" or similar.
- Error message mentions which period is locked.

---

### ✅ Check 5 — Period lock override (if your role allows)

1. From Check 4's blocked invoice, look for an **Override Period Lock** button or option.
2. Click it, provide a reason, confirm.

**Expected:**
- Invoice posts.
- The override reason is recorded somewhere (check the **History / Audit** button on the invoice).

---

### ✅ Check 6 — Error response shape (Stage 5 contract)

This one is technical — you can skip it if you don't want to open dev tools. But if you do:

1. Open browser DevTools → Network tab.
2. Trigger any rejection — e.g. try to post a Sales Invoice that exceeds a customer's credit limit.
3. Find the failed request in the Network tab, click **Response**.

**Expected:**
- The JSON body has both a `guard` field and a `code` field (e.g. `{ "guard": "CreditLimitGuard", "code": "CREDIT_LIMIT_EXCEEDED", "message": "...", "fieldHints": [...] }`).

---

## How to report findings

After each check, mark one of:

- ✅ **Pass** — worked as expected
- ⚠ **Pass with UX issue** — worked but felt wrong (wrong color, confusing label, missing feedback)
- ❌ **Fail** — broken / error / wrong behavior

For ⚠ and ❌, write one line: what you saw, what you expected.

Append findings to this file under a **Results** section, then we triage from there.

---

## Results

_(to be filled during testing)_
