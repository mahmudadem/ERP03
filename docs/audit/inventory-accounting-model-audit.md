# ERP Inventory-Accounting Model Audit Report

## 1. Executive Summary

The current system has a **partially implemented hybrid inventory-accounting model** with two modes (`INVOICE_DRIVEN` and `PERPETUAL`) that are **architecturally recognized but inconsistently enforced**. The posting engine has a solid foundation with 9 voucher strategies, but critical gaps exist in:

- **Account mapping**: Scattered optional string references with zero validation
- **Cost enforcement**: Inconsistent — some documents throw, some silently corrupt data
- **Negative stock**: Setting exists but is **never checked** — negative stock is unconditionally allowed
- **Reporting**: No inventory valuation report, no provisional/final distinction, no mode-aware labels
- **COA design**: One-size-fits-all templates with no mode-specific required accounts
- **Cross-module isolation**: Accounting and Inventory initialize independently with no coordination

The system is **not dangerous** for basic use, but has **silent data integrity failures** in edge cases that would produce incorrect financial statements without any warning.

---

## 2. Current State Confirmed from Code

### Company Setup Flow
- **Wizard** (`CompleteCompanyCreationUseCase.ts`, lines 1-193): Creates company, seeds currencies, activates modules, copies voucher templates. Does **NOT** seed COA.
- **COA Seeding** (`InitializeAccountingUseCase.ts`, lines 1-398): Separate step. Accepts `coaTemplate` ID, creates accounts, fiscal year, accounting policies.
- **Inventory Initialization** (`InitializeInventoryUseCase.ts`, lines 1-153): Creates default warehouse, settings, UOMs. **Independent** of accounting.

### Inventory Accounting Mode
- **Exists**: `InventoryAccountingMode = 'INVOICE_DRIVEN' | 'PERPETUAL'` (`InventorySettings.ts`, line 2)
- **Legacy mapping**: `PERIODIC` → `INVOICE_DRIVEN`, `PERPETUAL` → `PERPETUAL` (`InventorySettings.ts`, lines 123-145)
- **Immutable after init**: Enforced in `InventoryController.updateSettings()` (lines 218-226)
- **Default**: `PERPETUAL` if neither specified

### Cost Model
- **Method**: `MOVING_AVG` only — hardcoded (`InventorySettings.ts`, line 46-48)
- **Cost storage**: `StockLevel.avgCostBase`, `StockLevel.lastCostBase` — NOT on Item entity
- **OUT movement cost resolution** (`RecordStockMovementUseCase.ts`, lines 195-305):
  1. Forced cost (if provided)
  2. `avgCostBase` (if qtyBefore > 0)
  3. `lastCostBase` (if qtyBefore ≤ 0 but lastCost > 0)
  4. **Zero cost with `costBasis = 'MISSING'`** (if nothing available)

---

## 3. Current Inventory-Accounting Classification

**Classification: HYBRID — Document-by-Document, Mode-Aware but Inconsistently Enforced**

| Document | INVOICE_DRIVEN | PERPETUAL |
|----------|---------------|-----------|
| Goods Receipt | No stock accounting | Dr Inventory, Cr GRNI |
| Delivery Note | No stock accounting | Dr COGS, Cr Inventory |
| Sales Invoice | Dr AR, Cr Revenue + Dr COGS, Cr Inventory | Dr AR, Cr Revenue (+ COGS only if no DN posted) |
| Purchase Invoice (direct) | Dr Inventory/Expense, Cr AP | Dr Inventory, Cr AP |
| Stock Adjustment | Dr COGS, Cr Inventory (if accounts exist) | Same |
| Stock Transfer | No accounting | No accounting |

**The mode differentiation exists** via `DocumentPolicyResolver` (16 methods, all mode-aware). However, enforcement is inconsistent:

- **Sales/Delivery/SalesReturn**: Enforce positive cost via `assertPositiveTrackedCost()` → throws
- **Stock Adjustment**: Silently skips voucher if amount = 0
- **Purchase Return**: No cost validation → silently creates zero-cost entries
- **Purchase Invoice (direct)**: No cost validation → silently corrupts moving average

---

## 4. Current COA / Account Mapping Analysis

### COA Templates
- **5 templates**: Standard, Simplified, Manufacturing, Services, Retail (hardcoded TS arrays)
- **No mode variation**: Same templates for both INVOICE_DRIVEN and PERPETUAL
- **No validation**: Templates are not validated against mode requirements

### Account Mapping — SCATTERED AND UNVALIDATED

