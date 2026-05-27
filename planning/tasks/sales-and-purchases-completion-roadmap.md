# Sales & Purchases — Completion Roadmap

**Created:** 2026-05-20
**Decisions locked:** 2026-05-20 (see "Decisions locked" section below)
**Status:** Plan approved. Sequenced for manual-QA-driven progress with no fixed deadline.
**Predecessor:** [alpha-readiness-remediation-plan.md](./alpha-readiness-remediation-plan.md) — closed all six P0 architectural gaps (tasks 102-107).

---

## Goal

Ship an alpha that a real trading-company customer can run as their primary ERP for sales-and-purchases-to-payment, without "feature coming soon" gaps in the everyday workflow. **No fixed ship date.** Phases are sized for one focused work cycle each, with a manual QA gate at the end of every phase so the accountant (you) can verify before moving on.

## Sequencing principle

**Sales features first**, in two waves: (1) everything you can test with seeded opening stock alone, (2) the residual that needs richer cost history. **Then Purchases parity + Purchases-specific features.** Reasoning:

- You already validated the architectural backbone is correct (P0 plan done).
- Sales-first lets the same accountant (you) own QA without needing to also become a "purchase tester" mid-stream.
- The Opening Stock Document use case already exists — it seeds inventory with qty + cost — so you can test 80% of Sales without Purchases.
- The remaining 20% (multi-currency FX on receipts, real cost-layer-aware returns) is gated by either Phase E.5 (extend Opening Stock with FX) or by accelerating Phase F (Purchases parity) ahead of Phase D if testing blocks happen.

## How to use this doc

Each phase has:
- **Scope** — what gets built
- **Why it matters** — accountant-facing rationale
- **Manual QA gate** — concrete scenarios you can run to verify
- **Blocked by** — what must be done first
- **Effort estimate** — rough order of magnitude

Don't treat the order inside a phase as rigid — within a phase the items can be reshuffled. Don't skip phases; they're sequenced so each one builds on what's testable.

---

## PHASE A — Sales master data & pricing engine

**Why this comes first:** None of the operational features below (credit holds, quotations, recurring invoices) work without proper price lists and customer settings. Without this phase, your sales tester would have to manually price every invoice.

| Item | Notes |
|---|---|
| **Price Lists** | Per-customer assignment; volume/quantity tiers; per-currency lists; date validity. Pattern: Odoo Pricelists. |
| **Customer Groups / Segmentation** | Tag customers (VIP, retail, wholesale) for pricing and credit policy assignment. |
| **Customer credit settings** | Credit limit (numeric), credit-hold policy (warn/block), default payment terms, default price list. Already partially on Party entity — fill out + validate. |
| **Salesperson master + commissions** | **Confirmed in-scope.** New `Salesperson` entity (name, email, default commission %). Tracked per SO/SI. Commission accrual on invoice post (configurable: on-invoice or on-payment). Commission ledger per salesperson, payable on demand. |
| **Tax codes refinement** | Per-customer tax exemption flag; verify tax-inclusive vs tax-exclusive pricing toggle round-trips correctly through discounts. |

**Manual QA gate:**
1. Create three price lists (Retail, Wholesale, VIP) with different unit prices for the same item
2. Assign each to a customer group; verify a Sales Invoice picks the right price automatically
3. Verify volume tier kicks in (e.g., 100+ units → 5% off)
4. Verify tax-inclusive toggle math: price 110 inc 10% → unit 100, tax 10
5. Verify credit limit display on customer card
6. Create salesperson "Ali" with 3% commission; post SI of 1000 → verify commission ledger shows 30 accrued under Ali

**Blocked by:** nothing (after P0 plan complete)
**Effort:** Medium (4–5 days — slight bump for commissions ledger)

---

## PHASE B — Sales operational features

**Why:** This is what a salesperson actually does day-to-day before the accountant ever sees the invoice.

