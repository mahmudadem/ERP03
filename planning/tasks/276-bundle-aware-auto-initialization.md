# Task 276 - Bundle-Aware Auto Initialization

**Status:** Future task
**Estimate:** 3-5 hours
**Created:** 2026-06-28

## Goal

When **Auto initialize Trading Company - Simple** is enabled in the company creation wizard, ERP03 must initialize every installed module in the selected bundle with the mandatory defaults needed for immediate use.

## Required behavior

- Accounting-only bundle: initialize Accounting from the wizard-selected COA, base currency, fiscal year/date settings, voucher templates, and periods. Do not ask again in the Accounting setup wizard.
- Inventory-only or Inventory/POS bundle: initialize Inventory with warehouse, UOMs, costing policy, item-code policy, stock policy, and GL links only when Accounting is installed/initialized.
- POS bundle: initialize POS settings, walk-in customer when the customer model is available, and a default register when the required warehouse/cash-account links exist. POS must not silently enable risky direct-sale/accounting behavior without required controls.
- Bundles with five or more modules: initialize each installed module that has a safe starter policy. Missing business-critical information must be collected in the small company wizard step, not deferred to module setup screens.
- Modules not present in the selected bundle must not be initialized just because the starter template knows about them.

## Accounting and Control Notes

- Wizard-selected COA/currency/date settings are authoritative for starter initialization.
- No module should re-prompt for the same COA/currency/date setup after successful auto-initialization.
- If Accounting is not installed, operational modules must run in non-GL/minimal mode and must not require COA-linked accounts.
- If Accounting is installed, mandatory posting and settlement links must be filled from the starter COA or initialization must fail and roll back cleanly.

## Definition of Done

- Starter initializer is bundle-aware and initializes only installed modules plus required engine prerequisites.
- Accounting, Inventory, POS, Sales, and Purchase each have explicit starter default contracts.
- Focused tests cover Accounting-only, POS+Inventory without Accounting, Retail/POS with Accounting+Inventory+POS, and a larger multi-module bundle.
- User-facing wizard copy explains which required defaults are being applied.
