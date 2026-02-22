# Feature 06: Credit Notes & Sales Reports

## Goal
Handle customer returns via credit notes and build sales reports/dashboard.

---

## Part A: Credit Notes

### `CreditNote` Entity
**File:** `backend/src/domain/sales/entities/CreditNote.ts` [NEW]

Mirrors Debit Note from Purchases (reversed sides). When posted:
- Debit: Sales Revenue (reversal)
- Credit: Accounts Receivable (reduce customer balance)
- Record stock movement `return_in` if goods returned

### API Routes
| Method | Path |
|--------|------|
| GET | `/api/sales/credit-notes` |
| POST | `/api/sales/credit-notes` |
| POST | `/api/sales/credit-notes/from-invoice/:invoiceId` |
| POST | `/api/sales/credit-notes/:id/post` |

### Frontend
- `CreditNotesPage.tsx` — List
- Form with original invoice reference, return reason

---

## Part B: Sales Reports

### Reports
| Report | Description |
|--------|-------------|
| **AR Aging** | Outstanding invoices by age (Current, 30, 60, 90+) |
| **Sales Register** | All invoices in date range |
| **Customer Statement** | Invoices + receipts for one customer |
| **Sales by Item** | Revenue breakdown by item/category |
| **Sales by Customer** | Revenue breakdown by customer |

### Backend
| Use Case | Description |
|----------|-------------|
| `GetARAgingUseCase` | Groups unpaid invoices by age |
| `GetSalesRegisterUseCase` | Invoice list with filters |
| `GetCustomerStatementUseCase` | Statement for one customer |
| `GetSalesByItemUseCase` | Revenue analysis |
| `GetSalesDashboardUseCase` | Summary stats |

### API Routes
| Method | Path |
|--------|------|
| GET | `/api/sales/reports/ar-aging` |
| GET | `/api/sales/reports/register` |
| GET | `/api/sales/reports/customer-statement/:customerId` |
| GET | `/api/sales/reports/by-item` |
| GET | `/api/sales/reports/by-customer` |
| GET | `/api/sales/dashboard` |

### Frontend

#### Dashboard
**File:** `frontend/src/modules/sales/pages/SalesHomePage.tsx` [NEW]

Cards: Total AR, Overdue AR, This Month Revenue, Open SOs
Charts: Monthly revenue trend, Top 5 customers

#### Report Pages
- `ARAgingPage.tsx`
- `SalesRegisterPage.tsx`
- `CustomerStatementPage.tsx`
- `SalesByItemPage.tsx`

---

## Verification

1. Create credit note from invoice → lines pre-filled
2. Post credit note → AR reversal voucher created
3. AR aging totals → match unpaid invoice sum
4. Customer statement → shows all invoices and receipts
5. Dashboard revenue → matches sum of posted invoices
