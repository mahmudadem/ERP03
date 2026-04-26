# ERP Offline Architecture — Technical Evaluation

## 1. Validation of Assumptions

| # | Assessment | Notes |
|---|---|---|
| 1 | **CORRECT** | Electron's core purpose is exactly this: Chromium + Node.js wrapping a web UI. |
| 2 | **CORRECT** | Running Next.js *inside* Electron is possible (`electron-next`) but is a niche pattern with real downsides: cold-start latency, memory overhead, and you're running a full SSR framework locally for no benefit. Your backend should be a remote server for online customers. |
| 3 | **CORRECT** | Electron is a wrapper, not a performance layer. Slow queries = slow queries regardless of the shell. |
| 4 | **PARTIALLY CORRECT** | Tauri is lighter (smaller binary, less RAM) because it uses the system webview. But "lighter" has a catch: system webviews differ across platforms (WebView2 on Windows, WKWebView on macOS), which creates rendering inconsistencies and API-gaps — significant for a complex ERP UI. Also, Tauri's backend layer is Rust, which your team doesn't know. |
| 5 | **CORRECT — this is the most important insight** | The offline problem is a data architecture problem, not a wrapper problem. Electron vs Tauri is the easy decision. Local persistence, sync, and conflict resolution are the hard problems. |
| 6 | **PARTIALLY CORRECT** | Electron first is justified given team familiarity. But "optimize later" is dangerous if offline is a real requirement — you must design the data/sync layer upfront, even in v1. Otherwise you'll rewrite everything. |
| 7 | **CORRECT** | Exactly right. Same UI, new local data layer. |

---

## 2. Best Architecture for Online Customers

```
┌─────────────────────────────────────────────────┐
│  Browser / Electron shell (optional)             │
│  ┌─────────────────────────────────────────────┐│
│  │         React SPA (shared UI)               ││
│  └────────────────────┬────────────────────────┘│
│                       │ HTTPS                     │
├───────────────────────┼───────────────────────────┤
│  Remote Server        ▼                           │
│  ┌─────────────────────────────────────────────┐│
│  │  Next.js (API Routes / SSR)                 ││
│  │  ┌─────────────────────────────────────────┐││
│  │  │  Shared Business Logic Layer             │││
│  │  └──────────────────┬──────────────────────┘││
│  └─────────────────────┼───────────────────────┘│
│                        │                          │
│           ┌────────────▼────────────┐             │
│           │  PostgreSQL (remote DB) │             │
│           └─────────────────────────┘             │
└─────────────────────────────────────────────────┘
```

**Stack:** React + Next.js (remote) + PostgreSQL. No change from what you have.

**Desktop optional:** Wrap the React SPA in Electron pointing at the remote URL. Zero architectural change needed.

---

## 3. Best Architecture for Offline Customers

```
┌──────────────────────────────────────────────────────┐
│  Electron Shell                                      │
│  ┌──────────────────────────────────────────────────┐│
│  │         React SPA (same UI codebase)             ││
│  └────────────────────┬─────────────────────────────┘│
│                       │ localhost API                  │
│  ┌────────────────────▼─────────────────────────────┐│
│  │  Local API Server (Node.js, Express/Fastify)     ││
│  │  ┌─────────────────────────────────────────────┐││
│  │  │  Shared Business Logic Layer (extracted)     │││
│  │  └──────────────────┬──────────────────────────┘││
│  └─────────────────────┼────────────────────────────┘│
│                        │                              │
│  ┌─────────────────────▼────────────────────────────┐│
│  │  SQLite (local DB, via better-sqlite3 or Drizzle) ││
│  └─────────────────────┬────────────────────────────┘│
│                        │                              │
│  ┌─────────────────────▼────────────────────────────┐│
│  │  Sync Engine (custom or e.g. PowerSync / Dexie   ││
│  │  + custom conflict resolution)                   ││
│  └───────────────────────────────────────────────────┘│
│           │ when connectivity available                │
└───────────┼───────────────────────────────────────────┘
            ▼
   Remote PostgreSQL (re-sync)
```

**What runs locally inside Electron:**
- **UI:** React SPA (reused 100%)
- **Local API:** A lightweight Node.js server (Express or Fastify) — NOT Next.js running inside Electron. This server imports the same business logic modules extracted from your Next.js API routes.
- **Local DB:** SQLite via `better-sqlite3` or via an ORM like Drizzle (which supports both PostgreSQL and SQLite)
- **Sync engine:** Handles push/pull to remote PostgreSQL when online

---

## 4. What You Can Reuse from Your Current Stack

| Component | Reuse Level | Notes |
|-----------|------------|-------|
| **React UI components** | **100%** | Identical codebase, just build as SPA instead of SSR pages |
| **Business logic** (validation, calculations, permissions) | **90–100%** | Extract from Next.js API routes into a shared `@erp/core` package. Both remote Next.js and local Express server import from it. |
| **Next.js API routes** | **Structure changes** | Routes become thin wrappers that call the shared logic layer. The logic moves to `@erp/core`. |
| **Next.js SSR** | **Not used in desktop** | Offline desktop doesn't need SSR. Build React as a static SPA for Electron. |
| **PostgreSQL schemas** | **Logical schema reused** | SQLite has different type system and feature set. Use an ORM that supports both (Drizzle, Prisma) to keep schema definitions in one place. |
| **Auth layer** | **Must adapt** | Online: NextAuth/cognito. Offline: local auth with cached credentials. You'll need an abstraction. |
| **File uploads/storage** | **Must adapt** | Online: S3/blob. Offline: local filesystem. Another abstraction needed. |

