# Deployment Mode

> **Status:** Future post-pilot feature plan  
> **Audience:** Company owners, local system admins, and implementation partners

ERP03 is currently a cloud SaaS product. A future desktop/local version will let a customer choose where their ERP data is stored and which backend is allowed to control posting.

---

## The Three Choices

### Cloud Company

Use this when you want ERP03 hosted in the cloud.

- Data is stored in ERP03 cloud.
- Users can sign in from anywhere with internet.
- ERP work requires internet.
- ERP03 cloud is the authority for posting, reports, users, and audit logs.

### Connect to Office Server

Use this when your company has one local server or office PC that should host ERP03 for the whole office.

- Data is stored on your local office server.
- Other PCs connect over the same network.
- ERP work can continue without internet.
- New devices must be approved by the Local System Admin.

This is the correct mode when Sales, Accounting, Warehouse, and management all need the same local data.

### Local on This PC

Use this when only one computer should use the local ERP data.

- Data is stored on this computer.
- ERP work can continue without internet.
- Other PCs cannot connect by default.
- This computer is private unless promoted to Office Server mode.

---

## Important: Local Is Not Automatically Shared

Choosing **Local on This PC** does not mean other company devices can connect to your data.

If another department or PC needs access, the Local System Admin must run:

**Settings -> Deployment -> Share on LAN / Promote to Office Server**

That wizard checks backups, license, service health, network settings, and device approval.

---

## What Happens If You Lose Connection?

It depends what you lost connection to.

| Situation | What you can do |
|---|---|
| Cloud mode loses internet | Continue drafts and queue posting intents; official posting waits for cloud |
| Office Server mode loses internet but LAN server works | Continue ERP work normally |
| Office Server mode cannot reach LAN server | Continue drafts and queue posting intents; official posting waits for server |
| Local on This PC loses internet | Continue ERP work normally because local backend is still available |

Queued posting is not the same as posted. Reports, stock levels, ledger balances, AR/AP, and taxes update only after the authority accepts the posting.

---

## Internet Services in Local Mode

Local data mode does not mean you cannot use internet services.

If configured by an admin, local/LAN users may still use:

- email sending
- WhatsApp or Telegram delivery
- AI providers
- update package downloads
- support bundle upload

ERP03 should clearly label which actions are local, which require internet, and which are cloud-only.

---

## Who Manages Local or Office Server Mode?

A future local/LAN deployment has a **Local System Admin**.

This admin can:

- approve new devices
- configure backups
- import license files
- apply signed updates
- run migration/export
- manage deployment settings

This is a technical role. It does not automatically give permission to bypass accounting controls.

---

## Moving to Cloud Later

The first planned cloud move is one-way migration:

1. Export the local company/tenant data.
2. Import it into ERP03 cloud.
3. Cloud becomes the new authority.
4. The local installation becomes read-only for that migrated data.

Switching back and forth between local and cloud is not part of the first release because it creates serious accounting and inventory conflict risks.

