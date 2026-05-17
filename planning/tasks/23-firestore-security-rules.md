# 23 — Firestore Security Rules (Production-Ready)

> **Priority:** P0 (CRITICAL — Before any other work)
> **Estimated Effort:** 1–2 days
> **Dependencies:** None
> **Source:** Final Audit — GAP A

---

## Problem Statement

The current `firestore.rules` allows **all reads and writes** for anyone with the database reference, gated only by an expiry timestamp:

```
allow read, write: if request.time < timestamp.date(2026, 6, 1);
```

This means:
- ❌ Any authenticated user can read/write ANY company's data
- ❌ No tenant isolation at the database level
- ❌ No role-based access enforcement at the data layer
- ❌ A single compromised API key exposes all customer data

> [!CAUTION]
> This is the single largest security vulnerability in the system. No other feature work matters if data is unprotected.

---

## Current Architecture Context

The system uses Firestore with this collection structure (observed from repository implementations):
- `companies/{companyId}/...` — Company-scoped data
- `companies/{companyId}/vouchers/{voucherId}` — Vouchers
- `companies/{companyId}/accounts/{accountId}` — Chart of Accounts
- `companies/{companyId}/ledger/{entryId}` — Ledger entries
- `users/{userId}` — User profiles
- `system/...` — System-level configs

The backend accesses Firestore via **Admin SDK** (which bypasses rules). Rules only matter for:
1. Direct client-side Firestore access (currently none, but should still be locked down)
2. Defense-in-depth — even if Admin SDK is compromised, rules add a second barrier

> [!IMPORTANT]
> Since the project is **migration-ready for SQL**, Firestore rules are a Firestore-specific concern. The equivalent in SQL would be row-level security (RLS) policies. This plan addresses the Firestore side only.

---

## Requirements

### Functional
1. **Deny all by default** — No access unless explicitly granted
2. **Company-scoped tenant isolation** — Users can only access data for companies they belong to
3. **User profile access** — Users can read/write their own profile
4. **System data** — Read-only for authenticated users, write for super-admins
5. **Admin-managed data** — Company admins can manage settings within their company

### SQL Migration Note
- When migrating to SQL, implement equivalent PostgreSQL Row-Level Security (RLS) policies:
  - `CREATE POLICY company_isolation ON vouchers USING (company_id = current_setting('app.company_id'))`
  - This is a separate migration-time task; the current plan covers Firestore only

---

## Implementation Plan

### Step 1: Define Security Rules

**File:** `firestore.rules` (REPLACE entirely)

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // DENY ALL by default
    match /{document=**} {
      allow read, write: if false;
    }

    // USER PROFILES
    // Users can read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // COMPANY DATA
    // Only company members can access company data
    match /companies/{companyId} {
      allow read: if isCompanyMember(companyId);

      // Settings — only company owner or admin
      allow write: if isCompanyAdmin(companyId);

      // All sub-collections within a company
      match /{subcollection}/{docId} {
        allow read: if isCompanyMember(companyId);
        allow write: if isCompanyMember(companyId);
      }

      // Deep sub-collections (e.g., voucher lines)
      match /{subcollection}/{docId}/{subSubcollection}/{subDocId} {
        allow read: if isCompanyMember(companyId);
        allow write: if isCompanyMember(companyId);
      }
    }

    // SYSTEM CONFIGURATION (super-admin)
    match /system/{document=**} {
      allow read: if request.auth != null;
      allow write: if false; // Admin SDK only
    }

    // Helper functions
    function isCompanyMember(companyId) {
      return request.auth != null &&
        exists(/databases/$(database)/documents/companies/$(companyId)/users/$(request.auth.uid));
    }

    function isCompanyAdmin(companyId) {
      return request.auth != null &&
        get(/databases/$(database)/documents/companies/$(companyId)/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

### Step 2: Update Storage Rules

**File:** `storage.rules` (REPLACE entirely)

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    // Company files — only company members
    match /companies/{companyId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }

    // Deny everything else
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

### Step 3: Test Rules with Firebase Emulator

```bash
firebase emulators:start --only firestore
# Run the rules test suite
```

---

## Verification Plan

### Manual
1. Deploy rules to emulator
2. Try to read company A's data while authenticated as a user NOT in company A → should fail
3. Try to read company A's data while authenticated as a user IN company A → should succeed
4. Try to write to `/system/` → should fail (Admin SDK only)
5. Try to read your own `/users/{uid}` → should succeed
6. Try to read another user's `/users/{otherUid}` → should fail

---

## Acceptance Criteria

- [ ] Default deny on all paths
- [ ] Company data only accessible by company members
- [ ] User profiles only accessible by the owning user
- [ ] System data read-only for authenticated users
- [ ] Storage rules allow company-scoped file access
- [ ] All existing functionality still works (Admin SDK bypasses rules)
- [ ] Rules tested with Firebase emulator