| Account | Where Stored | Required? | Validated? |
|---------|-------------|-----------|------------|
| Inventory Asset | `InventorySettings.defaultInventoryAssetAccountId` | Optional | **NO** |
| COGS | `InventorySettings.defaultCOGSAccountId` | Optional | **NO** |
| Revenue | `SalesSettings.defaultRevenueAccountId` | **Required** | **YES** (throws if missing) |
| AR | `SalesSettings.defaultARAccountId` | Optional (falls back to settings) | **NO** |
| AP | `PurchaseSettings.defaultAPAccountId` | Optional | **NO** |
| GRNI | `PurchaseSettings.defaultGRNIAccountId` | Optional | **NO** |

**Critical Gap**: There is **NO centralized account mapping registry**. Account references are optional strings scattered across 4+ entities. Missing mappings cause:
- Silent voucher skip (Stock Adjustment, line 209-212: `console.warn`)
- Runtime errors (Sales Invoice posting if AR account missing)
- Silent zero-amount entries (Purchase Return with no accounts)

### Can One Shared COA Support Both Modes?

**Yes, but only if the COA includes ALL accounts needed by both modes:**
- INVOICE_DRIVEN needs: Revenue, AR, Inventory/Expense, AP
- PERPETUAL needs: All of the above + COGS, GRNI, Inventory Asset

The **StandardCOA** template includes: Inventory Asset (1030), COGS (5010), Revenue (4010), AP (2010), AR (1020). It supports both modes.
The **SimplifiedCOA** template does **NOT** include GRNI or COGS accounts. It would fail in PERPETUAL mode.

---

## 5. Current Posting Logic by Document Type

| Document | Stock Effect | Accounting Effect | Timing | Mode-Aware? | Account Mappings Required |
|----------|-------------|-------------------|--------|-------------|--------------------------|
| Purchase Order | None | None | N/A | No | None |
| Goods Receipt | IN (PURCHASE_RECEIPT) | PERPETUAL only: Dr Inv, Cr GRNI | On posting | **Yes** | Inv Asset, GRNI |
| Purchase Invoice | IN (if direct) | Always: Dr Inv/Expense, Cr AP | On posting | **Yes** (GRNI clearing) | AP, Inv Asset/Expense, GRNI |
| Purchase Return | OUT (RETURN_OUT) | Conditional on context | On posting | **Yes** | AP, Inv Asset, GRNI |
| Sales Order | None | None | N/A | No | None |
| Delivery Note | OUT (SALES_DELIVERY) | PERPETUAL only: Dr COGS, Cr Inv | On posting | **Yes** | COGS, Inv Asset |
| Sales Invoice | OUT (if direct) | Always: Dr AR, Cr Rev (+ COGS if applicable) | On posting | **Yes** | AR, Revenue, COGS, Inv Asset |
| Sales Return | IN (RETURN_IN) | Conditional on context | On posting | **Yes** | AR, Revenue, COGS, Inv Asset |
| Stock Adjustment | IN/OUT | Always: Dr/Dr COGS, Cr/Dr Inv | On posting | **No** (always posts) | COGS, Inv Asset |
| Stock Transfer | OUT + IN | None | On completion | No | None |
| Opening Stock | IN (OPENING_STOCK) | Optional: Dr Inv, Cr Opening Bal | On posting | No | Inv Asset, Opening Bal |

---

## 6. Current Reporting Implications

### Existing Reports
| Report | Data Source | Mode-Aware? | Provisional? |
|--------|------------|-------------|--------------|
| Trial Balance | Posted GL | No | No |
| P&L | Posted GL (account movements) | No | No |
| Balance Sheet | Posted GL | No | No |
| Trading Account (Gross Profit) | Posted GL | No | No |
| General Ledger | Posted GL | No | No |
| Journal Report | Vouchers | No | No |
| Stock Movements | StockMovement table | No | No |
| Stock Levels | StockLevel table | No | No |

### Missing Reports
- **Inventory Valuation Report** — Does not exist
- **Net Purchases Report** — Does not exist
- **Gross Profit by Item** — Does not exist
- **Unsettled Stock Report** — Does not exist

### COGS Zero/Missing Impact
- P&L shows `grossProfit = netSales` (100% margin) — **no warning**
- Trading Account shows 100% margin — **no warning**
- Balance Sheet shows inflated retained earnings — **no warning**

---

## 7. Critical Gaps and Risks