---

## 5. What You Must Add/Change

### Must Add

| Addition | Purpose |
|----------|---------|
| **`@erp/core` shared logic package** | Extract all business logic from Next.js API routes into importable modules. Both remote and local servers use this. |
| **Local API server** (Express/Fastify) | Lightweight Node server bundled inside Electron. Replaces Next.js API routes for offline mode. |
| **Local database** (SQLite) | Persistent offline storage. Drizzle ORM can target both PostgreSQL and SQLite with shared schema definitions. |
| **Sync engine** | Bidirectional sync between local SQLite and remote PostgreSQL. This is the hardest part. Options: PowerSync (paid, PostgreSQL-aware), custom based on change logs + vector clocks, or Dexie for simpler needs. |
| **Conflict resolution strategy** | ERP data (inventory counts, financial records) cannot be silently overwritten. You need a defined strategy: last-write-wins (dangerous), operational transforms, or manual conflict UI. |
| **Online/offline mode detection** | UI needs to know which backend to call (local vs remote) and which features are available. |
| **Electron build pipeline** | Electron-builder or similar. Bundle React SPA + local Node server into distributable. |

### Must Change

| Change | Reason |
|--------|--------|
| **Next.js pages → SPA build mode** | Desktop version needs a static React build, not SSR. Use `next export` (static export) or switch to Vite for the SPA build. |
| **Data access layer** | Currently hardcoded to PostgreSQL. Must be abstracted so the same business logic can talk to SQLite locally or PostgreSQL remotely. |
| **Authentication** | Offline customers cannot call a remote auth server. Need local auth with cached/hashed credentials and a sync mechanism for user/permission updates. |

---

## 6. Final Recommendation

### Stack

| Layer | Online | Offline Desktop |
|-------|--------|------------------|
| **UI** | React (via Next.js) | React SPA (in Electron) |
| **Shell** | Browser or Electron | Electron |
| **API** | Next.js API Routes (remote) | Express/Fastify (local, inside Electron) |
| **Business Logic** | `@erp/core` package | `@erp/core` package (same code) |
| **Database** | PostgreSQL (remote) | SQLite (local) |
| **ORM** | Drizzle (supports both PG and SQLite) | Drizzle |
| **Sync** | N/A | Custom sync engine + conflict resolution |

### Migration Path (Ordered)

1. **Extract business logic** into `@erp/core`. All Next.js API routes become thin wrappers calling `@erp/core` functions. This is the single most important step and should be done first. It costs nothing for the online version and enables everything else.

2. **Add Drizzle ORM** (or similar dual-target ORM) so your data layer can target both PostgreSQL and SQLite from the same schema definitions.

3. **Build the SPA mode** of your React app. Use `next export` or switch to Vite for producing a static build. This is the UI that goes into Electron.

4. **Create the local API server** (Express/Fastify) that imports `@erp/core` and routes to local SQLite. Same business logic, different transport.

5. **Set up Electron** packaging. Bundle: React SPA + local Node server + SQLite binary. Use `electron-builder` for distributable output.

6. **Build the sync engine.** Start simple: one-directional sync (download on connect), then progress to bidirectional with conflict resolution. This is where you spend the most design time — ERP data integrity requirements are strict.

7. **Add offline detection** in the UI. A context/provider that routes API calls to local or remote based on connectivity status.

### Answer to Question G — Yes

> Keep Electron for desktop, keep backend remote for online, add local offline mode with local storage/sync for specific customers.

This is exactly the right approach. It's not a binary choice between online and offline architectures — it's a **layered architecture** where the offline mode is an additional layer under the same UI and business logic.

---

## Biggest Risks (Answer to Question H)

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Sync conflict resolution in ERP data** | Critical | Design conflict strategy early. Financial and inventory data needs manual review on conflicts, not auto-merge. |
| **Two codepaths diverge** | High | Shared `@erp/core` package is your lifeline. If logic drifts between online and offline, you have two products. |
| **SQLite limits vs PostgreSQL** | High | SQLite lacks some PG features (row-level security, full-text search, JSON operators). Test schema compatibility early. |
| **Local data security** | Medium | Customer machines have your full SQLite database. Encrypt at rest using SQLCipher. |
| **Bundle size and memory** | Medium | Electron + Node server + SQLite = ~200MB+ installed. Acceptable for desktop ERP, but not mobile. |
| **Feature parity pressure** | Medium | Some features (real-time collaboration, email sending) won't work offline. Design graceful degradation, not feature flags. |

### Mobile Note (Android)

Neither Electron nor Tauri targets Android well. If Android is a real requirement, you'll likely need **React Native** for mobile separately, or **Capacitor** (Ionic) to wrap your React web app for Android. That's a separate decision from the desktop/offline architecture described above.