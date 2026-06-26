# Till Controls (POS)

**Where:** POS → Settings → **Controls** tab.
**Who can open it:** users with the `pos.settings.manage` permission.

## What it is

The Controls tab in **POS Settings** shows only the **till-side rules** that belong to POS — for example "Direct sale at the till", "Processing a return", "Reprinting a receipt", "Changing a price", "Applying a discount", "Changing tax", or "Voiding a line".

It works the same way as the company-wide **Controls and Policies** screen, but it shows **only POS-tagged rules**. Company-wide rules (rules that apply to the whole company rather than to a single area) are **not** shown or editable here — they live in **Settings → Controls and Policies**.

A POS-only tenant (a shop that only has the POS module switched on) can still reach and edit this screen without needing Sales, Purchases, or the company matrix permission.

## How to add a till rule

1. Open **POS → Settings → Controls**.
2. Click **Add rule**.
3. Choose what the rule controls, the **Applies to** level (whole company, POS area, a role, a user, or a place such as a register), and the behaviour (Allow / Block / Require approval).
4. Click **Save**. A green toast confirms the rules were saved.

## What you cannot do here

- You cannot add rules tagged for Sales, Purchases, or Accounting. The till editor only accepts POS rules; the server rejects any rule sent with another area's tag.
- You cannot accidentally delete a company-wide absolute rule by saving here — the company-wide rule list is preserved untouched on every till save.
- You cannot set a different active company from this screen — the active company from your sign-in is always used.

## Tip

If a rule needs to apply to **the whole company** (Sales, Purchases, and the till together), add it from **Settings → Controls and Policies** instead, with **Applies to = Whole company** and no area tag.