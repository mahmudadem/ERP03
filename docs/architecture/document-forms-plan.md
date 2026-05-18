# Document Form Policy Engine — Design Plan

> **Status:** DRAFT — Pending Review  
> **Scope:** Unified form configuration system for all ERP document types  
> **Phase:** Post-logic — after Purchase and Sales core logic is tested and stable

---

## 1. Problem Statement

The ERP has multiple document types across modules:
- **Accounting:** Vouchers (receipts, payments, journal entries)
- **Purchases:** PO, GRN, Purchase Invoice, Purchase Return
- **Sales:** SO, Delivery Note, Sales Invoice, Sales Return
- **Future:** POS tickets, credit notes, etc.

Each document type needs:
- Configurable **field layout** (which fields appear, where, in what order)
- **Default values** (pre-filled fields per company preferences)
- **Warning rules** (when to warn the user, e.g., selling below cost)
- **Enforcement rules** (forced behaviors, e.g., "always require cost center")
- **Posting behavior** (auto-post, auto-generate stock movements, etc.)
- **Two rendering modes**: classic (SPA page) and windows (MDI floating)
- A **designer UI** to configure all of the above per document type, per company

The current system solves this for accounting vouchers via `VoucherTypeDefinition` + `GenericVoucherRenderer`. We need to generalize this.

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────┐
│                 DESIGNER UI                       │
│  (Admin configures forms per document type)       │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌───────┐ │
│  │ Layout  │ │Defaults │ │ Warnings │ │ Rules │ │
│  │  Step   │ │  Step   │ │   Step   │ │ Step  │ │
│  └─────────┘ └─────────┘ └──────────┘ └───────┘ │
└──────────────────┬───────────────────────────────┘
                   │ saves
                   ▼
┌──────────────────────────────────────────────────┐
│          DocumentTypeDefinition                   │
│  (Persisted config per company × document type)   │
│                                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │  Fields  │ │  Layout  │ │ PolicyBehaviors  │ │
│  │  Schema  │ │  Config  │ │ (extensible bag) │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
└──────────────────┬───────────────────────────────┘
                   │ consumed by
                   ▼
┌──────────────────────────────────────────────────┐
│          GenericDocumentRenderer                  │
│  (Runtime form engine — renders ANY doc type)     │
│                                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ Classic  │ │ Windows  │ │ Policy Evaluator │ │
│  │  Mode    │ │   Mode   │ │ (runs warnings,  │ │
│  │ Wrapper  │ │ Wrapper  │ │  rules, defaults)│ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
└──────────────────────────────────────────────────┘
```

---

## 3. Core Design: `DocumentTypeDefinition`

This is the generalized version of `VoucherTypeDefinition`. It's the single persisted configuration object that drives everything.

```typescript
interface DocumentTypeDefinition {
  // ═══ IDENTITY ═══
  id: string;
  companyId: string;
  code: string;                      // e.g., 'PURCHASE_ORDER', 'SALES_INVOICE'
  name: string;                      // e.g., 'Purchase Order', 'فاتورة مبيعات'
  module: DocumentModule;            // 'PURCHASES' | 'SALES' | 'ACCOUNTING' | 'INVENTORY'
  documentCategory: DocumentCategory; // 'ORDER' | 'RECEIPT' | 'INVOICE' | 'RETURN' | 'VOUCHER'
  schemaVersion: number;             // Starts at 1

  // ═══ FIELD DEFINITIONS ═══
  headerFields: FieldDefinition[];   // Reuse existing FieldDefinition type
  lineFields: FieldDefinition[];     // Column definitions for line items table
  tableStyle?: 'web' | 'classic';

  // ═══ LAYOUT ═══
  layout: DocumentLayout;            // Section ordering, field positions, grid config

  // ═══ POLICY BEHAVIORS (the extensible bag) ═══
  policies: DocumentPolicies;

  // ═══ NUMBERING ═══
  prefix?: string;
  nextNumber?: number;

  // ═══ STATUS ═══
  enabled: boolean;
  isSystemDefault: boolean;          // System-provided defaults (can't delete, can customize)

