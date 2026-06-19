# Task 241 — Manual Test Notes (owner walkthrough, 2026-06-19)

> Live notes captured during the owner's hands-on test of party × item price memory (PR #14, branch `feat/241-party-item-price-memory`). Each note is logged verbatim-ish with context, then triaged into a fix list at the bottom. **This is a scratchpad during testing — not a completion report.**

## Context
- Branch under test: `feat/241-party-item-price-memory` (PR #14, not yet merged).
- Feature: remembers last transacted price per (party × item), stored per (currency × UOM); SI/SR/PI/PR.
- Tester: owner (driving the UI). Claude verifies data in the Firestore emulator when needed.

## → Converted to task plans (2026-06-19)
All notes below are now tracked as task files for other agents:
- **[Task 242](../tasks/242-strict-pricing-policy-resolution.md)** — DECISION-A (strict policy, no fallback, default `LAST_PARTY_PRICE`). *Modifies 241.*
- **[Task 243](../tasks/243-pricing-policy-management.md)** — NOTE-15 (selectable policy), NOTE-16 (document settings + default accounts), NOTE-17 (native↔designer parity), NOTE-18 (right-click per-doc override).
- **[Task 244](../tasks/244-item-uom-card-bugfix-cluster.md)** — NOTE-08, 09, 10, 11, 14 (item card + UOM bugs; pre-existing; unblocks 241 cross-UOM test).
- **[Task 245](../tasks/245-master-data-ux-polish-backlog.md)** — NOTE-01, 02, 03, 04, 05, 06, 07, 12, 13 (master-data & onboarding UX polish).

## ✅ Verified PASSES (owner-confirmed)

- **PASS-01 (2026-06-19) — Core 241 works: the document line remembers the last price for the customer.** Owner confirmed that on a Sales document, after transacting an item with a customer, a new document for the **same customer** defaults the line to that customer's **last price** (party last-price memory). This is the primary Task 241 behavior — **working in the base case** (same currency / same UOM).
  - Still **pending** (blocked by NOTE-14): cross-UOM price memory (alternate unit not selectable on the line) and the per-currency variation.
- **PASS-02 (2026-06-19) — New-customer fallback is correct (NOT a bug).** Owner created a brand-new customer, used the same item, and saw the **last sell price** (from the previous customer). Traced to the resolver chain `PRICE_LIST → LAST_PARTY_PRICE → LAST_EVENT → ITEM_DEFAULT` (`PurchasePriceListUseCases.buildSourceOrder`, sales mirrors it): the new customer has no own price, so it fell through to **`LAST_EVENT`** (last price sold to anyone) — exactly QA scenario 5. The API returns a `source` field (`LAST_PARTY_PRICE | LAST_EVENT | PRICE_LIST | ITEM_DEFAULT`), so the system knows which rung filled it.
  - **UX gap (ties to NOTE-15):** the UI does **not display the source**, so the user can't tell "this customer's price" from "last sold to anyone." Add a source tag/badge on the auto-filled line.
  - **Product question (ties to NOTE-15):** should a brand-new customer inherit another customer's price via `LAST_EVENT` at all? Today yes; consider making it a policy choice.

## 🔎 Investigation findings (2026-06-19) — are the blockers 241 regressions?

**Verdict: NO. NOTE-08 and NOTE-14 are PRE-EXISTING bugs, not caused by Task 241. PR #14 is safe to merge.**

- **241's frontend diff does NOT include any item-card/modal file** (NOTE-08) nor `UomSelector.tsx` (NOTE-14). The frontend files 241 changed are only: invoice/order detail pages, the two line-price resolvers, settings pages, voucher renderer, and API types.
- **241's backend Item changes are purely ADDITIVE:** it only adds new optional `costingStats.lastSalePriceByCcyUom` / `lastPurchaseCostByCcyUom` + `CostPoint.qty/uomId`, and wraps item **writes** in an undefined-stripper. It never removes/renames existing item fields and does not change the item **read** path. The Items **list shows full data** (BOX / TRY / MOVING_AVG / Active), proving the API returns complete item records.
- **NOTE-08** (modal opens empty) is therefore a pre-existing bug in the **item detail card/modal populate** logic — independent of 241.
- **NOTE-14** (line offers only base UOM) is in `UomSelector.tsx` (`buildItemUomOptions(item, conversions)`, only expands past base once conversions load) — pre-existing, and tangled with the duplicate/unsaved conversion data (NOTE-10/11). Not 241.

**Consequence:**
- ✅ PR #14 / Task 241 can merge on its own merits (core feature proven by PASS-01; backend fully green; changes additive).
- 🔧 The UOM/item cluster (NOTE-08, 09, 10, 11, 14) becomes its **own fix task** — needed to later complete cross-UOM + per-currency 241 verification, but **not a blocker to merging 241's core**.

## Notes (append as they come)

<!-- Each note: what step, what was expected, what happened. Add a NOTE-NN id so we can reference it. -->

### NOTE-01 — Onboarding "Auto initialize Trading Company – Simple": expose more setup options (e.g. COA selection)
- **Where:** Company creation wizard → **Company Setup** step (screenshot 2026-06-19). "Auto initialize Trading Company – Simple" is checked; Inventory Control Mode = Simple.
- **Observed:** When auto-init is on, the setup is fixed — it silently chooses the **Periodic trading chart of accounts** + company-wide average cost + MAIN warehouse + simple direct sales/purchase invoicing. The user has no control over these.
- **Owner request:** When auto-init is ON, give the user **more options** — at minimum the ability to **select the Chart of Accounts** (instead of always defaulting to the periodic trading COA), and likely surface the other auto-chosen policies as editable choices.
- **Type:** UX / feature enhancement (onboarding wizard). **Out of scope for Task 241** (this is the company starter, not price memory) — capture for a separate task.

### NOTE-02 — Customers list page needs KPIs + more professional UI layout
- **Where:** Sales → **Customers** list page (company "Hadir Gida", TRY, FLEXIBLE; screenshot 2026-06-19). Empty state ("No Customer records found in directory").
- **Owner request:** Enhance the Customers page — add **KPI cards/summary** (e.g. total customers, active, receivables/balance, top accounts) and a **more "pro" UI layout** (richer header, denser/styled table, better empty state), in line with the premium list-page standard used elsewhere in the app.
- **Type:** UX / feature enhancement (Sales › Customers directory). **Out of scope for Task 241** — capture for a separate UI task.

### NOTE-03 — New Customer: default Account Strategy to "Auto-create sub-account" when sales is auto-initialized
- **Where:** New Customer modal → **Financial Settings** → Account Strategy ("Auto-create sub-account" vs "Pick existing account"); screenshot 2026-06-19.
- **Owner request:** When the company was created with auto-init sales, **default the strategy to Auto-create sub-account** so the user can start adding customers directly under the parent AR account without having to open this tab / make a choice each time.
- **Type:** UX / default-behavior (customer master). Related to onboarding policy. **Out of scope for Task 241.**

### NOTE-04 — New Customer: let user choose the account-code format (≈3 preset options is enough)
- **Where:** Same Financial Settings screen — "Generated account preview", Format `{parent}-{partyCode}` → e.g. `10401-C001`.
- **Owner request:** Give the user an option to **select the code format** here. **3 preset format options are enough** (no need for a fully custom format builder).
- **Type:** UX / feature (customer master account-code format). **Out of scope for Task 241.**

### NOTE-05 — Save button label too generic ("SAVE NEW RECORD")
- **Where:** New Customer modal footer button "SAVE NEW RECORD" (same pattern likely on Vendor / Item master cards).
- **Owner request:** Make the label context-specific — **"Save New Customer / Vendor / Item"** per the entity, **or** just simplify to **"Save"** / **"Add"**.
- **Type:** UX / copy (shared master-card save button). **Out of scope for Task 241.**

### NOTE-06 — List page does not auto-refresh after saving a new record
- **Where:** After saving a new Customer, the Customers list does **not** auto-refresh to show the newly added record (user must refresh manually). Expected to also affect Vendors / Items / Warehouses.
- **Owner request:** After save, **refresh the list page** so the new record appears immediately.
- **Type:** Bug (UX). **⚠️ Recurring/known issue** — already noted in `planning/ACTIVE.md` ("Customer/warehouse lists don't auto-refresh after create") from golden-path QA. Worth fixing once, broadly. **Out of scope for Task 241 core** but a real bug.

### NOTE-07 — Units of Measure page: inline form inputs are unlabeled / unclear
- **Where:** Settings → **Units of Measure** page. Top inline row has 4 unlabeled inputs (Code `G`, Name `Gram`, Dimension dropdown `WEIGHT`, a number field `0`) + an **"Update UOM"** button; list below shows BOX/CM/EA/G/KG/… with Code/Name/Dimension/Decimals/Status.
- **Observed problem:** The user can't tell what the top inputs are for — **no field labels**, and "Update UOM" is ambiguous (is it adding a new UOM or editing an existing one? the number field `0` is presumably "Decimals" but unlabeled).
- **Owner request:** "Needs work" — add **labels**, clarify **Add vs Update** (separate "Add UOM" affordance / clear edit mode), and label the decimals field.
- **Type:** UX / clarity (Units of Measure settings page). **Out of scope for Task 241.**

### NOTE-08 — ⚠️ Clicking an existing item opens the modal EMPTY (fields don't populate)
- **Where:** Inventory → **Inventory Items** → click an existing item ("RUAH CAY", code `001`, type PRODUCT, base BOX) to open its card.
- **Observed:** The modal opens with the correct **title** ("RUAH CAY") but **all fields are blank** — CODE, NAME, CATEGORY, etc. do not populate with the item's stored data. The General Info tab shows placeholder `e.g. ITM-0001` instead of `001`.
- **Severity:** **HIGH** — functional bug; you can't view/edit an existing item.
- **⚠️ POSSIBLY 241-RELATED — must investigate before merge.** Task 241 modified `Item.ts` (new `costingStats.*ByCcyUom` fields) and `FirestoreItemRepository.ts`. If `Item.fromJSON`/serialization or the modal's populate path broke, this could be a 241 regression.
  - **Action:** reproduce on `main` (pre-241) to confirm whether 241 caused it. If 241-caused → **blocks merge of PR #14**, fix on the branch. If it also fails on `main` → pre-existing bug, separate fix.
- **Type:** Bug (item master card population). **Investigate against 241.**

### NOTE-09 — Item UOM Conversions section shows in Web mode but NOT in Windows mode (must be consistent)
- **Where:** Item card → **"ITEM UOM CONVERSIONS"** section (From UOM / To / factor / Add Conversion). Currently visible only when UI mode = **Web**; **missing entirely in Windows mode**.
- **Owner principle (important):** The **same content must always show in both modes** — Web vs Windows should only change **how** things render (layout/chrome), **never whether** a section/feature appears. A whole section disappearing in one mode is a bug.
- **Relevance to 241:** The cross-UOM price derivation (NOTE-tie / flag `deriveLinePriceAcrossUom`) depends on these conversion factors being defined — so this section must be reachable in both modes for that feature to be usable.
- **Type:** Bug (Web/Windows mode parity — item card). Likely pre-existing mode-awareness issue, not a 241 code change. **Investigate scope (does it affect other sections too?).**

### NOTE-10 — Item UOM Conversions: duplicate conversions allowed (same From→To added twice)
- **Where:** Item card → ITEM UOM CONVERSIONS. Screenshots show **two `BOX → PCS` rows** coexisting (e.g. factor 24 + 24, then 24 + 222).
- **Observed:** The system lets you add the **same From→To UOM pair more than once**. A given `(From, To)` conversion should be **unique per item** — duplicates create ambiguity (which factor wins for cross-UOM price/cost?).
- **Owner request:** Block duplicates — one conversion per `(From, To)` pair (edit the existing one instead of adding a second).
- **Type:** Bug (data integrity, item UOM conversions). **Relevant to 241** — ambiguous conversion factor would break deterministic cross-UOM price derivation.

### NOTE-11 — Item UOM Conversions: Delete not working (and delete should be allowed when unused)
- **Where:** Same section — trash/delete control on a conversion row.
- **Observed:** **Delete does nothing.** Rows show `Usage: 0 / P: 0 / S: 0` and "No posted movement uses this conversion yet" — i.e. unused — so they **should** be deletable.
- **Owner rule:** **Delete is allowed when the conversion is not used** (no posted movements). It's failing even in that safe case.
- **Type:** Bug (item UOM conversions — delete action). **Relevant to 241** (need to remove the duplicate/bad rows from NOTE-10).

### NOTE-12 — Remove "Quick Add Item" from the Inventory Items page
- **Where:** Inventory → **Inventory Items** → top "Quick Add Item" inline form (Code / Name / Type / currency / Add Item).
- **Owner request:** **Remove the Quick Add** section. (Use "New Item" / the full item card instead.) Side note: Quick Add currency defaulted to **USD** while company base is **TRY** — a pre-existing default-currency bug, but moot if Quick Add is removed.
- **Type:** UX / cleanup (Inventory Items list). **Out of scope for Task 241.**

### NOTE-13 — "Active" status column unclear; no toggle to deactivate an item
- **Where:** Inventory Items list → **Status** column shows `Active` badge.
- **Observed:** Unclear what **Active** means, and there's **no toggle/action to deactivate** an item.
- **Owner request:** Either clarify what Active means and/or provide a **deactivate/activate toggle** so the status is actionable.
- **Type:** UX / feature (item status lifecycle). **Out of scope for Task 241.**

### NOTE-14 — ⚠️ Document line only offers the Base UOM; alternate conversion UOMs (PCS) don't appear as selectable
- **Where:** Sales/Purchase document line → item UOM picker for item `001 - RUAH CAY`. Popup shows only **BOX** + "Open item card to edit UOMs", despite a defined **BOX→PCS (24)** conversion on the item card.
- **Observed:** The line's unit picker surfaces **only the Base UOM**, not the alternate units defined via conversions. Also the overall UOM model (Base vs Purchase vs Sales UOM vs conversions vs what's selectable on the line) is **confusing to the owner** and needs clearer UX.
- **Severity:** **HIGH for 241 testing** — if a line can only be BOX, the per-(currency × UOM) price memory and cross-UOM derivation **cannot be exercised at all**. Likely a precondition bug blocking the 241 manual test.
- **Possible causes to check:** conversion not surfacing in the line UOM list; duplicate/garbage conversion rows (NOTE-10) confusing the picker; conversion not actually persisted; or line picker intentionally only shows base (design gap).
- **Type:** Bug + UX (UOM model / line unit selection). **Directly blocks 241 cross-UOM verification — investigate with NOTE-08/10/11 as a cluster.**
- **Owner confirmed (2026-06-19): this is BLOCKING UOM price testing.**

