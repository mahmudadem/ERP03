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
