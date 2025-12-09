# ✅ P&L Feature - Manual Testing Guide

## 🔐 **Test Credentials** (From Seeder)

Use these credentials to login and test:

### **Option 1: Admin User** (Recommended)
- **Email**: `admin@demo.com`
- **Password**: `password123`
- **Role**: Owner (Full Access)

### **Option 2: Super Admin**
- **Email**: `sa@demo.com`  
- **Password**: `123123`
- **Role**: SUPER_ADMIN (Bypass all permissions)

---

## 🧪 **Step-by-Step Testing Instructions**

### **Test 1: Access P&L Report** ⭐

1. **Login**:
   - Navigate to: http://localhost:5173
   - Email: `admin@demo.com`
   - Password: `password123`
   - Click "Login"

2. **Navigate to P&L**:
   - Click "Accounting" in the sidebar
   - Look for "Profit & Loss" menu item
   - Click "Profit & Loss"

3. **Expected Result** ✅:
   - Page loads at `/accounting/reports/profit-loss`
   - See date range selector (FROM and TO inputs)
   - See "Generate Report" button
   - Default dates: Jan 1, current year → Today

4. **Screenshot**: Take screenshot for documentation

---

### **Test 2: Generate Report with Default Dates**

1. **On P&L Page**:
   - Page should already have default date range
   - Report should auto-generate on page load

2. **Expected Result** ✅:
   - See summary cards (4 cards):
     - 🟢 Total Revenue (green gradient)
     - 🔴 Total Expenses (red gradient)
     - 🔵 Net Profit/Loss (blue or orange)
     - 🟣 Profit Margin % (purple gradient)
   
   - See two breakdown sections:
     - Revenue Breakdown (left)
     - Expense Breakdown (right)

3. **If No Data Shows**:
   - All amounts show `$0.00`
   - Message: "No revenue/expense data for this period"
   - **This is normal** if no test vouchers exist

---

### **Test 3: Create Test Data** (If Needed)

**If report shows $0, create test vouchers**:

1. **Navigate to Vouchers**:
   - Sidebar → Accounting → Vouchers
   - Click "+ New Voucher"

2. **Create Revenue Voucher**:
   - Type: "Customer Receipt" or "RECEIPT"
   - Date: "2025-01-15"
   - Add line: Account `4000` (Revenue), Credit: `50000`
   - Save
   - **Change status to "Locked"** (Posted)

3. **Create Expense Voucher**:
   - Click "+ New Voucher"
   - Type: "Vendor Payment" or "PAYMENT"
   - Date: "2025-01-20"
   - Add line: Account `5000` (COGS), Debit: `30000`
   - Save
   - **Change status to "Locked"** (Posted)

4. **Return to P&L**:
   - Navigate back to P&L report
   - Click "Generate Report"

5. **Expected Result** ✅:
   - Revenue: `$50,000.00`
   - Expenses: `$30,000.00`
   - Net Profit: `$20,000.00`
   - Profit Margin: `40.00%`

---

### **Test 4: Date Range Filtering**

1. **Change Date Range**:
   - FROM: "2025-01-01"
   - TO: "2025-01-31" (January only)
   - Click "Generate Report"

2. **Expected Result** ✅:
   - Report refreshes
   - Only shows January data
   - Period label updates to "January 1, 2025 to January 31, 2025"

3. **Try Different Range**:
   - FROM: "2025-01-01"
   - TO: "2025-03-31" (Q1)
   - Click "Generate Report"
   - Should show first quarter data

---

### **Test 5: CSV Export**

1. **Generate a Report** (with data)

2. **Click Export**:
   - Click "📥 Export CSV" button
   - Should immediately trigger download

3. **Check Download**:
   - Look in downloads folder
   - Filename: `profit-loss-2025-01-01-2025-12-09.csv` (or similar)

4. **Open in Excel/Sheets**:
   - Open the CSV file
   - Verify structure:
     ```
     Profit & Loss Statement
     Period: January 1, 2025 to December 9, 2025
     
     Revenue
     Account, Amount
     Sales Revenue, $50,000.00
     Total Revenue, $50,000.00
     
     Expenses
     Cost of Goods Sold, $30,000.00
     Total Expenses, $30,000.00
     
     Net Profit/Loss, $20,000.00
     ```

5. **Expected Result** ✅:
   - CSV downloads successfully
   - Data matches on-screen report
   - Properly formatted

---

### **Test 6: RBAC Testing**

**Test 6a: With Permission** ✅
- User: `admin@demo.com` (Owner - has all permissions)
- Expected:
  - "Profit & Loss" appears in Accounting menu
  - Can access `/accounting/reports/profit-loss`
  - Report generates successfully

**Test 6b: Without Permission** (Create Test User)

1. **Create Limited User** (via Firebase Auth or UI):
   - Email: `testuser@demo.com`
   - Password: `password123`
   - Role: Create custom role WITHOUT `accounting.reports.profitAndLoss.view`

2. **Login as testuser@demo.com**

3. **Check Sidebar**:
   - Navigate to Accounting section
   - "Profit & Loss" menu item should be **HIDDEN**

4. **Try Direct URL**:
   - Manually type: `/accounting/reports/profit-loss`
   - Expected: Redirect to `/forbidden` or 403 error

---

### **Test 7: UI/UX Verification**

