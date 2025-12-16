# Phase 5: NEW Voucher Designer with ADR-005 Rules

**Date:** December 16, 2025  
**Status:** 📋 PLANNED  
**Approach:** Create new designer, preserve existing UX/UI

---

## 🎯 **Objective**

Build a **NEW** voucher designer that:
- ✅ Preserves the **EXCELLENT existing UX/UI** (especially layout step)
- ✅ Enforces **CORE/SHARED/PERSONAL** field categories (strict ADR-005 rules)
- ✅ Supports **4-area voucher structure** (Header/Body/Lines/Actions)
- ✅ Works with both **Classic and Windows** modes
- ✅ Integrates with **ADR-005 backend** (Payment/Receipt/Journal/Opening)

---

## 📦 **What We Keep from Existing Designer**

### **UX/UI Elements to Preserve:**

1. **Wizard Flow** ✅
   - Step-by-step process
   - Progress indicator at top
   - Previous/Next/Cancel buttons

2. **Layout Step** ✅ **(THE BEST PART!)**
   - Live preview canvas
   - Classic vs Windows mode toggle
   - Drag & drop field reordering
   - Click to select field
   - Properties panel on right
   - Styling controls (color, font, size, alignment, padding, etc.)
   - Width slider (1-4 columns)
   - Test Run button (modal preview)

3. **Visual Design** ✅
   - Clean, modern UI
   - Wireframe-style preview
   - Hover effects
   - Selected field highlighting

---

## 🏗️ **New Architecture: CORE/SHARED/PERSONAL System**

### **Extended Type System**

```typescript
// NEW: Field Category System
export type FieldCategory = 'CORE' | 'SHARED' | 'PERSONAL';

// NEW: Extended FieldDefinition
export interface FieldDefinitionV2 extends FieldDefinition {
  // Category classification
  category: FieldCategory;
  
  // Backend binding (IMMUTABLE for CORE/SHARED)
  dataKey: string;              // Key in voucher data (e.g., 'amount')
  semanticMeaning: string;      // What it represents
  
  // Enforcement rules
  canRemove: boolean;           // false for CORE/SHARED, true for PERSONAL
  canHide: boolean;             // false for CORE, true for SHARED/PERSONAL
  canRenameLabel: boolean;      // true for all (UI label only)
  canChangeDataKey: boolean;    // false for CORE/SHARED
  canChangeType: boolean;       // false for CORE/SHARED
  
  // Storage location
  storedIn: 'voucher' | 'userPreferences';
  
  // Visibility
  showInJournal: boolean;       // true for CORE/SHARED, false for PERSONAL
  showInReports: boolean;       // true for CORE/SHARED, false for PERSONAL
  showInSearch: boolean;        // true for CORE/SHARED, false for PERSONAL
  allowExport: boolean;         // true for CORE/SHARED, false for PERSONAL
  visibleToManagement: boolean; // true for CORE/SHARED, false for PERSONAL
}

// NEW: 4-Area Voucher Structure
export interface VoucherLayoutV2 {
  voucherType: 'PAYMENT' | 'RECEIPT' | 'JOURNAL_ENTRY' | 'OPENING_BALANCE';
  
  areas: {
    header: {
      fields: FieldDefinitionV2[];  // Read-only metadata (status, voucher no, etc.)
      locked: boolean;               // Cannot be modified
    };
    body: {
      fields: FieldDefinitionV2[];  // Input fields (varies by type)
      layout: 'grid';                // 4-column grid
    };
    lines: {
      type: 'table' | 'single-line' | 'preview';
      columns?: FieldDefinitionV2[]; // For table mode
      minLines?: number;             // Minimum required lines
    };
    actions: {
      buttons: ActionButton[];       // Submit, Draft, Print, etc.
    };
  };
}

// System Field Registry
export interface SystemFieldRegistry {
  [voucherType: string]: {
    coreFields: FieldDefinitionV2[];    // Required by backend
    sharedFields: FieldDefinitionV2[];  // Optional, system-defined
  };
}
```

---

## 🎨 **NEW Wizard Steps**

### **Step 1: Select Voucher Type** (Simplified)

