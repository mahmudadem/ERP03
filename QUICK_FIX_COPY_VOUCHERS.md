## 🔧 QUICK FIX: Manually Copy Vouchers to Company

The backend initialization might not have copied the vouchers due to code caching in Firebase emulators.

### **Run this command to manually copy vouchers:**

```bash
cd backend
npx ts-node --transpile-only src/scripts/copyVouchersToCompany.ts YOUR_COMPANY_ID
```

### **How to find your Company ID:**

1. **Option A - Browser Console:**
   - Open browser console (F12)
   - Type: `localStorage.getItem('companyId')`
   - Copy the value (e.g., `cmp_abc123_xyz789`)

2. **Option B - Firestore Emulator UI:**
   - Open: http://localhost:4000/firestore
   - Navigate to `companies` collection
   - Find your company document
   - Copy the document ID

### **Example:**

```bash
# If your company ID is: cmp_newco_2024
npx ts-node --transpile-only src/scripts/copyVouchersToCompany.ts cmp_newco_2024
```

### **What this does:**

- Copies ALL 4 default voucher types to your company
- Marks them as `isSystemDefault: true`, `isLocked: true`, `enabled: true`
- They will immediately appear in sidebar and AI Designer

### **After running:**

1. Refresh the browser page
2. Check sidebar - vouchers should appear under Accounting
3. Navigate to AI Designer - vouchers should be listed

---

## 🔄 **For Future Companies (Permanent Fix):**

The backend needs to be restarted to pick up the new code:

```bash
# Stop Firebase emulators (Ctrl+C in terminal running emulators)
# Then restart:
cd backend
npm run serve
```

After restarting, new companies will automatically get selected vouchers during initialization.

---

## 📋 **Verify It Worked:**

1. **Check Firestore:** Navigate to `companies/{yourCompanyId}/voucherTypes/`
2. **Check Sidebar:** Vouchers should appear under Accounting section
3. **Check AI Designer:** Vouchers should be listed with "System Default" badge
