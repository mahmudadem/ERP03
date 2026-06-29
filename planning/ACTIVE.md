# 🎯 Current Focus

> Keep this file SHORT. It is "what's happening now + where I left off."
> Completed-task detail lives in `planning/done/NN-*.md` and session history in `planning/JOURNAL.md`.
> (Trimmed 2026-06-29 from a 1700-line backlog — all of that history is preserved in `done/` + `JOURNAL.md`.)

---

## ⚠️ Worktree map (read first)

Two worktrees, one repo. **Do not mix their roles.**

| Worktree | Branch | Role |
|---|---|---|
| `D:\DEV2026\ERP03` | `codex/sql-readiness-wip-20260628` | **SQL-readiness lane** — Supabase / PostgreSQL continuation. |
| `D:\DEV2026\ERP03-unified` | `codex/unified-firestore-deploy-20260628` | **Production lane** — Firebase/Firestore live fixes + deploys (this folder). |

- Production fix / retest / Firebase deploy → **`ERP03-unified`** (this folder).
- SQL readiness / Supabase / PostgreSQL → **`ERP03`**.
- Backups of both dirty states: `D:\DEV2026\ERP03-worktree-backups\20260629-160718`.
- Rollback tag for this lane: `backup/unified-before-heal`.

---

## ✅ Production — healed & LIVE (2026-06-29)

The verified 503/500 storm fix (`9e5d0ac1`) was split across lanes; it is now complete in this
production lane and **deployed live to `erp-03`** (functions + firestore indexes). Verified:
server boots and serves (no more `503 Server not ready`). Details in `JOURNAL.md`.

**Deploy how-to for this project** (no predeploy hook — build first):
1. `cd backend && npm run build` (compiles to `lib/`; deploy uses the compiled output).
2. `firebase deploy --only functions,firestore --project erp-03`.
3. Skip `storage` / `database` targets — not provisioned on `erp-03`.
4. Never put `DB_TYPE=SQL` in `backend/.env` or `.env.<project>` (bricks the deploy); SQL override lives only in gitignored `.env.local`.

---

## 🔄 Production QA fixes — Telegram export

- **278a ledger statement indexes:** committed as `7ef1917b`; production deployment remains
  pending until the full fix queue finishes.
- **278b Purchase item API route:** committed as `26fa87ac`; frontend production deployment
  remains pending until the full fix queue finishes.
- **278c Purchase invoice query index:** committed as `a3990984`; awaiting final deployment.
- **278d POS shift-close validation:** committed as `300eab98`; awaiting final deployment.
- **278e Default Arabic language:** committed as `4090ccee`; awaiting final deployment.
- **278f Account form translation:** complete; commits `e7a72724` and `798a92a4`.
- **278g Account tree RTL controls:** complete; commits `c3d3ec33` and `12754d34`.
- **278h Clear API error labels:** complete; commits `ccd97a81` and `75a4f6f0`.
- **278i POS report date/time sort:** complete; commits `e52683c0` and `cbdbd133`.
- **278j Opening Stock legacy movement warning:** complete; commits `64117d93` and `d56d5832`.
- **278k Sales dashboard / Purchase Settings translations:** complete; commit `bfd636e0`.
- **278l POS shift-close summary modal:** complete; commit `f4917b14`.
- **278m POS report date range / DatePicker i18n:** complete; commit `37a2feb0`.
- **278n Inventory Unsettled Costs report translation:** complete; commit `1ecda880`.
- **278o Inventory Valuation report translation:** complete; commit `5b663468`.
- **278p Inventory Stock Levels report translation:** validation passed; commit pending.
- **Next:** commit 278p, then continue remaining all-report translation audit.
- Work remains sequential: one verified fix and one commit at a time.

---

## ⏭️ Later: collapse to ONE canonical worktree

Hold the two-lane model until production is confirmed stable under ~1 day of real use, **then**:

1. Land this production work to `main` (route through `main`, never merge the two dirty branches directly).
2. Rebase the SQL-readiness branch on top of the updated `main`.
3. Delete this `ERP03-unified` worktree/branch → single folder `D:\DEV2026\ERP03` remains.

Firebase and SQL stay independent (same codebase, either DB stands alone) — reconciliation is folder
tidy-up only, not an architecture change.

Open PR for this lane: #50 (`codex/unified-firestore-deploy-20260628` → `main`).

---

## 🔶 SQL-readiness — Epic 275 (paused, in the other worktree)

Lives in `D:\DEV2026\ERP03`. Awaiting owner go; not merged to `main`. See that worktree's
`ACTIVE.md` + `planning/done/275*` for detail.
