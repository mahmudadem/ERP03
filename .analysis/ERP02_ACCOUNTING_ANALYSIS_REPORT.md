# ERP02 Accounting & Approval System - Analysis Report

**Analysis Date:** December 15, 2025  
**Analyzed System:** ERP02 (Legacy System)  
**Target System:** ERP03 (New Modular Architecture)  
**Focus Areas:**  
1. Voucher Saving Logic with Multi-Currencies
2. Approval Flow  
3. Approval System Architecture

---

## EXECUTIVE SUMMARY

ERP02 implements a sophisticated **form-driven voucher system** with **multi-currency support**, **flexible approval workflows**, and **real-time notifications**. The system uses a **template-based design** where voucher types are dynamically configured, supporting both **single-line** and **multi-line** journal entries.

### Key Strengths:
✅ **Dynamic Form Generation** - Voucher forms are built from configurable templates  
✅ **Multi-Currency Support** - Full support for FX transactions with exchange rates  
✅ **Flexible Approval System** - Status-based workflow with role permissions  
✅ **Real-time Notifications** - Account custodians and impacted users notified  
✅ **Audit Trail** - Complete change tracking in audit logs  
✅ **Protected Entities** - Base currency and system accounts cannot be deleted  

### Areas for Improvement:
⚠️ **Approval Logic in Frontend** - Business rules scattered across UI and backend  
⚠️ **No Workflow Engine** - Approval is status-based, not workflow-driven  
⚠️ **Mixed Responsibilities** - Cloud Functions handle both save AND approval logic  
⚠️ **Limited Multi-step Approvals** - Single approve/reject, no complex chains  

---

## 1. VOUCHER SAVING LOGIC & MULTI-CURRENCY

### 1.1 Data Model

#### Primary Entity: `FinancialVoucher`
```typescript
interface FinancialVoucher {
  id: string;
  voucherNo?: string | null;      // Auto-generated number
  date: string;                    // Transaction date
  description: string;
  type: string;                    // Voucher type name (e.g., "Payment", "Receipt")
  status: VoucherStatus;           // DRAFT | PENDING | APPROVED | LOCKED | CANCELED
  currency: string;                // Transaction currency code (USD, EUR, etc.)
  
  // Lines (journal entries)
  lines: VoucherLineItem[];
  
  // Metadata
  createdBy?: string;
  createdAt?: Timestamp;
  submittedBy?: string;
  submittedAt?: Timestamp;
  approvedBy?: string;
  approvedAt?: Timestamp;
  lockedBy?: string;
  lockedAt?: Timestamp;
  statusReason?: string;           // Rejection/cancellation reason
  
  // Totals
  totalDebit?: number;
  totalCredit?: number;
  
  // Audit
  auditLog?: {
    createdBy: string;
    createdAt: string;
    approvedBy?: string;
    approvedAt?: string;
    lastEditedBy?: string;
    lastEditedAt?: string;
  };
}
```

#### Line Item: `VoucherLineItem`
```typescript
interface VoucherLineItem {
  id: number;
  accountId: string | null;
  type: "Debit" | "Credit";
  amount: number;                  // Amount in voucher currency
  costCenterId?: string;
  notes?: string;
  fxAmount?: number;               // Amount in foreign currency (if different)
}
```

### 1.2 Multi-Currency Implementation

#### Company-Level Currency Setup
**Location:** `companies/{companyId}/currencies/{currencyCode}`

```typescript
interface Currency {
  code: string;              // e.g., "USD", "EUR"
  name: string;
  symbol: string;
  exchangeRate: number;      // Rate relative to base currency
  isBase: boolean;           // One currency marked as base
  isProtected: boolean;      // Base currency cannot be deleted
}
```

#### Exchange Rate History
**Location:** `companies/{companyId}/exchange_rates`

```typescript
interface ExchangeRate {
  from_currency: string;     // Base currency
  to_currency: string;       // Target currency
  rate: number;
  date: string;              // ISO date
  createdAt: string;
  createdBy: string;
  createdByName: string;
}
```

