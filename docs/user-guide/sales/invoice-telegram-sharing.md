# Send Sales Invoices via Telegram

This guide explains how to share a posted Sales Invoice directly from ERP03 using Telegram.

---

## Who can use this

Users who can open posted Sales Invoices and use invoice actions in Sales.

---

## Before you start

1. Your company admin must configure at least one active Telegram sender account in `Sales -> Settings -> Communications`.
2. The sender account must include:
   - account label
   - bot credential token
3. The invoice must be **POSTED** (draft invoices cannot be sent).
4. You must know the recipient destination:
   - Telegram `chat_id` (numeric), or
   - Telegram username in `@username` format.

---

## Steps

1. Open a posted invoice in `Sales -> Invoices`.
2. Click **Send via Telegram**.
3. Select sender account (or keep default sender).
4. Enter recipient `chat_id` or `@username`.
5. Confirm or edit:
   - optional document URL
   - message text
6. Click **Send**.
7. If successful, you will see a confirmation with the Telegram message ID.

---

## Notes

- One company can maintain multiple Telegram sender accounts and choose one at send time.
- Document URL is optional. If provided, it is included in the message text.
- Telegram username must start with `@`.

---

## Troubleshooting

- **"Only posted sales invoices can be sent via Telegram"**: post the invoice first.
- **"Telegram chat id or username is required"**: enter a numeric `chat_id` or `@username`.
- **"Telegram sender account is not available or is missing credentials"**: ask company admin to fix the account in `Sales -> Settings -> Communications`.
- **Provider authentication/config error**: verify the Telegram bot token credentials.
- **Rate limit error**: wait a moment and retry.

