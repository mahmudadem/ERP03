# ERP03 — QA Queue

> Items in this list are **built and ready for Mahmud to manually test**.
> Agents add items here when a feature is complete.
> Mahmud checks them off after testing and marks Pass ✅ or Fail ❌ (with notes).

---

## 🧪 Ready to Test

### Shared UI — Task 132 Date Control Cleanup
**Added by:** Codex (report 146)
**What to test:**
- Open `Inventory -> Stock Movements` and confirm the from/to filters use the ERP calendar date control.
- Open `Inventory -> Stock Transfers` and confirm the transfer date uses the ERP calendar date control.
- Open `Sales -> Promotions`, create or edit a promotion, and confirm Valid From / Valid To use the ERP calendar date control.
- Open `Sales -> Price Lists`, create or edit a price list, and confirm Valid From / Valid To use the ERP calendar date control.
- In any table with a date-range column filter, confirm the date-range popup uses the ERP date control.
- Right-click a date field where supported and confirm shortcuts such as today / fiscal year / period options are available.

**Known limitations:**
- This slice does not change stock posting, stock valuation, promotion rules, price-list pricing, or ledger behavior.
- Authenticated visual QA is required for actual route access.

---

### Accounting/Inventory — Task 132 Voucher and Item List Standardization
**Added by:** Codex (report 145)
**What to test:**
- Open `Accounting -> Vouchers`.
- Expected: the page uses the shared header style and existing voucher filters/table still work.
- Refresh the voucher list and confirm existing row actions still behave as before.
- Open `Inventory -> Items`.
- Expected: header, New Item button, quick-add form, search/type filters, Refresh, Clear, active/inactive badges, and Open row action appear consistently.
- Create a simple item through Quick Add and confirm a success toast appears.
- Trigger a search/filter and clear it; confirm the list reloads correctly.
- Switch to Arabic and confirm labels and layout remain readable.

**Known limitations:**
- This slice does not change voucher posting/approval, item costing, stock valuation, or inventory posting logic.
- Authenticated visual QA is still required because unauthenticated browser smoke redirects to the auth page.

---

### Sales/Purchases — Task 132 Invoice List Standardization
**Added by:** Codex (report 144)
**What to test:**
- Open `Sales -> Invoices`.
- Expected: header, New Invoice button, status/payment filters, customer selector, Refresh, and Clear filters appear consistently.
- Select a customer through the selector and confirm the list reloads for that customer.
- Confirm status/payment badges are visually distinct for draft/posted/cancelled and unpaid/partial/paid.
- Click Open on a row and confirm it opens the invoice.
- Repeat the same checks in `Purchases -> Invoices` using the vendor selector.
- Switch to Arabic and confirm labels and layout remain readable.

**Known limitations:**
- This slice does not change posting, payment, cancellation, attachment, or audit actions.
- Accounting vouchers and Inventory items are the next operational-list standardization targets.

### Settings — Task 132 Settings Taxonomy Foundation
**Added by:** Codex (report 143)
**What to test:**
- Open `Settings` from the sidebar.
- Confirm the page shows four groups: General, Workflow, Accounting and Tax, Access and Advanced.
- Open each visible link and confirm existing route permissions still apply.
- Open Sales Settings, Purchase Settings, Accounting Settings, and Inventory Settings on desktop and narrow/mobile width.
- Expected: settings tabs are usable on small screens, the save/discard bar remains readable, and no top-bar widget behavior changed.
- Switch to Arabic and confirm the Settings page is readable in RTL.

**Known limitations:**
- This slice does not normalize every Sales/Purchase tab label yet.
- Existing destination pages still own their permissions and save behavior.

### Super Admin — Field Library Phase C2 Voucher Template Authoring
**Added by:** Codex (report 135d)
**What to test:**
- Sign in as SUPER_ADMIN and open `Super Admin -> Voucher Templates`.
- Edit a Sales Invoice template and open the Header Fields tab.
- Expected: the "Available Field Library fields" area offers official fields from Field Library; adding one creates a field row with the library label/type.
- Open the Line Fields tab, add a BODY field from the Field Library, then open Table Columns.
- Expected: that line field appears as an available table column; table column suggestions come from the template's own line fields.
- Save the template, then open a tenant Forms Management wizard for that type.
- Expected: the field placement and required flags follow the saved voucher template.

**Known limitations:**
- `fieldVersionsSeen` drift warnings are not included yet.
- The current Field Library seed has broad shared fields, so super-admins must still choose the correct official fields for each template.

### Forms Management — Field Library Phase C1
**Added by:** Codex (report 135c)
**What to test:**
- Sign in as SUPER_ADMIN and open `Super Admin -> Field Library`.
- Edit `warehouseId` and temporarily change the label to `Warehouse Test`.
- Open `Sales -> Forms Management`, clone or edit a Sales form, and go to the wizard's Fields step.
- Expected: the Warehouse field label reflects the Field Library change, while required fields remain protected.
- Open a Sales or Purchases form that has a line-table Warehouse column.
- Expected: saving the form does not remove the existing `warehouseId` table column.
- Change the `warehouseId` label back in Field Library after the smoke test.