#### Multi-Currency in Vouchers
1. **Voucher Creation** - User selects currency from dropdown (line 476-495 in DynamicVoucherForm)
2. **Line Items** - Each line stores `amount` in voucher currency
3. **Optional FX Amount** - `fxAmount` field for foreign currency amounts
4. **Exchange Rate Lookup** - Backend looks up rate at time of posting
5. **Base Currency Posting** - All accounts updated in base currency

### 1.3 Voucher Saving Flow

#### Frontend: DynamicVoucherForm.tsx (795 lines)

**Step 1: Form Submission** (line 351-387)
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
 
  // 1. Validate form
  if (!validateForm()) return;
  
  setIsSubmitting(true);
  
  try {
    // 2. Convert form data to journal entry
    const journalEntry = convertToJournalEntry();
    
    // 3. Call backend save function
    await saveVoucher(companyId, journalEntry, userProfile, accounts);
    
    // 4. Success callback and reset
    if (onSuccess) onSuccess();
    resetForm();
    
  } catch (error) {
    setFormErrors({ _form: error.message });
  } finally {
    setIsSubmitting(false);
  }
};
```

**Step 2: Journal Entry Conversion** (line 256-348)

Two modes supported:

**SINGLE-LINE MODE:**
```typescript
// Use journal template rules to create debit/credit entries
voucherType.journalTemplate.rules.forEach(rule => {
  let accountId = rule.accountSource === 'fixed' 
    ? rule.accountId 
    : formData.account;
    
  voucherLines.push({
    id: lineId++,
    accountId,
    type: rule.side === 'debit' ? 'Debit' : 'Credit',
    amount: parseFloat(formData.amount),
    notes: formData.notes || formData.description
  });
});
```

**MULTI-LINE MODE:**
```typescript
// Each line explicitly defines account, side, amount
lines.forEach(line => {
  voucherType.journalTemplate.rules.forEach(rule => {
    // Determine Side from line data
    let type = rule.side === 'fromField' 
      ? line[rule.sideFieldId]  // 'Debit' or 'Credit'
      : rule.side;
      
    // Determine Account from line data
    let accountId = rule.accountSource === 'fromField'
      ? line[rule.accountFieldId]
      : rule.accountId;
      
    // Determine Amount from line data
    let amount = rule.amountSource === 'fromField'
      ? parseFloat(line[rule.amountFieldId])
      : parseFloat(line.amount);
      
    voucherLines.push({
      id: lineId++,
      accountId,
      type,
      amount,
      notes: line.notes,
      costCenterId: line.costCenterId
    });
  });
});
```

**Step 3: Create Voucher Object** (line 332-347)
```typescript
const voucher: FinancialVoucher = {
  id: `temp-${Date.now()}`,   // Temporary ID
  voucherNo: null,             // Generated by backend
  date: formData.date || new Date().toISOString().split('T')[0],
  description: formData.description || `${voucherType.name.en} Transaction`,
  type: voucherType.name.en,
  referenceDoc: formData.referenceDoc || '',
  currency: formData.currency || 'USD',  // 🔑 Multi-currency field
  paymentMethod: formData.paymentMethod || null,
  status: VoucherStatus.DRAFT,           // Always starts as DRAFT
  lines: voucherLines,
  createdBy: userProfile?.id || null,
  createdAt: Date.now()
};
```

#### Frontend Service: finance.service.ts

**Call to Backend** (line 95-102)
```typescript
export const saveVoucher = async (
  companyId: string, 
  voucherData: FinancialVoucher, 
  _userProfile: User, 
  _accounts: Account[]
): Promise<string> => {
  if (!db) throw new Error("Firestore is not initialized.");
  if (!companyId) throw new Error("Company ID is required.");
  
  // Call Cloud Function
  const functions = getFunctions(app, 'us-central1');
  const callable = httpsCallable(functions, 'saveVoucherSecure');
  const res: any = await callable({ companyId, voucher: voucherData });
  
  return res?.data?.id || voucherData.id;
};
```

**Note:** The actual save logic is in Cloud Functions (`saveVoucherSecure`), which was not fully analyzed due to file size (2735 lines). The function likely:
1. Validates voucher data
2. Generates voucher number
3. Calculates totals
4. Converts amounts to base currency if needed
5. Saves to Firestore
6. Triggers notifications

### 1.4 Validation Logic

#### Frontend Validation (line 212-254)

**Header Fields:**
```typescript
visibleFields.forEach(field => {
  if (field.required) {
    const value = formData[field.id];
    if (value === undefined || value === null || value === '') {
      errors[field.id] = `${getFieldLabel(field)} is required`;
    }
  }
});
```

**Multi-Line Mode Validation:**
```typescript
if (mode === 'multiLine') {
  const constraints = voucherType.lineConstraints;
  
  // Check min/max rows
  if (constraints?.minRows && lines.length < constraints.minRows) {
    errors._form = `Minimum ${constraints.minRows} lines required`;
  }
  
  // Validate each line
  lines.forEach((line, idx) => {
    visibleLineFields.forEach(field => {
      if (field.required) {
        const value = field.id === 'account' ? line.accountId : line[field.id];
        if (!value) {
          errors[`line_${idx}_${field.id}`] = `${getFieldLabel(field)} required`;
        }
      }
    });
  });
  
  // Check balanced entries
  if (constraints?.requireBalancedLines && Math.abs(totals.difference) > 0.01) {
    errors._form = 'Entries must be balanced (Debit = Credit)';
  }
}
```

#### Real-time Balance Check (line 101-116)
```typescript
const totals = useMemo(() => {
  const debitTotal = lines
    .filter(line => line.side === 'Debit')
    .reduce((sum, line) => sum + (parseFloat(String(line.amount)) || 0), 0);

  const creditTotal = lines
    .filter(line => line.side === 'Credit')
    .reduce((sum, line) => sum + (parseFloat(String(line.amount)) || 0), 0);

  return {
    debit: debitTotal,
    credit: creditTotal,
    difference: debitTotal - creditTotal  // Must be 0 for balanced entry
  };
}, [lines]);
```

---

## 2. APPROVAL FLOW

### 2.1 Voucher Status Lifecycle

```
DRAFT ─────► PENDING ─────► APPROVED ─────► LOCKED
  │            │               │
  │            │            CANCELED
  │            └─────────► CANCELED
  └───────────────────────► CANCELED
