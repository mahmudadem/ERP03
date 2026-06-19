# Onboarding Wizard — Customizing the Starter Policy

The **Company Setup** step of the new-company wizard asks for a single high-level choice — the **Inventory Control Mode** — and then derives every other starter setting from it. The default mapping is intentional and works for the vast majority of small companies. For the rare cases where you need to override one of the derived settings, open the **Customize starter policies** disclosure and change what you need.

## What the disclosure exposes

| Field | Default source | Notes |
|---|---|---|
| Chart of Accounts | Mode | Pick **Periodic trading COA** or **Standard COA**. |
| Costing basis | Mode | **Global** (one cost per item) or **Warehouse** (separate cost per warehouse). |
| Default warehouse code | `MAIN` | Any short alphanumeric code. |
| Default warehouse name | `Main Warehouse` | The display label for the default warehouse. |
| Sales workflow | Mode | **SIMPLE** (direct invoicing) or **OPERATIONAL** (sales orders, delivery notes, linked invoicing). |
| Purchase workflow | Mode | **SIMPLE** or **OPERATIONAL**. |

## How the defaults work

When you change the **Inventory Control Mode**, every field that you have **not touched** updates to the recommended value for the new mode. Once you touch a field (select a different value, type a warehouse name, etc.), it is locked to your choice and survives subsequent mode changes.

This means:

- You can pick Periodic mode and override only the **Default warehouse code** — the rest stays mode-driven.
- You can pick Standard mode and override only the **Sales workflow** — the rest stays mode-driven.
- If you change your mind about a custom field, you can re-edit it later; the field becomes "touched" only the first time you change it from the auto-default.

## What happens to mode-only settings

Some settings stay mode-only and are **not** exposed in the disclosure:

- The **inventory accounting mode** itself (PERIODIC / INVOICE_DRIVEN / PERPETUAL).
- The **costing method** (moving average).
- The **sales persona** (direct vs. linked).
- **Allow direct invoicing** and **allow overpayment** flags.
- **Negative stock** and **auto-generate item code** settings.
- **Tax behavior** (always tax-ready, no country rate).

These are intentionally coupled to the mode so the starter policy is internally consistent.

## Validating the override

When you click **Next**, the wizard posts the overrides together with the mode. The backend (`OnboardingController.createCompany`) validates each value and returns HTTP 400 if any value is not a recognized enum. The starter initializer (`SimpleTradingCompanyInitializer.execute`) then uses the override when present and falls back to the mode-derived default otherwise, so the existing mode-driven behavior is unchanged for any caller that does not pass overrides.

After the company is created, the policy summary returned by the API reflects the **chosen** values, not the mode defaults. You can verify them in **Settings > Company > Policy Summary** or by re-opening the wizard preview.

## Common override recipes

| Goal | What to change |
|---|---|
| "I picked Periodic but I actually want the Standard COA." | Expand the disclosure → set **Chart of Accounts = Standard COA**. |
| "I want one warehouse called `WH-MAIN` and a different name." | Expand → set **Default warehouse code = `WH-MAIN`**, **Default warehouse name = `Main distribution warehouse`**. |
| "I picked Advanced but my team isn't ready for operational workflow." | Expand → set both **Sales workflow** and **Purchase workflow** to **SIMPLE**. You can switch them back to OPERATIONAL later from each module's settings. |
| "I'm setting up a store and want a per-warehouse cost even though I'm using invoice-driven inventory." | Expand → set **Costing basis = Warehouse**. |

## When NOT to use the disclosure

If you're setting up a small trading company for the first time, the mode-driven defaults are almost always what you want. Skip the disclosure and let the wizard fill in everything. You can change any of the policies later from the per-module Settings pages:

- **Chart of Accounts** can be added to or replaced; existing accounts are not deleted.
- **Costing basis** can be switched in Inventory Settings until the first posted stock or accounting transaction.
- **Default warehouse** can be renamed, and additional warehouses can be added at any time.
- **Sales / Purchase workflow** can be switched in each module's Settings.

## Related

- [Company Setup Wizard Overview](./onboarding-company-wizard.md) — full walkthrough of the new-company flow.
- [Architecture: Onboarding](../../architecture/onboarding.md) — the backend code path for the wizard and the override fields.
