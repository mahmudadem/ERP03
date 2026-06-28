# Supabase Deployment Plan & Readiness Report

**Author:** Claude (CTO)
**Date:** 2026-06-28
**Status:** Assessment + plan — no code changed yet
**Branch at time of writing:** `codex/i18n-pos-slice`

---

## TL;DR — How far are we?

**We are much closer than a "migrate to Supabase" task usually implies.** The repository pattern paid off: a full dual-database backend already exists. Supabase is just managed PostgreSQL + Auth, and the Postgres half of the app is ~75% built.

| Layer | State | Supabase-ready? |
|-------|-------|-----------------|
| DB abstraction (repository pattern + `DB_TYPE=SQL` toggle) | ✅ Done | Yes |
| Prisma schema | ✅ 105 models | Yes |
| Prisma repositories | 🟡 96 of ~123 (≈78%) | Mostly |
| DI SQL toggles (`bindRepositories.ts`) | 🟡 111 branches wired | Mostly |
| SQL run against a **real** Postgres DB | ❌ **Never** | **No — this is the real risk** |
| SQL seeders | ❌ Seeders write to Firestore only | No |
| Auth (Firebase Auth, front + back) | ⚠️ Decision needed | N/A |
| Realtime / push (FCM) | ⚠️ Decision needed | N/A |
| Hosting / CI / deploy infra | ❌ Not set up | No |

**Honest bottom line:** the code is far along, but **nothing has ever executed against a real PostgreSQL database.** The gap to "deployed and working" is *integration hardening + the missing ~27 repos + auth decision + hosting*, not a rewrite. Realistic estimate to a usable staging deploy: **2–4 focused weeks**, dominated by SQL smoke-testing, not coding.

---

## What "Supabase" gives us (and what it doesn't)

Supabase = **managed Postgres** + **Auth** + **Storage** + **Realtime** + Edge Functions. We can adopt it in slices:

- **Postgres (the database):** drop-in. Set `DATABASE_URL` to the Supabase connection string, `DB_TYPE=SQL`, `prisma db push`. This is the main prize and it's mostly built.
- **Auth:** optional. We can keep Firebase Auth and *only* use Supabase for the DB, or migrate to Supabase Auth (removes the last Firebase dependency). **This is a business decision — see Open Decisions.**
- **Storage (attachments):** today attachments use Firebase. Can stay on Firebase or move to Supabase Storage later.
- **Realtime/push notifications:** currently Firebase Cloud Messaging. Can stay Firebase or be reworked.

We do **not** have to do all of these to deploy. The minimum viable Supabase deploy is **Postgres only, keep Firebase Auth**.

---

## The Real Gap (work that actually remains)

### 1. Missing Prisma repositories (~27 files) — *est. 4–7 days*
Repos that exist in Firestore but have **no Prisma equivalent yet** (features added after the dual-DB layer was built in April). Grouped:

- **AI Assistant module (~12):** AiProposal, AiProvider, AiModelProfile, AiToolCatalog, AiToolEnablement, AiModelToolPolicy, AiPlatformApiKey, AiPlatformRuntimeProfile, AiProposalPolicy, AiConversationMeta, AiCreditLedger, AiModelCertification.
  *(PrismaAiChat/AiSettings/AiUsageLog already exist.)*
  → **Can be deferred** if AI module is disabled at launch.
- **Sales/Purchases master data (~10):** CommissionEntry, CreditOverride, CustomerGroup, VendorGroup, PriceList, PurchasePriceList, PromotionRule, Quote, RecurringInvoiceTemplate, Salesperson.
- **System-core / platform (~5):** PolicyConfig, SellingPolicy, PostingLog, RecordChangeLog, IdempotencyKey, PeriodLockOverride.
- **Print / designer:** PrintLayoutTemplate, PosLayout, FieldLibrary, CommunicationsSettings.

Each is a mechanical port using the matching Firestore repo + interface as the spec.

### 2. SQL seeders — *est. 2–3 days*
All current seeders write to Firestore. A fresh Postgres DB needs system data seeded directly via Prisma: system voucher types, module/permission/bundle/plan registries, business domains, currencies, role templates. Without this, company creation and posting fail on an empty DB.

### 3. `SettingsResolverSQL` is a stub — *est. 1 day*
Returns `null` for everything. Any code path that resolves settings through it will throw under SQL. Needs real implementations or refactor.

