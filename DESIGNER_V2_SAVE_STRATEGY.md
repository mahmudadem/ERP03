# Designer V2: Layout-to-Canonical Save Strategy

## ⚠️ CRITICAL PRINCIPLE

**VoucherLayoutV2 is NOT TRUSTED for accounting semantics.**

The UI can only modify cosmetic properties. All accounting logic (isPosting, postingRole, requiredPostingRoles) must be preserved from the original canonical definition.

---

## Save Flow (Step-by-Step)

### Step 1: Load Canonical Definition (Initial State)

```typescript
// 1. Load from backend
const canonicalDefinition: VoucherTypeDefinition = 
  await voucherTypeRepository.get(code);

// 2. Validate it's Schema V2
if (canonicalDefinition.schemaVersion !== 2) {
  throw new Error('Only Schema V2 definitions can be edited');
}

// 3. Store original for reference
const originalCanonical = deepClone(canonicalDefinition);
```

### Step 2: Generate Layout for UI

```typescript
// Generate ephemeral view model
const layout: VoucherLayoutV2 = convertToVoucherLayout(
  canonicalDefinition,
  'classic'
);

// User sees and edits layout
// ... UI interactions ...
```

### Step 3: User Edits Layout (UI State)

```typescript
// User can modify:
// - Field labels
// - Field ordering
// - Field visibility
// - Layout metadata (grid columns, spacing)
// - Table column widths

// User CANNOT modify (UI doesn't expose):
// - isPosting
// - postingRole
// - requiredPostingRoles
// - schemaVersion
```

### Step 4: On Save - Reapply Changes to Canonical

```typescript
function rebuildCanonicalFromLayout(
  originalCanonical: VoucherTypeDefinition,
  editedLayout: VoucherLayoutV2
): VoucherTypeDefinition {
  
  // 1. START WITH ORIGINAL (preserve accounting semantics)
  const updated = deepClone(originalCanonical);
  
  // 2. APPLY ALLOWED CHANGES ONLY
  
  // 2a. Update header field labels/metadata
  updated.headerFields = updated.headerFields.map(canonicalField => {
    const layoutField = editedLayout.body.fields.find(f => f.id === canonicalField.id);
    
    if (layoutField) {
      return {
        ...canonicalField,
        // ✅ ALLOWED: Cosmetic changes
        label: layoutField.label,
        required: layoutField.required,
        readOnly: layoutField.readOnly,
        validationRules: layoutField.validationRules || canonicalField.validationRules,
        visibilityRules: layoutField.visibilityRules || canonicalField.visibilityRules,
        
        // ✅ PRESERVED: Accounting semantics (IMMUTABLE)
        isPosting: canonicalField.isPosting,
        postingRole: canonicalField.postingRole,
        schemaVersion: canonicalField.schemaVersion
      };
    }
    
    return canonicalField; // Field not in layout, keep original
  });
  
  // 2b. Update table column widths
  if (editedLayout.lines.columns) {
    updated.tableColumns = updated.tableColumns.map(canonicalColumn => {
      const layoutColumn = editedLayout.lines.columns?.find(
        c => c.id === canonicalColumn.fieldId
      );
      
      if (layoutColumn && layoutColumn.width) {
        return {
          ...canonicalColumn,
          width: layoutColumn.width // ✅ ALLOWED: Width is cosmetic
        };
      }
      
      return canonicalColumn;
    });
  }
  
  // 2c. Update layout metadata (if exists)
  updated.layout = {
    ...updated.layout,
    gridColumns: editedLayout.body.columns,
    gap: editedLayout.body.gap,
    headerLayout: editedLayout.header.layout
  };
  
  // 3. PRESERVE IMMUTABLE PROPERTIES
  updated.schemaVersion = 2; // FORCE Schema V2
  updated.requiredPostingRoles = originalCanonical.requiredPostingRoles;
  updated.id = originalCanonical.id;
  updated.companyId = originalCanonical.companyId;
  updated.code = originalCanonical.code;
  updated.module = originalCanonical.module;
  
  return updated;
}
```

### Step 5: Validate Before Save

```typescript
async function saveVoucherLayout(
  originalCanonical: VoucherTypeDefinition,
  editedLayout: VoucherLayoutV2
): Promise<void> {
  
  // 1. Rebuild canonical with layout changes applied
  const updatedCanonical = rebuildCanonicalFromLayout(
    originalCanonical,
    editedLayout
  );
  
  // 2. Client-side validation (catches errors before API call)
  try {
    validateSchemaV2(updatedCanonical, 'designer-v2-save');
  } catch (error: any) {
    throw new Error(`Cannot save: ${error.message}`);
  }
  
  // 3. Save to backend (backend validates again)
  await voucherTypeRepository.update(
    originalCanonical.code,
    updatedCanonical
  );
  
  // 4. Discard layout (it's ephemeral)
  // Layout will be regenerated on next load
}
```