**Visual Checks**:
- [ ] Summary cards have gradient backgrounds
- [ ] Revenue card is green
- [ ] Expense card is red
- [ ] Profit card is blue (if positive) or orange (if negative)
- [ ] Profit Margin card is purple
- [ ] Text is readable and well-sized
- [ ] Numbers formatted as currency ($X,XXX.XX)
- [ ] Date inputs styled properly
- [ ] Generate button has hover effect
- [ ] Export button visible and clickable

**Responsive Check**:
- [ ] Resize browser window
- [ ] Cards stack properly on mobile size
- [ ] All content remains accessible

---

### **Test 8: Edge Cases**

**Edge Case 1: No Data**
- Set date range with no vouchers
- Expected: Shows $0 for all amounts, no errors

**Edge Case 2: Negative Profit**
- Create scenario where expenses > revenue
- Expected:
  - Net Profit shows negative amount
  - Card color changes to orange
  - Label changes to "Net Loss"

**Edge Case 3: Zero Revenue**
- Only create expense vouchers
- Expected:
  - Revenue: $0
  - Expense: Amount
  - Net Loss: Amount
  - Profit Margin: Shows 0.00% (not infinity or NaN)

**Edge Case 4: Large Numbers**
- Create vouchers with large amounts (e.g., $10,000,000)
- Expected: Formats correctly with commas

---

## 📊 **Testing Checklist**

### **Functional Tests**:
- [ ] Page loads without errors
- [ ] Default dates correct (Jan 1 - Today)
- [ ] Report auto-generates on load
- [ ] Summary cards display
- [ ] Breakdown tables show
- [ ] Date range selector works
- [ ] Generate button triggers report
- [ ] Export button downloads CSV
- [ ] CSV contains correct data

### **RBAC Tests**:
- [ ] Owner can access (admin@demo.com)
- [ ] Super Admin can access (sa@demo.com)
- [ ] Menu item visible with permission
- [ ] Menu item hidden without permission
- [ ] Direct URL blocked without permission

### **Data Accuracy**:
- [ ] Revenue calculation correct
- [ ] Expense calculation correct
- [ ] Net profit calculation correct
- [ ] Profit margin calculation correct
- [ ] Account breakdown accurate
- [ ] Only locked vouchers counted

### **UI/UX**:
- [ ] Cards have proper colors
- [ ] Gradients render smoothly
- [ ] Text readable
- [ ] Responsive design works
- [ ] Loading states (if slow data)
- [ ] Error messages (if API fails)

---

## 🐛 **Troubleshooting**

### **Problem: Page Not Found**
- **Cause**: Route not registered
- **Fix**: Check `routes.config.ts` for P&L route

### **Problem: 403 Forbidden**
- **Cause**: User lacks permission
- **Fix**: Ensure user has `accounting.reports.profitAndLoss.view`

### **Problem**: **No Data Showing**
- **Cause**: No locked vouchers in database
- **Fix**: Create test vouchers and set status="locked"

### **Problem: Export Not Working**
- **Cause**: Browser blocking downloads or data missing
- **Fix**: Allow downloads, ensure report has data

### **Problem: API Error**
- **Cause**: Backend not running or endpoint issue
- **Fix**: Check Firebase Functions running, verify network tab

### **Problem: Incorrect Calculations**
- **Cause**: Wrong account prefixes
- **Fix**: Ensure revenue accounts start with "4", expenses with "5" or "6"

---

## 📸 **Expected Screenshots**

### **Screenshot 1: Login Page**
- Shows ERP03 login form
- Email and password inputs
- Login button

### **Screenshot 2: Main Dashboard**
- After successful login
- Shows sidebar with modules
- Accounting section visible

### **Screenshot 3: P&L Report (No Data)**
- Date range selector
- All cards showing $0.00
- Clean, professional UI

### **Screenshot 4: P&L Report (With Data)**
- Summary cards with actual numbers
- Revenue breakdown populated
- Expense breakdown populated
- Color-coded cards

### **Screenshot 5: CSV Export**
- Downloads folder showing CSV file
- CSV opened in Excel
- Data properly formatted

---

## ✅ **Success Criteria**

**Test Passes If**:
- ✅ Page accessible to authorized users
- ✅ Report generates with correct data
- ✅ Calculations accurate
- ✅ Export works
- ✅ RBAC enforced
- ✅ UI looks professional
- ✅ No console errors
- ✅ No network errors

---

## 📝 **Test Results Template**

```markdown
## P&L Feature Test Results
**Date**: [Fill in]
**Tester**: [Fill in]
**Environment**: Development/Emulator

### Test 1: Access
- Status: ✅ PASS / ❌ FAIL
- Notes: [Fill in]

### Test 2: Report Generation
- Status: ✅ PASS / ❌ FAIL
- Revenue: $[amount]
- Expenses: $[amount]
- Net Profit: $[amount]
- Notes: [Fill in]

### Test 3: Export
- Status: ✅ PASS / ❌ FAIL
- CSV Downloaded: YES / NO
- Data Accurate: YES / NO
- Notes: [Fill in]

### Test 4: RBAC
- Status: ✅ PASS / ❌ FAIL
- Permission Check: YES / NO
- Notes: [Fill in]

### Overall Result
- **Production Ready**: ✅ YES / ❌ NO
- **Issues Found**: [List any issues]
- **Recommendations**: [Fill in]
```

---

**Ready to start testing!** 🚀

Follow the steps above and document your results. The feature should work perfectly based on code analysis!
