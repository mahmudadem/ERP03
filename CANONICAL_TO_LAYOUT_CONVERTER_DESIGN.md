# Canonical VoucherTypeDefinition → VoucherLayoutV2 Converter

## ⚠️ CRITICAL: VIEW MODEL ONLY

**VoucherLayoutV2 is a UI VIEW MODEL ONLY. DO NOT persist to database.**

This converter is ONE-WAY ONLY:
- ✅ Canonical → VoucherLayoutV2 (for rendering)
- ❌ VoucherLayoutV2 → Canonical (FORBIDDEN - prevents reverse inference)

---

## Function Signature

```typescript
/**
 * Converts canonical VoucherTypeDefinition (Schema V2) to VoucherLayoutV2 view model.
 * 
 * @param definition - Canonical VoucherTypeDefinition (schemaVersion must be 2)
 * @param mode - Display mode ('classic' | 'windows')
 * @returns VoucherLayoutV2 - UI view model for rendering ONLY
 * 
 * @throws Error if definition.schemaVersion !== 2
 * 
 * IMPORTANT: VoucherLayoutV2 is ephemeral. Never persist it.
 * To save changes, reconstruct canonical VoucherTypeDefinition from UI state.
 */
function convertToVoucherLayout(
  definition: VoucherTypeDefinition,
  mode: DisplayMode = 'classic'
): VoucherLayoutV2;
```

---

## Mapping Table

| Canonical Field | VoucherLayoutV2 Target | Transformation | Notes |
|----------------|------------------------|----------------|-------|
| **id** | `layout.id` | Direct copy | Identifier only |
| **companyId** | `layout.companyId` | Direct copy | For filtering |
| **name** | _Dropped_ | Not used | Layout doesn't need display name |
| **code** | `layout.voucherType` | Cast to VoucherTypeCode | Maps to voucher type |
| **module** | _Dropped_ | Not used | Implied by voucherType |
| **headerFields** | `layout.body.fields` | Map to FieldDefinitionV2[] | **isPosting/postingRole DROPPED** |
| **tableColumns** | `layout.lines.columns` | Map to FieldDefinitionV2[] | Only fieldId used for lookup |
| **layout** (JSON) | _Ordering hints only_ | Extract field order if present | Does NOT control semantics |
| **schemaVersion** | _Validation only_ | Verify === 2, then drop | Not part of view model |
| **requiredPostingRoles** | _Dropped_ | Not used | Accounting concern, not UI |
| **workflow** | _Dropped_ | Not used | Business logic, not rendering |

---

## Dropped Properties (Accounting Semantics)

These properties are **intentionally excluded** from VoucherLayoutV2 to prevent reverse inference:

1. **isPosting** - Posting classification (accounting concern)
2. **postingRole** - GL posting role (accounting concern)
3. **requiredPostingRoles** - Validation rules (business logic)
4. **workflow** - Approval workflow (business logic)
5. **schemaVersion** - Schema metadata (validation only)
6. **name** - Definition name (not needed for rendering)
7. **module** - Module classification (implicit)

**Why dropped?**
- UI layout should NEVER infer accounting semantics
- VoucherLayoutV2 is for DISPLAY ONLY
- All accounting rules remain in canonical schema

---

## Field Transformation Details

### headerFields → body.fields

```typescript
// Input: definition.headerFields (with isPosting, postingRole)
[
  { id: 'date', name: 'date', label: 'Date', type: 'DATE', 
    required: true, isPosting: true, postingRole: 'DATE' },
  { id: 'vendor', name: 'vendor', label: 'Vendor', type: 'TEXT', 
    required: true, isPosting: false, postingRole: null }
]

// Output: layout.body.fields (isPosting/postingRole STRIPPED)
[
  { id: 'date', name: 'date', label: 'Date', type: 'DATE', 
    required: true, readOnly: false },
  { id: 'vendor', name: 'vendor', label: 'Vendor', type: 'TEXT', 
    required: true, readOnly: false }
]
```

**Key**: UI does NOT need to know which fields are posting fields.

### tableColumns → lines.columns

```typescript
// Input: definition.tableColumns
[
  { fieldId: 'account', width: '30%' },
  { fieldId: 'debit', width: '20%' },
  { fieldId: 'credit', width: '20%' }
]

// Output: layout.lines.columns (lookup from field definitions)
[
  { id: 'account', name: 'account', label: 'Account', type: 'ACCOUNT', width: '30%' },
  { id: 'debit', name: 'debit', label: 'Debit', type: 'NUMBER', width: '20%' },
  { id: 'credit', name: 'credit', label: 'Credit', type: 'NUMBER', width: '20%' }
]
```

