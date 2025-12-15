# ERP02 Accounting System - REVISED Analysis for ERP03

**Analysis Date:** December 15, 2025  
**Focus:** Simplicity, Auditability, Clarity over Complexity  
**Philosophy:** "Good accounting software is boring and predictable"

---

## EXECUTIVE SUMMARY

After reviewing ERP02 with a **simplicity-first lens**, we've identified a critical issue:

**The dynamic template system, while technically impressive, introduces unnecessary complexity that hurts auditability and maintainability.**

### Key Realizations:

❌ **REJECT:** Dynamic template-based journal generation  
❌ **REJECT:** Runtime rule evaluation for posting logic  
❌ **REJECT:** Complex workflow engines  
❌ **REJECT:** Field-based mapping and dynamic side determination  

✅ **KEEP (Simplified):** Multi-currency support with clear FX records  
✅ **KEEP (Simplified):** State-based approval (Draft → Pending → Approved → Locked)  
✅ **KEEP:** Protection mechanisms (base currency, used accounts)  
✅ **KEEP:** Audit trail and timestamping  

### Core Principle for ERP03:

> "Every voucher type should have explicit, hard-coded posting logic.  
> An accountant should be able to read the code and understand exactly what debits and credits will be posted."

---

## PART 1: WHAT TO REJECT FROM ERP02

### 1.1 The Template System (REJECT)

**What ERP02 Does:**
```typescript
// ERP02: Dynamic template with runtime evaluation
interface JournalTemplate {
  rules: Array<{
    side: 'debit' | 'credit' | 'fromField';
    sideFieldId?: string;
    accountSource: 'fixed' | 'userSelect' | 'fromField';
    accountFieldId?: string;
    amountSource: 'fromField';
    amountFieldId?: string;
  }>;
}

// At runtime, convert template to journal entries
voucherType.journalTemplate.rules.forEach(rule => {
  // Determine side from field data...
  let type = rule.side === 'fromField' 
    ? line[rule.sideFieldId]
    : rule.side;
    
  // Determine account from field data...
  let accountId = rule.accountSource === 'fromField'
    ? line[rule.accountFieldId]
    : rule.accountId;
});
```

**Why This is Bad for Accounting:**
1. 🔴 **Impossible to audit** - Can't trace what will be posted by reading code
2. 🔴 **Runtime complexity** - Posting logic determined at execution time
3. 🔴 **No static verification** - Can't validate posting rules at compile time
4. 🔴 **Debugging nightmare** - When posting is wrong, where do you look?
5. 🔴 **Training complexity** - New accountants can't understand the system

**What ERP03 Should Do Instead:**
```typescript
// ERP03: Explicit posting logic per voucher type
class PaymentVoucherHandler {
  async post(data: PaymentVoucherData): Promise<VoucherEntity> {
    // EXPLICIT and CLEAR - any accountant can read this
    const lines: JournalLine[] = [
      {
        accountId: data.cashAccountId,     // CREDIT: Cash/Bank
        type: 'Credit',
        amount: data.amount,
        notes: data.description
      },
      {
        accountId: data.expenseAccountId,   // DEBIT: Expense
        type: 'Debit',
        amount: data.amount,
        notes: data.description
      }
    ];
    
    return this.voucherRepository.save({
      type: 'PAYMENT',
      date: data.date,
      lines,
      currency: data.currency
    });
  }
}
```

**Benefits of Explicit Logic:**
✅ **Auditable** - Clear DR/CR for each voucher type  
✅ **Maintainable** - Find and fix bugs easily  
✅ **Testable** - Unit test each voucher type handler  
✅ **Documentable** - Code IS the documentation  
✅ **Trainable** - Junior developers can understand it  

### 1.2 Workflow Engine (REJECT)

**What I Proposed (WRONG):**
```typescript
// ❌ OVER-ENGINEERED
interface ApprovalWorkflow {
  steps: ApprovalStep[];
  rules: ApprovalRule[];
}

interface ApprovalRule {
  field: string;
  operator: string;
  value: any;
  action: 'require_approval' | 'auto_approve' | 'escalate';
}

const shouldInclude = this.evaluateCondition(step.condition, voucher);
```