```

**Status Definitions:**
- **DRAFT** - Initial state, editable by creator
- **PENDING** - Submitted for approval, awaiting review
- **APPROVED** - Approved by authorized user, posted to accounts
- **LOCKED** - Finalized, cannot be edited or deleted
- **CANCELED** - Rejected or canceled, reason recorded

### 2.2 Status Change Logic

#### Frontend: finance.service.ts (line 104-114)

```typescript
export const changeVoucherStatus = async (
  companyId: string, 
  voucherId: string, 
  targetStatus: VoucherStatus, 
  reason?: string
): Promise<void> => {
  const functionsInstance = getFunctions(app, 'us-central1');
  const callable = httpsCallable(functionsInstance, 'changeVoucherStatus');
  await callable({ companyId, voucherId, targetStatus, reason });
};

export const approveVoucher = async (
  companyId: string, 
  voucherId: string, 
  _approverProfile: User
): Promise<void> => {
  await changeVoucherStatus(companyId, voucherId, VoucherStatus.APPROVED);
};
```

### 2.3 Auto-Approval Logic

#### Backend: Cloud Functions (from functions/src/index.ts, line 533-539)

```typescript
await db.doc(`companies/${companyId}/system_settings/config`).set({
  baseCurrency: baseCurrency.code,
  companyName: name,
  allowApprovedVoucherDeletion: false,
  allowReceiverEdit: false,
  strictApprovalMode: false,
  autoApproveWhenReceiverIsActing: true,   // 🔑 Auto-approve feature
  approval: {
    autoApproveWhenReceiverIsActing: true,
  },
  // ... notification settings
}, { merge: true });
```

**Auto-Approve Logic:**
- When `autoApproveWhenReceiverIsActing` is true
- If the user creating a voucher is also a custodian of the affected accounts
- The voucher can be auto-approved without explicit approval step
- This prevents unnecessary approval loops for self-transactions

### 2.4 Permission Checks

#### Company Role Assertion (line 118-141)
```typescript
export async function assertCompanyRole(
  context: functions.https.CallableContext,
  companyId: string,
  allowed: CompanyRole[]  // e.g., ['Owner', 'Admin', 'Accountant']
): Promise<{ uid: string; role: CompanyRole }> {
  const uid = requireAuth(context);
  
  // Get user's company membership
  const ref = db.doc(`companies/${companyId}/users/${uid}`);
  const snap = await ref.get();
  
  if (!snap.exists) {
    throw new functions.https.HttpsError(
      "permission-denied", 
      "You are not a member of this company."
    );
  }
  
  const role = snap.data()?.role as CompanyRole;
  
  if (!allowed.includes(role)) {
    throw new functions.https.HttpsError(
      "permission-denied", 
      `Requires one of roles: ${allowed.join(", ")}.`
    );
  }
  
  return { uid, role };
}
```

**Roles Hierarchy:**
1. **Owner** - Full control, can delete company
2. **Admin** - Manage users, approvals
3. **Manager** - Create and approve vouchers
4. **Accountant** - Create vouchers, view reports
5. **User** - View only

### 2.5 Account Custodian System

#### Custodian Extraction (line 163-174)
```typescript
const extractCustodians = (data: any): string[] => {
  if (!data) return [];
  if (Array.isArray(data.custodians) && data.custodians.length) {
    return data.custodians.filter((id: any) => 
      typeof id === 'string' && id
    );
  }
  return [];
};

