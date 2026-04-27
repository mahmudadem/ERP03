# ERP03 — Product Vision

> **Owner:** Product Owner (you)
> **Written by:** CTO Agent (Antigravity), 2026-04-27
> **Status:** Living document — update as the vision evolves

---

## What Is ERP03?

A **cloud-based SaaS ERP system** that serves businesses of all sizes — from a one-person shop doing invoices to a multi-department company with accountants, warehouse staff, and approval chains.

### Core Promise

> **Simple for simple businesses. Professional for big companies. Same system.**

A small shop owner sees a clean, simple interface with just what they need. A large company sees the full suite — cost centers, budgets, multi-company consolidation, approval workflows. The system scales to the user, not the other way around.

---

## Who Uses It?

### End Users (per company)

| Role | What they do |
|------|-------------|
| **Business Owner / Tenant Admin** | Reviews, approves work (when approval system is enabled), sees the dashboard, manages company settings |
| **Accountant** | Records journal entries, manages chart of accounts, runs financial reports, reconciles banks |
| **Salesperson** | Creates sales invoices, manages customers, processes returns. May use POS |
| **Warehouse Worker** | Handles delivery notes, goods receipts, stock transfers, adjustments, opening stock |
| **Purchasing Agent** | Creates purchase orders, receives goods, processes purchase invoices and returns |
| **Company Admin** | Enables/disables modules, configures workflows, manages users and roles, customizes forms |

### Platform Level

| Role | What they do |
|------|-------------|
| **Super Admin (Platform Owner)** | Manages the entire platform — module registry, bundles, permissions, plans, companies |

### Multi-Company

- One user (e.g., an accountant) can work for **multiple companies** under the same account
- Holding groups / consolidated reporting is a **future feature** (not in scope yet)

---

## Business Model

### Bundles & Plans

- Customers choose a **bundle** when signing up (e.g., "Starter", "Professional")
- Each bundle includes specific **modules and capabilities**
- If the plan allows, customers can **add more modules/capabilities** later
- Pricing model is **TBD** — the system must support any future model (per-company, per-user, tiered)

### Module as Engine vs. Module as UI

A key architecture concept: modules can run in two modes:

- **Visible (UI mode):** The user sees and interacts with the module directly (e.g., an accountant uses Accounting)
- **Engine (hidden mode):** The module runs behind the scenes but the user never sees it (e.g., POS needs Accounting for journal entries, but the shop owner never opens the Accounting page)

Example: A POS-only bundle enables Accounting + Inventory as hidden engines, and POS as the visible interface.

---

## Core Modules (Launch Required)

These 4 must work perfectly before the first customer:

### 1. Accounting
- Chart of Accounts, Journal Vouchers, multiple voucher types
- Financial reports: Balance Sheet, P&L, Trial Balance, Cash Flow, Ledger, Journal, Account Statement
- Cost Centers, Budgets, Budget vs Actual
- Bank Reconciliation, Aging Reports, Recurring Vouchers
- Fiscal Year management, multi-currency
- Approval workflow (optional, per company)
- Balance enforcement at posting

### 2. Inventory
- Items master, Categories, Units of Measure
- Warehouses, Stock Levels, Stock Movements
- Stock Adjustments, Stock Transfers
- Opening Stock documents
- Low Stock Alerts, Unsettled Costs tracking
- Financial integration with Accounting

### 3. Sales
- Customers management
- Full workflow: Sales Order → Delivery Note → Sales Invoice → Sales Return
- **OR** simplified: jump straight to Invoice (company admin configures)
- Automatic accounting entries (unless approval system requires manual posting)
- Financial integration with Accounting

### 4. Purchases
- Vendors management
- Full workflow: Purchase Order → Goods Receipt → Purchase Invoice → Purchase Return
- **OR** simplified: jump straight to Invoice (company admin configures)
- Automatic accounting entries (unless approval system requires manual posting)
- Financial integration with Accounting

---

## Forms Designer

### Purpose
Let company admins (or authorized users) **customize document types** without touching code.

### How It Works
1. The system ships with **hardcoded voucher types** (standard JV, Sales Invoice, Purchase Invoice, etc.)
2. A company admin can **clone** any standard type to create a custom version
3. On the clone, they can:
   - **Rename** the document type
   - **Show/hide** input fields
   - **Add custom fields** (informational only — no effect on posting logic)
   - **Rearrange** the layout
4. **Mandatory fields** required by the backend (amounts, accounts, dates) **cannot be removed**
5. The custom type becomes available for that company's users

### Example
An admin clones "Journal Voucher" → renames it to "Expense Claim" → hides "Reference Number" → adds a custom "Department" text field → saves. Now their accountants see "Expense Claim" in the voucher type dropdown.

---

## Approval System

- **Optional per company** — the company admin enables/disables it
- When **enabled**: documents go through an approval chain before financial posting occurs
- When **disabled**: documents post financial entries immediately upon save
- The business owner (or authorized person) reviews and approves pending documents

---

## Workflow Flexibility

Company admin controls the document workflow complexity:

| Setting | Simple Mode | Full Mode |
|---------|------------|-----------|
| Sales | Invoice only | Order → Delivery → Invoice |
| Purchases | Invoice only | PO → Receipt → Invoice |

This is configured per company in the module settings.

---

## Future Modules (Not in Launch Scope)

These have placeholder pages but no business logic:

- **POS** — Point of Sale terminal
- **CRM** — Customer Relationship Management
- **HR** — Human Resources / Payroll
- **Manufacturing** — Work Orders, Bill of Materials
- **Projects** — Project management, time tracking

---

## Architecture Rules (Non-Negotiable)

1. **DB-Agnostic:** All persistence goes through repository interfaces. Firestore AND SQL implementations must work. Switching to SQL must not break anything.
2. **Repository Pattern:** Interfaces in `backend/src/repository/interfaces/`, implementations in `backend/src/infrastructure/`
3. **Domain-Driven Design:** Domain entities have no database dependencies
4. **Module Architecture:** Follows SPEC.md — modules, capabilities, bundles, entitlements
5. **Multi-Tenant:** Every query is scoped to a company. No data leaks between tenants.

---

## Quality Bar

- No rush. Quality over speed.
- Every feature must work end-to-end before moving to the next one.
- The system must feel professional — not a prototype.