**Why This is Bad:**
1. 🔴 **Over-engineering** - Most companies have simple approval needs
2. 🔴 **Runtime evaluation** - Can't predict who will approve what
3. 🔴 **Configuration hell** - Too many options = confusion
4. 🔴 **Debugging difficulty** - Why didn't this route to the right person?

**What ERP03 Should Do:**
```typescript
// ✅ SIMPLE: State-based approval
enum VoucherStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending',
  APPROVED = 'approved',
  LOCKED = 'locked',
  REJECTED = 'rejected'
}

// Simple configuration (optional)
interface ApprovalConfig {
  enabled: boolean;                    // Can disable for small companies
  autoApproveIfUserIsCustodian: boolean;  // Simple rule
  requiresApprovalAboveAmount?: number;   // Optional threshold
}

// Simple approval logic
class ApprovalService {
  async submitForApproval(voucherId: string): Promise<void> {
    const voucher = await this.repository.findById(voucherId);
    const config = await this.getCompanyApprovalConfig(voucher.companyId);
    
    if (!config.enabled) {
      // No approval needed - go straight to APPROVED
      await this.approveAutomatically(voucherId);
      return;
    }
    
    if (config.autoApproveIfUserIsCustodian) {
      const userIsCustodian = await this.checkIfUserIsCustodian(
        voucher.createdBy,
        voucher.lines.map(l => l.accountId)
      );
      
      if (userIsCustodian) {
        await this.approveAutomatically(voucherId);
        return;
      }
    }
    
    // Default: require manual approval
    await this.repository.updateStatus(voucherId, VoucherStatus.PENDING_APPROVAL);
    await this.notificationService.notifyApprovers(voucherId);
  }
  
  async approve(voucherId: string, approverId: string): Promise<void> {
    // Simple: just change status
    await this.repository.update(voucherId, {
      status: VoucherStatus.APPROVED,
      approvedBy: approverId,
      approvedAt: new Date()
    });
    
    await this.notificationService.notifyCreator(voucherId, 'approved');
  }
}
```

**Benefits:**
✅ **Predictable** - Clear state transitions  
✅ **Simple** - Two approval modes: auto or manual  
✅ **Traceable** - Easy audit trail  
✅ **Configurable** - But not over-configurable  

### 1.3 Multi-Line "fromField" Mapping (REJECT)

**What ERP02 Does:**
```typescript
// ❌ Too flexible - side can come from any field
rule.side = 'fromField';
rule.sideFieldId = 'lineType';  // Read from line.lineType

// Runtime: "Is this debit or credit? Check the field!"
let type = line[rule.sideFieldId];  // 'Debit' or 'Credit'
```

**Why This is Bad:**
- 🔴 Can't validate at compile time
- 🔴 Requires testing every possible field combination
- 🔴 Difficult to understand posting logic

**What ERP03 Should Do:**
```typescript
// ✅ Explicit: Journal Entry voucher with explicit lines
interface JournalEntryLine {
  accountId: string;
  debit: number;
  credit: number;
  notes: string;
}

class JournalEntryHandler {
  async post(data: JournalEntryData): Promise<VoucherEntity> {
    // Validate balance explicitly
    const totalDebit = data.lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = data.lines.reduce((sum, l) => sum + l.credit, 0);
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new ValidationError('Debit and credit must balance');
    }
    
    // EXPLICIT conversion to internal format
    const journalLines: JournalLine[] = [];
    
    data.lines.forEach((line, index) => {
      if (line.debit > 0) {
        journalLines.push({
          id: index + 1,
          accountId: line.accountId,
          type: 'Debit',
          amount: line.debit,
          notes: line.notes
        });
      }
      
      if (line.credit > 0) {
        journalLines.push({
          id: index + journalLines.length + 1,
          accountId: line.accountId,
          type: 'Credit',
          amount: line.credit,
          notes: line.notes
        });
      }
    });
    
    return this.voucherRepository.save({
      type: 'JOURNAL_ENTRY',
      date: data.date,
      description: data.description,
      lines: journalLines
    });
  }
}
```

**Benefits:**
✅ **Clear validation** - Balance check is explicit  
✅ **No magic** - Accountant sees exactly what's posted  
✅ **Type-safe** - TypeScript validates structure  

---

## PART 2: WHAT TO KEEP (SIMPLIFIED)

