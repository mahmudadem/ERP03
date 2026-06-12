# Golden Path 04 — Purchases

> **Goal:** the full procure-to-pay cycle posts correctly, mirroring Sales.
> **Precondition:** Golden Paths 01–03 passed on this tenant. Purchases workflow mode: OPERATIONAL.

## A. Master data

| # | Step | Expected |
|---|------|----------|
| 1 | Create vendor VEND-1 | Saved; AP sub-account auto-created |
| 2 | Vendor Statement for VEND-1 | Empty, no errors |

## B. PO → GRN → Invoice

| # | Step | Expected |
|---|------|----------|
| 3 | Purchase Order: 50 × ITEM-A @ 10 from VEND-1; confirm | PO confirmed |
| 4 | Goods Receipt from PO, 50 units into WH-1; post | Stock +50; GRNI credited, inventory debited |
| 5 | Purchase Invoice from the PO/GRN | Lines inherited |
| 6 | Add a **line discount** 5% on the ITEM-A line | Net cost updates; taxable base post-discount |
| 7 | Add an invoice-level **Charge** 30 (freight) and **Discount** 10 in the allocation grid | Grand total = lines − line discount + 30 − 10; charge **debits** its account, discount **credits** (flipped vs Sales) |
| 8 | Post on credit (no settlement) | POSTED; GRNI cleared; AP credited with net total; voucher balanced |
| 9 | Record Payment for the full amount from cash | Invoice PAID; payment voucher linked; AP zero for this bill |

## C. Return

| # | Step | Expected |
|---|------|----------|
| 10 | Purchase Return of 5 × ITEM-A against the posted PI; post | Stock −5; AP/debit-note reversal correct; inherited line discount honored |

## D. Reports & controls

| # | Step | Expected |
|---|------|----------|
| 11 | Vendor Statement VEND-1 | Bill, payment, return present; balance matches AP sub-account |
| 12 | AP Aging | VEND-1 balance in correct bucket |
| 13 | Stock Levels + Stock Movements | ITEM-A total quantity matches the movement history exactly: GP02 ending quantity 95, minus all GP03 posted sales stock issues, plus GP03 return quantity, plus GP04 GRN 50, minus GP04 return 5. Do not accept a stock-level number that cannot be traced to movement rows. |
| 14 | Trial Balance | Still balanced |

**Pass condition:** all 14 steps green. File failures as `GP04-step#` in `planning/qa/findings.md`.
