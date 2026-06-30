# Kickoff prompt — SQL lane remediation agent

> Copy everything in the code block below into the new agent session.

```
You are picking up the SQL-lane remediation for the ERP03 project. Read this fully before doing anything.

## SCOPE LOCK — read first, do not violate
- Work ONLY in the SQL/PostgreSQL lane, in this worktree:
    Folder:  D:\DEV2026\ERP03
    Branch:  codex/sql-readiness-wip-20260628
- This is the SQL-readiness lane ONLY. Do NOT make Firebase/Firestore production fixes or deploys here.
- Do NOT touch the other worktree `D:\DEV2026\ERP03-unified` (branch codex/unified-firestore-deploy-20260628) — that is the Firebase production lane and is off-limits to you.
- If a task doesn't fit the SQL lane, STOP — do not switch lanes. The two lanes stay separate until a deliberate reconciliation through `main`.
- The Firestore code path is unaffected by this work; you are only fixing the Prisma/Postgres repository layer.

## Your single source of truth
Read and follow: planning/SQL_REMEDIATION_GUIDE.md
It contains the full diagnosis, the exact reproduction command, the categorized findings (96 errors / 41 files), the resolved fix direction for every item, the execution order, and the Definition of Done. Do not re-derive — start from that guide.

## The mission in one paragraph
The Prisma schema (backend/prisma/schema.prisma) and the repository layer
(backend/src/infrastructure/prisma/repositories/**) were written to different shapes of the same
entities and never reconciled. The mismatch is hidden by ~520 `as any` casts that switch off
compile-time type-checking, so the build is green but Prisma rejects queries at runtime
(PrismaClientValidationError dialogs in the UI). Your job is to reconcile them, remove the masking
casts, and prove correctness with the casts gone.

## Fix-direction decision (already made — do not re-ask the owner)
Code/domain is the source of truth. The domain entities in src/domain/** already encode the intended,
fuller shapes; the Prisma schema is simply behind. There is NO production data, so bring the schema up
to match the code via schema changes + migrations — do NOT strip features out of the code. Per-item
directives are in the guide's Category A table (each row marked ✅ RESOLVED).

## Execution order (from the guide)
1. Category D FIRST — the 15 core transactional repos use `const tx = (_transaction as any) || this.prisma`,
   which disables type-checking on ALL their writes. Re-type the transaction param to
   `Prisma.TransactionClient` (no `as any`) so checking turns back on, then re-run the sweep to reveal
   the true error total before fixing data objects.
2. Category A — the runtime throwers. Apply the resolved fixes (schema reshape + migration, or the small
   code fixes). Batch the schema changes into a coherent migration.
3. Categories B & C — type-only cleanups (Json column casts, JsonValue read typing). Safe to batch.
4. Remove the `as any` casts permanently in each file as you fix it.

## How to reproduce / verify (the authoritative check)
Run from backend/. This strips the masking casts, lets TypeScript + the generated Prisma client report
every mismatch, and is fully revertible (files are git-tracked):

    cd backend
    npx tsc --noEmit 2>&1 | grep -c "error TS"     # baseline with casts = misleadingly 0

    node -e 'const fs=require("fs"),path=require("path");function walk(d){let o=[];for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())o=o.concat(walk(p));else if(e.name.endsWith(".ts")&&!e.name.endsWith(".test.ts"))o.push(p);}return o;}for(const f of walk("src/infrastructure/prisma/repositories")){let s=fs.readFileSync(f,"utf8");s=s.replace(/\s+as\s+any\b(?!\s*[\[<])/g,"");fs.writeFileSync(f,s);}'

    npx tsc --noEmit 2>&1 | grep "error TS" | tee /tmp/sql_errors.txt | wc -l   # the real list

    git checkout -- src/infrastructure/prisma/repositories   # ALWAYS revert after inspecting

As of 2026-06-30 this surfaces 96 errors across 41 files. Re-run after each batch. Acceptance = 0 errors
WITH the casts removed (and the casts actually deleted, not re-added).

## Environment setup before any SQL run (in backend/)
- Git worktrees don't share node_modules — run `npm install` here if deps are missing.
- `node_modules/.bin/prisma generate` after any schema change.
- For schema changes use a proper migration (`prisma migrate dev`), not just `db push`, since the end
  state must be migratable. Local DB: port 5432, postgres:root, db erp_db (per .env / .env.local).
- SQL mode lives in .env.local (DB_TYPE=SQL); .env defaults to FIRESTORE and standalone scripts load
  .env — so FORCE DB_TYPE=SQL for SQL runs.
- The emulator/app serves compiled lib/ — run `npm run build` (tsc -> lib/) before manual round-trip
  QA; `tsc --noEmit` alone does not deploy your changes.

## Definition of Done
- The strip-sweep above reports 0 errors AND the `as any` casts are gone (not re-added).
- Schema changes captured as a migration; `prisma generate` run.
- Manual round-trip QA in SQL mode (DB_TYPE=SQL) for each fixed module, after `npm run build`.
- docs/architecture/<module>.md notes the schema/repo reconciliation.
- planning/JOURNAL.md + planning/ACTIVE.md updated; completion report in planning/done/.

## Do NOT
- Do NOT trust a green build with casts in place — it proves nothing here.
- Do NOT add `as any` back to make errors disappear.
- Do NOT touch the Firebase production lane / ERP03-unified worktree.
- Do NOT change product behavior beyond catching the schema up to the existing domain code; if you
  ever think a real product decision is required, stop and ask the owner.
```
