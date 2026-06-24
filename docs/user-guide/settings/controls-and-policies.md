# Controls and Policies

**Where:** Settings → **Controls and Policies** (`/settings/controls-and-policies`).
**Who can open it:** the company owner, and any user with the `system.company.manage` permission.

## What it is

Controls and Policies is the one place where you set the **company-wide rules** that decide what users are allowed to do, and what needs approval, across **Sales, Purchases, and the till (POS)**.

Examples of what you can set here:

- "Posting a Sales invoice above 10,000 requires approval."
- "Direct sales at the till are allowed."
- "Selling below cost is blocked, no exceptions."
- "Processing a return always requires approval."

A rule can apply to the **whole company**, a **specific area** (Sales, Purchases, POS, Accounting), a **role**, a **user**, or a **specific place** such as a register, warehouse, or branch.

## The rule table

Each rule is one row:

| Column | What it means |
|---|---|
| **What it controls** | The action the rule is about (e.g. "Posting an invoice", "Direct sale at the till"). |
| **Applies to** | Who or what the rule covers: the whole company, one area, one role, one user, or one place. |
| **Behaviour** | What happens: **Allow**, **Block**, or **Require approval**. For "Require approval" you can also set **Only above amount** so approval is only needed past a certain value. |
| **When (optional)** | A condition, e.g. only when the document amount is over a number. |
| **Cannot be overridden?** | Tick the box to make the rule absolute — even an approved override cannot pass it. Use this for absolute blocks such as "accounting period is locked". |
| **Actions → Remove** | Deletes the rule. You can always add it again. |
| **Advanced** | An expandable panel with the rule's stable id, priority (higher wins ties), and a reason code (e.g. `PERIOD_LOCKED`) used in audit logs. |

## How to add a rule

1. Open **Settings → Controls and Policies**.
2. Click **Add rule**.
3. Choose what the rule controls, who it applies to, and the behaviour (Allow / Block / Require approval).
4. (Optional) Add a "when" amount condition, tick "Cannot be overridden", or open **Advanced** to set a priority or reason code.
5. Click **Save**. A green toast confirms the rules were saved.

## Module-specific controls

Each area also has its own **Controls** screen inside its settings, so a tenant that only uses one area can still manage that area's rules:

- **POS → Settings → Controls** — rules that only affect the till.
- **Sales → Settings → Controls** — rules that only affect Sales.
- **Purchases → Settings → Controls** — rules that only affect Purchases.

These only show the rules tagged for that area. **Company-wide rules** (rules that apply to the whole company rather than a single area) are managed here, from the company-wide **Controls and Policies** screen — never from a module's Controls tab.

## Tips

- Start with the **whole company** scope; only narrow to a role, user, or place when you need an exception.
- Use **Cannot be overridden** sparingly — it makes the rule absolute even against an approved override.
- Edits to a shared below-cost selling policy still live in the existing **Below-cost selling policy** card; this screen can also express it as a typed rule.

## Troubleshooting

- *"Failed to save controls and policies."* — Make sure you still hold `system.company.manage`. The message shows the server's reason in parentheses.
- *A rule you added is not taking effect* — check the **Applies to** area and the **When** amount. A rule that applies to "This area only (POS)" will not affect Sales.