### ⭐ DECISION-A (owner, 2026-06-19) — STRICT policy resolution: NO cross-source fallback
- **Problem:** the current resolver cascades `PRICE_LIST → LAST_PARTY_PRICE → LAST_EVENT → ITEM_DEFAULT` (`buildSourceOrder`). So a new customer silently inherits another customer's price via `LAST_EVENT` (see PASS-02). **Owner verdict: this is bad UX — the user gets confused about where the price came from.**
- **Decision:** Resolution must be **strict to the chosen policy** — use ONLY the configured source. **No automatic fallback to other sources.** If the configured source has no value (e.g. policy = LAST_PARTY_PRICE and the customer has no prior price) → **leave the line blank** for manual entry. Do **not** borrow from a different source.
- **Implementation direction:** `buildSourceOrder(configured)` should resolve **only** `[configured]` (single source), not the full cascade — in BOTH sales (`PriceListUseCases`) and purchases (`PurchasePriceListUseCases`). Still return the `source` field for transparency.
- **Changes 241 behavior** → must be decided: fix on the PR #14 branch **before merge**, or merge then follow-up. (PASS-02's fallback is "correct per old design" but that design is now being replaced.)
- **Type:** Behavior change (pricing resolution). **Modifies Task 241.**

### NOTE-15 — Pricing policy must be USER-SELECTABLE at two levels (not hard-defaulted to party last price)
- **Today:** the line price source is hard-defaulted to **party last price**. 241 added the setting `InventorySettings.defaultLinePriceSource = PRICE_LIST | LAST_PARTY_PRICE | ITEM_DEFAULT` but it isn't surfaced/expanded as a real user choice.
- **Owner request — two levels:**
  - **Document level:** user chooses the source — *price list* / *last price to this customer (party last)* / *last price sold (last-event)* / *item default* / … (expandable list).
  - **Party level:** assign a party to a **price list** (e.g. Wholesale), so that party's documents default from the assigned list. (Party level = price lists only.)