  // ═══ GOVERNANCE ═══
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
}
```

---

## 4. The Extensible Policy Bag: `DocumentPolicies`

This is the key to future-proofing. Instead of adding flat boolean flags for every new behavior, we use a **categorized policy object** where each category is an open-ended key-value map.

```typescript
interface DocumentPolicies {
  // ═══ CATEGORY 1: DEFAULT VALUES ═══
  defaults?: {
    [fieldId: string]: {
      value: any;                    // The default value
      source?: 'FIXED' | 'FROM_VENDOR' | 'FROM_ITEM' | 'FROM_SETTINGS' | 'COMPUTED';
      sourceField?: string;          // e.g., 'vendor.paymentTermsDays'
    };
  };

  // ═══ CATEGORY 2: WARNINGS ═══
  warnings?: DocumentWarning[];

  // ═══ CATEGORY 3: ENFORCEMENT RULES ═══
  rules?: DocumentRule[];

  // ═══ CATEGORY 4: POSTING BEHAVIOR ═══
  posting?: PostingBehavior;

  // ═══ CATEGORY 5: VISIBILITY & CONDITIONAL LOGIC ═══
  visibility?: VisibilityRule[];

  // ═══ FUTURE CATEGORIES — add here without breaking anything ═══
  // approvals?: ApprovalWorkflow;
  // notifications?: NotificationConfig[];
  // integrations?: IntegrationConfig[];
  // permissions?: PermissionOverride[];
  [key: string]: any;               // Open-ended for future expansion
}
```

### 4.1 Warnings

```typescript
interface DocumentWarning {
  id: string;                        // Unique within this definition
  name: string;                      // Human-readable name for settings UI
  enabled: boolean;                  // Can be toggled per company
  severity: 'INFO' | 'WARNING' | 'BLOCK';  // INFO = toast, WARNING = confirm dialog, BLOCK = prevent action

  // ═══ CONDITION ═══
  trigger: WarningTrigger;
  
  // ═══ MESSAGE ═══
  messageKey: string;                // i18n key
  messageFallback: string;           // English fallback
}

interface WarningTrigger {
  type: 'FIELD_COMPARISON' | 'THRESHOLD' | 'CUSTOM';

  // For FIELD_COMPARISON:
  field?: string;                    // e.g., 'unitPriceDoc'
  operator?: '<' | '>' | '<=' | '>=' | '==' | '!=';
  compareToField?: string;           // e.g., 'item.avgCostBase'
  compareToValue?: number;

  // For THRESHOLD:
  expression?: string;              // e.g., 'lineTotal > 10000'

  // For CUSTOM:
  evaluatorId?: string;             // References a registered JS function
}
```

**Example warnings:**
```json
[
  {
    "id": "WARN_SELL_BELOW_COST",
    "name": "Selling below average cost",
    "enabled": true,
    "severity": "WARNING",
    "trigger": {
      "type": "FIELD_COMPARISON",
      "field": "unitPriceDoc",
      "operator": "<",
      "compareToField": "item.avgCostBase"
    },
    "messageKey": "warnings.sellBelowCost",
    "messageFallback": "Unit price is below average cost. Continue?"
  },
  {
    "id": "WARN_LARGE_QUANTITY",
    "name": "Large quantity warning",
    "enabled": true,
    "severity": "INFO",
    "trigger": {
      "type": "THRESHOLD",
      "expression": "orderedQty > 1000"
    },
    "messageKey": "warnings.largeQty",
    "messageFallback": "Quantity exceeds 1000 units."
  }
]
```

### 4.2 Enforcement Rules

```typescript
interface DocumentRule {
  id: string;
  name: string;
  enabled: boolean;

  // What the rule does
  effect: RuleEffect;
}

type RuleEffect =
  | { type: 'FORCE_FIELD_VALUE'; fieldId: string; value: any }
  | { type: 'REQUIRE_FIELD'; fieldId: string }
  | { type: 'HIDE_FIELD'; fieldId: string }
  | { type: 'MAKE_READONLY'; fieldId: string }
  | { type: 'FORCE_PAYMENT_METHOD'; method: string }
  | { type: 'REQUIRE_COST_CENTER' }
  | { type: 'CUSTOM'; evaluatorId: string; params?: Record<string, any> };