---

## Allowed vs Forbidden Changes

### ✅ ALLOWED (Cosmetic Changes)

| Property | Allowed Change | Reason |
|----------|---------------|--------|
| **Field.label** | YES | Display text |
| **Field.required** | YES | Validation rule |
| **Field.readOnly** | YES | UI behavior |
| **Field.validationRules** | YES | UI validation |
| **Field.visibilityRules** | YES | UI conditional display |
| **Field.defaultValue** | YES | UI convenience |
| **TableColumn.width** | YES | UI layout |
| **layout metadata** | YES | Grid columns, spacing, etc. |

### ❌ FORBIDDEN (Accounting Semantics)

| Property | Forbidden | Reason |
|----------|-----------|--------|
| **Field.isPosting** | IMMUTABLE | Accounting classification |
| **Field.postingRole** | IMMUTABLE | GL posting semantics |
| **schemaVersion** | IMMUTABLE | Must always be 2 |
| **requiredPostingRoles** | IMMUTABLE | Accounting validation rules |
| **code** | IMMUTABLE | Voucher type identifier |
| **module** | IMMUTABLE | Business domain |
| **companyId** | IMMUTABLE | Ownership |
| **id** | IMMUTABLE | Database identifier |

### ⚠️ RESTRICTED (Allowed but Validated)

| Property | Restriction | Validation |
|----------|------------|------------|
| **Adding/removing fields** | NOT via Designer V2 | Must use Designer V1 or admin tools |
| **Adding/removing table columns** | NOT via Designer V2 | Must use Designer V1 or admin tools |
| **Field type changes** | NOT via Designer V2 | Cannot change TEXT → NUMBER, etc. |

**Why restricted?**
- Adding a posting field requires classifying isPosting/postingRole
- Designer V2 is for LAYOUT only, not schema definition
- Use Designer V1 for structural changes

---

## Error Cases

### Error 1: Attempting to Modify Posting Field Classification

**Scenario**: User somehow modifies `isPosting` or `postingRole` in layout

```typescript
if (layoutField.isPosting !== undefined && 
    layoutField.isPosting !== canonicalField.isPosting) {
  throw new Error(
    `Cannot modify posting classification of field '${canonicalField.id}'. ` +
    `Posting semantics are immutable.`
  );
}
```

**User Message**: 
> "Error: Posting field classifications cannot be changed via layout editor. Use Designer V1 to modify field definitions."

### Error 2: Schema Version Mismatch

**Scenario**: Loaded definition has schemaVersion < 2

```typescript
if (originalCanonical.schemaVersion !== 2) {
  throw new Error(
    `Legacy definition (schema version ${originalCanonical.schemaVersion}) ` +
    `cannot be edited. Please recreate using Designer V1.`
  );
}
```

**User Message**:
> "Error: This voucher definition uses an outdated schema and cannot be edited. Please contact your administrator to upgrade it."

### Error 3: Missing Required Posting Field

**Scenario**: User hides a required posting field via visibility rules

```typescript
const hiddenRequiredFields = updated.headerFields.filter(f => 
  f.isPosting && 
  f.required && 
  hasRuleThatHidesField(f.visibilityRules)
);

if (hiddenRequiredFields.length > 0) {
  throw new Error(
    `Cannot hide required posting fields: ${hiddenRequiredFields.map(f => f.label).join(', ')}`
  );
}
```

**User Message**:
> "Error: Required posting fields cannot be hidden. Fields: Date, Amount, Account"

### Error 4: Field Not Found in Original

**Scenario**: Layout contains a field that doesn't exist in canonical

```typescript
const unknownFields = editedLayout.body.fields.filter(layoutField =>
  !originalCanonical.headerFields.some(cf => cf.id === layoutField.id)
);

if (unknownFields.length > 0) {
  throw new Error(
    `Unknown fields in layout: ${unknownFields.map(f => f.id).join(', ')}. ` +
    `Layout may be corrupt or out of sync.`
  );
}
```

**User Message**:
> "Error: Layout contains fields not defined in the schema. Please reload the page."

### Error 5: Backend Validation Failure

**Scenario**: Client-side validation passed but backend rejects

```typescript
try {
  await voucherTypeRepository.update(code, updatedCanonical);
} catch (error: any) {
  if (error.message.includes('schemaVersion')) {
    throw new Error(
      `Server rejected save: Schema validation failed. ` +
      `This may indicate a data integrity issue. Please contact support.`
    );
  }
  throw error;
}
```

