# API Idempotency

**Last updated:** 2026-05-19
**Status:** Implemented as opt-in (warn-only) for posting endpoints in PR4 of the alpha-readiness plan.

---

## Purpose

Posting endpoints in Sales, Purchases, and Inventory create vouchers, stock movements, and AR/AP balances. Without idempotency, a double-click or a retried network request can produce duplicate vouchers — silently corrupting books.

Idempotency lets the client safely retry the same operation. The server detects the retry and replays the original response without re-running the business logic.

## Contract

Clients SHOULD send an `Idempotency-Key` header on POSTs to sensitive endpoints. The key is a client-generated string (UUID recommended, max 255 chars) that uniquely identifies one *attempt* of an operation.

- **First call with a new key** → endpoint runs; the response (status + body) is cached under `companies/{companyId}/idempotency_keys/{key}` for 24h.
- **Retry with the same key + same body** → server replays the cached response. Business logic does **not** run again.
- **Retry with the same key + a different body** → server responds `409 Conflict` with code `IDEMPOTENCY_KEY_CONFLICT`. The key is treated as already-consumed.
- **Missing header** → today the server logs a warning and proceeds (warn-only mode). A future PR will flip this to enforce (`400 IDEMPOTENCY_KEY_REQUIRED`).

The body hash is SHA-256 over the JSON-stringified request body.

## Endpoints with idempotency middleware applied

Wired in PR4. Eight endpoints, all routes carrying business-state mutation through the posting engine:

Sales:
- `POST /tenant/sales/delivery-notes/:id/post`
- `POST /tenant/sales/invoices/create-and-post`
- `PUT /tenant/sales/invoices/:id/update-and-post`
- `POST /tenant/sales/invoices/:id/post`
- `POST /tenant/sales/invoices/:id/record-payment`
- `POST /tenant/sales/returns/:id/post`

Purchases:
- `POST /tenant/purchases/goods-receipts/:id/post`
- `POST /tenant/purchases/invoices/create-and-post`
- `PUT /tenant/purchases/invoices/:id/update-and-post`
- `POST /tenant/purchases/invoices/:id/post`
- `POST /tenant/purchases/invoices/:id/record-payment`
- `POST /tenant/purchases/returns/:id/post`

Unpost endpoints intentionally do **not** carry idempotency — unposting is rare, manual, and already protected by per-document status checks.

## Storage

`companies/{companyId}/idempotency_keys/{key}` (Firestore-only — SQL parity not needed). Each record holds:
- `key`, `companyId`, `method`, `path`, `bodyHash`
- `statusCode`, `responseBody` (the full JSON the server sent back)
- `createdAt`, `expiresAt` (createdAt + 24h)

Lazy expiry: `get()` filters out records past `expiresAt`. In production, configure a Firestore TTL policy on the `expiresAt` field so old records get deleted.

## Implementation

- Middleware: [`backend/src/api/middlewares/idempotencyMiddleware.ts`](../../backend/src/api/middlewares/idempotencyMiddleware.ts)
- Repository: [`backend/src/infrastructure/firestore/repositories/system/FirestoreIdempotencyKeyRepository.ts`](../../backend/src/infrastructure/firestore/repositories/system/FirestoreIdempotencyKeyRepository.ts)
- Interface: [`backend/src/repository/interfaces/system/IIdempotencyKeyRepository.ts`](../../backend/src/repository/interfaces/system/IIdempotencyKeyRepository.ts)
- Entity: [`backend/src/domain/system/entities/IdempotencyKey.ts`](../../backend/src/domain/system/entities/IdempotencyKey.ts)
- Tests: [`backend/src/tests/api/middlewares/idempotencyMiddleware.test.ts`](../../backend/src/tests/api/middlewares/idempotencyMiddleware.test.ts) (7 cases)

The middleware wraps `res.json` to capture the response after the handler runs. Persistence is best-effort (not awaited) — a Firestore write failure logs a warning but does not block the user-facing response. This is correct because the worst case is a second retry running the business logic again, which is the pre-PR4 baseline.

## Client guidance

Always generate a fresh key per *intent*, not per retry:

```js
// Good — same key for the same intent, retried as many times as needed
const key = crypto.randomUUID();
await fetch('/tenant/sales/invoices/abc/post', {
  method: 'POST',
  headers: { 'Idempotency-Key': key },
  body: JSON.stringify({ /* ... */ })
});

// Bad — new key on each retry defeats the protection
async function postWithRetry() {
  while (true) {
    const key = crypto.randomUUID();  // ← do not generate inside the loop
    // ...
  }
}
```
