# Module Configuration Guard - Integration Guide

## Overview
The Module Configuration Guard system prevents users from accessing unconfigured modules by showing a prompt modal with two options:
1. **Start Configuration Wizard** - Redirects to setup page
2. **Skip for Now** - Allows access anyway

## Components Created

### 1. `ModuleSetupPromptModal`
Located: `src/components/guards/ModuleSetupPromptModal.tsx`

A beautiful modal that shows:
- Module icon and name
- Clear description
- List of setup steps
- Two action buttons (Start Wizard / Skip)

### 2. `ModuleConfigurationGuard`
Located: `src/components/guards/ModuleConfigurationGuard.tsx`

A route guard wrapper that:
- Checks if module is initialized
- Shows prompt modal if not configured
- Remembers if user clicked "Skip"
- Renders child components when ready

---

## How to Use

### Step 1: Wrap Module Routes

In your main routing file (e.g., `App.tsx` or `routes.tsx`):

```tsx
import { ModuleConfigurationGuard } from './components/guards';

// Example for Accounting Module
<Route 
  path="/accounting/*" 
  element={
    <ModuleConfigurationGuard moduleCode="accounting">
      <AccountingModule />
    </ModuleConfigurationGuard>
  } 
/>

// Example for Inventory Module
<Route 
  path="/inventory/*" 
  element={
    <ModuleConfigurationGuard moduleCode="inventory">
      <InventoryModule />
    </ModuleConfigurationGuard>
  } 
/>

// Example for CRM Module
<Route 
  path="/crm/*" 
  element={
    <ModuleConfigurationGuard moduleCode="crm">
      <CRMModule />
    </ModuleConfigurationGuard>
  } 
/>
```

### Step 2: That's It! 🎉

The guard will automatically:
1. Check if the module is initialized
2. Show the prompt if not
3. Allow access if initialized or user skipped

---

## Supported Modules

The following modules are pre-configured with icons, descriptions, and setup steps:

- ✅ `accounting` - Accounting
- ✅ `inventory` - Inventory Management
- ✅ `hr` - Human Resources
- ✅ `pos` - Point of Sale
- ✅ `companyAdmin` - Company Administration
- ✅ `crm` - Customer Relationship Management
- ✅ `invoicing` - Invoicing

**Adding New Modules:**
Edit `ModuleSetupPromptModal.tsx` and add your module to the `moduleMap` object.

---

## User Flow Example

### Scenario: User clicks "Accounting" in sidebar

1. **Module Not Configured:**
   ```
   ┌─────────────────────────────────────────┐
   │  [📊]  Accounting Not Configured        │
   │                                         │
   │  Set up your accounting foundation to   │
   │  track finances, manage transactions... │
   │                                         │
   │  Quick Setup Includes:                  │
   │  ✓ Configure Chart of Accounts         │
   │  ✓ Set Fiscal Year                     │
   │  ✓ Select Default Currency             │
   │                                         │
   │  [Start Configuration Wizard]  [Skip]  │
   └─────────────────────────────────────────┘
   ```

2. **User Clicks "Start Configuration Wizard":**
   - Navigates to `/accounting/setup`
   - User completes setup wizard
   - Backend marks `accounting.initialized = true`
   - Future visits: Direct access, no prompt

3. **User Clicks "Skip for Now":**
   - Modal closes
   - User can access module
   - Prompt won't show again this session
   - Next login: Prompt appears again (until configured)

---

## Customization

### Change Button Text
Edit `ModuleSetupPromptModal.tsx`, line ~158:
```tsx
<button onClick={handleStartWizard}>
  Start Configuration Wizard  // ← Change this
</button>
```

### Add More Setup Steps
Edit the `moduleMap` in `ModuleSetupPromptModal.tsx`:
```tsx
accounting: {
  setupSteps: [
    'Configure Chart of Accounts',
    'Set Fiscal Year',
    'Select Default Currency',
    'Your new step here',  // ← Add steps
  ],
}
```

### Change Modal Appearance
Classes are in `ModuleSetupPromptModal.tsx`:
- Modal container: Line ~134
- Background overlay: Line ~131
- Buttons: Lines ~158-168

---

## Integration Checklist

- [ ] Import `ModuleConfigurationGuard` in routing file
- [ ] Wrap all module routes with the guard
- [ ] Test accessing an unconfigured module
- [ ] Verify "Start Wizard" redirects correctly
- [ ] Verify "Skip" allows access
- [ ] Check that configured modules bypass the prompt

---

## Notes

- **Session-based skip**: If user skips, they won't see the prompt again until they refresh/reload
- **Dashboard always accessible**: The guard only affects module-specific routes
- **No hardcoded blocks**: Users always have the option to skip
- **Professional UX**: Matches patterns used by Shopify, HubSpot, etc.

---

## Questions?

This guard system is designed to be:
- ✅ Simple to integrate
- ✅ User-friendly
- ✅ Customizable
- ✅ Professional

Happy coding! 🚀
