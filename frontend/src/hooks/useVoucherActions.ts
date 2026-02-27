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

const UI_ONLY_TOP_LEVEL_FIELDS = new Set([
  'voucherConfig',
  'headerFields',
  'tableColumns',
  'uiModeOverrides',
  'tableStyle',
  'actions',
  'rules',
  '_isForm',
  '_rowId',
]);

const UI_ONLY_METADATA_FIELDS = new Set([
  'voucherConfig',
  'headerFields',
  'tableColumns',
  'uiModeOverrides',
  'tableStyle',
  'actions',
  'rules',
]);

const LEGACY_SOURCE_KEYS = new Set([
  'sourceVoucher',
  'sourcePayload'
]);

// These fields are owned by backend lifecycle/state and must never be restored from source snapshots.
const SYSTEM_MANAGED_SOURCE_FIELDS = new Set([
  'id',
  'voucherNo',
  'voucherNumber',
  'status',
  'createdBy',
  'createdAt',
  'updatedBy',
  'updatedAt',
  'approvedBy',
  'approvedAt',
  'rejectedBy',
  'rejectedAt',
  'postedBy',
  'postedAt',
  'postingLockPolicy'
]);
const SYSTEM_MANAGED_SOURCE_FIELDS_LOWER = new Set(
  Array.from(SYSTEM_MANAGED_SOURCE_FIELDS).map((key) => key.toLowerCase())
);

const isPlainObject = (value: any): value is Record<string, any> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const deepMergeObjects = (base: Record<string, any>, override: Record<string, any>): Record<string, any> => {
  const merged: Record<string, any> = { ...base };
  Object.entries(override || {}).forEach(([key, value]) => {
    const baseValue = merged[key];
    if (isPlainObject(baseValue) && isPlainObject(value)) {
      merged[key] = deepMergeObjects(baseValue, value);
    } else {
      merged[key] = value;
    }
  });
  return merged;
};

const stripSystemManagedSourceFields = (snapshot: any): any => {
  if (!isPlainObject(snapshot)) return snapshot;
  const out: Record<string, any> = {};
  Object.entries(snapshot).forEach(([key, value]) => {
    if (SYSTEM_MANAGED_SOURCE_FIELDS_LOWER.has(String(key).toLowerCase())) {
      return;
    }
    out[key] = value;
  });
  return out;
};

const sanitizeSourceSnapshot = (value: any): any => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value
      .map((entry) => sanitizeSourceSnapshot(entry))
      .filter((entry) => entry !== undefined);
  }
  if (!isPlainObject(value)) return value;

  const out: Record<string, any> = {};
  Object.entries(value).forEach(([key, entry]) => {
    if (!key) return;
    if (UI_ONLY_TOP_LEVEL_FIELDS.has(key)) return;
    if (LEGACY_SOURCE_KEYS.has(key)) return;
    if (key === 'metadata' && isPlainObject(entry)) {
      const cleanedMeta = sanitizeMetadata(entry);
      if (cleanedMeta && Object.keys(cleanedMeta).length > 0) {
        out[key] = cleanedMeta;
      }
      return;
    }
    const cleaned = sanitizeSourceSnapshot(entry);
    if (cleaned === undefined) return;
    out[key] = cleaned;
  });
  return out;
};

const toAccountRef = (value: any): string | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if (typeof value.id === 'string' && value.id) return value.id;
    if (typeof value.accountId === 'string' && value.accountId) return value.accountId;
    if (typeof value.code === 'string' && value.code) return value.code;
    if (typeof value.account === 'string' && value.account) return value.account;
  }
  return undefined;
};

const sanitizeMetadata = (metadata: any): Record<string, any> | undefined => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
  const cleaned = Object.entries(metadata).reduce((acc, [key, value]) => {
    if (UI_ONLY_METADATA_FIELDS.has(key)) return acc;
    if (value === undefined) return acc;
    acc[key] = value;
    return acc;
  }, {} as Record<string, any>);
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
};

/**
 * Internal save logic — transforms UI data to V2 API payload
 */
