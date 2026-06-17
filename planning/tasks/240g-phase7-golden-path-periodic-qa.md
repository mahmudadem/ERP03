# Phase 7 (Epic 240) — Golden-path re-run on a PERIODIC tenant + QA scripts

**Parent epic:** [240](./240-simple-periodic-mode-and-item-costing-epic.md) · **Depends on:** Phases 4, 5, 6 (and 3). Final gate.

## Objective
Prove the new PERIODIC mode end-to-end and confirm the reconciliation pain is gone by construction.

## Steps
1. Create a **fresh PERIODIC** "Simple Trading Co" tenant via the company wizard (mode = Simple → periodic COA seeded; DN/SO hidden by default). Use SYP / Asia-Damascus / DD-MM-YYYY defaults to match prior QA tenants.
2. Run the golden paths in order on this tenant: **GP01** (accounting), **GP02** (inventory), **GP03** (sales), **GP04** (purchases), **GP05** (cross-module books). Scripts: `planning/qa/golden-paths/`.
3. For PERIODIC specifically verify:
   - Purchase Invoice posts Dr Purchases / Cr AP (no inventory/COGS lines); Sales Invoice posts Dr AR / Cr Sales (no COGS).
   - Stock **quantities** stay correct (with and without DN/GRN — toggle them on for one pass).
   - **Balance Sheet** opens any time and shows a current inventory value (report-time valuation); **Trading account** gross profit = Sales − (Opening + Net Purchases − Closing).
   - **GP05 step 4** reconciles trivially (periodic has no per-transaction inventory GL to drift) — i.e. it should be non-applicable / pass by construction.
4. Run one comparison pass on a PERPETUAL tenant to confirm Phase 2's backlog-223 fix holds (GP05 step-4 drift 0).

## Acceptance
- GP01–GP05 green on the PERIODIC tenant; GP05 step-4 no longer a blocker.
- Any new findings logged to `planning/qa/findings.md`.

## Definition of Done
- `planning/done/240g-phase7-golden-path-periodic-qa.md` with the full per-step QA log (per memory: QA scripts live in the task's done report).
- `planning/qa/findings.md` updated; JOURNAL + ACTIVE updated; if all green, update epic 240 §9 status and the "golden-paths-green" gate in ACTIVE.
