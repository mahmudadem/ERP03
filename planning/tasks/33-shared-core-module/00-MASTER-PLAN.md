# Shared Core Module — Master Plan

## Business Context
The ERP system requires foundational services that cross-cut all business modules (Inventory, Purchases, Sales, Accounting). Instead of duplicating logic, the Shared Core Module centralizes these horizontal concerns.

## Architectural Decisions
- **Shared Entities:** `TaxCategory`, `UnitOfMeasure`, `DocumentSequence`, `AuditLog`, `PrintTemplate`.
- **Global Availability:** Services provided by this module are injected into use cases across all other modules.
- **Path Pattern:** Data is stored under `companies/{companyId}/shared/Data/{collection}` to signify its cross-module nature.

## Feature Index & Execution Order

> [!IMPORTANT]
> This module MUST be implemented before Inventory, Purchases, or Sales, as they depend on these core services.

### Phase 0: Shared Core Foundation
1. [01-tax-engine.md](features/01-tax-engine.md) — Tax categories, rates, and centralized calculation logic.
2. [02-uom-conversion.md](features/02-uom-conversion.md) — Units of Measure and conversion factors.
3. [03-document-sequences.md](features/03-document-sequences.md) — Auto-numbering, prefixes, concurrency-safe increments.
4. [04-audit-logs.md](features/04-audit-logs.md) — Centralized change tracking and immutability enforcement.
5. [05-print-templates.md](features/05-print-templates.md) — PDF/Print template management.

## Integration Points
- **Inventory:** Items link to `TaxCategory` and `UnitOfMeasure`.
- **Purchases/Sales:** Documents use `DocumentSequenceService` for auto-numbering, `PrintTemplateService` for PDFs, and `TaxEngine` for line-item calculations.
- **Accounting:** `VoucherSequence` logic is migrated/unified into the shared sequence service.

## Agent Instructions for Execution
1. Read this master plan.
2. Execute each feature file in the `features/` directory sequentially.
3. For each feature, implement:
   - Entities and Types
   - Repository Interfaces
   - Repository Implementations (Firestore)
   - Use Cases / Services
   - API Routes & Controllers
   - Frontend UI (Settings pages)
4. Ensure all tests pass before moving to the next feature.

## Cross-Cutting Concerns

### DI Bindings
Update `backend/src/infrastructure/di/bindRepositories.ts` to register:
- `ITaxCategoryRepository` → `FirestoreTaxCategoryRepository`
- `ITaxRateRepository` → `FirestoreTaxRateRepository`
- `IUnitOfMeasureRepository` → `FirestoreUnitOfMeasureRepository`
- `IDocumentSequenceRepository` → `FirestoreDocumentSequenceRepository`
- `IAuditLogRepository` → `FirestoreAuditLogRepository`
- `IPrintTemplateRepository` → `FirestorePrintTemplateRepository`

### Prisma Schema
Add models to `backend/prisma/schema.prisma`: `TaxCategory`, `TaxRate`, `UnitOfMeasure`, `UoMConversion`, `DocumentSequence`, `AuditLogEntry`, `PrintTemplate`. Follow existing patterns.

### Permissions
Shared module settings are typically admin-only:
```
shared.tax.view, .manage
shared.uom.view, .manage
shared.sequences.view, .manage
shared.auditLogs.view
shared.printTemplates.view, .manage
```

