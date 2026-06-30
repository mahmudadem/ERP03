# Epic 275 — SQL-mode local QA runbook

**Goal:** click-test the app running on local **PostgreSQL** (not Firestore) before deploying to Supabase.
**Status:** Epic 275 merged to `main` (`b85eaf37`). App is SQL-ready behind `DB_TYPE=SQL`.

## How SQL mode is switched on
- The Functions emulator loads `backend/.env`, then `backend/.env.erp-03` (project override).
- `backend/.env.erp-03` (gitignored, already created) sets:
  - `DB_TYPE=SQL`
  - `DATABASE_URL=postgresql://postgres@localhost:5433/erp_db?schema=public`
- To go back to Firestore for a session: rename/remove `backend/.env.erp-03` (or set `DB_TYPE=FIRESTORE` in it).

## Prerequisites (one-time per machine)
1. Local PostgreSQL 16 running on port **5433**, db **erp_db** (already in use by the integration harness).
2. Schema + seed loaded:
   ```bash
   cd backend
   export DATABASE_URL="postgresql://postgres@localhost:5433/erp_db?schema=public"
   node_modules/.bin/prisma db push --skip-generate
   node_modules/.bin/prisma generate
   npx ts-node --transpile-only prisma/seeds/runSqlSeed.ts   # system data: currencies, COA templates, modules, permissions, roles, voucher types
   ```
   Seeded baseline = 32 currencies, 8 COA templates, 54 permissions (0 AI), 1 SYSTEM sentinel company.

## Start the app (SQL mode)
Backend (Firebase emulator suite, picks up the SQL override):
```bash
cd backend && npm run build           # compile TS -> lib/ (emulator serves compiled lib/)
cd .. && firebase emulators:start --import=../emulator-data   # auth + functions + firestore + storage
```
Frontend (separate terminal):
```bash
cd frontend && npm run dev            # or: npm run dev:remote  (host 0.0.0.0, for phone/Tailscale access)
```
Open the Vite URL it prints (e.g. http://localhost:5173). Log in with an existing emulator Auth user
(from `emulator-data/auth_export`).

> Note: existing test tenants live in the Firestore export, NOT in Postgres. In SQL mode the database
> starts with only system data + the SYSTEM sentinel, so the **first thing to do is create a company
> via the onboarding wizard** — that exercises the COA-template + seed work just hardened.

## QA checklist — exercise the money paths we proved on Postgres
Tick each in the running app. (These mirror the 25 automated integration checks, but by hand in the UI.)

- [ ] **Onboarding:** create a new company via the wizard. Confirm the Chart of Accounts template
      dropdown lists options and the company is created (lands in Postgres).
- [ ] **Core/Settings:** open company settings; enable/disable a module; confirm it persists on reload.
- [ ] **RBAC:** create/assign a role to a user; confirm a permission-gated screen respects it.
      Confirm there is **no AI Assistant** module/permission anywhere (AI is off for v1).
- [ ] **Accounting:** post a manual Journal Entry (balanced). Confirm it appears in the ledger and the
      Trial Balance ties (total debit = total credit).
- [ ] **Inventory:** create an item + warehouse; receive stock (purchase receipt). Confirm stock level
      and average cost; receive again and confirm cost blends.
- [ ] **Purchases:** create a Purchase Invoice (with a line). Confirm it saves and reads back with the
      correct total, and posts to the ledger.
- [ ] **Sales:** create a Sales Invoice (with a line). Confirm it saves, reads back with the correct
      total, gets an invoice/receipt number, and posts to the ledger.
- [ ] **POS:** open a shift, ring a sale, close the shift. Confirm the first receipt gets a number
      (this was bug #8) and the shift closes reconciled.
- [ ] **Reports:** open a couple of reports (Trial Balance, a sales/inventory report) and confirm data.

## If something breaks
- Capture the screen + the emulator/functions log line. Most likely class of issue = a SQL-mode
  schema-strictness bug like the 8 already fixed (a repo write shape the harness didn't cover).
- Backend code changes require `npm run build` (tsc -> lib/) before the emulator picks them up.

## After local QA passes
Proceed to **Task 275f**: provision Supabase, deploy backend (Railway) + frontend, run the same
checklist against the cloud database, then go live.
