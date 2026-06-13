# Golden-Path QA Findings

Use this file during the v0.9-alpha stabilization pass.

Format each finding as one line:

`GP##-step## | Pass/Fail/Blocked | observed result | expected result | screenshot/link if available`

Example:

`GP03-step09 | Fail | invoice posted but no receipt voucher was linked | CASH FULL should create invoice + receipt vouchers | screenshot: ...`

GP01-step9: allowed if company allows , by default approvla set to flexable  when company fres starts .
GP01-step11 success with one issue , i got error message "Voucher saved as draft, but couldn't be submitted: Request failed with status code 400" instead of readble erorr.
all  GP01-steps pass
------------------
gp02-step2 not plac to set purchase or sale price , there is Price Groups area to set price groups and even this saving doesnt presist and after edting the item when clock update modal shows with empty feilds on windwos mode, some feilds on web mode.
gp02-step3: selecting service from item doesnt auto turn stock control off or disable it .
gp02-step6 : page doesnt show deferet warehouse for same item in same line but duplicates item for each WH, this is a UIUX issue , but it effects the avg cost, i am not sure but seems avg cost isnt being calculated based on current amounts in stock, i did to OP for same item the avg cost was not evaluated when 2nd OP posted, is avg cost wighted by WH?
gp02-step7 : stock movements affecting the avg cost!Avg Cost Base	!!
gp02-step8 :Stock Adjustments an doable, inputs has no labels ! and i treid to post but there was no ledger effect , also there no place to set the related accounts in inventory settins !
gp02 is un testable need alot of work !
------------------
2026-06-13 Codex GP02 retest after inventory deep-stabilization patch (tenant TESTCO / cmp_mqblxfqy_zmecyl, local emulator, suffix 130818):
GP02-step2 | Pass | item GP02-130818 saved with purchasePrice 10 and salePrice 15; service SRV-130818 was forced to trackInventory=false even when the request tried to enable stock tracking | item price metadata persists and SERVICE items stay non-stock |
GP02-step6 | Pass | Stock Levels By Item showed GP02-130818 as one item across 2 warehouses, total qty 27, blended avg cost 8.37, total value 225.99 | one item rollup with warehouse breakdown and company-wide GLOBAL average cost |
GP02-step8 | Pass after detour | Stock Adjustment OUT of 3 from warehouse G2-130818 posted voucher 4de82d76-cf9f-4627-9955-b667f6d5827a for 18 TRY even though the typed unit cost was 999 | adjustment GL uses engine cost, not user-entered override cost, and produces a readable ledger voucher |
GP02-step9 | Pass | negative-stock adjustment post was rejected with NEGATIVE_STOCK_BLOCKED; current qty 11, requested OUT 1000, negative stock disabled | OUT bigger than stock is rejected when negative stock is disabled |
GP02-global | Pass | 10 @ 5 in MAIN plus 10 @ 7 in G2 repriced both warehouses to avg 6; later 10 @ 12 in MAIN repriced both to avg 8.22; FLAT transfer posted no voucher; VALUED transfer posted voucher 8276b581-1f86-447e-9c56-d2884a8c650f for 4 TRY and both warehouses ended at avg 8.37 | GLOBAL company-wide costing reprices all locations and valued transfer capitalizes only the uplift through inventory/clearing |
GP02-reconciliation | Blocked on dirty tenant data | the new GP02 item vouchers tie, but whole-tenant Inventory GL Reconciliation is false: stock 13119.35 vs GL 346, mainly from older item 001 pre-fix drift | rerun on a fresh tenant or clean historical drift before using whole-tenant reconciliation as a pass gate |
------------------
2026-06-13 GP03 Sales (TESTCO, local emulator, driven by Claude in preview browser):
GP03-precondition | Fail→Fixed (bug) | Sales Settings page crashed blank with `TypeError: Cannot read properties of null (reading 'messagingAccounts')` at SalesSettingsPage.tsx:62 when the tenant has no saved sales settings (currentSettings unwraps to null, then .messagingAccounts is read on null). FIXED with `?? {}` null-guard on currentSettings. | page should fall back to default settings and render when no settings doc exists yet |
GP03-precondition-2 | Setup gap (not a bug) | TESTCO Sales module was never initialized — saving settings returned 403 `Module 'sales' is not initialized`, and no account mappings existed. Resolved by running the Sales Initialization Wizard (/sales when uninitialized): Operational mode, Revenue 400, inventory accounts inherited (10301/50100), 3 voucher types installed. Then set Discount 400, Refund 10101, AR Parent 10401, Warehouse MAIN in Sales Settings and saved OK. | new tenants need the sales wizard before order-to-cash; consider auto-initializing during company onboarding (GP01) |
GP03-step1a | Fail→Fixed (bug) | New customer save 500'd: `Default currency is not enabled for company: USD`. PartyMasterCard.tsx seeded form.defaultCurrency='USD' (a currency TESTCO has not enabled); the <select> visually showed the first enabled option (TRY) while state stayed USD, so USD was submitted. FIXED: loadCurrencies now defaults defaultCurrency to the company base/first-enabled currency when the seeded value isn't enabled. | new party defaults to the company base currency |
GP03-step1b | Fail (bug, not fixed) | After currency fix, save 500'd: `Party legalName is required`. The UI marks only Trading/Display Name with * and treats Legal Entity Name as optional, but the backend requires legalName. | UI should require legalName (or fall back legalName = displayName) to match backend |
GP03-step1c | Fail (bug, not fixed) | After filling legalName, save 500'd: `Generated account code already exists: 10401-CUST-1`. An earlier save that failed on the legalName validation had ALREADY created the AR sub-account 10401-CUST-1 but rolled back the party — leaving an orphan account, so retry with the same code collides. Party + AR-sub-account creation is not atomic. Worked around by using code CUST-1B. | party + auto AR sub-account creation must be atomic (one transaction) so a failed save leaves no orphan account |
GP03-step1 | Pass (with workaround) | Customer created (code CUST-1B, display CUST-1, credit limit 10000, currency TRY, auto-create AR sub-account 10401-CUST-1B). | customer saved + AR sub-account created |
GP03-step2 | Pass | Customer Statement for CUST-1 generated empty (Invoiced 0.00 / Paid 0.00 / Closing 0.00, "No transactions in this period"), no errors. | empty statement, no errors |
GP03-step3 | Blocked (tooling, not a product bug) | Quotation: customer + item (GP02-130818) selected fine, but the ClassicLineItemsTable qty/unit-price cells do not accept programmatic input (native value-set, input/change events, and the dedicated fill tool all leave the cell empty; line total stays 0.00). The cells appear to commit only through their own keyboard handlers. This blocks all line-item document entry (steps 3-14). Needs a human to type line items, or a test-id/data hook on the cells for automation. | line items entered; quote saved |
