# AI Designer Page - Usage Guide

## Overview

The AI Designer page (`/accounting/ai-designer`) now follows the same pattern as the regular designer:

1. **List View** - Shows all voucher types stored in localStorage
2. **Create New** - Opens the AI designer wizard for creating new voucher types
3. **Edit Existing** - Click any voucher card to edit it

## Structure

```
/accounting/ai-designer
├── Shows list of voucher types
├── "Create New" button → Opens AI Designer Wizard
└── Click voucher card → Opens AI Designer Wizard with existing config
```

## Features

### List View
- ✅ Grid of voucher type cards
- ✅ Shows voucher name, ID, prefix
- ✅ Displays field count and multi-line indicator
- ✅ Active status badge
- ✅ Hover effects for better UX

### AI Designer Wizard
- ✅ 6-step wizard for voucher configuration
- ✅ Create new voucher types
- ✅ Edit existing voucher types
- ✅ Visual layout editor
- ✅ Test run preview

## Data Storage

Voucher types are stored in **localStorage** with key: `cloudERP_vouchers`

Default voucher types:
- Journal Voucher (JV-)
- Payment Voucher (PV-)
- Receipt Voucher (RV-)

## Integration Points

### VoucherProvider
Manages voucher state and localStorage persistence:
- `vouchers` - List of all voucher types
- `addVoucher(config)` - Add new voucher
- `updateVoucher(config)` - Update existing voucher
- `deleteVoucher(id)` - Delete voucher
- `getVoucher(id)` - Get voucher by ID

### LanguageProvider
Required for the renderer component (Test Run feature)

## Component Hierarchy

```tsx
AIDesignerPage
└── LanguageProvider
    └── VoucherProvider
        └── AIDesignerListContent
            ├── List View (default)
            └── VoucherDesigner (when wizard open)
```

## Usage Flow

1. User navigates to `/accounting/ai-designer`
2. Sees list of existing voucher types
3. Clicks "Create New" or clicks a voucher card
4. Modal opens with VoucherDesigner wizard
5. User configures voucher through 6 steps
6. Clicks "Save & Close" to save
7. Returns to list view with updated voucher list

## Code Example

```tsx
// Access from sidebar
Accounting → AI Designer

// Direct URL
http://localhost:5174/#/accounting/ai-designer
```

## Customization

To modify the list view:
- Edit `AIDesignerListContent` component
- Update card styling in the map function
- Add filters, search, or sorting as needed

To modify the wizard:
- The VoucherDesigner component is from `ai-designer/`
- Original code preserved - modify with caution
- See `ai-designer/components/VoucherDesigner.tsx`

## Backend Integration (Optional)

Currently uses localStorage. To integrate with backend:

1. Replace `VoucherProvider` localStorage logic
2. Add API calls in `handleSave`:
```tsx
const handleSave = async (config: VoucherTypeConfig) => {
  // POST to your API
  await api.post('/voucher-types', config);
  // Reload from API
  await loadVouchersFromApi();
};
```

3. Load vouchers from API on mount:
```tsx
useEffect(() => {
  loadVouchersFromApi();
}, []);
```

## Notes

- ✅ No database required - works with localStorage
- ✅ No additional dependencies needed
- ✅ Follows existing designer pattern
- ✅ Test Run functionality working
- ✅ Fully self-contained

---

**Status**: ✅ Complete and Functional  
**Last Updated**: December 17, 2025
