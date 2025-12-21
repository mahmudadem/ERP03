# Voucher Wizard Integration Guide

## 🎯 Purpose

This document explains how to integrate the extracted Voucher Wizard with the existing ERP03 application.

## 🔌 Integration Approach

### Option 1: Replace AI Designer (Recommended)

Replace the current AI designer in `AIDesignerPage.tsx` with the Voucher Wizard.

**Benefits:**
- Clean, single source of truth for voucher design
- Preserved UX from proven wizard
- Clear separation: UI wizard → Mapper → Persistence

**Steps:**
1. Update `AIDesignerPage.tsx` to import `VoucherTypeManager` from `voucher-wizard`
2. Create a mapper function to transform `VoucherTypeConfig` → `VoucherTypeDefinition`
3. Wire up `onVoucherSaved` callback to save canonical schema

### Option 2: Run Parallel (Transitional)

Keep both designers available during transition period.

**Benefits:**
- Gradual migration
- A/B testing
- Fallback option

**Steps:**
1. Add new route `/accounting/voucher-wizard`
2. Keep existing AI designer at current route
3. Migrate users gradually

## 📝 Sample Integration Code

### Full Replacement (Option 1)

```typescript
// AIDesignerPage.tsx
import React from 'react';
import { VoucherTypeManager, WizardProvider, VoucherTypeConfig } from '../voucher-wizard';
import { VoucherProvider, useVouchers } from '../ai-designer/VoucherContext';

const AIDesignerPage = () => {
  const { addDefinition, updateDefinition } = useVouchers();

  const handleVoucherSaved = (wizardConfig: VoucherTypeConfig) => {
    // TODO: Create mapper module
    // const canonicalDef = uiToCanonicalMapper(wizardConfig);
    
    // For now, basic transformation
    const canonicalDef: VoucherTypeDefinition = {
      id: wizardConfig.id,
      code: wizardConfig.id.toUpperCase(),
      name: wizardConfig.name,
      schemaVersion: 2,
      description: `Created via Voucher Wizard`,
      tableColumns: wizardConfig.tableColumns || [],
      // ... map other fields
    };

    addDefinition(canonicalDef);
  };

  return (
    <WizardProvider>
      <VoucherProvider>
        <VoucherTypeManager onVoucherSaved={handleVoucherSaved} />
      </VoucherProvider>
    </WizardProvider>
  );
};

export default AIDesignerPage;
```

### Parallel Routes (Option 2)

```typescript
// routes/accounting.tsx
{
  path: 'ai-designer',
  element: <AIDesignerPage />,  // Keep existing
},
{
  path: 'voucher-wizard',
  element: <VoucherWizardPage />,  // New wizard
}
```

## 🔄 UI to Canonical Mapper (Next Step)

Create a separate mapper module to transform wizard output to canonical schema:

```typescript
// mappers/uiToCanonicalMapper.ts

import { VoucherTypeConfig } from '../voucher-wizard';
import { VoucherTypeDefinition } from '../../../designer-engine';

export function mapWizardToCanonical(
  wizardConfig: VoucherTypeConfig
): VoucherTypeDefinition {
  return {
    // Basic Info
    id: wizardConfig.id,
    code: wizardConfig.id.toUpperCase(),
    name: wizardConfig.name,
    schemaVersion: 2,
    description: `Voucher created: ${wizardConfig.name}`,
    
    // Numbering
    prefix: wizardConfig.prefix,
    nextNumber: wizardConfig.startNumber,
    
    // Structure
    tableColumns: wizardConfig.isMultiLine 
      ? wizardConfig.tableColumns 
      : [],
    
    // Fields mapping
    fields: extractFieldsFromLayout(wizardConfig),
    
    // Behaviors (from rules)
    requiresApproval: wizardConfig.rules.find(r => r.id === 'require_approval')?.enabled || false,
    allowFutureDate: wizardConfig.rules.find(r => r.id === 'allow_future_date')?.enabled || true,
    
    // Layout
    layout: {
      classic: wizardConfig.uiModeOverrides.classic,
      windows: wizardConfig.uiModeOverrides.windows,
    },
    
    // Actions
    enabledActions: wizardConfig.actions
      .filter(a => a.enabled)
      .map(a => a.type),
  };
}

function extractFieldsFromLayout(config: VoucherTypeConfig) {
  // Extract unique field IDs from all sections
  const allFields = new Set<string>();
  
  Object.values(config.uiModeOverrides.windows.sections).forEach(section => {
    section.fields.forEach(field => {
      allFields.add(field.fieldId);
    });
  });
  
  return Array.from(allFields).map(fieldId => ({
    id: fieldId,
    label: fieldId,  // Will be overridden by labelOverride if exists
    type: 'text',    // Default, should be enhanced
  }));
}
```

## ⚠️ Important Notes

1. **No Schema Logic in Wizard**: The wizard must remain pure UI. All accounting logic, validation, and schema transformation happens in the mapper.

2. **Temporary Storage**: The wizard uses `localStorage` for temporary state only. Real persistence happens via the mapper callbacks.

3. **Schema Version**: The wizard is schema-agnostic. The mapper is responsible for producing Schema V2 canonical definitions.

4. **Validation**: Accounting validation (balanced debits/credits, account existence, etc.) happens AFTER mapping, not in the wizard.

## 🧪 Testing Integration

1. **Create a test voucher** using the wizard
2. **Verify the output** `VoucherTypeConfig` structure
3. **Run through mapper** to produce `VoucherTypeDefinition`
4. **Validate canonical schema** using existing validators
5. **Persist** using existing repository layer

## 🎯 Success Criteria

- ✅ Wizard opens and all 6 steps work
- ✅ Can create new voucher type
- ✅ Can edit existing voucher type
- ✅ `onSave` callback fires with correct data
- ✅ Mapper produces valid Schema V2 definition
- ✅ Voucher saves to database correctly
- ✅ No UI code in mapper, no accounting code in wizard

---

**Next Steps**: Choose integration option and implement mapper.