const saveVoucherInternal = async (data: any): Promise<any> => {
  const normalizeType = (value: any): string => {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'journal_entry';
    if (raw.includes('receipt')) return 'receipt';
    if (raw.includes('payment')) return 'payment';
    if (raw.includes('opening')) return 'opening_balance';
    if (raw.includes('revaluation') || raw.includes('fx')) return 'fx_revaluation';
    if (raw.includes('journal') || raw === 'jv') return 'journal_entry';
    return raw;
  };

  const detectSemanticTypeFromLines = (lines: any[]): string | undefined => {
    if (!Array.isArray(lines) || lines.length === 0) return undefined;
    const hasReceiptShape = lines.some((line: any) =>
      !!toAccountRef(line?.receiveFromAccountId || line?.metadata?.receiveFromAccountId)
    );
    if (hasReceiptShape) return 'receipt';

    const hasPaymentShape = lines.some((line: any) =>
      !!toAccountRef(line?.payToAccountId || line?.metadata?.payToAccountId)
    );
    if (hasPaymentShape) return 'payment';

    return undefined;
  };

  const detectedTypeFromLines = detectSemanticTypeFromLines(data.lines || []);
  const resolvedType = normalizeType(
    data.type ||
    data.typeId ||
    data.baseType ||
    data.metadata?.type ||
    data.metadata?.typeId ||
    detectedTypeFromLines ||
    data.voucherConfig?.baseType ||
    data.voucherConfig?.code
  );
  const isReceipt = resolvedType === 'receipt';
  const isPayment = resolvedType === 'payment';
  const explicitHeaderCurrency = String(data.currency || '').toUpperCase();
  const fallbackHeaderCurrency = String(
    data.baseCurrency ||
    data.voucherConfig?.defaultCurrency ||
    ''
  ).toUpperCase();
  // Never infer header currency from lines on save; preserve explicit source state.
  const headerCurrency = explicitHeaderCurrency || fallbackHeaderCurrency;
  const baseCurrency = String(data.baseCurrency || '').toUpperCase();
  const exchangeRate = Number(data.exchangeRate) || 1;
  const metadata = sanitizeMetadata(data.metadata);
  const explicitSnapshot = sanitizeSourceSnapshot(
    data && isPlainObject(data.sourcePayload) ? data.sourcePayload : undefined
  );
  const fallbackSnapshot = sanitizeSourceSnapshot(data);
  const mergedSnapshot = (isPlainObject(explicitSnapshot) && isPlainObject(fallbackSnapshot))
    ? deepMergeObjects(fallbackSnapshot, explicitSnapshot)
    : (explicitSnapshot ?? fallbackSnapshot);
  const sourcePayload = stripSystemManagedSourceFields(mergedSnapshot);

  const semanticLines = (data.lines || [])
    .map((line: any) => {
      const accountRef = isReceipt
        ? toAccountRef(line.receiveFromAccountId || line.accountId || line.account)
        : toAccountRef(line.payToAccountId || line.accountId || line.account);
      const amount = Math.abs(Number(line.amount || line.debit || line.credit || 0));
      const lineCurrency = String(line.currency || line.lineCurrency || '').toUpperCase();
      const lineParity = Number(line.exchangeRate || line.parity || 1) || 1;
      return isReceipt
        ? {
            receiveFromAccountId: accountRef,
            amount,
            notes: line.description || line.notes || '',
            costCenterId: line.costCenterId || line.category || null,
            currency: lineCurrency || undefined,
            lineCurrency: lineCurrency || undefined,
            exchangeRate: lineParity,
            parity: lineParity,
            metadata: sanitizeMetadata(line.metadata) || {}
          }
        : {
            payToAccountId: accountRef,
            amount,
            notes: line.description || line.notes || '',
            costCenterId: line.costCenterId || line.category || null,
            currency: lineCurrency || undefined,
            lineCurrency: lineCurrency || undefined,
            exchangeRate: lineParity,
            parity: lineParity,
            metadata: sanitizeMetadata(line.metadata) || {}
          };
    })
    .filter((line: any) => {
      const accountRef = isReceipt ? line.receiveFromAccountId : line.payToAccountId;
      return !!accountRef && Number(line.amount) > 0;
    });

  const payload: any = {
    type: resolvedType,
    ...(data.id ? { id: data.id } : {}),
    voucherNo: data.voucherNumber || data.voucherNo || undefined,
    description: data.description || data.notes, 
    formId: data.formId || undefined, 
    typeId: data.typeId || undefined,
    prefix: data.prefix || undefined,
    numberFormat: data.numberFormat || undefined,
    date: data.date || undefined,
    reference: data.reference || undefined,
    postingPeriodNo: data.postingPeriodNo ?? undefined,
    status: data.status || undefined,
    sourceModule: data.sourceModule || 'accounting',
    currency: headerCurrency || undefined,
    baseCurrency: baseCurrency || undefined,
    exchangeRate,
    sourcePayload: sourcePayload || undefined,
    ...(metadata ? { metadata } : {}),
    ...(isReceipt
      ? {
          depositToAccountId: toAccountRef(data.depositToAccountId || data.accountId || data.account),
          lines: semanticLines
        }
      : isPayment
        ? {
          payFromAccountId: toAccountRef(data.payFromAccountId || data.accountId || data.account),
            lines: semanticLines
          }
        : {
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
                metadata: sanitizeMetadata(line.metadata) || {}
              };
            })
          })
  };

  const cleanPayload = Object.entries(payload).reduce((acc, [key, value]) => {
    if (UI_ONLY_TOP_LEVEL_FIELDS.has(key)) return acc;
    if (value !== '' && value !== undefined && value !== null) {
      acc[key] = value;
    }
    return acc;
  }, {} as any);

  if (cleanPayload.id && cleanPayload.id.toString().startsWith('voucher-')) {
    delete cleanPayload.id;
  }
  
  let savedVoucher;
  if (cleanPayload.id && !cleanPayload.id.toString().startsWith('voucher-')) {
    await accountingApi.updateVoucher(cleanPayload.id, cleanPayload);
    // Update endpoint returns ack only; fetch full server state for reliable reopen.
    savedVoucher = await accountingApi.getVoucher(cleanPayload.id);
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
