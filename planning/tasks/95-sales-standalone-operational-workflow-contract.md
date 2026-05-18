# Task 95 - Sales Standalone / Simple / Operational Workflow Contract

**Status:** Implemented and documented - manual QA pending  
**Created:** 2026-05-17  
**Owner:** CTO agent  
**Estimate:** 1.5-2.5 days implementation after approval  
**Scope:** Sales module workflow contract, form behavior, hidden Accounting/Inventory engine compatibility  

---

## Executive Decision

Do not force every Sales customer to use visible Accounting.

The market-standard model for ERP03 is:

- **Sales Standalone** means Sales is the visible app. Accounting and Inventory may still run as hidden engines.
- **Sales Simple** means direct invoicing workflow.
- **Sales Operational** means Sales Order -> Delivery Note -> Sales Invoice.

These are different dimensions and must not be mixed.

### Governance clarification added on 2026-05-18

Workflow mode is not just cosmetic.

The intended rule is:

- **Company SIMPLE**: direct invoicing is the default; operational documents may still be used.
- **Company OPERATIONAL**: direct invoicing is blocked by default.
- **Branch/form governance** may explicitly re-enable direct invoicing for approved contexts such as retail/POS branches inside an otherwise operational company.

So the final architecture rule is:

> Global OPERATIONAL blocks direct invoicing by default.  
> Branch/form governance may explicitly allow direct invoicing for approved retail/store contexts.

## Progress Update - 2026-05-17

Completed in backend:

- Added canonical line discount support for Sales Invoices.
- Added document-level charges with optional tax.
- Updated Sales invoice totals so subtotal/tax/grand total include discounted lines plus charges.
- Updated Sales invoice posting so:
  - line discounts reduce posted revenue,
  - charges post as revenue,
  - charge tax posts into sales tax payable.
- Added Sales payment method mapping in Sales settings so settlement flows can resolve hidden accounts from `paymentMethod` without forcing raw account IDs.
- Added focused tests for discount/charge totals and posting.
- Updated `sales_invoice_direct` UI to expose:
  - line discount type/value,
  - document charges,
  - pay-now settlement rows driven by Sales payment methods with optional raw-account override.
- Implemented operational linked-invoice sourcing from posted Delivery Note lines via a dedicated invoiceable-source endpoint.
- Updated architecture and end-user docs and created completion report `planning/done/98-sales-commercial-terms-and-linked-invoice-workflow.md`.

Still pending:

- Manual QA for:
  - direct invoice with discount/charge/pay-now
  - SO -> DN -> linked invoice
  - mixed stock/service orders
  - partial delivery / partial invoicing

---

## Three Separate Dimensions

| Dimension | Values | Meaning |
|---|---|---|
| Visible product/module mode | Sales standalone, Sales + Accounting, Sales + Inventory, Full ERP | What the user sees in navigation and settings |
| Sales workflow mode | SIMPLE, OPERATIONAL | Which Sales documents are used |
| Engine mode | Hidden Accounting/Inventory, visible Accounting/Inventory | Whether backend posting engines run behind Sales without exposing their UI |

Key rule: Sales Standalone can run either SIMPLE or OPERATIONAL.

---

## Target Workflow Matrix

| Context | User-visible documents | Hidden engine behavior | Hard limits |
|---|---|---|---|
| Sales Standalone + SIMPLE | Customers, Direct Sales Invoice, Sales Return, Payment/Cashbox views | Hidden accounting posts AR/revenue/receipt vouchers. Inventory decrements stock on invoice if stock is enabled. | One company/base currency. One default warehouse if stock is used. No chart of accounts UI. No exchange-rate management UI. No multi-warehouse transfers. |
| Sales Standalone + OPERATIONAL | Customers, Sales Order, Delivery Note, Sales Invoice, Sales Return, Payment/Cashbox views | Hidden accounting posts COGS on Delivery Note and revenue/AR on Invoice. Inventory movement happens on Delivery Note. | One company/base currency unless visible Accounting is enabled. Warehouse chosen on Delivery Note, not Invoice. Direct invoice blocked by default unless branch/form governance explicitly allows it. No full accounting reports. |
| Sales + visible Accounting + SIMPLE | Direct Sales Invoice plus accounting setup/reports | Same engine, but accounts and reports are visible | Multi-currency and accounting reports allowed if Accounting supports them. |
| Sales + visible Accounting + OPERATIONAL | Full SO -> DN -> SI plus accounting setup/reports | Same engine, visible accounting traceability | Advanced accounting, multi-currency, and detailed ledgers allowed. Direct invoice blocked by default unless branch/form governance explicitly allows it. |

---

## Document Contract

### Sales Order