**Key**: Width preserved, but full field definition needed for rendering.

---

## Implementation Pseudocode

```typescript
function convertToVoucherLayout(
  definition: VoucherTypeDefinition,
  mode: DisplayMode = 'classic'
): VoucherLayoutV2 {
  // 1. VALIDATE: Schema V2 required
  if (definition.schemaVersion !== 2) {
    throw new Error('Only Schema V2 definitions can be converted to layout');
  }

  // 2. DETERMINE: Lines area type based on voucher type
  const linesType: LinesAreaType = 
    ['JOURNAL_ENTRY', 'OPENING_BALANCE'].includes(definition.code)
      ? 'table'
      : 'single-line';

  // 3. MAP: Header fields to body fields (STRIP POSTING SEMANTICS)
  const bodyFields = definition.headerFields.map(field => ({
    id: field.id,
    name: field.name,
    label: field.label,
    type: field.type,
    required: field.required,
    readOnly: field.readOnly,
    validationRules: field.validationRules,
    visibilityRules: field.visibilityRules,
    defaultValue: field.defaultValue
    // isPosting: DROPPED
    // postingRole: DROPPED
    // schemaVersion: DROPPED
  }));

  // 4. MAP: Table columns (if table mode)
  const lineColumns = linesType === 'table'
    ? definition.tableColumns.map(col => 
        createFieldDefinitionForColumn(col.fieldId, col.width)
      )
    : undefined;

  // 5. BUILD: VoucherLayoutV2 (VIEW MODEL)
  return {
    id: definition.id,
    voucherType: definition.code as VoucherTypeCode,
    mode,
    companyId: definition.companyId,
    isDefault: false,
    
    header: {
      fields: getDefaultHeaderFields(), // System metadata fields
      locked: true,
      layout: 'inline'
    },
    
    body: {
      fields: bodyFields,
      columns: 4, // Default grid
      gap: 16
    },
    
    lines: {
      type: linesType,
      columns: lineColumns,
      minLines: linesType === 'table' ? 1 : undefined,
      showTotals: linesType === 'table',
      showAddButton: linesType === 'table'
    },
    
    actions: {
      buttons: getDefaultActionButtons(),
      alignment: 'right'
    }
  };
}
```

---

## Example Input/Output

### Input: Canonical VoucherTypeDefinition (Schema V2)

```json
{
  "id": "pay-001",
  "companyId": "comp-123",
  "name": "Payment Voucher",
  "code": "PAYMENT",
  "module": "ACCOUNTING",
  "schemaVersion": 2,
  "headerFields": [
    {
      "id": "date",
      "name": "date",
      "label": "Payment Date",
      "type": "DATE",
      "required": true,
      "readOnly": false,
      "isPosting": true,
      "postingRole": "DATE",
      "schemaVersion": 2
    },
    {
      "id": "vendorAccountId",
      "name": "vendorAccountId",
      "label": "Vendor",
      "type": "ACCOUNT",
      "required": true,
      "readOnly": false,
      "isPosting": true,
      "postingRole": "ACCOUNT",
      "schemaVersion": 2
    },
    {
      "id": "amount",
      "name": "amount",
      "label": "Amount",
      "type": "NUMBER",
      "required": true,
      "readOnly": false,
      "isPosting": true,
      "postingRole": "AMOUNT",
      "schemaVersion": 2
    },
    {
      "id": "reference",
      "name": "reference",
      "label": "Reference",
      "type": "TEXT",
      "required": false,
      "readOnly": false,
      "isPosting": false,
      "postingRole": null,
      "schemaVersion": 2
    }
  ],
  "tableColumns": [],
  "layout": {},
  "requiredPostingRoles": ["DATE", "ACCOUNT", "AMOUNT"]
}
```

### Output: VoucherLayoutV2 (View Model)

