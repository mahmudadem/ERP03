# STEP 3: SCHEMA UNIFICATION PLAN

## 1. CANONICAL SCHEMA DECLARATION

**SOURCE OF TRUTH**: `backend/src/domain/designer/entities/VoucherTypeDefinition.ts`

### Canonical VoucherTypeDefinition (Schema Version 2)

```typescript
class VoucherTypeDefinition {
  id: string                          // REQUIRED - Unique identifier
  companyId: string                   // REQUIRED - Company ownership
  name: string                        // REQUIRED - Display name
  code: string                        // REQUIRED - VoucherType enum value
  module: string                      // REQUIRED - 'ACCOUNTING'
  headerFields: FieldDefinition[]     // REQUIRED - Classified fields
  tableColumns: TableColumn[]         // REQUIRED - Line item structure
  layout: Record<string, any>         // REQUIRED - UI layout (JSON)
  schemaVersion: number = 2           // REQUIRED - Must be 2
  requiredPostingRoles?: PostingRole[] // OPTIONAL - Validation roles
  workflow?: any                      // OPTIONAL - Workflow metadata
}
```

### Canonical FieldDefinition

```typescript
class FieldDefinition {
  id: string
  name: string
  label: string
  type: FieldType
  required: boolean
  readOnly: boolean
  isPosting: boolean                  // REQUIRED (Schema V2)
  postingRole: PostingRole | null     // REQUIRED (Schema V2)
  schemaVersion: number = 2           // REQUIRED (Schema V2)
  visibilityRules: VisibilityRule[]
  validationRules: ValidationRule[]
  defaultValue?: any
}
```

### Required Constraints

1. **Schema Version**: Must be `2`
2. **Field Classification**: Every field must have `isPosting` and `postingRole`
3. **Code Match**: `code` must match VoucherType enum value
4. **Module**: Must be valid module name
5. **Validation**: Must pass all V1-V10 rules before use

---

## 2. DIVERGENCE AUDIT

### Source 1: Frontend V1 (`designer-engine/types/VoucherTypeDefinition.ts`)

| Field | Canonical | Frontend V1 | Disposition | Notes |
|-------|-----------|-------------|-------------|-------|
| **id** | string (required) | string? (optional) | MAP | Make required |
| **companyId** | string (required) | string? (optional) | MAP | Make required |
| **name** | string | string | MAP | ✅ Compatible |
| **code** | string | string | MAP | ✅ Compatible |
| **module** | string (required) | string? (optional) | MAP | Make required, validate enum |
| **headerFields** | FieldDefinition[] | FieldDefinition[] | MAP | **Needs field classification** |
| **tableColumns** | TableColumn[] | `tableFields: any[]` | MAP | Rename, restructure |
| **layout** | Record<string, any> | Record<string, any> | MAP | ✅ Compatible |
| **schemaVersion** | number = 2 | ❌ MISSING | MAP | Add with value 2 |
| **requiredPostingRoles** | PostingRole[]? | ❌ MISSING | MAP | Add (optional) |
| **workflow** | any? | { approvalRequired: boolean }? | MAP | Restructure |
| nameTranslations | ❌ NOT IN CANONICAL | Record<string, string>? | DROP | UI concern only |
| abbreviation | ❌ NOT IN CANONICAL | string | DROP | UI concern only |
| color | ❌ NOT IN CANONICAL | string | DROP | UI concern only |
| mode | ❌ NOT IN CANONICAL | 'single-line' \| 'multi-line' | DROP | Inferred from code |
| customFields | ❌ NOT IN CANONICAL | any[]? | FORBIDDEN | Use headerFields |
| status | ❌ NOT IN CANONICAL | 'ACTIVE' \| 'DRAFT'? | DROP | Workflow concern |

**Status**: ❌ INCOMPATIBLE - Requires adapter

### Source 2: Frontend V2 (`designer-v2/types/VoucherLayoutV2.ts`)

| Field | Canonical | Frontend V2 | Disposition | Notes |
|-------|-----------|-------------|-------------|-------|
| **Entire Structure** | VoucherTypeDefinition | VoucherLayoutV2 | FORBIDDEN | **COMPLETELY DIFFERENT SCHEMA** |

