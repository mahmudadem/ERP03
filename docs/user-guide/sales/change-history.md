# Change History (Audit Log) — User Guide

## What It Does

Every time you edit a Sales Invoice, Sales Order, Delivery Note, or Sales Return, the system automatically records **what changed**, **who changed it**, and **when**. This creates a complete, immutable history of every modification to your documents.

You can view this history by clicking the **History** button on any document's detail page.

## How to View Change History

1. Open any Sales Invoice, Sales Order, Delivery Note, or Sales Return.
2. Click the **History** button (located near the top-right of the detail page, next to the "GL Impact" button).
3. A dialog opens showing all recorded changes, newest first.

## What You'll See

Each change entry shows:

| Field | Description |
|-------|-------------|
| **Timestamp** | When the change was made |
| **User** | Who made the change (email or user ID) |
| **Action** | The type of change (e.g., UPDATE) |
| **Field** | Which field was changed |
| **Before** | The old value |
| **After** | The new value |

### Example

```
2026-05-21 14:32 — john@company.com  [UPDATE]
┌─────────────┬───────────────┬───────────────┐
│ Field       │ Before        │ After         │
├─────────────┼───────────────┼───────────────┤
│ description │ Old notes     │ Updated notes │
│ dueDate     │ 2026-06-01    │ 2026-06-15    │
└─────────────┴───────────────┴───────────────┘
```

## What Gets Recorded

- **Field-level changes** — Every individual field that changed is recorded separately (description, dates, amounts, etc.).
- **Line changes** — If you add, remove, or modify document lines, the entire lines array is recorded as a single before/after entry (truncated if very long).
- **No-change updates** — If you save a document without changing anything, **no** audit row is created.

## Who Can View Change History

Any user who can view the document can also view its change history. The History button is visible on all document detail pages.

## Frequently Asked Questions

**Q: Can I delete or edit a change history entry?**
A: No. Change history entries are immutable. They cannot be modified or deleted.

**Q: What if the audit log fails to record a change?**
A: The audit write is non-fatal — if it fails, the document update still succeeds. A failure would be logged in the system logs for investigation.

**Q: Does this apply to all document types?**
A: Yes — Sales Invoices, Sales Orders, Delivery Notes, and Sales Returns all have change history.

**Q: Can I see who overrode a period lock?**
A: Yes. Period lock overrides are recorded separately and include the reason, user, and timestamp. These appear in the document's history alongside regular field changes.
