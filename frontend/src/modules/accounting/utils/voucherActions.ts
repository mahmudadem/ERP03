/**
 * voucherActions.ts
 * 
 * ══════════════════════════════════════════════════════════════════
 *  SINGLE SOURCE OF TRUTH for voucher action visibility & state
 * ══════════════════════════════════════════════════════════════════
 * 
 * Every voucher view (VoucherTable, VoucherEntryModal, VoucherWindow)
 * MUST use getVoucherActions() to determine which buttons to show.
 * 
 * This ensures that if a business rule changes (e.g., "only show 
 * Reverse if voucher is posted AND not already reversed"), 
 * you update it in ONE place and it propagates everywhere.
 * 
 * RULES IMPLEMENTED:
 * - PRINT:            Always available if voucher has an ID
 * - EDIT:             Not if posted+strict, not if cancelled, not if reversal child
 * - SAVE:             Available for draft/rejected (strict), or draft/pending/approved (flexible)
 * - SUBMIT:           Strict mode only, for draft/rejected vouchers
 * - APPROVE:          Only for pending vouchers with pendingFinancialApproval flag
 * - CONFIRM_CUSTODY:  Only for pending vouchers where current user is a pending custodian
 * - REJECT:           Only for pending vouchers
 * - POST:             Only for approved vouchers that are NOT yet posted
 * - CANCEL:           Only for draft/approved vouchers that are NOT posted
 * - REVERSE:          Only for posted vouchers that are NOT already reversed and NOT reversals themselves
 * - REVERSE_AND_REPLACE: Same as REVERSE but only in flexible mode
 * - DELETE:           Only if not posted+strict-locked, not if cancelled
 * - NEW:              Always available
 */

export type VoucherActionType = 
  | 'PRINT'
  | 'EDIT' 
  | 'SAVE' 
  | 'SUBMIT' 
  | 'APPROVE' 
  | 'REJECT' 
  | 'CONFIRM_CUSTODY' 
  | 'POST' 
  | 'CANCEL' 
  | 'REVERSE' 
  | 'REVERSE_AND_REPLACE' 
  | 'DELETE' 
  | 'NEW';

export type ActionVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'purple' | 'amber';

/** Where the action should appear in UI */
export type ActionPlacement = 'primary' | 'dropdown';

export interface VoucherActionDefinition {
  type: VoucherActionType;
  label: string;
  /** Lucide icon component name */
  icon: string;
  variant: ActionVariant;
  /** Action button is rendered but greyed out */
  isEnabled: boolean;
  /** Action button is completely hidden */
  isHidden: boolean;
  /** Tooltip text */
  tooltip?: string;
  /** Where this action should appear in the table row */
  placement: ActionPlacement;
}

export interface VoucherActionContext {
  /** The voucher data (status, metadata, postedAt, etc.) */
  voucher: any;
  /** Company accounting settings */
  settings: any;
  /** Current authenticated user */
  user: any;
  /** Whether this is a nested/child row (e.g., a reversal shown under its parent) */
  isNested?: boolean;
}

/**
 * Returns the complete list of available actions for a voucher.
 * 
 * Components should filter by `!isHidden` to get visible actions,
 * then use `placement` to decide where to render them.
 */