**User Message**:
> "Error: Server validation failed. Your changes could not be saved. Please reload and try again."

---

## Complete Save Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  1. LOAD CANONICAL (Schema V2)                              │
│     - Validate schemaVersion = 2                             │
│     - Clone as originalCanonical                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  2. GENERATE LAYOUT (View Model)                            │
│     - convertToVoucherLayout(canonical)                      │
│     - Strip isPosting, postingRole                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  3. USER EDITS LAYOUT                                        │
│     - Modify labels                                          │
│     - Reorder fields                                         │
│     - Set visibility rules                                   │
│     - Adjust column widths                                   │
└────────────────────┬────────────────────────────────────────┘
                     │
              User clicks SAVE
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  4. REBUILD CANONICAL                                        │
│     - Start with originalCanonical (preserves accounting)    │
│     - Apply ONLY cosmetic changes from layout                │
│     - PRESERVE: isPosting, postingRole, schemaVersion        │
│     - FORCE: schemaVersion = 2                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  5. VALIDATE CLIENT-SIDE                                     │
│     - validateSchemaV2(updatedCanonical)                     │
│     - Check required posting fields not hidden               │
│     - Check no unknown fields                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                PASS │  FAIL
                     │    └──────> Show Error, Stop Save
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  6. SAVE TO BACKEND                                          │
│     - voucherTypeRepository.update(code, updatedCanonical)   │
│     - Backend validates again (Schema V2 enforcement)        │
└────────────────────┬────────────────────────────────────────┘
                     │
                PASS │  FAIL
                     │    └──────> Show Server Error
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  7. SUCCESS                                                  │
│     - Show success message                                   │
│     - Discard layout (ephemeral)                             │
│     - Reload canonical for next edit                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Checklist

### Designer V2 Save Handler

```typescript
import { VoucherTypeDefinition } from '@/types/VoucherTypeDefinition';
import { VoucherLayoutV2 } from '@/types/VoucherLayoutV2';
import { voucherTypeRepository } from '@/repositories/VoucherTypeRepository';

export class DesignerV2SaveHandler {
  private originalCanonical: VoucherTypeDefinition;
  
  constructor(canonical: VoucherTypeDefinition) {
    if (canonical.schemaVersion !== 2) {
      throw new Error('Only Schema V2 can be edited in Designer V2');
    }
    this.originalCanonical = deepClone(canonical);
  }
  
  async saveLayoutChanges(editedLayout: VoucherLayoutV2): Promise<void> {
    // 1. Rebuild canonical with layout changes
    const updated = this.rebuildCanonical(editedLayout);
    
    // 2. Validate
    this.validateChanges(updated);
    
    // 3. Save
    await voucherTypeRepository.update(
      this.originalCanonical.code,
      updated
    );
  }
  
  private rebuildCanonical(layout: VoucherLayoutV2): VoucherTypeDefinition {
    // Implementation from Step 4 above
  }
  
  private validateChanges(updated: VoucherTypeDefinition): void {
    // Check all error cases from Error Cases section
  }
}
```

### UI Integration

```typescript
// In Designer V2 component
const handleSave = async () => {
  try {
    const saveHandler = new DesignerV2SaveHandler(originalCanonical);
    await saveHandler.saveLayoutChanges(editedLayout);
    
    toast.success('Layout saved successfully');
    onClose();
  } catch (error: any) {
    toast.error(error.message);
  }
};
```

---

## Key Guarantees

After implementing this strategy:

✅ **Accounting semantics are NEVER corrupted**
- isPosting, postingRole, schemaVersion always preserved
- requiredPostingRoles cannot be bypassed

✅ **Schema V2 enforcement is maintained**
- schemaVersion always === 2 after save
- Backend validation catches any client-side errors

✅ **UI cannot create invalid states**
- Cannot add posting fields without classification
- Cannot hide required posting fields
- Cannot modify field types

✅ **Changes are limited to cosmetics**
- Labels, ordering, visibility, layout metadata only
- All structural changes require Designer V1

✅ **Errors are caught early**
- Client-side validation before API call
- Clear error messages for users
- No silent failures

---

## Summary

**Designer V2 is a LAYOUT EDITOR, not a SCHEMA EDITOR.**

It allows users to customize how a voucher looks and feels, but cannot change what it does from an accounting perspective. All accounting logic is immutable and preserved from the original canonical definition.

This separation ensures:
1. UI/UX flexibility for users
2. Accounting integrity for auditors
3. Clear separation of concerns
4. Safe, predictable behavior
