/**
 * useVoucherActions Hook
 * 
 * ══════════════════════════════════════════════════════════════════
 *  SINGLE SOURCE OF TRUTH for voucher action execution
 * ══════════════════════════════════════════════════════════════════
 * 
 * This hook provides all voucher action handlers (save, submit,
 * approve, reject, confirm, post, cancel, reverse, delete).
 * 
 * All views (VoucherTable, VoucherEntryModal, VoucherWindow,
 * VouchersListPage) should use this hook instead of defining
 * their own handlers.
 * 
 * Action VISIBILITY is determined by voucherActions.ts (pure logic).
 * Action EXECUTION is provided by this hook.
 * 
 * Usage:
 *   const { actions, executeAction } = useVoucherActions();
 *   // Or use individual handlers:
 *   const { approve, reject, post, ... } = useVoucherActions();
 */

import { accountingApi, CorrectionMode, CorrectionRequest } from '../api/accountingApi';
import { errorHandler } from '../services/errorHandler';
import { VoucherActionType } from '../modules/accounting/utils/voucherActions';

export interface VoucherActionHandlers {
  /** Save a voucher (create or update) */
  save: (windowId: string, data: any) => Promise<any>;
  /** Save and submit for approval */
  submit: (windowId: string, data: any) => Promise<any>;
  /** Approve/verify a pending voucher */
  approve: (id: string) => Promise<void>;
  /** Reject a pending voucher */
  reject: (id: string, reason?: string) => Promise<void>;
  /** Confirm custody on a pending voucher */
  confirmCustody: (id: string) => Promise<void>;
  /** Post an approved voucher to the ledger */
  post: (id: string) => Promise<void>;
  /** Cancel/void a draft or approved voucher */
  cancel: (id: string) => Promise<void>;  
  /** Reverse a posted voucher (creates a reversing entry) */
  reverse: (id: string) => Promise<void>;
  /** Reverse and replace a posted voucher */
  reverseAndReplace: (id: string, request: CorrectionRequest) => Promise<void>;
  /** Delete a voucher permanently */
  remove: (id: string) => Promise<void>;
  /** Trigger print for a voucher */
  print: (id: string) => void;
  /** Execute any action by type */
  executeAction: (type: VoucherActionType, id: string, extra?: any) => Promise<void>;
  /** Force refresh the voucher list */
  refreshList: () => void;
}

// Legacy-compatible types for WindowsDesktop props
export interface LegacyVoucherHandlers {
  handleSaveVoucher: (windowId: string, data: any) => Promise<any>;
  handleSubmitVoucher: (windowId: string, data: any) => Promise<any>;
  handleApproveVoucher: (windowId: string, id: string) => Promise<void>;
  handleRejectVoucher: (windowId: string, id: string, reason?: string) => Promise<void>;
  handleConfirmVoucher: (windowId: string, id: string) => Promise<void>;
}

const dispatchUpdate = () => {
  window.dispatchEvent(new CustomEvent('vouchers-updated'));
};

const dispatchPrint = (id: string) => {
  window.dispatchEvent(new CustomEvent('print-voucher', { detail: { id } }));
};

/**
 * Internal save logic — transforms UI data to V2 API payload
 */
const saveVoucherInternal = async (data: any): Promise<any> => {
  const baseCurrency = data.baseCurrency || data.currency || '';
  const exchangeRate = Number(data.exchangeRate) || 1;
  
  const payload = {
    ...data,
    voucherNo: data.voucherNumber || data.voucherNo,
    description: data.description || data.notes, 
    formId: data.formId, 
    prefix: data.prefix,
    sourceModule: data.sourceModule || 'accounting',
    baseCurrency,
    exchangeRate,
    lines: (data.lines || []).map((line: any) => {
      const side = line.side || (Number(line.debit || 0) > 0 ? 'Debit' : 'Credit');
      const fxAmount = Math.abs(Number(line.amount || line.debit || line.credit || 0));
      
      let baseAmount = Math.abs(Number(line.baseAmount || 0));
      if (baseAmount === 0) {
        baseAmount = fxAmount * exchangeRate;
      }
      
      const lineCurrency = line.currency || line.lineCurrency || data.currency || baseCurrency;
      
      return {
        id: line.id && typeof line.id === 'string' ? line.id : undefined,
        accountId: line.accountId || line.account,
        side,
        amount: fxAmount,
        currency: lineCurrency,
        baseAmount,
        baseCurrency,
        exchangeRate: Number(line.exchangeRate || line.parity || exchangeRate),
        notes: line.description || line.notes,
        costCenterId: line.costCenterId || line.category || null,
        metadata: line.metadata || {}
      };
    })
  };
  
  if (payload.id && payload.id.toString().startsWith('voucher-')) {
    delete payload.id;
  }

  const cleanPayload = Object.entries(payload).reduce((acc, [key, value]) => {
    if (value !== '' && value !== undefined && value !== null) {
      acc[key] = value;
    }
    return acc;
  }, {} as any);
  
  let savedVoucher;
  if (cleanPayload.id && !cleanPayload.id.toString().startsWith('voucher-')) {
    await accountingApi.updateVoucher(cleanPayload.id, cleanPayload);
    savedVoucher = { ...cleanPayload, id: cleanPayload.id };
  } else {
    const res = await accountingApi.createVoucher(cleanPayload);
    savedVoucher = res;
  }
  
  dispatchUpdate();
  return savedVoucher;
};

