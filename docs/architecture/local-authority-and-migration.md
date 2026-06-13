# Local Authority and Migration Architecture

> **Status:** Post-pilot architecture plan  
> **Created:** 2026-06-13  
> **Related plan:** `planning/tasks/222-desktop-offline-lan-architecture.md`

Local/LAN support must treat the customer-controlled backend as a real ERP authority, not a cache.

---

## Authority Model

An authority is the backend/database instance that owns official ERP state for a tenant.

Authority types:

- `CLOUD`
- `LAN`
- `STANDALONE`

Each authority needs:

- stable `authorityId`
- tenant id
- owned company ids
- schema version
- migration state
- sequence ranges
- license state
- public verification metadata

Official accounting and inventory records must include authority metadata so migration and audit can prove where the record was created and posted.

---

## SQL Requirement

Local/LAN authority uses PostgreSQL.

ERP03 already has Prisma repository work and a `DB_TYPE` repository switch. The local authority project must complete that path before offline/LAN release.

Required SQL parity:

- Accounting
- Inventory
- Sales
- Purchases
- Core users/company/settings/RBAC
- Forms/designer metadata required by native documents
- Attachments metadata
- Audit logs

Firestore and SQL must match critical business behavior. SQL parity gaps are blockers.

---

## Local Posting

If the local backend is reachable, it can post even without internet.

That applies to:

- Local on This PC
- Office Server / LAN

Posting still goes through backend policy:

- voucher balance checks
- posting gateway
- approval policy
- period locks
- account validation
- stock valuation and negative-stock policy
- tax and currency validation
- audit logging

The frontend cannot post directly.

---

## Queued Posting Intents

Queued posting exists only when a client cannot reach its selected authority.

Queued posting behavior:

- user clicks Post while disconnected
- UI records a posting intent
- document status shows Queued for Posting
- official balances and stock do not change
- authority validates later
- success turns it into a real posting
- failure returns it to the queue with exact validation reason

Queued posting is not a local accounting shortcut.

---

## Local System Admin

Local authority needs a technical admin role separate from normal company users.

Local System Admin can:

- register and revoke LAN devices
- manage license file
- configure backups
- import signed update packages
- run restore validation
- run export/migration
- change deployment settings

This role does not bypass accounting permissions by default.

---

## Device Trust

LAN clients must be approved.

Flow:

1. Desktop client selects Connect to Office Server.
2. Client displays approval code.
3. Local System Admin approves the device.
4. Server stores device id, user, last seen, and revocation state.

Unapproved or revoked devices cannot access local tenant data even with user credentials.

---

## Backups

Backups are mandatory for Local and Office Server.

Backup package includes:

- PostgreSQL data
- file/attachment storage
- license metadata
- authority metadata
- migration metadata
- schema version

Storage:

- default managed local folder
- optional network storage for IT-managed LAN installs

Failure policy:

- warn first
- escalate after repeated failures
- block updates and migration
- require admin acknowledgement before risky posting continues

---

## License

Local/LAN mode uses signed offline license files.

License contains:

- tenant/customer identity
- enabled modules and capabilities
- company/user limits
- allowed deployment modes
- expiry/support period
- signature/key version

Expiry behavior:

- read-only grace period
- viewing, export, and backup remain available
- posting is blocked after expiry/grace rules

---

## Updates

Updates use signed packages.

Update process:

1. verify package signature
2. run backup-before-update
3. check current schema version
4. run migrations
5. validate service health
6. rollback/abort safely on failure

Do not allow silent schema changes on local accounting data.

---

## One-Way Cloud Migration

First migration support is local/LAN to cloud.

Export validation must check:

- authority id and tenant ownership
- schema version
- license compatibility
- users, roles, and permissions
- voucher sequences and document numbers
- posted ledger integrity
- stock valuation integrity
- attachments
- audit logs

Cloud import must be all-or-nothing.

After successful import:

- cloud becomes authority
- local install is marked migrated/read-only
- local admin may export/backup/view but not continue posting into the migrated authority

Continuous bidirectional sync is explicitly out of scope for the first release.

