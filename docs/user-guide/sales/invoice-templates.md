# Invoice Templates

Use invoice templates to control how your printed sales invoices look (logo, footer, terms, and layout style).

---

## What this feature does

- Lets your team pick an invoice template when creating a Sales Invoice.
- Lets you assign a default invoice template per customer.
- Keeps template choices controlled and consistent with workflow governance.

---

## Set a default template for a customer

1. Go to `Sales -> Customers`.
2. Open a customer card.
3. In **Commercial Terms**, set **Default Invoice Template**.
4. Save.

From now on, when creating a new invoice for that customer, the template is pre-selected automatically.

---

## Choose a template while creating an invoice

1. Go to `Sales -> Invoices -> New Invoice`.
2. Select customer and invoice context (direct or linked).
3. In **Invoice Template**, choose the desired template.
4. Complete invoice lines and post as usual.

The selected template is saved with the invoice and used for document layout output.

---

## Important behavior

- Template options are filtered by invoice context:
  - direct invoice templates for direct invoices
  - linked invoice templates for order/delivery-linked invoices
- If no customer default is set, the system picks the default template for that context.
- This feature does not enable free-canvas design. Templates are still managed through the Forms Designer.

