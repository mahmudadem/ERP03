# Per-Form Settings

## Purpose

Form settings are company-scoped defaults attached to the actual form a user opens, not only to the business document type.

This matters because multiple forms can create the same document kind. For example, the native Sales Invoice form, a Wholesale Sales Invoice clone, and a Retail Sales Invoice clone can all create sales invoices while needing different default pricing behavior.

## Identity Model

There are two supported identities:

| Form kind | Identity | Example |
|---|---|---|
| Built-in native form | `builtInFormKey` | `native.sales.invoice` |
| Form Designer form | `formId` | `form_...` |

Each settings record also stores:

- `companyId`
- `module`
- `documentKind`
- `formKind`
- `settings`

The settings payload is namespace-based so future tabs can be added without changing the table/collection shape:

```ts
{
  accountDefaults: {
    defaultWarehouseId?: string | null;
    defaultCashAccountId?: string | null;
    defaultCostCenterId?: string | null;
  },
  pricingBehavior: {
    linePriceSource?: 'PRICE_LIST' | 'LAST_PARTY_PRICE' | 'LAST_EVENT' | 'ITEM_DEFAULT' | null;
  }
}
```

## Storage

Firestore stores settings under the module settings area:

```text
companies/{companyId}/{module}/Settings/formSettings/{settingsId}
```

SQL stores the same records in the existing JSON-backed `company_module_settings` model using reserved `moduleId = form_settings`. This avoids a schema migration for the first slice while keeping the repository contract DB-agnostic.

Repository contract:

- `backend/src/repository/interfaces/designer/IFormSettingsRepository.ts`
- Firestore: `backend/src/infrastructure/firestore/repositories/designer/FirestoreFormSettingsRepository.ts`
- Prisma: `backend/src/infrastructure/prisma/repositories/designer/PrismaFormSettingsRepository.ts`
- Use case: `backend/src/application/designer/use-cases/FormSettingsUseCases.ts`

## API

The existing voucher form controller exposes form-settings endpoints under each module route:

```text
GET /tenant/{module}/voucher-form-settings
GET /tenant/{module}/voucher-form-settings/one
PUT /tenant/{module}/voucher-form-settings
```

Accounting routes keep their existing designer permission guards. Sales and Purchase routes sit behind their module initialization middleware, matching the current voucher-form write routes.

## Frontend

Forms Management now lists built-in/native forms alongside Form Designer forms.

File:

- `frontend/src/modules/shared/pages/VoucherDesignerPage.tsx`

Each form row has a Settings action. Built-in/native rows are not layout-editable and cannot be cloned, but they can open Form Settings.

The Form Settings modal uses vertical tabs:

1. Account Defaults
2. Pricing Behavior

The Account Defaults tab persists safe values but does not yet push hidden account defaults into posting-sensitive document fields. Account defaults must remain visible on the document and pass normal validation before they are used in posting.

Pricing Behavior is applied in:

- Native Sales Invoice: `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`
- Native Purchase Invoice: `frontend/src/modules/purchases/pages/PurchaseInvoiceDetailPage.tsx`
- Form Designer renderer: `frontend/src/modules/accounting/components/shared/GenericVoucherRenderer.tsx`

## Pricing Precedence

For line price source:

```text
Manual line edit
  > per-document/session override (future Task 243-C)
  > per-form pricing behavior (Task 243-B)
  > company default InventorySettings.defaultLinePriceSource
```

Task 243-B only adds the per-form default. It does not implement the right-click per-document override.

## Clone Behavior

When a persisted Form Designer form is cloned through the backend clone endpoint, the source form settings are copied to the clone. The clone can then be edited independently.

Built-in/native forms are not cloned by this slice.

## Accounting Boundary

This feature is a defaults and UX control feature. It does not change:

- ledger posting,
- voucher approval,
- period-lock checks,
- AR/AP balances,
- tax calculation,
- inventory valuation,
- stock movement posting.

Pricing defaults only influence suggested line prices on new drafts. If a selected strict source has no match, Task 242 behavior still applies: the price remains blank/manual instead of falling back to another source.
