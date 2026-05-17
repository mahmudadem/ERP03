# Manual Testing Guide: Enhanced Notifications System

This guide provides step-by-step instructions to manually test the newly integrated Notification Inbox, Notification Settings, and broadened triggers (e.g., Account Creation) within the ERP system.

## 1. Prerequisites and Setup
1. Standard user authentication into a valid Company.
2. The user has permissions `accounting.accounts.manage` to create accounts.
3. Open two browser tabs or browsers if you wish to verify Real-Time (WebSocket) behavior vs persistent notification fetching.

---

## 2. Test Cases

### Test Case 1: Account Creation Trigger (Broadened Trigger)
**Objective**: Verify that performing a trigger action (creating a new account) dispatches a system notification successfully and updates the bell in real-time.

1. Navigate to **Accounting > Chart of Accounts** (`/accounting/accounts`).
2. Click **Add Account**.
3. Fill out the "Create Account" modal with valid data (e.g., User Code: `TEST-NOTIF-99`, Name: `Notification Test Account`, Classification: `ASSET`).
4. Click **Create** or **Save**.
5. **Verify**:
    - Observe the top navigation bar. The **Notification Bell** badge count should increment immediately without needing a page refresh.
    - Click the **Notification Bell** to open the dropdown. You should see a new notification with:
        - A "SYSTEM" category badge.
        - Title: "Account Created".
        - Message: "Account TEST-NOTIF-99 (Notification Test Account) was successfully created."
        - A blue dot indicating it is unread.

### Test Case 2: Notification Bell Dropdown & "View All" Link
**Objective**: Verify the inline dropdown interaction works and properly redirects to the new Inbox page.

1. Ensure you have unread notifications (e.g., from Test Case 1).
2. Click the **Notification Bell** in the top navigation.
3. **Verify**:
    - Hovering over a notification changes its background styling correctly.
    - Clicking the notification itself marks it as read (the unread dot disappears), diminishes the red bell badge count, and redirects you to the Accounts page (or corresponding source URL).
4. Re-open the Notification Bell dropdown.
5. Click the "**View all notifications**" link at the very bottom of the dropdown list.
6. **Verify**:
    - You are navigated successfully to the new `/notifications` Inbox Page.

---

### Test Case 3: Notification Inbox Page Features
**Objective**: Validate the full-screen notifications manager functionality (reading, filtering, searching).

1. Navigate to the **Notifications Inbox** (`/notifications`).
2. **Verify Layout**: Look for the header containing your total unread count, the "Mark all as read" button, the Search bar, and the filter tabs (`ALL`, `UNREAD`, `READ`).
3. **Test Badges**:
    - The top UI should accurately display the count of all unread notifications.
4. **Test Filtering**:
    - Click the **UNREAD** tab. You should only see notifications with the glowing pulse dot.
    - Click the **READ** tab. You should see only dimmed notifications.
    - Click the **ALL** tab again.
5. **Test Search**:
    - Type "Account" into the search bar.
    - **Verify**: The list should instantly filter to only display notifications containing the word "Account" in their title, message, or category string.
6. **Test "Mark all as read"**:
    - Click the "**Mark all as read**" button in the top right.
    - **Verify**: All unread blue dots should vanish. The button itself should become disabled. The header text should update to "You have 0 unread notifications", and the red bubble on the top-nav bell should vanish.

---

### Test Case 4: Notification Settings Page (Opting out)
**Objective**: Ensure users can turn off specific notification categories, and the NotificationService honors those preferences.

1. Click on your profile icon in the top right and navigate to **Settings** -> **Notifications** (`/settings/notifications`).
2. **Verify Layout**: You should see different Event Categories (e.g., Financial Approvals, Custody Confirmations, System Info, System Warnings) with toggles.
3. Switch off the **System Info** toggle (this is the category used by the Account Creation trigger).
4. Click **Save Changes** at the top right.
5. **Verify**: A success toast should appear ("Notification settings saved successfully").
6. **Trigger the Event Again**:
    - Navigate back to **Accounting > Chart of Accounts**.
    - Add another new test account (e.g. `TEST-NOTIF-100`).
7. **Verify Skipping Logic**:
    - Observe the top navigation bar. The Notification Bell badge **should NOT** increment.
    - Open the Notification Bell dropdown. The new account creation event should **not** appear here because you opted out.
8. Un-toggle the preference in `/settings/notifications` and save it again to restore defaults.
