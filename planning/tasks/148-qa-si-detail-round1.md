# Manual QA — Sales Invoice Detail (Round 1)

**Page:** [frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx](../../frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx)
**What changed:** Rewritten to the [native-detail contract](../../docs/architecture/native-detail-contract.md) (commit `ac5da18e`).
**Goal:** Verify all 15 contract clauses work in practice before applying to Quote/SO/DN/SR.

---

## Pre-flight (do this once)

1. **Start the backend and frontend** in two terminals.
2. **Pick a test company** that has:
   - At least 1 customer (with a phone number for the WhatsApp test)
   - At least 1 item with a sales price and a tax code
   - At least 1 warehouse
   - At least 1 AR account configured
   - Sales settings → `paymentMethodConfigs` enabled (at least Cash)
3. **Log in as a user** with `sales.creditOverride` permission (typically Owner/Admin). Note this account — we test the *non-permitted* path later by switching users.
4. **Navigate:** Sales → Sales Invoices → New.

For every test below: if it passes as described, mark `✅`. If it works but feels off, mark `⚠` + note. If it breaks, mark `🔴` + screenshot or copy the error.

---

## Section A — Create + Save Draft

### A1. New invoice page loads cleanly
- **Action:** Click "New Invoice" from the list.
- **Expected:** Page renders. No console errors. The form shows: Sales Order dropdown (empty), Customer selector, Salesperson dropdown, Customer Invoice #, Invoice Date (today), Due Date (empty), Currency dropdown (should show your **company's base currency**, NOT 'USD' if you're not in USD), Exchange Rate widget, Notes, an empty Line Item row, Charges section, Totals (all 0.00).
- **What to check:** Currency defaults to YOUR company's base — not hardcoded USD. Status chip should NOT appear (no status until saved).

### A2. Save a minimal draft
- **Action:** Pick a customer → add one line (item + qty 1 + price 100 + tax code) → click "Save Draft".
- **Expected:** Page navigates to `/sales/invoices/<id>`. Status chip appears with **"DRAFT"** in slate color. Invoice number displays. Inputs become editable (NOT read-only) because status is DRAFT.