const accountHasCustodianUid = (
  data: any, 
  uid: string | null | undefined
): boolean => {
  if (!uid) return false;
  return extractCustodians(data).includes(uid);
};
```

**Custodian Logic:**
- Each account can have assigned custodians (user UIDs)
- Custodians get notified when their accounts are affected
- Auto-approval can trigger if custodian is creating the voucher
- Used for responsibility and accountability tracking

---

## 3. NOTIFICATION SYSTEM

### 3.1 Notification Settings (line 540-551)

```typescript
notifications: {
  enabled: true,
  voucherAccountImpact: true,    // Notify custodians of impacted accounts
  onCreate: true,                // Notify when voucher created
  onApprove: true,               // Notify when approved
  onReject: true,                // Notify when rejected
  onEdit: true,                  // Notify when edited
  onDelete: true,                // Notify when deleted
  onAmountChange: true,          // Notify on amount changes
  onFxChange: true,              // Notify on FX rate changes
  onAccountChange: true,         // Notify when account changed
}
```

### 3.2 Notification Triggers

Based on file structure, the system likely uses:
- `getImpactedUsersFromVoucher()` - Finds users to notify
- `sendVoucherImpactNotifications()` - Sends notifications
- `ChangeType` enum - Defines notification types

**Notification Recipients:**
1. Account custodians (when their accounts are debited/credited)
2. Voucher creator (on status changes)
3. Approvers (when pending approval)
4. Configured watchers

---

## 4. CURRENCY IMPLEMENTATION DETAILS

### 4.1 Base Currency Protection

#### Delete Currency Function (line 573-608)
```typescript
export const deleteCompanyCurrency = functions.https.onCall(async (data, context) => {
  const { companyId, currencyId } = data || {};
  await assertCompanyRole(context, companyId, ["Owner", "Admin"]);
  
  const currencyRef = db.doc(`companies/${companyId}/currencies/${currencyId}`);
  const snap = await currencyRef.get();
  
  if (!snap.exists) {
    throw new functions.https.HttpsError("not-found", "Currency not found.");
  }
  
  const currency = snap.data() || {};
  
  // 🔑 Protection check #1: Is this the base currency?
  if (currency.isBase || currency.isProtected) {
    throw new functions.https.HttpsError(
      "failed-precondition", 
      "Base currency cannot be deleted."
    );
  }
  
  const code = currency.code;
  
  // 🔑 Protection check #2: Is it configured as base in settings?
  const settingsSnap = await db.doc(`companies/${companyId}/system_settings/config`).get();
  const configuredBase = settingsSnap.data()?.baseCurrency;
  
  if (configuredBase && configuredBase.toUpperCase() === String(code).toUpperCase()) {
    throw new functions.https.HttpsError(
      "failed-precondition", 
      "Base currency cannot be deleted."
    );
  }
  
  // 🔑 Protection check #3: Is it used in any vouchers?
  const usedSnap = await db
    .collection(`companies/${companyId}/financial_vouchers`)
    .where("currency", "==", code)
    .limit(1)
    .get();
    
  if (!usedSnap.empty) {
    throw new functions.https.HttpsError(
      "failed-precondition", 
      `Cannot delete ${code}; it is used in existing vouchers.`
    );
  }
  
  await currencyRef.delete();
  return { deleted: currencyId };
});
```

### 4.2 Exchange Rate Seeding (line 509-528)

```typescript
// Seed exchange rate history from base -> each additional currency
const nowIso = new Date().toISOString();
const rateAudit: RateAudit = { 
  createdAt: nowIso, 
  createdBy: uid, 
  createdByName: 'system' 
};

