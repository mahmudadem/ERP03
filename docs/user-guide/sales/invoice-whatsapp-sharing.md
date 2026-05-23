# Send Sales Invoices via WhatsApp

This guide explains how to share a posted Sales Invoice directly from ERP03 using WhatsApp.

---

## Who can use this

Users who can open posted Sales Invoices and use invoice actions in Sales.

---

## Before you start

1. Your company admin must configure at least one active WhatsApp sender account in `Sales -> Settings -> Communications`.
2. The sender account must include:
   - account label
   - Meta phone number ID
   - access token credential
2. The invoice must be **POSTED** (draft invoices cannot be sent).
3. Use recipient phone format with country code (E.164), for example: `+905551112233`.

---

## Steps

1. Open a posted invoice in `Sales -> Invoices`.
2. Click **Send via WhatsApp**.
3. Select sender account (or keep default sender).
4. Confirm or edit:
   - recipient phone
   - optional document URL
   - message text
5. Click **Send**.
6. If successful, you will see a confirmation with the WhatsApp message ID.

---

## Notes

- If a customer phone exists, it is prefilled automatically.
- One company can maintain multiple sender accounts and choose one at send time.
- Default sender can be configured per channel from Sales settings.
- Document URL is optional. If provided, it is included in the message.
- If phone format is invalid, ERP03 blocks sending and asks for a valid E.164 number.

---

## Troubleshooting

- **"Only posted sales invoices can be sent"**: post the invoice first.
- **"Selected WhatsApp sender account is not available or is missing credentials"**: ask company admin to fix the account in `Sales -> Settings -> Communications`.
- **Phone validation error**: include `+` and country code.
- **Provider authentication/config error**: ask your admin to verify WhatsApp Cloud API credentials.
- **Rate limit error**: wait a moment and retry.
