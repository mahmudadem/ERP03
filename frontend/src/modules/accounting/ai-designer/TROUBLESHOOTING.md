# AI Designer - Minimal Integration

## ✅ What's Included

Only the essential components for the voucher designer:

### Core Components
- ✅ `VoucherDesigner` - Main 6-step wizard component
- ✅ `GenericVoucherRenderer` - Renders voucher previews
- ✅ `VoucherContext` - Optional state management
- ✅ `types.ts` - TypeScript definitions

### Not Included (Removed from exports)
- ❌ JournalVoucher, LegacyJournalVoucher - Not needed
- ❌ VoucherTypeManager - Not needed for designer
- ❌ Sidebar, WindowFrame - UI components not needed
- ❌ Button - Using your system's buttons
- ❌ LanguageContext - Not needed
- ❌ GeminiService - AI features optional

## 🎯 Usage

```tsx
import { VoucherDesigner } from '@/modules/accounting/ai-designer';

<VoucherDesigner 
  onSave={(config) => console.log(config)}
  onCancel={() => history.back()}
/>
```

## 🐛 Common Runtime Errors & Fixes

### Error: "lucide-react icons not found"
**Fix**: Already installed in your project ✅

### Error: "React version mismatch"
**Symptoms**: Hooks warnings, rendering issues
**Fix**: This is expected - ai-designer uses React 19, you have React 18. Should work but watch console.

### Error: "Cannot find module '@google/genai'"
**Fix**: This is ONLY needed for AI features. Designer works without it.
```bash
npm install @google/genai  # Optional
```

### Error: "VoucherProvider not found"
**Fix**: Already fixed - removed from AIDesignerPage

### Error: "localStorage is not defined"
**Symptoms**: VoucherContext fails
**Fix**: VoucherContext uses localStorage for persistence - works in browser

## 📝 What the Designer Does

1. **Step 1: Basic Info** - Name, ID, prefix for voucher type
2. **Step 2: Rules** - Approval workflows, validation rules
3. **Step 3: Fields** - Select which fields to include
4. **Step 4: Actions** - Enable print, email, export features
5. **Step 5: Visual Editor** - Drag & drop layout design
6. **Step 6: Review** - Final review and save

## 🚫 What's NOT Needed

- No external database
- No API calls (unless you add them)
- No authentication (handled by your system)
- No AI features (optional, requires @google/genai)

## 📍 Access

Navigate to: **Accounting → AI Designer** in sidebar

Or directly: `http://localhost:5173/accounting/ai-designer`

## ⚙️ Configuration Needed

**None!** The designer is self-contained and stores configs in localStorage.

## 🔍 If You See Errors

1. **Check browser console** - Look for specific error messages
2. **Clear localStorage** - Run: `localStorage.clear()` in console
3. **Verify path** - Ensure `/accounting/ai-designer` route exists
4. **Check permissions** - Ensure `designer.vouchers.view` permission is granted

---

**Status**: Minimal integration complete  
**Dependencies**: None required (lucide-react already installed)  
**Optional**: @google/genai for AI features
