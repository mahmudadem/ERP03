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
