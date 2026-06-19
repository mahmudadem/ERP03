# Brief: Inventory valuation & selling profit under a volatile base currency (FX cost basis)

> Status: Owner-confirmed direction (2026-06-19). Self-contained issue brief — readable with no prior conversation context. **Feeds:** [planning/tasks/241-party-item-price-memory.md](../tasks/241-party-item-price-memory.md) (the per-currency price-memory work shares this decision).

## The question
A company keeps its books in a **volatile base currency (e.g. SYP)** but buys items priced in a **stable currency (e.g. USD)**. When the exchange rate moves sharply after purchase, two things must be answered consistently:
1. **How do we value the stock we still hold?**
2. **How much profit did we actually make when we sell an item?**

These are the owner's most important questions, and they are the *same* decision surfaced twice.

## The one fact that drives everything
**Inventory is a *non-monetary* asset.** Monetary items (cash, AR, AP) are re-translated when the rate moves; inventory, under standard historical-cost accounting (IAS 2), is **not**. That fact creates the fork below.

## Worked scenario (the canonical example)
- Base currency = **SYP**.
- Buy **1 unit @ 1 USD** when rate = **1,000** → recorded cost **1,000 SYP**.
- Rate later moves to **12,000**.
- Sell the unit for **1.5 USD = 18,000 SYP**.

### Treatment A — Historical cost (strict GAAP / IAS 2)
| Measure | Value |
|---|---|
| Stock value (1 unit) | **1,000 SYP** (never retranslated) |
| COGS on sale | 1,000 SYP |
| Reported "profit" | 18,000 − 1,000 = **17,000 SYP** |
| "Avg cost" shown in USD | 1,000 ÷ 12,000 = **0.083 USD** |

**Problem:** ~16,000 SYP of that "profit" is just the currency falling, not good trading. The USD cost view (0.083 USD) is nonsense — you actually paid 1 USD — so any pricing done off it will badly **undersell** and decapitalize the business.

### Treatment B — Replacement cost (CHOSEN DEFAULT for volatile-currency businesses)
Anchor the cost in the stable currency (1 USD) and revalue the carrying amount to the current rate. Segregate the currency movement as a **holding gain**, never as sales profit.

| Measure | Value |
|---|---|
| Stock value (1 unit) | 1 USD × 12,000 = **12,000 SYP** |
| COGS on sale | 12,000 SYP |
| **Real selling profit** | 18,000 − 12,000 = **6,000 SYP (= 0.5 USD)** |
| Currency / holding gain (separate line) | 12,000 − 1,000 = **11,000 SYP** |
| "Avg cost" shown in USD | **1 USD** (sensible) |

**Both treatments total the same 17,000 SYP gain.** B simply *splits the truth*: real trading margin (6,000) vs currency gain (11,000). That answers the owner's real question — *"how much did I actually make selling this item?"* = **0.5 USD/unit**, not an illusory 17,000 SYP.

## GL skeleton for Treatment B
1. **Purchase** (rate 1,000): `Dr Inventory 1,000 / Cr AP 1,000` (booked normally at transaction rate).
2. **Revaluation** (rate now 12,000, delta 11,000): `Dr Inventory 11,000 / Cr Inventory Revaluation – Holding Gain 11,000`. Reuses the existing `defaultInventoryRevaluationAccountId` and the value-only revaluation mechanism (backlog-223).
3. **Sale** (rate 12,000): `Dr AR/Cash 18,000 / Cr Sales 18,000` and `Dr COGS 12,000 / Cr Inventory 12,000`.

Net P&L: trading profit 6,000 (in Sales − COGS) **plus** a clearly separate holding-gain line of 11,000.

## Decision (owner-confirmed 2026-06-19)
- **Default cost basis = B (Replacement).** The pilot operates in SYP; stock value and selling profit must reflect replacement cost so pricing stays sound and margins are honest.
- **A (Historical) remains available** as a company setting for anyone who wants strict historical-cost reporting.
- **The holding gain is always segregated** into its own GL account — it must never inflate reported sales profit, under either basis.

### Caveat (be honest about standards)
Treatment B recognises an **unrealised holding gain** on stock still on hand, which departs from strict lower-of-cost historical-cost GAAP and sits closer to hyperinflationary accounting (IAS 29) / management accounting. This is an intentional, owner-chosen tradeoff for a volatile-currency market. Because the holding gain is segregated, a strict historical-cost view (Treatment A) is always recoverable by ignoring the revaluation line.

## Setting to add
Company setting **`inventoryFxCostBasis`**: `REPLACEMENT` (default) | `HISTORICAL`.
- Controls (a) Balance-Sheet stock valuation, (b) COGS basis on sale, and (c) the "average cost in a foreign-currency document" figure used by the price-memory feature ([Task 241](../tasks/241-party-item-price-memory.md)). These three are the **same** choice and must read the same setting.

## Interaction with average cost (ties to Task 241)
- The **average cost** is maintained as a **single source of truth in the item's main currency** (e.g. SYP). There is never an independent per-currency running average (different invoice rates over time would make parallel averages drift and double-count FX).
- A foreign-currency document derives the cost figure **from that single average at the document's own exchange rate**:
  - `HISTORICAL` → recorded base avg ÷ document rate (the 0.083 USD view).
  - `REPLACEMENT` → the stable-currency-anchored replacement cost (the 1 USD view).
- Observed **selling/last prices** are different — those *are* stored natively per currency (real facts), per Task 241.

## Scope / sequencing
- This brief is the **valuation policy**. The per-(party × item) price-memory store and the per-currency "last" records are specified in [Task 241](../tasks/241-party-item-price-memory.md).
- No production data exists yet → no migration/backfill; design cleanly.
- Backend changes take effect only after `npm run build` (tsc → `lib/`); verify via a real round-trip, not just unit tests.
