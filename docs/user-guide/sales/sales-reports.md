# Sales Analytics Reports

The Sales Analytics page groups your posted invoices in three different ways so you can answer common business questions quickly: which customers are buying the most, which products are selling best, and how each salesperson is performing.

Go to **Sales → Reports → Sales Analytics** to open the page.

---

## Choosing a date range

All three reports share the same date filter. Set a **From date** and **To date** to limit the results to a specific period — for example, the current month, a quarter, or a financial year. Leave the dates blank to see all-time data.

Only **posted** invoices are included. Draft or cancelled invoices are not counted.

---

## Report 1: Sales by Customer

**What it answers:** Who are my biggest customers, and how much have they bought?

This report lists every customer who has at least one posted invoice in the selected period. For each customer you see:

- **Number of invoices** — how many invoices were raised for them in the period
- **Revenue (ex-tax)** — the total net revenue, before tax
- **Tax** — the total tax charged
- **Gross total** — the total amount billed including tax

Customers are sorted with the highest-revenue customer at the top, so your biggest accounts are always visible first.

**Use cases:**
- Identify your top 10 customers for the year
- Compare customer revenue between two periods (run the report twice with different date ranges)
- Spot customers whose spending has dropped

---

## Report 2: Sales by Item

**What it answers:** Which products or services are generating the most revenue?

This report looks inside every invoice line (not just the invoice header) and groups the results by item. For each item you see:

- **Total quantity sold** — the number of units invoiced across all customers in the period
- **Revenue** — the total net line value
- **Number of invoice lines** — how many times the item appeared on an invoice

Items are sorted with the highest-revenue item at the top.

**Use cases:**
- Identify your best-selling products
- See which items are frequently invoiced in low quantities (many lines, low qty) vs. bulk orders (few lines, high qty)
- Track whether a new product is gaining traction

---

## Report 3: Sales by Salesperson

**What it answers:** How much has each member of the sales team sold?

This report groups posted invoices by the salesperson assigned to each invoice. For each salesperson you see:

- **Number of invoices**
- **Revenue (ex-tax)**
- **Gross total (including tax)**

Invoices that have no salesperson assigned are grouped into an **Unassigned** row so that no revenue is lost from the totals.

Salespeople are sorted with the highest-revenue salesperson at the top.

**Use cases:**
- Review individual sales performance against targets
- Compare performance across the team over a period
- Identify how much revenue has no salesperson attribution (the Unassigned row)

---

## Reading the totals row

Each report shows a **Totals** row at the bottom that sums all rows in the table. Use the totals row to confirm the overall revenue for the period — it should match across all three tabs if you are running the same date range (since all three draw from the same set of posted invoices).

---

## Common questions

**Why does an invoice appear in Sales by Customer but show "Unassigned" in Sales by Salesperson?**
The invoice was posted without a salesperson selected. You can update the salesperson assignment on the invoice if it was an oversight, though posted invoices may have editing restrictions depending on your settings.

**The revenue figures look lower than I expected.**
The reports show net revenue (before tax) in the Revenue column. The Gross total column includes tax. Also confirm your date range is set correctly — only invoices with an invoice date within the selected range are included.

**Can I export the data?**
Export options depend on your browser and the frontend version. If there is no export button, you can copy the table from your browser or use a browser print function to save the report.
