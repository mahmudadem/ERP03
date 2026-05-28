# ERP03 — QA Queue

> Items in this list are **built and ready for Mahmud to manually test**.
> Agents add items here when a feature is complete.
> Mahmud checks them off after testing and marks Pass ✅ or Fail ❌ (with notes).

---

## 🧪 Ready to Test

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

_Last updated: 2026-05-28 by Codex (PI Attachments passed manual QA)_
