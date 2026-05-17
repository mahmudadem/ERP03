# Feature 04: Audit Logs

## Overview
A centralized service for logging critical changes (status transitions, important field updates) across all business documents for SOX compliance and traceability.

## Entities

### `AuditLogEntry`
```typescript
{
  id: string;
  companyId: string;
  documentType: string; // e.g., 'SalesOrder', 'Item'
  documentId: string;
  action: 'CREATE' | 'UPDATE' | 'STATUS_CHANGE' | 'DELETE';
  userId: string; // User who made the change
  timestamp: Date;
  details: {
    field?: string;
    oldValue?: any;
    newValue?: any;
    statusFrom?: string;
    statusTo?: string;
    reason?: string;
  };
}
```

## Firestore Paths
- `companies/{companyId}/shared/Data/audit_logs`
  (Consider a separate collection per module if volume is high, but centralized is easier to query).

## Services
- `AuditLogService`
  - `logAction(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>)`
  - Run asynchronously or in background where possible to avoid slowing down transactions.

## Immutability Enforcement
The core service provides a decorator/middleware `assertMutable(document)` that throws an error if a document is in an immutable state (e.g., POSTED, CANCELLED).

## API Routes
- `GET /api/shared/audit-logs?documentType=X&documentId=Y` (Read-only)

## Frontend Pages
- **Shared Components:** A "History / Audit" tab or section added to Generic Form/Detail views that fetches and displays the change history for the current document.

## Verification
- [ ] Edit an approved PO. Ensure the status change to 'Draft' and the edited fields are logged.
- [ ] Verify logs are read-only to all users (including Super Admin).