```
┌─────────────────────────────────────────┐
│  Select Voucher Type                    │
├─────────────────────────────────────────┤
│                                         │
│   [ Payment Voucher     ]  ← ADR-005   │
│   [ Receipt Voucher     ]  ← ADR-005   │
│   [ Journal Entry       ]  ← ADR-005   │
│   [ Opening Balance     ]  ← ADR-005   │
│                                         │
└─────────────────────────────────────────┘

User clicks one → Loads system fields
```

---

### **Step 2: Field Selection** (CORE/SHARED/PERSONAL Categories)

```
┌──────────────────────────────────────────────────────┐
│  Field Selection for Payment Voucher                 │
├──────────────────────────────────────────────────────┤
│                                                      │
│  🔒 CORE FIELDS (Required - Cannot Remove)          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ Date     │ │ Amount   │ │ Cash A/C │  [Locked]  │
│  │ 🔒       │ │ 🔒       │ │ 🔒       │            │
│  └──────────┘ └──────────┘ └──────────┘            │
│                                                      │
│  🔗 SHARED FIELDS (Optional - System Defined)       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ Invoice# │ │ Reference│ │ Supplier │  [Toggle]  │
│  │ ☑        │ │ ☐        │ │ ☑        │            │
│  └──────────┘ └──────────┘ └──────────┘            │
│                                                      │
│  👤 PERSONAL FIELDS (Your Private Notes)            │
│  ┌──────────┐ ┌──────────┐                         │
│  │ My Notes │ │ Highlight│              [+ Add]    │
│  │ ☑        │ │ ☐        │                         │
│  └──────────┘ └──────────┘                         │
│                                                      │
└──────────────────────────────────────────────────────┘

Legend:
🔒 = Cannot remove/hide
🔗 = Can show/hide, cannot delete
👤 = Can add/remove freely
```

**Validation:**
- ❌ Cannot proceed if any CORE field is deselected
- ✅ SHARED fields can be toggled on/off
- ✅ PERSONAL fields can be added/removed

---

### **Step 3: Layout Editor** (SAME as existing!)

**Preserve EXACTLY the current UX:**

```
┌────────────────────────────────────────────────────────────────┐
│  Visual Layout Editor                              [Test Run]  │
│  Drag fields to move. Resize with slider.                      │
│                                                                │
│  [Classic] [Windows] ← Mode toggle                            │
├────────────────────────────────────────────────────────────────┤
│                    │                                           │
│    CANVAS          │     PROPERTIES PANEL                      │
│    (Live Preview)  │                                           │
│                    │  [ Field Selected: Amount ]               │
│  ┌───────────────┐ │                                           │
│  │ HEADER        │ │  Label: [Amount________]                  │
│  │ Status: Draft │ │  Text Color: [🎨]                         │
│  │ #: Pending    │ │  Font Weight: [Normal ▼]                 │
│  └───────────────┘ │  Width: [━━●━] 2 cols                     │
│                    │                                           │
│  ┌───────────────┐ │  ⚠️ CANNOT:                               │
│  │ BODY          │ │  - Remove (CORE field)                    │
│  │ [Date]        │ │  - Hide (CORE field)                      │
│  │ [Amount] ←    │ │  - Change data key                        │
│  │ [Cash A/C]    │ │                                           │
│  │ [Expense A/C] │ │  ✅ CAN:                                   │
│  └───────────────┘ │  - Rename label                           │
│                    │  - Reorder                                │
│  ┌───────────────┐ │  - Style (color, font, etc.)              │
│  │ LINES         │ │                                           │
│  │ (Preview)     │ │                                           │
│  │ DR: Expense   │ │                                           │
│  │ CR: Cash      │ │                                           │
│  └───────────────┘ │                                           │
│                    │                                           │
│  ┌───────────────┐ │                                           │
│  │ ACTIONS       │ │                                           │
│  │ [Submit] [Drft│ │                                           │
│  └───────────────┘ │                                           │
└────────────────────┴───────────────────────────────────────────┘
```

**Enhancements:**
- Add category indicator to each field (lock icon for CORE, share icon for SHARED, person icon for PERSONAL)
- Disable drag/remove for CORE fields
- Show warning tooltips when trying to modify protected fields

---

### **Step 4: Validation Rules** (NEW - AUTO-ENFORCED)

