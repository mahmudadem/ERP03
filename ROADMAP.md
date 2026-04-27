# ERP03 — Development Roadmap

> **Created:** 2026-04-27 | **Last Updated:** 2026-04-27 (final version after full gap scan)
> **Based on:** Full codebase audit + Product Vision + Deep Analysis + Gap Scan
> **Goal:** Get the 4 core modules to production-ready quality
> **Reality Check:** Most features have NEVER been tested by a real user. Bugs are expected everywhere. Testing IS the work.

---

## How to Read This Plan

- Each **Phase** has a clear goal
- Each phase includes **testing time** — because code existing ≠ code working
- Tasks marked 🔶 are partially done — test then fix
- Tasks marked ❌ are not started — build then test
- **Rule:** Every task = test it → find bugs → fix bugs → confirm it works. Then move on.
- **Rule:** Log every bug found in ACTIVE.md under the task
- **Expect:** 30-50% of your time in each phase will be fixing bugs you discover while testing

---

## Phase 1: Stabilize Core — "Fix What's Broken, Test What's Built"

> **Goal:** Fix known bugs. Test EVERY existing feature in the 4 core modules. Fix what breaks.
> **Estimated:** 2-3 weeks (including bug discovery and fixing)

### 1A: Fix Known Bugs First

| # | Task | Status | Est. |
|---|------|--------|------|
| 1.1 | Fix Forms Designer field placement + preview | 🔶 Active WIP | 2-3 days |
| 1.2 | Fix Voucher Save for Sales/Purchase semantic docs | 🔶 Known bug | 1 day |
| 1.3 | Default Form Designs for standard doc types | ❌ Not done | 1-2 days |

### 1B: Test Accounting Module End-to-End

| # | Test Scenario | What to verify |
|---|--------------|----------------|
| 1.4 | Create a company → run Accounting Setup Wizard | Wizard completes, COA created, fiscal year set |
| 1.5 | Create Chart of Accounts entries | Add, edit, delete accounts. Groups, subgroups work |
| 1.6 | Create Journal Voucher → Post it | Saves, validates balance, posts to ledger |
| 1.7 | Create Receipt Voucher, Payment Voucher | All standard types work |
| 1.8 | Run every report: TB, BS, P&L, Cash Flow, Journal, Ledger, Account Statement, Aging, Budget vs Actual, Consolidated TB, Cost Center Summary | Numbers are correct. Filters work. Export/print works. |
| 1.9 | Recurring vouchers | Create, schedule, verify auto-generation |
| 1.10 | Bank reconciliation | Import/match transactions |
| 1.11 | Cost centers | Create, assign to vouchers, verify reports |
| 1.12 | Budget | Create budget, verify Budget vs Actual shows correct data |
| 1.13 | Fiscal year close | Close year, verify opening balances carry forward |
| 1.14 | Approval workflow (enable → submit → approve/reject) | Full cycle works |
| 1.15 | Accounting Settings (all tabs) | Every setting saves and takes effect |
| 1.16 | Web mode AND Windows mode | Both display modes work consistently |

### 1C: Test Inventory Module End-to-End

| # | Test Scenario | What to verify |
|---|--------------|----------------|
| 1.17 | Create items (service item, stock item) | Save, edit, delete. Price fields. UoM assignment |
| 1.18 | Create categories, assign items | Hierarchy works |
| 1.19 | Create warehouses | Multiple warehouses |
| 1.20 | Create UoMs and conversions | Conversion math is correct |
| 1.21 | Opening stock document | Enter quantities, verify stock levels |
| 1.22 | Stock adjustment | Adjust up/down, verify movement history |
| 1.23 | Stock transfer between warehouses | Verify source decreases, destination increases |
| 1.24 | Stock levels page | Shows correct quantities per warehouse |
| 1.25 | Stock movements history | All movements appear with correct types |
| 1.26 | Low stock alerts | Set reorder point, verify alert triggers |
| 1.27 | Negative stock prevention | Enable setting → try to sell more than available |
| 1.28 | Inventory Settings + Financial Integration | Settings save, integration wizard works |

### 1D: Test Sales Module End-to-End