Business meaning: customer commitment only.

Expected behavior:

- Does not move stock.
- Does not create accounting entries.
- Requires customer, date, item lines, ordered quantity, price, tax.
- Warehouse can be optional planning information only.
- In OPERATIONAL mode, confirmed Sales Orders feed Delivery Notes.

Current assessment:

- Backend concept is correct.
- Native UI allows optional warehouse on lines, which is acceptable as planning metadata.
- Forms catalog must contain a canonical `sales_order` system template.

### Delivery Note

Business meaning: physical stock movement.

Expected behavior:

- Required for stock items in OPERATIONAL mode.
- Requires warehouse because this document moves stock.
- Usually sourced from Sales Order.
- Posting creates stock OUT movement.
- In perpetual accounting mode, posting creates COGS / Inventory accounting effect.

Current assessment:

- Backend is aligned: `CreateDeliveryNoteUseCase` requires SO when Sales settings require it, and `PostDeliveryNoteUseCase` handles stock movement.
- Form profile is aligned: Delivery Note uses `HEADER_REQUIRED` warehouse policy.

### Sales Invoice - Direct

Business meaning: invoice is also the delivery event.

Expected behavior:

- Used in SIMPLE mode.
- Can also be allowed in OPERATIONAL mode only if governance explicitly allows direct invoicing.
- For stock lines, warehouse is required because invoice posting moves stock.
- For service-only invoices, warehouse must not be required.
- Posting creates AR / Revenue and, for stock lines without a prior Delivery Note, stock OUT + COGS.

Current assessment:

- Backend supports direct invoice and stock movement.
- Dynamic profile currently requires header warehouse globally for direct invoice; this is too broad for service-only direct invoices.
- Native UI exposes per-line warehouse, which is usable but needs mode-aware behavior.

### Sales Invoice - Linked

Business meaning: financial invoice for goods already delivered.

Expected behavior:

- Used in OPERATIONAL mode.
- Should be created from posted Delivery Note lines for stock items.
- Must not move stock again.
- Must not require the user to choose a warehouse; warehouse is inherited from Delivery Note and may be shown read-only.
- For stock lines, `dnLineId` is required.
- For service lines, SO source is enough; Delivery Note is not required.
- Posting creates AR / Revenue, and cost comes from the already-posted delivery.

Current assessment:

- Backend enforces the key rule: linked stock invoice requires `dnLineId`.
- Native invoice UI currently loads from Sales Order lines and calculates `orderedQty - invoicedQty`; this is not enough for OPERATIONAL stock invoicing.
- The native UI should load posted Delivery Note lines and invoice delivered-not-yet-invoiced quantities.

### Sales Return

Business meaning: reversal.

Expected behavior:

- After invoice: reverse receivable/revenue/tax and stock/cost as needed.
- Before invoice: in OPERATIONAL mode, reverse Delivery Note stock/COGS only.
- Direct return: allowed only with enough defaults to create a valid stock/accounting reversal.

Current assessment:

- Backend supports AFTER_INVOICE, BEFORE_INVOICE, and DIRECT contexts.
- UI must keep source selection clear so users understand whether they are reversing an invoice or only a delivery.

### Payment / Cashbox

Business meaning: Sales-facing settlement, not full accounting UI.

Expected behavior:

- Standalone Sales users choose business payment methods: Cash, Bank, Card, Transfer, Partial payment.
- Hidden accounting maps these to internal accounts.
- Users must not type raw AR account IDs or settlement account IDs in Sales Standalone.
- Visible Accounting users may access accounting detail and reports.

Current assessment:

- Backend can post settlement vouchers.
- Current Sales invoice UI still exposes raw account IDs for settlement.
- A Sales-facing payment method/cashbox configuration layer is needed.

---

## Current Gaps To Fix

| Priority | Gap | Why it matters | Recommended fix |
|---|---|---|---|
| P0 | Linked invoice UI is Sales Order based, not Delivery Note based | Can invoice undelivered quantities or miss required `dnLineId` | Build "Invoice from posted DN lines" flow |
| P0 | Standalone payment UX exposes account IDs | Non-accountants cannot use it safely | Add Sales payment methods/cashboxes mapped to hidden accounts |
| P0 | Commercial terms are incomplete | Real sales invoices need taxes, discounts, extra charges, and payment rules to calculate correctly | Add canonical sales commercial-terms model |
| P1 | Form catalog seed may not reproduce canonical Sales Order / SI persona templates | Forms Designer and dynamic routes can drift or disappear after reseed | Audit and fix canonical Sales form seeding |
| P1 | Direct invoice warehouse validation is too broad | Service-only direct invoice should not need warehouse | Make warehouse required only when a stock line needs stock movement |
| P1 | Linked invoice form still exposes warehouse fields | Warehouse should come from Delivery Note | Hide or read-only display warehouse in linked invoice |
| P1 | Dynamic web document Save button appears unwired | Web mode and Windows mode can behave differently | Wire web dynamic save through the same Sales action path or remove unsafe button |
| P2 | Docs still use CONTROLLED in older module docs | Confuses agents and future engineers | Standardize on OPERATIONAL, with CONTROLLED as legacy alias only |
| P2 | Workflow visibility helper only marks SO/DN as operational | Linked invoice forms can leak into Simple mode | Treat linked invoice as OPERATIONAL-only in dynamic document visibility |

