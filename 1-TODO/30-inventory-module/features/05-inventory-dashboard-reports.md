# Feature 05: Inventory Dashboard & Reports

## Goal
Build a dashboard and essential reports for inventory visibility.

---

## Reports

| Report | Description |
|--------|-------------|
| **Inventory Valuation** | Per-item value = qty × avg cost, grouped by category/warehouse |
| **Stock Movement Report** | Filterable log: date range, item, warehouse, type |
| **Low Stock Alert** | Items below `minStockLevel` |
| **Item Ledger** | Per-item movement history (like account statement for items) |

## Backend

### Use Cases
| Use Case | File |
|----------|------|
| `GetInventoryValuationUseCase` | Aggregates stock_levels × avg cost |
| `GetLowStockAlertsUseCase` | Joins stock_levels with item.minStockLevel |
| `GetItemLedgerUseCase` | Movement history for single item |
| `GetInventoryDashboardUseCase` | Summary stats: total items, total value, low stock count, recent movements |

### API Routes
| Method | Path |
|--------|------|
| GET | `/api/inventory/reports/valuation` |
| GET | `/api/inventory/reports/low-stock` |
| GET | `/api/inventory/reports/item-ledger/:itemId` |
| GET | `/api/inventory/dashboard` |

---

## Frontend

### Dashboard Page
**File:** `frontend/src/modules/inventory/pages/InventoryHomePage.tsx` (update existing)

Cards:
- Total Products (active)
- Total Inventory Value
- Low Stock Alerts (count with red badge)
- Recent Movements (last 10)

Charts:
- Stock Value by Category (pie chart)
- Movement Trend (line chart, last 30 days)

### Report Pages
Files in `frontend/src/modules/inventory/pages/reports/` [NEW]:
- `ValuationReportPage.tsx`
- `LowStockReportPage.tsx`
- `ItemLedgerPage.tsx`

---

## Verification

1. Verify dashboard shows correct counts and values
2. Verify valuation report matches: Σ(stockLevel.quantity × stockLevel.averageCost)
3. Verify low stock report only shows items below minimum
4. Verify item ledger shows complete movement history with running balance