**Divergence**: Frontend V2 uses a completely different structure:
- `VoucherLayoutV2` focuses on UI rendering (4 areas: header, body, lines, actions)
- Not a definition schema - it's a layout schema
- Mixes UI concerns with data concerns
- Does NOT

 contain field classifications
- Does NOT have posting role information

**Status**: ❌ INCOMPATIBLE - CANNOT BE MAPPED TO CANONICAL

**Recommendation**: Frontend V2 should:
1. Load VoucherTypeDefinition from backend
2. Generate VoucherLayoutV2 FROM VoucherTypeDefinition
3. VoucherLayoutV2 becomes a VIEW MODEL, not persisted entity

### Source 3: AI Designer (`ai-designer/types.ts` - VoucherTypeConfig)

| Field | Canonical | AI Designer | Disposition | Notes |
|-------|-----------|-------------|-------------|-------|
| **id** | string | string | MAP | ✅ Compatible |
| **name** | string | string | MAP | ✅ Compatible |
| **code** | string | ❌ MISSING | FORBIDDEN | Uses `prefix` instead |
| **module** | string | ❌ MISSING | MAP | Hardcode 'ACCOUNTING' |
| **headerFields** | FieldDefinition[] | ❌ MISSING | FORBIDDEN | Uses `uiModeOverrides` |
| **tableColumns** | TableColumn[] | string[]? | MAP | Convert from tableColumns names |
| **layout** | Record<string, any> | VoucherLayoutConfig | MAP | Extract from uiModeOverrides |
| **schemaVersion** | number = 2 | ❌ MISSING | MAP | Add with value 2 |
| prefix | ❌ NOT IN CANONICAL | string | DROP | Generate code from name |
| startNumber | ❌ NOT IN CANONICAL | number | DROP | Separate sequence concern |
| rules | ❌ NOT IN CANONICAL | VoucherRule[] | DROP | Workflow concern |
| isMultiLine | ❌ NOT IN CANONICAL | boolean | DROP | Inferred from code |
| defaultCurrency | ❌ NOT IN CANONICAL | string? | DROP | Company setting |
| actions | ❌ NOT IN CANONICAL | VoucherAction[] | DROP | UI concern |
| uiModeOverrides | ❌ NOT IN CANONICAL | { classic, windows } | MAP | Convert to single layout |

**Status**: ❌ INCOMPATIBLE - Requires complex adapter

---

## 3. ADAPTER STRATEGY

### Adapter 1: Frontend V1 → Canonical

```
FrontendV1Adapter {
  input: designer-engine/types/VoucherTypeDefinition
  output: backend VoucherTypeDefinition (validated)
  
  Mapping:
  1. id → id (validate non-null)
  2. companyId → companyId (validate non-null)
  3. name → name
  4. code → code (validate matches VoucherType enum)
  5. module → module (validate non-null, convert to string)
  6. headerFields → headerFields (validate each has isPosting, postingRole)
  7. tableFields → tableColumns (restructure array)
  8. layout → layout
  9. workflow → workflow (extract { approvalRequired })
  10. Add: schemaVersion = 2
  11. Add: requiredPostingRoles (based on code)
  
  Dropped:
  - nameTranslations
  - abbreviation
  - color
  - mode
  - customFields
  - status
  
  Validation:
  - Run VoucherTypeDefinitionValidator.validate()
  - Reject if validation fails
  - Log dropped fields as INFO
}
```

### Adapter 2: AI Designer → Canonical

```
AIDesignerAdapter {
  input: ai-designer VoucherTypeConfig
  output: backend VoucherTypeDefinition (validated)
  
  Mapping:
  1. id → id
  2. Generate: companyId (from current context)
  3. name → name
  4. Generate: code from name (kebab-case, match enum)
  5. Generate: module = 'ACCOUNTING'
  6. Flatten: uiModeOverrides.classic.sections → headerFields
     - Extract FieldLayout → FieldDefinition
     - Classify each field (isPosting = false by default)
     - Assign postingRole = null
  7. tableColumns (names) → TableColumn[] (add fieldId, width)
  8. uiModeOverrides → layout (serialize as JSON)
  9. Add: schemaVersion = 2
  10. Add: requiredPostingRoles (based on generated code)
  11. Generate: workflow = { approvalRequired: rules.some(r => r.enabled) }
  
  Dropped:
  - prefix (use code instead)
  - startNumber
  - rules (move to separate workflow entity)
  - defaultCurrency
  - actions
  - isMultiLine
  
  Validation:
  - Run VoucherTypeDefinitionValidator.validate()
  - Reject if validation fails
  - Warn: All fields marked non-posting (manual review needed)
}
```

