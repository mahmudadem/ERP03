# Recurring Invoices — User Guide

## What It Does

Recurring Invoices let you automatically generate invoices on a schedule. This is useful for:
- Monthly retainers or subscription fees
- Regular service charges
- Rent or lease payments
- Any invoice that repeats with the same customer, items, and prices

There are **two ways** to create a recurring invoice:

| Method | When to Use |
|--------|-------------|
| **New Template** | Create from scratch — define the customer, items, prices, and schedule manually |
| **Clone from Invoice** | You already have an invoice — turn it into a recurring template with one click |

## How to Create a Recurring Invoice Template

### Method 1: Create from Scratch

1. Go to **Sales → Recurring Invoices**.
2. Click **New Template**.
3. Fill in the form:
   - **Template Name** — a descriptive name (e.g., "Monthly Retainer - Client X")
   - **Customer ID** — the customer's ID
   - **Customer Name** — the customer's display name
   - **Frequency** — how often to generate: Weekly, Monthly, Quarterly, or Annually
   - **Day of Week** — for Weekly schedules, choose which weekday to generate
   - **Day of Month** — which day to generate (for Monthly/Quarterly/Annually)
   - **Start Date** — when to start generating invoices
   - **End Date** (optional) — when to stop generating
   - **Max Occurrences** (optional) — limit the number of invoices generated
   - **Notes** — optional notes that will appear on each generated invoice
   - **Invoice Lines** — add the items, quantities, and prices that will appear on each invoice
4. Click **Create Template**.

### Method 2: Clone from Existing Invoice

1. Open a **draft or posted** Sales Invoice.
2. Click the **Clone to Recurring** button in the action bar.
3. Fill in:
   - **Template Name** — a descriptive name
   - **Frequency** — how often to generate
   - **Start Date** — when to start (defaults to today)
   - **End Date** or **Max Occurrences** (optional)
4. (Optional) Set **Day of Week** for weekly schedules, or **Day of Month** for monthly/quarterly/annual schedules.
5. Click **Create Template**.

The template will use the same customer, items, quantities, and prices from the original invoice.

## How to Generate Invoices

1. Go to **Sales → Recurring Invoices**.
2. Click **Generate Due**.
3. The system finds all active templates where the next generation date is today or earlier.
4. For each template, a **DRAFT** Sales Invoice is created.
5. The template's next generation date is advanced to the next scheduled date.

> **Note:** Generated invoices are created as **DRAFT** — you still need to review and post them. This gives you a chance to verify amounts before they affect your books.

## How to Manage Templates

### Pause a Template

If you need to temporarily stop generating invoices:
1. Find the template in the list.
2. Click the **Pause** button (⏸ icon).
3. The template status changes to **PAUSED** — no invoices will be generated until you resume.

### Resume a Template

To restart a paused template:
1. Find the template in the list.
2. Click the **Resume** button (▶ icon).
3. The template status changes back to **ACTIVE**.

### Cancel a Template

To permanently stop a template:
1. Find the template in the list.
2. Click the **Cancel** button (✕ icon).
3. The template status changes to **CANCELLED** — this cannot be undone.

### Edit a Template

You can update the template details (name, customer, lines, schedule) by clicking on the template row. Note that you cannot edit a cancelled template.

## Understanding Template Status

| Status | Meaning |
|--------|---------|
| **ACTIVE** | Template is generating invoices on schedule |
| **PAUSED** | Template is temporarily stopped — no invoices generated |
| **COMPLETED** | Template has finished (reached max occurrences or end date) |
| **CANCELLED** | Template was manually cancelled — cannot be resumed |

## Frequently Asked Questions

**Q: Can I change the price on a recurring invoice template?**
A: Yes. Edit the template and update the line item prices. Future generated invoices will use the new prices.

**Q: What happens if I miss a generation date?**
A: The system catches up. When you click "Generate Due," it generates all invoices for templates where the next generation date is today or earlier. If a template was supposed to generate on the 1st and you click "Generate Due" on the 15th, it will generate that missed invoice.

**Q: Can I see which invoices were generated from a template?**
A: Each generated invoice has a note prefix "[Recurring]" in the notes field. You can also filter invoices by the template's source invoice ID if you cloned from an existing invoice.

**Q: What if a generated invoice has the wrong amounts?**
A: Generated invoices are created as DRAFT. You can edit them before posting. The template itself is not affected by edits to generated invoices.

**Q: Can I set different prices for different currencies?**
A: Each template has a single currency. If you need multi-currency recurring invoices, create separate templates for each currency.
