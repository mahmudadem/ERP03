# Emulator Data Restore and Export-Path Guardrail Completion Report

## Technical Developer View

**Task:** Restore missing emulator import data and prevent future timestamp-folder export mismatch.

**Estimate:** 10-15m  
**Actual time:** ~10m

**Root cause:**

The default root script used:

```bash
firebase emulators:start --import=./emulator-data --export-on-exit
```

With no destination on `--export-on-exit`, Firebase wrote shutdown data to a timestamped folder such as `firebase-export-1778387915442YfJ0Al`. The next startup still imported from `./emulator-data`, which was missing, so emulator data appeared lost.

**What changed:**

- Restored the latest export folder `firebase-export-1778387915442YfJ0Al` into `emulator-data`.
- Updated root `package.json` so `npm run emulators` now uses `--export-on-exit=./emulator-data`.

**Files changed:**

- `package.json`
- `emulator-data/`
- `ACTIVE.md`
- `JOURNAL.md`

**Verification:**

- `emulator-data/firebase-export-metadata.json` exists.
- `emulator-data/firestore_export/all_namespaces/all_kinds/output-0` exists.
- Restored Firestore export size is `3061301` bytes.

## End-User View

The local development database was restored from the latest emulator backup. Starting and stopping the local emulator should now keep using the same saved data folder, so test companies, users, and records should persist between sessions.

## Known Follow-Ups

- Use `npm run emulators` or `npm run emulators:remote` for normal startup.
- If a new timestamped `firebase-export-*` folder appears after a future shutdown, check whether emulators were started manually without `--export-on-exit=./emulator-data`.