| Item | Notes |
|---|---|
| **Quotations / Sales Quotes** | New entity Quote → SO conversion (one-click). Quote revisions (v1, v2, v3). Quote → SI direct for SIMPLE mode. |
| **Credit limit enforcement at SO confirm** | Use the customer credit settings from Phase A. Two modes: warn (allow with override+reason) or block. Override creates an audit row. |
| **Promotions / Volume discounts** | Buy-X-get-Y rules, automatic stacking with manual-discount precedence rule. |
| **Backorder / partial fulfillment UX** | Backend supports it; frontend needs the workflow (partial delivery, backorder remaining, on-hold). |
| **Delivery scheduling** | Promised date on SO/DN; aged backlog report. |

**Manual QA gate:**
1. Create a Quote, convert to SO, then convert SO to SI; verify the chain preserves prices
2. Set customer credit limit to 1000; try to confirm SO worth 1500 — verify block + override flow
3. Configure promo "Buy 5 get 1 free"; create SO with qty 5 — verify free line added
4. Create SO qty 10, deliver 4, deliver 3, deliver 3 → verify the chain across three DNs

**Blocked by:** Phase A (price lists for quote pricing, credit limit field for the credit check)
**Effort:** Medium-High (5–6 days)

---

## PHASE C — Sales finance & reporting

**Why:** This is what makes the system credible to an accountant. The four reports here are the absolute non-negotiables for SMB ERPs.

| Item | Notes |
|---|---|
| **AR Aging report (backend)** | Standard buckets (Current / 1-30 / 31-60 / 61-90 / 90+). Configurable bucket size. Drill-down to invoice. |
| **Customer Statement (PDF emailable)** | Open invoices, last N transactions, running balance. Schedulable for month-end. |
| **Customer Ledger** | Full transaction history per customer (every invoice, every payment, every credit note, every adjustment). |
| **Sales reports** | By customer / by item / by salesperson — period over period, with drill-down. |
| **Backend P&L** | Move off frontend calculation. Single source of truth. |
| **Inventory Valuation as-of-date** | Cross-cutting but needed here: shows on-hand × cost as of any historical date. |

**Manual QA gate:**
1. Run AR Aging at month-end; verify total matches AR GL balance
2. Generate a customer statement for the biggest debtor; tie the running balance to the ledger
3. Pull Sales by Item for the top 5 items; verify the totals match invoice line items
4. Compare backend P&L to a manual computation from Trial Balance — must match to the penny
5. Run Inventory Valuation at start-of-month vs end-of-month; the difference must equal (Purchases + Adjustments − COGS) per the same period

**Blocked by:** Phase A + B (need price-list-driven invoices and credit-controlled customers to have meaningful test data)
**Effort:** High (7–9 days — reports are slow to get right; lots of edge cases)

---

## PHASE D — Sales auditability & control

**Why:** Closes the "can you explain why?" gap that started this whole audit. Also adds the controls real accountants demand (period lock, audit log).

| Item | Notes |
|---|---|
| **GL Impact preview drawer** | On every SI/DN/SR detail page: "Show me the journal this WILL post" before posting, and "Show me what posted" after. Reads from the PostingLog endpoint built in PR2. |
| **Period lock date** | Two-tier (soft for users, hard for admins). Override-with-reason for audit. |
| **Audit log per record** | Every edit to SI/SO/SR (even just a description change) creates an audit row with before/after + user + timestamp. |
| **Recurring invoices (templated + scheduled)** | **Both styles confirmed in-scope.** (a) Templated: "clone this invoice" one-click for ad-hoc reuse. (b) Scheduled: cadence (monthly/weekly/yearly), end-date or count, price/tax change handling on next generation, pause/resume, missed-run catchup. Background scheduler (Cloud Functions cron or in-process job) auto-generates on date. |
| **Sales return enhancements** | Refund vs credit note (customer choice). Restocking fees. Return reasons (defective, wrong item, customer changed mind). |
| **Document attachments** | PDF/image attached to SI for vendor records, customer PO numbers, signed delivery proofs. |
| **Multiple invoice templates** | Per-customer or per-form layouts. Logo, footer, terms. |
| **Outbound messaging integration** | Send invoice from inside the app (WhatsApp first via Meta Cloud API; email as follow-up channel). |