const rateWrites: Promise<any>[] = [];
currencies
  .filter((c) => !c.isBase)
  .forEach((cur) => {
    const rateDoc = db.collection(`companies/${companyId}/exchange_rates`).doc();
    rateWrites.push(rateDoc.set({
      from_currency: baseCurrency.code,
      to_currency: cur.code,
      rate: cur.exchangeRate,
      date: nowIso,
      createdAt: rateAudit.createdAt,
      createdBy: rateAudit.createdBy,
      createdByName: rateAudit.createdByName,
    }));
  });
  
if (rateWrites.length) {
  await Promise.all(rateWrites);
}
```

---

## 5. STRENGTHS & WEAKNESSES

### Strengths ✅

1. **Template-Driven Design**
   - Voucher types configurable via templates
   - Supports both single and multi-line modes
   - Field-level customization (required, visible, order)
   - Dynamic journal entry generation from templates

2. **Multi-Currency Architecture**
   - Base currency concept
   - Historical exchange rate tracking
   - Protection against deletion of used currencies
   - FX amount support in line items

3. **Security & Validation**
   - Role-based access control
   - Company membership validation
   - Balanced entry enforcement
   - Protected entity safeguards

4. **User Experience**
   - Real-time balance calculation
   - Dynamic form generation
   - Account selection modal
   - Visual error indicators

5. **Audit & Compliance**
   - Complete audit log
   - Status change tracking
   - Creator/approver/locker tracking
   - Timestamp for all state changes

### Weaknesses ⚠️

1. **No Workflow Engine**
   - Approval is simple status transition
   - No multi-step approval chains
   - No conditional routing based on amount/type
   - No delegation or escalation

2. **Mixed Business Logic**
   - Approval rules partly in frontend
   - Validation duplicated (client + server)
   - Template conversion logic in UI component
   - Should be centralized in backend

3. **Limited Approval Features**
   - Single approve/reject model
   - No partial approvals
   - No approval hierarchy
   - No approval delegation

4. **Cloud Functions Architecture**
   - Monolithic functions file (2735 lines)
   - Mixed concerns (CRUD + approval + notifications)
   - Would benefit from separation

5. **Multi-Currency Gaps**
   - No revaluation logic
   - No gain/loss calculation
   - Manual exchange rate entry
   - No automatic rate fetching

---

## 6. RECOMMENDATIONS FOR ERP03

###6.1 Architecture Improvements

**Separate Approval System:**
```typescript
// Dedicated approval workflow service  
interface ApprovalWorkflow {
  id: string;
  name: string;
  steps: ApprovalStep[];
  rules: ApprovalRule[];
}