| # | Test Scenario | What to verify |
|---|--------------|----------------|
| 1.29 | Create customers (with payment terms, credit limit) | Save, edit, list |
| 1.30 | Create Sales Order | Items, quantities, tax calculation, totals |
| 1.31 | Sales Order → Create Delivery Note (from order) | Auto-fills from order, stock decreases |
| 1.32 | Delivery Note → Create Sales Invoice (from DN) | Auto-fills, accounting entry created |
| 1.33 | Direct Sales Invoice (simple mode, skip order/DN) | Creates invoice + stock movement + accounting entry |
| 1.34 | Sales Return | Stock increases, accounting reversal |
| 1.35 | Tax calculation on all documents | Tax code applied, amounts correct |
| 1.36 | Multi-currency invoice | Exchange rate, doc vs base amounts |
| 1.37 | Due date and payment terms auto-fill | From customer defaults or settings |
| 1.38 | Overdue invoice detection on dashboard | Shows correctly |
| 1.39 | Credit limit warning/block | Triggers when configured |
| 1.40 | Sales Settings page | All settings save and take effect |
| 1.41 | Workflow mode toggle (simple vs full) | Correctly hides/shows order + DN steps |

### 1E: Test Purchases Module End-to-End

| # | Test Scenario | What to verify |
|---|--------------|----------------|
| 1.42 | Create vendors (with payment terms) | Save, edit, list |
| 1.43 | Create Purchase Order | Items, quantities, tax, totals |
| 1.44 | PO → Create Goods Receipt | Auto-fills from PO, stock increases |
| 1.45 | GRN → Create Purchase Invoice | Auto-fills, accounting entry created |
| 1.46 | Direct Purchase Invoice (simple mode) | Creates invoice + stock + accounting |
| 1.47 | Purchase Return | Stock decreases, accounting reversal |
| 1.48 | Purchase Settings page | All settings save |
| 1.49 | Workflow mode toggle | Correctly hides/shows order + GRN steps |

### 1F: Test Platform & Admin

| # | Test Scenario | What to verify |
|---|--------------|----------------|
| 1.50 | Company Admin: invite user | User appears in list |
| 1.51 | Company Admin: create role, assign permissions | Permissions restrict what user sees |
| 1.52 | Company Admin: enable/disable module | Module appears/disappears from sidebar |
| 1.53 | Company Admin: company settings | Logo, name, fiscal year |
| 1.54 | Super Admin: modules registry | All modules listed with correct status |
| 1.55 | Super Admin: bundles manager | Create/edit bundles |
| 1.56 | Localization: switch language (en, ar, tr) | All labels translate. RTL for Arabic. |

**Phase 1 Done When:** Every test scenario above passes. All bugs found are fixed. This is the foundation everything else builds on.

---

## Phase 2: Payments & Discounts — "Close the Money Cycle"

> **Goal:** Add payment recording inside Sales/Purchases. Add line discounts.
> **Estimated:** 2-3 weeks

| # | Task | Status | Est. |
|---|------|--------|------|
| 2.1 | "Record Payment" button on Sales Invoice page | ❌ Build + test | 3 days |
| 2.2 | "Record Payment" button on Purchase Invoice page | ❌ Build + test | 3 days |
| 2.3 | Invoice status tracking (Unpaid / Partially Paid / Paid) | ❌ Build + test | 2 days |
| 2.4 | Auto-create receipt/payment voucher from Sales/Purchase | ❌ Build + test | 2 days |
| 2.5 | Partial payments support | ❌ Build + test | 1-2 days |
| 2.6 | Payment history per invoice | ❌ Build + test | 1 day |
| 2.7 | Line-level discounts on Sales documents | ❌ Build + test | 2-3 days |
| 2.8 | Line-level discounts on Purchase documents | ❌ Build + test | 1-2 days |
| 2.9 | Customer/Vendor balance summary | ❌ Build + test | 2 days |

**Done when:** Salesperson records payment on invoice, status updates, accounting voucher auto-created. Discounts calculate correctly in totals and accounting entries.

---

## Phase 3: Document Output — "Give the Customer Something Professional"

> **Goal:** Print and send professional documents
> **Estimated:** 1-2 weeks

| # | Task | Status | Est. |
|---|------|--------|------|
| 3.1 | Sales Invoice PDF/print template (with logo, items, totals, tax) | ❌ Build + test | 3 days |
| 3.2 | Purchase Order PDF/print template | ❌ Build + test | 1-2 days |
| 3.3 | Delivery Note print template | ❌ Build + test | 1 day |
| 3.4 | Quotation print template (if built in Phase 4) | ❌ | 1 day |
| 3.5 | Email system setup (SendGrid / SMTP config) | ❌ Build + test | 2 days |
| 3.6 | Send document by email (invoice, PO) | ❌ Build + test | 1-2 days |
| 3.7 | User invite email notification | ❌ Build + test | 1 day |

**Done when:** A user can print a professional invoice and email it from the system.

---

## Phase 4: Quotations — "Quote Before You Sell"

> **Goal:** Add Quotation/Estimate flow before Sales Orders
> **Estimated:** 1 week