```

**Example rules:**
```json
[
  { "id": "RULE_FORCE_CASH", "name": "Always cash payment", "enabled": true,
    "effect": { "type": "FORCE_FIELD_VALUE", "fieldId": "paymentMethod", "value": "CASH" } },
  { "id": "RULE_COST_CENTER", "name": "Require cost center", "enabled": true,
    "effect": { "type": "REQUIRE_COST_CENTER" } },
  { "id": "RULE_HIDE_DISCOUNT", "name": "Hide discount field", "enabled": false,
    "effect": { "type": "HIDE_FIELD", "fieldId": "discountPct" } }
]
```

### 4.3 Posting Behavior

```typescript
interface PostingBehavior {
  autoPost: boolean;                     // Auto-post on save (skip DRAFT state)
  autoGenerateStockMovement: boolean;    // PI in SIMPLE mode → auto-create inventory
  autoGenerateGLVoucher: boolean;        // Auto-create accounting voucher on post
  postingVoucherTypeId?: string;         // Which voucher type to use for GL entries
  requireApprovalBeforePost: boolean;    // Require workflow approval
  allowBackdatedPosting: boolean;        // Allow posting to past periods
  lockAfterPosting: boolean;            // Make document immutable after post (default: true)
}
```

### 4.4 Visibility Rules

```typescript
interface VisibilityRule {
  id: string;
  targetFieldId: string;             // Field to show/hide
  condition: {
    whenField: string;               // Trigger field
    operator: '==' | '!=' | 'IN' | 'NOT_IN';
    value: any;
  };
  action: 'SHOW' | 'HIDE' | 'REQUIRE' | 'OPTIONAL';
}
```

**Example:** Show `warehouseId` only when `trackInventory === true`:
```json
{
  "id": "VIS_WAREHOUSE",
  "targetFieldId": "warehouseId",
  "condition": { "whenField": "trackInventory", "operator": "==", "value": true },
  "action": "SHOW"
}
```

---

## 5. Policy Evaluator (Runtime Engine)

The `PolicyEvaluator` is a pure function that runs at form-time. It takes the current form state + the `DocumentPolicies` config and returns computed effects.

```typescript
interface PolicyEvaluationResult {
  // Which fields should be hidden
  hiddenFields: Set<string>;
  // Which fields are required (beyond schema defaults)
  requiredFields: Set<string>;
  // Which fields are read-only
  readOnlyFields: Set<string>;
  // Default values to apply
  defaultValues: Record<string, any>;
  // Active warnings to show
  activeWarnings: DocumentWarning[];
  // Forced field values
  forcedValues: Record<string, any>;
}

function evaluatePolicies(
  policies: DocumentPolicies,
  formState: Record<string, any>,
  context: {
    mode: 'SIMPLE' | 'CONTROLLED';
    itemData?: any;
    vendorData?: any;
    settings?: any;
  }
): PolicyEvaluationResult;
```

**How the renderer uses it:**
```
On every form state change:
  1. Run evaluatePolicies(definition.policies, formState, context)
  2. Apply hiddenFields → hide those fields
  3. Apply requiredFields → add required validation
  4. Apply forcedValues → override field values
  5. Check activeWarnings → show toasts or confirmation dialogs
  6. On "Post" button → check if any BLOCK-severity warnings are active → prevent
```

---

## 6. Custom Evaluator Registry

For warnings/rules that can't be expressed as simple field comparisons, we register custom evaluator functions:

```typescript
// Registry — populated at app startup
const customEvaluators: Map<string, CustomEvaluator> = new Map();

interface CustomEvaluator {
  id: string;
  evaluate: (formState: any, context: any) => boolean;
  description: string;  // For the designer UI
}

