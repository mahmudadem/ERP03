# Apex Ledger Integrated Dashboard

The Apex Ledger page is a dev cockpit designed to showcase a visually rich, Syrian-localized high-density ERP layout. It is fully integrated with your company's live database, backend APIs, and the CFO AI assistant.

## How to Access
1. Make sure your local development server is running.
2. Navigate to:
   `http://localhost:5173/#/dev/apex-ledger`
3. The page is accessible directly via the sidebar under the **Tools** section as **Apex Ledger Mockup 💻**.

## Interface Features & Operational Tabs
The layout contains several functional tabs:

- **Dashboard Home**: Summarizes key live business metrics (revenue, cash balances, receivables, payables) in a bento-style card grid.
- **Accounting & COA**: Displays your company's real Chart of Accounts. Click any account to pull live transaction ledgers, or add new accounts.
- **Sales (V1 & V2)**:
  - *V1*: Lists your active Sales Orders and Sales Invoices.
  - *V2 (Voucher Editor)*: A high-density invoice entry grid. Supports adding live catalog items, configuring multi-currency exchange rates, and applying Syrian VAT tax presets (5% VAT, 2% Discount) with automatic math calculation.
- **Purchases**: Tracks your actual Accounts Payable vendor bills.
- **Inventory**: Views live stock counts, units of measure, and SKU average cost valuations.
- **AI CFO Advisor**: A side chat widget allowing you to chat directly with your company's live Gemini AI assistant. It reads your current Chart of Accounts, stock count, and receivables context to answer financial analysis questions instantly.

## Layout Features
To provide a clean, premium visual preview, the outer system chrome (production top header, main sidebar, and standard floating AI widgets) is automatically bypassed when viewing the Apex Ledger page. It renders the mockup's built-in header, navigation, and sidebar tools in a full-screen layout.

> [!IMPORTANT]
> Because this page is now fully integrated with your database APIs, **adding, updating, or deleting records will modify your actual company databases**. Use with care during testing.
