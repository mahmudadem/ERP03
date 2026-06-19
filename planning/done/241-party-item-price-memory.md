# Task 241 — Party × Item Price Memory

**Completed:** 2026-06-19  
**Actual time:** ~5.0h  
**Status:** Complete in code and validation; not committed by Codex because commit approval was not requested.

## Technical Developer View

Task 241 adds party/item price memory for Sales and Purchases with the owner-confirmed per `(currency × UOM)` model.

### What changed

- Added shared `PartyItemPrice` domain model plus repository interface.
- Added Firestore repository at `companies/{companyId}/party_item_prices/{partyId}__{itemId}`.
- Added Prisma SQL parity model/table `party_item_prices` with JSON sale/purchase maps.
- Extended `Item.costingStats` with:
  - `lastSalePriceByCcyUom`
  - `lastPurchaseCostByCcyUom`
- Extended `CostPoint`/`PricePoint` with `qty` and `uomId`.
- Added `buildCcyUomKey(currency, uomId)` and average-cost derivation from one base average.
- Posting paths now update item-level last-event and party-level last-for-party memory in the same transaction:
  - Sales Invoice
  - Sales Return
  - Purchase Invoice
  - Purchase Return
- Read/default price paths now accept document currency, exchange rate, UOM id, and UOM label.
- Effective price resolution now supports:
  - price list
  - last-for-party exact `(currency, uomId)`
  - item last-event exact `(currency, uomId)`
  - item default
  - blank/manual
- Added settings:
  - `InventorySettings.inventoryFxCostBasis = REPLACEMENT | HISTORICAL`
  - `InventorySettings.defaultLinePriceSource = PRICE_LIST | LAST_PARTY_PRICE | ITEM_DEFAULT`
  - `SalesSettings.deriveLinePriceAcrossUom`
  - `PurchaseSettings.deriveLinePriceAcrossUom`
- Added Sales/Purchase Settings policy checkboxes for cross-UOM remembered-price derivation.
- Added compiled-backend emulator smoke:
  - `backend/scripts/task241-emulator-smoke.cjs`

### Important implementation notes

- Observed prices are stored natively per `(currency, uomId)` and are never derived across currencies.
- Price derivation across UOM is optional and module-specific; default is off.
- Average cost remains a single base-currency + base-UOM value and is always derived across currency/UOM for document display or cost math.
- Firestore writes now strip nested `undefined` values for item updates and party-item price records. This was found by the emulator smoke; unit tests did not catch it because Firestore rejects nested undefined only at real write time.
- No migration/backfill was added because there is no production data.

### Files changed

Key backend areas:

- `backend/src/domain/inventory/entities/Item.ts`
- `backend/src/domain/shared/entities/PartyItemPrice.ts`
- `backend/src/repository/interfaces/shared/IPartyItemPriceRepository.ts`
- `backend/src/infrastructure/firestore/repositories/shared/FirestorePartyItemPriceRepository.ts`
- `backend/src/infrastructure/prisma/repositories/shared/PrismaPartyItemPriceRepository.ts`
- `backend/prisma/schema.prisma`
- `backend/src/application/inventory/services/ItemCostingStatsService.ts`
- Sales/Purchase posting and price-list use cases
- Sales/Purchase/Inventory DTOs and validators
- DI wiring in `bindRepositories.ts`

Key frontend areas:

- Sales/Purchase API types
- Sales/Purchase line price resolver services
- Native Sales Invoice, Purchase Invoice, and Purchase Order line-default callers
- Generic voucher renderer price-default callers
- Sales and Purchase Settings pages

Docs:

- `docs/architecture/pricing.md`
- `docs/user-guide/sales/party-item-price-memory.md`
- `planning/done/241-party-item-price-memory.md`

## End-User View

When a user creates a Sales or Purchase document, ERP03 can now remember the last real price used for that same customer/vendor and item. The remembered price is separated by currency and UOM, so USD per box, USD per piece, and SYP per piece are treated as different facts.

If no exact remembered price exists in the document currency, ERP03 leaves the line blank instead of guessing from another currency. If the admin enables cross-UOM derivation, ERP03 may derive a same-currency price across UOMs using item conversion factors, such as 10 per box becoming 2.5 per unit when 1 box equals 4 units. Users can always override the default price on the line.

