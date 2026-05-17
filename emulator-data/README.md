# emulator-data/

This folder is the **canonical seeded local dev database** for ERP03. It is **tracked in git** — every developer gets the same starting state.

When you run `npm run emulators`, Firebase loads this folder. When you stop the emulators with `db:export`, this folder is updated.

## What's inside

```
emulator-data/
├── auth_export/             Firebase Auth users
├── database_export/         Realtime DB (rarely used by ERP03)
├── firestore_export/        Firestore documents (the main DB)
├── storage_export/          Firebase Storage (files/images)
└── firebase-export-metadata.json    Format version
```

## When to refresh

Update `emulator-data/` (and commit the new version) when:
- A new module is added that needs seed data (super admin, default company, sample accounts, etc.)
- A schema migration changes how data is stored
- You hit reproducible bugs that only happen with realistic data and want the team to share that state

How to refresh:
```bash
# 1. Start emulators with current data
npm run emulators

# 2. Make changes through the app (add seeds, fix data, etc.)

# 3. Export back to this folder
npm run db:export

# 4. git add emulator-data && commit
git add emulator-data
git commit -m "chore(seed): refresh emulator-data with <what changed>"
```

## When NOT to commit `emulator-data/` changes

If you ran the emulators and they auto-saved (Firestore writes a few internal files even when you don't change app data), the diff will look noisy but trivial. Two ways to handle:

- **Skip the noise commit:** `git checkout -- emulator-data/` to discard local emulator drift.
- **Or commit if real:** if the drift contains a new test user, a fix for a corrupted document, etc., keep the changes.

Rule of thumb: only commit `emulator-data/` when you're deliberately updating the seed.

## Ad-hoc snapshots — `.emulator-snapshots/`

If you want a save point before a risky migration or experiment, **don't** drop a `firebase-export-XXX` folder at the repo root (that's how we ended up with the 11 archived ones).

Instead:

```bash
mkdir -p .emulator-snapshots
firebase emulators:export ./.emulator-snapshots/2026-05-17-before-migration --force
```

`.emulator-snapshots/` is gitignored — it lives only on your machine. To restore one later:

```bash
firebase emulators:start --import ./.emulator-snapshots/2026-05-17-before-migration
```

## Historical exports

Old root-level snapshots from before 2026-05-17 live under `.archive/firebase-exports/` and `.archive/emulator-backups/`. They are kept as history; new snapshots should not go there.

See [`.archive/README.md`](../.archive/README.md) for details.
