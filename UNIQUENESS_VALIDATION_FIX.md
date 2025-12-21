# 🔧 REAL-TIME UNIQUENESS VALIDATION FIX

## ❌ **Current Problem:**
When cloning a voucher, uniqueness validation runs ONLY at save time:
- No real-time feedback as user types
- No indication of which field is not unique (name/ID/prefix)
- User completes entire wizard only to get error at the end
- Poor UX!

## ✅ **Solution: Add Real-Time Validation**

The validation functions already exist in `uniquenessValidator.ts`:
- `validateUniqueness()` - Validates all fields
- `isFieldUnique()` - Validates single field

Need to integrate them into the wizard step where name/ID/prefix are edited.

---

## 📋 **Implementation Steps:**

### **Step 1: Add State for Validation Errors**

In `VoucherDesigner.tsx` (around line 120), add:

```typescript
const [validationErrors, setValidationErrors] = useState<{
  name?: string;
  id?: string;
  prefix?: string;
}>({});
const [isValidating, setIsValidating] = useState(false);
```

### **Step 2: Create Validation Function**

```typescript
const validateFieldAsync = useCallback(async (
  field: 'name' | 'id' | 'prefix',
  value: string
) => {
  if (!companyId || !value) return;
  
  setIsValidating(true);
  
  const isUnique = await isFieldUnique(
    companyId,
    field,
    value,
    initialConfig?.id // Exclude self when editing
  );
  
  setValidationErrors(prev => ({
    ...prev,
    [field]: isUnique ? undefined : `This ${field} is already in use`
  }));
  
  setIsValidating(false);
}, [companyId, initialConfig]);
```

### **Step 3: Debounced Validation on Input**

```typescript
import { debounce } from 'lodash'; // or implement simple debounce

const debouncedValidate = useMemo(
  () => debounce(validateFieldAsync, 500),
  [validateFieldAsync]
);
```

### **Step 4: Add to Input Fields**

Find the step that renders name/ID/prefix inputs (Step 2?) and add:

```tsx
{/* Name Field */}
<div>
  <label className="block text-sm font-semibold mb-2">Voucher Name *</label>
  <input
    type="text"
    value={config.name}
    onChange={(e) => {
      setConfig({...config, name: e.target.value});
      debouncedValidate('name', e.target.value);
    }}
    className={`w-full px-4 py-2 border rounded ${
      validationErrors.name ? 'border-red-500' : 'border-gray-300'
    }`}
  />
  {validationErrors.name && (
    <p className="text-red-600 text-sm mt-1">❌ {validationErrors.name}</p>
  )}
</div>

{/* ID Field */}
<div>
  <label className="block text-sm font-semibold mb-2">Voucher ID *</label>
  <input
    type="text"
    value={config.id}
    onChange={(e) => {
      setConfig({...config, id: e.target.value});
      debouncedValidate('id', e.target.value);
    }}
    className={`w-full px-4 py-2 border rounded ${
      validationErrors.id ? 'border-red-500' : 'border-gray-300'
    }`}
  />
 {validationErrors.id && (
    <p className="text-red-600 text-sm mt-1">❌ {validationErrors.id}</p>
  )}
</div>

{/* Prefix Field */}
<div>
  <label className="block text-sm font-semibold mb-2">Prefix *</label>
  <input
    type="text"
    value={config.prefix}
    onChange={(e) => {
      setConfig({...config, prefix: e.target.value});
      debouncedValidate('prefix', e.target.value);
    }}
    className={`w-full px-4 py-2 border rounded ${
      validationErrors.prefix ? 'border-red-500' : 'border-gray-300'
    }`}
  />
  {validationErrors.prefix && (
    <p className="text-red-600 text-sm mt-1">❌ {validationErrors.prefix}</p>
  )}
</div>
```

### **Step 5: Disable Next/Save if Validation Fails**

Update the Next button logic:

```tsx
const hasValidationErrors = Object.values(validationErrors).some(e => e !== undefined);

<button
  onClick={handleNext}
  disabled={hasValidationErrors || isValidating}
  className="..."
>
  {isValidating ? 'Validating...' : 'Next'}
</button>
```

---

## 🎯 **Expected Result:**

When cloning a voucher:
1. **Name field** shows error in real-time if already exists
2. **ID field** shows error if ID is taken
3. **Prefix field** shows error if prefix is used
4. **Next button disabled** until all unique
5. **Clear visual feedback** - red borders + error text
6. **No surprise errors** at the end

---

## 🛠️ **Alternative: Force Unique Values on Clone**

If you want to auto-fix uniqueness instead:

```typescript
const handleClone = (voucher: VoucherTypeConfig) => {
  const timestamp = Date.now();
  const cloned: VoucherTypeConfig = {
    ...voucher,
    id: `${voucher.id}_clone_${timestamp}`,
    name: `${voucher.name} (Copy ${timestamp})`, // Guaranteed unique
    prefix: `${voucher.prefix}C-`, // Add 'C' for clone
    isSystemDefault: false,
    isLocked: false,
  };
  setEditingVoucher(cloned);
  setIsCloning(true);
  setViewMode('designer');
};
```

This ensures cloned vouchers always start with unique values!

---

## 📝 **RECOMMENDATION:**

**Do BOTH:**
1. **Auto-fix on clone** - Give unique default values
2. **Real-time validation** - If user changes them, validate

This gives best UX - user can immediately save if they keep the defaults, OR customize with immediate feedback.

---

## ⚡ **Quick Fix (5 minutes):**

Just update `handleClone` to add more randomness:

```typescript
const timestamp = Date.now();
const random = Math.random().toString(36).substring(7);

const cloned: VoucherTypeConfig = {
  ...voucher,
  id: `${random}_${timestamp}`, // Truly unique ID
  name: `${voucher.name} - Copy ${random}`,
  prefix: `${voucher.prefix.replace('-', '')}C-`, // e.g., JE- becomes JEC-
  isSystemDefault: false,
  isLocked: false,
};
```

This makes clones start with guaranteed-unique values!

---

**Which approach do you prefer?**
1. Real-time validation (more work)
2. Auto-unique values on clone (quick fix)
3. Both (best UX)