### 4. **SQL integration/smoke testing against real Postgres — *est. 5–8 days (the big one)***
This is the highest-risk item. All 324 tests mock Firestore. The Prisma repos have **zero** test coverage and have **never run against a live DB**. Postgres enforces NOT NULL / FK / unique / type constraints that Firestore silently ignored — so the highest-value flows (voucher posting, stock movements, invoice posting, year-end close, FX) are the most likely to break first. Must walk every smoke test in `SQL-MIGRATION-SWITCH-GUIDE.md` §3 against Supabase and fix what breaks.

### 5. Auth decision + wiring — *est. 1–5 days depending on choice*
- **Keep Firebase Auth:** ~1 day (just provision Firebase project for prod, keep token verifier). Lowest risk.
- **Move to Supabase Auth:** ~3–5 days — swap `FirebaseAuthProvider` (frontend, already behind `IAuthProvider`) and `FirebaseTokenVerifier` (backend), migrate users, rework custom claims/roles.

### 6. Hosting / deploy infrastructure — *est. 2–4 days*
- **Supabase project** (Postgres) provisioned, schema pushed, seeded.
- **Backend** (Express/Node) needs a host — Railway, Render, Fly.io, or a VM. Currently scripted as Firebase Functions; deploying as a long-running Node service is simpler for a Postgres app.
- **Frontend** (Vite static build) → Vercel / Netlify / Cloudflare Pages / Supabase hosting.
- Environment config, secrets, CORS, CI build pipeline.

---

## Recommended Phased Plan

### Phase 0 — Decisions (½ day, needs owner) ← **blocking**
Resolve the Open Decisions below before any code.

### Phase 1 — Make SQL actually run locally (1 week)
1. Stand up a local Postgres (or a throwaway Supabase project).
2. `prisma generate` + `prisma db push`.
3. Write SQL seeders for system data.
4. Implement `SettingsResolverSQL`.
5. Flip `DB_TYPE=SQL`, run the backend, walk Smoke Tests 1–6 (company, accounts, vouchers, inventory, sales, purchases). Fix failures.
**Exit:** a clean tenant can be created and a sales + purchase invoice can post end-to-end on Postgres locally.

### Phase 2 — Close the repo gap (1 week, parallelizable)
1. Port the ~27 missing Prisma repos (defer AI module if disabling it).
2. Add at least one integration test per module against real Postgres.
3. Run the full module-by-module checklist from the switch guide.
**Exit:** every enabled module works in SQL mode; test suite green against Postgres.

### Phase 3 — Provision Supabase + deploy staging (3–5 days)
1. Create Supabase project; push schema; run seeders against it.
2. Deploy backend to chosen host; deploy frontend build.
3. Wire auth (per decision); configure secrets, CORS, env.
4. Full UI smoke test on staging.
**Exit:** a real user can log in and run a full document flow on the deployed staging URL.

### Phase 4 — Production hardening (ongoing)
Indexes/performance, backups, monitoring, CI/CD, rollback runbook, Firestore→Postgres data migration script *if* any real data needs to move (per memory: no production data yet, so likely **none needed**).

---

## Decisions — LOCKED (CTO call, owner is non-technical and delegated these on 2026-06-28)

The owner explicitly asked the CTO to make these technical calls. Decisions are final for v1 unless the owner reopens one.

1. **Auth → KEEP FIREBASE AUTH for v1.** Supabase is used for the **database only**. Rationale: login already works on Firebase; switching means rebuilding login + migrating users + re-testing permissions for zero user-visible benefit. Revisit only if removing Firebase entirely becomes a goal.
2. **AI Assistant module → OFF for v1.** Disable at launch; port its ~12 Prisma repos in a later phase. Rationale: it's the largest chunk of remaining work and not core to validating the ERP. Core modules shipping *working* outweighs AI shipping *half-tested*.
3. **Backend host → RAILWAY.** Simplest fit for a Node + Postgres app, cheap at our scale, connects cleanly to Supabase. (Render is the equivalent fallback.) CTO sets this up during Phase 3 — no owner action needed.
4. **Attachments & push notifications → KEEP ON FIREBASE for v1.** Storage and FCM stay as-is to shrink launch scope. Revisit post-launch.

**Net effect:** Supabase = Postgres only. Firebase retained for Auth + Storage + push. AI off. This cuts remaining repo work from ~27 to ~15 and removes the riskiest pieces from the launch path.

---

## Deployment Modes & Offline / Local SQL (planned — not v1, but the SQL migration is its enabler)

