# Account Code Format Selector

When a customer or vendor uses the **Auto-create sub-account** strategy, the system generates the sub-account code from a **template**. The template is a small pattern string that uses three tokens:

- `{parent}` — the parent AR or AP account's code (e.g. `10401` for customers, `20100` for vendors).
- `{partyCode}` — the customer's or vendor's own code (e.g. `C001`).
- `{seq3}` — a 3-digit sequence (e.g. `001`, `002`). Used when a collision would otherwise produce a duplicate account code.

The selector on the **Financial Settings** tab of the customer / vendor master card lets you pick from 3 presets or write a custom pattern.

## Presets

| Preset | Pattern | Example | When to use it |
|---|---|---|---|
| Parent dash party code (default) | `{parent}-{partyCode}` | `10401-C001` | The most common convention. Human-readable and easy to filter. |
| Parent dash sequence | `{parent}-{seq3}` | `10401-001` | When the party code is not stable (e.g. you renumber customers and want the GL account number to stay stable). The backend auto-disambiguates on collision. |
| Parent dot party code | `{parent}.{partyCode}` | `10401.C001` | If you prefer a `.` separator (common in some legacy COA conventions). |

## Custom pattern

Pick **Custom…** in the selector to type any pattern that uses `{parent}`, `{partyCode}`, and/or `{seq3}`. The form shows a live preview of the code that would be generated for the current party code. If the pattern does not include `{partyCode}` or `{seq3}`, the backend will refuse to save because the generated codes would not be unique.

Examples:

- `{parent}_C_{seq3}` → `10401_C_001`
- `{parent}/{partyCode}` → `10401/C001`
- `AR-{partyCode}` (only if your COA is set up so the parent is implicit — usually you still need `{parent}`)

## When the format is applied

The format you pick is **stored in the company-level Sales or Purchase settings** when you save a new customer or vendor. Subsequent parties follow the same format.

- If the company was created with the **Simple Trading Company** starter, the default format is `{parent}-{partyCode}`.
- You can change the format at any time from this card; the change applies to the next new party, not to existing parties' accounts.
- The format does **not** retroactively change the codes of existing party sub-accounts. Use a chart-of-accounts rename tool if you need that.

## Why the format is a per-company setting, not per-party

The parent AR / AP account is a **single account** in the chart of accounts (e.g. `10401 Customers Receivable`). All customer sub-accounts sit under it. Mixing formats under the same parent makes reports harder to read. By storing the format at the company level, the chart stays consistent.

## Related

- [Customer Master Card](../sales/customer-master-card.md) — the Financial Settings tab where you pick the format.
- [Vendor Master Card](../purchases/vendor-master-card.md) — same flow for vendors.
- [Pricing and COA Architecture](../../architecture/pricing.md) — broader rules around party accounts.
