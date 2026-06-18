# Periodic Inventory Accounting Mode

`PERIODIC` mode is for simple trading companies that want:

- stock **quantities** tracked continuously
- purchase and sales documents posted to normal trading-book accounts
- **no Inventory asset / no COGS GL lines on each transaction**

ERP03 now treats `PERIODIC` as a real inventory-accounting mode, not as a hidden alias for invoice-driven posting.

---

## What posts in Periodic mode

| Document | GL result | Quantity result |
|---|---|---|
| Purchase Invoice | Dr **Purchases** / Cr AP (+ tax) | Increases stock only if no Goods Receipt already did it |
| Sales Invoice | Dr AR / Cr **Sales** (+ tax) | Reduces stock only if no Delivery Note already did it |
| Purchase Return | Dr AP / Cr **Purchase Returns** | Reduces stock |
| Sales Return | Dr **Sales Returns** / Cr AR | Increases stock |
| Goods Receipt / Delivery Note | **No GL** | Own the stock movement when you use them |
| Stock Adjustment | **No GL** | Adjusts stock quantity |
| Opening Stock | Dr **Goods / Opening Inventory** / Cr Opening Balance Equity | Creates opening stock |

Important:

- ERP03 still protects you from **double quantity posting**. If a Goods Receipt or Delivery Note already moved the quantity, the later invoice does **not** move it again.
- Opening Stock is the one periodic exception that can still post GL, because opening inventory must be tied to equity.

---

## When to choose it

Use `PERIODIC` when your company wants simple trading books:

- Purchases during the period accumulate in Purchases accounts
- Sales during the period accumulate in Sales accounts
- Closing inventory and trading-profit analysis are handled at reporting / closing time

Do **not** choose it if you need every sale to post COGS and every purchase to update the Inventory asset account immediately. For that, use `INVOICE_DRIVEN` or `PERPETUAL`.

---

## Simple Trading Company default

The **Simple Trading Company** starter now uses:

- the **Periodic Trading** chart of accounts
- `Inventory accounting mode = Periodic`
- Sales Orders / Delivery Notes / Purchase Orders / Goods Receipts hidden by default in the sidebar

Those operational documents can still be enabled later if the company grows into a more controlled workflow.

---

## What users should expect

In daily work:

1. Enter Purchase Invoices and Sales Invoices normally.
2. ERP03 still keeps stock on hand accurate.
3. You will **not** see Inventory / COGS voucher lines on each invoice.
4. Returns use separate contra accounts (`Sales Returns`, `Purchase Returns`) instead of reversing Inventory.

What comes later:

- report-time inventory valuation
- closing inventory / trading-account reporting

Those are the next phases of Epic 240.