```
┌──────────────────────────────────────────────┐
│  Validation Summary                          │
├──────────────────────────────────────────────┤
│                                              │
│  ✅ All CORE fields present                  │
│  ✅ All CORE fields visible                  │
│  ✅ No data key conflicts                    │
│  ✅ Layout valid                             │
│                                              │
│  📊 Field Breakdown:                         │
│     🔒 CORE: 5 fields                        │
│     🔗 SHARED: 3 fields (2 visible)          │
│     👤 PERSONAL: 1 field                     │
│                                              │
└──────────────────────────────────────────────┘

This step is mostly auto-validated.
User just reviews.
```

---

### **Step 5: Review & Save**

```
┌──────────────────────────────────────────────┐
│  Review Configuration                        │
├──────────────────────────────────────────────┤
│                                              │
│  Type: Payment Voucher                       │
│  Mode: Windows                               │
│                                              │
│  Fields: 9 total                             │
│    - 5 CORE (required)                       │
│    - 3 SHARED (2 visible)                    │
│    -1 PERSONAL (private)                    │
│                                              │
│  ⚠️ This configuration will be:              │
│     - Applied to YOUR voucher views          │
│     - NOT affect other users                 │
│     - NOT change General Journal             │
│                                              │
│  [Cancel]              [Save Configuration]  │
│                                              │
└──────────────────────────────────────────────┘
```

---

## 🗄️ **Data Storage Structure**

### **System Registry (Firestore - Global)**

```
system/voucherFieldRegistry/{voucherType}
```

Example for PAYMENT:
```typescript
{
  voucherType: 'PAYMENT',
  coreFields: [
    {
      id: 'date',
      dataKey: 'date',
      label: 'Date',
      category: 'CORE',
      type: 'DATE',
      canRemove: false,
      canHide: false,
      storedIn: 'voucher',
      showInJournal: true,
      // ... other properties
    },
    // ... other CORE fields
  ],
  sharedFields: [
    {
      id: 'purchaseInvoiceNo',
      dataKey: 'purchaseInvoiceNo',
      label: 'Purchase Invoice No',
      category: 'SHARED',
      type: 'TEXT',
      canRemove: false,
      canHide: true,
      storedIn: 'voucher',
      showInJournal: true,
      // ... other properties
    },
    // ... other SHARED fields
  ]
}
```

---

### **User Layout Configuration (Firestore - Per User)**

```
users/{userId}/voucherLayouts/{voucherType}
```

Example:
```typescript
{
  userId: 'user-123',
  voucherType: 'PAYMENT',
  mode: 'windows',  // or 'classic'
  
  areas: {
    header: {
      // Locked, always same
    },
    body: {
      fields: [
        {
          id: 'date',
          label: 'Payment Date',  // User renamed
          visible: true,
          order: 1,
          width: '1/2',
          style: { color: '#1e40af' }  // User customized
        },
        {
          id: 'purchaseInvoiceNo',
          visible: false  // User hid this SHARED field
        },
        // ...
      ]
    }
  },
  
  // PERSONAL data is stored separately
  personalFields: [
    {
      id: 'personalNotes',
      label: 'My Notes',
      type: 'TEXTAREA',
      visible: true
    }
  ]
}
```

---

### **Personal Data Storage (Firestore - Per Voucher)**

```
users/{userId}/voucherPersonalData/{voucherId}
```

Example:
```typescript
{
  voucherId: 'voucher-456',
  personalNotes: 'Remember to follow up with supplier',
  personalHighlight: '#fef3c7'
}
```

---

## ✅ **Validation & Enforcement**

### **Designer-Level Validation (Hard Blocking)**

```typescript
class LayoutValidator {
  validate(layout: VoucherLayoutV2): ValidationResult {
    const errors: string[] = [];
    
    // Rule 1: All CORE fields must be present
    const coreFields = this.getSystemCoreFields(layout.voucherType);
    for (const coreField of coreFields) {
      const field = layout.areas.body.fields.find(f => f.id === coreField.id);
      
      if (!field) {
        errors.push(`BLOCKED: CORE field "${coreField.label}" is missing`);
      }
      
      if (field && field.visible === false) {
        errors.push(`BLOCKED: CORE field "${coreField.label}" cannot be hidden`);
      }
      
      if (field && field.dataKey !== coreField.dataKey) {
        errors.push(`BLOCKED: CORE field "${coreField.label}" data key cannot change`);
      }
    }
    
    // Rule 2: SHARED fields cannot be removed
    // (Can be hidden, but must exist in config)
    
    // Rule 3: PERSONAL fields must be flagged correctly
    const personalFields = layout.areas.body.fields.filter(f => f.category === 'PERSONAL');
    for (const field of personalFields) {
      if (field.storedIn !== 'userPreferences') {
        errors.push(`BLOCKED: PERSONAL field "${field.label}" must use userPreferences storage`);
      }
      if (field.showInJournal !== false) {
        errors.push(`BLOCKED: PERSONAL field "${field.label}" cannot appear in journal`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      canSave: errors.length === 0
    };
  }
}
```

