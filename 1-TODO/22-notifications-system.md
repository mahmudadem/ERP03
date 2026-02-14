# 22 — Notifications System

> **Priority:** P1 (tied to existing TODO #4)
> **Estimated Effort:** 3–5 days
> **Dependencies:** User & Role Management [21]
> **Source:** TODO item #4 — "check if notifications are working" + "dedicated section for notification settings"

---

## Problem Statement (from TODO)

> In Accounting Settings page we need a dedicated section for notifications settings, where we can enable or disable notifications and set the notification type. For example: email notifications, SMS notifications, push notifications.
> When system sends the notification? Those are options like when voucher is created, when voucher is approved, when voucher is posted.
> You must think of what we need as a product owner and not as a developer.

---

## Business-Driven Notification Requirements

As a **product owner** of an accounting ERP, here's when notifications add value:

### High-Value Notifications (Must-Have)

| Event | Who Gets Notified | Why |
|-------|-------------------|-----|
| **Voucher Pending Approval** | Approver(s) | They need to know there's work waiting for them |
| **Voucher Approved** | Voucher creator | Confirms their work was accepted |
| **Voucher Rejected** | Voucher creator | Needs to know to fix and resubmit |
| **Voucher Posted** | Voucher creator + approver | Confirmation of completion |
| **Period Closing Reminder** | All accountants | Monthly reminder before period deadline |
| **Budget Threshold Exceeded** | Department manager + finance head | Prevent overspending |
| **Large Transaction Alert** | Finance head / admin | Fraud prevention (amount > threshold) |

### Medium-Value Notifications

| Event | Who Gets Notified | Why |
|-------|-------------------|-----|
| **Custody Confirmation Required** | Custodian | Needs to confirm receipt of funds |
| **User Added to Company** | New user + admin | Welcome + audit trail |
| **Settings Changed** | All admins | Audit awareness |
| **Unbalanced Draft Warning** | Voucher creator | Reminder to fix before submission |

---

## Current State

- ✅ `NotificationsUseCase` exists in the backend
- ✅ Some notification triggers likely wired to workflow events
- ❌ No notification settings in Accounting Settings page
- ❌ No notification channel configuration (email, push, in-app)
- ❌ No notification preferences per user
- ❌ No notification center in the UI (bell icon with unread count)

---

## Requirements

### Functional

1. **Notification Settings Section** in Accounting Settings:
   - Enable/disable notifications globally
   - Per-event type toggle (email, push, in-app)
   - Threshold configuration (e.g., "Large Transaction" threshold amount)
   - Recipient configuration (role-based or specific users)

2. **Notification Channels:**
   - **In-App** (priority — always available): Bell icon in header, notification drawer, read/unread status
   - **Email** (secondary): Based on server-side email service (Firebase extensions or SendGrid)
   - **Push** (tertiary — future): Browser push notifications

3. **In-App Notification Center:**
   - Bell icon in the app header with unread count badge
   - Clicking opens a dropdown/drawer with recent notifications
   - Mark as read / mark all as read
   - Click notification → navigate to related item (e.g., voucher)

4. **User Preferences:**
   - Each user can choose which notification types they want
   - Has a "Notification Preferences" in their profile settings

---

## Data Model

### Notification Entity

```typescript
interface Notification {
  id: string;
  companyId: string;
  recipientUserId: string;
  type: NotificationType;
  title: string;
  message: string;
  data: {                    // Contextual data for navigation
    voucherId?: string;
    accountId?: string;
    link?: string;
  };
  channels: ('IN_APP' | 'EMAIL' | 'PUSH')[];
  isRead: boolean;
  createdAt: Date;
}

enum NotificationType {
  VOUCHER_PENDING_APPROVAL = 'VOUCHER_PENDING_APPROVAL',
  VOUCHER_APPROVED = 'VOUCHER_APPROVED',
  VOUCHER_REJECTED = 'VOUCHER_REJECTED',
  VOUCHER_POSTED = 'VOUCHER_POSTED',
  LARGE_TRANSACTION = 'LARGE_TRANSACTION',
  PERIOD_CLOSE_REMINDER = 'PERIOD_CLOSE_REMINDER',
  BUDGET_THRESHOLD = 'BUDGET_THRESHOLD',
  CUSTODY_REQUIRED = 'CUSTODY_REQUIRED',
  USER_ADDED = 'USER_ADDED',
  SETTINGS_CHANGED = 'SETTINGS_CHANGED'
}
```

### Notification Settings (per company)

```typescript
interface NotificationSettings {
  enabled: boolean;
  events: {
    [key in NotificationType]: {
      enabled: boolean;
      channels: ('IN_APP' | 'EMAIL' | 'PUSH')[];
      recipients: 'CREATOR' | 'APPROVERS' | 'ADMINS' | 'ALL' | string[];
      threshold?: number;  // For amount-based events
    }
  };
}
```

---

## Implementation Plan

### Step 1: Backend — Notification Entity + Repository

- `Notification.ts` entity
- `INotificationRepository.ts` interface
- `FirestoreNotificationRepository.ts` implementation
- Collection: `companies/{companyId}/notifications`

### Step 2: Backend — Notification Service

**File:** `backend/src/application/notifications/NotificationService.ts` (NEW or MODIFY)

```typescript
class NotificationService {
  async send(companyId: string, type: NotificationType, data: NotificationData): Promise<void> {
    // 1. Check company notification settings — is this event enabled?
    // 2. Determine recipients based on settings
    // 3. For each recipient:
    //    a. Create in-app notification record
    //    b. Send email if email channel enabled
    //    c. Send push if push channel enabled
  }
}
```

### Step 3: Wire Notification Triggers

Hook into existing voucher lifecycle events:
- `approveVoucher` → send VOUCHER_APPROVED to creator
- `sendToApproval` → send VOUCHER_PENDING_APPROVAL to approvers
- `rejectVoucher` → send VOUCHER_REJECTED to creator
- `postVoucher` → send VOUCHER_POSTED to creator + approver
- `createVoucher` → check if large transaction alert needed

### Step 4: Backend — Notification API

```
GET    /notifications                  — List user's notifications (paginated)
GET    /notifications/unread-count     — Get unread count
PUT    /notifications/:id/read         — Mark as read
PUT    /notifications/read-all         — Mark all as read
```

### Step 5: Frontend — Notification Center Component

**File:** `frontend/src/components/NotificationCenter.tsx` (NEW)

- Bell icon in the app header bar
- Red badge with unread count
- Click → dropdown with notification list
- Each notification: icon, title, time ago, click-to-navigate
- "Mark all as read" link
- Empty state: "You're all caught up!"

### Step 6: Frontend — Notification Settings Section

Add to `AccountingSettingsPage.tsx` (or new sub-component per plan #19):
- Per-event type toggles
- Channel selection per event
- Large transaction threshold input
- "Save Notification Settings" button

### Step 7: Frontend — User Notification Preferences

Add to user profile page:
- Toggle per notification type
- "Don't notify me about X"

---

## Verification Plan

### Manual
1. Open Settings → Notifications → Enable "Voucher Pending Approval" for in-app
2. Create a voucher and send to approval
3. Log in as the approver → verify bell icon shows unread count
4. Click bell → verify notification appears
5. Click the notification → verify it navigates to the voucher
6. Mark as read → verify count decreases
7. Approve the voucher → verify creator receives "Approved" notification

---

## Acceptance Criteria

- [ ] Notification settings section in accounting settings
- [ ] Per-event toggles for enable/disable
- [ ] In-app notification center (bell icon + dropdown)
- [ ] Unread count badge on bell icon
- [ ] Click notification navigates to related item
- [ ] Mark as read / mark all as read
- [ ] At least voucher workflow notifications wired up
- [ ] Large transaction alert configurable with threshold
- [ ] User can manage their own notification preferences