**Manual QA gate:**
1. Open any posted SI; click "GL Impact" → see the journal lines + accounts + fallback levels
2. Set period lock to 2026-05-31; try to post an invoice dated 2026-05-15 → blocked. Override with reason → posts; audit row created.
3. Edit a draft SI's description; verify the audit log shows the change
4. Set up a recurring invoice for a customer (monthly); manually trigger generation; verify next-month invoice created
5. Process a return with "credit note" choice; verify customer balance reduced, no cash refund posted
6. Email an invoice; verify deliverability + bounce handling

**Blocked by:** Phase C (period lock interacts with reports; audit log feeds aging trail)
**Effort:** High (8–10 days — UI heavy)

---

## PHASE E — Sales cross-cutting cleanup (closes P0 follow-ups)

**Why:** The six P0 PRs landed the architecture but left specific items "wired only on SI, not yet on DN/SR." Phase E finishes those + adds the integration tests that prove the whole system reconciles.

| Item | Notes |
|---|---|
| **E.1 PostingLog on DN + SR** | Mirror the SI pattern in PostDeliveryNoteUseCase and PostSalesReturnUseCase. Every posted sales document writes a PostingLog. |
| **E.2 FX on RecordSalesInvoicePaymentUseCase** | The post-invoice payment-recording flow needs the same FX wiring CASH_FULL/MULTI got in PR5. |
| **E.3 Frontend: Idempotency-Key** | Generate UUID per action, send as header. Idempotency middleware is in warn-only mode until the frontend does this. |
| **E.4 Frontend: FX fields on payment dialog** | Multi-currency payments need `exchangeRate` + `amountDoc` fields when invoice currency ≠ base. |
| **E.5 Extend Opening Stock with FX context** | Let the OpeningStockDocument accept a cost-currency + rate so you can test multi-currency FX flows without Purchases. |
| **E.6 Round-trip integration tests** | 5 scenarios from the audit: SO→DN→SI→Receipt; Buy 10/Sell 5/Customer return 2; SIMPLE direct sale; multi-currency cycle; mode-switch with in-flight DRAFTs. CI gate. |
| **E.7 GL-to-subledger reconciliation jobs** | Nightly job: assert AR GL balance == Σ outstanding SI; Inventory GL == Σ(qty × avgCost). Surface mismatches in an admin report. |
| **E.8 Deferred-cost settlement use case** | Closes the SKIPPED_UNSETTLED_COST loop opened in PR3. When a later receipt establishes cost, post an adjustment voucher to settle the earlier sale's COGS. |
| **E.9 Firestore rules suite** | Install `@firebase/rules-unit-testing`, run the scaffolded suite, fix any rule that fails, deploy to staging. |

**Manual QA gate:**
1. Post a DN; query `/posting-logs?sourceId=<dn-id>` → see the record
2. Record a payment on a multi-currency SI via the payment dialog → 3-line voucher with FX line
3. Double-click "Post" → only one voucher created (idempotency replays the cached response)
4. Run the 5 round-trip tests in CI → all green
5. Open the reconciliation admin page → zero mismatches across all four ledgers
6. Sell an item before receiving any (use SIMPLE direct mode) → posts with `SKIPPED_UNSETTLED_COST`. Then later record a receipt → run the settlement use case → COGS posted retroactively, ledger balanced.

**Blocked by:** Phase D (uses period-lock + audit-log infra). Some items (E.3 / E.4 frontend) can happen in parallel.
**Effort:** Medium-High (6–8 days)

---

## ⏸ SALES COMPLETE — manual QA cycle

After Phase E, **stop adding features and run a full manual QA pass.** Suggested cycle:

1. Reset to a clean tenant
2. Initialize Accounting (auto-bootstraps now) + Sales
3. Seed: 5 customers with different credit + price-list combos, 20 inventory items with opening stock, 5 service items, 1 multi-currency setup (EUR, USD base)
4. Walk every Phase A–D feature end-to-end against the QA gates listed
5. Verify every report ties back to the ledger
6. Document every bug; fix; re-test
7. **Acceptance criterion: every gap from your audit answers "implemented and verified," no "coming soon" labels in the Sales UI**

Expected duration of this cycle: **1–2 weeks** of QA + bug-fix loops. Do NOT skip this.

---

## PHASE F — Purchases parity (mirror Sales)

**Why now:** Sales is QA'd and trusted. The patterns are well-established. Purchases gets the benefit cheaply via mirror-work.

| Item | Source pattern |
|---|---|
| **PostingLog on PI/GRN/PR** | Mirror Sales PR2 wiring (3 use cases) |
| **Strict posting on PI** | Mirror Sales PR3 — convert silent tax/inventory skips to AccountMappingError |
| **FX on Purchases PaymentSync** | Mirror Sales PR5 — vendor payments with rate change post FX line |
| **PI line discounts** | Mirror Sales discount engine onto PurchaseInvoiceLine |
| **Update purchases.md docs** | Fix the stale GRNI sentence + mirror docs structure |
| **Purchases master data** | Vendor groups, vendor payment terms, default purchase price list (rare but exists in some industries) |

**Manual QA gate:**
- Mirror every QA gate from Phases A–E using Purchases documents instead of Sales (PO ↔ SO, GRN ↔ DN, PI ↔ SI, vendor payment ↔ customer receipt, purchase return ↔ sales return)

**Blocked by:** Sales complete (so the patterns are validated)
**Effort:** Medium (4–5 days — much of it is genuinely copy-paste)

---

## PHASE G — Purchases-specific features (pruned to universal scope)

**Why:** These have no Sales equivalent. Must be designed fresh.

**Decisions applied (locked 2026-05-20):**
- Launch market = **deferred** → withholding tax + landed cost moved to V2 (region/business-model-specific)
- E-invoice clearance = **deferred** → no Fatoora/IRN/SDI in alpha
- This leaves only the **universal control feature** (three-way match) plus vendor master cleanup in scope.

| Item | Status | Notes |
|---|---|---|
| **Three-way matching report** | ✅ In Phase G | PO ↔ GRN ↔ PI variance — qty + price mismatch. Universal control feature; no regional dependency. |
| **Vendor master cleanup** | ✅ In Phase G | Vendor groups, vendor payment terms, default purchase price list. Mirrors customer master polish from Phase A. |
| ~~Landed cost allocation~~ | ⏸ Deferred V2 | Re-add when an importer customer is committed. Allocate freight/duty/insurance to inventory cost by qty/value/weight/volume. 4–5 days when needed. |
| ~~Withholding tax~~ | ⏸ Deferred V2 | Re-add when KSA/UAE/India launch is committed. Region-blocking for those markets only. |
| ~~E-invoice clearance (Fatoora/IRN/SDI)~~ | ⏸ Deferred V2 | Re-add per-region when launch market chosen. 2–3 weeks per region. |
| ~~Vendor price lists~~ | ⏸ Deferred V2 | Less critical for SMB; manual price entry is fine. |
| ~~Requisitions (PR)~~ | ⏸ Deferred V2 | Internal user requests → manager approves → buyer creates PO. Skip for owner-operated SMB. |
| ~~RFQ (Request for Quote)~~ | ⏸ Deferred V2 | Compare 3 vendor quotes side-by-side. V2. |
| ~~Vendor portal~~ | ⏸ Deferred V2 | Vendor self-service login. V2. |
| ~~Vendor credit limits / blanket POs~~ | ⏸ Deferred V2 | Defer. |
| ~~Subcontracting~~ | ⏸ Deferred V2 | Defer unless launch market is manufacturers. |