### GAP 1: `allowNegativeStock` Setting Exists But Is Never Checked
- **File**: `InventorySettings.ts`, line 11 (`allowNegativeStock: boolean`)
- **Default**: `true` (`createDefault()`, line 80)
- **Enforcement**: **NOWHERE**. `RecordStockMovementUseCase` does not consult this setting. Negative stock is unconditionally allowed.
- **Risk**: Users who set `allowNegativeStock = false` believe they are protected, but they are not.

### GAP 2: Inconsistent Cost Validation
| Document | Cost = 0 | Behavior |
|----------|----------|----------|
| Sales Invoice | Throws | Transaction rolled back |
| Delivery Note | Throws | Transaction rolled back |
| Sales Return | Throws | Transaction rolled back |
| Stock Adjustment | Silent | Stock moves, no accounting |
| Purchase Return | Silent | Stock moves, zero accounting |
| Purchase Invoice (direct) | Silent | Stock moves, corrupts avg cost |
| Stock Transfer | Silent | Transfers zero cost, corrupts destination |

### GAP 3: No Cross-Module Initialization Dependency
- `InitializeAccountingUseCase` and `InitializeInventoryUseCase` are **completely independent**
- No validation that referenced accounts exist before inventory operations begin
- No enforcement that PERPETUAL mode requires COGS + Inventory Asset accounts

### GAP 4: No Period-End Settlement/Close Logic
- No inventory valuation close
- No COGS reconciliation
- No mechanism to "settle" unsettled stock movements
- No cost recalculation after backdated transactions

### GAP 5: Backdated Transactions
- `StockMovement` has `isBackdated` flag but **no recalculation logic**
- A backdated purchase receipt will change the moving average, but prior sales already posted with the old average — **no correction is made**

### GAP 6: Edit Posted Documents
- `allowEditDeletePosted` exists in `AccountingPolicyConfig`
- If a posted stock movement is edited, **no downstream recalculation occurs**
- Prior COGS entries are not adjusted

---

## 8. Edge Cases and Failure Scenarios

| Edge Case | Current Behavior | Risk Level |
|-----------|-----------------|------------|
| **Sell before purchase** | Throws on SI/DN posting (`assertPositiveTrackedCost`) | Medium — blocks operation |
| **Opening stock without cost** | Throws on subsequent sale (cost = 0) | Medium — blocks operation |
| **Purchase after sale** | Would work if cost assertion were disabled | Low |
| **Negative stock** | Allowed unconditionally (setting ignored) | **HIGH** — silent data corruption |
| **Return after invoice** | Works, reverses revenue + COGS | Low |
| **Return before invoice** | INVOICE_DRIVEN: no voucher; PERPETUAL: COGS reversal only | Medium — inconsistent |
| **Edit posted stock doc** | Allowed if `allowEditDeletePosted=true`; no recalculation | **HIGH** — silent corruption |
| **Backdated transaction** | Posted, no recalculation of prior movements | **HIGH** — silent corruption |
| **Cost recalculation after prior sales** | Not implemented | **HIGH** |
| **Incomplete account mappings** | Silent skip (adjustments) or runtime error (sales) | **HIGH** |
| **Service items mixed with stock** | Works — `trackInventory=false` skips stock logic | Low |
| **Multi-warehouse** | Works — cost tracked per warehouse via StockLevel | Low |
| **Multi-currency** | Partially supported — `costCurrency` on Item, FX rates on movements | Medium — untested |

---

## 9. Required Changes to Reach Target Design

### Domain Model Changes
1. **Add `InventoryAccountingMode` enum** with `SIMPLE` / `ACCURATE` labels (renaming from `INVOICE_DRIVEN` / `PERPETUAL` for user clarity)
2. **Add `NegativeStockPolicy` enum**: `BLOCK`, `WARN`, `ALLOW`
3. **Add `MissingCostPolicy` enum**: `BLOCK`, `WARN`, `ALLOW_WITH_DEFERRED`, `ALLOW_WITH_ESTIMATE`
4. **Add `ClosingPolicy` enum**: `PROVISIONAL`, `MANDATORY_CLOSE`

### Database/Entity Changes
1. **`InventorySettings`**: Add `negativeStockPolicy`, `missingCostPolicy`, `closingPolicy` fields
2. **New entity**: `AccountMappingRegistry` — centralized mapping of business concepts to accounts
3. **`StockMovement`**: Already has `unsettledCostBasis`, `costSettled`, `negativeQtyAtPosting` — good foundation

### Company Setup Changes
1. Add mode selection step to wizard: SIMPLE vs ACCURATE
2. Mode determines: COA template options, required account mappings, default policies

