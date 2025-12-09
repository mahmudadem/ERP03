# System Voucher Types - Storage Location Change

## Overview
This documents the architectural change for storing system voucher types in Firestore.

## What Changed

### Old Structure
```
companies/
  └── SYSTEM/
      └── voucher_types/
          ├── {voucherTypeId1}
          ├── {voucherTypeId2}
          └── ...
```

### New Structure
```
system_voucher_types/
  ├── {voucherTypeId1}
  ├── {voucherTypeId2}
  └── ...

companies/
  └── {companyId}/
      └── voucher_types/
          ├── {voucherTypeId1}  // Company-specific voucher types
          └── ...
```

## Why This Change?

1. **Architectural Clarity**: System-level templates are conceptually different from company data and should be stored separately.

2. **Better Separation**: Prevents system templates from being mixed with actual company data structures.

3. **Clearer Permissions**: Easier to set up Firestore security rules for system vs. company data.

4. **Scalability**: Top-level collections are more efficient for global lookups.

## Files Modified

### Backend Repository
- **`backend/src/infrastructure/firestore/repositories/designer/FirestoreDesignerRepositories.ts`**
  - Added `SYSTEM_COLLECTION_NAME = 'system_voucher_types'`
  - Created `getSystemCollection()` method
  - Updated all CRUD methods to route to correct collection based on `companyId`
  - Modified `getSystemTemplates()` to read from top-level collection

### Code That Still Works Without Changes
- **Seeder**: `backend/src/seeder/seedSystemVoucherTypes.ts` - No changes needed, continues to use `SYSTEM_COMPANY_ID`
- **Use Cases**: All use cases that call `getSystemTemplates()` work without modification
- **Controllers**: All API controllers continue to work as before

## Migration Instructions

### For New Installations
No migration needed! The seeder will automatically create system templates in the new location.

### For Existing Installations

1. **Deploy the updated code** (repository changes)

2. **Run the migration script**:
   ```bash
   cd backend
   npm run build
   ts-node src/migrations/migrateSystemVoucherTypes.ts
   ```

3. **Verify the migration**:
   - Check Firestore console to confirm data exists in `system_voucher_types` collection
   - Test that system templates are loading correctly in your app
   - Verify company creation still copies templates correctly

4. **Clean up old data** (optional, after verification):
   ```bash
   ts-node src/migrations/cleanupOldSystemVoucherTypes.ts
   ```
   ⚠️ Only run this after confirming the migration was successful!

## How It Works

The repository implementation now checks the `companyId`:

```typescript
async createVoucherType(def: VoucherTypeDefinition): Promise<void> {
  const data = this.toPersistence(def);
  
  // System templates go to top-level collection
  if (def.companyId === 'SYSTEM') {
    await this.db.collection('system_voucher_types').doc(def.id).set(data);
  } 
  // Company templates go to subcollection
  else {
    await this.db
      .collection('companies')
      .doc(def.companyId)
      .collection('voucher_types')
      .doc(def.id)
      .set(data);
  }
}
```

All read operations follow the same pattern, ensuring data is read from the correct location.

## Default System Voucher Types

The system includes 5 default voucher types:
1. **PAYMENT** - Vendor Payment
2. **RECEIPT** - Customer Receipt
3. **FX** - Currency Exchange
4. **TRANSFER** - Bank Transfer
5. **JOURNAL** - Journal Voucher

These are seeded automatically when you run the demo seeder.

## Testing

After migration, verify:
- [ ] System templates appear in `system_voucher_types` collection
- [ ] Super Admin can view all system templates
- [ ] New companies receive copies of system templates during creation
- [ ] Company-specific voucher types still work correctly
- [ ] Designer can create new voucher types for companies

## Rollback

If you need to rollback:
1. Revert the repository code changes
2. System templates in both locations will work (old code reads from `companies/SYSTEM/voucher_types`)
3. No data loss occurs

---

**Last Updated**: 2025-12-09
**Migration Scripts**: `backend/src/migrations/migrateSystemVoucherTypes.ts`, `cleanupOldSystemVoucherTypes.ts`
