# Task 43: Sales Voucher Architecture Standardization

**Status:** 🟢 Executing
**Started:** 2026-04-29
**Estimate:** ~3 hours
**Type:** Breaking Cleanup

---

## Objective

Replace the generic `sales_invoice` voucher template with three specialized personas, align DTOs with canonical fields, implement persona-based validation, and decouple the policy resolver from workflow/accounting coupling.

## Architecture

```
Sales Invoice Templates (Form Layer)          Accounting Layer
─────────────────────────────────────         ──────────────────
sales_invoice_direct    ──┐
sales_invoice_linked    ──┼──► VoucherType.SALES_INVOICE (single)
sales_invoice_service   ──┘
```

- Each template stores `workflow.mode` as the source of truth for persona behavior
- `SalesSettings` controls which personas are enabled and which is default
- The invoice stores `voucherTypeId` to track which template was used
- All three map to `VoucherType.SALES_INVOICE` — no new accounting enum values

---

## Phase 1: Seeder Refactor

**File:** `backend/src/seeder/seedSystemVoucherTypes.ts`

Replace single `sales_invoice` template with three:

| Template | workflow.mode | Key Differences |
|----------|--------------|-----------------|
| `sales_invoice_direct` | `'SIMPLE'` | `warehouseId` optional, `dnLineId` hidden, `soLineId` optional |
| `sales_invoice_linked` | `'OPERATIONAL'` | `dnLineId` visible (required for stock), `warehouseId` visible, `soLineId` visible |
| `sales_invoice_service` | `'SERVICE'` | No `warehouseId`, no `dnLineId`, no `soLineId`, no `salesOrderId` header field |

Verify: `sales_order` uses `orderedQty` ✓, `delivery_note` uses `deliveredQty` ✓

---

## Phase 2: Entity & DTO Alignment

### SalesInvoice.ts
- Add `voucherTypeId: string` to `SalesInvoiceProps` and the class
- Add validation: `voucherTypeId` is required
- Update `toJSON()`, `fromJSON()`, constructor

### SalesSettings.ts
- Remove `salesVoucherTypeId?: string`
- Add:
  - `enabledSalesInvoicePersonas: { direct: boolean; linked: boolean; service: boolean }`
  - `defaultSalesInvoicePersona: 'direct' | 'linked' | 'service'`
  - `defaultSalesInvoiceVoucherTypeIds: { direct?: string; linked?: string; service?: string }`
- Update `createDefault()`, `toJSON()`, `fromJSON()`, constructor

### SalesDTOs.ts
- Update `SalesSettingsDTO` — replace `salesVoucherTypeId` with new fields
- Update `SalesInvoiceDTO` — add `voucherTypeId`
- Update mappers

### SalesInvoiceUseCases.ts (interfaces only)
- Add `voucherTypeId: string` to `CreateSalesInvoiceInput`
- Add `voucherTypeId?: string` to `UpdateSalesInvoiceInput`

---

## Phase 3: Validation Logic

### CreateSalesInvoiceUseCase.execute()
1. Accept `voucherTypeId` in input
2. Fetch the voucher type definition to read `workflow.mode`
3. Resolve persona from `workflow.mode`: `'SIMPLE'` → `'direct'`, `'OPERATIONAL'` → `'linked'`, `'SERVICE'` → `'service'`
4. Check `settings.enabledSalesInvoicePersonas[persona]` — reject if disabled
5. **Persona validation (per line):**
   - `service`: Reject if `item.type !== 'SERVICE'` → 400 error
   - `linked`: For stock items, require `dnLineId` → 400 error
   - `direct`: No special restrictions
6. **Payment rejection:** If `input.payments` exists and non-empty → 400 error

### PostSalesInvoiceUseCase.execute()
- Same persona resolution and validation (re-validate at post time)

### sales.validators.ts
- Add `voucherTypeId` as required in `validateCreateSalesInvoiceInput()`
- Add `payments` validation

---

## Phase 4: Settings Use Cases & Validators

### SalesSettingsUseCases.ts
- Update `InitializeSalesInput` and `UpdateSalesSettingsInput` interfaces
- Replace `salesVoucherTypeId` references with new persona fields
- After `ensureSalesVoucherDefinitions()`, resolve the three SI template IDs
- Populate `defaultSalesInvoiceVoucherTypeIds` with resolved IDs
- Set `enabledSalesInvoicePersonas` and `defaultSalesInvoicePersona` based on workflowMode

### sales.validators.ts
- Update `validateInitializeSalesInput()` and `validateUpdateSalesSettingsInput()`

---

## Phase 5: Policy Decoupling

### DocumentPolicyResolver.ts
- Remove `enforceWorkflowAccountingCompatibility()` method
- Update callers (SalesSettingsUseCases.ts)

---

## Phase 6: Controller Updates

### SalesController.ts
- `createSI()` — pass `voucherTypeId` from request body
- `updateSI()` — pass `voucherTypeId` if provided

---

## Phase 7: Test Updates

- `SalesPostingUseCases.test.ts` — add `voucherTypeId` to test settings
- `SalesReturnUseCases.test.ts` — same
- `SalesSettingsUseCases.test.ts` — update settings structure
- `SalesDocumentNumberUniqueness.test.ts` — same

---

## Phase 8: Frontend Fix

### useVoucherActions.ts
- Line 377: `const isSalesInvoice = resolvedType === 'sales_invoice';`
- Update to match all three persona codes: `sales_invoice_direct`, `sales_invoice_linked`, `sales_invoice_service`
- Use prefix matching: `resolvedType.startsWith('sales_invoice_')`

---

## Phase 9: Build & Seed Verification

- Run `npm run build` in backend — must pass with zero errors
- Run `npm run seed` — must create all three SI templates
- Run `npm run build` in frontend — must pass with zero errors

---

## Phase 10: E2E Test Preparation

- Verify seeder creates all three SI templates with correct workflow.mode
- Verify SalesSettings initializes with correct persona defaults
- Verify create SI with valid voucherTypeId succeeds
- Verify create SI with disabled persona is rejected
- Verify service invoice rejects stock items
- Verify linked invoice rejects stock items without dnLineId
- Verify non-empty payments[] is rejected with 400

---

## Known Out-of-Scope
- Payment posting engine implementation
- Data migration for existing companies (reseed only affects new companies)
- Form Designer engine modifications

---

## Completion Criteria
- [ ] All three SI templates seeded correctly
- [ ] SalesInvoice entity stores voucherTypeId
- [ ] SalesSettings uses new persona fields
- [ ] Persona validation enforced in use cases
- [ ] Policy resolver decoupled
- [ ] Frontend recognizes all three persona codes
- [ ] Backend build passes (zero errors)
- [ ] Frontend build passes (zero errors)
- [ ] Seed runs successfully
- [ ] E2E flow verified
