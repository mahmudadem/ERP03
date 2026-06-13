# Task 222 — Desktop, LAN, and Offline Authority Architecture

> **Status:** Post-pilot strategic epic — documented, not started  
> **Created:** 2026-06-13  
> **Owner:** Product owner + CTO agent  
> **Estimated implementation:** 8-14 weeks after pilot, split into phases below  
> **Freeze note:** This is planning only. It must not interrupt the v0.9-alpha pilot stabilization track.

---

## 1. Goal

Prepare ERP03 to become a desktop-capable ERP with three deployment choices:

1. **Cloud** — the desktop app or browser connects to ERP03 cloud.
2. **Office Server / LAN** — one customer-controlled server or PC runs the backend and PostgreSQL; other office devices connect over the local network.
3. **Local on This PC** — one computer runs the backend and PostgreSQL for itself only.

The core architectural decision is that **desktop app** and **data authority** are separate concepts. The desktop app is the user interface. The authority is the backend/database that is allowed to save official records, post vouchers, post invoices, update inventory, assign numbers, enforce period locks, and write audit logs.

---

## 2. Non-Negotiable Product Decisions

### 2.1 Working Modes

| Mode | Backend | Database | Other PCs can connect? | Internet needed for ERP work? |
|---|---|---|---:|---:|
| Cloud | ERP03 cloud | ERP03 cloud DB | Yes, through cloud login | Yes |
| Office Server / LAN | Customer local server/service | Local PostgreSQL | Yes, after device approval | No |
| Local on This PC | Same PC local service | Same PC PostgreSQL | No, private by default | No |

**Important rule:** Local on This PC must not automatically expose data to other devices. To let Sales, Accounting, or Warehouse PCs share the same local data, the admin must explicitly promote the installation to **Office Server / LAN**.

### 2.2 Local vs Office Server

**Local on This PC**:
- Binds to localhost by default.
- Is intended for one user or one-machine businesses.
- Can post offline because its local backend is reachable.
- Has its own backups, license, users, roles, and audit trail.

**Office Server / LAN**:
- Runs backend service and PostgreSQL on one office server or designated PC.
- Accepts approved desktop clients from the same network.
- Requires device approval before a client can connect.
- Is the correct setup for multi-user local work.

### 2.3 Cloud Migration

The first cloud movement is **one-way migration**, not continuous sync:

1. Local/LAN tenant exports a validated migration package.
2. Cloud import validates the package.
3. Cloud becomes the new authority.
4. The local installation becomes read-only unless the admin intentionally starts a new local authority.

Continuous bidirectional sync is out of scope for the first release.

---

## 3. Accounting and ERP Red Lines

The local backend must enforce the same controls as cloud:

- No frontend-only posting.
- No last-write-wins for accounting or inventory.
- No silent renumbering during migration.
- No official ledger, AR/AP, tax, inventory, or report effects from queued offline intents.
- Posting must still pass period locks, approval rules, account validation, stock costing, negative-stock policy, fiscal-year rules, tax/currency validation, and audit logging.
- Every official record must be company-scoped and authority-scoped.

If a client is disconnected from its selected authority, the user may continue drafting and may press **Post**, but the action becomes **Queued for Posting**. It is not posted until the authority accepts it.

---

## 4. Architecture Decisions

### 4.1 Existing ERP03 Foundation

ERP03 already has the right direction:

- Domain/application layers are supposed to be DB-agnostic.
- Firestore and Prisma repository implementations already exist in parts of the backend.
- `DB_TYPE` already switches repositories in `backend/src/infrastructure/di/bindRepositories.ts`.
- Current Windows Mode is an in-browser MDI experience, not an installable Windows desktop app.

The offline/LAN project must complete and harden the existing SQL path instead of inventing a separate local storage system.

### 4.2 Authority Identity

Every local or cloud authority needs:

- `authorityId`
- authority type: `CLOUD`, `LAN`, or `STANDALONE`
- tenant id
- owned company ids
- authority public key / verification metadata
- sequence ranges per company and document type
- schema version
- migration state

Official records that affect accounting or inventory must carry authority metadata.

### 4.3 Connectivity State

The UI must separate:

- **Authority mode**: Cloud, Office Server / LAN, Local on This PC.
- **Connectivity state**: authority reachable/unreachable; internet available/unavailable.

Examples:

- Local on This PC + no internet: ERP work continues normally; AI/email may be unavailable or queued.
- Office Server / LAN + no internet: ERP work continues if LAN server is reachable.
- Office Server / LAN + local server unreachable: user can draft/queue only.
- Cloud + no internet: user can draft/queue only.