/**
 * useVoucherActions — The single hook for all voucher action execution.
 * 
 * Returns both unified handlers and legacy-compatible handlers.
 */
export const useVoucherActions = (): VoucherActionHandlers & LegacyVoucherHandlers => {

  // ── Core handlers ────────────────────────────────────────────

  const save = async (windowId: string, data: any): Promise<any> => {
    return await saveVoucherInternal(data);
  };

  const submit = async (windowId: string, data: any): Promise<any> => {
    const saved = await saveVoucherInternal(data);
    if (!saved?.id) throw new Error('Could not retrieve Voucher ID after save.');
    
    try {
      await accountingApi.sendVoucherToApproval(saved.id);
      errorHandler.showSuccess('Voucher submitted for approval');
      dispatchUpdate();
      return saved;
    } catch (error: any) {
      // CRITICAL: Attach the saved voucher to the error so the UI can capture the ID
      // and prevent further duplication on retry.
      error.savedVoucher = saved;
      throw error;
    }
  };

  const approve = async (id: string): Promise<void> => {
    await accountingApi.approveVoucher(id);
    errorHandler.showSuccess('Voucher approved successfully');
    dispatchUpdate();
  };

  const reject = async (id: string, reason?: string): Promise<void> => {
    await accountingApi.rejectVoucher(id, reason);
    errorHandler.showSuccess('Voucher rejected');
    dispatchUpdate();
  };

  const confirmCustody = async (id: string): Promise<void> => {
    await accountingApi.confirmVoucherCustody(id);
    errorHandler.showSuccess('Custody confirmed');
    dispatchUpdate();
  };

  const post = async (id: string): Promise<void> => {
    await accountingApi.postVoucher(id);
    errorHandler.showSuccess('Voucher posted successfully');
    dispatchUpdate();
  };

  const cancel = async (id: string): Promise<void> => {
    await accountingApi.cancelVoucher(id);
    errorHandler.showSuccess('Voucher cancelled successfully');
    dispatchUpdate();
  };

  const reverse = async (id: string): Promise<void> => {
    await accountingApi.reverseVoucher(id);
    errorHandler.showSuccess('Reversal voucher created successfully');
    dispatchUpdate();
  };

  const reverseAndReplace = async (id: string, request: CorrectionRequest): Promise<void> => {
    await accountingApi.reverseAndReplaceVoucher(id, request);
    errorHandler.showSuccess('Voucher reversed and replacement created');
    dispatchUpdate();
  };

  const remove = async (id: string): Promise<void> => {
    await accountingApi.deleteVoucher(id);
    errorHandler.showSuccess('Voucher deleted permanently');
    dispatchUpdate();
  };

  const print = (id: string): void => {
    dispatchPrint(id);
  };

  const refreshList = (): void => {
    dispatchUpdate();
  };

  // ── Dynamic dispatcher ───────────────────────────────────────

  const executeAction = async (type: VoucherActionType, id: string, extra?: any): Promise<void> => {
    try {
      switch (type) {
        case 'APPROVE':
          await approve(id);
          break;
        case 'REJECT':
          await reject(id, extra?.reason);
          break;
        case 'CONFIRM_CUSTODY':
          await confirmCustody(id);
          break;
        case 'POST':
          await post(id);
          break;
        case 'CANCEL':
          await cancel(id);
          break;
        case 'REVERSE':
          await reverse(id);
          break;
        case 'REVERSE_AND_REPLACE':
          await reverseAndReplace(id, extra);
          break;
        case 'DELETE':
          await remove(id);
          break;
        case 'PRINT':
          print(id);
          break;
        default:
          console.warn(`[useVoucherActions] Unhandled action type: ${type}`);
      }
    } catch (error: any) {
      errorHandler.showError(error);
      throw error;
    }
  };

  // ── Legacy-compatible handlers (for WindowsDesktop) ──────────

  const handleSaveVoucher = async (windowId: string, data: any): Promise<any> => {
    const result = await save(windowId, data);
    errorHandler.showSuccess('SAVE');
    return result;
  };

  const handleSubmitVoucher = async (windowId: string, data: any): Promise<any> => {
    return await submit(windowId, data);
  };

  const handleApproveVoucher = async (windowId: string, id: string): Promise<void> => {
    await approve(id);
  };

  const handleRejectVoucher = async (windowId: string, id: string, reason?: string): Promise<void> => {
    await reject(id, reason);
  };

  const handleConfirmVoucher = async (windowId: string, id: string): Promise<void> => {
    await confirmCustody(id);
  };

  return {
    // Unified handlers
    save,
    submit,
    approve,
    reject,
    confirmCustody,
    post,
    cancel,
    reverse,
    reverseAndReplace,
    remove,
    print,
    executeAction,
    refreshList,
    // Legacy handlers
    handleSaveVoucher,
    handleSubmitVoucher,
    handleApproveVoucher,
    handleRejectVoucher,
    handleConfirmVoucher,
  };
};
