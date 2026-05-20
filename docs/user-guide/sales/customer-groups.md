# Customer Groups

Customer groups let you organize your customers into segments — for example, "Retail", "Wholesale", or "VIP Accounts". Each group can carry a set of default commercial terms that pre-fill when you create or update a customer in that group.

---

## What customer groups are for

When you have many customers who share the same pricing tier, payment terms, or credit limit, managing those settings one customer at a time is tedious. A customer group lets you define defaults once and apply them to all customers in that segment.

Groups do not enforce rules automatically — they provide default values that the system suggests when you assign a customer to the group, or that an administrator can apply in bulk.

---

## Creating a customer group

1. Go to **Sales → Customer Groups**
2. Click **New Customer Group**
3. Fill in:
   - **Name** — a clear label, for example "Wholesale" or "Government Accounts"
   - **Description** — optional notes
   - **Default Price List** — the price list that applies to customers in this group
   - **Default Payment Terms (days)** — how many days customers in this group have to pay
   - **Default Credit Limit** — the maximum outstanding balance allowed for customers in this group
   - **Tax Exempt** — tick if customers in this group are generally exempt from tax
   - **Status** — Active or Inactive
4. Save

---

## Assigning customers to a group

1. Open the customer record (Sales → Customers → select the customer)
2. Go to the **Commercial** tab
3. Choose the group in the **Customer Group** field
4. Save

The customer's record will show which group they belong to. You can use this for reporting and filtering.

---

## What the group defaults do

When you assign a customer to a group, the group's defaults can be used as suggested values for:

- the customer's price list
- their payment terms
- their credit limit
- whether they are tax-exempt

These defaults are starting points. You can override any of them directly on the individual customer's **Commercial** tab. An override on the customer always takes priority over the group default.

---

## Per-customer settings on the Commercial tab

Beyond the group, each customer record supports individual settings:

| Setting | What it does |
|---|---|
| **Customer Group** | Assigns the customer to a segment |
| **Default Price List** | Overrides the group price list for this customer specifically |
| **Credit Limit** | The maximum outstanding balance for this customer |
| **Credit Hold Policy** | None, Warn, or Block — controls what happens when the customer exceeds their limit |
| **Tax Exempt** | Marks this customer as exempt from tax |

**Note on credit hold:** The Credit Hold Policy field stores your intent but does not yet block or warn automatically. Full credit hold enforcement is coming in a future release.

---

## Common questions

**Can a customer belong to more than one group?**
No — each customer belongs to one group at most.

**Does changing the group defaults update existing customers?**
No. Changing a group's default credit limit or price list does not automatically update customers already in the group. The defaults only apply as suggestions when you assign a new customer or manually edit a customer's settings.

**Can I use groups for reporting?**
Yes. You can filter the customer list by group, and future sales reports will support filtering by customer group.

**What happens if I set a customer's own price list AND they are in a group with a different list?**
The customer's own price list takes priority. The group list is only a fallback for customers without their own list assignment.
