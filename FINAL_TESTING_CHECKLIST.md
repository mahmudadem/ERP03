# 🧪 Final Testing Checklist

## Quick Test (5 minutes)

### 1. Open AIDesignerPage
```
http://localhost:5173/accounting/designer
```

### 2. Verify It Loads
- ✅ Page loads without errors
- ✅ Shows "Voucher Designer" header
- ✅ Shows "Create New Type" button
- ✅ List is empty initially (or shows existing vouchers)

### 3. Create New Voucher
**Click "Create New Type"**

#### Step 1: Template Selection
- ✅ See 5 template cards with prefix badges
- ✅ Templates: JE-, PV-, RV-, INV-, VCH-
- ✅ Click "Payment Voucher (PV-)"
- ✅ Card highlights in blue
- ✅ Green confirmation message appears
- ✅ "Next" button enabled

#### Step 2: Basic Info
- ✅ Name pre-filled: "Payment Voucher"
- ✅ ID pre-filled: "payment_voucher"
- ✅ Prefix pre-filled: "PV-"
- ✅ Multi-line toggle: ON
- ✅ Change name to "My Custom Payment"
- ✅ Click "Next"

#### Step 3: Rules
- ✅ See 4 rule toggles
- ✅ Toggle "Require Approval" ON
- ✅ Click "Next"

#### Step 4: Fields
- ✅ General Fields section
- ✅ Some fields pre-selected (from template)
- ✅ Select/deselect a few fields
- ✅ Table Columns section appears
- ✅ Click "Next"

#### Step 5: Actions
- ✅ See action buttons (Print, Email, etc.)
- ✅ Some pre-enabled (from template)
- ✅ Toggle a few on/off
- ✅ Click "Next"

#### Step 6: Visual Editor
- ✅ See grid layout with fields
- ✅ Fields pre-placed from template
- ✅ **Drag a field** to new position
- ✅ **Resize a field** by dragging right edge
- ✅ Click field → properties panel updates
- ✅ **Click "Test Run" button** 🔍

##### Test Run Modal
- ✅ Modal opens with preview
- ✅ Shows voucher form exactly as it will appear
- ✅ Can type in fields
- ✅ Line items table works (if multi-line)
- ✅ Action buttons visible
- ✅ Click X to close modal

- ✅ Click "Next"

#### Step 7: Review
- ✅ See summary with name and field count
- ✅ Green success icon
- ✅ "Save & Close" button visible

### 4. Save Voucher
- ✅ Click "Save & Close"
- ✅ Returns to list view
- ✅ New voucher appears in grid
- ✅ Shows name: "My Custom Payment"
- ✅ Shows prefix badge: "PV"

### 5. Edit Existing
- ✅ Hover over voucher card
- ✅ Edit/Delete buttons appear
- ✅ Click Edit button
- ✅ Wizard opens with existing config
- ✅ All steps show saved data
- ✅ Make a change
- ✅ Save
- ✅ Changes reflected in list

---

## Database Verification

### Open Firebase Console
1. Navigate to Firestore
2. Go to `companies/{yourCompanyId}/voucherTypes`
3. ✅ See your saved voucher document
4. ✅ Verify fields:
   - `id`: "payment_voucher"
   - `name`: "My Custom Payment"
   - `prefix`: "PV-"
   - `enabled`: true
   - `schemaVersion`: 2
   - `layout`: { classic, windows }
   - `requiresApproval`: true (if you toggled it)

---

## Expected Console Output

### On Load:
```
(No errors)
```

### On Save:
```
(No errors)
✅ Voucher saved successfully
```

### On Edit:
```
(No errors)
✅ Loaded existing voucher
```

---

## Common Issues & Fixes

### Issue: "Cannot find module '@/lib/firebase'"
**Fix**: Check if firebase.ts exists:
```
frontend/src/lib/firebase.ts
```

### Issue: Templates don't load
**Fix**: Templates are hardcoded in Step 1, should always show

### Issue: Save fails with uniqueness error
**Fix**: Working as intended - change name/ID/prefix

### Issue: "Failed to save voucher"
**Fix**: Check:
1. CompanyId is available
2. User is logged in
3. Firebase connection working

---

## What Should Work

### ✅ Full Flow:
1. Load page → See empty list
2. Create new → Template selection
3. Go through 7 steps
4. Test Run works
5. Save succeeds
6. Voucher appears in list
7. Edit works
8. Changes persist

### ✅ Validation:
1. Can't save duplicate name
2. Can't save duplicate ID
3. Can't save duplicate prefix
4. System defaults protected

### ✅ UX:
1. Drag-and-drop works
2. Resize works
3. Properties panel updates
4. Test Run shows correct layout
5. Templates pre-populate

---

## Performance Expectations

| Action | Time |
|--------|------|
| Load page | < 2s |
| Open wizard | Instant |
| Template select | Instant |
| Step navigation | Instant |
| Drag field | Smooth |
| Resize field | Smooth |
| Test Run | < 500ms |
| Save | < 2s |

---

## Browser Console Checks

### Should NOT see:
- ❌ TypeScript errors
- ❌ React errors
- ❌ 404 errors
- ❌ CORS errors
- ❌ Firestore permission errors

### Should see:
- ✅ Clean console (or only warnings)
- ✅ No red errors

---

## Final Verification

**If all these work, implementation is COMPLETE:**

- [x] Templates load and can be selected
- [x] Wizard goes through all 7 steps
- [x] Drag-and-drop works in Visual Editor
- [x] Resize works in Visual Editor
- [x] Test Run shows correct preview
- [x] Save creates document in Firestore
- [x] Edit loads existing voucher
- [x] List shows all vouchers
- [x] No TypeScript/console errors

---

**Ready to test! 🚀**

Navigate to: `http://localhost:5173/accounting/designer`
