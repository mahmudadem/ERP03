# Financial Integration Workflow — Remaining Items

## Priority: High
- [ ] E2E testing: walk through all 9 flows (see session notes)
  1. Enable Inventory only (no Accounting) → status card shows gray "Not Enabled", init wizard shows without accounting steps, posting a document skips GL
  2. Then enable Accounting → status card changes to blue "Setup Required" with link
  3. Complete Accounting init via blue link → status changes to amber "Financial Integration Pending" with "Configure Integration" button
  4. Run Inventory FI wizard → status turns green "Active", createAccountingEffect flags now work
  5. Post a document (e.g. Sales Invoice) with Accounting ON → verify GL voucher is created
  6. Disable Accounting, post again → verify no GL voucher, no crash
  7. Visit /accounting/setup after init is complete → verify "Already Configured" guard appears
  8. Visit /inventory/financial-integration without Accounting init → verify redirect to settings page
  9. Same flows for Purchase & Sales FI wizards
- [ ] Decide on dependency map: Option A (remove accounting from deps) vs Option B (keep + UX step)
  - Current: inventory→[accounting], sales→[accounting], purchase→[accounting] forces Accounting auto-activation
  - Option A: Remove accounting from deps; users opt-in separately; simpler, matches our graceful-degradation architecture
  - Option B: Keep deps but add UX step in init wizard explaining Accounting setup

## Priority: Medium
- [ ] Write unit tests for ConfigureInventoryFinancialIntegrationUseCase
- [ ] Write unit tests for createAccountingEffect guard logic in post/unpost use cases
- [ ] Write component tests for AccountingIntegrationStatus (4 states)
- [ ] Write component tests for wizard re-entry guards

## Priority: Low (Polish)
- [ ] useCompanyModules caching: add React Context or react-query/SWR so multiple components sharing the hook reuse one fetch instead of each triggering independent API calls
- [ ] Clean up untracked OFFLINE_ARCHITECTURE.md and docs/audit/ — commit or .gitignore

## Completed
- [x] Backend: createAccountingEffect flag + ICompanyModuleRepository guard on all post/unpost use cases
- [x] Backend: Fix UnpostPurchaseReturnUseCase missing accounting guard
- [x] Backend: Fix ModuleActivationService.ensureInitialized to mark modules as initialized:false
- [x] Backend: ConfigureInventoryFinancialIntegrationUseCase + route
- [x] Frontend: AccountingIntegrationStatus component (4 states: not installed / setup required / pending / active)
- [x] Frontend: isModuleInstalled() + isModuleInitialized() in useCompanyModules hook
- [x] Frontend: All 3 init wizards conditionally show/hide accounting steps
- [x] Frontend: All 3 settings pages with integration status cards + configure links
- [x] Frontend: InventoryFinancialIntegrationWizard, PurchaseFinancialIntegrationWizard, SalesFinancialIntegrationWizard
- [x] Frontend: Module re-entry guards on all wizard components
- [x] Frontend: Restore AccountingInitializationWizard from commit a9915d0
- [x] Frontend: SalesApi.defaultRevenueAccountId made optional
- [x] Committed as 821c074 on branch feat/financial-integration-workflow