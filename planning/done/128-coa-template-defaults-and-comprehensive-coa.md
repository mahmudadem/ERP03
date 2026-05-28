# Completion Report 128 - COA template defaults + comprehensive template

**Date:** 2026-05-28  
**Branch:** `feat/phase-a-sales-master-data`  
**Related commits:** `30055d9f`, `4385873d`

## Scope

Close the COA-template setup gaps discovered during QA (missing generic AP/Revenue/COGS/GRNI defaults), and replace the placeholder comprehensive template with a real enterprise chart.

## Technical Developer View

### What changed

1. COA template defaults were expanded so setup has accounting-safe fallback posting accounts out of the box:
   - AP generic posting child
   - Revenue generic fallback
   - COGS generic posting child where applicable
   - GRNI account for perpetual-ready mappings
2. The "Comprehensive" template was rebuilt into a large enterprise-grade chart instead of aliasing Standard.
3. Setup wizard template recommendation labels/counts were improved for clearer selection.

### Files touched

- `backend/src/application/accounting/templates/COATemplates.ts`
- `backend/src/application/accounting/templates/IndustryCOATemplates.ts`
- `backend/src/seeder/seedSystemMetadata.ts`
- `planning/ACTIVE.md`
- `planning/JOURNAL.md`
- `docs/architecture/accounting.md`
- `docs/user-guide/accounting/README.md`

### Accounting/controls impact

- Reduces risk of incorrect manual workarounds (ad-hoc account creation with inconsistent codes/types).
- Improves first-run posting readiness for Purchases/Sales integrations.
- Preserves auditability: defaults are deterministic template-seeded accounts, not runtime silent postings to unknown accounts.

## End-User View

When you initialize Accounting using ERP03 templates, core accounts that many workflows need are now already available by default. You should no longer need to manually create basic AP, Revenue, COGS, or GRNI fallback accounts just to finish setup and start posting transactions.

You can still customize your chart (for example add more detailed revenue/account groupings), but the starting point is now safer and more complete.

## Verification

- Commit-level verification from repository history:
  - `30055d9f` includes COA default-account additions across templates.
  - `4385873d` includes comprehensive template build and template-card improvements.
- Session verification:
  - branch is synced with remote (`0 0` divergence),
  - PR #2 head points to `4385873d`.

## Follow-ups

1. Add wizard/runtime validation warnings when required perpetual mappings are missing or unresolved.
2. Continue Phase F Purchases parity: PI Attachments -> Vendor Groups -> Purchase Price Lists -> RFQ.
