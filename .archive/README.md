# .archive/

This folder contains code that was once part of ERP03 but is no longer active. Files are kept here (rather than deleted) so a future engineer or auditor can see what existed and decide whether to revive any of it.

**Nothing in this folder is built, imported, or deployed.** Treat it as a museum, not a library.

---

## Contents

### `auth-wizard/` (archived 2026-05-17)

**What it was:** A standalone React app for company creation / onboarding wizard. Built ~Jan 2026 as an early experiment.

**Why archived:** Functionality was reimplemented inside the main frontend (`frontend/src/modules/super-admin/company-wizard/` and `frontend/src/modules/onboarding/`). The standalone app was never wired into the main shell and had drifted from current designs. Last meaningful commit was January 2026.

**Status:** Dead. The replacement in the main frontend is canonical.

---

### `Voucher-Wizard/` (archived 2026-05-17)

**What it was:** A standalone React app for designing and rendering accounting vouchers. Built ~Dec 2025 / Jan 2026 as a parallel experiment to the main app's voucher work.

**Why archived:** The main frontend now has its own voucher implementation at `frontend/src/modules/accounting/voucher-wizard/` and `frontend/src/modules/accounting/components/shared/GenericVoucherRenderer.tsx`. The standalone app had its own `@google/genai` integration and shadcn-style components, but nothing imported from it.

**What to mine if you revisit:** The `components/VoucherDesigner.tsx` and `components/GenericVoucherRenderer.tsx` here may contain UI ideas worth comparing to the canonical versions in the main frontend. Otherwise, dead.

**Status:** Dead.

---

### `dynamic-core/` (archived 2026-05-17)

**What it was:** Empty stub for a future entity-runtime layer (the only file `entities/useEntityRuntime.ts` was empty).

**Why archived:** Never implemented; not imported anywhere.

**Status:** Stub. Safe to delete entirely later.

---

### `command-center/` (archived ~2026-05-05; tracked from 2026-05-17)

**What it was:** A local Express-based dev dashboard / task tracker. Ran separately from the main app. Useful as a development aide, not a deployable product feature.

**Why archived:** Sat unused for weeks. The product owner moved it out of the active code on May 5 before this restructure session. Per the original plan, it was supposed to be kept as `apps/command-center/` (a gated dev tool), but the actual decision on disk was to archive it.

**Status:** Dead-for-now. Revive into `apps/command-center/` (Phase 3 monorepo) if you ever want a local dashboard again.

---

### `firebase-exports/` (archived 2026-05-17)

**What it was:** 11 timestamped Firebase emulator export snapshots dropped at the repo root by `firebase emulators:export ./firebase-export-NNN`. They accumulated over months of dev work — partly because Firebase CLI defaults to root-level export paths, partly because some sessions saved a snapshot before risky changes.

**Why archived:** They polluted the root listing (~26 MB across 11 dirs, many of them obsolete or identical to `emulator-data/`). Preserving them in `.archive/firebase-exports/` keeps the historical state available without root noise.

**Restore one:** `cp -r .archive/firebase-exports/firebase-export-XXX ./tmp-restore && firebase emulators:start --import ./tmp-restore`.

**Going forward:** Ad-hoc snapshots should live under `.emulator-snapshots/` (gitignored) — see `emulator-data/README.md`.

---

### `emulator-backups/` (archived 2026-05-17)

**What it was:** Three manual save points created with `cp -r emulator-data/ emulator-data-XXX-YYYYMMDD-HHMMSS/` before risky operations:
- `emulator-data-before-routefix-restart-20260513-024116/` — before a route fix on 2026-05-13
- `emulator-data-empty-after-forceclose-20260513-023318/` — empty state captured after a force-close (same day)
- `emulator-data-empty-backup-20260510-180737/` — empty backup from 2026-05-10
- `emulator-data.backup/` — generic backup, undated

**Why archived:** Same as `firebase-exports/` — clutter at root with no active use.

**Status:** Dead. Useful only if you ever need to investigate a 2026-05-10 / 2026-05-13 incident.

---

### `restored-data/` (archived 2026-05-17)

**What it was:** A Firebase export staging folder that mirrored the structure of `emulator-data/`. Created during a past emergency restore. Was tracked in git (unlike the timestamped exports).

**Why archived:** Not referenced anywhere in source code. Same shape as `emulator-data/` but smaller (278 KB) — probably a partial export or a snapshot of an earlier dev state.

**Status:** Probably safe to delete entirely after a future engineer compares its contents to the current `emulator-data/`.

---

### `root-orphans/` (archived 2026-05-17)

**What it was:** Files left over from an early AI Studio prototype at the repo root:
- `index.html` — an importmap fragment pulling React/Vite from `aistudiocdn.com`
- `index.tsx` — empty (1 line)
- `metadata.json` — AI Studio project metadata ("ERP Modular Platform", `requestFramePermissions: []`)
- `vite.config.ts` — root-level Vite config aliasing `@` to project root (only useful if running `vite` from root, which we don't)

**Why archived:** The real frontend lives in `frontend/` with its own `index.html`, `vite.config.ts`, and entry point. The root-level versions were dead from the moment `frontend/` became self-contained.

**Status:** Dead. Safe to delete entirely after a future engineer reviews and agrees nothing here is needed.

---

## Reviving something from here

1. Read the section above for what it was and why it died.
2. Compare against the current canonical implementation (if any).
3. If you still want it back, `git mv .archive/<thing> <new-location>` — preserves history.
4. Update imports, `package.json`, and any docs that reference the new location.

## Deleting permanently

When you're confident nothing here is needed:

```
git rm -r .archive/<thing>
```

This is reversible from git history but cleans the working tree. Do it when a human has reviewed.