---

## Sales Commercial Terms Layer

This layer must be shared by Direct Invoice, Operational Invoice, Sales Order totals, and Sales Return reversal logic.

### Payments

Business standard:

- Payments are recorded against Sales Invoices, not against Sales Orders or Delivery Notes.
- In SIMPLE workflow, the user can record payment during direct invoice posting or after invoice posting.
- In OPERATIONAL workflow, payment is still recorded on the Sales Invoice. Sales Order is only a contract; Delivery Note is only fulfillment.
- Multiple payment rows are valid: cash plus bank, card plus cash, partial payment, deferred balance.

Current state:

- Backend supports `DEFERRED`, `CASH_FULL`, and `MULTI` settlement modes.
- Backend can create receipt vouchers and payment history.
- UI still exposes raw account IDs.

Required change:

- Add Sales-facing payment methods/cashboxes:
  - Cash
  - Bank
  - Card
  - Transfer
  - Check
  - Other
- Each method maps internally to a hidden settlement account.
- In Sales Standalone, user sees payment method and cashbox/bank label, not GL account IDs.

### Taxes

Business standard:

- Tax belongs on invoice lines and must be snapshotted at posting.
- Sales Order may estimate tax, but Sales Invoice is the legal/tax document.
- Sales Return must reverse the same tax basis as the original invoice when it references an invoice.

Current state:

- Backend and frontend already support tax code, tax rate, tax amount, and tax total on SO/SI/SR.
- Posting snapshots tax rates and posts tax payable.

Required change:

- Keep tax as a first-class supported feature.
- Add QA around tax with discount/charge combinations after discounts are implemented.
- Withholding tax, if needed later, should be a separate document-level settlement/tax component, not mixed into normal VAT/sales tax.

### Discounts

Business standard:

- Invoices commonly need line discounts and document-level discounts.
- Discounts may be accounting-visible as a contra-revenue account, especially for professional accounting setups.
- Simpler systems may net discount against revenue, but the system should keep enough data to report gross sales, discounts, and net sales.

Current state:

- Dynamic sales normalizer reads `discountDoc`.
- Backend Sales entities/use cases do not have canonical discount fields in the invoice/order line model.
- Architecture doc says "Manual line discount only", but code is not fully canonical.

Required change:

- Add canonical line discount fields:
  - `discountType`: `AMOUNT` or `PERCENT`
  - `discountValue`
  - `discountAmountDoc`
  - `discountAmountBase`
  - `grossLineTotalDoc`
  - `netLineTotalDoc`
- Add optional document-level discount:
  - amount or percent
  - allocation method across lines for tax/accounting
- Accounting policy:
  - Starter/standalone can net discount against revenue.
  - Visible Accounting can optionally post discounts to a Sales Discount contra-revenue account.

### Extra Charges / Additions

Business standard:

- Sales documents often need shipping, delivery fee, service fee, packaging, insurance, rounding adjustment, and other additions.
- These should not be hacked as fake item lines unless the business chooses that intentionally.

Current state:

- No clear canonical sales charge model was found.

Required change:

- Add document-level charges/allowances:
  - `type`: shipping, service fee, packaging, rounding, other
  - amount
  - taxable or non-taxable
  - revenue/account mapping
- In Sales Standalone, expose simple labels only.
- In visible Accounting, allow account mapping.

### Gifts / Free Goods / Promotions

Business standard:

- Common promotions include:
  - Buy X get Y free
  - Free sample/gift line
  - Bundle/package price
  - Coupon/promo code
  - Customer group discount
  - Date-limited campaign
- Free goods must still affect inventory if they are stock items.
- Accounting treatment must be explicit:
  - Either zero-price sales line with inventory COGS recognized.
  - Or promotional expense / sales promotion account, depending on accounting policy.

Current state:

- No promotion engine, free-goods model, or gift-line accounting policy was found.

Required staged approach:

