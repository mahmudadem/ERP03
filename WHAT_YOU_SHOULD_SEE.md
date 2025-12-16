# What You Should See - Voucher Designer V2

## Step-by-Step Guide

### 1️⃣ **Open Your Browser**
Navigate to: **http://localhost:5174/#/accounting/designer-v2**

---

### 2️⃣ **Landing Page (VoucherDesignerPage)**

You should see a beautiful page with:

#### **Header Section:**
```
┌─────────────────────────────────────────────────────────┐
│  📝 Voucher Designer V2                                 │
│  Create and customize voucher templates for your needs  │
└─────────────────────────────────────────────────────────┘
```

#### **4 Colorful Voucher Type Cards:**

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ 💸 PAYMENT       │  │ 💰 RECEIPT       │  │ 📊 JOURNAL ENTRY │  │ 📈 OPENING       │
│                  │  │                  │  │                  │  │    BALANCE       │
│ DEFAULT badge    │  │ DEFAULT badge    │  │ DEFAULT badge    │  │ DEFAULT badge    │
│                  │  │                  │  │                  │  │                  │
│ Record payments  │  │ Record receipts  │  │ Manual entries   │  │ Opening balances │
│                  │  │                  │  │                  │  │                  │
│ [Customize]      │  │ [Customize]      │  │ [Customize]      │  │ [Customize]      │
│ [Preview]        │  │ [Preview]        │  │ [Preview]        │  │ [Preview]        │
│                  │  │                  │  │                  │  │                  │
│ 📌 Quick Actions │  │ 📌 Quick Actions │  │ 📌 Quick Actions │  │ 📌 Quick Actions │
└──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────────────┘
```

#### **Info Boxes Below:**
- Need Help? box with tips
- Quick Actions box with common tasks

---

### 3️⃣ **Click "Customize" on Payment Voucher**

A **full-screen modal** should open with:

#### **Header (Gradient purple/indigo):**
```
┌─────────────────────────────────────────────────────────────────┐
│  Voucher Designer - Payment Voucher                        [X]  │
└─────────────────────────────────────────────────────────────────┘
```

#### **Progress Bar (5 Steps):**
```
[1 Type] ──→ [2 Fields] ──→ [3 Layout] ──→ [4 Validate] ──→ [5 Review]
  ✓            ○             ○              ○               ○
```

#### **Current Step: Field Selection (Step 2)**
Since we skip Step 1 when type is pre-selected, you should land on **Step 2**.

You should see **3 SECTIONS:**

**A) CORE FIELDS (Red background):**
```
🔒 Core Fields (6)
Required by accounting system - Cannot be removed or hidden

┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Date            │  │ Amount          │  │ Party           │
│ 🔒 CORE         │  │ 🔒 CORE         │  │ 🔒 CORE         │
│ Required        │  │ Required        │  │ Required        │
└─────────────────┘  └─────────────────┘  └─────────────────┘

... 3 more CORE fields
```

**B) SHARED FIELDS (Blue - toggleable):**
```
🔗 Shared Fields (9)
Optional, system-defined - Toggle to show/hide from your view

☑ Reference Number    ☐ Payment Mode      ☐ Bank Account
☑ Description         ☐ Check Number      ☐ Transaction ID
... etc
```

**C) PERSONAL FIELDS (Purple):**
```
👤 Personal Fields (0)
Your private notes - Not visible to others or in reports

┌────────────────────────────────────────────┐
│ [Enter field name]              [+ Add]    │
└────────────────────────────────────────────┘

No personal fields added yet
```

**D) SYSTEM METADATA (Gray):**
```
ℹ️ System Metadata Fields
Optional read-only fields showing voucher lifecycle information

Audit Trail:
☐ Created At    ☐ Created By
☐ Updated At    ☐ Updated By

Status:
☐ Status        ☐ Voucher Number

Workflow:
☐ Submitted At/By  ☐ Approved At/By  ☐ Rejected At/By
```

**E) SUMMARY BOX:**
```
Field Selection Summary
┌────────┬────────┬────────┬────────┐
│   6    │  3/9   │   0    │   0    │
│ Core   │ Shared │Personal│Metadata│
└────────┴────────┴────────┴────────┘
```

#### **Footer Buttons:**
```
[← Previous]                    [Next →]
```

---

### 4️⃣ **If Nothing Shows:**

**Possible Issues:**

1. **Route Not Registered**
   - Check: Does the URL change to `#/accounting/designer-v2`?
   - If not, routing issue

2. **White Screen / Error**
   - Press F12 to open browser console
   - Look for red errors
   - Tell me what the error says

3. **Login Required**
   - The page may require authentication
   - Try logging in first
   - Then navigate to designer

4. **Module Loading**
   - Refresh the page (Ctrl+R or Cmd+R)
   - Hard refresh (Ctrl+Shift+R)

---

## 🎯 **Quick Test:**

1. Open browser console (F12)
2. Go to: http://localhost:5174/#/accounting/designer-v2
3. Look for:
   - **Green checkmark** = Page loaded ✅
   - **Red errors** = Something broke ❌
   - **404** = Route not found ❌

**Tell me:**
- What URL shows in the browser?
- What do you see on the screen?
- Any errors in console (F12)?

This will help me debug! 🔧
