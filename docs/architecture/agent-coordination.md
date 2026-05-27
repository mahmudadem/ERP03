# ADR: Multi-Agent Coordination Strategy

**Date:** 2026-05-23
**Status:** Accepted
**Author:** Mahmud (product owner) + Cowork (documenting)

---

## Context

ERP03 is developed by a single non-technical product owner (Mahmud) using multiple AI coding agents across multiple devices:

- **Claude Code** — primary development agent (terminal, full repo access)
- **Codex** — async task execution (used when Claude Code is unavailable)
- **OpenCode** — multi-agent orchestration (delegates to sub-agents for complex tasks)
- **Cowork** — planning, documentation, non-code tasks (this session)

These agents do not communicate with each other in real time. Mahmud is the only human in the loop. Work happens asynchronously — sometimes one agent picks up where another left off hours or days later.

**The core problem:** How do multiple agents share state, avoid duplicate work, and hand off cleanly — without infrastructure overhead or requiring Mahmud to repeat context every session?

---

## Decision

**Use git-based coordination as the primary mechanism.**

All shared state lives in markdown files committed to the repo. Every agent reads and writes these files. No real-time communication. No dedicated server. No database.

This is boring, robust, and requires zero infrastructure to maintain.

### The Coordination Files

| File | Role |
|------|------|
| `planning/PRIORITIES.md` | Ordered task list. What to work on. Task lock table to prevent collisions. |
| `planning/QA-QUEUE.md` | Features ready for Mahmud to manually test. Agents write; Mahmud checks off. |
| `planning/ACTIVE.md` | Current task detail, where we left off, rabbit holes, carry-forward items. |
| `planning/JOURNAL.md` | Append-only log of every session. The handoff record. |
| `planning/briefs/` | Structured notes from one agent to another (e.g., "backend done, wire the frontend"). |
| `AGENTS.md` | Agent protocol, coordination rules, definition of done. All agents read this. |

### The Protocol (summary)

1. `git pull` → read PRIORITIES.md → check Task Lock → claim task
2. Do the work
3. Update QA-QUEUE.md → append JOURNAL.md → update ACTIVE.md → update PRIORITIES.md → commit

Full protocol lives in `AGENTS.md` under "Multi-Agent Coordination Protocol."

---

## Consequences

**Good:**
- Zero infrastructure. No server to maintain or pay for.
- Every agent already knows how to read/write files and run git.
- State is versioned — any collision or mistake is recoverable.
- Works across all devices, all agents, offline.
- Mahmud can read the planning files directly to understand project state.

**Accepted limitations:**
- Task lock is "honor system" — two agents could theoretically claim the same task simultaneously if both do `git pull` before either commits the lock. In practice, Mahmud opens one agent at a time, so this is low risk.
- No real-time notifications. Mahmud must remember to check QA-QUEUE.md and open the right agent.
- Briefs in `planning/briefs/` require Mahmud to tell the next agent "check your briefs" — they won't self-trigger.

---

## Rejected Alternatives

### MCP Coordination Server
Build a small MCP server with tools like `claim_task()`, `get_priorities()`, `add_to_qa_queue()`. Every agent connects and reads/writes state through a clean API.

**Why rejected (for now):** Requires building and maintaining a server. Adds a new failure mode. The file-based system hasn't caused pain yet — this would be premature optimization.

**When to revisit:** If two agents actually collide on the same task, if stale locks become a real problem, or if the number of active agents grows beyond 3–4.

### Agent-to-Agent Invocation via MCP
Build an MCP server that wraps other agents' CLIs, allowing me to invoke Codex directly.

**Why rejected:** Brittle, expensive (each agent burns API credits), hard to debug, removes Mahmud from the loop. Against the project's "human in driver's seat" principle.

### Shared Database (Firestore / SQLite)
Use the project's own Firestore for coordination state.

**Why rejected:** Mixing infrastructure concerns. Firestore is ERP03's product database, not a dev ops tool. This would create a dependency loop and complicate the handoff to professional engineers.

---

## Upgrade Path

If the file-based system starts causing real pain (collisions, lost work, Mahmud repeating context too often), upgrade in this order:

### Step 1 — MCP Project State Server (1 weekend)
Build a minimal Node/Express MCP server with these tools:
- `get_priorities()` → reads PRIORITIES.md or a JSON equivalent
- `claim_task(agent, task)` → atomic write-lock with timestamp
- `release_task(agent, outcome)` → releases lock, records result
- `add_to_qa_queue(feature, instructions)` → appends to QA-QUEUE.md
- `log_journal(agent, summary)` → appends to JOURNAL.md

Every agent connects to this server. State is still file-backed but access is atomic and queryable.

**Trigger:** Use this when task collisions happen more than twice, or when PRIORITIES.md gets too complex to manage manually.

### Step 2 — Notification Layer (small lift)
Add a notification tool to the MCP server that sends a message (Telegram, Slack, phone) when:
- An agent finishes a task
- A feature is added to QA-QUEUE
- A brief is written for a specific agent

This closes the async loop: Mahmud gets a ping instead of having to remember to check files.

**Trigger:** Use this when Mahmud starts missing QA items or briefs because he forgot to check.

### Step 3 — Agent Invocation (stretch, probably never needed for this project)
Wrap other agents' CLIs in MCP tools so one agent can invoke another. Only if Step 1 and 2 are insufficient and the team grows.

---

## Decision Rationale

> "Don't build infrastructure before you've felt the pain."

The file-based system is sufficient for one product owner + 2–3 agents working asynchronously. It costs nothing to run, requires no new skills, and is already working. The MCP upgrade path is documented so future engineers (or Mahmud, when the business scales) can implement it without starting from scratch.

---

_Authors: Mahmud (decision), Cowork agent (documentation, 2026-05-23)_
