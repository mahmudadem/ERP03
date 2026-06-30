# 278g — Account tree RTL controls

## Status

Complete. Telegram photo 7 interaction and layout issues are fixed.

## Technical developer view

`AccountsListPage.tsx` now derives direction from i18n, renders a left-pointing
collapsed chevron in RTL, and uses semantic expand/collapse buttons with
translated accessible labels and `aria-expanded`. The hit target is an explicit
36 by 36 pixels so the application's root font scaling cannot reduce it.

The toolbar uses logical spacing, shrink protection, and non-wrapping labels for
Expand All, Collapse All, and New Account. English, Arabic, and Turkish locale
files contain the account-specific accessible labels.

## End-user view

Arabic users now see tree arrows pointing in the correct direction. The arrow
button is easier to click, and the three top action buttons no longer split
their text across two lines.

## Accounting impact

Presentation and accessibility only. No chart hierarchy, account role,
classification, code, balance, currency, posting, tenant scope, or audit
behavior changed.

## Verification

- English, Arabic, and Turkish locale JSON parsing passed.
- Frontend TypeScript check passed.
- Frontend production build passed.
- Local rendered QA passed at `#/accounting/accounts` in Arabic/RTL.
- The Assets branch collapsed and its child rows disappeared.
- The collapsed control used the RTL left-chevron and `aria-expanded=false`.
- Measured tree hit target: 36 by 36 pixels.
- Toolbar controls measured `white-space: nowrap`.
- No relevant console errors; only existing React Router future warnings.
- `graphify update .` could not run because the CLI is unavailable.

## Time

- Estimate: 30–45 minutes
- Actual: approximately 40 minutes

## Deployment

Deferred until all Telegram production QA fixes are complete.
