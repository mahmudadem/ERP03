# 🔒 MAKE CLONED VOUCHER ID READ-ONLY

## Problem:
User can paste a duplicate ID into a cloned voucher, bypassing uniqueness.

## Solution:
Make the ID field read-only when it's a clone (auto-generated).

## Where to Add:

Find the ID input field in VoucherDesigner (Step 2 - Basic Settings) and add:

```typescript
// Add this state to track if it's a cloned voucher
const isClonedVoucher = initialConfig?.id?.includes('clone_');

// In the ID input field:
<input
  type="text"
  value={config.id}
  onChange={(e) => setConfig({...config, id: e.target.value})}
  readOnly={isClonedVoucher} // Make read-only for clones
  disabled={isClonedVoucher} // Also visually disabled
  className={`w-full px-4 py-2 border rounded ${
    isClonedVoucher 
      ? 'bg-gray-100 cursor-not-allowed' 
      : 'bg-white'
  }`}
  title={isClonedVoucher ? 'ID is auto-generated for cloned vouchers' : ''}
/>

{isClonedVoucher && (
  <p className="text-xs text-gray-500 mt-1">
    🔒 Auto-generated ID (cannot be changed for clones)
  </p>
)}
```

## Alternative: Just Hide ID Field for Clones

```typescript
{!isClonedVoucher && (
  <div>
    <label>Voucher ID</label>
    <input ... />
  </div>
)}

{isClonedVoucher && (
  <div className="bg-gray-50 p-3 rounded border border-gray-200">
    <p className="text-sm text-gray-600">
      <strong>ID:</strong> {config.id}
    </p>
    <p className="text-xs text-gray-500 mt-1">
      Auto-generated for cloned vouchers
    </p>
  </div>
)}
```

## Best Solution: Prevent Editing Critical Fields

For cloned vouchers:
- ✅ Allow editing: Name, Prefix (with validation)
- ❌ Block editing: ID (auto-generated, unique)

This ensures clones always have unique IDs!
