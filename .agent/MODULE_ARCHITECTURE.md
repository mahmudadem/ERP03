# Module-First Firestore Architecture Standard

**Version:** 1.0  
**Last Updated:** 2026-01-23  
**Status:** Active Standard

---

## Core Principle

> **Each module encapsulates ALL its own data and settings under a single path**

This provides:
- ✅ Strong boundaries and isolation
- ✅ Clear ownership and responsibility  
- ✅ Easy module enable/disable
- ✅ Scalable architecture for future growth
- ✅ Better developer experience

---

## Standard Structure

```
companies/{companyId}/
│
├── (root fields: id, name, logo, createdAt, etc.)
│
├── Settings/ 
│   ├── company/           ← Core Business Identity (Document)
│   │   ├── timezone, dateFormat, language, logo
│   │
│   └── shared/            ← CROSS-MODULE Settings (Document/Collections)
│       ├── currencies/    ← Active currencies for this company
│       ├── measuringUnits/ ← kg, meters, liters
│       └── taxCategories/ ← Global VAT/GST categories
│
├── users/                     ← Company-level operational data
├── roles/
├── modules/
│
├── accounting/                ← MODULE SUB-COLLECTION
│   ├── Settings/              ← Document for module settings
│   │   ├── (fields: baseCurrency, fiscalYear, etc.)
│   │   ├── currencies/        ← Sub-collection for active currencies
│   │   └── vouchers/          ← Sub-collection for voucher settings (forms, labels)
│   │
│   └── Data/                  ← Document for module operational data
│       ├── ledger/            ← Sub-collection for GL entries
│       ├── accounts/          ← Sub-collection for COA
│       └── vouchers/          ← Sub-collection for transactions
│
└── {otherModule}/
    └── ...
```

---

## Module Template

When creating a new module, follow this pattern:

```
companies/{id}/{moduleName} (coll) / Settings (doc) / {entity} (coll)
companies/{id}/{moduleName} (coll) / Data (doc) / {entity} (coll)
```

1. **Module sub-collection:** Named after the module (e.g., `accounting`, `inventory`).
2. **Settings document:** Named `Settings`. Holds direct fields for global module config.
3. **Data document:** Named `Data`. Acts as a container for all operational sub-collections.
4. **Entity sub-collections:** Named after entities (e.g., `vouchers`, `items`).


---

## Real Examples

### Accounting Module
```
companies/{id}/accounting/
├── Settings/
│   ├── config/              ← baseCurrency, fiscalYear, policies
│   ├── currencies/          ← Active currencies (SYP, TRY, USD)
│   └── exchangeRates/       ← Historical rates
│
├── accounts/                ← Chart of Accounts
├── vouchers/                ← Transactions
├── ledger/                  ← General Ledger  
├── voucherTypes/            ← Type definitions
└── voucherForms/            ← Form templates
```

### Inventory Module (Future)
```
companies/{id}/inventory/
├── Settings/
│   ├── config/              ← trackingMethod, costing, policies
│   └── warehouses/          ← Warehouse configurations
│
├── items/                   ← Inventory items
├── movements/               ← Stock movements
├── adjustments/             ← Adjustments
└── counts/                  ← Stock counts
```

### HR Module (Future)
```
companies/{id}/hr/
├── Settings/
│   └── config/              ← payrollDay, benefits, policies
│
├── employees/
├── attendance/
├── payroll/
└── leaves/
```

---

## Implementation Rules

### ✅ DO

1. **Module path = `companies/{id}/{moduleName}/`**
2. **Settings path = `{modulePath}/Settings/config`**
3. **Additional settings = `{modulePath}/Settings/{subcollection}`**
4. **Operational data = `{modulePath}/{entity}/`**
5. **Use dual-read/write during migration**

### ❌ DON'T

1. **Don't scatter module data at company root**
2. **Don't mix settings and operational data**
3. **Don't use inconsistent naming (Settings vs settings)**
4. **Don't skip backward compatibility during migration**

---

## Repository Pattern

```typescript
export class FirestoreModuleEntityRepository {
  // NEW PATTERN
  private getCollectionRef(companyId: string) {
    return this.db
      .collection('companies')
      .doc(companyId)
      .collection('{moduleName}')  // ← Module boundary
      .collection('{entityName}');
  }

  // During migration: also implement getOldCollectionRef()
  private getOldCollectionRef(companyId: string) {
    return this.db
      .collection('companies')
      .doc(companyId)
      .collection('{entityName}');  // Old scattered path
  }

  // Read: Try new first, fallback to old  
  async findById(companyId: string, id: string) {
    let doc = await this.getCollectionRef(companyId).doc(id).get();
    if (!doc.exists) {
      doc = await this.getOldCollectionRef(companyId).doc(id).get();
    }
    // ...
  }

  // Write: Dual-write during migration
  async save(companyId: string, entity: Entity) {
    const data = this.toPersistence(entity);
    await this.getCollectionRef(companyId).doc(entity.id).set(data);
    await this.getOldCollectionRef(companyId).doc(entity.id).set(data); // Remove after migration
  }
}
```

---

## Migration Checklist

When migrating an existing module:

- [ ] Update repository `getCollectionRef()` to use new path
- [ ] Add `getOldCollectionRef()` for backward compat
- [ ] Implement dual-read (new first, fallback to old)
- [ ] Implement dual-write (both paths)
- [ ] Update all use cases using the repository
- [ ] Create data migration script
- [ ] Test thoroughly in emulator
- [ ] Run migration on production (when applicable)
- [ ] Monitor for 1-2 weeks
- [ ] Remove dual-write code
- [ ] Remove fallback code
- [ ] Delete old collections

---

## Benefits Recap

### For Developers
- Clear module boundaries
- Easy to find code and data
- Less coupling between modules
- Easier testing and debugging

### For Operations
- Clean module enable/disable
- Easy data export/backup per module
- Simple module migration between companies
- Better security and access control

### For Architecture
- Scalable to 100+ modules
- Microservices-ready if needed
- Module marketplace ready
- Multi-tenancy friendly

---

---

## The Evolutionary Settings Pattern

To balance **Speed today** with **Scalability tomorrow**, do not move everything to the Shared Tier immediately. Use the following "Smart" approach:

### 1. The Settings Resolver (Indirection)
**Mandatory Rule:** Feature code and Repository code MUST NOT hardcode full settings paths. Instead, use a centralized **Settings Resolver** (Service/Utility).

```typescript
// Good: Hides the path from the UI/Use-case
const currencies = settingsRegistry.getCurrencySettings(companyId);
```

### 2. Promotion-on-Demand (The "Rule of Two")
- **One User = Local:** If only the Accounting module uses a setting (e.g., Fiscal Year), keep it in `accounting/Settings`.
- **Two Users = Shared:** The moment you start building the Sales module and realize it needs the same "Currencies" list, you **Promote** that collection to `Settings/shared`.
- **Minimal Effort:** Because you used a **Settings Resolver**, you only update the path in ONE place. No feature code needs to change.

### 3. Immediate Shared Candidates
Only move the most obvious "Global Truths" to the Shared Tier from day one:
- **Currencies** (Used by all financial modules).
- **Measuring Units** (Used by Inventory, Sales, Purchase).
- **Global Tax Categories**.

---

## Questions?

If unsure about where to place new data:

1. **Has anyone else asked for this?** No? Keep it in your module's `Settings`.
2. **Is it a core business dimension?** (Time, Money, Weight) Yes? Put it in `Settings/shared`.
3. **Did I use the Resolver?** Always yes.

**When in doubt:** Start Local, Promote Later.