The product is designed for **three deployment modes**, all running the **same PostgreSQL + same backend code** (see `docs/architecture/deployment-modes.md`, Task 222):

| Mode | Where the DB lives | Internet needed | Status |
|------|--------------------|-----------------|--------|
| **Cloud** | Supabase (hosted Postgres) | Yes | ← this plan / v1 |
| **Office Server / LAN** | A customer office PC, local Postgres; approved LAN clients connect | No | Planned (Task 222) |
| **Local on This PC** | One PC, bundled local Postgres, private to that machine | No | Planned (Task 222) |

**Critical point:** offline is only *possible* because of this migration. Firestore is cloud-only and can never run on a customer PC. PostgreSQL can. So the Firestore→Postgres work is the **prerequisite/foundation** for offline, not a competing direction. ~95% of code is shared across all three modes.

**The auth caveat (consequence of the "keep Firebase Auth" decision):** Firebase Auth is **cloud-only — it needs internet**. It is correct for the v1 Cloud launch, but **offline/LAN mode will require a local, internet-free login path** to replace it on disconnected machines. This is a known future item (the offline docs already flag "Auth layer must adapt"). Not a contradiction — a sequencing reality.

**Still to build for offline (the offline/desktop phase, not v1):** desktop shell + installer that bundles PostgreSQL; local login option; one-way "export validated package → cloud import → cloud becomes authority" migration; local scheduled backups; LAN device-approval. Disconnected behavior (queued posting intents) is specified in `deployment-modes.md`.

---

## How the Database Is Connected, Secured, and Backed Up

### Connection model — end users NEVER touch the database
- A normal user only **logs in to the app** (email + password). They never see, type, or hold a database connection string. This is a deliberate security boundary: **only the backend server holds DB credentials; users only talk to the backend.**
- The connection string (`DATABASE_URL`) is set **once at install/deploy time**, never by the everyday user:
  - **Cloud:** vendor points the backend at Supabase.
  - **Office/LAN:** setup wizard / IT admin wires the backend to the local Postgres, once.
  - **Local on This PC:** installer bundles Postgres and wires it automatically (zero config).
- Customers choose a **mode**, not a database engine or URL.

### Database engine — DECISION: PostgreSQL everywhere, bundled. No BYO database.
- **We do NOT support customer-supplied databases** (MS SQL Server, Oracle, SQLite, etc.) in v1. One engine — **PostgreSQL** — in all three modes.
- Rationale: each engine behaves differently → testing/maintaining 2–3 engines triples the surface for *financial* bugs; the Prisma layer + 96 repos already target Postgres; Postgres is free, runs on Windows, and can be bundled into the installer so the user installs nothing.
- *(Supersedes the earlier SQLite suggestion in `OFFLINE_ARCHITECTURE.md`. `deployment-modes.md` is authoritative: local PostgreSQL everywhere.)*
- Enterprise BYO-database (e.g. an existing MS SQL Server) is a **possible future paid feature** if a large customer demands it — explicitly out of MVP scope.

### Security
- **Users hold no DB credentials** (the connection model above) — the primary control.
- **Multi-company isolation:** backend stamps every record with `companyId` and filters every query by it; Company A cannot see Company B's data.
- **Cloud:** TLS connection; credentials stored as server secrets, never in git (already an enforced project red line).
- **Local/LAN:** local DB binds to localhost by default; sharing across the office is a deliberate wizard-gated step (device approval + intentional firewall), never automatic; disk encryption for the local DB so a stolen office PC doesn't leak the books.

### Backups
| Mode | Backup story | Built? |
|------|-------------|--------|
| **Cloud (Supabase)** | Supabase automatic daily backups; paid tiers add point-in-time restore. Near-free. | ✅ Provided |
| **Office/LAN** | Scheduled job on the office server (dump → backup folder / external drive / optional cloud upload). | ❌ To build (offline phase) |
| **Local on This PC** | Same scheduled local backup; strongly push external-drive/cloud copy (one PC dying = total loss). | ❌ To build (offline phase) |

Honest status: cloud backups come nearly free from Supabase; **local backup tooling is planned but not built** — it belongs to the offline/desktop phase, not the cloud launch.

