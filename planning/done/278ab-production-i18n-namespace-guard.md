# 278ab — Production i18n namespace guard and shared selector translations

## Technical Developer View

- Restored Arabic as the default first-run language in `frontend/src/i18n/config.ts`.
- Registered `inventory` and `shared` i18n namespaces for English, Arabic, and Turkish.
- Added `frontend/scripts/check-i18n-config.mjs` and wired it into `npm run build` so namespace drift fails before deployment.
- Localized shared Party, Item, and Warehouse selector modal text that appears across Sales, Purchases, Inventory, and Accounting forms.

## End-User View

- New users should open the system in Arabic by default.
- Customer/vendor, item, and warehouse selection popups now show Arabic labels/messages when Arabic is selected.
- Future builds now check that translation files are actually connected before production deployment.

## Verification

- `npm run check:i18n-config`
- Locale JSON parse for EN/AR/TR `inventory` and `shared`
- `npm run check:voucher-locales`
- `npm run typecheck`
- `npm run build`
- Vercel production build/deploy: `dpl_FEy1wWTMuEALGeR3SPYxyYFhpNhe`
- Live static probe: `https://erp-03.vercel.app/` returned 200 and the deployed main bundle contains the new Arabic selector strings.

## Accounting / Controls Impact

Localization only. No ledger, voucher, posting, tax, inventory valuation, tenant isolation, permissions, settlement, or audit behavior changed.

## Time

Actual: approximately 0.8h.