---

## 📁 **File Structure (New Designer)**

```
frontend/src/modules/accounting/
├── designer-v2/
│   ├── components/
│   │   ├── VoucherWizard.tsx              ← NEW (same UX as old)
│   │   ├── WizardStepper.tsx              ← Reuse from old
│   │   └── steps/
│   │       ├── StepSelectType.tsx         ← NEW (simplified)
│   │       ├── StepFieldSelection.tsx     ← NEW (category system)
│   │       ├── StepLayoutEditor.tsx       ← NEW (based on old StepLayout)
│   │       ├── StepValidation.tsx         ← NEW (auto-validation)
│   │       └── StepReview.tsx             ← NEW (similar to old)
│   │
│   ├── hooks/
│   │   ├── useVoucherDesigner.ts          ← NEW
│   │   └── useLayoutValidator.ts          ← NEW
│   │
│   ├── services/
│   │   ├── SystemFieldRegistry.ts         ← NEW (loads from Firestore)
│   │   ├── LayoutValidator.ts             ← NEW (validation logic)
│   │   └── UserLayoutRepository.ts        ← NEW (save/load user layouts)
│   │
│   └── pages/
│       └── VoucherDesignerPage.tsx        ← NEW
│
├── components/
│   └── voucher-form/
│       ├── DynamicVoucherForm.tsx         ← NEW (renders user layout)
│       └── VoucherFormFactory.tsx         ← NEW (loads layout + renders)
│
└── types/
    ├── FieldDefinitionV2.ts               ← NEW (extended)
    └── VoucherLayoutV2.ts                 ← NEW
```

---

## 🚀 **Implementation Steps**

### **Phase 5.1: Type System** (2 hours)
1. Create `FieldDefinitionV2.ts`
2. Create `VoucherLayoutV2.ts`
3. Create `SystemFieldRegistry.ts` (type)

### **Phase 5.2: System Field Registry** (2 hours)
1. Define CORE/SHARED fields for each voucher type
2. Store in Firestore system collection
3. Create service to load registry

### **Phase 5.3: Wizard Steps** (6 hours)
1. StepSelectType (1h)
2. StepFieldSelection with categories (2h)
3. StepLayoutEditor (preserve existing UX) (2h)
4. StepValidation + StepReview (1h)

### **Phase 5.4: Validation Logic** (2 hours)
1. Create LayoutValidator class
2. Add hard blocking to save button
3. Add tooltips/warnings in UI

### **Phase 5.5: Storage Layer** (2 hours)
1. UserLayoutRepository (save/load)
2. PersonalDataRepository
3. Integration with existing firestore

### **Phase 5.6: Dynamic Renderer** (3 hours)
1. VoucherFormFactory (loads user layout)
2. DynamicVoucherForm (renders based on layout)
3. Handles PERSONAL field injection

### **Phase 5.7: Testing & Polish** (2 hours)
1. Test all voucher types
2. Test category enforcement
3. Polish UX/UI

**TOTAL TIME: ~19 hours**

---

## ✅ **Success Criteria**

1. ✅ User can customize voucher layout
2. ✅ CORE fields cannot be removed/hidden
3. ✅ SHARED fields can be shown/hidden only
4. ✅ PERSONAL fields fully isolated
5. ✅ General Journal unchanged
6. ✅ Existing layout step UX preserved
7. ✅ Test Run works in both modes
8. ✅ Validation blocks invalid configs

---

## 🎯 **Next Action**

**Ready to start implementation?**

I'll begin with:
1. **Type system** (create new types)
2. **System field registry** (define CORE/SHARED for Payment/Receipt/Journal/Opening)
3. **Field selection step** (show categories with icons)

**Shall I proceed?** 🚀