### 4.4 External Services

Local authority does not mean no internet. A customer can keep data local while still using:

- AI providers
- SMTP/email
- WhatsApp/Telegram integrations
- update downloads
- license package import
- support bundle upload

The UI must clearly label actions as:

- **Local**
- **Requires Internet**
- **Cloud-only**

Admins must explicitly configure providers that send business data outside the local authority.

---

## 5. User Flow

### 5.1 First Launch

After installing ERP03 Desktop, the user sees:

**How do you want to run ERP03?**

1. **Cloud Company**
   - Sign in to ERP03 cloud.
   - Connect to hosted tenant/company data.

2. **Connect to Office Server**
   - Enter server address or scan/enter pairing code.
   - Device shows an approval code.
   - Local System Admin approves the device on the office server.

3. **Local on This PC**
   - Create local authority.
   - Create local PostgreSQL database.
   - Create local system admin.
   - Configure backup location.
   - Import/apply offline license.

### 5.2 Promote Local to Office Server

Path: **Settings -> Deployment -> Share on LAN / Promote to Office Server**

The wizard must verify:

- License allows LAN mode.
- Automatic backups are configured and healthy.
- Local service can run as a background server.
- PostgreSQL is accessible to the service.
- Firewall/network port is intentionally opened.
- Device approval is enabled.
- Admin understands that this PC/server is now the tenant authority for all LAN clients.

### 5.3 Connect Another PC

1. Install ERP03 Desktop on Sales/Accounting/Warehouse PC.
2. Choose **Connect to Office Server**.
3. Enter server address or discovery code.
4. Client displays approval code.
5. Local System Admin approves device.
6. User logs in with local identity.
7. Client works against the same local authority and database.

---

## 6. Phased Implementation Plan

### Phase 0 — Documentation and Architecture Lock

**Estimate:** 1-2 days  
**Status:** This task creates the initial docs.

Deliverables:
- Architecture docs for deployment modes, desktop shell, and local authority/migration.
- User-facing guide for selecting deployment mode.
- This numbered execution plan.

Acceptance:
- Docs clearly separate desktop UI from data authority.
- Docs clearly state that Local on This PC is private by default.
- Docs mark the whole epic as post-pilot.

### Phase 1 — Desktop Shell Spike

**Estimate:** 3-5 days

Goal: Decide Tauri vs Electron with evidence.

Scope:
- Build a throwaway desktop shell spike.
- Load current ERP03 frontend.
- Test connection profile storage.
- Test local dev cloud/backend URL connection.
- Test print/export/file dialog feasibility.
- Test startup, app icon, title, and basic packaging.

Decision default:
- Prefer Tauri if it supports the required ERP workflows.
- Use Electron only if Tauri blocks core desktop needs.

Acceptance:
- Written spike report.
- Recommendation with tradeoffs.
- No production desktop code merged unless chosen deliberately.

### Phase 2 — Production MDI Workspace

**Estimate:** 2-3 weeks

Goal: Turn current Windows Mode into a reliable desktop workspace.

Implementation areas:
- Harden `WindowManagerContext`.
- Standardize MDI open behavior for vouchers, invoices, reports, master cards, and drilldowns.
- Add safe restore and per-user named layouts.
- Add local autosave drafts.
- Add window controls: cascade, tile, snap, close all, close others.
- Ensure Classic and Windows Mode call the same business actions.

Acceptance:
- User can create a voucher, keep it open, open reports/cards, return to voucher, then post.
- Dirty-window guards work.
- Draft recovery works after app restart/refresh.
- Named layouts work per user.
- No accounting action exists only in one UI mode.

### Phase 3 — SQL Parity Gate

**Estimate:** 3-5 weeks

Goal: Make PostgreSQL a real backend for the launch modules.

Scope:
- Complete Prisma repository parity for:
  - Accounting
  - Inventory
  - Sales
  - Purchases
  - Core users/company/settings/RBAC
  - Form/designer metadata needed by native documents
- Add SQL test coverage for critical flows.
- Add SQL drift-control checks so Firestore repositories do not advance without SQL parity.

Acceptance:
- `DB_TYPE=SQL` supports the launch ERP flows.
- Voucher posting, invoice posting, stock movements, reports, permissions, settings, and master data work on SQL.
- Firestore and SQL produce equivalent results for critical accounting/inventory flows.
- SQL parity gaps are blockers, not optional TODOs.

### Phase 4 — Local Backend Service and PostgreSQL Packaging

**Estimate:** 2-3 weeks

Goal: Package local/LAN authority.