Average cost is cost-only. It is not an average sale price and it is not stored separately per currency or UOM.

## Verification

- `npm --prefix backend run build` — passed.
- `npm --prefix backend test -- --runTestsByPath src/tests/application/inventory/services/ItemCostingStatsService.test.ts src/tests/application/sales/PriceListResolution.test.ts src/tests/application/purchases/PurchasePriceListUseCases.test.ts` — passed, 39 tests.
- `npm --prefix backend test -- --runTestsByPath src/tests/application/sales/SalesPostingUseCases.test.ts src/tests/application/purchases/PurchasePostingUseCases.test.ts` — passed, 47 tests.
- `npm --prefix backend test -- --runTestsByPath src/tests/application/sales/SalesReturnUseCases.test.ts src/tests/application/purchases/PurchaseReturnUseCases.test.ts` — passed, 23 tests.
- `npm --prefix backend test` — passed, 164 suites, 1460 tests, 2 suites skipped, 18 tests skipped.
- Compiled-backend Firestore emulator smoke:
  - `node backend/scripts/task241-emulator-smoke.cjs`
  - passed against existing Firestore emulator at `127.0.0.1:8080`
  - verified SI and PI writes to item-level and party-level `USD__uom_each` memory.
- `npm --prefix frontend run build` — passed, with existing bundle-size/browser-data warnings only.

Note: `firebase emulators:exec --only firestore "node backend/scripts/task241-emulator-smoke.cjs"` could not start because port 8080 was already occupied. The same smoke was run successfully against the existing Firestore emulator.

## Manual QA Script

Use a fresh tenant with Sales, Purchases, Inventory, customers, vendors, items, UOM conversions, and at least SYP/USD currencies configured.

1. **Sale in base currency:** Sell item A to customer C in SYP/base UOM. Create a new SYP invoice for the same customer/item/UOM. Expected: line defaults from the SYP party memory; average cost displays from base average.
2. **Sale in USD:** Sell item A to customer C in USD. Create a new USD invoice for the same customer/item/UOM. Expected: line defaults from the USD party memory; average cost is derived from the single base average using `inventoryFxCostBasis`.
3. **Purchase in base currency:** Buy item A from vendor V in SYP/base UOM. Create a new SYP purchase invoice for the same vendor/item/UOM. Expected: line defaults from SYP vendor memory and posting updates the single base moving average.
4. **Purchase in USD:** Buy item A from vendor V in USD. Create a new USD purchase invoice for the same vendor/item/UOM. Expected: USD purchase memory is native; posting converts the line cost to base currency and folds it into the single average.
5. **New customer fallback:** Create a first invoice for a brand-new customer with no party price memory. Expected: resolver falls through to last-event, item default, or blank according to settings.
6. **Same customer, two currencies:** Sell the same item to the same customer once in SYP and once in USD. Expected: SYP docs read SYP memory and USD docs read USD memory; records do not overwrite each other.
7. **Never-used currency:** Create a document in a currency with no remembered record. Expected: price stays blank/manual; after posting, the typed value becomes that currency's first memory.
8. **Volatile-rate costing:** Buy 1 unit at 1 USD when rate is 1000 SYP, then sell after rate is 12000 SYP. Expected under `REPLACEMENT`: cost/profit follows replacement basis and holding gain is segregated per the valuation brief; under `HISTORICAL`: cost follows historical base average divided by document rate.
9. **Per-UOM prices:** Sell item A at 1.30 USD per box and 0.12 USD per piece. Expected: USD box and USD piece memories remain separate; each matching line defaults from its exact `(currency, uomId)` record.
10. **Cross-UOM price flag:** Sell a box at 10 USD where 1 box = 4 units. With `deriveLinePriceAcrossUom` off, create a USD unit line and confirm it stays blank. Turn the setting on and try again; expected unit default = 2.5 USD. Confirm no cross-currency derivation occurs.

## Known Follow-Ups

- Contract/effective-dated pricing remains reserved and out of scope.
- Full price-history timeline UI remains out of scope; this task stores only the last price per direction and `(currency, uomId)`.
- Existing item repository lookup is still global by item id; IDs are expected to be globally generated. The smoke uses unique run ids to avoid stale emulator-data collisions.