| # | Task | Status | Est. |
|---|------|--------|------|
| 4.1 | Quotation entity (backend domain + repo) | ❌ Build | 2 days |
| 4.2 | Quotation list + detail pages (frontend) | ❌ Build | 2 days |
| 4.3 | Quotation → convert to Sales Order | ❌ Build | 1 day |
| 4.4 | Quotation status (Draft / Sent / Accepted / Rejected / Expired) | ❌ Build | 1 day |
| 4.5 | Test full flow: Quote → Order → DN → Invoice → Payment | ❌ Test | 1 day |

**Done when:** Salesperson creates a quote, customer accepts, it converts to order, flows through the full chain.

---

## Phase 5: Security — "Lock the Doors"

> **Goal:** Protect data, enforce permissions properly
> **Estimated:** 1 week

| # | Task | Status | Est. |
|---|------|--------|------|
| 5.1 | Firestore Security Rules (proper rules, not allow-all) | ❌ URGENT | 1 day |
| 5.2 | Verify: User A in Company 1 can NEVER see Company 2 data | ❌ Test | 1 day |
| 5.3 | Verify: Role permissions actually block unauthorized pages/actions | ❌ Test | 1-2 days |
| 5.4 | API input validation across all endpoints | ❌ Review + fix | 1-2 days |

**Done when:** Data is locked down. Roles work. No data leaks between companies.

---

## Phase 6: Notifications & Audit Trail — "Know What Happened"

> **Goal:** Real-time notifications + audit logging
> **Estimated:** 1-2 weeks

| # | Task | Status | Est. |
|---|------|--------|------|
| 6.1 | Connect notification backend to real events | 🔶 UI exists | 2-3 days |
| 6.2 | Define notification triggers (invoice created, voucher approved, payment received, etc.) | ❌ | 2 days |
| 6.3 | Implement audit trail (Firestore repo for IAuditLogRepository) | 🔶 Interface exists | 2-3 days |
| 6.4 | Audit log viewer page | ❌ | 1-2 days |

---

## Phase 7: Polish & Production — "Ready for Real Users"

> **Goal:** Production-ready quality
> **Estimated:** 2-3 weeks

| # | Task | Status | Est. |
|---|------|--------|------|
| 7.1 | Unified owner dashboard (sales + cash + stock + approvals) | ❌ | 2-3 days |
| 7.2 | CI/CD Pipeline | ❌ | 2 days |
| 7.3 | API Security (rate limit, helmet) | ❌ | 1 day |
| 7.4 | Production logging (no secrets leaked) | 🔶 | 1-2 days |
| 7.5 | Error handling review | 🔶 | 2 days |
| 7.6 | Performance testing (10 companies, 100 users) | ❌ | 2 days |
| 7.7 | Full onboarding test (signup → first paid invoice) | ❌ | 2-3 days |
| 7.8 | Data import from Excel/CSV (items, customers, COA) | ❌ | 3-5 days |

---

## Future (After Launch)

| Phase | Module |
|-------|--------|
| 8 | Serial / Batch tracking & Barcoding (Inventory) |
| 9 | Advanced Document Workflows (Voiding, Clone, Split, Partial Fulfillment) |
| 10 | POS (Point of Sale) |
| 11 | Fixed Assets & Depreciation |
| 12 | Project Accounting & Job Costing |
| 13 | Expense Claims & Employee Expenses |
| 14 | CRM & Advanced Sales (Commissions, Drop Shipping) |
| 15 | HR & Payroll |
| 16 | Manufacturing & BoM |
| 17 | Advanced Accounting (Bank Feeds, Inter-company, Withholding Tax) |
| 18 | Price List Management |

---

## Timeline Summary

| Phase | Goal | Est. Duration |
|-------|------|---------------|
| **1. Stabilize & Test** | Test everything, fix all bugs | 2-3 weeks |
| **2. Payments & Discounts** | Payment gates, discounts | 2-3 weeks |
| **3. Document Output** | PDF, print, email | 1-2 weeks |
| **4. Quotations** | Quote → Order flow | 1 week |
| **5. Security** | Lock down data | 1 week |
| **6. Notifications & Audit** | Events + logging | 1-2 weeks |
| **7. Polish** | Production ready | 2-3 weeks |
| **Total to launch** | | **~10-17 weeks** |

---

## Rules

1. **Test before moving on.** Code existing ≠ code working.
2. **One phase at a time.** Don't jump ahead.
3. **One task at a time.** Finish before starting the next.
4. **Log every bug.** Found a bug while testing? Log it in ACTIVE.md, fix it, mark it done.
5. **DB-agnostic always.** Every new repo = Firestore + interface implementation.
6. **Expect bugs.** Budget 30-50% of time per phase for bug fixing.
7. **No new modules until Phase 7 is complete.**
