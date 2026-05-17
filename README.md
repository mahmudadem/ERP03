# ERP03

Multi-tenant SaaS ERP platform — from single-person shops to multi-department enterprises on the same system.

**Status:** Pre-alpha MVP. Built for idea validation; will be handed off to professional engineers for production hardening.

---

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm (installed in Phase 3 — currently uses npm at root)
- Firebase CLI (`npm i -g firebase-tools`)
- Java (for Firestore emulator)

### Run locally
```bash
# Start Firebase emulators (Firestore, Auth, Storage)
npm run emulators

# In another terminal — start the frontend
cd frontend && npm run dev

# In another terminal — start the backend
cd backend && npm run dev
```

Frontend runs on http://localhost:3000.

---

## Project Layout

```
ERP03/
├── frontend/          React + TypeScript + Vite (main UI)
├── backend/           Node + Express + TypeScript + Firebase
├── shared/            Shared TypeScript types
├── docs/              Documentation
│   ├── architecture/  Technical docs (for developers)
│   ├── user-guide/    End-user docs (how to use features)
│   ├── modules/       Per-module deep-dives (sales, inventory, purchases)
│   ├── decisions/     Architecture Decision Records (ADRs)
│   └── handoff/       Onboarding for incoming engineers
├── planning/          Project management (internal)
│   ├── ACTIVE.md      Current work
│   ├── JOURNAL.md     Session history
│   ├── ROADMAP.md     Phased plan
│   ├── VISION.md      Product vision
│   ├── tasks/         Active task plans
│   └── done/          Completion reports
├── scripts/           Dev/ops scripts
│   └── debug/         Ad-hoc debugging scripts
├── infra/             (Phase 3) Firebase config
├── .archive/          (Phase 2) Quarantined dead code
├── command-center/    Local dev dashboard (not deployed)
├── auth-wizard/       (legacy, to be archived)
├── Voucher-Wizard/    (legacy, to be archived)
└── AGENTS.md          AI agent collaboration protocol
```

---

## Documentation

| If you want to... | Read |
|---|---|
| Understand the product vision | `planning/VISION.md` |
| See what's being worked on now | `planning/ACTIVE.md` |
| Browse past work | `planning/JOURNAL.md` |
| Understand the architecture | `docs/architecture/` |
| Learn how to use a feature | `docs/user-guide/` |
| Onboard as a new engineer | `docs/handoff/` |
| Collaborate as an AI agent | `AGENTS.md` |

---

## Working with AI Agents

This project is developed in collaboration with AI agents (Claude Code, Codex, OpenCode). All agents follow the protocol defined in [AGENTS.md](AGENTS.md).

**Every completed feature produces:**
1. Technical doc → `docs/architecture/<module>.md`
2. User guide → `docs/user-guide/<module>/<feature>.md`
3. Completion report → `planning/done/NN-feature-name.md`
4. Journal entry → `planning/JOURNAL.md`
5. Updated current focus → `planning/ACTIVE.md`

See [AGENTS.md → Definition of Done](AGENTS.md) for the full workflow.

---

## License

Proprietary. All rights reserved.
