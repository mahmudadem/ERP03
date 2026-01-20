# Accounting: Multi-Currency & Exchange Rates

## 1. Overview
The ERP03 system supports multi-currency transactions at the line level. Every voucher has a header currency (Base), and individual lines can use different currencies. The system enforces strict exchange rate tracking to ensure financial accuracy.

## 2. Currency Entities
*   **Global Currencies**: Defined in `system_metadata/currencies/items`. These are the standard ISO codes (USD, EUR, SAR, etc.).
*   **Company Currencies**: Defined in `companies/{companyId}/company_currencies`. These are the subset of global currencies enabled by a specific company.

## 3. Exchange Rate Architecture
Exchange rates are stored in **Company-Scoped Subcollections** to ensure multi-tenant isolation and efficient querying.

**Storage Path**: `companies/{companyId}/exchange_rates/{rateId}`

### Data Structure (`ExchangeRate`)
*   `fromCurrency`: Source currency code (e.g., USD).
*   `toCurrency`: Target currency code (e.g., SAR).
*   `rate`: The multiplier (USD * rate = SAR).
*   `date`: The effective date for this rate.
*   `source`: 'MANUAL' or 'API'.
*   `createdAt`: Timestamp.

## 4. Rate Lookup Logic
When a voucher line uses a currency different from the voucher currency, the system performs a lookup:
1.  **Exact Match**: Search for a rate for the specific (From, To, Date).
2.  **Latest of Day**: If multiple rates exist for the same day, use the one with the latest `createdAt`.
3.  **Historical Fallback**: If no rate exists for the specific date, the system suggests the **Most Recent Rate** available in history.

## 5. Parity & Equivalent Calculation
*   **Parity**: The exchange rate between the Line Currency and the Voucher Currency.
*   **Equivalent (Base)**: The amount converted to the Company's Base Currency for ledger reporting.
*   **Invariants**: $Amount (Line) \times Parity = Amount (Voucher)$.

## 6. Validation Rules
*   **Currency Policy**: Accounts can have `FIXED` policies that force a specific currency on a line.
*   **Rate Required**: A voucher cannot be posted if it contains multi-currency lines without valid exchange rates.
*   **Deviation Detection**: (Planned) System warns if a manually entered rate deviates significantly from the most recent historical rate.
## 7. Professional Financial Integrity (Audit Rules)

### 7.1 Account Hierarchy Governance (COA Guards)
To prevent "Triangular Translation Risk" and maintain reporting integrity, the system enforces strict hierarchy rules:

1.  **Root Currency Lock**: 
    - **Rule**: All Level 0 and Level 1 (Header/Root) accounts MUST be fixed to the **Company Base Currency**.
    - **Logic**: Prevents top-level financial statements (Balance Sheet/P&L) from fluctuating due to exchange rate drifts.
    - **Enforcement**: Backend rejects `OPEN` or Non-Base `FIXED` policies for accounts without parents.

2.  **The Waterfall Rule (Contextual Homogeneity)**:
    - **Rule**: A child account cannot be "More Base" than its parent. 
    - **Logic**: If a parent is a "France Branch" in EUR, a child cannot be USD. This avoids invisible conversion layers that hide audit trails.
    - **Enforcement**: If a Parent is `FIXED` to a foreign currency, all children MUST inherit or be fixed to that same currency.

### 7.2 Core Validation Bombs
- **No 1.0 Default FX**: The system explicitly rejects any transaction where the exchange rate is exactly 1.0 between two different currencies. This prevents accidental "unconverted" entries from "poisoning" the ledger.
- **Consolidation Principle**: All reporting is based on the `baseAmount`, which is calculated at the moment of entry. This ensure dual-book synchronicity (local and functional reporting).
