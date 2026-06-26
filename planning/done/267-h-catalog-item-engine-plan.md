# Task 267-H — Catalog/Item Engine Plan

## Technical Developer View

**What the task was:**
To create an implementation plan for making item/catalog management an always-on shared engine with module doorways.

**What was changed:**
- Authored the execution plan: `planning/tasks/267-h-catalog-item-engine-plan.md`
- The plan defines the extraction of `ICatalogCore` from the Inventory module, neutral item read/search/update use-cases, new API doorways (`/tenant/{module}/items`), a neutral permission model (`catalog.items.view/manage`), and the necessary frontend component refactorings.

**What was tested:**
No code was changed.

## End-User View

**Feature Explanation:**
A comprehensive blueprint has been created to decouple your Item Catalog from the Inventory module. Once implemented, this will allow your POS, Sales, and Purchases teams to securely manage items within their own workflows, without needing access to the Inventory module.