1. Phase A - Manual free line:
   - Allow invoice/SO line with `unitPriceDoc = 0`.
   - Add `linePurpose = NORMAL | FREE_GOOD | SAMPLE | PROMOTION`.
   - Stock still moves normally for stock items.
   - Revenue is zero; COGS still posts.
2. Phase B - Manual discount/promo reason:
   - Add optional `promotionCode` / `discountReason`.
   - No automatic calculation yet.
3. Phase C - Promotion rules engine:
   - Buy X get Y.
   - Quantity breaks.
   - Customer segment campaigns.
   - Start/end dates.
   - Usage limits.

Do not build the full promotion engine before invoice fundamentals are stable.

### Price Lists

Business standard:

- Sales users expect customer-specific prices, item price defaults, and sometimes customer group price lists.

Current state:

- Price Lists are documented as deferred.

Required staged approach:

- First keep manual unit price entry.
- Then add item default sale price.
- Then add customer/group price lists.
- Promotion engine should depend on this later, not block current Sales stabilization.

---

## Implementation Plan

### Phase 1 - Contract and Seeds

**Estimate:** 3-4 hours

Files likely involved:

- `backend/src/seeder/seedSystemVoucherTypes.ts`
- Sales settings/template sync use cases under `backend/src/application/sales/use-cases/`
- Sales form/profile validation files under `frontend/src/modules/accounting/document-runtime/sales/`
- `frontend/src/utils/documentPolicy.ts`

Acceptance criteria:

- Canonical Sales templates exist and reseed reliably:
  - `sales_order`
  - `delivery_note`
  - `sales_invoice_direct`
  - `sales_invoice_linked`
  - `sales_invoice_service`
  - `sales_return`
- `sales_invoice_linked` is OPERATIONAL-only.
- Direct invoice warehouse validation is stock-aware.
- Docs and code use OPERATIONAL consistently.

### Phase 2 - Commercial Terms Foundation

**Estimate:** 6-10 hours

Files likely involved:

- Sales domain entities and DTOs for SO/SI/SR lines
- `backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts`
- `backend/src/application/sales/use-cases/SalesOrderUseCases.ts`
- `backend/src/application/sales/use-cases/SalesReturnUseCases.ts`
- Sales invoice/order frontend pages and dynamic sales normalizer

Acceptance criteria:

- Tax continues to work.
- Line discounts are canonical and persisted.
- Document discount is either explicitly deferred or supported with allocation.
- Zero-price/free-good lines are allowed with explicit purpose.
- Sales Return reverses original discount/tax basis correctly.

### Phase 3 - Operational Linked Invoice Flow

**Estimate:** 5-7 hours

Files likely involved:

- `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`
- `frontend/src/api/salesApi.ts`
- possibly backend read endpoint/filter expansion for posted DN open invoice quantities

Acceptance criteria:

- OPERATIONAL stock invoice can be created from posted Delivery Note lines.
- Invoice lines carry `dnLineId`.
- Warehouse is inherited/displayed read-only from DN, not chosen manually.
- Quantity ceiling is delivered-not-yet-invoiced.
- Service lines can still invoice from SO without DN.

### Phase 4 - Standalone Payment / Cashbox UX

**Estimate:** 5-8 hours

Files likely involved:

- Sales settings/init wizard
- Sales invoice posting/payment UI
- backend settlement input mapping
- possible new Sales payment-method configuration repository/entity

Acceptance criteria:

- Standalone Sales users select Cash/Bank/Card/etc., not account IDs.
- Hidden accounting receives valid settlement account IDs from configuration/defaults.
- Multiple settlement rows remain supported.
- Visible Accounting users can still trace generated receipt vouchers.

### Phase 5 - Web/Windows Dynamic Form Parity

**Estimate:** 3-5 hours

Files likely involved:

- `frontend/src/modules/tools/pages/DynamicDocumentPage.tsx`
- `frontend/src/components/mdi/DocumentWindow.tsx`
- `frontend/src/hooks/useVoucherActions.ts`

Acceptance criteria:

- Web dynamic forms and Windows mode use the same Sales save contract.
- Save buttons are wired or hidden when unsupported.
- Direct, linked, service invoice, SO, DN, and SR save paths are covered by manual QA.

---

## Out Of Scope For This Task

- Quotations.
- Price lists.
- Full accounting report UI inside Sales Standalone.
- Multi-currency management for Sales Standalone.
- Multi-warehouse transfers in Sales Standalone.
- Full POS workflow.

---

## Recommended Next Action

Start with Phase 1. It reduces downstream ambiguity before the UI agent changes screens.

Do not start Phase 2 UI work until the UI agent's current branch is stable or the affected files are assigned clearly, because Phase 2 touches `SalesInvoiceDetailPage.tsx`.
