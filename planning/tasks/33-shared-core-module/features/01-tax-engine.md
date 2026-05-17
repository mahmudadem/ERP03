# Feature 01: Tax Engine

## Overview
A centralized service for managing tax rates (VAT/GST) and calculating taxes on document lines across all modules.

## Entities

### `TaxCategory`
```typescript
{
  id: string; // e.g., 'standard', 'zero', 'exempt', 'reduced'
  companyId: string;
  name: string;
  description?: string;
  isActive: boolean;
}
```

### `TaxRate`
```typescript
{
  id: string;
  companyId: string;
  categoryId: string; // Ref: TaxCategory.id
  ratePercentage: number; // e.g., 5.0 for 5%
  effectiveFrom: Date;
  effectiveTo?: Date; // For rate changes
  salesAccountId: string; // Ref: Account.id (Output Tax)
  purchaseAccountId: string; // Ref: Account.id (Input Tax)
}
```

## Firestore Paths
- `companies/{companyId}/shared/Data/tax_categories`
- `companies/{companyId}/shared/Data/tax_rates`

## Services
- `TaxCalculationEngine`
  - `calculateLineTax(quantity, unitPrice, discount, taxCategoryId, date, isSales)`
  - Looks up the active `TaxRate` for the category on the given date.
  - Returns `TaxResult` { baseAmount, taxAmount, totalAmount, accountId, rateId }

## API Routes (Shared Module)
- `GET /api/shared/tax-categories`
- `POST /api/shared/tax-categories`
- `GET /api/shared/tax-categories/:id/rates`
- `POST /api/shared/tax-rates`

## Frontend Pages
- **Settings → Tax Engine:** Manage categories and rates.

## Verification
- [ ] Create Standard category + 5% rate with effective date.
- [ ] Call `TaxCalculationEngine` with a date before and after the effective date.
- [ ] Verify tax is calculated correctly based on net value after discount.