### Adapter 3: Frontend V2 → FORBIDDEN

```
NO ADAPTER

Frontend V2 VoucherLayoutV2 is NOT a definition schema.

Correct flow:
1. Load VoucherTypeDefinition from backend (canonical)
2. Frontend V2 generates VoucherLayoutV2 FROM VoucherTypeDefinition
3. VoucherLayoutV2 is ephemeral (UI view model)
4. Never persist VoucherLayoutV2 to database

Designer V2 must:
- Save to canonical VoucherTypeDefinition schema
- Generate layout configuration in canonical format
- Regenerate VoucherLayoutV2 on load
```

---

## 4. UNIFIED LOAD FLOW

### Single Load Path (ALL Sources)

```
┌─────────────────┐
│  Data Source    │ (Firestore, API, localStorage)
└────────┬────────┘
        │
        ▼
┌─────────────────┐
│  Deserialize    │ (JSON → Object)
└────────┬────────┘
        │
        ▼
┌─────────────────┐
│  Run Adapter    │ (If non-canonical source)
│  (if needed)    │  - Frontend V1: FrontendV1Adapter
└────────┬────────┘  - AI: AIDesignerAdapter
        │            - Backend: No adapter
        ▼
┌─────────────────┐
│  Validate       │ VoucherTypeDefinitionValidator.validate()
│  (V1-V9)        │  - schemaVersion >= 2
└────────┬────────┘  - All fields classified
        │            - Required posting roles present
        ▼
     ┌──────┐
     │ Valid? │
     └──┬─┬──┘
        │ │
    YES │ │ NO
        │ │
        │ └─────────┐
        ▼           ▼
┌────────────┐  ┌──────────────┐
│   ACCEPT   │  │    REJECT    │
│   Return   │  │ Log Error    │
│ Definition │  │ Return null  │
└────────────┘  └──────────────┘
```

### Rejection Behavior

**On Load Failure**:
1. Log error with details:
   - Source file/collection
   - Validation error message
   - Definition ID and name
   - Timestamp
2. If from list query: Exclude from results
3. If from get query: Return null
4. Increment error metric

**Error Log Format**:
```
[VOUCHER_DEF_LOAD_ERROR] Failed to load voucher definition
  ID: abc123
  Name: Payment Voucher
  Source: firestore://companies/comp1/voucher-types/abc123
  Error: Field 'vendorAccountId' missing required 'postingRole' property
  Timestamp: 2025-12-17T22:30:00Z
```

---

## 5. DECOMMISSION PLAN

### Remove (Delete)

**AI Designer Types** (`ai-designer/types.ts`):
- ❌ `VoucherTypeConfig` interface - REMOVE
- ❌ `VoucherRule` interface - REMOVE (move to workflow module)
- ❌ `VoucherAction` interface - REMOVE (UI concern)
- ❌ `VoucherLayoutConfig` interface - REMOVE (use canonical layout)
- ✅ Keep: `FieldLayout`, `SectionLayout` (used in canonical layout JSON)

**Frontend V1 Types** (`designer-engine/types/VoucherTypeDefinition.ts`):
- ❌ REMOVE entire file
- ✅ Replace with: Import from canonical backend types OR create matching interface

### Freeze (Read-Only)

**Frontend V2 Types** (`designer-v2/types/VoucherLayoutV2.ts`):
- ⚠️ **FREEZE** - Keep as VIEW MODEL only
- Mark as:
  ```typescript
  /**
   * @deprecated for persistence
   * This is a UI view model ONLY.
   * DO NOT save to database.
   * Generate from VoucherTypeDefinition on load.
   */
  export interface VoucherLayoutV2 { ... }
  ```
- Update Designer V2 to:
  1. Load VoucherTypeDefinition (canonical)
  2. Generate VoucherLayoutV2 for rendering
  3. On save: Convert back to VoucherTypeDefinition

