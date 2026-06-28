# Task 275d — Port missing non-AI Prisma repositories — COMPLETE (CTO-audited)

**Epic:** [275 — Supabase Launch](../tasks/275-supabase-launch-epic.md)
**Status:** ✅ Complete & audited 2026-06-28 (executor: Sonnet background agent; audit: Claude/Opus CTO)
**Branch:** `worktree-agent-a3e746de9fc53b3c7` (worktree `.claude/worktrees/agent-a3e746de9fc53b3c7`), commit `78bd4bbb`. NOT merged — awaits epic integration after 275c/275e.

## Technical summary
20 new Prisma repositories ported across 8 domains, each implementing its existing interface, with `DB_TYPE === 'SQL'` DI bindings replacing prior stubs. No Firestore code touched.

- **sales:** CommissionEntry, CreditOverride, CustomerGroup, Salesperson, PriceList, PromotionRule, Quote, RecurringInvoiceTemplate
- **purchases:** VendorGroup, PurchasePriceList
- **accounting:** PostingLog, PeriodLockOverride
- **system:** RecordChangeLog, IdempotencyKey
- **system-core:** PolicyConfig (malformed-data guard), SellingPolicy
- **pos:** PosLayout (ProductShortcutLayout/Node, ControlButtonLayout/Button)
- **print-layout:** PrintLayoutTemplate
- **designer:** FieldLibrary (content-hash de-dup, system-wins resolver)
- **communications:** CommunicationsSettings

**Schema:** +23 models in `backend/prisma/schema.prisma` (Company relations extended). **DI:** `bindRepositories.ts` SQL stubs → real bindings.

## Verification (reproduced by CTO in the worktree)
- `npx tsc --noEmit` → clean (proves full interface conformance).
- `npx prisma validate` → valid.
- `git diff --name-only main` → no `firestore/repositories` or `SystemCoreBoundaries` files changed.
- Gap re-derived → only `Ai*`, aggregator `*Repositories`, `FiscalYearRepository.spec`, and `VoucherRepositoryV2` (already covered by `PrismaVoucherRepository`) remain — all intentional.

## Notes / follow-ups
- ⚠️ Dependency bump: `@prisma/client` & `prisma` `^5.7.0 → ^5.22.0` (within major 5, benign). Keep on integration.
- Runtime mapping correctness (nullability, types, FK ordering) is NOT yet exercised against a real DB — that is **275e**'s job. Treat 275e as the behavioral safety net for these ports.

## End-user view
Internal infrastructure only — no user-facing change. This makes the remaining modules able to run on the new PostgreSQL database, a prerequisite for the Supabase launch.
