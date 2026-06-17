# Issue: Inventory accounting "mode" is conceptually wrong — "invoice-driven/SIMPLE" is perpetual-in-disguise, not a true periodic system

> Status: Resolved into a plan (logged 2026-06-18). Self-contained issue brief — readable with no prior conversation context. **Execution plan:** [planning/tasks/240-simple-periodic-mode-and-item-costing-epic.md](../tasks/240-simple-periodic-mode-and-item-costing-epic.md).

## Resolution (owner-confirmed direction, 2026-06-18)
A **three-mode** model, not two: (1) **Periodic/Simple** = true periodic (purchases→Purchases account, no per-transaction inventory/COGS posting, report-time valuation) — NEW, the pilot's primary mode for small traders; (2) **Invoice-driven** = perpetual accounting, single-document workflow (the "middle") — already built; (3) **Perpetual/Accurate** = perpetual, two-step GRN/Delivery — already built. We KEEP modes 2 and 3 and ADD mode 1. Also adds extensible, FX-accurate per-item costing stats (avg cost / last purchase / last sale). See epic 240 for the full design + phased plan.

## Context
ERP03 is a multi-tenant SaaS ERP (Node/Express/Firebase backend, React frontend). It supports inventory with GL integration. Inventory accounting has a company-level "mode" set at company/module initialization and intended to be immutable afterward. We are stabilizing for a pilot aimed at small **trading companies**.

## The two legitimate inventory-accounting models (for reference)
1. **Periodic / hybrid (نظام الجرد الدوري):** Purchases post to a **Purchases** account (P&L/trading), sales post to **Sales**. **No inventory-asset or COGS posting per transaction.** Stock *quantities* are still tracked continuously. Inventory value for the Balance Sheet is computed **at report time** (on-hand qty × cost policy, e.g. moving average), and gross profit is derived via a period-end **Trading account** close. This is what most SME accounting apps in our target market use.
2. **Perpetual (نظام الجرد المستمر):** Every purchase **debits Inventory asset**; every sale posts **COGS in real time** (Dr COGS / Cr Inventory) at moving-average cost. Inventory asset on the Balance Sheet is always live. Requires per-item GL mappings, a costing engine, and continuous stock↔GL reconciliation.

## What the code/docs actually have (the defect)
- `backend/src/domain/inventory/entities/InventorySettings.ts` defines:
  - `LegacyInventoryAccountingMethod = 'PERIODIC' | 'PERPETUAL'`
  - `InventoryAccountingMode = 'INVOICE_DRIVEN' | 'PERPETUAL'`
  - Legacy mapping: **`PERIODIC` → `INVOICE_DRIVEN`** (lines ~212, 225). Default is `PERPETUAL`.
- The design doc `docs/audit/inventory-accounting-model-audit.md` (dated 2025-04-22) relabels these for users as **SIMPLE** (= INVOICE_DRIVEN) and **ACCURATE** (= PERPETUAL).
- **The problem:** even the "SIMPLE / INVOICE_DRIVEN" mode is **still perpetual** in its postings. Per the audit doc's own posting table (section 3) and the live code:
  - Sales Invoice (INVOICE_DRIVEN): `Dr AR, Cr Revenue` **+ `Dr COGS, Cr Inventory`** — still posts COGS and credits the Inventory asset.
  - Purchase Invoice (INVOICE_DRIVEN): `resolveDebitAccountSync()` returns `item.inventoryAssetAccountId` for tracked items → **still debits Inventory asset** (`backend/src/application/purchases/use-cases/PurchaseInvoiceUseCases.ts:1059`).
- So "SIMPLE/invoice-driven" is really **"perpetual costing with COGS recognized at invoice time and no separate Goods-Receipt step"** — NOT a periodic system. The genuine periodic/hybrid model (Purchases account, no per-transaction inventory posting, report-time valuation) **was never specified or built.** `PERIODIC` is a vestigial enum label pointing at a perpetual implementation.
- Note: the audit doc is a *target/recommendation* report; much of it (policy enums, central account-mapping registry, period-end settlement, inventory valuation report, "provisional" report labels) is **not implemented**.

## Concrete symptom this produces (current QA blocker)
Golden-path GP05 (cross-module books reconciliation) fails on one step: after a purchase invoice with a 5% line discount, **Inventory GL = 1,277.5** but **stock valuation = 1,300** (drift **22.5** = the discount). Root cause in `PurchaseInvoiceUseCases.ts`: the **GL debit uses the net (post-discount) line total** (`line.lineTotalBase`, ~lines 1016–1020) while the **stock movement's moving-average cost uses the gross unit price** (`unitCostBase: line.unitPriceBase`, line 705; `line.unitPriceBase = line.unitPriceDoc * rate`, line 1019). This is the perpetual system's reconciliation burden. (Tracked internally as "backlog-223".) In a true periodic system this entire class of drift cannot occur, because purchases never touch an inventory asset per transaction.

## Decisions to evaluate (the actual question)
1. Should the pilot's "SIMPLE" mode be **rebuilt as a true periodic/hybrid system** (Purchases/Sales accounts + report-time inventory valuation), keeping the existing **perpetual** engine as the "ACCURATE" mode? (Current leaning: yes.)
2. What is the blast radius of doing that? Specifically:
   - **COA**: periodic needs Purchases / Purchases-returns / Purchases-discounts / Sales / Sales-returns / Sales-discounts / Opening & Closing inventory / Trading accounts; perpetual needs Inventory Asset / COGS / GRNI. Should there be **mode-specific COA templates** or one annotated superset?
   - **Posting behavior**: periodic must *not* post inventory/COGS movements; perpetual must. The branch point today is `DocumentPolicyResolver` + the use-cases.
   - **Reporting**: periodic requires a **report-time inventory valuation** on the Balance Sheet (value on-hand qty × moving-avg cost) and a Trading-account gross-profit computation; these don't exist yet.
3. **Open question (not yet decided): does switching modes need to be prevented at all, and if so how much?** Mode is chosen at company creation / module init. The question to analyze is whether — and to what degree — we must *stop* a company from later flipping between periodic and perpetual, given the different COA shape, different postings, and historical-report integrity. Options range from fully irreversible, to allowed-only-before-first-transaction, to allowed-with-migration. If prevention is warranted, what must the wizard, module initialization, and settings actually enforce? This is a requirement to evaluate, not a decision already made.

## What's NOT in question
The moving-average costing math itself is correct. This is about *which accounting model each mode implements* and the *irreversible setup/enforcement* around it — not a costing-engine bug.

## Key references
- `backend/src/domain/inventory/entities/InventorySettings.ts` — mode enums + legacy mapping
- `backend/src/application/purchases/use-cases/PurchaseInvoiceUseCases.ts` — purchase posting + the gross/net discount drift
- `docs/audit/inventory-accounting-model-audit.md` — the (mostly unimplemented) target two-mode design
- `planning/tasks/223-inventory-revaluation-value-only-correction.md` — related backlog (manual cost-correction tool)