**Known limitations:**
- This C1 smoke confirms company Forms Management consumption. Layer 2 authoring is covered by the Phase C2 QA item above; `fieldVersionsSeen` drift warnings are still pending.

### Purchases — Phase F: Purchase Price Lists
**Added by:** Antigravity (report 131)
**What to test:**
- Open `Purchases -> Price Lists` and click `New Price List`.
- Create a new price list named `USD Wholesale Vendor`, select currency `USD`, set as default: `Yes`.
- Add a line: Item `Widget A`, Min Qty `10`, Unit Price `85.00`.
- Click `Save`.
- Create a new Purchase Order for a vendor using USD. Select `Widget A`, quantity `5`. Verify the price does not resolve to 85.00 (min quantity is 10).
- Change quantity to `10`. Verify the price auto-resolves to `85.00`.
- Override manually to `80.00` to verify overrides work.
- Go to vendor card Commercial Terms, set default price list to `USD Wholesale Vendor`.
- Verify that deletion of a price list triggers the ConfirmDialog.

**Known limitations:**
- Purchase Price Lists resolve unit prices at document entry; they do not block manual price overrides.

### Purchases — Phase F: Vendor Groups
**Added by:** Codex (report 130)
**What to test:**
- Open Purchases -> Vendor Groups
- Create a vendor group, edit it, and confirm it appears in the list
- Open Purchases -> Vendors and assign a vendor to the group from Commercial Terms
- Save and reopen the vendor, then confirm the group persists
- Try deleting a group while a vendor still references it
- Expected: deletion is blocked
- Clear the vendor group from the vendor and save
- Delete the now-unused group
- Expected: deletion succeeds

**Known limitations:**
- Vendor Groups are classification-only in this slice; they do not change AP posting, payment behavior, tax, inventory valuation, or vouchers

### Sales — Phase D.8: Outbound Messaging (WhatsApp + Telegram)
**Added by:** Claude Code (report 116, 117, 118)
**What to test:**
- Go to Sales Settings → Communications
- Add a WhatsApp sender account (test credentials)
- Open a Sales Invoice → Send button → choose WhatsApp
- Verify message is sent and delivery status shows
- Repeat with Telegram sender account
- Verify per-company isolation (switch tenant, confirm sender accounts are separate)

**Known limitations:**
- Email delivery not yet wired (deferred)
- Sender selection UI in Send modal — confirm default auto-selects correctly

---

### Sales — Phase D.7: Invoice Templates
**Added by:** Claude Code (report 115)
**What to test:**
- Go to Forms Designer → create a template
- Open Sales Invoice → Print/Preview → confirm template renders
- Switch templates, verify layout changes

---

### Sales — Phase D.5: Sales Return Enhancements
**Added by:** Claude Code (report 114)
**What to test:**
- Create a Sales Return against an existing invoice
- Verify GL posting reverses correctly
- Check audit log captures the return event

---

### Sales — Phase D.4: Recurring Invoices
**Added by:** Claude Code (report 112)
**What to test:**
- Create a recurring invoice template (monthly)
- Advance the date / trigger the scheduler manually
- Verify invoice is auto-generated with correct line items and dates

---

### Sales — Phase D.2 + D.3: Period Lock + Audit Log
**Added by:** Claude Code (report 111)
**What to test:**
- Lock a period in Accounting Settings
- Attempt to post an invoice in that period — should be blocked
- Check audit log on any Sales Invoice for change history

---

## ✅ Tested & Passed

### Purchases — Phase F: Purchase Invoice Attachments
**Added by:** Codex (report 129)  
**Tested by:** Mahmud  
**Result:** Pass ✅  
**Passed on:** 2026-05-28

**What passed:**
- New PI attachment section is visible.
- Files can be attached before saving a new PI.
- Pre-save files queue locally and upload after saving.
- Saved PI attachments can be viewed and managed.

**Known limitations:**
- Attachments are evidence only; they do not change posting, payment status, tax, AP, or inventory values.

---

## ❌ Failed — Needs Fix

_(none yet)_

---

## 📝 How agents add items

When you finish a feature and it's ready for QA, add a block under "Ready to Test":

```markdown
### [Module] — [Feature Name]
**Added by:** [your agent name] (report NNN)
**What to test:**
- Step-by-step instructions for Mahmud
- Include where to navigate in the UI
- Include expected outcomes
```

Then append to `planning/JOURNAL.md` and update `planning/ACTIVE.md`.

---

_Last updated: 2026-05-30 by Codex (Task 132 date controls ready for QA)_
