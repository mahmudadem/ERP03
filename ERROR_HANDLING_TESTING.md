# Error Handling System - Testing Guide

## 🎯 System Overview

A complete error handling system with:
- **Backend**: Structured error codes, custom error classes, global middleware
- **Frontend**: Toast notifications, modal dialogs, i18n translations (EN/AR)
- **Integration**: Automatic error display from API responses

## ✅ What to Test

### 1. **Error Test Page** (Primary Testing)

**Access:** Navigate to `/error-test` in your app

**Tests Available:**
1. **Toast Error** - Shows red error toast with translated message
2. **Toast Warning** - Shows yellow warning toast
3. **Toast Success** - Shows green success toast
4. **Modal Error** - Shows critical error in modal dialog
5. **API Error** - Triggers real API call to non-existent endpoint

**Expected Results:**
- ✅ Toast appears in top-right corner
- ✅ Messages are in English (or Arabic if language switched)
- ✅ Toasts auto-dismiss after 3-5 seconds
- ✅ Modal requires user to click "OK"
- ✅ API error automatically shows toast with "Voucher not found" message

### 2. **Real-World Testing**

#### Test A: Form Not Found Error
1. Go to Vouchers List page
2. Open browser DevTools → Network tab
3. Try to load a non-existent form ID
4. **Expected:** Toast shows "Voucher not found" (translated)

#### Test B: Voucher Save Success
1. Create a new voucher
2. Fill in data
3. Click "Save as Draft"
4. **Expected:** Green toast shows "Voucher saved successfully!"

#### Test C: Validation Error
1. Try to create voucher without required fields
2. **Expected:** Yellow warning toast shows "Field is required"

### 3. **Multi-Language Testing**

**Switch to Arabic:**
```typescript
import i18n from './i18n/config';
i18n.changeLanguage('ar');
```

**Expected:**
- All error messages display in Arabic
- Toast position remains top-right
- Modal text is RTL

**Switch back to English:**
```typescript
i18n.changeLanguage('en');
```

### 4. **Backend Error Testing**

**Test Structured Error Response:**
```bash
# Using curl or Postman
GET /api/v1/tenant/accounting/voucher-forms/non-existent-id
Authorization: Bearer {your-token}
```

**Expected Response:**
```json
{
  "success": false,
  "error": {
    "code": "VOUCH_003",
    "message": "Form not found: non-existent-id",
    "severity": "error",
    "context": {
      "formId": "non-existent-id"
    },
    "timestamp": "2025-12-23T00:00:00.000Z"
  }
}
```

## 🐛 Common Issues & Solutions

### Issue 1: Toasts Not Showing
**Solution:** Check browser console for errors. Ensure `react-hot-toast` is installed:
```bash
cd frontend
npm install react-hot-toast
```

### Issue 2: Translations Not Working
**Solution:** Check that i18n is initialized in `main.tsx`:
```typescript
import './i18n/config';
```

### Issue 3: Modal Not Appearing
**Solution:** Ensure `<ErrorModal />` is added to `main.tsx` root

### Issue 4: API Errors Not Auto-Showing
**Solution:** Check that `setupErrorInterceptor()` is called in `main.tsx`

## 📊 Test Checklist

- [ ] Error test page loads without errors
- [ ] Toast error displays correctly
- [ ] Toast warning displays correctly
- [ ] Toast success displays correctly
- [ ] Modal error displays and requires user action
- [ ] API error auto-displays toast
- [ ] Errors translate to Arabic
- [ ] Errors translate back to English
- [ ] Real voucher save shows success toast
- [ ] Real API 404 shows error toast
- [ ] Backend returns structured error format
- [ ] Console shows no errors during tests

## 🚀 Next Steps After Testing

1. **If all tests pass:**
   - Merge `error-handling-system` branch to main
   - Replace all `alert()` calls with `errorHandler.showError()`
   - Add more error codes as needed

2. **If tests fail:**
   - Check console for specific errors
   - Verify all dependencies installed
   - Ensure Firebase emulators restarted
   - Review implementation guide

## 📝 Adding New Error Codes

**Backend:**
```typescript
// backend/src/errors/ErrorCodes.ts
export enum ErrorCode {
  // ... existing codes
  YOUR_NEW_CODE = 'CAT_###',
}
```

**Frontend Translations:**
```json
// frontend/public/locales/en/common.json
{
  "errors": {
    "CAT_###": "Your error message here"
  }
}
```

**Usage:**
```typescript
// Backend
throw new BusinessError(
  ErrorCode.YOUR_NEW_CODE,
  'Technical message',
  { contextData: 'value' }
);

// Frontend (automatic via API interceptor)
// Or manual:
errorHandler.showError(apiError);
```

## 🎨 Customizing Toast Appearance

Edit `main.tsx`:
```typescript
<Toaster 
  position="top-right"  // Change position
  toastOptions={{
    duration: 4000,     // Change duration
    style: {
      background: '#363636',  // Change colors
      color: '#fff',
    },
  }}
/>
```

## 📞 Support

If you encounter issues:
1. Check browser console
2. Check backend logs
3. Verify all files committed
4. Ensure emulators restarted
5. Review `ERROR_HANDLING_IMPLEMENTATION.md`

---

**Branch:** `error-handling-system`
**Status:** Ready for testing
**Last Updated:** 2025-12-23