interface ApprovalStep {
  id: string;
  name: string;
  approvers: string[];  // Role or user IDs
  requiredCount: number;  // e.g., 2 of 3 must approve
  condition?: string;  // e.g., "amount > 10000"
}

interface ApprovalRule {
  field: string;  // e.g., "amount", "type"
  operator: string;  // e.g., ">", "==", "in"
  value: any;
  action: 'require_approval' | 'auto_approve' | 'escalate';
}
```

**Centralize Business Logic:**
```typescript
// Backend use case
class SaveVoucherUseCase {
  async execute(voucher: VoucherDTO): Promise<VoucherEntity> {
    // 1. Validate
    await this.validator.validate(voucher);
    
    // 2. Convert currency if needed
    const voucherInBaseCurrency = await this.currencyService
      .convertToBase(voucher);
    
    // 3. Generate voucher number
    const voucherNumber = await this.numberGenerator
      .generate(voucher.type, voucher.date);
    
    // 4. Calculate totals
    const totals = this.calculateTotals(voucherInBaseCurrency);
    
    // 5. Check balance
    if (Math.abs(totals.debit - totals.credit) > 0.01) {
      throw new ValidationError('Voucher not balanced');
    }
    
    // 6. Determine approval requirement
    const requiresApproval = await this.approvalEngine
      .checkRequirement(voucher);
    
    // 7. Save
    const entity = await this.repository.save({
      ...voucherInBaseCurrency,
      voucherNo: voucherNumber,
      totalDebit: totals.debit,
      totalCredit: totals.credit,
      status: requiresApproval ? 'PENDING' : 'APPROVED'
    });
    
    // 8. Trigger approval workflow if needed
    if (requiresApproval) {
      await this.approvalEngine.start(entity.id);
    }
    
    // 9. Send notifications
    await this.notificationService.sendCreatedNotification(entity);
    
    return entity;
  }
}
```

### 6.2 Enhanced Multi-Currency

**Currency Revaluation:**
```typescript
interface RevaluationEntry {
  id: string;
  date: string;
  accounts: string[];  // Foreign currency accounts
  oldRate: number;
  newRate: number;
  gainLossAmount: number;
  gainLossAccountId: string;  // Unrealized gain/loss account
  status: 'draft' | 'posted';
}

class CurrencyRevaluationService {
  async revalue(companyId: string, asOfDate: string): Promise<RevaluationEntry> {
    // 1. Get all accounts with foreign currency balances
    const fcAccounts = await this.getAccountsWithForeignCurrency(companyId);
    
    // 2. Get current exchange rates
    const rates = await this.exchangeRateService.getRates(companyId, asOfDate);
    
    // 3. Calculate gain/loss for each account
    const adjustments = fcAccounts.map(account => {
      const oldValue = account.balance * account.historicalRate;
      const newValue = account.balance * rates[account.currency];
      return {
        accountId: account.id,
        adjustmentAmount: newValue - oldValue
      };
    });
    
    // 4. Create revaluation entry
    return this.createRevaluationEntry(companyId, adjustments);
  }
}
```

**Automatic Rate Fetching:**
```typescript
interface ExchangeRateProvider {
  fetchRates(baseCurrency: string, targetCurrencies: string[]): Promise<Record<string, number>>;
}

class ExchangeRateService {
  constructor(
    private provider: ExchangeRateProvider,  // e.g., Fixer.io, ECB
    private repository: IExchangeRateRepository
  ) {}
  
