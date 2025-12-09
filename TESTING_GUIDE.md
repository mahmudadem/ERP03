# Quick Testing Guide - RBAC & Deletion Features

## 🎯 Testing RBAC UI Protection

### Test Scenario 1: Voucher Creation Permission

**Setup**:
1. Login as a user WITHOUT `accounting.vouchers.create` permission
2. Navigate to `/accounting/vouchers`

**Expected**:
- ✅ Voucher list is visible
- ❌ "New Voucher" button and type selector are **HIDDEN**

---

### Test Scenario 2: Approve Permission

**Setup**:
1. Login as a user WITH `accounting.vouchers.approve` but WITHOUT `accounting.vouchers.edit`
2. Open a voucher in "pending" status

**Expected**:
- ✅ Can see "Approve" button
- ❌ Cannot see "Send for Approval" button
- ❌ Cannot edit voucher fields

---

### Test Scenario 3: Designer Access

**Setup**:
1. Login as a regular user WITHOUT `designer.vouchers.modify`
2. Try to navigate to `/accounting/designer`

**Expected**:
- ❌ Route is protected - redirected to `/forbidden`
- OR if you manage to access, "New Voucher Type" button is **HIDDEN**

---

### Test Scenario 4: Full Permissions (OWNER/ADMIN)

**Setup**:
1. Login as OWNER or ADMIN (has all permissions)
2. Navigate to any page

**Expected**:
- ✅ ALL buttons visible
- ✅ Can create vouchers
- ✅ Can approve vouchers  
- ✅ Can access designer
- ✅ Full functionality

---

## 🗑️ Testing Voucher Type Deletion

### Test 1: Successful Deletion

**Using Frontend (Super Admin UI)**:
1. Login as SUPER_ADMIN
2. Navigate to `/super-admin/voucher-templates`
3. Click on a template to edit
4. Look for delete button (if UI has it)
5. Delete the template
6. Verify it's removed from the list

**Using API (Recommended for testing)**:
```bash
# Set emulator mode
$env:USE_EMULATOR="true"

# Get current templates
curl http://localhost:5001/erp-03/us-central1/api/super-admin/voucher-types

# Note an ID, then delete it
curl -X DELETE http://localhost:5001/erp-03/us-central1/api/super-admin/voucher-types/{TEMPLATE_ID}

# Verify it's gone
curl http://localhost:5001/erp-03/us-central1/api/super-admin/voucher-types
```

**Check Firestore** (Emulator UI):
1. Open http://localhost:4000 (Emulator UI)
2. Go to Firestore tab
3. Check `system_voucher_types` collection
4. Verify the document is actually deleted

---

### Test 2: Delete Non-Existent Template (Error Handling)

**API Test**:
```bash
curl -X DELETE http://localhost:5001/erp-03/us-central1/api/super-admin/voucher-types/fake-id-12345
```

**Expected Response**:
```json
{
  "success": false,
  "error": "System template not found"
}
```

**Status Code**: `404 Not Found`

---

## 🧑‍💻 Testing Different User Roles

### Create Test Users with Different Permissions

**Using Firestore Emulator**:

1. **Create Test User A** (Can Create Only):
   ```
   Collection: companies/{yourCompanyId}/rbac_company_users
   Document: {userIdA}
   Data: {
     userId: "userA",
     companyId: "yourCompanyId",
     roleId: "ROLE_CREATOR",
     isOwner: false
   }
   ```

2. **Create Role "ROLE_CREATOR"**:
   ```
   Collection: companies/{yourCompanyId}/rbac_company_roles
   Document: ROLE_CREATOR
   Data: {
     id: "ROLE_CREATOR",
     name: "Creator",
     resolvedPermissions: ["accounting.vouchers.create", "accounting.vouchers.view"]
   }
   ```

3. **Create Test User B** (Can Approve Only):
   Similar process, but with role having only:
   ```
   resolvedPermissions: ["accounting.vouchers.view", "accounting.vouchers.approve"]
   ```

---

## 📋 Testing Checklist

Use this checklist to verify all functionality:

### **RBAC Protection**:
- [ ] User without create permission: Cannot see "New Voucher" button
- [ ] User without approve permission: Cannot see "Approve" button
- [ ] User without edit permission: Cannot send for approval
- [ ] User without lock permission: Cannot lock vouchers
- [ ] User without cancel permission: Cannot cancel vouchers
- [ ] User without designer permission: Cannot create voucher types
- [ ] OWNER/ADMIN: Can see all buttons
- [ ] SUPER_ADMIN: Bypasses all checks

### **Deletion Feature**:
- [ ] Can delete system voucher template via API
- [ ] Template is removed from list after deletion
- [ ] Firestore document is actually deleted
- [ ] Deleting non-existent template returns 404
- [ ] Proper error messages displayed

### **No Regressions**:
- [ ] Existing voucher creation still works
- [ ] Existing voucher editing still works
- [ ] Approval workflow still functions
- [ ] Designer still works for authorized users
- [ ] System templates still copy to new companies

---

## 🐛 Common Issues & Solutions

### Issue: "RequirePermission is not defined"
**Solution**: Check that the import is correct:
```tsx
import { RequirePermission } from '../../../components/auth/RequirePermission';
```

### Issue: "All buttons are hidden for everyone"
**Solution**: Check CompanyAccessContext is properly providing permissions. Verify:
1. User is logged in
2. Company is selected  
3. User has role in selected company
4. Role has resolved permissions

### Issue: "Delete returns 404 for existing template"
**Solution**: 
1. Verify you're using correct template ID
2. Check if template is in `system_voucher_types` collection (not `companies/SYSTEM/voucher_types`)
3. Ensure migration was run successfully

---

## 🎬 Quick Demo Script

Want to demo the features? Follow this script:

### **Demo 1: RBAC in Action** (5 minutes)

1. **Setup**: 
   - Login as regular user
   - Go to Vouchers page

2. **Show**: 
   - "New Voucher" button is hidden (no create permission)
   
3. **Switch**:
   - Logout, login as ADMIN
   - Show button now appears

4. **Explain**:
   - "Permission-aware UI"
   - "Users only see what they can do"
   - "Better UX, better security"

---

### **Demo 2: Voucher Type Deletion** (3 minutes)

1. **Setup**:
   - Login as SUPER_ADMIN
   - Navigate to voucher templates

2. **Show Current Templates**:
   - List 6 default templates

3. **Delete One**:
   - Use API or UI
   - Show it's removed from list

4. **Verify in Firestore**:
   - Open emulator UI
   - Show document is gone

---

## 📝 Manual Testing Notes Template

Use this template to document your testing:

```markdown
## Test Session: [Date/Time]
**Tester**: [Your Name]
**Environment**: [Production/Emulator]

### Test 1: RBAC Protection - Voucher Creation
- User Role: _______________
- Expected: _______________
- Actual: _______________
- **Result**: ✅ PASS / ❌ FAIL
- Notes: _______________

### Test 2: RBAC Protection - Approval
- User Role: _______________
- Expected: _______________
- Actual: _______________
- **Result**: ✅ PASS / ❌ FAIL
- Notes: _______________

### Test 3: Voucher Type Deletion
- Template ID: _______________
- Expected: _______________
- Actual: _______________
- **Result**: ✅ PASS / ❌ FAIL
- Notes: _______________

### Overall Assessment:
- **RBAC**: _______________
- **Deletion**: _______________
- **Regressions**: _______________
- **Production Ready**: YES / NO
```

---

**Happy Testing!** 🚀

If you find any issues, check:
1. Browser console for errors
2. Network tab for API responses
3. Firestore emulator UI for data state
4. Backend logs for server-side issues
