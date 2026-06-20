# Sales Gross Profit Reports

> **For business owners, accountants, sales managers.**
> This guide explains what the two new reports show, what the direction
> flags mean, and how to read the numbers.

## What Are These Reports?

The **Gross Profit by Document** and **Gross Profit by Item** reports
answer one simple question:

> "How much money did each invoice (or each item) actually make?"

They are **management reports** — built for daily business decisions.
They are **not** the same as your accounting Profit & Loss, Trading
Account, or Inventory Valuation. They are a separate, read-only view
that shows you gross profit per document or per item, in any currency
you issue invoices in, with the base-currency amount right next to it.

## When to Use Them

- "I want to know which invoices were most profitable last month."
- "Which items are making the most money for us?"
- "What's the profit impact of all the returns we had this quarter?"
- "Are our purchase-side costs (PI / PR) eating into our sales profit?"

If you need the official accounting gross profit (with full
chart-of-accounts mapping, period locks, approval status, etc.),
use the existing **Trading Account** and **P&L** reports under
Accounting → Reports. The two report families are complementary.

## How to Open

(Sidebar — once the frontend pages ship; the backend is ready now.)

- **Sales → Reports → Gross Profit by Document**
- **Sales → Reports → Gross Profit by Item**

Backend endpoints (already live, for any direct consumer):

- `GET /api/v1/sales/reports/gross-profit/by-document`
- `GET /api/v1/sales/reports/gross-profit/by-item`

You can filter by date range, document type, item, or document
currency. All filters are optional; leave them off to see the sales
history (`SALES_INVOICE` and `SALES_RETURN`).

## How to Read the Output

Each report returns a row per document (or item) plus a "totals" row.
Every numeric column is shown in **two** flavors:

| Column kind | Meaning |
|-------------|---------|
| `*In` | This is the IN-side of the metric. Money flowing in (revenue, profit) or value flowing in (cost, when inventory is being received). |
| `*Out` | This is the OUT-side. Money flowing out (revenue reversal, profit reversal) or value flowing out (cost, when inventory is being delivered). |
| `*Net` | `In − Out`. The bottom-line number. |

**The number you usually want is the Net.** The IN/OUT split is
there for transparency — so you can answer "is this loss coming from
returns eating into my sales, or from purchase costs?"

### Worked example

You run **Gross Profit by Document** for July 2026 and you see:

| Document | Revenue IN | Revenue OUT | Cost IN | Cost OUT | Profit IN | Profit OUT | Profit Net |
|----------|-----------:|------------:|--------:|---------:|----------:|-----------:|-----------:|
| SI-001 | 15,000 | 0 | 9,000 | 0 | 6,000 | 0 | 6,000 |
| SR-002 (return of part of SI-001) | 0 | 3,000 | 0 | 1,800 | 0 | 1,200 | −1,200 |
| SI-003 | 22,000 | 0 | 12,000 | 0 | 10,000 | 0 | 10,000 |
| **Totals** | **37,000** | **3,000** | **9,000** | **13,800** | **16,000** | **1,200** | **14,800** |