### 2.1 Multi-Currency (KEEP - Simplified)

**Good Parts from ERP02:**
1. ✅ Base currency concept
2. ✅ Exchange rate history
3. ✅ Currency protection (can't delete base or used currency)
4. ✅ FX metadata in voucher

**Simplifications for ERP03:**
```typescript
// SIMPLE: Voucher stores transaction currency
interface Voucher {
  id: string;
  date: string;
  currency: string;           // Transaction currency (e.g., "EUR")
  exchangeRate: number;       // Rate used for posting (EUR/USD)
  lines: VoucherLine[];
}

// SIMPLE: Each line stores BOTH transaction and base amounts
interface VoucherLine {
  accountId: string;
  type: 'Debit' | 'Credit';
  
  // Transaction currency (what user entered)
  amount: number;             // 100 EUR
  currency: string;           // "EUR"
  
  // Base currency (for accounting)
  baseAmount: number;         // 110 USD (if rate = 1.10)
  baseCurrency: string;       // "USD"
  
  // FX metadata
  exchangeRate: number;       // 1.10
}

// SIMPLE posting logic
class MultiCurrencyVoucherService {
  async post(data: VoucherData): Promise<VoucherEntity> {
    const company = await this.companyRepo.findById(data.companyId);
    const baseCurrency = company.baseCurrency;
    
    let exchangeRate = 1.0;
    
    if (data.currency !== baseCurrency) {
      // Get exchange rate for the transaction date
      exchangeRate = await this.exchangeRateService.getRate(
        data.companyId,
        data.currency,
        baseCurrency,
        data.date
      );
    }
    
    // Convert each line to base currency
    const lines = data.lines.map(line => ({
      ...line,
      amount: line.amount,
      currency: data.currency,
      baseAmount: line.amount * exchangeRate,
      baseCurrency: baseCurrency,
      exchangeRate: exchangeRate
    }));
    
    return this.voucherRepository.save({
      ...data,
      exchangeRate,
      lines
    });
  }
}
```

**Key Principles:**
1. **Always store both** - Transaction amount AND base amount
2. **Rate at transaction time** - Use rate from transaction date
3. **No revaluation complexity** - Keep it simple
4. **Clear audit trail** - Can see original amount and conversion

### 2.2 State-Based Approval (KEEP - Simplified)

```typescript
enum VoucherStatus {
  DRAFT = 'draft',           // Being created
  PENDING = 'pending',       // Awaiting approval
  APPROVED = 'approved',     // Approved and posted
  LOCKED = 'locked',         // Finalized, cannot edit
  REJECTED = 'rejected'      // Rejected with reason
}

// SIMPLE state transitions
const ALLOWED_TRANSITIONS: Record<VoucherStatus, VoucherStatus[]> = {
  [VoucherStatus.DRAFT]: [VoucherStatus.PENDING, VoucherStatus.APPROVED],
  [VoucherStatus.PENDING]: [VoucherStatus.APPROVED, VoucherStatus.REJECTED, VoucherStatus.DRAFT],
  [VoucherStatus.APPROVED]: [VoucherStatus.LOCKED, VoucherStatus.REJECTED],
  [VoucherStatus.LOCKED]: [],  // Cannot change
  [VoucherStatus.REJECTED]: [VoucherStatus.DRAFT]
};

class VoucherStatusService {
  async changeStatus(
    voucherId: string,
    newStatus: VoucherStatus,
    userId: string,
    reason?: string
  ): Promise<void> {
    const voucher = await this.repository.findById(voucherId);
    
    // Check if transition is allowed
    const allowedNext = ALLOWED_TRANSITIONS[voucher.status];
    if (!allowedNext.includes(newStatus)) {
      throw new ValidationError(
        `Cannot transition from ${voucher.status} to ${newStatus}`
      );
    }
    
    // Check permissions
    await this.checkUserCanChangeStatus(userId, voucher.companyId, newStatus);
    
    // Update status with audit trail
    await this.repository.update(voucherId, {
      status: newStatus,
      [`${newStatus}By`]: userId,
      [`${newStatus}At`]: new Date(),
      statusReason: reason || null
    });
    
    // Post to accounts if approved
    if (newStatus === VoucherStatus.APPROVED) {
      await this.accountingService.postVoucherToLedger(voucherId);
    }
  }
}
```

### 2.3 Protection Mechanisms (KEEP)

```typescript
// SIMPLE: Can't delete if used
class CurrencyService {
  async delete(companyId: string, currencyCode: string): Promise<void> {
    // Check if it's the base currency
    const company = await this.companyRepo.findById(companyId);
    if (company.baseCurrency === currencyCode) {
      throw new ValidationError('Cannot delete base currency');
    }
    
    // Check if used in any vouchers
    const usageCount = await this.voucherRepo.countByCurrency(
      companyId,
      currencyCode
    );
    
    if (usageCount > 0) {
      throw new ValidationError(
        `Cannot delete ${currencyCode} - used in ${usageCount} vouchers`
      );
    }
    
    await this.currencyRepo.delete(companyId, currencyCode);
  }
}

// SIMPLE: Can't delete account if used or has children
class AccountService {
  async delete(companyId: string, accountId: string): Promise<void> {
    const account = await this.repository.findById(accountId);
    
    // Check if it's a protected/system account
    if (account.isProtected) {
      throw new ValidationError('Cannot delete protected account');
    }
    
    // Check if it has child accounts
    const childCount = await this.repository.countChildren(accountId);
    if (childCount > 0) {
      throw new ValidationError(
        'Cannot delete account with child accounts'
      );
    }
    
    // Check if used in any transactions
    const transactionCount = await this.voucherRepo.countByAccount(
      companyId,
      accountId
    );
    
    if (transactionCount > 0) {
      throw new ValidationError(
        `Cannot delete account - used in ${transactionCount} transactions`
      );
    }
    
    await this.repository.delete(accountId);
  }
}
```

### 2.4 Audit Trail (KEEP - Enhanced)

```typescript
// SIMPLE: Track all changes
interface VoucherAudit {
  voucherId: string;
  timestamp: Date;
  userId: string;
  action: 'created' | 'updated' | 'approved' | 'rejected' | 'locked';
  changes?: Record<string, { old: any; new: any }>;
  reason?: string;
}

class AuditService {
  async logVoucherChange(
    voucherId: string,
    action: string,
    userId: string,
    changes?: any,
    reason?: string
  ): Promise<void> {
    await this.auditRepository.create({
      voucherId,
      timestamp: new Date(),
      userId,
      action,
      changes,
      reason
    });
  }
  
  async getVoucherHistory(voucherId: string): Promise<VoucherAudit[]> {
    return this.auditRepository.findByVoucherId(voucherId);
  }
}
```

---

## PART 3: SIMPLIFIED ARCHITECTURE FOR ERP03

### 3.1 Core Entities

```typescript
// VOUCHER: Core transaction document
interface Voucher {
  id: string;
  companyId: string;
  voucherNo: string;              // Auto-generated: "PAY-2025-001"
  type: VoucherType;              // Fixed enum, not dynamic
  date: string;                   // Transaction date
  description: string;
  
  // Currency
  currency: string;               // Transaction currency
  exchangeRate: number;           // Rate used
  
  // Status
  status: VoucherStatus;
  
  // Lines
  lines: VoucherLine[];
  
  // Calculated totals (in base currency)
  totalDebit: number;
  totalCredit: number;
  
  // Audit
  createdBy: string;
  createdAt: Date;
  submittedBy?: string;
  submittedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  statusReason?: string;
}

// VOUCHER LINE: Individual debit/credit entry
interface VoucherLine {
  id: number;
  accountId: string;
  type: 'Debit' | 'Credit';
  
  // Transaction currency
  amount: number;
  currency: string;
  
  // Base currency (for posting)
  baseAmount: number;
  baseCurrency: string;
  exchangeRate: number;
  
  notes?: string;
  costCenterId?: string;
}

// VOUCHER TYPE: Fixed enumeration
enum VoucherType {
  PAYMENT = 'payment',              // Pay supplier/expense
  RECEIPT = 'receipt',              // Receive from customer
  JOURNAL_ENTRY = 'journal_entry',  // Manual GL entry
  OPENING_BALANCE = 'opening_balance'
}
```

### 3.2 Voucher Handlers (Explicit Posting Logic)

```typescript
// INTERFACE: All voucher handlers implement this
interface IVoucherHandler {
  validate(data: any): Promise<void>;
  createLines(data: any): Promise<VoucherLine[]>;
}

// PAYMENT HANDLER
class PaymentVoucherHandler implements IVoucherHandler {
  async validate(data: PaymentData): Promise<void> {
    if (!data.cashAccountId) throw new ValidationError('Cash account required');
    if (!data.expenseAccountId) throw new ValidationError('Expense account required');
    if (data.amount <= 0) throw new ValidationError('Amount must be positive');
  }
  
  async createLines(data: PaymentData): Promise<VoucherLine[]> {
    const rate = await this.getExchangeRate(data);
    
    return [
      {
        id: 1,
        accountId: data.cashAccountId,
        type: 'Credit',
        amount: data.amount,
        currency: data.currency,
        baseAmount: data.amount * rate,
        baseCurrency: data.baseCurrency,
        exchangeRate: rate,
        notes: data.description
      },
      {
        id: 2,
        accountId: data.expenseAccountId,
        type: 'Debit',
        amount: data.amount,
        currency: data.currency,
        baseAmount: data.amount * rate,
        baseCurrency: data.baseCurrency,
        exchangeRate: rate,
        notes: data.description
      }
    ];
  }
}

// RECEIPT HANDLER
class ReceiptVoucherHandler implements IVoucherHandler {
  async validate(data: ReceiptData): Promise<void> {
    if (!data.cashAccountId) throw new ValidationError('Cash account required');
    if (!data.revenueAccountId) throw new ValidationError('Revenue account required');
    if (data.amount <= 0) throw new ValidationError('Amount must be positive');
  }
  
  async createLines(data: ReceiptData): Promise<VoucherLine[]> {
    const rate = await this.getExchangeRate(data);
    
    return [
      {
        id: 1,
        accountId: data.cashAccountId,
        type: 'Debit',
        amount: data.amount,
        currency: data.currency,
        baseAmount: data.amount * rate,
        baseCurrency: data.baseCurrency,
        exchangeRate: rate,
        notes: data.description
      },
      {
        id: 2,
        accountId: data.revenueAccountId,
        type: 'Credit',
        amount: data.amount,
        currency: data.currency,
        baseAmount: data.amount * rate,
        baseCurrency: data.baseCurrency,
        exchangeRate: rate,
        notes: data.description
      }
    ];
  }
}

// JOURNAL ENTRY HANDLER (for complex manual entries)
class JournalEntryHandler implements IVoucherHandler {
  async validate(data: JournalEntryData): Promise<void> {
    if (!data.lines || data.lines.length < 2) {
      throw new ValidationError('At least 2 lines required');
    }
    
    const totalDebit = data.lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = data.lines.reduce((sum, l) => sum + l.credit, 0);
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new ValidationError('Debits must equal credits');
    }
  }
  
  async createLines(data: JournalEntryData): Promise<VoucherLine[]> {
    const rate = await this.getExchangeRate(data);
    const lines: VoucherLine[] = [];
    let lineId = 1;
    
    for (const inputLine of data.lines) {
      if (inputLine.debit > 0) {
        lines.push({
          id: lineId++,
          accountId: inputLine.accountId,
          type: 'Debit',
          amount: inputLine.debit,
          currency: data.currency,
          baseAmount: inputLine.debit * rate,
          baseCurrency: data.baseCurrency,
          exchangeRate: rate,
          notes: inputLine.notes
        });
      }
      
      if (inputLine.credit > 0) {
        lines.push({
          id: lineId++,
          accountId: inputLine.accountId,
          type: 'Credit',
          amount: inputLine.credit,
          currency: data.currency,
          baseAmount: inputLine.credit * rate,
          baseCurrency: data.baseCurrency,
          exchangeRate: rate,
          notes: inputLine.notes
        });
      }
    }
    
    return lines;
  }
}

// FACTORY: Simple dispatcher
class VoucherHandlerFactory {
  private handlers: Map<VoucherType, IVoucherHandler>;
  
  constructor(
    private exchangeRateService: ExchangeRateService
  ) {
    this.handlers = new Map([
      [VoucherType.PAYMENT, new PaymentVoucherHandler(exchangeRateService)],
      [VoucherType.RECEIPT, new ReceiptVoucherHandler(exchangeRateService)],
      [VoucherType.JOURNAL_ENTRY, new JournalEntryHandler(exchangeRateService)]
    ]);
  }
  
  getHandler(type: VoucherType): IVoucherHandler {
    const handler = this.handlers.get(type);
    if (!handler) {
      throw new Error(`No handler for voucher type: ${type}`);
    }
    return handler;
  }
}
```

### 3.3 Main Save Use Case

```typescript
class SaveVoucherUseCase {
  constructor(
    private voucherRepository: IVoucherRepository,
    private handlerFactory: VoucherHandlerFactory,
    private numberGenerator: VoucherNumberGenerator,
    private approvalService: ApprovalService,
    private auditService: AuditService
  ) {}
  
  async execute(input: SaveVoucherInput): Promise<Voucher> {
    // 1. Get handler for voucher type
    const handler = this.handlerFactory.getHandler(input.type);
    
    // 2. Validate input
    await handler.validate(input.data);
    
    // 3. Create lines using handler
    const lines = await handler.createLines(input.data);
    
    // 4. Calculate totals
    const totalDebit = lines
      .filter(l => l.type === 'Debit')
      .reduce((sum, l) => sum + l.baseAmount, 0);
      
    const totalCredit = lines
      .filter(l => l.type === 'Credit')
      .reduce((sum, l) => sum + l.baseAmount, 0);
    
    // 5. Verify balance (safety check)
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new ValidationError('Internal error: voucher not balanced');
    }
    
    // 6. Generate voucher number
    const voucherNo = await this.numberGenerator.generate(
      input.companyId,
      input.type,
      input.data.date
    );
    
    // 7. Create voucher
    const voucher = await this.voucherRepository.save({
      companyId: input.companyId,
      voucherNo,
      type: input.type,
      date: input.data.date,
      description: input.data.description,
      currency: input.data.currency,
      exchangeRate: input.data.exchangeRate,
      status: VoucherStatus.DRAFT,
      lines,
      totalDebit,
      totalCredit,
      createdBy: input.userId,
      createdAt: new Date()
    });
    
    // 8. Log audit
    await this.auditService.logVoucherChange(
      voucher.id,
      'created',
      input.userId
    );
    
    // 9. Auto-submit if configured
    const config = await this.approvalService.getConfig(input.companyId);
    if (!config.enabled) {
      await this.approvalService.approveAutomatically(voucher.id, input.userId);
    }
    
    return voucher;
  }
}
```

---

## PART 4: UI/UX CONSIDERATIONS

### 4.1 Voucher Designer (For UX Only)

**Purpose:** Generate nice forms for data entry  
**NOT for:** Determining accounting logic

```typescript
// UI Configuration (NOT accounting logic)
interface VoucherFormConfig {
  type: VoucherType;
  title: string;
  fields: FormField[];
  layout: 'single' | 'multi-line';
}

interface FormField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'account-select' | 'currency';
  required: boolean;
  defaultValue?: any;
}

// Example: Payment form
const paymentFormConfig: VoucherFormConfig = {
  type: VoucherType.PAYMENT,
  title: 'Payment Voucher',
  layout: 'single',
  fields: [
    { id: 'date', label: 'Date', type: 'date', required: true },
    { id: 'cashAccountId', label: 'Pay From (Cash/Bank)', type: 'account-select', required: true },
    { id: 'expenseAccountId', label: 'Expense Account', type: 'account-select', required: true },
    { id: 'amount', label: 'Amount', type: 'number', required: true },
    { id: 'currency', label: 'Currency', type: 'currency', required: true },
    { id: 'description', label: 'Description', type: 'text', required: true }
  ]
};
```

**Key Point:** Form configuration is for UI only. The actual posting logic is in `PaymentVoucherHandler.createLines()`.

### 4.2 Separation of Concerns

```
┌─────────────────┐
│   UI Layer      │  ← Voucher Designer generates forms
│  (React Forms)  │  ← User enters data
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Use Case      │  ← Validates input
│  (SaveVoucher)  │  ← Delegates to handler
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Voucher Handler│  ← EXPLICIT posting logic
│  (Payment/etc)  │  ← Creates debit/credit lines
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Repository    │  ← Saves to database
│  (Persistence)  │
└─────────────────┘
```

---

## PART 5: MIGRATION FROM ERP02 TO ERP03

### 5.1 What to Migrate

| ERP02 Component | ERP03 Approach | Action |
|-----------------|----------------|--------|
| Template system | Handler classes | **Rewrite** with explicit logic |
| Multi-currency | Same concept | **Simplify** - remove FX revaluation |
| Approval flow | State-based | **Keep** simplified version |
| Custodian system | Same | **Keep** as-is |
| Notifications | Same | **Keep** simplified |
| Protection logic | Same | **Keep** as-is |
| Audit trail | Enhanced | **Keep** and improve |

### 5.2 Migration Steps

**Phase 1: Core Entities (Week 1)**
1. Define Voucher, VoucherLine entities
2. Create repository interfaces
3. Implement Firestore repositories
4. Add migrations for existing data

**Phase 2: Handlers (Week 2)**
1. Implement PaymentVoucherHandler
2. Implement ReceiptVoucherHandler
3. Implement JournalEntryHandler
4. Write unit tests for each

**Phase 3: Use Cases (Week 3)**
1. Implement SaveVoucherUseCase
2. Implement ApproveVoucherUseCase
3. Implement GetVoucherUseCase
4. Implement DeleteVoucherUseCase

**Phase 4: Multi-Currency (Week 4)**
1. Implement ExchangeRateService
2. Add currency conversion in handlers
3. Create exchange rate management UI
4. Test with multiple currencies

**Phase 5: Approval (Week 5)**
1. Implement ApprovalService
2. Add status change logic
3. Wire up notifications
4. Test approval workflows

**Phase 6: UI (Week 6)**
1. Create voucher form components
2. Implement account selector
3. Add validation feedback
4. Create voucher list view

**Phase 7: Reports (Week 7)**
1. General Ledger report
2. Trial Balance
3. Account Statement
4. Voucher Register

---

## PART 6: KEY PRINCIPLES FOR ERP03

### 6.1 The Accounting Principles

1. **Explicit Over Implicit**
   - Code should read like accounting textbook
   - No hidden logic or magic
   
2. **Static Over Dynamic**
   - Posting rules at compile time
   - No runtime evaluation
   
3. **Simple Over Clever**
   - State-based approval
   - No complex workflows
   
4. **Auditable Over Flexible**
   - Every transaction traceable
   - Clear audit trail
   
5. **Clear Over Configurable**
   - Reduce configuration options
   - Make sensible defaults

### 6.2 What "Boring" Means (And Why It's Good)

```typescript
// BORING (GOOD):
const lines = [
  { accountId: cashAccount, type: 'Credit', amount: 100 },
  { accountId: expenseAccount, type: 'Debit', amount: 100 }
];

// CLEVER (BAD):
const lines = template.rules.map(rule => ({
  accountId: rule.source === 'field' ? data[rule.fieldId] : rule.accountId,
  type: rule.sideSource === 'field' ? data[rule.sideField] : rule.side,
  amount: rule.amountSource === 'field' ? data[rule.amountField] : data.amount
}));
```

**Why Boring is Better:**
- ✅ Junior developer can understand it in 5 seconds
- ✅ Auditor can verify it's correct
- ✅ When it breaks, fix is obvious
- ✅ Unit test is straightforward
- ✅ Documentation is the code itself

### 6.3 When to Say No

Say **NO** to:
- ❌ "Can we make posting logic configurable?"
- ❌ "Can we add conditional routing?"
- ❌ "Can we support multi-level approvals?"
- ❌ "Can we add workflow templates?"
- ❌ "Can we make this more flexible?"

Say **YES** to:
- ✅ "Can we make this more explicit?"
- ✅ "Can we improve the audit trail?"
- ✅ "Can we add better validation?"
- ✅ "Can we simplify this logic?"
- ✅ "Can we make errors clearer?"

---

## PART 7: ENHANCEMENTS (SIMPLE ONES)

### 7.1 Exchange Rate Fetching (ACCEPTABLE)

```typescript
// SIMPLE: Fetch rates from external provider
interface ExchangeRateProvider {
  fetchRate(from: string, to: string, date: string): Promise<number>;
}

class ExchangeRateService {
  constructor(
    private repository: IExchangeRateRepository,
    private provider: ExchangeRateProvider  // e.g., European Central Bank
  ) {}
  
  async getRate(
    companyId: string,
    from: string,
    to: string,
    date: string
  ): Promise<number> {
    // Try local database first
    const storedRate = await this.repository.findRate(companyId, from, to, date);
    if (storedRate) return storedRate.rate;
    
    // Fetch from external provider
    const rate = await this.provider.fetchRate(from, to, date);
    
    // Store for future use
    await this.repository.saveRate({
      companyId,
      fromCurrency: from,
      toCurrency: to,
      date,
      rate,
      source: 'automatic'
    });
    
    return rate;
  }
}
```

**Why This is OK:**
- ✅ Doesn't complicate posting logic
- ✅ Makes life easier for users
- ✅ Still auditable (rate stored in DB)

### 7.2 Bulk Import (ACCEPTABLE)

```typescript
// SIMPLE: Import multiple vouchers
class BulkVoucherImportService {
  async import(
    companyId: string,
    userId: string,
    data: VoucherImportRow[]
  ): Promise<BulkImportResult> {
    const results: BulkImportResult = {
      success: [],
      failed: []
    };
    
    for (const row of data) {
      try {
        // Use same handler as manual entry
        const handler = this.handlerFactory.getHandler(row.type);
        await handler.validate(row);
        
        const lines = await handler.createLines(row);
        const voucher = await this.saveVoucher({ ...row, lines });
        
        results.success.push(voucher.id);
      } catch (error) {
        results.failed.push({
          row: row.rowNumber,
          error: error.message
        });
      }
    }
    
    return results;
  }
}
```

**Why This is OK:**
- ✅ Reuses same validation/posting logic
- ✅ No special rules for bulk
- ✅ Each voucher still auditable

### 7.3 Recurring Vouchers (ACCEPTABLE)

```typescript
// SIMPLE: Schedule recurring vouchers
interface RecurringVoucher {
  id: string;
  companyId: string;
  template: VoucherData;      // Template for creating vouchers
  frequency: 'monthly' | 'quarterly' | 'yearly';
  startDate: string;
  endDate?: string;
  nextRunDate: string;
}

class RecurringVoucherService {
  async createRecurringSchedule(
    template: VoucherData,
    frequency: string,
    startDate: string
  ): Promise<RecurringVoucher> {
    // Save template
    return this.repository.save({
      template,
      frequency,
      startDate,
      nextRunDate: startDate
    });
  }
  
  async processRecurring(scheduleId: string): Promise<Voucher> {
    const schedule = await this.repository.findById(scheduleId);
    
    // Create voucher using SAME logic as manual entry
    const voucher = await this.saveVoucherUseCase.execute({
      ...schedule.template,
      date: schedule.nextRunDate
    });
    
    // Update next run date
    await this.repository.update(scheduleId, {
      nextRunDate: this.calculateNextDate(
        schedule.nextRunDate,
        schedule.frequency
      )
    });
    
    return voucher;
  }
}
```

**Why This is OK:**
- ✅ Automation, not logic change
- ✅ Creates regular vouchers (auditable)
- ✅ Can review before posting

---

## CONCLUSION

### What We Learned from ERP02

**Good Ideas:**
1. ✅ Multi-currency with base currency concept
2. ✅ Protection mechanisms (can't delete used items)
3. ✅ State-based approval
4. ✅ Custodian notifications
5. ✅ Audit trail

**Bad Ideas:**
1. ❌ Dynamic template-based posting
2. ❌ Runtime rule evaluation
3. ❌ Field-based mapping
4. ❌ Complex workflow engines
5. ❌ Over-configuration

### Core Philosophy for ERP03

> **"Make accounting software that accountants can audit by reading the code."**

This means:
- Explicit posting logic per voucher type
- Simple state-based approval
- Clear, traceable audit trail
- Predictable behavior
- Minimal configuration

### The Test

If you can't answer these questions by reading the code, it's too complex:

1. "What debits and credits will this create?"
2. "Why was this posted to that account?"
3. "Who approved this and when?"
4. "What rate was used for this FX transaction?"
5. "Can I delete this account?"

**In ERP03, all these questions should have clear, obvious answers.**

---
**END OF REVISED ANALYSIS**
