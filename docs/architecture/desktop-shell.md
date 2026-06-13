# Desktop Shell Architecture

> **Status:** Post-pilot architecture plan  
> **Created:** 2026-06-13  
> **Related plan:** `planning/tasks/222-desktop-offline-lan-architecture.md`

ERP03's desktop work has two layers:

1. **Desktop shell** — installable app, connection profile, native integrations.
2. **Desktop workspace** — in-app MDI window management for ERP work.

The current web application already has a Windows Mode / MDI concept, but it is not a production desktop application and it is not a local backend.

---

## Product Goal

Desktop users should be able to work like a traditional ERP power user:

- create a voucher
- keep it open
- open a report
- inspect a customer, item, warehouse, or account
- return to the voucher
- post when ready

This is a workflow requirement, not just styling.

---

## Shell Technology

The project should run a post-pilot spike comparing Tauri and Electron.

Default preference:

- Prefer Tauri if it supports ERP03's packaging, native dialogs, printing, update checks, and service health needs.
- Use Electron only if Tauri blocks core workflows.

The spike must test:

- app install/start on Windows
- loading the ERP frontend
- connection profile storage
- cloud/LAN/local URL switching
- file save/open dialogs
- print/export feasibility
- app icon/title
- packaging and update implications

---

## First Launch Flow

After installing ERP03 Desktop, the app asks:

**How do you want to run ERP03?**

1. **Cloud Company**
   - Connect to ERP03 cloud.

2. **Connect to Office Server**
   - Enter server address or pairing code.
   - Device receives approval code.
   - Local System Admin approves it.

3. **Local on This PC**
   - Create local authority.
   - Initialize local backend service and PostgreSQL.
   - Create Local System Admin.
   - Configure backups and license.

---

## MDI Workspace

The first production desktop release should use in-app MDI, not separate OS windows.

Required capabilities:

- open windows for vouchers, invoices, reports, master cards, and drilldowns
- minimize, maximize, restore, close
- move and resize
- cascade, tile, snap left/right
- close all / close others
- taskbar/window switcher
- document status indicators
- per-user named layouts
- safe session restore
- autosaved drafts
- dirty-window guards

Named layout examples:

- Sales Entry
- Accounting Review
- Month-End Close
- Inventory Review

---

## Session Restore

The desktop workspace should restore safe work only:

- reports
- lists
- non-sensitive cards
- recoverable drafts

It must not silently restore sensitive action dialogs or assume a previously open posting/approval modal is still valid. Sensitive actions require current authority validation.

---

## Draft Autosave

Voucher and invoice draft work should be protected:

- autosave working drafts locally/server-side
- recover after app crash or restart
- show clear recovered-draft state
- preserve dirty-window guards

Autosaved drafts are not official accounting records until saved/posted through the selected authority.

---

## Real OS Windows

Real operating-system windows and multi-monitor workflows are later roadmap.

Do not make them part of the first desktop shell acceptance criteria. Build the in-app MDI workspace first, then add OS windows only for selected power-user workflows if needed.

---

## Native Integrations Backlog

After the shell and authority model are stable:

- native print and print preview
- PDF/Excel save dialogs
- backup/restore UI
- barcode scanner support
- receipt printer and cash drawer
- native notifications
- support bundle export
- signed update package import

POS hardware should not block the first desktop/local release.

