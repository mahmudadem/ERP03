# Below-cost selling policy

This setting controls what happens when an item is sold **at or below what it
cost you** — for example, a clearance line priced under its purchase cost. The
rule is **company-wide** and applies to **both** the POS till and Sales invoices,
so you set it once and both behave the same way.

## Where to find it

**Sales → Settings → Sales Policy → Below-cost selling policy**

## The three choices

| Mode | What happens at the till / on an invoice |
|------|-------------------------------------------|
| **Block** | A below-cost line is refused. The sale cannot be completed until the price is raised above cost. |
| **Require approval** *(default)* | A below-cost line is stopped until a manager approves it. This is how the POS till behaved before this setting existed. |
| **Allow** | Below-cost lines go through with no interruption. |

### Minimum gross margin (%) — optional

If you set a minimum margin (say 10%), any line whose profit margin is **below
that percentage** is treated the same as a below-cost line — even if it is
technically above cost. Leave it blank to only guard against selling *below cost*.

### Allow manager override

When this is on (the default), an approved manager override can let a blocked
below-cost line through. Turn it **off** to make the rule absolute — then nobody
can push a below-cost (or below-minimum-margin) line through, no matter what.
(This has no effect when the mode is **Allow**.)

## What you'll see

- With **Block** or **Require approval**, completing a below-cost sale shows a
  message that the line *"is below allowed cost/margin and requires approval"* and
  the sale/invoice is not posted.
- With **Allow**, nothing interrupts you.

## Notes

- The setting takes effect immediately for new POS sales and new Sales invoices.
- It is set once for the whole company — it is not per branch or per item.
- Changing it does not affect sales that were already completed.
