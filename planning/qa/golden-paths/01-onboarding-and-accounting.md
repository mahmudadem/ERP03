# Golden Path 01 — Onboarding & Accounting

> **Goal:** a brand-new user can sign up, create a company, and the accounting engine works end-to-end.
> **Precondition:** backend rebuilt (`npm run build`) and emulator running. No tenant yet — this script creates it.

## A. Signup & company creation

| # | Step | Expected |
|---|------|----------|
| 1 | Sign up with a fresh email; log in | Lands on onboarding/company creation, no errors |
| 2 | Run the Company Wizard: name, country, contact email, then **Company Setup** immediately before Review; select/confirm base currency (pick a non-USD currency, e.g. SYP or TRY), timezone, date format, language, and keep **Auto initialize Trading Company - Simple** enabled | Wizard completes; company opens; Company Policy Summary appears |
| 3 | Check sidebar | Accounting, Inventory, Sales, Purchases visible per the chosen bundle; no broken/blank menu items |
| 4 | Open Chart of Accounts | Template accounts seeded (assets, liabilities, equity, revenue, expense; AR/AP/GRNI/COGS defaults present), plus simple-company accounts such as Opening Balance Equity, Inventory Revaluation Reserve, Inventory Adjustment Gain/Loss |
| 5 | Open Inventory, Sales, and Purchases Settings | Inventory is invoice-driven with negative stock off; Sales/Purchases are SIMPLE with direct invoicing enabled; linked accounts match the policy summary |
| 6 | Open Company Settings → confirm date format, language switch EN→AR→TR | UI translates; RTL correct in Arabic; no raw i18n keys (`sidebar.xxx`) anywhere |

## B. Journal voucher lifecycle

| # | Step | Expected |
|---|------|----------|
| 7 | Create a Journal Voucher: Dr Cash 1,000 / Cr Capital 1,000, today's date | Saves as draft; voucher number assigned from sequence |
| 8 | Try to post an UNBALANCED voucher (edit: Dr 1,000 / Cr 900) | Posting rejected with a clear balance error — never posts |
| 9 | Fix and post the balanced voucher | Status POSTED; success toast |
| 10 | Open the posted voucher | Read-only; edit of financial fields blocked |
| 11 | Ledger → Cash account | Shows the 1,000 debit entry |

## C. Controls

| # | Step | Expected |
|---|------|----------|
| 12 | Accounting Settings → set period lock through yesterday; try posting a JV dated last week | Rejected with period-lock error code |
| 13 | Post the same JV dated today | Posts fine |
| 14 | Enable Approval Required (company policy); create + try to post a JV | Parks as PENDING_APPROVAL, not posted |
| 15 | Approve it from Approval Center | Posts on approval; appears in ledger |
| 16 | Turn approval back OFF for the next scripts | Saved |

## D. Reports sanity

| # | Step | Expected |
|---|------|----------|
| 17 | Trial Balance | Debits = Credits; includes the JVs above |
| 18 | Balance Sheet | Assets = Liabilities + Equity; Cash and Capital visible |
| 19 | Account Statement (Cash) | Entries with running balance; export to Excel/PDF works |

**Pass condition:** all 19 steps green. File any failure in `planning/qa/findings.md` as `GP01-step#`.
