# 🔍 WINDOWS MODE - DIAGNOSTIC GUIDE

## 🎯 **WHAT WAS FIXED:**

1. **Changed from `useCompanySettings` to `useUserPreferences`**
   - Better fallback logic
   - Reads from localStorage if DB not loaded
   - Default is now 'windows'

2. **Added Comprehensive Logging**
   - See exactly what mode is active
   - See when Windows vs Classic path is taken
   - Debug why 404 might happen

---

## 🧪 **STEP-BY-STEP TESTING:**

### **Step 1: Open Browser Console**
Press `F12` to open DevTools

### **Step 2: Refresh Page**
After refresh, you should see in console:
```
🔍 VouchersListPage DEBUG: {
  voucherTypes: [...],
  uiMode: "windows",  // ← Should be "windows"
  isWindowsMode: true  // ← Should be true
}
```

### **Step 3: Click "+ New Invoice"**
You should see in console:
```
🎯 handleCreate called: {
  selectedType: "invoice",
  currentVoucherType: "Invoice",
  uiMode: "windows",
  isWindowsMode: true
}
🪟 Opening in Windows Mode (MDI)
```

### **Step 4: Check What Happens**

#### **If Windows Mode Working:**
- ✅ Console shows: "🪟 Opening in Windows Mode (MDI)"
- ✅ Floating window appears
- ✅ NO navigation (no 404)
- ✅ Taskbar appears at bottom

#### **If Classic Mode (Unexpected):**
- ❌ Console shows: "📄 Navigating in Classic Mode"
- ❌ Browser navigates
- ❌ Gets 404 error
- ❌ URL changes to `/accounting/vouchers/new?type=invoice`

---

## 🔧 **POSSIBLE ISSUES & FIXES:**

### **Issue 1: uiMode is 'classic' (not 'windows')**

**Check console:**
```
uiMode: "classic"  // ← Problem!
```

**Fix:**
1. Click the mode toggle button in header
2. Or manually set in localStorage:
   ```javascript
   localStorage.setItem('erp_ui_mode', 'windows');
   ```
3. Refresh page

---

### **Issue 2: isWindowsMode is false (even though uiMode is 'windows')**

**Check console:**
```
uiMode: "windows"
isWindowsMode: false  // ← Problem!
```

**This shouldn't happen** - if it does, the comparison is failing.

**Fix:**
Check if there's a string case issue. In console run:
```javascript
localStorage.getItem('erp_ui_mode')
```

Should return exactly: `"windows"` (not `"Windows"` or `"WINDOWS"`)

---

### **Issue 3: Still navigating in Windows mode**

**Check console for:**
```
🎯 handleCreate called: { ... }
```

If you DON'T see this, the handleCreate function isn't being called at all!

**Possible causes:**
- Button is disabled
- Permission check failing
- Click handler not attached

---

### **Issue 4: Window opens but nothing renders**

**Check for errors in console:**
- Red error messages
- "Cannot read property..."
- Import errors

**Possible causes:**
- Missing component files
- Import path errors
- TypeScript errors

---

## 🎛️ **FORCING WINDOWS MODE (For Testing):**

If you want to bypass all the uiMode logic temporarily:

In `VouchersListPage.tsx`, change line ~36:

```typescript
// TEMPORARILY REPLACE:
const isWindowsMode = uiMode === 'windows';

// WITH:
const isWindowsMode = true; // FORCE Windows mode for testing
```

Then refresh and test. This will ALWAYS use Windows mode.

---

## 📊 **CURRENT CODE FLOW:**

```
User clicks "+ New Invoice"
  ↓
handleCreate() called
  ↓
Log: 🎯 handleCreate called
  ↓
Check: isWindowsMode?
  ├─ TRUE → console.log('🪟 Opening in Windows Mode')
  │         openWindow(currentVoucherType)
  │         → VoucherWindow renders
  │         → NO navigation
  │         → NO 404
  │
  └─ FALSE → console.log('📄 Navigating in Classic Mode')
            navigate('/accounting/vouchers/new')
            → Browser navigates
            → 404 error (route doesn't exist)
```

---

## ✅ **EXPECTED CONSOLE OUTPUT (Success):**

When you click "+ New Invoice" in Windows mode:

```
🎯 handleCreate called: {
  selectedType: "invoice",
  currentVoucherType: "Invoice",
  uiMode: "windows",
  isWindowsMode: true
}
🪟 Opening in Windows Mode (MDI)
```

Then you should SEE a window appear (no navigation).

---

## ❌ **BAD CONSOLE OUTPUT (Problem):**

If you see this:

```
🎯 handleCreate called: {
  selectedType: "invoice",
  currentVoucherType: "Invoice",
  uiMode: "classic",
  isWindowsMode: false
}
📄 Navigating in Classic Mode
```

This means uiMode is set to 'classic', not 'windows'.

---

## 🚀 **ACTION PLAN:**

1. **Refresh browser**
2. **Open console (F12)**
3. **Look for:** `🔍 VouchersListPage DEBUG`
4. **Check:** `uiMode` value
5. **If NOT "windows":** Click header toggle button
6. **Click "+ New Invoice"**
7. **Check console** for which path was taken
8. **Report back** what you see!

---

**Tell me what the console shows and I'll know exactly what's wrong!** 🔍
