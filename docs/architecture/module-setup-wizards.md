# Module setup wizard shell

Accounting, Inventory, Sales, and Purchases use the shared
`frontend/src/components/shared/ModuleSetupWizardShell.tsx` layout.

## Contract

The shell owns presentation only:

- responsive framed layout;
- compact progress indicator and current-step title;
- scrollable step content;
- loading and error presentation;
- Back, Next, and Complete actions;
- direction-aware navigation icons for LTR and RTL.

Each module wizard continues to own its steps, validation, API payload, initialization request,
and completion behavior. The shell must not contain accounting, inventory, sales, purchase,
permission, tenant, or database rules.

## Usage

Pass translated step titles and action labels into the shell. Keep stable submitted values such as
account IDs, workflow modes, accounting modes, voucher type keys, and number prefixes outside the
shell.

When adding another module setup wizard, reuse this shell instead of creating another page-level
stepper and navigation footer.

## Purchase pre-initialization behavior

`PurchaseHomePage` checks the company-module record before calling Purchase APIs. A missing or
uninitialized Purchase module must render the setup wizard directly. This prevents an expected
pre-initialization state from appearing as a global API error toast.

## Financial impact

The shell does not change initialization values or posting behavior. Module initialization logic
remains inside the existing module wizard and backend use cases.