// Example registration:
customEvaluators.set('CHECK_VENDOR_CREDIT_LIMIT', {
  id: 'CHECK_VENDOR_CREDIT_LIMIT',
  evaluate: (formState, ctx) => {
    const vendor = ctx.vendorData;
    return formState.grandTotalDoc > (vendor?.creditLimit ?? Infinity);
  },
  description: 'Warns when document total exceeds vendor credit limit',
});
```

This means:
- **Simple rules** (field comparisons, thresholds) are config-driven — no code needed.
- **Complex rules** (credit limits, margin calculations, multi-field logic) are code-driven but pluggable.

---

## 7. How This Relates to Existing Voucher System

> **CODEBASE AUDIT:** The `designer-engine/components/` folder (`DynamicFormRenderer`, `DynamicFieldRenderer`, etc.) is **unused scaffolding** — never imported by any page. The **real** production engine is `GenericVoucherRenderer` (2,983 lines) in `modules/accounting/components/shared/`.

| Existing (Accounting — in production) | Generalized (All Modules — new) |
|---------------------------------------|----------------------------------|
| `VoucherTypeDefinition` | `DocumentTypeDefinition` (superset) |
| `GenericVoucherRenderer` (2,983 lines) | `GenericDocumentRenderer` (modeled after GVR) |
| `VoucherDesigner` (307 lines) | `DocumentDesigner` (rewritten with policy tabs) |
| `VoucherWindow` (1,498 lines) | `DocumentWindow` (generalized MDI wrapper) |
| `FieldDefinition` ✅ reused | Imported from `designer-engine/types/` |
| `PostingRole` ✅ reused | Imported from `designer-engine/types/` |

### Migration Path
1. Existing `VoucherTypeDefinition` records are **forward-compatible** — they already have `rules`, `actions`, `metadata` fields. They can be progressively enriched with `DocumentPolicies`.
2. `GenericVoucherRenderer` is NOT replaced — it becomes the accounting-specific renderer. The new `GenericDocumentRenderer` handles purchases/sales documents.
3. Eventually, both renderers can share a common base (`GenericFormEngine`) with module-specific extensions.

---

## 8. Designer UI — Wizard Steps

The Document Designer will be a step-wizard (like `VoucherDesigner`) with these tabs:

| Step | Purpose | What the admin configures |
|------|---------|--------------------------|
| **1. Basic Info** | Identity | Name, code, module, category, prefix, numbering |
| **2. Fields** | Schema | Header field definitions, line column definitions, field types, required/optional |
| **3. Layout** | Positioning | Drag-and-drop field arrangement, section ordering, grid spans |
| **4. Defaults** | Pre-fill logic | Default values per field, value sources (fixed, from vendor, from item, from settings) |
| **5. Warnings** | Validation alerts | Warning rules with severity, trigger conditions, messages |
| **6. Rules** | Enforcement | Force value, require field, hide field, business constraints |
| **7. Posting** | Automation | Auto-post, auto-generate movements, approval requirement |
| **8. Review** | Confirmation | Summary of all config, save button |

---

## 9. Implementation Phases

### Phase A: Policy Engine Core (backend + shared types)
- Define `DocumentTypeDefinition`, `DocumentPolicies`, all sub-types
- Implement `PolicyEvaluator` (pure function)
- Implement `CustomEvaluator` registry
- Backend: `IDocumentTypeDefinitionRepository` + Firestore implementation
- Backend: CRUD use cases for document type definitions

### Phase B: Generic Document Renderer (frontend)
- Build `GenericDocumentRenderer` as a new form engine
- Integrates with `PolicyEvaluator` for runtime effects
- Supports both classic and windows modes
- Handles: header fields, line items table, totals section, action buttons

### Phase C: Document Designer UI (frontend)
- Build `DocumentDesigner` wizard (8 steps)
- Admin page to manage document type definitions per company
- Default definitions shipped as system defaults

### Phase D: Migrate Purchase Forms
- Convert hardcoded PO/GRN/PI/PR pages to use `GenericDocumentRenderer`
- Create default `DocumentTypeDefinition` configs for each purchase doc type

### Phase E: Windows Mode Integration
- Extend `UIWindowType` to support document windows
- Build `DocumentWindow` wrapper (generalized `VoucherWindow`)
- Extend `WindowManagerContext` + `WindowsDesktop` + `VoucherTaskbar`

### Phase F: Migrate Sales Forms (when Sales is built)
- Same as Phase D but for SO/DN/SI/SR

---

## 10. Key Design Principles

1. **Config over code** — Simple behaviors (defaults, visibility, field requirements) are pure configuration. No code changes needed to add a new warning or rule.

2. **Open-ended policy bag** — `DocumentPolicies` uses `[key: string]: any` at the top level, so new policy categories can be added without schema migrations.

3. **Graduated complexity** — Simple field comparisons are config-driven. Complex business logic uses registered evaluator functions. Both work through the same `PolicyEvaluator` pipeline.

4. **Backward compatible** — Existing `VoucherTypeDefinition` records are not broken. They're a subset of the new schema.

5. **Module-independent** — The engine doesn't know about purchases vs sales. It renders whatever `DocumentTypeDefinition` tells it to render. Module-specific logic lives in the use cases, not the form engine.
