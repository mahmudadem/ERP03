# Feature 06: COA Alignment & Accounting Integration

## Goal
Ensure the Chart of Accounts has the required control accounts for Inventory, Sales, and Purchases integration. Provide auto-creation or mapping during module setup.

---

## Required Control Accounts

### For Inventory Module
| Account | Type | Code (sugested) | Purpose |
|---------|------|------------------|---------|
| Inventory | Asset | 1300 | Stock value on balance sheet |
| Cost of Goods Sold (COGS) | Expense | 5100 | Recognized on sales delivery |
| Stock Adjustment | Expense | 5200 | Manual adjustments |

### For Sales Module (created in Sales plan but defined here)
| Account | Type | Code | Purpose |
|---------|------|------|---------|
| Accounts Receivable | Asset | 1200 | Customer balances |
| Sales Revenue | Revenue | 4100 | Revenue from sales |
| Sales Discount | Revenue (contra) | 4200 | Discounts given |
| Sales Returns | Revenue (contra) | 4300 | Returns from customers |

### For Purchases Module
| Account | Type | Code | Purpose |
|---------|------|------|---------|
| Accounts Payable | Liability | 2100 | Vendor balances |
| Purchases | Expense | 5000 | Direct purchase expense |
| Purchase Discount | Expense (contra) | 5010 | Discounts received |
| Purchase Returns | Expense (contra) | 5020 | Returns to vendors |

---

## Implementation

### Backend

#### 1. Module Settings: Default Account Mappings
**File:** `backend/src/domain/inventory/types/InventorySettings.ts` [NEW]

```typescript
export interface InventoryModuleSettings {
  defaultInventoryAccountId?: string;
  defaultCOGSAccountId?: string;
  defaultStockAdjustmentAccountId?: string;
  // Future
  costMethod: 'average' | 'fifo' | 'standard';
  trackStockByDefault: boolean;
}
```

Stored at: `companies/{companyId}/inventory/Settings/module`

#### 2. Setup Wizard / Account Auto-Creation
**File:** `backend/src/application/inventory/use-cases/SetupInventoryModuleUseCase.ts` [NEW]

On first initialization:
1. Check if required control accounts exist in the COA
2. If missing, auto-create them using existing `CreateAccountUseCase` from accounting module
3. Save default mappings to module settings

> **Pattern:** Similar to how fiscal year closing auto-creates "Retained Earnings" account.

#### 3. Account Validation Service
**File:** `backend/src/application/inventory/services/InventoryAccountValidator.ts` [NEW]

Before any stock-affecting transaction that generates accounting entries:
- Validate that mapped accounts exist and are active
- Validate account types are correct (e.g., inventory account must be Asset type)

---

### Frontend

#### Account Mapping Settings Page
**File:** `frontend/src/modules/inventory/pages/InventorySettingsPage.tsx` [NEW]

Section: **Default Accounting Accounts**
- Inventory Account: AccountSelector (filtered to Asset type)
- COGS Account: AccountSelector (filtered to Expense type)
- Stock Adjustment Account: AccountSelector (filtered to Expense type)
- Cost Method: Dropdown (Average / FIFO / Standard)

---

## Verification

1. Initialize inventory module → verify control accounts auto-created
2. Verify account types are correct (Asset for Inventory, Expense for COGS)
3. Try to post stock adjustment with unmapped account → verify error message
4. Change default accounts → verify new transactions use updated accounts
