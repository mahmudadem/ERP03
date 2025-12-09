# 🐛 P&L Troubleshooting Guide

## Issue: No Data Showing in Frontend

### ✅ What We Know Works:
1. ✅ Backend logic is correct (verified programmatically)
2. ✅ Test data exists in Firestore (8 vouchers confirmed)
3. ✅ Frontend page loads without errors
4. ✅ Backend builds successfully

### ⚠️ What's NOT Working:
- Frontend shows $0.00 even with 2025 dates
- No API request visible in Network tab

---

## 🔍 **Possible Causes & Solutions**

### **Cause 1: Authentication Missing**
**Symptom**: API calls blocked due to no auth token

**Check**:
1. Open browser console (F12)
2. Look for errors like "401 Unauthorized" or "403 Forbidden"
3. Check if auth token is being sent

**Solution**:
- Make sure you're logged in
- Check `AuthContext` is providing token
- Verify `setAuthTokenGetter` is called in App.tsx

### **Cause 2: Wrong API Base URL**
**Symptom**: API calls going to wrong address

**Check**:
```typescript
// In frontend/src/config/env.ts
console.log(env.apiBaseUrl); // Should be http://localhost:5001/...
```

**Solution**:
- Verify `.env.local` has correct `VITE_API_BASE_URL`
- Check Firebase Functions are running on port 5001

### **Cause 3: CORS Issues**
**Symptom**: Network request blocked by browser

**Check**:
- Console shows CORS error
- Network tab shows request but fails

**Solution**:
- Backend needs CORS headers configured
- Check `backend/src/index.ts` has CORS middleware

### **Cause 4: React Component Not Mounting**
**Symptom**: loadReport never called

**Check**:
- Add `console.log('Component mounted')` in useEffect
- Add `console.log('Calling API')` in loadReport

**Solution**:
- Verify component is rendering
- Check React dev tools

---

## 🧪 **Debugging Steps**

### **Step 1: Add Logging to Frontend**

Edit `ProfitAndLossPage.tsx`:

```typescript
const loadReport = async () => {
  console.log('🔍 loadReport called with dates:', fromDate, toDate);
  
  try {
    setLoading(true);
    setError(null);
    
    console.log('📡 Calling API...');
    const response = await accountingApi.getProfitAndLoss(fromDate, toDate);
    console.log('✅ API Response:', response);
    
    setData(response);
  } catch (err: any) {
    console.error('❌ API Error:', err);
    setError(err.message || 'Failed to load report');
  } finally {
    setLoading(false);
  }
};
```

### **Step 2: Check Browser Console**

Look for these logs:
- `🔍 loadReport called...`
- `📡 Calling API...`
- `✅ API Response...` OR `❌ API Error...`

If you see the error, it will tell you what's wrong!

---

### **Step 3: Check Network Tab**

1. Open DevTools (F12)
2. Click "Network" tab
3. Click "Generate Report"
4. Look for request to `/profit-loss`

**If NO request appears**:
- Frontend code isn't calling the API
- Add console.logs to trace execution

**If request appears but FAILS**:
- Check status code (401, 403, 500, etc.)
- Click on request to see error details

---

### **Step 4: Test API Directly**

In browser console, paste:

```javascript
fetch('/tenant/accounting/reports/profit-loss?from=2025-01-01&to=2025-12-31')
  .then(r => r.json())
  .then(d => console.log('Direct API test:', d))
  .catch(e => console.error('Direct API error:', e));
```

This bypasses React and tests the API directly.

---

## 🎯 **Most Likely Issues**

### **#1: Default Dates are 2024** (MOST LIKELY!)

**Problem**: Page loads with current year (2024), but data is in 2025

**Check**: Look at the date inputs on page load
- FROM should show `2025-01-01` not `2024-01-01`
- TO should show `2025-12-31` not current date

**Quick Fix**: Manually change dates to 2025 and click "Generate Report"

**Permanent Fix**: Update `ProfitAndLossPage.tsx` line 21:

```typescript
// OLD:
const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);

// NEW (hardcode 2025 for testing):
const [fromDate, setFromDate] = useState('2025-01-01');
const [toDate, setToDate] = useState('2025-12-31');
```

---

### **#2: Auth Token Missing**

**Problem**: API requires authentication but frontend isn't sending token

**Check**: In browser console, look for:
```
[API] no token available for request
```

**Fix**: Ensure you're logged in and AuthContext is set up

---

### **#3: Wrong Company ID**

**Problem**: API is querying with wrong companyId

**Check**: What company are you logged into?
- Must be: `demo_company_1764981773080`

**Fix**: Switch to correct company or login as admin@demo.com

---

## ✅ **Verification Checklist**

Before testing, verify:

- [ ] Logged in as: `admin@demo.com`
- [ ] Company ID shown in UI: `demo_company_1764981773080`
- [ ] Date FROM: `2025-01-01`
- [ ] Date TO: `2025-12-31`
- [ ] Firebase emulator running (port 5001)
- [ ] Frontend dev server running (port 5173)
- [ ] No errors in browser console
- [ ] Clicked "Generate Report" button

---

## 🚨 **Quick Diagnostics**

### **In Browser Console, Run**:

```javascript
// Check if accountingApi exists
console.log('API exists?', typeof window.accountingApi !== 'undefined');

// Check company access context
console.log('Current company:', localStorage.getItem('activeCompanyId'));

// Check if logged in
console.log('Auth token:', localStorage.getItem('authToken')?.substring(0, 20));

// Try direct API call
accountingApi.getProfitAndLoss('2025-01-01', '2025-12-31')
  .then(data => console.log('✅ Direct call worked:', data))
  .catch(err => console.error('❌ Direct call failed:', err));
```

---

## 📞 **Next Steps**

1. **Add console.logs** to `loadReport` function
2. **Open browser console** (F12)
3. **Set dates to 2025**
4. **Click "Generate Report"**
5. **Tell me what logs you see**

The logs will reveal exactly where the problem is!

---

**Expected Logs (if working)**:
```
🔍 loadReport called with dates: 2025-01-01 2025-12-31
📡 Calling API...
[API] attaching token eyJhbG...
✅ API Response: { revenue: 150000, expenses: 65000, ... }
```

**If you see different logs, share them with me!** 🐛
