# ERP03 Documentation

This is the documentation map for ERP03. It explains what lives where so you can find the right doc fast.

## Directory Layout

```
docs/
├── README.md              ← you are here
├── architecture/          Technical docs — for engineers
├── user-guide/            How-to docs — for end users
├── modules/               Per-module deep-dives (sales, inventory, purchases, etc.)
├── decisions/             Architecture Decision Records (ADRs)
└── handoff/               Onboarding for incoming engineers
```

> Some scattered docs (e.g. `docs/AI_ASSISTANT_STATE.md`, `docs/DOCUMENT_FORMS_PLAN.md`, `docs/audit/`, `docs/qa/`, `docs/testing/`, `docs/phase*.md`) exist from earlier work. They will be sorted into the correct folder above during Phase 4 audit.

## Where to find...

### "I want to understand how the system is built"
→ `docs/architecture/` — technical docs per feature/module
→ `docs/architecture/README.md` — convention and template
→ `docs/decisions/` — *why* major decisions were made
→ `docs/modules/<name>/` — per-module deep-dives (plans, algorithms, schemas)

### "I want to use a feature in the product"
→ `docs/user-guide/<module>/<feature>.md`
→ `docs/user-guide/README.md` — style guide for writing new ones

### "I just joined the team"
→ `docs/handoff/README.md` — start here
→ `../README.md` — project root README
→ `../planning/VISION.md` — product vision

### "I want to see what's being worked on"
→ `../planning/ACTIVE.md` — current task
→ `../planning/JOURNAL.md` — recent history
→ `../planning/ROADMAP.md` — phased plan
→ `../planning/tasks/` — pending task plans
→ `../planning/done/` — 82+ completion reports

### "I want to collaborate with AI agents"
→ `../AGENTS.md` — protocol, CTO role, multi-agent workflow, red lines
→ `../CLAUDE.md` — Claude Code specific entry point

---

## Definition of Done — every feature produces docs

Per [`AGENTS.md`](../AGENTS.md), no feature is complete until both an architecture doc AND a user guide exist for it. The completion report (`../planning/done/NN-feature-name.md`) links to both.

This dual-audience documentation ensures:
- **Future engineers** can pick up the project cleanly (architecture)
- **End users** can adopt the system (user guide)

The reviewer agent (`erp-reviewer`) is configured to block merge if a user-facing feature has no user guide.

---

## Doc Index by Module

> Phase 5 will backfill missing entries. The list below reflects what exists today; the matrix shows the gap to fill.

### Architecture docs (`docs/architecture/`)

| Module / Feature | Doc |
|---|---|
| AI Assistant — Credits Runtime | [ai-assistant-credits-runtime.md](architecture/ai-assistant-credits-runtime.md) |
| AI Assistant — Runtime v2 | [ai-assistant-runtime-v2.md](architecture/ai-assistant-runtime-v2.md) |
| AI Assistant — Security Hardening | [ai-assistant-security-hardening.md](architecture/ai-assistant-security-hardening.md) |
| AI Assistant — Tooling & Analytics | [ai-assistant-tooling-and-analytics.md](architecture/ai-assistant-tooling-and-analytics.md) |
| AI Assistant — Rate Limiting | [ai-assistant-rate-limiting.md](architecture/ai-assistant-rate-limiting.md) |
| AI Provider Driven Settings | [ai-provider-driven-settings.md](architecture/ai-provider-driven-settings.md) |
| Topbar Precision Widget Layout | [topbar-precision-widget-layout.md](architecture/topbar-precision-widget-layout.md) |
| Module Access 403 Trace | [module-access-403-trace.md](architecture/module-access-403-trace.md) |
| Graphify Usage | [graphify-usage.md](architecture/graphify-usage.md) |

### User guides (`docs/user-guide/`)

| Module / Feature | Doc |
|---|---|
| AI Assistant — Chat Sidebar | [ai-assistant-chat-sidebar.md](user-guide/ai-assistant-chat-sidebar.md) |
| AI Assistant — Credits | [ai-assistant-credits.md](user-guide/ai-assistant-credits.md) |
| AI Assistant — Runtime v2 | [ai-assistant-runtime-v2.md](user-guide/ai-assistant-runtime-v2.md) |
| AI Assistant — Security | [ai-assistant-security.md](user-guide/ai-assistant-security.md) |
| AI Assistant — Tool Data & Analytics | [ai-assistant-tool-data-and-analytics.md](user-guide/ai-assistant-tool-data-and-analytics.md) |
| AI Provider Settings | [ai-provider-settings.md](user-guide/ai-provider-settings.md) |
| Company Admin — Modules | [company-admin-modules.md](user-guide/company-admin-modules.md) |
| Topbar Widget Layout | [topbar-widget-layout.md](user-guide/topbar-widget-layout.md) |

### Module deep-dives (`docs/modules/` — coming in Phase 4)

| Module | Status |
|---|---|
| Sales | Plans and algorithms exist in `docs/sales/` → will move to `docs/modules/sales/` |
| Inventory | Plans and algorithms exist in `docs/inventory/` → will move to `docs/modules/inventory/` |
| Purchases | Plans and algorithms exist in `docs/purchases/` → will move to `docs/modules/purchases/` |
| Accounting | No deep-dive yet; backend has `backend/src/domain/accounting/ARCHITECTURE.md` |
| AI Assistant | Already covered under architecture/ |

---

## Gap analysis (what's missing — Phase 5 backfill)

| Module | Architecture | User Guide | Priority |
|---|---|---|---|
| Accounting | ⚠️ Only backend domain doc | ❌ Missing | Core 4 |
| Sales | ⚠️ Only planning docs in `docs/sales/` | ❌ Missing | Core 4 |
| Purchases | ⚠️ Only planning docs in `docs/purchases/` | ❌ Missing | Core 4 |
| Inventory | ⚠️ Only planning docs in `docs/inventory/` | ❌ Missing | Core 4 |
| Super Admin | ❌ Missing | ❌ Missing | High |
| Settings | ❌ Missing | ❌ Missing | High |
| Reports (P&L, Balance Sheet, etc.) | ❌ Missing | ❌ Missing | Medium |
| RBAC / Permissions | ❌ Missing | ❌ Missing | Medium |
| Multi-Company / Multi-Tenancy | ❌ Missing | ❌ Missing | Medium |

Phase 5 of the [restructure plan](../planning/JOURNAL.md) addresses these gaps.
