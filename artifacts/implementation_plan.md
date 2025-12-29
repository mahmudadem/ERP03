# Refactor Accounting Settings to Vertical Layout

Reorganize the Accounting Settings page to use a vertical sidebar for navigation, providing a more granular and organized "IDE-like" experience.

## Proposed Changes

### [Component] Accounting Settings Page
Refactor the UI structure and tab management.

#### [MODIFY] [AccountingSettingsPage.tsx](file:///c:/Users/mahmu/OneDrive/Desktop/ERP03-github/ERP03/frontend/src/modules/accounting/pages/AccountingSettingsPage.tsx)
- **Granular Tabs**: Split the massive "Policy Configuration" tab into smaller, focused tabs:
    1.  **General Settings** (Core settings: Timezone, Date Format, UI Mode)
    2.  **Policy Configuration** (Base accounting policies: Period Lock, Account Access)
    3.  **Approval System** (Voucher approval rules)
    4.  **Cost Center Required** (Cost center enforcement logic)
    5.  **Policy Error Mode** (How validation errors are handled)
    6.  **Fiscal Year** (Financial period settings)
- **Vertical Sidebar**: 
    - Implement a left-anchored sidebar for tab navigation.
    - Use a clean, minimal design with icons (IDE-style).
- **Main Content Area**:
    - Display settings for the active tab in the main section.
    - Maintain the "Save Settings" button at the bottom/top of the content area.

## Verification Plan

### Manual Verification
1. Navigate to `/accounting/settings`.
2. Verify the vertical sidebar is on the left.
3. Click through each tab (General, Policy, Approval, etc.) and ensure content changes correctly.
4. Verify that the "Save Settings" button still persists changes to both Core and Policy APIs.
5. Check responsiveness on smaller screens (sidebar might collapse or stack).