### Offline user setup experience (requirement for the desktop/offline phase)
The bar: a non-technical user **never manages a database connection**. Target experience:
- **Local on This PC:** one installer silently installs PostgreSQL, creates the DB, wires the connection, auto-starts the DB in the background. User just installs → logs in.
- **Office Server / LAN:** server PC runs installer in "Office Server" mode (becomes the authority). Client PCs choose "Connect to office server" and **pick the server from a discovered list or type a friendly computer name (e.g. `OFFICE-PC`) — never a raw DB URL**. Admin approves each device.
- Connection is set **once at setup**, stored in backend config, never exposed for everyday editing. App shows a plain "Connection status: ✅ Connected" indicator, not a config file.
- Status: mechanism decided; the installer + wizard UI is **to-build** (Task 222).

### ⭐ Cloud users who go offline / desktop-as-daily-driver + sync (owner's #1 priority, 2026-06-28)
Owner clarified: the **desktop app is intended as the primary daily tool**, and "offline" means *keep working normally, then push records up to the cloud when reconnected* — covering short blips through long outages.

**This is the largest and most safety-critical capability in the product. It is its own epic, AFTER the cloud launch — not v1.**

**The one unbreakable rule — single authority per company:** for any one company's books, exactly ONE location may create official records at a time; everything else is a **synced mirror**. Financial data **cannot be safely auto-merged** (duplicate voucher numbers, double-sold stock, period-lock violations). This extends the existing `authority` concept in `deployment-modes.md`.

**Two safe shapes (selected per customer, same codebase):**
- **Shape A — Desktop is authority, cloud is mirror** *(best fit for "desktop daily, offline-first, sync up")*: desktop owns the books and works offline always; when online it **pushes changes up** to the cloud (backup + remote read/reporting). No conflict to resolve because the cloud isn't independently posting for that company.
- **Shape B — Cloud is authority, desktop is a smart client** *(multi-branch feeding one central book)*: offline desktop **queues** work; queued items become official only when the cloud accepts them (can be rejected with a reason). More limited offline, supports many locations on one truth.

**The shape to AVOID:** active-active (desktop AND cloud both posting official records independently, then merging) — the data-corruption trap. Do not build.

**Consequences:** (1) needs the **local login** path (Firebase Auth is cloud-only — already flagged). (2) The **sync engine + authority handover** is the central hard component; supersedes the "continuous sync is future" note in `deployment-modes.md` by making it a committed (later) epic. (3) Requires brutal regression testing — a sync bug = someone's books are wrong. Effort: **months, dedicated epic**, sequenced after cloud v1.

**SCOPE NOTE (owner, 2026-06-28):** For the cloud product, offline support = **the QUEUE model only** (cloud backend stays the sole authority; offline work is queued drafts synced on reconnect). **"Move the authority onto the client/desktop" (Shape A bundling a local backend) is PARKED as a possible future feature — not being built.** The sections below about local authority remain as future reference only.

