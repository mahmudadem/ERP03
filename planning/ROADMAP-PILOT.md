# ROADMAP — SQL Leads, Firestore Follows

**Author:** Claude (CTO) with product owner
**Date:** 2026-07-02 (v2 — supersedes the v1 draft of the same day)
**Status:** ACTIVE — governing long-term plan. Agents: read this before taking any task.
**North star:** several real retail businesses (pilots) running daily on a fast, cheap, stable platform.
First external tester: **POS user, Arabic speaker, wants access within ~1 week.**

---

## THE PLATFORM POLICY (owner decision, 2026-07-02 — do not re-litigate)

> **SQL leads. Firestore follows.**

1. **SQL/PostgreSQL is the primary platform for all forward development.** New strategic work —
   deeper accounting logic, reporting, integrity rules, production-grade architecture — is designed,
   built, and verified on SQL **first**.
2. **Firebase/Firestore remains an operational, supported runtime** — the current deployed system
   (`erp-03`) stays live for direct demos and early user trials at its **current feature level**.
   It is periodically maintained, not abandoned — but it is **no longer the leading lane** and no
   longer defines the architecture.
3. **The DB-agnostic architecture remains law.** All persistence through repository interfaces + DI.
   No new code may hardwire either database. (The recent request-path audit that removed hardwired
   Firestore/RTDB calls is the standard.)
4. **Long-term:** two production-capable runtimes are acceptable — SQL as the recommended production
   path, Firebase/Firestore as a supported alternative / legacy-compatible deployment.
5. Locked sub-decisions still in force: Supabase = Postgres only; **Firebase Auth stays** (works with
   both lanes); Storage/FCM stay Firebase; AI module off; backend host = Railway.

## THE PARITY RITUAL (how "Firestore follows" actually works)

Every SQL-first feature PR **must** include a **Firebase-impact note** classifying the change:

- **Class A — DB-agnostic:** works on both automatically (frontend, use-cases, shared logic). No action.
- **Class B — needs Firestore adaptation:** new repo methods, indexes, or seeder changes required
  for the Firebase lane. Estimated and recorded in `planning/PARITY-LEDGER.md`; work deferred.
- **Class C — SQL-only by nature:** relies on SQL capabilities (e.g. relational aggregation,
  DB-level constraints). Flagged in the ledger; owner decides per parity review whether the Firebase
  lane needs an equivalent or lives without it.

**Parity review cadence:** after each meaningful development cycle (~5 features or ~2 weeks,
whichever first), the CTO compiles the ledger into a short catch-up assessment — what Firebase
needs to reach parity, estimated cost — and the **owner decides: update Firestore now or defer.**
Nothing catches up silently; nothing falls behind silently.

Ledger: [`planning/PARITY-LEDGER.md`](PARITY-LEDGER.md).

---

## Verified facts this plan stands on (measured by CTO 2026-07-02, not taken from docs)

1. Production Firebase API is live and healthy: `/health` 200 in **290–696 ms warm**. Slowness =
   cold starts; the known one-line fix (`minInstances: 1`) is pre-annotated in `backend/src/index.ts`.
