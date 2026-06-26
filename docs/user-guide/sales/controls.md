# Sales Controls

**Where:** Sales → Settings → **Controls** tab.
**Who can open it:** users with the `sales.settings.manage` permission.

## What it is

The Controls tab in **Sales Settings** shows only the **Sales-side rules** that belong to Sales — for example "Posting an invoice", "Processing a return", or "Selling below cost".

It works the same way as the company-wide **Controls and Policies** screen, but it shows **only Sales-tagged rules**. Company-wide rules (rules that apply to the whole company rather than to a single area) are **not** shown or editable here — they live in **Settings → Controls and Policies**.

A Sales-only tenant can reach and edit this screen without needing POS, Purchases, or the company matrix permission.

## How to add a Sales rule

1. Open **Sales → Settings → Controls**.
2. Click **Add rule**.
3. Choose what the rule controls, the **Applies to** level (whole company, Sales area, a role, a user, or a place), and the behaviour (Allow / Block / Require approval).
4. **Require approval** can be limited to **Only above amount**, e.g. invoice posting over 10,000 needs approval but smaller invoices post immediately.
5. Click **Save**. A green toast confirms the rules were saved.

## What you cannot do here

- You cannot add rules tagged for POS, Purchases, or Accounting here. Sales editor only accepts Sales rules; the server rejects any rule sent with another area's tag.
- You cannot accidentally delete a company-wide absolute rule by saving here — the company-wide rule list is preserved untouched on every Sales save.
- You cannot set a different active company from this screen — your signed-in active company is always used.

## Tip

If a rule needs to apply to **the whole company** (Sales, Purchases, and the till together), add it from **Settings → Controls and Policies** instead, with **Applies to = Whole company** and no area tag. The existing **Below-cost selling policy** card on the **Sales Policy** tab is still the simplest way to set the below-cost behaviour — both that card and a typed `belowCostSale` rule here read the same shared store.