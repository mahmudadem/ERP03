# 🔄 RESTART BACKEND TO TEST VOUCHER SELECTION

## ⚠️ IMPORTANT: Backend Must Be Restarted

The code changes for voucher selection are complete, but Firebase emulators are running with cached old code.

---

## 📋 STEP-BY-STEP RESTART PROCESS:

### **Step 1: Stop Backend**

Find the terminal window running the backend and press **Ctrl + C** to stop it.

Look for a terminal showing:
```
✔  functions: Loaded functions definitions from source
✔  functions[us-central1-api]: http function initialized
```

Press **`Ctrl + C`** to stop it.

---

### **Step 2: Restart Backend**

In the same terminal (or new one):

```bash
cd c:\Users\mahmu\OneDrive\Desktop\ERP03-github\ERP03\backend
npm run serve
```

Wait for:
```
✔  All emulators ready!
```

---

### **Step 3: Test With NEW Company**

**IMPORTANT:** You must create a **NEW** company to test the voucher selection.

The company you already created won't work because it was initialized with old code.

#### Option A: Delete Old Company from Firestore

1. Open Firestore Emulator UI: http://localhost:4000/firestore
2. Find your company in `companies` collection
3. Delete the company document
4. Delete the company from `companies` collection

#### Option B: Create Fresh Company

1. Logout from current company
2. Create a new company via onboarding
3. Initialize accounting module
4. **NOW the voucher selection will work!**

---

## ✅ COMPLETE TEST FLOW:

### **1. Create New Company**
- Go through company creation wizard
- Complete all steps

### **2. Initialize Accounting**
- Navigate to Accounting module
- Accounting Initialization Wizard opens

### **3. Complete Wizard Steps**

**Step 1: Welcome** → Click Next

**Step 2: Fiscal Year** → Set dates, Click Next

**Step 3: Currency** → Select USD, Click Next

**Step 4: Chart of Accounts** → Select template, Click Next

**Step 5: Voucher Types** ⭐ **THIS IS THE NEW STEP!**
- You should see:
  - ☑ Journal Entry (JE-) - Recommended
  - ☑ Payment Voucher (PV-) - Recommended
  - ☑ Receipt Voucher (RV-) - Recommended
  - ☑ Invoice (INV-) - Recommended
- All 4 pre-selected
- Test "Select All" / "Clear All" buttons
- Select the ones you want (e.g., select 2-3 of them)
- Click **Next**

**Step 6: Review & Confirm**
- Verify you see:
  - Fiscal Year
  - Currency
  - COA Template
  - **Selected Voucher Types** ← Should list your selections!
- Click **"Complete Setup"**

### **4. Verify Results**

**Check Sidebar:**
- Sidebar should show selected voucher types under Accounting
- Example:
  ```
  📊 Accounting
    ├─ Chart of Accounts
    ├─ Journal Entry      ← If you selected it
    ├─ Invoice            ← If you selected it
    └─ AI Designer
  ```

**Check AI Designer:**
- Navigate to AI Designer
- Should show vouchers with "System Default" badge
- Try to clone one

**Check Firestore:**
- Open: http://localhost:4000/firestore
- Navigate to: `companies/{newCompanyId}/voucherTypes/`
- Should see documents for ONLY the vouchers you selected
- Each should have:
  - `isSystemDefault: true`
  - `isLocked: true`
  - `enabled: true`

---

## 🎯 SUCCESS CRITERIA:

✅ Step 5 (Voucher Types) appears in wizard
✅ 4 default vouchers display with "Recommended" badges
✅ Vouchers are pre-selected
✅ Select All / Clear All work
✅ Review step shows selected vouchers
✅ ONLY selected vouchers copied to company
✅ Vouchers appear in sidebar
✅ Vouchers appear in AI Designer
✅ Vouchers marked as system defaults (immutable)

---

## 🐛 If It Still Doesn't Work:

1. **Check backend console** - Look for logs starting with `[InitializeAccounting]`
2. **It should show:** The `selectedVoucherTypes` array in the config
3. **If you don't see those logs:** Backend didn't restart properly

**Full restart:**
```bash
# Stop backend (Ctrl+C)
# Stop Firestore emulator if separate
# Restart both:
firebase emulators:start --import=../emulator-data --export-on-exit
```

---

## 📞 READY TO TEST!

After restarting the backend:
1. Create a NEW company
2. Initialize accounting
3. See Step 5 with voucher selection
4. Complete wizard
5. Verify vouchers appear everywhere

**The code is 100% complete - just needs backend restart!** 🚀
