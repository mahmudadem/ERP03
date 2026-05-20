# Architecture: Salespersons and Commission Ledger

**Last updated:** 2026-05-20
**Status:** Phase A complete. Salesperson master data, commission entry ledger, and all use cases are live. GL integration for commission payment is deferred (see Follow-ups).

---

## Why this exists

Sales-based commissions require two things the rest of the system does not provide: a salesperson master record that can be attached to documents, and an immutable ledger of earned-but-unpaid commission obligations. The `CommissionEntry` ledger handles the second: each posted sales invoice that has a salesperson generates exactly one entry whose rate is frozen at accrual time, so later changes to the salesperson's commission percentage do not retroactively alter past obligations.

---

## Salesperson entity

**File:** `backend/src/domain/sales/entities/Salesperson.ts`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Auto-generated |
| `companyId` | string | Tenant scoping |
| `code` | string | Short human identifier, required |
| `name` | string | Display name, required |
| `email` | string (optional) | |
| `defaultCommissionPct` | number | 0–100 inclusive; the rate applied at accrual time |
| `commissionPayableAccountId` | string (optional) | GL account for commission payable (used in a future GL post) |
| `status` | `ACTIVE` \| `INACTIVE` | Accrual throws if status is `INACTIVE` |

Salesperson records are company-scoped. A salesperson can be soft-inactivated without deleting their commission history — their past entries remain, but new accruals are blocked.

---

## CommissionEntry entity (the ledger)

**File:** `backend/src/domain/sales/entities/CommissionEntry.ts`

Each `CommissionEntry` is an immutable ledger record created once and then transitioned through a lifecycle. All identifying fields are `readonly`.

### Fields

| Field | Type | Notes |
|---|---|---|
| `salespersonId` | string | FK to Salesperson |
| `sourceType` | `'SALES_INVOICE'` | Extensible — SO / SR to be added later |
| `sourceId` | string | The source document's id |
| `sourceNumber` | string | Human-readable number (e.g., `SI-2026-001`) |
| `customerId` | string | Customer on the source invoice |
| `customerName` | string | Snapshotted at accrual |
| `invoiceDate` | string (YYYY-MM-DD) | From the source document |
| `baseAmount` | number | ≥ 0; see accrual formula |
| `commissionPct` | number | 0–100; frozen snapshot of `Salesperson.defaultCommissionPct` at accrual time |
| `commissionAmountBase` | number | **Always recomputed** in the constructor; never trust a caller-supplied value |
| `currency` | string | Base currency code at accrual time |
| `status` | `CommissionStatus` | `ACCRUED` \| `PAID` \| `CANCELLED` |
| `accruedAt` | Date | |
| `paidAt` | Date (optional) | Set by `markPaid()` |
| `paymentReference` | string (optional) | |

### Accrual formula

```
commissionAmountBase = roundMoney(baseAmount × commissionPct / 100)
```

`baseAmount` is `invoice.grandTotalBase` — the full invoice value including tax, in base currency. This is the most intuitive commission basis in a B2B context: the salesperson is rewarded on what the customer was charged in full.

The formula is always executed in the constructor, regardless of whether a caller passes a pre-computed `commissionAmountBase`. This prevents any drift between the stored rate and the stored amount.

### Lifecycle and state transitions

```
ACCRUED  ──markPaid()──►  PAID
         ──cancel()────►  CANCELLED
```

Rules enforced by the entity:

- `markPaid()` throws if status is not `ACCRUED`. Only `ACCRUED` entries can be paid.
- `cancel()` throws if status is `PAID`. Paid commissions cannot be cancelled. (An `ACCRUED` entry can be cancelled.)
- No direct `PAID → CANCELLED` or `CANCELLED → *` transitions exist.

---

## AccrueCommissionForInvoiceUseCase

**File:** `backend/src/application/sales/use-cases/CommissionUseCases.ts`

This is the only write path that creates `CommissionEntry` records.

### Logic

1. Load the sales invoice. Throw if not found.
2. If `invoice.salespersonId` is absent → return `null` (no-op; not an error).
3. **Idempotency guard:** call `commissionEntryRepo.findBySource(companyId, 'SALES_INVOICE', invoiceId)`. If a record already exists, return it immediately without creating a duplicate. This makes re-running accrual after a crash safe.
4. Load the salesperson. Throw if not found.
5. Throw if `salesperson.status === 'INACTIVE'`.
6. Construct and persist a `CommissionEntry` using `invoice.grandTotalBase` as `baseAmount` and `salesperson.defaultCommissionPct` as the frozen rate.

The use case is idempotent by design: calling it twice for the same invoice is harmless.

### Accrual is controller-invoked, not part of the posting transaction

**This is a deliberate architecture decision.**

