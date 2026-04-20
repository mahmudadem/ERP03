# Two-Layer Document Validation System - Implementation Summary

## Overview
Implemented a comprehensive 3-layer validation architecture for the ERP document system, separating structural validation, business rules, and system warnings.

## Architecture

### Layer 1: Structural Validation (Developer-Defined)
- **Purpose**: Non-negotiable system constraints to prevent crashes or data corruption
- **Always blocks** save if failed
- **Examples**: Required fields, minimum line count, data integrity checks
- **Configured by**: Hardcoded in validator classes

### Layer 2: Business Rules (User-Configured)
- **Purpose**: Company-specific business logic
- **4 Outcomes**:
  - `BLOCK`: Save disabled until rule passes
  - `ALLOW_WITH_WARN`: Save enabled, warning shown with amber indicator
  - `BLOCK_AND_WARN`: Save disabled with detailed warning message
  - `ALLOW`: No validation (rule effectively disabled)
- **Storage**: `voucherConfig.metadata.businessRules` (per-form overrides)
- **Cascades**: Form > Company > System defaults

### Layer 3: System Warnings (Never Configurable)
- **Purpose**: Informational insights computed by the system
- **Always warns, never blocks**
- **Examples**: Customer inactive 90+ days, low margin items, exchange rate changes

### Workflow Gates (Independent)
- **Flexible Mode**: "Save & Post" (one-step workflow)
- **Strict Mode**: "Save as Draft" + "Submit Approval" (multi-step workflow)
- **Key Point**: Validation results are identical in both modes

## Files Created

### Validation Core (`frontend/src/modules/accounting/validation/`)
1. **types.ts** - ValidationResult, RuleOutcome enum, BusinessRulesConfig interfaces
2. **DocumentValidator.ts** - Abstract base class with 3-layer validation logic
3. **JournalValidator.ts** - Journal Entry, FX Revaluation, Opening Balance
4. **SalesValidator.ts** - Sales Invoice, Order, Return, Delivery Note
5. **PurchaseValidator.ts** - Purchase Invoice, Order, Goods Receipt, Return
6. **ReceiptPaymentValidator.ts** - Receipt & Payment vouchers (disabled for now)
7. **DocumentValidatorFactory.ts** - Factory pattern with registry for type resolution
8. **useDocumentValidation.ts** - React hook for VoucherWindow integration
9. **config.ts** - Feature flags and per-type enablement
10. **index.ts** - Barrel export

### UI Components
11. **BusinessRulesPanel.tsx** - Forms Designer UI for configuring Layer 2 rules

## Files Modified

### Core Validation
- **useVoucherTotals.ts**: Fixed semantic mode bug - `isBalanced` now checks structural validity, not `total > 0`

### UI Integration
- **VoucherWindow.tsx**: Integrated `useDocumentValidation` hook, warning indicators, feature flag support
- **DocumentDesigner.tsx**: Added BusinessRulesPanel to Step 3 (Rules), business rules state management

## Enabled Form Types

### Phase 1 (Enabled)
- ✅ JOURNAL_ENTRY
- ✅ FX_REVALUATION
- ✅ OPENING_BALANCE
- ✅ REVERSAL

### Phase 2 (Enabled)
- ✅ SALES_INVOICE
- ✅ SALES_ORDER
- ✅ SALES_RETURN
- ✅ DELIVERY_NOTE

### Phase 3 (Enabled)
- ✅ PURCHASE_INVOICE
- ✅ PURCHASE_ORDER
- ✅ GOODS_RECEIPT
- ✅ PURCHASE_RETURN

### Phase 4 (Disabled - Future)
- ⏸️ RECEIPT
- ⏸️ PAYMENT

## Predefined Business Rules

1. **requirePositiveTotal**: Document total must be > 0
2. **preventBelowCost**: Items cannot be priced below cost
3. **enforceCreditLimit**: Customer credit limit check (requires async API)
4. **requireWarehouse**: Line items must have warehouse assigned
5. **minLineCount**: Minimum number of line items (configurable value)

## Feature Flags

Controlled via `config.ts`:
- `enabled`: Master switch (env var `REACT_APP_NEW_VALIDATION`)
- `parallelRun`: Log both old and new validation (dev mode)
- `enableByType`: Per-type enablement for gradual rollout

## Rollback Strategy

1. **Feature Flag**: Set `REACT_APP_NEW_VALIDATION=false` to disable
2. **Per-Type**: Disable specific types in `config.ts`
3. **Git Branch**: All changes isolated on `feat/two-layer-validation`

## Testing

### Parallel Run Mode
In development, both old and new validation run simultaneously:
```typescript
console.log('[VALIDATION] Parallel run:', {
  type: definition.code,
  ...result._debug,
});
```

### Manual Testing Checklist
- [ ] Create new Sales Invoice form in Forms Designer
- [ ] Navigate to Step 3 (Rules)
- [ ] Enable "Require Positive Total" with "Block" outcome
- [ ] Save form and test with $0 total (should block)
- [ ] Change outcome to "Allow with Warn" (should warn but allow save)
- [ ] Test Journal Entry with unbalanced debit/credit

## Next Steps

### Phase 4: Receipt/Payment Validators
- Enable RECEIPT and PAYMENT in config.ts
- Test with real payment/receipt forms

### Future Enhancements
1. **Async Validation**: API-dependent rules (credit limit, stock availability)
2. **Custom Rule Builder**: UI for creating dynamic validation rules
3. **Company-Level Defaults**: Accounting Settings page for default business rules
4. **Analytics Dashboard**: Track validation failures by type/rule

## Migration Notes

### Breaking Changes
None - feature flag controlled, backward compatible

### Data Migration
None required - business rules stored in existing `metadata` field

### API Changes
None - all validation is frontend-only (backend has separate posting validators)