Reading this:
- The first sale made 6,000.
- The partial return **reversed** 1,200 of profit (Net is −1,200 in the
  return row; that means "this return took 1,200 of profit back out of
  the books").
- The third sale made 10,000.
- **Net gross profit for the period: 14,800.**

The IN/OUT split is most useful when you have a lot of returns — you
can see at a glance "we'd have made 16,000 if nobody had returned
anything; returns cost us 1,200; net 14,800."

## Document Types Included

By default, the Sales Gross Profit reports include only sales-side
documents:

| Type | What it is | How the metric flows |
|------|-----------|----------------------|
| `SALES_INVOICE` (SI) | Sale to a customer | Revenue IN, Cost OUT, Profit IN (when sale is profitable) |
| `SALES_RETURN` (SR) | Customer returns goods | Revenue OUT, Cost IN, Profit OUT (reverses a sale) |

The same backend fact table also records purchase-side documents for
future purchase/all-document management reports. You can explicitly
include them by using the document type filter:

| Type | What it is | How the metric flows |
|------|-----------|----------------------|
| `PURCHASE_INVOICE` (PI) | Buy from a vendor | No revenue, Cost IN, Profit OUT (a cost event) |
| `PURCHASE_RETURN` (PR) | Return goods to a vendor | No revenue, Cost OUT, Profit IN (a cost reversal) |

You can filter to any combination. For example:

- "Show me only Sales Invoices" → `documentType=SALES_INVOICE`
- "Show me everything except purchase-side" → `documentType=SALES_INVOICE,SALES_RETURN`
- "Show me everything for one item" → `itemId=itm_abc123`

## FX and Currencies

Each fact row stores the document's currency (`docCurrency`), the
company's base currency (`baseCurrency`), and the historical FX rate
that was used at posting time.

- `*Base` columns: amounts in your base currency, using the
  historical rate from when the document was posted. These are
  **stable** — they don't change if today's FX rate moves.
- `*Doc` columns: amounts in the document's own currency, useful when
  you issue invoices in multiple currencies.

Reports never silently sum different currencies. The base-currency
`Net` is always trustworthy. If a grouped row contains one document
currency, the `*Doc` columns show that currency. If a grouped row
contains more than one document currency, the single `*Doc` totals are
left blank/zero and the API returns a `docCurrencyBreakdown` list
instead, with one subtotal per currency.

## When Are Facts Written?

Every time a sales invoice, sales return, purchase invoice, or purchase
return is **posted**, a fact is written for each line in the same
transaction. If posting succeeds, the facts are there. If posting
fails, the facts are not written — there is no partial state.

If you re-post the same document (e.g. retry after a transient
error), the facts are **replaced, not duplicated**. The system keys
each fact by the document's id, line's id, and a snapshot version, so
re-posting with the same version is a no-op.

## Sales Return Cost Basis — How It Works

When a customer returns goods, the system uses the **current average
cost at the time of the return** for the cost side of the fact (not
the cost that was on the original sale). This is the same cost the
return posting uses for inventory, so the profit fact agrees with
the inventory revaluation.

Example: you sold an item for 15 in June when the average cost was
3. In July the average cost rose to 5. A customer returns 1 unit in
July. The return's fact will show:
- Revenue: 15 OUT (the refund)
- Cost: 5 IN (the average cost **at the time of the return**)
- Profit impact: 10 OUT (you lost 10 of profit on this return, not 12)

The "extra 2" (the difference between the original 3 cost and the
current 5) becomes an inventory revaluation gain that lives in the
accounting stock movement, not in this profit fact.

## What This Report Does NOT Do

- It does **not** include overhead, salaries, rent, or other operating
  expenses. For that, use **Profit & Loss**.
- It does **not** include inventory write-downs or FX revaluation. For
  that, use **Inventory Valuation** and **Balance Sheet**.
- It does **not** replace the **Trading Account** report. The Trading
  Account is built from the GL; this is built from posted invoice
  lines. They will generally agree, but they answer different
  questions.

## Troubleshooting

**Q: A posted invoice doesn't appear in the report.**
- Check the date range filter. The report uses the document's
  `documentDate`.
- Check the `status` filter (defaults to `ACTIVE`). If the document
  was reversed, it shows up as `REVERSED` and is excluded by
  default.
- Check that the user has the
  `accounting.reports.tradingAccount.view` permission (v1 reuse; a
  dedicated permission will be added in a follow-up).

**Q: Profit numbers don't match Trading Account.**
- Different scope: Trading Account includes the GL chart-of-accounts
  mapping. This report uses only the posted invoice line amounts.
  Small differences (rounding, tax, line-vs-gl time-of-posting) are
  expected. Large persistent differences should be reported.

**Q: I added a new document type via Form Designer. Will it appear?**
- The data model is type-agnostic (any `documentType` string is
  accepted). The per-type direction rule is fixed for the 4 built-in
  types. Custom types need a follow-up integration that supplies the
  correct direction — talk to your admin before adding a custom
  document type that you want to see in this report.

## See Also

- [Architecture: reporting.md](../../architecture/reporting.md) — for
  developers
- [End-user guide: sales-gross-profit.md](sales-gross-profit.md) — this
  document
