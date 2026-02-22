# Feature 06: Purchase Reports & Dashboard

## Goal
Build a purchases dashboard and essential procurement reports.

---

## Reports

| Report | Description |
|--------|-------------|
| **AP Aging** | Outstanding invoices grouped by age (Current, 30, 60, 90+) |
| **Purchase Register** | All invoices in date range with totals |
| **Supplier Statement** | All transactions for a specific supplier |
| **PO Status** | Outstanding POs awaiting receipt/invoicing |

## Backend

### Use Cases
| Use Case | Description |
|----------|-------------|
| `GetAPAgingUseCase` | Groups unpaid invoices by age buckets |
| `GetPurchaseRegisterUseCase` | Lists invoices with filters |
| `GetSupplierStatementUseCase` | Invoices + payments for one supplier |
| `GetPurchaseDashboardUseCase` | Summary: total AP, overdue, monthly spend |

### API Routes
| Method | Path |
|--------|------|
| GET | `/api/purchases/reports/ap-aging` |
| GET | `/api/purchases/reports/register` |
| GET | `/api/purchases/reports/supplier-statement/:supplierId` |
| GET | `/api/purchases/dashboard` |

---

## Frontend

### Dashboard
**File:** `frontend/src/modules/purchases/pages/PurchasesHomePage.tsx` [NEW]

Cards: Total AP, Overdue AP, This Month Spend, Open POs
Charts: Monthly spend trend, Top 5 suppliers by spend

### Report Pages
- `APAgingPage.tsx` — Aging table with drill-down to invoices
- `PurchaseRegisterPage.tsx` — Filterable invoice list
- `SupplierStatementPage.tsx` — Statement for selected supplier

---

## Verification

1. Verify AP aging matches: sum of unpaid invoices by due date buckets
2. Verify supplier statement shows all invoices and payments
3. Verify dashboard totals are consistent with invoice data