**Manual QA gate per in-scope item:**
1. **Three-way match:** Create PO qty 100 @ 10, GRN qty 95 @ 10, PI qty 95 @ 11 → report flags qty diff (5) and price diff (95 × 1 = 95). Drill-down to lines.
2. **Vendor master:** Tag vendors into groups (Domestic / International), set per-vendor payment terms; create PI for each → verify terms inherited correctly.

**Blocked by:** Phase F
**Effort:** Small (3–4 days — significantly reduced after pruning)

---

## ⏸ PURCHASES COMPLETE — manual QA cycle

Same shape as Sales QA cycle. Specifically test:
- Full PO → GRN → PI → vendor payment cycle in single-currency
- Same cycle in multi-currency (EUR vendor, USD base, rate changes between GRN and PI)
- Landed cost adjustment after sale-through (50% sold before freight bill arrives)
- Vendor return → AP reduction → either cash refund or credit applied to next bill

Expected duration: **1 week** of QA + bug-fix.

---

## PHASE H — Final pre-alpha hardening

| Item | Notes |
|---|---|
| **Performance smoke** | 1000 invoices, 10000 stock movements per company — verify no degradation. Index review. |
| **Security rules deployed to staging** | Run the full emulator suite against the staging Firebase project, then promote to production rules. |
| **Cross-module reconciliation in production** | Real-data check across all four ledgers (Sales + Purchases + Inventory + Accounting) against the reconciliation job from E.7. |
| **Backup + restore drill** | Verify a tenant can be exported, deleted, restored from backup. |
| **First-customer onboarding script** | Documented wizard / checklist for the first real customer. Saves them from your dev knowledge gap. |
| **Documentation pass** | All `docs/architecture/` accurate; user-facing docs in `docs/user-guide/` per CLAUDE.md DoD. |

**Acceptance criterion:** All P0 + Phase A–G QA gates green; no critical TODOs in any module; reconciliation reports show zero drift on a real seeded tenant.

---

## Realistic total effort

Rough estimate (single-developer-with-AI-assistance pace, including QA cycles):

| Block | Duration |
|---|---|
| Phase A | 4–5 days (+1 day for commissions) |
| Phase B | 5–6 days |
| Phase C | 7–9 days |
| Phase D | 8–10 days (recurring = scheduled + templated) |
| Phase E | 6–8 days |
| Sales QA cycle | 1–2 weeks |
| Phase F | 4–5 days |
| Phase G (pruned: 3-way match + vendor master only) | 3–4 days |
| Purchases QA cycle | 1 week |
| Phase H | 1 week |
| **Total** | **~2.5 months** (was ~3 months — Phase G pruning saved ~2 weeks) |

Without a deadline, this is comfortable. The point isn't speed — it's that **every shipped feature is genuinely complete and you've verified it as the accountant**.

---

## Decisions locked (2026-05-20)

| # | Question | Answer | Impact on plan |
|---|---|---|---|
| 1 | Launch market for Purchases? | **Defer** | Withholding tax + landed cost moved to V2 (re-add when launch market chosen) |
| 2 | Salesperson tracking + commissions? | **Yes — needed** | Phase A includes Salesperson entity + commission ledger |
| 3 | Recurring invoices — what style? | **Both: templated + scheduled** | Phase D includes one-click clone + background scheduler |
| 4 | Customer portal in alpha? | **Defer to V2** | No buyer-facing login surface in alpha |
| 5 | E-invoice clearance (Fatoora/IRN/SDI)? | **Defer** (matches #1) | No regulatory clearance integrations in alpha |

These can be revisited any time — if you commit to a launch market (e.g., KSA), landed cost + withholding + Fatoora slot back into Phase G with re-estimated effort.

---

## How this plan stays honest

After every phase: **manual QA cycle, document gaps in `planning/done/NN-<phase>.md`, JOURNAL entry, and ACTIVE.md update**. No phase is "done" until the gates pass. No "almost complete" status.

If a phase exposes a deeper rebuild than estimated, we add a phase rather than half-ship. You set the bar; the plan adapts.
