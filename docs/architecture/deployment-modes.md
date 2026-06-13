# Deployment Modes Architecture

> **Status:** Post-pilot architecture plan  
> **Created:** 2026-06-13  
> **Related plan:** `planning/tasks/222-desktop-offline-lan-architecture.md`

ERP03 must support desktop usage without splitting the product into separate desktop and cloud ERPs. The product has one business logic layer and multiple deployment modes.

---

## Core Concepts

### Desktop Shell

The desktop shell is only the installed user interface. It may connect to cloud, Office Server, or Local on This PC.

### Authority

The authority is the backend/database allowed to create official ERP state:

- voucher posting
- invoice posting
- stock movement posting
- number assignment
- approvals
- period-lock enforcement
- audit logging
- official reports

Only the selected authority may produce official accounting or inventory effects.

### Connectivity

Connectivity is separate from authority mode:

- internet available/unavailable
- selected authority reachable/unreachable

This distinction matters because a local authority can work without internet, while a cloud authority cannot.

---

## Supported Modes

| Mode | Authority | Backend | Database | Other devices | Internet needed for ERP work |
|---|---|---|---|---|---|
| Cloud | ERP03 cloud | Hosted backend | Hosted DB | Yes, through cloud login | Yes |
| Office Server / LAN | Customer office server | Local service | Local PostgreSQL | Yes, approved LAN clients | No |
| Local on This PC | One PC | Same PC service | Same PC PostgreSQL | No by default | No |

---

## Local on This PC Is Private

Local on This PC must bind to the local machine by default. It should not expose ports to the office network and should not let other devices connect automatically.

If the user wants Sales, Accounting, Warehouse, or another PC to use the same local data, the installation must be promoted to **Office Server / LAN** through a setup wizard.

That promotion is required because shared local data changes the control model:

- one machine becomes the tenant authority
- backups become more critical
- firewall/network settings must be intentional
- devices must be approved
- multiple users can post into the same books

---

## Office Server / LAN

Office Server / LAN means one customer-controlled machine hosts:

- ERP03 backend service
- PostgreSQL
- local file/attachment storage
- license enforcement
- backup jobs
- device approval
- health checks

Other desktop clients connect to that server over the local network after approval.

This is the correct mode for a company where multiple departments share one local database.

---

## Disconnected Behavior

If a desktop client cannot reach its selected authority:

- users may continue drafting
- users may press Post, but this creates a queued posting intent
- queued intents do not affect official reports, stock levels, ledger, AR/AP, tax, or balances
- when the authority returns, the queued intent is submitted
- if validation fails, the queue item returns with the exact reason

If the authority is reachable but internet is unavailable:

- local/LAN ERP work continues normally
- internet services such as email, AI, WhatsApp, Telegram, or update downloads may queue or fail gracefully depending on the integration

---

## External Services in Local Mode

Local authority does not mean air-gapped.

Customers may keep their ERP database local while still using internet-connected services if the admin configures them:

- AI providers
- SMTP/email
- WhatsApp/Telegram providers
- update downloads
- license packages
- support bundle upload

The UI must label external-service actions clearly as:

- Local
- Requires Internet
- Cloud-only

---

## Data Ownership

Each authority owns its tenant/company data until migration.

The first migration model is one-way:

1. Local/LAN exports a validated package.
2. Cloud imports it.
3. Cloud becomes authority.
4. Local installation becomes read-only unless explicitly reinitialized as a new authority.

Continuous cloud/local sync is a future design, not part of the first desktop/local release.

---

## Accounting Controls

Deployment mode must not weaken accounting.

All modes must enforce:

- balanced vouchers
- period locks
- approval workflow
- posting policy
- account validation
- tax and currency validation
- stock costing and negative-stock policy
- audit logging
- tenant/company isolation

The frontend must never become the source of official posting truth.

