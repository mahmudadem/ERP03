# 🧪 Voucher Wizard - Testing Guide

## Quick Start (2 Minutes)

### Step 1: Navigate to Test Page
The wizard test page is now available at:

```
http://localhost:5173/accounting/wizard-test
```

Or navigate through the UI:
1. Open your app
2. Go to **Accounting** → **🧪 Wizard Test**

---

## What to Test

### ✅ Step 1: Basic Info
1. Click **"Create New Type"** button
2. Enter voucher details:
   - **Name**: "My Test Voucher"
   - **ID**: "test_voucher"
   - **Prefix**: "TV-"
3. Toggle **Multi-Line** on/off
4. Click **Next**

**Expected**: Form updates correctly, can proceed to next step

---

### ✅ Step 2: Rules
1. Toggle different rules on/off:
   - Require Approval
   - Prevent Negative Cash
   - Allow Future Dates
   - Mandatory Attachments
2. Notice the visual feedback (blue highlight when enabled)
3. Click **Next**

**Expected**: Rules toggle correctly, visual state updates

---

### ✅ Step 3: Fields Selection
1. Select/deselect general fields (click checkboxes)
2. If Multi-Line is enabled, select table columns
3. Try selecting/deselecting multiple fields
4. Click **Next**

**Expected**: 
- Fields highlight in blue when selected
- Auto-placement algorithm should run
- Layout will be generated for Step 5

---

### ✅ Step 4: Actions
1. Toggle action buttons (Print, Email, Download, etc.)
2. Notice which actions are enabled/disabled
3. Click **Next**

**Expected**: Actions toggle correctly

---

### ✅ Step 5: Visual Editor ⭐ (MOST IMPORTANT)

This is the core feature - test thoroughly!

#### Layout Mode Toggle
1. Click **Classic** / **Windows** toggle
2. Notice layout changes between modes

#### Drag & Drop
1. **Click and hold** on a field in the grid
2. **Drag** it to a new position
3. **Release** to drop
4. Field should move to new grid position

#### Resize Fields
1. **Hover** over a field
2. Notice the **resize handle** on the right edge
3. **Click and drag** the resize handle left/right
4. Field width should change (shows column span)

#### Properties Panel
1. **Click on any field** in the grid
2. Properties panel on right should update
3. Try changing:
   - **Custom Label**: Type a new label
   - **Width**: Use slider (1-12 columns)
   - **Move to Section**: Use dropdown to move field

#### Section Reordering
1. Click the **up/down arrows** on section headers
2. Sections should reorder

**Expected**:
- ✅ Drag-and-drop works smoothly
- ✅ Resize handles appear on hover
- ✅ Resizing works in real-time
- ✅ Properties panel updates when field selected
- ✅ Can change labels, width, section
- ✅ Layout persists between Classic/Windows modes

---

### ✅ Step 6: Review
1. Review the summary
2. Click **"Save & Close"**

**Expected**:
- Alert popup shows summary
- Console logs full `VoucherTypeConfig` object
- Wizard closes
- Returns to list view

---

## 🔍 Verification Checklist

Open browser console (F12) and check:

| Check | What to Look For | Status |
|-------|------------------|--------|
| **No Errors** | Console should be clean | ⬜ |
| **Output Object** | `VoucherTypeConfig` logged to console | ⬜ |
| **Has All Fields** | `id`, `name`, `prefix`, `rules`, `actions`, `uiModeOverrides` | ⬜ |
| **Layout Data** | `uiModeOverrides.windows.sections` has field positions | ⬜ |
| **No Schema Props** | No `schemaVersion`, `isPosting`, `Canonical*` | ⬜ |

---

## 📊 Expected Console Output

After clicking "Save & Close", you should see:

```javascript
✅ Wizard completed! Output: {
  id: "test_voucher",
  name: "My Test Voucher",
  prefix: "TV-",
  startNumber: 1000,
  isMultiLine: true,
  
  rules: [
    { id: "require_approval", label: "...", enabled: true },
    // ... other rules
  ],
  
  actions: [
    { type: "print", label: "...", enabled: true },
    // ... other actions
  ],
  
  tableColumns: ["account", "debit", "credit", "notes"],
  
  uiModeOverrides: {
    classic: {
      sections: {
        HEADER: { order: 0, fields: [...] },
        BODY: { order: 1, fields: [...] },
        EXTRA: { order: 2, fields: [...] },
        ACTIONS: { order: 3, fields: [...] }
      }
    },
    windows: {
      sections: {
        HEADER: { order: 0, fields: [
          { fieldId: "voucherNo", row: 0, col: 0, colSpan: 3 },
          { fieldId: "status", row: 0, col: 3, colSpan: 3 },
          // ... more fields with grid positions
        ]},
        // ... other sections
      }
    }
  }
}
```

---

## ✅ Success Criteria

Your test is successful if:

1. ✅ All 6 steps load without errors
2. ✅ Can navigate forward/back between steps
3. ✅ Drag-and-drop works in Step 5
4. ✅ Resize handles work in Step 5
5. ✅ Properties panel updates in Step 5
6. ✅ Console shows clean `VoucherTypeConfig` output
7. ✅ No `schemaVersion` or accounting fields in output
8. ✅ Wizard closes and returns to list

---

## 🐛 Known Issues / What to Watch For

### Expected Behavior (Not Bugs):
- **Auto-placement**: After Step 3, fields auto-arrange in Step 5 - this is by design
- **localStorage**: Wizards are saved to localStorage temporarily - this is expected (not DB)
- **No validation**: The wizard doesn't validate accounting rules - this is correct (validation happens later)

### Potential Issues:
- **Lucide icons not loading**: Check if `lucide-react` is installed
- **TypeScript errors**: Check imports in test page
- **Wizard not opening**: Check console for component load errors

---

## 🎯 What This Test Proves

If all tests pass, you've verified:

✅ **UI Extraction Successful** - Wizard works as standalone component  
✅ **Zero Coupling** - No dependencies on accounting/schema logic  
✅ **UX Preserved** - All 6 steps work exactly as original  
✅ **Output Clean** - Pure UI data, ready for transformation  
✅ **Integration Ready** - Can be wired into real pages  

---

## 🚀 Next Steps After Testing

Once testing is successful:

1. **Create UI → Schema Mapper** (transforms `VoucherTypeConfig` → canonical schema)
2. **Integrate into AIDesignerPage** (replace old designer)
3. **Wire up persistence** (save to Firestore)
4. **Add validation** (accounting rules)

---

## 📞 Troubleshooting

### Issue: Page shows 404
**Solution**: Make sure dev server restarted after adding route

### Issue: Import errors
**Solution**: Check that wizard module exports are correct:
```typescript
// Should work:
import { VoucherTypeManager, WizardProvider } from '../voucher-wizard';
```

### Issue: Wizard doesn't open
**Solution**: Check browser console for lazy-loading errors

### Issue: Drag-and-drop doesn't work
**Solution**: This is a critical feature - check for React 18+ and proper event handlers

---

## ✅ Test Completion

After completing all tests above, you can confirm:

**The Voucher Wizard extraction is VERIFIED and WORKING! 🎉**

---

**Happy Testing! 🧪**
