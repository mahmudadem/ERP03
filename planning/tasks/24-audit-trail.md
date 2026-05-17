# 24 — Audit Trail / Activity Log

> **Priority:** P1 (Required for accounting compliance)
> **Estimated Effort:** 3–5 days
> **Dependencies:** None
> **Source:** Final Audit — GAP C

---

## Business Context

Every accounting system must answer the **auditor's questions**:
- Who created this voucher? When?
- Who approved it and when?
- Was it modified after posting? By whom?
- What settings were changed and when?
- Who deleted this draft and why?

Without an immutable audit trail, the system **cannot pass an audit** and is not suitable for production use.

---

## Current State

- ✅ `IAuditLogRepository` interface exists in `repository/interfaces/system/`
- ✅ `diContainer.auditLogRepository` is registered in DI container
- ✅ `VoucherEntity` tracks `createdBy`, `approvedBy` timestamps
- ❌ No centralized audit log collection/table
- ❌ No change tracking (before/after values)
- ❌ No audit log viewer in the UI
- ❌ No audit log writing from use-cases
- ❌ `IAuditLogRepository` implementation status unknown (may be a stub)

---

## Architecture: SQL Migration Ready

This plan follows the existing repository pattern:
1. **Interface:** `IAuditLogRepository` (already exists — verify and extend if needed)
2. **Firestore implementation:** `FirestoreAuditLogRepository` (append-only collection)
3. **SQL implementation (future):** `PrismaAuditLogRepository` with an `audit_logs` table

The audit trail must be designed so that:
- Data model maps cleanly to both Firestore documents and SQL rows
- No Firestore-specific features are used (no sub-collections for the audit log itself)
- Queries are expressible in both Firestore and SQL (by entity, by user, by date range)

---

## Data Model

```typescript
interface AuditLogEntry {
  id: string;
  companyId: string;
  
  // WHO
  userId: string;
  userName: string;         // Denormalized for quick display
  
  // WHAT
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityLabel?: string;     // e.g., "JV-0001" or "Cash Account"
  
  // WHEN
  timestamp: Date;
  
  // DETAILS
  changes?: AuditChange[];  // Before/after for updates
  metadata?: Record<string, any>; // Additional context
}

enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  POST = 'POST',
  REVERSE = 'REVERSE',
  SUBMIT = 'SUBMIT',
  CANCEL = 'CANCEL',
  SETTINGS_CHANGE = 'SETTINGS_CHANGE',
  LOGIN = 'LOGIN',
  EXPORT = 'EXPORT'
}

enum AuditEntityType {
  VOUCHER = 'VOUCHER',
  ACCOUNT = 'ACCOUNT',
  COST_CENTER = 'COST_CENTER',
  SETTINGS = 'SETTINGS',
  USER = 'USER',
  ROLE = 'ROLE',
  EXCHANGE_RATE = 'EXCHANGE_RATE',
  FISCAL_YEAR = 'FISCAL_YEAR'
}

interface AuditChange {
  field: string;
  oldValue: any;
  newValue: any;
}
```

### Firestore Collection Structure
```
companies/{companyId}/audit-logs/{logId}
```

### SQL Table (future migration)
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  user_id UUID NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  entity_label VARCHAR(255),
  changes JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_company_entity ON audit_logs(company_id, entity_type, entity_id);
CREATE INDEX idx_audit_company_user ON audit_logs(company_id, user_id);
CREATE INDEX idx_audit_company_date ON audit_logs(company_id, created_at DESC);
```

---

## Implementation Plan

### Step 1: Verify & Extend IAuditLogRepository Interface

**File:** `backend/src/repository/interfaces/system/IAuditLogRepository.ts` (VERIFY/MODIFY)

Ensure it has:
```typescript
export interface IAuditLogRepository {
  log(entry: AuditLogEntry): Promise<void>;
  findByEntity(companyId: string, entityType: string, entityId: string): Promise<AuditLogEntry[]>;
  findByUser(companyId: string, userId: string, limit?: number): Promise<AuditLogEntry[]>;
  findByDateRange(companyId: string, from: Date, to: Date, limit?: number): Promise<AuditLogEntry[]>;
  findRecent(companyId: string, limit?: number): Promise<AuditLogEntry[]>;
}
```

### Step 2: Implement FirestoreAuditLogRepository

**File:** `backend/src/infrastructure/firestore/repositories/system/FirestoreAuditLogRepository.ts` (NEW or MODIFY)

- Append-only writes (no update/delete methods)
- Collection: `companies/{companyId}/audit-logs`
- Ordered by `timestamp DESC`

### Step 3: Create AuditService

**File:** `backend/src/application/common/services/AuditService.ts` (NEW)

Central service that all use-cases call:
```typescript
class AuditService {
  constructor(private auditRepo: IAuditLogRepository) {}

  async logAction(params: {
    companyId: string;
    userId: string;
    userName: string;
    action: AuditAction;
    entityType: AuditEntityType;
    entityId: string;
    entityLabel?: string;
    changes?: AuditChange[];
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.auditRepo.log({
      id: generateId(),
      ...params,
      timestamp: new Date()
    });
  }
}
```

### Step 4: Wire into Existing Use-Cases

Add `auditService.logAction(...)` calls to:
- `VoucherUseCases.ts` → CREATE, UPDATE, DELETE
- `VoucherApprovalUseCases.ts` → APPROVE, REJECT
- `SubmitVoucherUseCase.ts` → SUBMIT
- `ReverseAndReplaceVoucherUseCase.ts` → REVERSE
- `AccountUseCases.ts` → CREATE, UPDATE, DELETE
- `SettingsController.ts` → SETTINGS_CHANGE

### Step 5: API Endpoints

```
GET /audit-logs?entityType=VOUCHER&entityId=xxx  — By entity
GET /audit-logs?userId=xxx                        — By user
GET /audit-logs?from=xxx&to=xxx                   — By date range
GET /audit-logs/recent                            — Recent activity
```

Permission: `system.audit.view` (admin only)

### Step 6: Frontend — Audit Log Viewer

**File:** `frontend/src/modules/settings/pages/AuditLogPage.tsx` (NEW)

- Table: Timestamp | User | Action | Entity | Details
- Filters: Date range, User, Entity Type, Action Type
- Click row to expand and see field-level changes
- Export to CSV

Also add a small "Activity" tab on individual voucher/account detail pages showing that entity's audit log.

---

## Verification Plan

### Manual
1. Create a new voucher → verify an audit log entry appears
2. Approve the voucher → verify APPROVE log entry
3. Post the voucher → verify POST log entry
4. Change a setting → verify SETTINGS_CHANGE log entry
5. Navigate to Audit Log page → verify all entries visible
6. Filter by entity type → verify filtering works
7. Click a row → verify change details shown

---

## Acceptance Criteria

- [ ] All voucher lifecycle actions logged (CREATE, UPDATE, DELETE, APPROVE, REJECT, POST, REVERSE)
- [ ] Settings changes logged with before/after values
- [ ] Audit log is append-only (no update/delete)
- [ ] Audit log viewer accessible to admins
- [ ] Filterable by entity, user, date range
- [ ] Change details show field-level before/after values
- [ ] Repository interface supports both Firestore and future SQL implementation
- [ ] No performance degradation (audit writes are fire-and-forget / async)