export const getVoucherActions = (ctx: VoucherActionContext): VoucherActionDefinition[] => {
  const { voucher, settings, user, isNested = false } = ctx;
  
  if (!voucher) return [];

  // ── Derived state ──────────────────────────────────────────────
  const status = (voucher.status || 'draft').toLowerCase();
  const isPosted = !!voucher.postedAt;
  const isCancelled = status === 'cancelled' || status === 'void';
  const metadata = voucher.metadata || {};
  const isStrict = settings?.strictApprovalMode ?? true;
  const isReversal = voucher.type === 'REVERSAL' || !!metadata?.isReversal;
  const isAlreadyReversed = !!metadata?.reversedByVoucherId || !!metadata?.isReversed;
  const hasId = !!voucher.id;
  const isStrictLocked = voucher.postingLockPolicy === 'STRICT_LOCKED';
  
  // Pending gates
  const isPendingFinancial = !!metadata?.pendingFinancialApproval;
  const pendingCustodians: string[] = metadata?.pendingCustodyConfirmations || [];
  const isUserCustodian = pendingCustodians.some((id: string) => 
    id.toLowerCase() === user?.uid?.toLowerCase() || 
    (user?.email && id.toLowerCase() === user.email.toLowerCase())
  );

  // ── Action definitions ─────────────────────────────────────────
  const actions: VoucherActionDefinition[] = [];

  // 1. PRINT — Always visible as primary icon
  actions.push({
    type: 'PRINT',
    label: 'Print',
    icon: 'Printer',
    variant: 'secondary',
    isEnabled: hasId,
    isHidden: false,
    tooltip: 'View Official / Print',
    placement: 'primary'
  });

  // 2. APPROVE — Primary button, shown only when pending + financial approval needed
  actions.push({
    type: 'APPROVE',
    label: 'Approve',
    icon: 'CheckCircle',
    variant: 'success',
    isEnabled: isPendingFinancial,
    isHidden: status !== 'pending' || isNested,
    tooltip: 'Approve / Verify',
    placement: 'primary'
  });

  // 3. CONFIRM_CUSTODY — Primary button, shown only when pending + user is custodian
  actions.push({
    type: 'CONFIRM_CUSTODY',
    label: 'Confirm Custody',
    icon: 'Check',
    variant: 'purple',
    isEnabled: isUserCustodian,
    isHidden: status !== 'pending' || !metadata?.custodyConfirmationRequired || isNested,
    tooltip: 'Confirm Custody',
    placement: 'primary'
  });

  // 4. POST — Primary button, shown for approved+unposted
  actions.push({
    type: 'POST',
    label: 'Post to Ledger',
    icon: 'CheckCircle',
    variant: 'success',
    isEnabled: true,
    isHidden: status !== 'approved' || isPosted || isNested,
    tooltip: 'Post to Ledger',
    placement: 'primary'
  });

  // ── DROPDOWN (Secondary) actions ───────────────────────────────

  // 5. EDIT — Dropdown
  actions.push({
    type: 'EDIT',
    label: 'Edit Voucher',
    icon: 'Edit',
    variant: 'secondary',
    isEnabled: !isStrictLocked && !isNested,
    isHidden: isCancelled,
    tooltip: 'Edit Voucher',
    placement: 'dropdown'
  });

  // 6. SAVE — Only relevant in detail views (Modal/Window), hidden in table
  const canSave = !isCancelled && (
    isStrict 
      ? (status === 'draft' || status === 'rejected')
      : (status === 'draft' || status === 'pending' || status === 'approved' || status === 'rejected')
  );
  actions.push({
    type: 'SAVE',
    label: isStrict ? 'Save as Draft' : (isPosted ? 'Update & Post' : 'Save & Post'),
    icon: isStrict ? 'Save' : 'CheckCircle',
    variant: isStrict ? 'secondary' : 'success',
    isEnabled: canSave,
    isHidden: !canSave || isCancelled,
    tooltip: isStrict ? 'Save as Draft' : 'Save and auto-post',
    placement: 'dropdown'
  });

  // 7. SUBMIT — Only for strict mode, draft/rejected vouchers
  actions.push({
    type: 'SUBMIT',
    label: 'Submit for Approval',
    icon: 'Send',
    variant: 'primary',
    isEnabled: status === 'draft' || status === 'rejected',
    isHidden: !isStrict || (status !== 'draft' && status !== 'rejected') || isCancelled,
    tooltip: 'Submit for approval workflow',
    placement: 'dropdown'
  });

  // 8. REJECT — Dropdown, for pending vouchers
  actions.push({
    type: 'REJECT',
    label: 'Reject',
    icon: 'Ban',
    variant: 'danger',
    isEnabled: true,
    isHidden: status !== 'pending' || isNested,
    tooltip: 'Reject approval',
    placement: 'dropdown'
  });

  // 9. CANCEL / VOID — Dropdown, for draft/approved that are not posted
  actions.push({
    type: 'CANCEL',
    label: 'Cancel / Void',
    icon: 'Ban',
    variant: 'amber',
    isEnabled: true,
    isHidden: isPosted || isCancelled || (status !== 'draft' && status !== 'approved') || isNested,
    tooltip: 'Cancel / Void Voucher',
    placement: 'dropdown'
  });

  // 10. REVERSE — Dropdown, for posted vouchers that aren't already reversed
  actions.push({
    type: 'REVERSE',
    label: isAlreadyReversed ? 'Already Reversed' : 'Reverse Voucher',
    icon: 'RotateCcw',
    variant: 'amber',
    isEnabled: !isAlreadyReversed && !isReversal,
    isHidden: !isPosted || isCancelled || isNested,
    tooltip: isAlreadyReversed ? 'This voucher has already been reversed' : 'Create a reversing entry',
    placement: 'dropdown'
  });

  // 11. REVERSE_AND_REPLACE — Dropdown, same as reverse but flexible mode only
  actions.push({
    type: 'REVERSE_AND_REPLACE',
    label: 'Reverse & Replace',
    icon: 'RefreshCw',
    variant: 'amber',
    isEnabled: !isAlreadyReversed && !isReversal,
    isHidden: !isPosted || isCancelled || isNested || isStrict,
    tooltip: 'Reverse this voucher and create a corrected replacement',
    placement: 'dropdown'
  });

  // 12. DELETE — Dropdown, dangerous
  actions.push({
    type: 'DELETE',
    label: 'Delete Forever',
    icon: 'Trash2',
    variant: 'danger',
    isEnabled: !isStrictLocked && !isNested,
    isHidden: isCancelled,
    tooltip: 'Permanently delete this voucher',
    placement: 'dropdown'
  });

  // 13. NEW — Always available (primarily for Window/Modal views)
  actions.push({
    type: 'NEW',
    label: 'New',
    icon: 'Plus',
    variant: 'secondary',
    isEnabled: true,
    isHidden: false,
    tooltip: 'Create a new voucher',
    placement: 'dropdown'
  });

  return actions;
};

// ── Helper functions for consumers ─────────────────────────────

/** Get only visible actions */
export const getVisibleActions = (ctx: VoucherActionContext): VoucherActionDefinition[] => 
  getVoucherActions(ctx).filter(a => !a.isHidden);

/** Get visible primary actions (always shown as icons) */
export const getPrimaryActions = (ctx: VoucherActionContext): VoucherActionDefinition[] => 
  getVisibleActions(ctx).filter(a => a.placement === 'primary');

/** Get visible dropdown (secondary) actions */
export const getDropdownActions = (ctx: VoucherActionContext): VoucherActionDefinition[] => 
  getVisibleActions(ctx).filter(a => a.placement === 'dropdown');

/** Check if a specific action is available */
export const isActionAvailable = (ctx: VoucherActionContext, actionType: VoucherActionType): boolean => {
  const action = getVoucherActions(ctx).find(a => a.type === actionType);
  return !!action && !action.isHidden && action.isEnabled;
};

/** Get a specific action definition */
export const getAction = (ctx: VoucherActionContext, actionType: VoucherActionType): VoucherActionDefinition | undefined => {
  return getVoucherActions(ctx).find(a => a.type === actionType);
};
