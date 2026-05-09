# 76 — Tailscale Local Development Environment

**Date:** 2026-05-09  
**Agent:** Codex (CTO Mode)  
**Actual time:** ~35m  
**Status:** Done

## Technical Developer View

Configured local-only development access over Tailscale using server IP `100.72.126.75`.

Files changed:
- `firebase.json`
- `package.json`
- `frontend/package.json`
- `frontend/.env.development.local`
- `frontend/src/config/firebase.ts`
- `JOURNAL.md`
- `ACTIVE.md`

What changed:
- Firebase emulators bind to `0.0.0.0` so other Tailscale devices can reach the local server.
- Emulator UI explicitly binds to `0.0.0.0:4000`.
- Frontend development env now points at the Tailscale IP for API, Auth emulator, Firestore emulator, and Realtime Database emulator.
- Firestore config supports `VITE_FIRESTORE_EMULATOR_HOST=host:port`.
- Existing `VITE_FIREBASE_FIRESTORE_EMULATOR_HOST` remains supported for compatibility.
- Realtime Database emulator config now uses the configured host/port and defaults to port `9001`, matching `firebase.json`.
- Added helper scripts:
  - `frontend`: `npm run dev:remote`
  - root: `npm run emulators:remote`

Verification:
- `firebase.json` JSON parse passed.
- `frontend`: `npm run build` passed.
- `frontend`: `npm run typecheck` passed.
- `backend`: `npm run build` passed.
- `backend`: `npm run typecheck` passed.

Known issue:
- `backend/functions`: `npm run build` fails due to unrelated package/version TypeScript issues. Root `firebase.json` uses `backend/` as the Functions source, so this does not block the current emulator setup.

## End-User View

The ERP03 development system can now be opened from another device connected to the same Tailscale network.

Open these URLs from the other device:
- Frontend: `http://100.72.126.75:5173`
- Firebase Emulator UI: `http://100.72.126.75:4000`
- Functions API base: `http://100.72.126.75:5001/erp-03/us-central1/api/api/v1`
- Auth Emulator: `http://100.72.126.75:9099`
- Firestore Emulator: `100.72.126.75:8080`

If a device cannot connect, the likely remaining manual step is allowing inbound Windows Firewall access to the development ports.