### Redirect Through Adapters

**AI Designer** (`ai-designer/`):
- All saves → AIDesignerAdapter → Canonical schema → Validate → Persist
- All loads → Load canonical → (optionally convert to VoucherTypeConfig for UI)
- localStorage → Store canonical schema, not VoucherTypeConfig

**Frontend V1** (`designer/`):
- All saves → FrontendV1Adapter → Canonical schema → Validate → Persist
- All loads → Load canonical → (optionally enhance with V1-specific UI fields)
- Repository → Use canonical schema

**Frontend V2** (`designer-v2/`):
- All saves → Build canonical VOUCHER_TYPE_DEFINITION directly
- All loads → Load canonical → Generate VoucherLayoutV2 view model
- Never persist VoucherLayoutV2

---

## 6. MIGRATION PATH

### Phase 1: Backend Canonical (✅ COMPLETE - STEP 2)
- Backend types updated
- Validation layer implemented

### Phase 2: Frontend Type Alignment (NEXT)

**2.1 Update Frontend V1**:
```typescript
// Option A: Import from backend (if shared)
import { VoucherTypeDefinition, FieldDefinition } from '@backend/designer/entities';

// Option B: Create matching interface
export type VoucherTypeDefinition = {
  id: string;
  companyId: string;
  // ... match backend exactly
  schemaVersion: number;
}
```

**2.2 Update Frontend V2**:
```typescript
// Add canonical import
import { VoucherTypeDefinition } from '@backend/designer/entities';

// Keep VoucherLayoutV2 as view model
export interface VoucherLayoutV2 {
  // ...existing UI structure
}

// Add converter
export function convertToLayout(def: VoucherTypeDefinition): VoucherLayoutV2;
export function convertFromLayout(layout: VoucherLayoutV2): VoucherTypeDefinition;
```

**2.3 Update AI Designer**:
```typescript
// Replace VoucherTypeConfig with canonical
import { VoucherTypeDefinition } from '@backend/designer/entities';

// Update VoucherContext to use canonical
const [vouchers, setVouchers] = useState<VoucherTypeDefinition[]>([]);

// Add adapter for legacy localStorage data
function migrateFromVoucherTypeConfig(old: VoucherTypeConfig): VoucherTypeDefinition;
```

### Phase 3: Repository Integration

**All repositories must**:
1. Accept only canonical VoucherTypeDefinition
2. Run validation before save
3. Run validation after load
4. Reject invalid definitions

### Phase 4: Adapter Implementation

1. Create adapters (as specified above)
2. Wire into save flows
3. Test with existing data
4. Deploy with feature flag

### Phase 5: Cleanup

1. Remove decommissioned types
2. Update imports
3. Remove adapter code (once migration complete)
4. Update documentation

---

## 7. CONFIRMATION STATEMENT

**After this unification, only ONE VoucherTypeDefinition schema exists.**

### Guarantees:

✅ **Single Source of Truth**: Backend `VoucherTypeDefinition` (Schema V2)  
✅ **Field Classification**: Every field classified (isPosting + postingRole)  
✅ **Validation Enforced**: All definitions validated before save and after load  
✅ **No Divergence**: Frontend types match or adapt to canonical  
✅ **View Models Separated**: UI layouts (VoucherLayoutV2) generated from canonical  
✅ **Legacy Blocked**: SchemaVersion < 2 definitions rejected  
✅ **Accounting Safety**: Posting strategy safety maintained  

### What Changes:

- ❌ Frontend V1: `VoucherTypeDefinition` interface replaced/aligned
- ❌ Frontend V2: Uses canonical + generates VoucherLayoutV2 view model
- ❌ AI Designer: `VoucherTypeConfig` replaced with canonical
- ✅ Backend: Already canonical (no change)

### What Stays:

- ✅ VoucherLayoutV2: Kept as UI view model (not persisted)
- ✅ FieldLayout, SectionLayout: Used in canonical layout JSON
- ✅ Validation rules: All V1-V10 enforced

---

**Unification Date**: December 17, 2025  
**Schema Version**: 2 (Canonical)  
**Status**: ✅ Plan Complete, Ready for Implementation
