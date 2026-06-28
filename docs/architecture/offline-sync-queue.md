# Offline Queue & Sync — Architecture (design, post-launch build)

> **Status:** Design agreed (owner + CTO, 2026-06-28). **Build:** AFTER the Supabase cloud launch (Epic 275). Relates to [Task 222](../../planning/tasks/222-desktop-offline-lan-architecture.md).
> This documents the **cloud-user-offline** model. The heavier "desktop carries its own backend (local authority)" option is **parked as a future feature** and is not built.

## Problem

A cloud user (browser / mobile / **desktop client**) may lose connectivity — their internet, or our server — and must be able to **keep working**, with their work synced when the connection returns, **without ever corrupting the books**.

## Core principle — single authority

There is exactly **one authority** per company: **our cloud backend + its PostgreSQL database**. The authority is the only thing that creates official records (sequential numbers, ledger postings, stock movements, period-lock enforcement, official reports). The frontend never creates official truth.

Offline work is therefore **not** an independent set of official records to merge — it is a set of **delayed requests** the single authority replays in order. This deliberately avoids multi-master merge, which is unsafe for financial data.

## The model — a stamped queue replayed against the authority

### Two timestamps, two jobs
| Timestamp | Purpose |
|-----------|---------|
| **Created-time** (made offline) | The **accounting/document date** — keeps the books dated to when the event really happened. |
| **Sync/acceptance-time** (cloud accepts) | The **official sequence** and the **contention winner**. |

### Rules
- **Contention winner = first accepted by the cloud** (arrival order), not offline-creation order. You cannot retroactively win stock already handed to another customer. The loser is **flagged for review, never silently overwritten** (e.g. "stock no longer available").
- **Official numbers are never assigned offline.** The cloud assigns them at acceptance, in processing order → no collisions.
- **Idempotency:** each queued item carries a **unique ID**; re-syncing the same ID is a no-op → no double-posting. (Infra exists: `IdempotencyKey` store.)
- **Rejections / period locks:** an item dated into a now-locked period (or otherwise invalid against current state) is rejected with a reason. **Stop at the first hard block**, surface it, let the user fix, then continue in order.

### Flow
1. Offline, each action is saved locally with: unique ID, user, device, created-time (real event date), payload.
2. On reconnect, the client sends the queue **in order**.
3. The cloud validates each item against **current** official state, applying all normal rules.
4. Each item → **accepted** (gets number/stock/ledger now, dated with its real event date) or **rejected** (shown with reason; stop at first hard block).

## Two meanings of "offline" (must be handled differently)
- **Losing the cloud authority** (cloud user): **normal** — show "You're offline — work queued, will sync," keep working (reads from local cache; writes queue).
- **Losing a *local* authority** (only relevant in the parked local-authority/LAN modes): a **fault** — block + alert; the local authority should always be reachable.

## What's offline-capable vs not (cloud-authority model)
- **Freely offline:** drafting documents, reading cached data.
- **Queued, finalized on reconnect:** anything that needs official numbering / stock / ledger. Long offline windows mean more items may be rejected on return (the world moved on) — surfaced for the user to resolve.

## Build notes (when scheduled, post-launch)
- Local store + outbox on the client (desktop client buffers far better than a browser).
- Server-side idempotent intake keyed by item ID; ordered replay; per-item accept/reject with reasons.
- Heavy regression testing — a sync bug means someone's books are wrong.
- Reference design lives here and in [planning/tasks/DEPLOYMENT-PLAN-SUPABASE.md](../../planning/tasks/DEPLOYMENT-PLAN-SUPABASE.md) (⭐ section).