2. **POS frontend contains zero Firestore-direct code** — fully API-driven → POS-on-SQL needs QA,
   not porting. The 4 known Firestore-direct frontend files are forms-designer/voucher-wizard
   (admin tools, not the cashier's daily path).
3. **Arabic POS translation is complete** (566/566 keys, genuinely translated).
4. **Receipt printing end-to-end is UNVERIFIED** (print-layout machinery exists; an actual correct
   Arabic/RTL receipt has never been proven). QA target #1 — RTL receipts are a classic failure point.
5. **POS has no offline mode** (online-only). Acceptable for pilot #1 with honest expectation-setting;
   roadmap item before a pilot fleet.
6. **SQL has zero cloud infrastructure today** (no Railway/Docker/CI/cloud Postgres; only
   `frontend/vercel.json`). Local SQL genuinely proven (25/25 integration, 7/7 thrower probes).
7. `codex/sql-readiness-wip-20260628` is fully merged into `main` (verified via `git cherry`); this
   working copy now sits on `main`.

---

## Phase 0 — NOW (days 1–3): tester served + SQL cloud born (two parallel tracks)

**Track F (Firebase demo lane — serve the tester):**
| # | Task | Exit check |
|---|------|-----------|
| F1 | `minInstances: 1` on the `api` function + deploy (follow ACTIVE.md deploy how-to; needs `--force`; NEVER `DB_TYPE=SQL` in deploy env) | Cold-start latency measured before/after; first request < ~2 s |
| F2 | POS QA sweep on live app, fresh template-seeded tenant, **in Arabic** — shifts, sales, returns, Z-report, **receipt printing** | Full POS day clean, no error dialogs; owner's Telegram-export loop → numbered fix queue |
| F3 | Tester onboarding kit: seeded tenant + credentials + 1-page Arabic POS guide (`docs/user-guide/pos/`) + honest note that infrastructure upgrades are in progress | Tester logs in and sells within 10 minutes unaided |

**Track S (SQL lane — primary development):**
| # | Task | Exit check |
|---|------|-----------|
| S1 | Provision Supabase (Postgres), `prisma migrate deploy`, run system seeders against **cloud** DB | 25/25 integration + `smoke:companies` pass against Supabase, not localhost |
| S2 | Railway backend (standalone Express) + Vercel staging frontend + real Firebase Auth wiring | Internet-reachable `/health` 200; authenticated login round-trip works |

## Phase 1 — weeks 1–2: SQL staging hardened on POS first

- S3: Browser QA of the **full Arabic POS day on SQL staging** (same script as F2 — receipts included).
- S4: Port the 4 remaining Firestore-direct frontend files (voucherWizardService, 2× uniquenessValidator,
  documentDesignerService) — must work in BOTH modes; single PR; playbook in ACTIVE.md.
- S5: Fix the known auth robustness bug (stale `activeCompanyId` → 400 on all tenant calls) — bites both lanes.
- **Exit gate (CTO verifies personally):** a full POS day runs clean on SQL staging from a real browser in Arabic.

## Phase 2 — weeks 3–6: SQL becomes the recommended production path

- Per-module browser QA on SQL (Accounting → Sales → Purchases → Inventory), fix queues per module.
- Production hygiene before >1 pilot: error monitoring, automated DB backups, security/permissions audit.
- **First parity review** (per the ritual above) — owner decides Firestore catch-up scope.
- Measured comparison published: SQL vs Firebase latency + monthly cost (numbers, not vibes).

## Phase 3 — months 2–3: pilot fleet + handoff readiness

- Pilots onboard on SQL; tester migrated when SQL measurably wins.
- POS offline mode assessed/designed (retail internet reality).
- `docs/architecture/` completeness pass; engineer-onboarding guide; cost model per tenant.
- Firebase demo lane: periodically synced per parity reviews; positioned as demo/alternative runtime.

---

## Operating model

- **CTO (Claude):** plans, writes task briefs, verifies every "done" claim personally (measure/run,
  never trust reports), gates phases, runs parity reviews. Does not write feature code.
- **Agents:** one branch per task off `main`; small PRs; Definition of Done enforced (docs +
  `planning/done/NN-*.md` + JOURNAL + ACTIVE); **every PR carries its Firebase-impact class (A/B/C).**
- **Owner:** browser QA (the proven Telegram loop), decisions at parity reviews, tester/pilot relations.
- **Trust rule:** docs and agent claims are leads, not facts. Phase exits verified fresh.
- **Module-by-module architectural audit** rides along with Phase 1–2 SQL QA: restructure where rot
  is found, with evidence — no big-bang rewrite.

## Standing risks (eyes open)

1. First-ever cloud SQL deploy (S1/S2) will surface unknowns — that's why the tester is served from
   the Firebase demo lane meanwhile.
2. Arabic receipt printing unverified on ANY lane — QA target #1 in both F2 and S3.
3. POS is online-only — pilot #1 must be told; fleet needs an offline answer.
4. Dual-runtime promise = permanent parity cost — bounded by the ledger + owner-gated reviews.
