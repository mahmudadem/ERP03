# Purchases Controls

**Where:** Purchases → Settings → **Controls** tab.
**Who can open it:** users with the `purchase.settings.manage` permission.

## What it is

The Controls tab in **Purchase Settings** shows only the **Purchases-side rules** that belong to Purchases — for example "Posting an invoice" (a purchase invoice) or "Processing a return" (a purchase return).

It works the same way as the company-wide **Controls and Policies** screen, but it shows **only Purchases-tagged rules**. Company-wide rules (rules that apply to the whole company rather than to a single area) are **not** shown or editable here — they live in **Settings → Controls and Policies**.

A Purchases-only tenant can reach and edit this screen without needing POS, Sales, or the company matrix permission.

## How to add a Purchases rule

1. Open **Purchases → Settings → Controls**.
2. Click **Add rule**.
3. Choose what the rule controls, the **Applies to** level (whole company, Purchases area, a role, a user, or a place), and the behaviour (Allow / Block / Require approval).
4. **Require approval** can be limited to **Only above amount**, e.g. purchase invoice posting over 5,000 needs approval but smaller invoices post immediately.
5. Click **Save**. A green toast confirms the rules were saved.

## What you cannot do here

- You cannot add rules tagged for POS, Sales, or Accounting here. The Purchases editor only accepts Purchases rules; the server rejects any rule sent with another area's tag.
- You cannot accidentally delete a company-wide absolute rule by saving here — the company-wide rule list is preserved untouched on every Purchases save.
- You cannot set a different active company from this screen — your signed-in active company is always used.

## Tip

If a rule needs to apply to **the whole company** (Sales, Purchases, and the till together), add it from **Settings → Controls and Policies** instead, with **Applies to = Whole company** and no area tag.