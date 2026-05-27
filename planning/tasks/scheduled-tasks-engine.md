# Scheduled Tasks Engine — Cross-Module Recurring Jobs

**Status:** Proposed. Discovered during D.4 Recurring Invoices QA (2026-05-24).
**Priority:** High — blocks the value of every "recurring X" feature across the system.
**Owner:** TBD (Phase F-tier or dedicated infra phase before Phase F).

---

## Problem

D.4 Recurring Invoices shipped templates + a manual "Generate Due" button but no scheduler. So "recurring" is a misnomer — nothing fires automatically.

Solving this with a per-feature cron (a `recurringInvoiceCron` Firebase Function) would be the wrong shape, because every module is going to need the same thing:

| Module | Recurring use case |
|---|---|
| Sales | Recurring invoices (existing) |
| Purchase | Recurring purchase orders (subscriptions, retainers) |
| Accounting | Recurring vouchers (rent, lease, utility accruals, prepaid amortization) |
| HR | Monthly payroll runs |
| Inventory | Scheduled stock-count reminders, low-stock alerts |
| AI / Notifications | Daily digests, weekly summaries |
| System | Nightly cleanup, fiscal close reminders, scheduled report deliveries, audit-log archival |

Building seven separate cron jobs would produce divergent error handling, divergent retry logic, divergent observability, and no central place for the user to see "what's scheduled to happen in my company."

## Goal

A **single shared engine** any module can register schedulable jobs against, with:

- One Firebase `onSchedule` function that drives the whole system
- A central registry of scheduled job types per module
- Per-company schedule configuration (so different tenants can have different cadences)
- Status, history, retry, and a user-visible "Scheduled Tasks" dashboard
- Reusable for both system jobs (daily cleanup) and tenant jobs (recurring invoice generation)

## Architecture sketch

```
backend/src/scheduling/
├── domain/
│   ├── ScheduledJob.ts            // entity: id, jobType, companyId?, cron, nextRun, lastRun, status, lastError
│   └── ScheduledJobRun.ts         // entity: jobId, startedAt, finishedAt, status, output, error
├── application/
│   ├── ScheduledJobRegistry.ts    // singleton: register(jobType, handler)
│   ├── ScheduledJobExecutor.ts    // runs a single job, writes ScheduledJobRun
│   └── DueJobsScanner.ts          // finds jobs due now, dispatches to executor
├── infrastructure/
│   └── firestore/repositories/    // ScheduledJobRepository + ScheduledJobRunRepository
└── functions/
    └── scheduledJobsTick.ts       // onSchedule('every 5 minutes') → DueJobsScanner.run()
```

Each module registers its job types at startup, just like they register modules today:

```ts
// backend/src/application/sales/SalesModule.ts
ScheduledJobRegistry.register('SALES_RECURRING_INVOICE_RUN', async (job, ctx) => {
  await new GenerateRecurringInvoicesUseCase(...).execute(job.companyId, 'SYSTEM', ctx.runDate);
});
```

The Firestore-backed `ScheduledJob` rows describe *when* and *for which company*. Module handlers describe *what to do*. The engine is the only thing that touches the cron.

## User-facing surface

A new **Settings → Scheduled Tasks** page (under System or its own top-level menu):

- List of all scheduled jobs for the company (across all modules)
- Status badges: Active, Paused, Failing
- Next run time, last run time, last result
- Per-job pause/resume/run-now (uses the shared ConfirmDialog)
- Drill into Run History per job
- Module-specific create/edit happens in that module's UI (e.g. the existing Recurring Invoices page), not here

This page is the single pane of glass for "what does the system do on its own in my tenant."

## Migration impact

- **D.4 Recurring Invoices** — replace the manual "Generate Due" button with a registered `SALES_RECURRING_INVOICE_RUN` job. Keep the button as "Run Now" for manual override. Remove the page notice.
- **Future modules** — register at module init, no per-feature cron.

## Open questions for the user

1. Granularity of the engine tick — every 5 minutes? Every 15? Hourly?
2. Should tenants be able to define their own custom cron expressions, or pick from a fixed list of presets (Hourly, Daily, Weekly, Monthly)?
3. Should failed runs auto-retry, or just surface for user attention?
4. Whether to use Firebase Functions `onSchedule` (simple, cheap, single region) or Cloud Tasks (more flexible, per-job scheduling, but more infra).

## Definition of Done

- [ ] `backend/src/scheduling/` engine skeleton with all 4 components above
- [ ] One Firebase scheduled function driving the tick
- [ ] D.4 migrated as the first consumer
- [ ] Settings → Scheduled Tasks UI page
- [ ] `docs/architecture/scheduling.md` explaining the engine
- [ ] `docs/user-guide/system/scheduled-tasks.md` for end users
- [ ] One operator-view QA script in `planning/done/NN-scheduled-tasks-engine.md`
- [ ] Page notice on Recurring Invoices removed
- [ ] Rule added to `AGENTS.md` under "Architecture Red Lines": "Do not write per-feature cron jobs. Use the Scheduled Tasks Engine."