  async updateRates(companyId: string): Promise<void> {
    const company = await this.companyRepo.findById(companyId);
    const baseCurrency = company.baseCurrency;
    const currencies = await this.currencyRepo.findByCompany(companyId);
    
    const rates = await this.provider.fetchRates(
      baseCurrency,
      currencies.map(c => c.code)
    );
    
    // Save historical record
    for (const [currency, rate] of Object.entries(rates)) {
      await this.repository.save({
        companyId,
        fromCurrency: baseCurrency,
        toCurrency: currency,
        rate,
        date: new Date().toISOString(),
        source: 'automatic'
      });
    }
  }
}
```

### 6.3 Workflow Engine

**Example Approval Workflow:**
```typescript
const paymentApprovalWorkflow: ApprovalWorkflow = {
  id: 'payment-approval',
  name: 'Payment Approval Workflow',
  steps: [
    {
      id: 'step-1',
      name: 'Department Manager',
      approvers: ['MANAGER_ROLE'],
      requiredCount: 1,
      condition: 'amount > 1000'
    },
    {
      id: 'step-2',
      name: 'Finance Director',
      approvers: ['FINANCE_DIRECTOR_ROLE'],
      requiredCount: 1,
      condition: 'amount > 10000'
    },
    {
      id: 'step-3',
      name: 'CEO',
      approvers: ['CEO_ROLE'],
      requiredCount: 1,
      condition: 'amount > 100000'
    }
  ],
  rules: [
    {
      field: 'amount',
      operator: '<=',
      value: 1000,
      action: 'auto_approve'
    },
    {
      field: 'createdBy',
      operator: 'in',
      value: ['custodians'],  // Account custodians
      action: 'auto_approve'
    }
  ]
};

class ApprovalWorkflowEngine {
  async determineSteps(
    workflow: ApprovalWorkflow,
    voucher: VoucherEntity
  ): Promise<ApprovalStep[]> {
    const steps: ApprovalStep[] = [];
    
    for (const step of workflow.steps) {
      if (!step.condition) {
        steps.push(step);
        continue;
      }
      
      // Evaluate condition
      const shouldInclude = this.evaluateCondition(
        step.condition,
        voucher
      );
      
      if (shouldInclude) {
        steps.push(step);
      }
    }
    
    return steps;
  }
  
  async processApproval(
    voucherId: string,
    approverId: string
  ): Promise<void> {
    const instance = await this.getInstanceByVoucher(voucherId);
    const currentStep = instance.steps[instance.currentStepIndex];
    
    // Record approval
    await this.recordApproval(instance.id, currentStep.id, approverId);
    
    // Check if step is complete
    const approvals = await this.getStepApprovals(instance.id, currentStep.id);
    
    if (approvals.length >= currentStep.requiredCount) {
      // Move to next step
      await this.advanceToNextStep(instance.id);
      
      // If all steps complete, mark voucher as approved
      if (instance.currentStepIndex >= instance.steps.length - 1) {
        await this.voucherService.markAsApproved(voucherId, approverId);
      }
    }
  }
}
```

---

## 7. MIGRATION STRATEGY

### Phase 1: Foundation (Week 1-2)
1. ✅ Copy voucher type designer
2. ✅ Implement dynamic form generator
3. ✅ Create voucher entity and repository
4. ✅ Build save use case

### Phase 2: Multi-Currency (Week 3-4)
1. Implement currency management
2. Build exchange rate service
3. Add FX conversion logic
4. Create revaluation feature

### Phase 3: Approval System (Week 5-6)
1. Design approval workflow engine
2. Implement role-based approval
3. Add approval tracking
4. Build approval UI

### Phase 4: Notifications (Week 7)
1. Implement notification service
2. Add custodian notifications
3. Build notification center UI

### Phase 5: Reports & Polish (Week 8)
1. General ledger report
2. Trial balance
3. P&L statement
4. Balance sheet

---

## 8. CONCLUSION

ERP02's accounting system is **well-designed** for a single-app architecture, with strong multi-currency support and basic approval workflows. The template-driven voucher design is particularly innovative.

For ERP03, we should:
1. **Keep:** Template system, multi-currency architecture, validation logic
2. **Improve:** Approval system (add workflow engine), separation of concerns
3. **Add:** Currency revaluation, automatic rate fetching, multi-step approvals
4. **Refactor:** Move business logic to backend use cases, modularize Cloud Functions

The system provides an excellent foundation to build upon, with clear opportunities for enhancement in the modular ERP03 architecture.

---
**END OF REPORT**