Scope:
- Local backend runs as a background service.
- Support installer-managed PostgreSQL.
- Support external PostgreSQL for IT-managed installs.
- Add health checks for service, database, migrations, license, backups, and authority identity.
- Add connection profiles to desktop app.

Acceptance:
- Standalone install works without internet.
- LAN server can accept approved devices.
- Health screen clearly shows readiness and failures.
- Authority can post locally when local backend is reachable.

### Phase 5 — License, Device Trust, Backups, Updates, Support

**Estimate:** 2-3 weeks

Scope:
- Signed offline license file.
- Local System Admin role.
- Device approval flow using approval code.
- Automatic encrypted backups.
- Backup-now and restore validation.
- Signed update packages.
- Support bundle export with sanitized diagnostics.

Acceptance:
- Expired license enters read-only grace; posting is blocked after grace rules.
- New LAN device cannot connect until approved.
- Repeated backup failure escalates and blocks update/migration.
- Support bundle contains no secrets.

### Phase 6 — Queued Posting Intents

**Estimate:** 1-2 weeks

Goal: Support disconnected clients without corrupting accounting.

Scope:
- Add client-side/server-side concept of queued posting intent.
- Queue only when selected authority is unreachable.
- Keep official balances unchanged.
- Retry when authority returns.
- Failed queued posting returns to user queue with exact validation reason.

Acceptance:
- Cloud client offline can draft and queue, but reports remain official-only.
- LAN client disconnected from server can draft and queue, but reports remain official-only.
- Standalone with local backend reachable posts immediately.
- Failed validations are visible and actionable.

### Phase 7 — One-Way Cloud Migration

**Estimate:** 2-4 weeks

Goal: Move a local/LAN tenant to cloud safely.

Scope:
- Local export package.
- Cloud import validator.
- Authority transfer metadata.
- All-or-nothing import.
- Local read-only migrated state.

Acceptance:
- Migration preserves Trial Balance, AR/AP, inventory valuation, documents, attachments, users, roles, permissions, audit logs, and number sequences.
- Import rejects duplicate authority/company ownership.
- Local install is marked migrated/read-only after successful import.

---

## 7. Security and Operations Requirements

### Local System Admin

Dedicated role, separate from normal company users.

Can:
- Change deployment mode.
- Register/revoke devices.
- Import updates.
- Restore backups.
- Run migration/export.
- Manage license.

Cannot bypass accounting rules unless separately granted accounting permissions.

### Device Trust

LAN clients must be registered:

- Client shows approval code.
- Local System Admin approves.
- Server records device id, user, last seen, and revocation state.

### Backups

Required for Local and Office Server:

- Automatic encrypted backups.
- Configurable storage location.
- Default managed local file store.
- Optional network storage for IT-managed LAN.
- Restore validation.
- Backup includes DB, attachments, license metadata, authority metadata, and migration metadata.

### Updates

Updates use signed packages:

- Verify signature.
- Backup before update.
- Run migrations.
- Validate schema/version.
- Abort safely on failure.

---

## 8. Test Matrix

### Deployment

- Cloud install connects to cloud tenant.
- Local on This PC creates private local authority.
- Office Server accepts only approved devices.
- Local promotion to Office Server requires backup, license, service, and device approval.

### Accounting

- Standalone posts voucher with no internet.
- LAN client posts through office server with no internet.
- Cloud client cannot officially post when cloud unreachable.
- Queued posting does not affect Trial Balance.
- Failed queued posting returns validation reason.

### Inventory

- Stock adjustment/transfer posts through selected authority only.
- Official stock levels exclude queued posting intents.
- Migration preserves inventory valuation.

### Security

- Unapproved LAN device cannot connect.
- Revoked device loses access.
- Local System Admin can manage deployment but cannot bypass accounting permissions.
- Support bundle contains no secrets.

### Migration

- Local export/import preserves balances, documents, attachments, users, roles, permissions, audit logs, and numbering.
- Cloud import rejects duplicate authority ownership.
- Local install becomes read-only after migration.

---

## 9. Explicit Non-Goals

- No continuous cloud/local sync in the first release.
- No branch-by-branch independent authorities in the first release.
- No last-write-wins conflict handling for financial data.
- No frontend-only posting.
- No desktop-only business logic.
- No POS hardware as a blocker for the first desktop/local release.
- No real OS multi-window/multi-monitor support in the first desktop shell; MDI comes first.

---

## 10. Next Step When Resumed

After v0.9-alpha pilot stabilization, start with **Phase 1 Desktop Shell Spike** and **Phase 3 SQL parity audit** in parallel planning, but do not implement local authority until SQL parity is proven.