Commission accrual is called from the **API controller layer**, immediately after `PostSalesInvoiceUseCase` returns successfully — not from inside `PostSalesInvoiceUseCase` itself.

**Rationale:** `PostSalesInvoiceUseCase` is a large, sensitive use case that touches the ledger, inventory, and multiple repositories in a single Firestore transaction. Inserting commission accrual inside that transaction would:
- enlarge the blast radius of any accrual bug to include the posting path
- make the posting unit tests harder to reason about
- couple two logically separate concerns (invoice accounting vs. salesperson commission) at the wrong layer

Keeping accrual decoupled means a bug in accrual logic cannot roll back an otherwise-correct invoice post.

**Trade-off:** Because accrual is not inside the posting transaction, a process crash between "post succeeds" and "accrue runs" would leave an unaccrued commission. This is acceptable for pre-alpha:
- The idempotency guard (`findBySource`) means re-running `POST /commissions/accrue` for a posted invoice is always safe.
- An admin or a cron job can re-accrue any invoice that slipped through without double-counting.

The accrual endpoint is `POST /tenant/sales/commissions/accrue` and accepts `{ invoiceId }`. It is currently a manually-invoked API; the wiring to call it automatically after a post is a follow-up item (see below).

---

## All commission use cases

**File:** `backend/src/application/sales/use-cases/CommissionUseCases.ts`

| Use case | Purpose |
|---|---|
| `AccrueCommissionForInvoiceUseCase` | Create a commission entry for a posted SI (idempotent) |
| `MarkCommissionPaidUseCase` | Transition `ACCRUED → PAID`; records `paidAt` and optional reference |
| `CancelCommissionUseCase` | Transition `ACCRUED → CANCELLED` |
| `ListCommissionsUseCase` | List entries with optional filters (salesperson, status, date range) |
| `GetSalespersonCommissionTotalsUseCase` | Aggregate `{ accrued, paid, cancelled }` totals for a salesperson |
| `GetCommissionEntryUseCase` | Fetch a single entry by id |

---

## API endpoints

All under `/tenant/sales/` (router: `backend/src/api/routes/sales.routes.ts`):

| Method | Path | Action |
|---|---|---|
| POST | `/salespersons` | Create |
| GET | `/salespersons` | List |
| GET | `/salespersons/:id` | Get one |
| PUT | `/salespersons/:id` | Update |
| DELETE | `/salespersons/:id` | Delete |
| POST | `/commissions/accrue` | Accrue for an invoice (idempotent) |
| GET | `/commissions` | List entries |
| GET | `/commissions/totals/:salespersonId` | Aggregate totals |
| GET | `/commissions/:id` | Get one |
| POST | `/commissions/:id/mark-paid` | Mark paid |
| POST | `/commissions/:id/cancel` | Cancel |

Controller: `backend/src/api/controllers/sales/SalesMasterDataController.ts`

---

## Frontend

- **SalespersonsPage** — CRUD list/form for salesperson master data, under `frontend/src/modules/sales/pages/`.
- **SalesOrder + SalesInvoice forms** — gained a Salesperson dropdown that sets `salespersonId` on the document.
- Commission entries are visible but editing is limited to mark-paid and cancel transitions.

---

## Follow-ups

**(a) Auto-accrual wiring in the SI post controller is not yet done.**
The use case and endpoint exist and are correct. The controller-level call to `AccrueCommissionForInvoiceUseCase` after `PostSalesInvoiceUseCase` succeeds has not been added. Until it is, accrual must be triggered manually via `POST /commissions/accrue`. This is the highest-priority follow-up for commissions.

**(b) Accrual-on-payment mode is not implemented.**
The current model accrues commission when the invoice is posted, regardless of whether the invoice has been collected. Some businesses accrue commission only when cash is received. This mode is not modeled — only accrual-on-post exists today.

**(c) Marking commission paid does not post a GL voucher.**
`MarkCommissionPaidUseCase` transitions the status and saves the record. It does not create an accounting voucher (Dr Commission Expense / Cr Commission Payable). The `commissionPayableAccountId` on `Salesperson` is stored but not yet used. A follow-up should integrate with `PostVoucherUseCase` at the time of marking paid, similar to how receipt posting works for customer payments.

**(d) `CommissionEntry.sourceType` only supports `SALES_INVOICE`.**
The type is declared extensible (`// extensible — add SO/SR later`) but only `SALES_INVOICE` is implemented. Adding Sales Return reversals and Sales Order-based commission (before invoicing) requires extending this enum and the accrual use case.

---

## See also

- [`docs/architecture/sales.md`](./sales.md) — Sales module overview
- [`docs/architecture/pricing.md`](./pricing.md) — Price lists and customer segmentation
