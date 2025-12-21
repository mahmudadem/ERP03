# 🎨 VOUCHER ENTRY MODAL IMPLEMENTATION GUIDE

## ✅ **COMPLETED:**

1. ✅ Added `uiMode` field to `CompanySettings` interface
2. ✅ Created `VoucherEntryModal.tsx` component

---

## 📝 **REMAINING STEPS:**

### **Step 1: Create useCompanySettings Hook**

Create: `frontend/src/hooks/useCompanySettings.ts`

```typescript
import { useContext } from 'react';
import { CompanySettingsContext } from '../context/CompanySettingsContext';

export const useCompanySettings = () => {
  const context = useContext(CompanySettingsContext);
  if (!context) {
    throw new Error('useCompanySettings must be used within CompanySettingsProvider');
  }
  return context;
};
```

---

### **Step 2: Update VouchersListPage**

File: `frontend/src/modules/accounting/pages/VouchersListPage.tsx`

**Add imports:**
```typescript
import { VoucherEntryModal } from '../components/VoucherEntryModal';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
```

**Add state for modal:**
```typescript
const { settings } = useCompanySettings();
const [isModalOpen, setIsModalOpen] = React.useState(false);
```

**Update handleCreate function:**
```typescript
const handleCreate = () => {
  if (!selectedType) return;
  // REMOVE THIS LINE:
  // navigate(`/accounting/vouchers/new?type=${selectedType}`);
  
  // ADD THIS LINE:
  setIsModalOpen(true);
};
```

**Add save handler:**
```typescript
const handleSaveVoucher = async (voucherData: any) => {
  console.log('Saving voucher:', voucherData);
  // TODO: Call backend API to save voucher
  // await voucherApi.create(companyId, voucherData);
  
  // For now, just close modal and refresh list
  setIsModalOpen(false);
  // TODO: Refresh vouchers list
};
```

**Add modal before closing tag:**
```typescript
return (
  <div className="space-y-6 pb-20">
    {/* ... existing content ... */}
    
    {/* Voucher Entry Modal */}
    {currentVoucherType && (
      <VoucherEntryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        voucherType={currentVoucherType}
        uiMode={settings?.uiMode || 'windows'}
        onSave={handleSaveVoucher}
      />
    )}
  </div>
);
```

---

### **Step 3: Add UI Mode Toggle in Header** (Optional)

If you want users to switch modes from the header, add a toggle button in `AppShell.tsx` or header component:

```typescript
import { useCompanySettings } from '../hooks/useCompanySettings';

// In component:
const { settings, updateSettings } = useCompanySettings();

const toggleUIMode = async () => {
  const newMode = settings?.uiMode === 'windows' ? 'classic' : 'windows';
  await updateSettings({ uiMode: newMode });
};

// In JSX:
<button
  onClick={toggleUIMode}
  className="px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
>
  Mode: {settings?.uiMode || 'Windows'}
</button>
```

---

## 🎯 **ARCHITECTURE FLOW:**

```
User clicks "+ New Invoice"
   ↓
Opens VoucherEntryModal
   ↓
Modal reads system-wide uiMode from CompanySettings
   ↓
Passes uiMode to GenericVoucherRenderer
   ↓
Renderer shows form in Classic or Windows layout
   ↓
User fills in data
   ↓
User clicks "Save"
   ↓
handleSaveVoucher called with form data
   ↓
Save to backend API
   ↓
Modal closes, list refreshes
```

---

## 📊 **FILES CREATED/MODIFIED:**

### Created:
- ✅ `frontend/src/modules/accounting/components/VoucherEntryModal.tsx`
- 📝 `frontend/src/hooks/useCompanySettings.ts` (needs creation)

### Modified:
- ✅ `frontend/src/api/companyApi.ts` - Added uiMode field
- 📝 `frontend/src/modules/accounting/pages/VouchersListPage.tsx` - Add modal integration

---

## 🚀 **TESTING:**

1. Create `useCompanySettings` hook
2. Update `VouchersListPage` with changes above
3. Refresh browser
4. Click "+ New Invoice"
5. **Expected:**
   - Modal opens (doesn't navigate!)
   - Shows form in windows mode (or classic if uiMode is set)
   - Form layout matches what was designed in AI Designer
6. Fill in data and click Save
7. **Expected:**
   - Console logs the data
   - Modal closes

---

## 🔧 **NEXT: Backend API**

Once modal is working, you'll need to create the backend endpoint:

```typescript
POST /api/v1/accounting/vouchers
Body: {
  companyId: string,
  typeId: string,
  date: string,
  status: 'draft' | 'approved',
  lines: Array<{
    account: string,
    debit: number,
    credit: number,
    notes: string
  }>,
  // ... other fields from the form
}
```

---

## ✨ **WYSIWYG Achieved!**

Once complete:
- ✅ User designs voucher in AI Designer
- ✅ User creates transaction using same layout
- ✅ What they design = What they see = What they get!

**Status:** Ready for integration! 🎉
