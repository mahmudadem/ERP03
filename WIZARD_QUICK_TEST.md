# 🚀 Quick Test - 30 Seconds

## Option 1: Direct URL (Fastest)

1. Make sure your dev server is running:
   ```
   cd frontend
   npm run dev
   ```

2. Open in browser:
   ```
   http://localhost:5173/accounting/wizard-test
   ```

3. Click **"Create New Type"**

4. Go through the 6 steps (just click Next for quick test)

5. In Step 5, try **dragging a field** and **resizing**

6. Click **"Save & Close"** and check the console

**Done! ✅** If you see the output in console, extraction successful!

---

## Option 2: Through UI Navigation

1. Open app: `http://localhost:5173`

2. Login (if needed)

3. Navigate: **Accounting** → **🧪 Wizard Test**

4. Click **"Create New Type"**

5. Test the wizard!

---

## What You Should See

### 1. Test Page Opens
![image](https://via.placeholder.com/800x400/3B82F6/FFFFFF?text=Voucher+Wizard+Test+Page)
- Blue header
- Yellow instructions banner
- "Create New Type" button

### 2. Wizard Modal Opens
![image](https://via.placeholder.com/800x400/6366F1/FFFFFF?text=6-Step+Wizard+UI)
- 6 step indicators at top
- Current step highlighted
- Back/Next navigation

### 3. Step 5: Visual Editor (The Cool Part!)
![image](https://via.placeholder.com/800x400/10B981/FFFFFF?text=Drag+%26+Drop+Grid+Editor)
- Grid with fields
- Can drag fields around
- Resize handles on hover
- Properties panel on right

### 4. Success!
![image](https://via.placeholder.com/800x400/22C55E/FFFFFF?text=Output+in+Console)
- Alert shows summary
- Console shows full `VoucherTypeConfig` object

---

## ✅ 3-Minute Full Test

1. **Step 1**: Enter "Test Voucher", toggle Multi-line ON
2. **Step 2**: Toggle 2-3 rules
3. **Step 3**: Select 5+ fields
4. **Step 4**: Enable Print + Email
5. **Step 5**: 
   - Drag a field to new position
   - Resize a field
   - Click field → change label in properties panel
6. **Step 6**: Click "Save & Close"

**Check console** - should see complete config object!

---

## 🐛 If Something Goes Wrong

### Wizard doesn't load?
```bash
# Restart dev server
npm run dev
```

### Import errors in console?
Check that files were created:
```
frontend/src/modules/accounting/voucher-wizard/
├── index.ts
├── types.ts
├── WizardContext.tsx
└── components/
    ├── VoucherDesigner.tsx
    └── VoucherTypeManager.tsx
```

### 404 error?
Make sure route was added to `routes.config.ts` at line 107

---

## 📹 What to Test (Priority Order)

### High Priority ⭐⭐⭐
- ✅ Wizard opens
- ✅ All 6 steps work
- ✅ **Drag-and-drop in Step 5** (CRITICAL)
- ✅ **Resize in Step 5** (CRITICAL)
- ✅ Console output is clean

### Medium Priority ⭐⭐
- Properties panel updates
- Section reordering
- Classic/Windows mode toggle
- Field selection works

### Low Priority ⭐
- Search bar (not wired yet)
- Edit/Delete (local only)
- Empty state display

---

## Expected Output (Console)

```javascript
{
  id: "test_voucher",
  name: "Test Voucher",
  prefix: "TV-",
  startNumber: 1000,
  isMultiLine: true,
  rules: Array(4),
  actions: Array(6),
  tableColumns: Array(4),
  uiModeOverrides: {
    classic: { sections: {...} },
    windows: { sections: {...} }
  }
}
```

**No `schemaVersion`, `isPosting`, or accounting fields!** ✅

---

## ✅ Success Indicators

You're good if you see:
- ✅ No console errors
- ✅ All 6 steps load
- ✅ Can drag fields
- ✅ Can resize fields
- ✅ Output object in console
- ✅ Alert shows summary

---

**That's it! Ready to test? Go to `http://localhost:5173/accounting/wizard-test` 🚀**