**Sync conflict model — QUEUE replay against single authority (engineered 2026-06-28):**
The cloud backend remains the ONLY referee, so there is **no multi-master merge** — offline work is delayed *requests*, replayed in order. Design:
- **Two timestamps, two jobs:** *created-time* (when made offline) = the **accounting/document date** (keeps books dated to the real event); *sync/acceptance-time* (when the cloud accepts) = the **official sequence + contention winner**.
- **Contention rule:** whoever the cloud **accepts first wins** (arrival order, not offline-creation order — you can't retroactively win stock already handed to someone). The loser is **flagged for review, never silently overwritten** (e.g. "stock no longer available").
- **Numbering:** official numbers are **never assigned offline** — the cloud assigns them at acceptance, in processing order, so no collisions.
- **Idempotency:** each queued item carries a **unique ID**; resync of the same ID is a no-op → no double-posting. (Infra exists: `IdempotencyKey` store.)
- **Period locks / rejections:** items dated into a now-locked period (or otherwise invalid) are rejected with a reason; **stop at the first hard block**, user fixes, continue.
- **Flow:** offline action saved locally (ID, user, device, created-time, data) → on reconnect client sends queue in order → cloud validates each against *current* official state → accept (gets number/stock/ledger now, dated with real event date) or reject (shown with reason).

**Refinements (owner, 2026-06-28):**
- **Desktop app is a first-class CLOUD CLIENT, not only a local-authority install.** It can (a) connect to cloud with a local cache + outbox, or (b) be its own local authority. Browser stays available for quick access; serious daily users run the desktop (a browser can't buffer offline work meaningfully — the desktop can).
- **"Our cloud server is down → users keep working" is solved by pushing authority to the edge (Shape A).** If the desktop owns the books locally and syncs up, our cloud being down is a non-event for that customer. Edge authority = resilience against *both* the user's internet and our server.
- **Two distinct "offline"s (owner's framing):** losing the **cloud mirror** = normal, keep working, non-blocking ("offline, will sync"); losing the **local authority** (own desktop/office server) = something is **broken**, block + alert and fix — the local authority must always be reachable.
- **Reads vs writes offline:** reads serve from the **local cache** (no wait); writes commit to the **local authority immediately** (Shape A) or **queue** and wait for server acceptance (cloud-authority shared books).
- **The single per-customer design question:** *where does this company's authority live — their desktop, their office server, or our cloud?* Same codebase; authority placement decides offline power. Small/single-authority business → desktop authority (max offline). Multi-branch central book → cloud authority (offline = draft + queue, can't auto-merge independent official posting).

### Dedicated / single-tenant deployments (supported, no rewrite)
A customer wanting total isolation = the same codebase deployed as an isolated unit: either a **dedicated cloud instance** (own app copy + own Supabase DB) or **on-premise** (Office/Local modes). Maps to a tiered model: shared cloud (cheap) → dedicated cloud (premium) → on-premise/offline (enterprise). Only real cost is **operational** (maintaining N instances + a repeatable provisioning process — manual for MVP, automated later).

---

## Blind Spots / Open Considerations (raised 2026-06-28 — not yet decided)

These are real, deployment-affecting topics not yet planned. Ordered by "bites you soonest if ignored."

| # | Topic | Why it matters | When |
|---|-------|----------------|------|
| 1 | **Software updates for offline customers** | Cloud auto-updates; offline PCs don't. Need an update mechanism (in-app updater / signed installers) or customers get stuck on old, buggy versions you can't hotfix. | Offline phase |
| 2 | **Licensing / activation (esp. offline)** | Nothing stops an offline install being copied to 50 PCs unpaid. Need license keys + activation + enforcement. `deployment-modes.md` already lists "license enforcement" as a server responsibility. | Before selling offline |
| 3 | **"The office PC died" — disaster recovery** | In LAN/Local mode one machine holds the books. Need a tested restore procedure + off-machine backups, or a hardware failure = lost company data. | Offline phase |
| 4 | **Supporting customers you can't see into** | You can't inspect an offline customer's DB. Need a "support bundle" export (logs/diagnostics) + a remote-assist path. | Offline phase |
| 5 | **Legal/tax compliance & e-invoicing per country** | Many countries mandate specific invoice formats / government e-invoice integration. Region-specific and large for an ERP. Affects which markets you can sell to. | Per target market |
| 6 | **Email sending (invoices, notifications)** | Sending invoices/alerts needs a real email service (SMTP/SendGrid) + domain/deliverability setup. Currently not a launch capability. | Cloud v1+ |
| 7 | **Importing existing customer data** | New customers arrive with data in Excel/another ERP. Need import tooling for items, parties, opening balances, or onboarding is painful. | Early, sales-driven |
| 8 | **Cloud cost vs pricing** | Supabase + Railway costs scale with usage; pricing must cover per-tenant infra cost. A business-model item, not just technical. | Before pricing |
| 9 | **Cloud monitoring / uptime** | When shared cloud is down, *all* customers are down. Need monitoring, alerting, and an incident/rollback runbook. | Cloud v1 |
| 10 | **Minimum hardware spec for offline** | Offline runs on whatever PC the customer owns. Define a minimum spec so a cheap PC doesn't = slow ERP blamed on the software. | Offline phase |

---

## Key References
- `docs/architecture/deployment-modes.md` — the three modes, authority vs connectivity, disconnected behavior (authoritative).
- `planning/OFFLINE_ARCHITECTURE.md` — earlier technical evaluation (note: SQLite suggestion superseded by Postgres-everywhere).
- `planning/tasks/222-desktop-offline-lan-architecture.md` — the offline/desktop epic.
- `planning/tasks/SQL-MIGRATION-SWITCH-GUIDE.md` — the detailed switch procedure, smoke tests, gotchas, rollback.
- `backend/prisma/schema.prisma` — 105-model schema.
- `backend/src/infrastructure/di/bindRepositories.ts` — the `DB_TYPE` toggle (111 branches).
- `backend/src/infrastructure/prisma/` — existing Prisma implementations.

---

**Next step:** Decisions are locked. Execute **Phase 1 — make SQL run locally against Postgres.** That single week converts "code exists" into "we know it works" and de-risks everything after it. The AI module is excluded from the v1 repo-porting scope (item #1 in The Real Gap is reduced from ~27 to ~15 repos accordingly).