```json
{
  "id": "pay-001",
  "voucherType": "PAYMENT",
  "mode": "classic",
  "companyId": "comp-123",
  "isDefault": false,
  
  "header": {
    "fields": [
      { "id": "voucherNo", "label": "Voucher No", "type": "TEXT", "readOnly": true },
      { "id": "status", "label": "Status", "type": "TEXT", "readOnly": true }
    ],
    "locked": true,
    "layout": "inline"
  },
  
  "body": {
    "fields": [
      {
        "id": "date",
        "name": "date",
        "label": "Payment Date",
        "type": "DATE",
        "required": true,
        "readOnly": false
        // ✅ isPosting: DROPPED
        // ✅ postingRole: DROPPED
      },
      {
        "id": "vendorAccountId",
        "name": "vendorAccountId",
        "label": "Vendor",
        "type": "ACCOUNT",
        "required": true,
        "readOnly": false
        // ✅ isPosting: DROPPED
        // ✅ postingRole: DROPPED
      },
      {
        "id": "amount",
        "name": "amount",
        "label": "Amount",
        "type": "NUMBER",
        "required": true,
        "readOnly": false
        // ✅ isPosting: DROPPED
        // ✅ postingRole: DROPPED
      },
      {
        "id": "reference",
        "name": "reference",
        "label": "Reference",
        "type": "TEXT",
        "required": false,
        "readOnly": false
        // ✅ isPosting: DROPPED
        // ✅ postingRole: DROPPED (was null)
      }
    ],
    "columns": 4,
    "gap": 16
  },
  
  "lines": {
    "type": "single-line",
    "columns": undefined,
    "showTotals": false,
    "showAddButton": false
  },
  
  "actions": {
    "buttons": [
      { "id": "submit", "label": "Submit", "variant": "primary", "action": "submit" },
      { "id": "draft", "label": "Save Draft", "variant": "secondary", "action": "saveDraft" }
    ],
    "alignment": "right"
  }
}
```

---

## CRITICAL WARNINGS

### ❌ DO NOT

1. **DO NOT persist VoucherLayoutV2 to database**
   - It's a VIEW MODEL only
   - Always regenerate from canonical definition

2. **DO NOT infer accounting logic from layout**
   - Layout doesn't know which fields are posting fields
   - Layout doesn't know posting roles
   - Layout doesn't know required posting roles

3. **DO NOT allow reverse conversion**
   - VoucherLayoutV2 → VoucherTypeDefinition is FORBIDDEN
   - UI changes must rebuild canonical definition explicitly

4. **DO NOT store posting semantics in layout**
   - isPosting, postingRole are stripped intentionally
   - UI cannot modify accounting behavior

### ✅ DO

1. **Load canonical definition → Generate layout**
2. **User edits in UI → Build new canonical definition**
3. **Save canonical definition → Backend validates**
4. **Discard layout after save**

---

## Data Flow (Correct Pattern)

```
┌─────────────────────────┐
│  Load Canonical         │
│  VoucherTypeDefinition  │
│  (from backend)         │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  convertToVoucherLayout │ ← THIS FUNCTION
│  (one-way conversion)   │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  VoucherLayoutV2        │
│  (ephemeral view model) │
│  Used ONLY for rendering│
└────────────┬────────────┘
             │
      User Edits UI
             │
             ▼
┌─────────────────────────┐
│  Rebuild Canonical      │
│  VoucherTypeDefinition  │
│  from UI state          │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Validate & Save        │
│  Canonical Definition   │
│  (backend validates)    │
└─────────────────────────┘
             │
             ▼
      Discard VoucherLayoutV2
```

---

## File Location

**Recommended**: `frontend/src/modules/accounting/designer-v2/converters/canonicalToLayout.ts`

**Freeze VoucherLayoutV2.ts with warning**:
```typescript
/**
 * @deprecated for persistence
 * VoucherLayoutV2 is a UI VIEW MODEL ONLY.
 * DO NOT save this to database.
 * 
 * Use Flow:
 * 1. Load VoucherTypeDefinition (canonical)
 * 2. Generate VoucherLayoutV2 for rendering
 * 3. On save: Build VoucherTypeDefinition directly
 * 4. Discard VoucherLayoutV2
 */
export interface VoucherLayoutV2 { ... }
```

---

## Summary

✅ **Pure function**: No side effects  
✅ **One-way only**: Canonical → Layout (never reverse)  
✅ **Strips accounting semantics**: isPosting, postingRole dropped  
✅ **View model only**: Never persisted  
✅ **Safe**: Cannot infer posting logic from layout  
✅ **Documented**: Clear warnings about usage  

This design ensures VoucherLayoutV2 remains a pure UI concern, completely separated from accounting integrity enforced by canonical Schema V2.