### A3. Edit the draft (NEW verb)
- **Action:** Change the quantity from 1 to 2. Click "Save Changes" (button label should appear since we're editing an existing draft).
- **Expected:** Totals recalculate. Page stays. Toast or success indicator. Reload the page — quantity is still 2.
- 🔴 **If "Save Changes" button is missing**, that's a regression — the Edit verb is the whole point of this rewrite.

### A4. Add a second line + a charge
- **Action:** Click "Add Item" → add another line. Click "Add Charge" → add a charge (e.g. shipping $20). Save Changes.
- **Expected:** Both persist after reload.

### A5. Validation messages are translated
- **Action:** Try to save with empty customer or empty line item.
- **Expected:** Error message appears. **Should NOT be hardcoded English** — should respect your current language (try switching language in the topbar). If you only have English active, accept English copy but verify there's a `t()` key behind it (any English string is fine if it would translate; check with browser dev tools — the string should match a key in `common.json`).

---

## Section B — Discard

### B1. Discard a draft
- **Action:** On a DRAFT invoice click "Discard" (should be a red/danger button).
- **Expected:** Confirmation dialog appears (NOT a `window.confirm()` browser modal — should be the styled `ConfirmDialog`). Click Confirm.
- **Expected outcome:** Navigates back to the invoice list. The invoice MAY still appear in the list as DRAFT — the backend `deleteSI` endpoint doesn't exist yet (B1 has a TODO). That's expected for now; the button currently just navigates away.
- 🔴 **If it uses native `window.confirm()`**, regression.

---

## Section C — Post

### C1. Post a DRAFT invoice (deferred settlement)
- **Action:** Create a new DRAFT (steps A1-A2). Click "Post Invoice". The Settlement modal appears.
- **Expected:** Settlement mode dropdown shows "Deferred (No Payment)", "Cash Full Payment", "Multiple Payments". Pick **Deferred**. Click "Confirm & Post".
- **Expected outcome:** Status chip changes to **POSTED** (emerald). Inputs become read-only. Action buttons change — see C2.

### C2. Posted invoice exposes the right actions
- **Expected buttons visible after posting:** Back to List, Create Return, Create Receipt, Send via WhatsApp, Send via Telegram, Clone to Recurring, GL Impact, History. **Discard should be HIDDEN** (only DRAFT can discard).

### C3. Save & Post with Cash settlement
- **Action:** Create a new DRAFT (A1-A2). Click "Save & Post". Pick "Cash Full Payment" in the modal. Set AR account if asked. Click "Confirm Save & Post".
- **Expected:** Invoice posts AND a receipt is recorded against it. Payment status should be PAID. Outstanding = 0.

### C4. Multi-row settlement
- **Action:** A new DRAFT → "Save & Post" → mode = "Multiple Payments" → add a second payment row. Split the amount across two methods. Confirm.
- **Expected:** Both rows process. Outstanding = 0.

---

## Section D — Period Lock Override

### D1. Try to post into a soft-locked period
- **Setup:** Go to Sales Settings (or Accounting Settings → Fiscal). Set a soft-lock date AFTER your invoice date.
- **Action:** Try to post a DRAFT dated BEFORE the lock date.
- **Expected:** A `PeriodLockOverrideModal` appears showing the lock date. Enter a reason. Confirm.
- **Expected outcome:** Invoice posts despite the lock. The audit history (Section H) should show the override.

---

## Section E — Credit Override (SECURITY FIX)

### E1. Trigger credit-limit BLOCK as an authorized user
- **Setup:** Pick a customer. Set their credit limit very low (e.g. $10) in customer detail. Set Sales Settings credit-check policy to BLOCK.
- **Action:** Create a DRAFT invoice for that customer with amount > $10. Click Save & Post.
- **Expected:** The credit-override modal opens, showing limit / current exposure / this invoice / projected. Enter a reason → "Override & Create" — the invoice posts.

### E2. Same scenario as a user WITHOUT `sales.creditOverride` permission
- **Setup:** Log out, log in as a user without that permission (e.g. a sales operator role).
- **Action:** Repeat E1.
- **Expected (NEW BEHAVIOR):** The credit-override modal does **NOT** open. Instead, an error banner says **"Customer is over their credit limit. You do not have permission to override."** (or similar).
- 🔴 **If the override modal DOES open**, the RBAC fix didn't work — security regression.

### E3. Setting-level override disable
- **Setup:** As Owner, go to Sales Settings → toggle "Allow Credit Overrides" OFF. Log back in as the authorized user from E1.
- **Action:** Trigger the credit block.
- **Expected:** Error banner says **"Customer is over their credit limit. Overrides are disabled by company policy."** Modal does NOT open.

---

## Section F — Send via WhatsApp / Telegram

### F1. WhatsApp send modal
- **Setup:** Sales Settings → Communications → ensure at least one WhatsApp sender account is configured + active.
- **Action:** On a POSTED invoice click "Send via WhatsApp".
- **Expected:** Modal opens. Sender dropdown defaults to the `isDefault` account. Recipient phone is pre-filled from the customer's phone (E.164). A default message appears containing: invoice number, customer name, amount, currency, date. Document URL field empty. Edit the message → click Send.
- **Expected outcome:** Modal closes. Success toast like "WhatsApp sent successfully to +90... using <SenderName> (message id: ...)".
- 🔴 **If toast missing OR modal stays open with no feedback**, log it.

### F2. Telegram send modal
- Same as F1 but Telegram channel. The recipient field asks for chat ID / @username.

---

## Section G — Attachments

### G1. Upload an attachment
- **Action:** On any saved invoice click the file input under Attachments. Pick a PDF or PNG < 10 MB.
- **Expected:** File uploads. Shown in the list with name, size, type, upload date. Success toast.

### G2. Open (download) an attachment
- **Action:** Click "Open" on the row.
- **Expected:** File opens in a new browser tab.

### G3. Remove an attachment
- **Action:** Click "Remove" on the row.
- **Expected:** Row disappears. Counts update.

### G4. Limits enforced
- **Action:** Try to upload a file > 10 MB, or upload a 6th file after uploading 5.
- **Expected:** Backend error shown. No crash.

---

## Section H — Audit History

### H1. History button shows record changes
- **Action:** Open any invoice → click "History".
- **Expected:** `RecordAuditModal` opens. Shows events: created, updated (each edit), posted, period-lock override if any, credit override if any. Each entry has timestamp + user.

---

## Section I — Visual / UX Consistency

### I1. Status chip is always color-coded
- DRAFT = slate, POSTED = emerald, CANCELLED = rose. Visible in BOTH the list and the detail header. Never hidden, never monochrome.

### I2. Button palette feels coherent
- Primary (Save/Post) = brand color. Discard = red. Neutral (Back/History/GL) = subtle gray border. Should look intentional, not rainbow.

### I3. Loading and not-found states
- Navigate to `/sales/invoices/some-fake-id-12345`. Should show a friendly "not found" empty state (NOT bare red text).
- During initial load, should show a skeleton (NOT bare "Loading…" text).

### I4. RTL (if you can switch to Arabic)
- Switch language to Arabic. Verify the page mirrors correctly (text flows right-to-left, action buttons swap sides). Acceptable if Arabic translations show English fallbacks — we just want the layout to handle RTL.

---

## Section J — Settlement modal state reset (regression check)

### J1. Open settlement modal, navigate away, come back
- **Action:** On invoice A click "Post Invoice" → settlement modal opens. Pick "Multiple Payments", add 2 rows, fill some amounts. Without confirming, click "Back to List". Open invoice B (different one) → click "Post Invoice".
- **Expected:** Settlement modal opens with **default state** (single row, deferred mode, empty AR account). NOT the stale state from invoice A.

---

## Reporting back

For each test number, give me:
- `A1: ✅`
- `A3: 🔴 Save Changes button missing — only "Save Draft" shown even though invoice is already saved.`
- `E2: ⚠ Modal opened but the reason field accepts empty submit — should require reason.`

Or simpler: just paste the test numbers with status and one-line note.

I'll diagnose 🔴 and ⚠ items, fix them, then we re-run only the failed ones.

**Total estimated walkthrough time:** 45–60 minutes for all 32 tests.

If you only have 30 minutes, run sections **A, C, E, F, G, H** (the verb-matrix essentials) and skip B/D/I/J — those can be a second pass.

---

## Results — Run 1 (2026-05-31)

| Section | Status | Notes |
|---|---|---|
| A — Create + Save Draft | ✅ Pass | Verified in earlier session. |
| B — Discard | ✅ Pass | Verified in earlier session. |
| C — Post | ✅ Pass | Verified in earlier session. |
| D — Period Lock Override | ✅ Pass | All sub-tests passed. |
| E — Credit Override (security fix) | ⏸ Deferred | Skipped due to time. Tracked as separate follow-up task — re-run before declaring Task 148 done. |
| F — Send via WhatsApp / Telegram | ⏸ Deferred | Needs external provider setup (Meta WhatsApp creds / Telegram bot + chat ID). Communications config moved to **/settings/communications** (no longer Sales Settings). Re-run after channel setup. |
| G — Attachments | ✅ Pass | Upload / open / remove / limits all verified. |
| H — Audit History | ✅ Pass | RecordAuditModal shows created/updated/posted events with timestamp + user. |

Remaining to run: **I (Visual/UX), J (Settlement reset)**.
Deferred (need setup): **E (credit override), F (messaging)**.
