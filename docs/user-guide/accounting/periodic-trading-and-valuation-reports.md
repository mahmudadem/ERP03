# Periodic Trading and Inventory Valuation Reports

This guide is for companies using **Periodic** inventory accounting.

In Periodic mode, ERP03 does **not** post Inventory asset and COGS on every sale or purchase. Instead, ERP03 keeps stock quantities accurate all the time, then calculates inventory value and gross profit **when you run the reports**.

---

## What changes in the reports

### Balance Sheet

The Balance Sheet inventory figure is calculated at report time using the stock on hand at the selected date.

Current rule:

- Balance Sheet inventory uses the **Average** pricing policy

### Trading Account

The Trading Account calculates gross profit as:

`Sales − (Opening Inventory + Net Purchases − Closing Inventory)`

Where:

- **Opening Inventory** = stock value at the day before the report start date
- **Net Purchases** = purchases minus purchase returns from the ledger
- **Closing Inventory** = stock value at the report end date

### Profit & Loss

Profit & Loss uses the same periodic cost-of-sales result from the Trading Account logic, instead of treating the raw Purchases balance as the final expense.

---

## Inventory Valuation report

Open:

- `Inventory → Reports → Inventory Valuation`

Choose:

1. **As-of Date**
2. **Pricing Policy**

Available pricing policies:

- **Average**: values stock using the moving average cost
- **Last Purchase**: values stock using the latest recorded purchase-style cost

The report shows:

- quantity on hand
- policy cost
- total value per item / warehouse
- grand total

---

## Important control note

These reports do **not** post a closing journal automatically.

That means:

- opening the report does not change the ledger
- the figures are safe to review repeatedly during the month
- stock corrections still require normal inventory documents such as Opening Stock, Stock Adjustment, Purchase Invoice, Sales Invoice, Delivery Note, or Goods Receipt

---

## When to use which view

- Use **Inventory Valuation** when you want to inspect how ERP03 valued the stock itself.
- Use **Trading Account** when you want gross profit for a period.
- Use **Profit & Loss** when you want the full income statement with periodic cost of sales already folded in.
- Use **Balance Sheet** when you want the current inventory carrying value at a point in time.

---

## Common questions

**Q: Why does the Inventory Valuation report let me pick Last Purchase, but the Balance Sheet uses Average?**  
A: ERP03 lets you analyze stock by more than one pricing policy, but the current periodic financial reports use **Average** so the Balance Sheet, Trading Account, and Profit & Loss stay internally consistent.

**Q: Did ERP03 create a closing entry when I opened the Trading Account?**  
A: No. The report is a calculation only.

**Q: If I fix a stock mistake, do the periodic reports update?**  
A: Yes. Once the correcting stock document is posted, the next report run uses the new quantity/cost state.
