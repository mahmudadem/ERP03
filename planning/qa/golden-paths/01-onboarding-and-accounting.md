# Golden Path 01 — Onboarding & Accounting

> **Goal:** a brand-new user can sign up, create a company, and the accounting engine works end-to-end.
> **Precondition:** backend rebuilt (`npm run build`) and emulator running. No tenant yet — this script creates it.

## A. Signup & company creation

| # | Step | Expected |
|---|------|----------|
| 1 | Sign up with a fresh email; log in | Lands on onboarding/company creation, no errors |
| 2 | Run the Company Wizard: name, base currency (pick a non-USD currency, e.g. SYP or TRY), Standard COA template, current fiscal year | Wizard completes; company opens |
| 3 | Check sidebar | Accounting, Inventory, Sales, Purchases visible per the chosen bundle; no broken/blank menu items |
| 4 | Open Chart of Accounts | Template accounts seeded (assets, liabilities, equity, revenue, expense; AR/AP/GRNI/COGS defaults present) |
| 5 | Open Company Settings → confirm date format, language switch EN→AR→TR | UI translates; RTL correct in Arabic; no raw i18n keys (`sidebar.xxx`) anywhere |

## B. Journal voucher lifecycle

| # | Step | Expected |
|---|------|----------|
| 6 | Create a Journal Voucher: Dr Cash 1,000 / Cr Capital 1,000, today's date | Saves as draft; voucher number assigned from sequence |
| 7 | Try to post an UNBALANCED voucher (edit: Dr 1,000 / Cr 900) | Posting rejected with a clear balance error — never posts |
| 8 | Fix and post the balanced voucher | Status POSTED; success toast |
| 9 | Open the posted voucher | Read-only; edit of financial fields blocked |
| 10 | Ledger → Cash account | Shows the 1,000 debit entry |

## C. Controls

| # | Step | Expected |
|---|------|----------|
| 11 | Accounting Settings → set period lock through yesterday; try posting a JV dated last week | Rejected with period-lock error code |
| 12 | Post the same JV dated today | Posts fine |
| 13 | Enable Approval Required (company policy); create + try to post a JV | Parks as PENDING_APPROVAL, not posted |
| 14 | Approve it from Approval Center | Posts on approval; appears in ledger |
| 15 | Turn approval back OFF for the next scripts | Saved |

## D. Reports sanity

| # | Step | Expected |
|---|------|----------|
| 16 | Trial Balance | Debits = Credits; includes the JVs above |
| 17 | Balance Sheet | Assets = Liabilities + Equity; Cash and Capital visible |
| 18 | Account Statement (Cash) | Entries with running balance; export to Excel/PDF works |

**Pass condition:** all 18 steps green. File any failure in `planning/qa/findings.md` as `GP01-step#`.
