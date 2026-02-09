/**
 * voucherActions.ts
 * 
 * Centralized logic for determining which actions are available for a voucher
 * based on its status, metadata, and system settings.
 */

import { VoucherSummary } from '../api/accountingApi';

export type VoucherActionType = 
  | 'SAVE' 
  | 'SUBMIT' 
  | 'APPROVE' 
  | 'REJECT' 
  | 'CONFIRM_CUSTODY' 
  | 'POST' 
  | 'REVERSE' 
  | 'REVERSE_AND_REPLACE' 
  | 'CANCEL' 
  | 'PRINT' 
  | 'EDIT' 
  | 'DELETE' 
  | 'NEW';

export interface VoucherActionDefinition {
  type: VoucherActionType;
  label: string;
  icon: string; // Lucide icon name or similar
  variant: 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'purple' | 'amber';
  isEnabled: boolean;
  isHidden: boolean;
  tooltip?: string;
}

export const getVoucherActions = (
  voucher: any, 
  settings: any, 
  user: any,
  isWindowsMode: boolean = false
): VoucherActionDefinition[] => {
  if (!voucher) return [];

  const status = voucher.status?.toLowerCase() || 'draft';
  const isPosted = !!voucher.postedAt;
  const isCancelled = status === 'cancelled' || status === 'void';
  const metadata = voucher.metadata || {};
  const isStrict = settings?.strictApprovalMode ?? true;
  
  const isReversal = voucher.type === 'REVERSAL' || metadata?.isReversal;
  const isAlreadyReversed = !!metadata?.reversedByVoucherId || !!metadata?.isReversed;
  
  const actions: VoucherActionDefinition[] = [];

  // 1. DEFAULT ACTIONS (ALWAYS PRESENT BUT MAYBE HIDDEN/DISABLED)
  
  // NEW
  actions.push({
    type: 'NEW',
    label: 'New',
    icon: 'Plus',
    variant: 'secondary',
    isEnabled: true,
    isHidden: false,
    tooltip: 'Create a new voucher'
  });

  // PRINT
  actions.push({
    type: 'PRINT',
    label: 'Print',
    icon: 'Printer',
    variant: 'secondary',
    isEnabled: !!voucher.id,
    isHidden: false,
    tooltip: 'Print official voucher document'
  });

  // 2. STATUS-BASED ACTIONS

  // SAVE / UPDATE
  const canEdit = !isPosted && !isCancelled && status !== 'pending' && status !== 'approved';
  // Note: For pending/approved, we might allow "Save Changes" in some cases but usually it's locked
  // Matching Windows: Save is hidden if locked
  const isLocked = isPosted || isCancelled || (isStrict && (status === 'pending' || status === 'approved'));

  actions.push({
    type: 'SAVE',
    label: !isStrict ? (isPosted ? 'Update & Post' : 'Save & Post') : (status === 'pending' ? 'Update Pending' : (status === 'approved' ? 'Save Changes' : 'Save as Draft')),
    icon: !isStrict ? 'CheckCircle' : 'Save',
    variant: !isStrict ? 'success' : 'secondary',
    isEnabled: !isSavingDisabled(voucher, settings),
    isHidden: isLocked && isStrict
  });

  // SUBMIT
  actions.push({
    type: 'SUBMIT',
    label: 'Submit Approval',
    icon: 'Send',
    variant: 'primary',
    isEnabled: !isLocked && (status === 'draft' || status === 'rejected'),
    isHidden: !isStrict || isLocked || (status !== 'draft' && status !== 'rejected')
  });

  // APPROVE
  const isPendingFinancial = !!metadata?.pendingFinancialApproval;
  actions.push({
    type: 'APPROVE',
    label: 'Approve',
    icon: 'CheckCircle',
    variant: 'success',
    isEnabled: status === 'pending' && isPendingFinancial,
    isHidden: status !== 'pending'
  });

  // CONFIRM CUSTODY
  const pendingCustodians = metadata?.pendingCustodyConfirmations || [];
  const isUserCustodian = pendingCustodians.some((id: string) => 
    id.toLowerCase() === user?.uid?.toLowerCase() || 
    (user?.email && id.toLowerCase() === user.email.toLowerCase())
  );
  actions.push({
    type: 'CONFIRM_CUSTODY',
    label: 'Confirm Custody',
    icon: 'Check',
    variant: 'purple',
    isEnabled: status === 'pending' && isUserCustodian,
    isHidden: status !== 'pending' || !metadata?.custodyConfirmationRequired
  });

  // REJECT
  actions.push({
    type: 'REJECT',
    label: 'Reject',
    icon: 'Ban',
    variant: 'danger',
    isEnabled: status === 'pending',
    isHidden: status !== 'pending'
  });

  // POST (For approved not yet posted)
  actions.push({
    type: 'POST',
    label: 'Post to Ledger',
    icon: 'CheckCircle',
    variant: 'success',
    isEnabled: status === 'approved' && !isPosted,
    isHidden: status !== 'approved' || isPosted
  });

  // REVERSE Actions
  actions.push({
    type: 'REVERSE',
    label: isAlreadyReversed ? 'Already Reversed' : (isReversal ? 'Reversal' : 'Reverse Voucher'),
    icon: 'RotateCcw',
    variant: 'amber',
    isEnabled: isLocked && !isCancelled && !isReversal && !isAlreadyReversed,
    isHidden: !isLocked || isCancelled
  });

  // CANCEL / VOID
  actions.push({
    type: 'CANCEL',
    label: 'Cancel / Void',
    icon: 'Ban',
    variant: 'danger',
    isEnabled: !isPosted && !isCancelled && (status === 'draft' || status === 'approved'),
    isHidden: isPosted || isCancelled
  });

  return actions;
};

const isSavingDisabled = (voucher: any, settings: any) => {
    // Basic logic - can be expanded
    return false;
};