### Accounting Settings Changes
1. Add `AccountMappingRegistry` UI — single source of truth for all account references
2. Add validation: all required accounts must exist and be of correct type

### Inventory Settings Changes
1. Add `negativeStockPolicy` toggle
2. Add `missingCostPolicy` toggle
3. Add `closingPolicy` toggle
4. Remove standalone `allowNegativeStock` boolean (replace with policy enum)

### COA Template/Mapping Changes
1. Create mode-aware COA templates (or annotate existing templates with required accounts per mode)
2. SIMPLE mode: COGS and GRNI optional
3. ACCURATE mode: COGS, GRNI, Inventory Asset required

### Posting Engine Changes
1. Replace `assertPositiveTrackedCost()` with policy-aware check
2. In SIMPLE mode: allow zero cost, mark movement as `unsettled`
3. In ACCURATE mode: block on zero cost (current behavior)
4. Enforce `negativeStockPolicy` in `RecordStockMovementUseCase`
5. Add period-end settlement use case to resolve unsettled movements

### Reporting Changes
1. Add "Provisional" label to reports when SIMPLE mode and unsettled movements exist
2. Add Inventory Valuation Report
3. Add Net Purchases Report
4. Add Unsettled Stock Report (items sold without cost)
5. Add warnings to P&L/Trading Account when COGS is zero or incomplete

### Migration/Compatibility Risks
1. Existing companies with `INVOICE_DRIVEN` mode map to SIMPLE
2. Existing companies with `PERPETUAL` mode map to ACCURATE
3. Existing stock movements with `costBasis = 'MISSING'` need retrospective handling
4. COA templates may need migration to include missing accounts

### Test Coverage Needed
1. Sell before purchase in SIMPLE mode
2. Sell before purchase in ACCURATE mode (should block)
3. Negative stock with BLOCK policy
4. Negative stock with WARN policy
5. Zero cost with DEFERRED policy
6. Period-end settlement flow
7. Backdated transaction recalculation
8. Account mapping validation on save

---

## 10. Recommended Final Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Company-Level: Inventory Accounting Mode                   │
│  ┌─────────────────┬──────────────────────────────────────┐ │
│  │ SIMPLE          │ ACCURATE                             │ │
│  │ (Invoice-Driven)│ (Perpetual)                          │ │
│  └─────────────────┴──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌──────────────────┐          ┌──────────────────────┐
│ Operational      │          │ Operational          │
│ Policy Toggles   │          │ Policy Toggles       │
│                  │          │                      │
│ Negative Stock:  │          │ Negative Stock:      │
│   BLOCK/WARN/    │          │   BLOCK (default)    │
│   ALLOW          │          │                      │
│                  │          │ Missing Cost:        │
│ Missing Cost:    │          │   BLOCK (default)    │
│   ALLOW_DEFERRED │          │                      │
│   (default)      │          │                      │
│                  │          │                      │
│ Closing:         │          │ Closing:             │
│   PROVISIONAL    │          │   MANDATORY_CLOSE    │
│   (default)      │          │   (default)          │
└──────────────────┘          └──────────────────────┘
         │                              │
         ▼                              ▼
┌──────────────────┐          ┌──────────────────────┐
│ Posting Engine   │          │ Posting Engine       │
│                  │          │                      │
│ - Zero cost OK   │          │ - Zero cost BLOCKS   │
│ - Mark unsettled │          │ - All costs settled  │
│ - No COGS entry  │          │ - Real-time COGS     │
│   (or $0 entry)  │          │ - GRNI clearing      │
│ - Revenue only   │          │ - Full double-entry  │
└──────────────────┘          └──────────────────────┘
         │                              │
         ▼                              ▼
┌──────────────────┐          ┌──────────────────────┐
│ Reporting        │          │ Reporting            │
│                  │          │                      │
│ - "Provisional"  │          │ - Final reports      │
│   label on P&L   │          │ - Inventory Valuation│
│ - Net Sales rpt  │          │ - Gross Profit by Item│
│ - Net Purch rpt  │          │ - Full audit trail   │
│ - Unsettled rpt  │          │                      │
└──────────────────┘          └──────────────────────┘
```

---

## 11. Recommended Setup Flow (from Company Creation Onward)

```
1. Company Wizard → Basic Info, Plan, Currency, Fiscal Year
2. Mode Selection → SIMPLE or ACCURATE (labeled for business users)
   - This choice determines:
     a) COA template options (filtered by mode)
     b) Required account mappings
     c) Default operational policies
