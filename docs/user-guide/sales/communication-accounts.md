# Communication Sender Accounts

This guide explains how each company configures its own sender identities for outbound invoice sharing.

---

## Why this exists

ERP03 is multi-tenant. Each company should send customer messages from its own channels and credentials, not from a global shared account.

---

## Where to configure

`Sales -> Settings -> Communications`

---

## Supported account types

- WhatsApp (`META_WHATSAPP_CLOUD`) — send flow is live
- Telegram (`TELEGRAM_BOT`) — send flow is live
- Email (`SMTP`) — account model is ready, send flow deferred

---

## Add a WhatsApp sender account

1. Open `Sales -> Settings -> Communications`.
2. Click **Add WhatsApp Account**.
3. Fill:
   - **Account Label** (internal name, e.g., "Main Sales Number")
   - **Display Phone (E.164)** (e.g., `+905551112233`)
   - **Meta Phone Number ID**
   - **Credential / Access Token**
4. Mark account as **Active**.
5. Mark one account as **Default for this channel** (optional if only one account exists).
6. Click **Save**.

---

## Multi-account behavior

- A company can keep multiple active sender accounts per channel.
- Users can choose sender account when sending an invoice.
- If no account is chosen in the invoice modal, ERP03 uses the channel default.

---

## Security behavior

- Credentials are stored encrypted server-side.
- Existing credentials are never returned to the browser.
- To keep current credentials unchanged, leave the credential field blank when editing and save.