- **Type:** Feature (pricing policy selection). **Extends 241's `defaultLinePriceSource`.** Sizeable — likely its own task building on 241.

### NOTE-16 — Need a "Document Settings / Management" page for native documents (defaults, extensible)
- **Owner request:** A page to configure **per-document-type defaults** for native documents, including:
  - **Pricing policy** (NOTE-15)
  - **Default accounts:** default cash/bank account, default warehouse, default salesperson, default cost center, … (extensible — "add more options later").
- **Goal:** a single place to manage document defaults so new options can be added over time.
- **Type:** Feature / architecture (document configuration). **Own task. Out of scope for Task 241.**

### NOTE-17 — Principle: native document pages and Form-Designer forms must have FEATURE PARITY
- **Owner principle:** The document defaults/functionality above apply to **native** document pages. The alternative path is **forms from the Form Designer**. **Native forms and designer forms must expose the same functionalities** — if the Form Designer is missing something the native page has (or vice-versa), **add it** so they stay at parity.
- **Type:** Architecture principle (native ↔ designer parity). Governs how NOTE-15/16 are implemented. **Out of scope for Task 241 core; record as a standing rule.**

### NOTE-18 — Right-click on the price column to OVERRIDE the pricing policy for this invoice
- **Where:** Sales/Purchase document (invoice) line table → **Price column**.
- **Owner request:** Right-clicking the price column should open a **context menu** to **override the pricing policy for this document** (e.g. switch this one invoice from `LAST_PARTY_PRICE` to `PRICE_LIST` / `ITEM_DEFAULT` / manual, and re-resolve the lines). A per-document override on top of the company/party default.
- **Relation:** Extends NOTE-15 (selectable pricing policy) + DECISION-A (strict policy). This is the **document-level override** surface — quick, inline, per-invoice.
- **Type:** Feature (per-document pricing-policy override, right-click menu). Builds on 241; likely part of the NOTE-15/16 pricing-policy task.