3. COA Selection → Templates filtered by mode
   - SIMPLE: Standard, Simplified, Retail, Services
   - ACCURATE: Standard, Manufacturing, Retail
4. Account Mapping → Required accounts highlighted
   - SIMPLE: Revenue, AR, AP (required); COGS, Inv Asset (optional)
   - ACCURATE: Revenue, AR, AP, COGS, Inv Asset, GRNI (all required)
5. Module Initialization → Accounting, then Inventory, then Sales/Purchases
   - Each module validates its account mappings against COA
6. Operational Policy Confirmation → Review defaults based on mode
```

---

## 12. Recommended COA Strategy

**Use one superset COA with mode-aware required account annotations.**

Each COA template should declare:
```typescript
interface COATemplate {
  id: string;
  name: string;
  accounts: AccountTemplate[];
  requiredForMode: {
    SIMPLE: string[];    // Account codes required for SIMPLE mode
    ACCURATE: string[];  // Account codes required for ACCURATE mode
  };
}
```

This avoids maintaining separate template sets while ensuring mode-appropriate accounts exist.

---

## 13. Recommended Mode + Policy + Closing Model

| Dimension | SIMPLE Mode | ACCURATE Mode |
|-----------|------------|---------------|
| **Mode Selection** | Company creation wizard | Company creation wizard |
| **Changeable Later?** | No (breaks historical reporting) | No |
| **Negative Stock** | ALLOW (default), user can change to BLOCK/WARN | BLOCK (default), immutable |
| **Missing Cost** | ALLOW_WITH_DEFERRED (default), user can change | BLOCK (default), immutable |
| **Closing** | PROVISIONAL (default) — reports labeled "Provisional until settled" | MANDATORY_CLOSE — period must be closed before final reports |
| **COGS Recognition** | At invoice time (or deferred) | At delivery/receipt time (real-time) |
| **Settlement Tool** | Required — resolves unsettled movements before period close | Not needed — all costs settled at posting time |

---

## 14. Migration / Backward Compatibility Risks

1. **Existing `INVOICE_DRIVEN` companies** → Map to SIMPLE mode. Their existing behavior (COGS at invoice time, no GRNI) is preserved.
2. **Existing `PERPETUAL` companies** → Map to ACCURATE mode. Their existing behavior (COGS at delivery, GRNI clearing) is preserved.
3. **Existing stock movements with `costBasis = 'MISSING'`** → These are unsettled. In SIMPLE mode, they remain unsettled until the settlement tool resolves them. In ACCURATE mode, they represent a data integrity issue that should be flagged.
4. **COA migration** → Existing companies keep their COA. New required accounts (e.g., GRNI for ACCURATE mode) must be added manually or via migration script.
5. **Settings migration** → `allowNegativeStock` boolean maps to `NegativeStockPolicy.ALLOW` if true, `BLOCK` if false.

---

## 15. Final Verdict

**The current system is a solid foundation with critical gaps that must be addressed before it can safely support the target two-mode model.**

### What Works Well
- `DocumentPolicyResolver` correctly differentiates INVOICE_DRIVEN vs PERPETUAL across all document types
- `StockMovement` entity has excellent fields for tracking unsettled costs (`costBasis`, `settledQty`, `negativeQtyAtPosting`)
- `VoucherPostingStrategyFactory` has clean strategy pattern with 9 registered strategies
- `VoucherEntity` has strong invariants (balance check, currency consistency, posting lock policies)
- Moving average cost calculation is correct

### What Is Dangerous
- `allowNegativeStock` setting is stored but **never enforced** — users who disable it are not protected
- `assertPositiveTrackedCost()` is inconsistent — some documents throw, some silently corrupt
- Account mappings are scattered optional strings with **zero validation** — missing accounts cause silent failures or runtime crashes
- No period-end settlement — backdated transactions and cost changes are never reconciled
- No inventory valuation report — users cannot verify stock values
- Reports show 100% gross profit when COGS is zero — no warning

### Priority Fixes (in order)
1. Enforce `allowNegativeStock` setting in `RecordStockMovementUseCase`
2. Replace `assertPositiveTrackedCost()` with policy-aware check (mode + missing cost policy)
3. Create centralized `AccountMappingRegistry` with validation
4. Add Inventory Valuation Report
5. Add period-end settlement use case
6. Add "Provisional" labels to reports in SIMPLE mode
7. Add mode selection to company wizard with COA template filtering

---

*Report generated: 2025-04-22*
*Auditor: Senior ERP Solution Architect + Senior Software Engineer*
*Scope: Full codebase analysis from company creation to operational posting and reporting*