## Triage / fix list (filled in after notes)

| ID | Note summary | Type | Severity | Status |
|----|--------------|------|----------|--------|
| **NOTE-08** | **Existing item opens EMPTY — fields don't populate** | Bug — **PRE-EXISTING (NOT 241)**, item card populate | **HIGH** | investigated → own fix task |
| **NOTE-14** | **Document line only offers Base UOM; alternate (PCS) not selectable** | Bug — **PRE-EXISTING (NOT 241)**, UomSelector/conversions | **HIGH** | investigated → own fix task |
| NOTE-15 | Pricing policy user-selectable (document level + party level) | Feature — extends 241 defaultLinePriceSource | TBD | logged |
| NOTE-16 | Document Settings page: pricing policy + default accounts (extensible) | Feature / architecture (not 241) | TBD | logged |
| NOTE-17 | Native pages ↔ Form-Designer forms must have feature parity | Architecture principle | TBD | logged |
| NOTE-18 | Right-click price column → override pricing policy for this invoice | Feature — per-doc policy override (NOTE-15 family) | TBD | logged |
| **DECISION-A** | **Strict policy resolution — no cross-source fallback (blank if miss)** | **Behavior change — modifies 241** | **HIGH** | **pending: fix on branch?** |
| NOTE-09 | Item UOM Conversions section missing in Windows mode (shows in Web) | Bug — Web/Windows parity (item card) | TBD | logged |
| NOTE-10 | UOM conversions allow duplicate From→To pairs | Bug — data integrity (relevant to 241) | TBD | logged |
| NOTE-11 | UOM conversion Delete not working (should work when unused) | Bug — delete action (relevant to 241) | TBD | logged |
| NOTE-12 | Remove "Quick Add Item" from Inventory Items page | UX / cleanup (not 241) | TBD | logged |
| NOTE-13 | "Active" status unclear; no deactivate toggle | UX / feature (not 241) | TBD | logged |
| NOTE-01 | Auto-init should expose more options (COA select + other policies) | UX / feature (onboarding, not 241) | TBD | logged |
| NOTE-02 | Customers list page needs KPIs + more pro UI layout | UX / feature (Sales › Customers, not 241) | TBD | logged |
| NOTE-03 | Default customer Account Strategy to auto-create when auto-init sales | UX / default (customer master, not 241) | TBD | logged |
| NOTE-04 | Add account-code format selector (3 presets) on customer Financial Settings | UX / feature (customer master, not 241) | TBD | logged |
| NOTE-05 | Save button label too generic — make entity-specific or just "Save"/"Add" | UX / copy (shared master card, not 241) | TBD | logged |
| NOTE-06 | List doesn't auto-refresh after create (customers/vendors/items/warehouses) | Bug / UX — **recurring, also in ACTIVE.md** | TBD | logged |
| NOTE-07 | Units of Measure inline form inputs unlabeled / Add-vs-Update unclear | UX / clarity (UOM settings, not 241) | TBD | logged |
