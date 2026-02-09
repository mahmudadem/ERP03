/**
 * Voucher Entry Modal
 * 
 * Modal for creating new voucher transactions using the designed voucher type template.
 * Uses GenericVoucherRenderer with real data binding and saves to backend.
 */

import React, { useState, useRef, useEffect } from 'react';
import { X, Save, Loader2, Send, CheckCircle, Plus, RotateCcw, AlertTriangle, Check, RotateCw, Printer } from 'lucide-react';
import { VoucherFormConfig } from '../voucher-wizard/types';
import { GenericVoucherRenderer, GenericVoucherRendererRef } from './shared/GenericVoucherRenderer';
import { UIMode } from '../../../api/companyApi';
import { UnsavedChangesModal } from './shared/UnsavedChangesModal';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { clsx } from 'clsx';
import { useAuth } from '../../../hooks/useAuth';
import { VoucherCorrectionModal } from './VoucherCorrectionModal';
import { RateDeviationDialog } from './shared/RateDeviationDialog';
import { checkVoucherRateDeviations, RateDeviationResult } from '../utils/rateDeviationCheck';
import { getCompanyToday } from '../../../utils/dateUtils';
import { errorHandler } from '../../../services/errorHandler';
import { accountingApi, CorrectionMode } from '../../../api/accountingApi';
import { PolicyGovernanceIndicator } from './PolicyGovernanceIndicator';
import { VoucherTotalsDisplay } from './VoucherTotalsDisplay';
import { PostingLockPolicy } from '../../../types/accounting/PostingLockPolicy';

interface VoucherEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  voucherType: VoucherFormConfig;
  uiMode: UIMode;
  onSave: (data: any) => Promise<void>;
  initialData?: any;
  onApprove?: (id: string) => Promise<void>;
  onReject?: (id: string) => Promise<void>;
  onConfirm?: (id: string) => Promise<void>;
  onPost?: (id: string) => Promise<void>;
  onCancel?: (id: string) => Promise<void>;
  onReverse?: (id: string) => Promise<void>;
  onPrint?: (id: string) => void;
}

export const VoucherEntryModal: React.FC<VoucherEntryModalProps> = ({
  isOpen,
  onClose,
  voucherType,
  uiMode,
  onSave,
  initialData,
  onApprove,
  onReject,
  onConfirm,
  onPost,
  onCancel,
  onReverse,
  onPrint
}) => {
  const { user } = useAuth();
  const { settings, isLoading: settingsLoading } = useCompanySettings();
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, forceUpdate] = useState({}); // To trigger totals update
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [showConfirmSubmitModal, setShowConfirmSubmitModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successAction, setSuccessAction] = useState<'SUBMIT' | 'APPROVE' | 'CONFIRM_CUSTODY' | 'POST' | 'SAVE' | null>(null);
  const [isCheckingRates, setIsCheckingRates] = useState(false);
  const [rateDeviationResult, setRateDeviationResult] = useState<RateDeviationResult | null>(null);
  const [pendingSaveData, setPendingSaveData] = useState<any>(null);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionMode, setCorrectionMode] = useState<CorrectionMode>('REVERSE_ONLY');
  const [isNewMode, setIsNewMode] = useState(false); // Tracks when user clicked "New" to reset form
  
  const rendererRef = useRef<GenericVoucherRendererRef>(null);

  // When initialData changes (user opens a different voucher), reset new mode
  React.useEffect(() => {
    setIsNewMode(false);
  }, [initialData?.id]);

  // Effective voucher data for action button visibility
  // When isNewMode is true, use a clean draft state instead of stale initialData
  const effectiveData = React.useMemo(() => {
    if (isNewMode) {
      return {
        status: 'draft',
        metadata: {},
        id: undefined,
        postedAt: undefined,
        approvedAt: undefined,
        postingLockPolicy: undefined,
        type: voucherType?.code || voucherType?.id,
      };
    }
    return initialData;
  }, [isNewMode, initialData, voucherType]);

  const isReversal = React.useMemo(() => {
    return !!effectiveData?.reversalOfVoucherId || effectiveData?.type?.toLowerCase() === 'reversal';
  }, [effectiveData]);

  const forceStrictMode = React.useMemo(() => {
    return settings?.strictApprovalMode === true || isReversal;
  }, [settings?.strictApprovalMode, isReversal]);

  const isAlreadyReversed = React.useMemo(() => {
    return !!effectiveData?.metadata?.reversedByVoucherId || !!effectiveData?.metadata?.isReversed;
  }, [effectiveData?.metadata?.reversedByVoucherId, effectiveData?.metadata?.isReversed]);

  const isCancelled = React.useMemo(() => {
    const status = effectiveData?.status?.toLowerCase();
    return status === 'cancelled' || status === 'void';
  }, [effectiveData?.status]);

  // Calculate totals during render to ensure reactivity to renderer updates via forceUpdate
  const currentRows = rendererRef.current?.getRows() || [];
  const totalDebit = currentRows.reduce((sum: number, row: any) => sum + (parseFloat(row.debit) || 0), 0);
  const totalCredit = currentRows.reduce((sum: number, row: any) => sum + (parseFloat(row.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001;
  const hasValues = totalDebit > 0 || totalCredit > 0;
  const diff = Math.abs(totalDebit - totalCredit);
  const hasMinLines = currentRows.filter(r => (r.accountId || r.account) && (Number(r.debit) > 0 || Number(r.credit) > 0)).length >= 2;

  const isVoucherReadOnly = React.useMemo(() => {
    if (!effectiveData?.status) return false;
    const status = effectiveData.status.toLowerCase();
    
    // In STRICT mode, many statuses are read-only
    if (forceStrictMode) {
      return ['posted', 'approved', 'locked'].includes(status);
    }
    
    // In FLEXIBLE mode (default), only locked is read-only
    return status === 'locked';
  }, [effectiveData?.status, forceStrictMode]);

  if (!isOpen) return null;

  const handleCloseAttempt = () => {
    if (isDirty) {
      setShowUnsavedModal(true);
    } else {
      onClose();
    }
  };

  const handleConfirmClose = () => {
    setShowUnsavedModal(false);
    onClose();
  };

  const performSave = async (voucherData: any, isSubmit: boolean = false) => {
    try {
      if (isSubmit) setIsSubmitting(true);
      else setIsSaving(true);
      setError(null);

      await onSave(voucherData);
      
      setIsDirty(false);
      setSuccessAction(isSubmit ? 'SUBMIT' : 'SAVE');
      setShowSuccessModal(true);
    } catch (err: any) {
      setError(err.message || 'Failed to save voucher');
    } finally {
      setIsSaving(false);
      setIsSubmitting(false);
    }
  };

  const handleSaveVoucher = async (statusOverride?: string) => {
    if (!rendererRef.current) return;
    
    setError(null);
    const formData = rendererRef.current.getData();
    const isSubmit = statusOverride === 'submitted';
    
    // FX Rate Validation (Synced from VoucherWindow)
    const baseCurrency = settings?.baseCurrency || 'SYP';
    const lines = formData.lines || [];
    const fxLinesWithoutRate = lines.filter((line: any) => {
      const lineCurrency = line.currency?.toUpperCase() || baseCurrency;
      const hasRate = line.exchangeRate && line.exchangeRate > 0;
      const hasParity = line.parity && line.parity > 0;
      const isFx = lineCurrency !== baseCurrency.toUpperCase();
      return isFx && !hasRate && !hasParity;
    });
    
    if (fxLinesWithoutRate.length > 0) {
      const currencies = [...new Set(fxLinesWithoutRate.map((l: any) => l.currency || 'Unknown'))];
      setError(`Cannot save: ${fxLinesWithoutRate.length} line(s) with foreign currency (${currencies.join(', ')}) are missing parity rates.`);
      return;
    }

    if (!isBalanced) {
      setError(`Voucher must be balanced before saving.`);
      return;
    }

    const voucherData = {
      ...formData,
      typeId: (voucherType as any).baseType || voucherType.id,
      metadata: {
        ...(formData.metadata || {}),
        formId: voucherType.id,
        creationMode: settings?.strictApprovalMode ? 'STRICT' : 'FLEXIBLE'
      },
      status: typeof statusOverride === 'string' ? statusOverride : (initialData ? initialData.status : 'draft')
    };

    // Rate Deviation Check
    const voucherCurrency = formData.currency || baseCurrency;
    const headerRate = parseFloat(formData.exchangeRate) || 1;
    const hasForeignLines = voucherCurrency !== baseCurrency || lines.some((l: any) => l.currency && l.currency.toUpperCase() !== voucherCurrency.toUpperCase());
    
    if (hasForeignLines) {
      setIsCheckingRates(true);
      try {
        const voucherDate = formData.date || new Date().toISOString().split('T')[0];
        const deviationResult = await checkVoucherRateDeviations(
          lines,
          voucherCurrency,
          headerRate,
          baseCurrency,
          voucherDate
        );

        if (deviationResult.hasDeviations) {
          setPendingSaveData({ data: voucherData, isSubmit });
          setRateDeviationResult(deviationResult);
          return;
        }
      } catch (err) {
        console.error('Rate deviation check failed:', err);
      } finally {
        setIsCheckingRates(false);
      }
    }

    await performSave(voucherData, isSubmit);
  };

  const handleRateDeviationConfirm = async () => {
    if (pendingSaveData) {
      await performSave(pendingSaveData.data, pendingSaveData.isSubmit);
      setPendingSaveData(null);
      setRateDeviationResult(null);
    }
  };

  const handleRateDeviationSync = async () => {
    if (rateDeviationResult && pendingSaveData) {
      const voucherDate = pendingSaveData.data.date || new Date().toISOString().split('T')[0];
      const baseCurrency = settings?.baseCurrency || 'SYP';
      
      try {
        await Promise.all(
          rateDeviationResult.warnings.map(warning => 
            accountingApi.saveExchangeRate(warning.lineCurrency, baseCurrency, warning.effectiveRate, voucherDate)
          )
        );
        errorHandler.showSuccess(`Synced rates for ${voucherDate}`);
        await performSave(pendingSaveData.data, pendingSaveData.isSubmit);
      } catch (err) {
        console.error('Failed to sync rates:', err);
        await performSave(pendingSaveData.data, pendingSaveData.isSubmit);
      } finally {
        setPendingSaveData(null);
        setRateDeviationResult(null);
      }
    }
  };

  const handleNew = () => {
    if (rendererRef.current) {
      rendererRef.current.resetData();
    }
    // Full state reset — no stale data should survive
    setIsNewMode(true);
    setIsDirty(false);
    setError(null);
    setIsSaving(false);
    setIsSubmitting(false);
    setShowSuccessModal(false);
    setShowConfirmSubmitModal(false);
    setShowCorrectionModal(false);
    setRateDeviationResult(null);
    setPendingSaveData(null);
    forceUpdate({});
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleCloseAttempt}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div 
          className="relative bg-[var(--color-bg-primary)] rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-[var(--color-border)] transition-colors duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] relative z-10 bg-[var(--color-bg-secondary)] rounded-t-lg select-none">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                {effectiveData?.id ? `Edit ${voucherType.name}` : `New ${voucherType.name}`}
              </h2>

              {/* Status Indicators */}
              <div className="flex items-center gap-1.5 ml-2 border-l border-[var(--color-border)] pl-3">
                {effectiveData?.status && (
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                    effectiveData.status.toLowerCase() === 'approved' ? 'bg-success-100/80 text-success-700 dark:bg-success-900/30 dark:text-success-400' :
                    effectiveData.status.toLowerCase() === 'draft' ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]' :
                    effectiveData.status.toLowerCase() === 'pending' ? 'bg-amber-100/80 text-amber-700' :
                    effectiveData.status.toLowerCase() === 'rejected' ? 'bg-red-100/80 text-red-700' :
                    'bg-primary-100/80 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                  }`}>
                    {effectiveData.status}
                  </span>
                )}
                
                {/* Posting Badge (derived from postedAt) */}
                {(effectiveData?.status?.toLowerCase() === 'approved' || effectiveData?.status?.toLowerCase() === 'posted') && (
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                    effectiveData.postedAt 
                      ? 'bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-orange-100/80 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                  }`}>
                    {effectiveData.postedAt ? 'POSTED' : 'NOT POSTED'}
                  </span>
                )}

                {/* Policy Governance Indicator */}
                <PolicyGovernanceIndicator 
                  isSystemStrict={!!settings?.strictApprovalMode}
                  isVoucherStrict={effectiveData?.postingLockPolicy === PostingLockPolicy.STRICT_LOCKED || isReversal}
                  settingsLoading={settingsLoading}
                  isNewVoucher={!effectiveData?.id}
                />
              </div>
            </div>

            <button
              onClick={handleCloseAttempt}
              className="p-1.5 hover:bg-[var(--color-bg-tertiary)] rounded-md transition-colors text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              disabled={isSaving}
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mx-6 mt-4 bg-danger-50 dark:bg-danger-900/10 border border-danger-200 dark:border-danger-800 text-danger-700 dark:text-danger-400 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6 custom-scroll">
            <GenericVoucherRenderer 
              ref={rendererRef}
              definition={voucherType as any}
              mode={uiMode}
              initialData={initialData}
              readOnly={isVoucherReadOnly}
              onChange={() => {
                setIsDirty(true);
                forceUpdate({});
              }}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg-tertiary)] transition-colors duration-300">
            
            {/* Totals Display (Synced with VoucherWindow style) */}
            <VoucherTotalsDisplay
              totalDebit={totalDebit}
              totalCredit={totalCredit}
              currency={voucherType.defaultCurrency || 'SYP'}
              isBalanced={isBalanced}
            />

            {/* Action Buttons (Synced from VoucherWindow) */}
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1.5 text-sm text-primary-600 hover:text-primary-700 font-bold transition-colors"
                onClick={handleNew}
                title="Create a new voucher"
              >
                New
              </button>

              <button
                className="px-3 py-1.5 text-sm text-primary-600 hover:text-primary-700 font-bold transition-colors flex items-center gap-1.5"
                onClick={() => effectiveData?.id && onPrint?.(effectiveData.id)}
                disabled={!effectiveData?.id}
                title="Print voucher"
              >
                <Printer size={16} />
                Print
              </button>

              <div className="w-[1px] h-6 bg-[var(--color-border)] mx-1" />

              {isVoucherReadOnly ? (
                (() => {
                  if (isCancelled) return null;
                  const isDisabled = isReversal || isAlreadyReversed;

                  return (
                    <button
                      onClick={() => {
                        if (isDisabled) return;
                        setCorrectionMode('REVERSE_ONLY');
                        setShowCorrectionModal(true);
                      }}
                      disabled={isDisabled}
                      className={clsx(
                        "flex items-center gap-2 px-6 py-2 text-xs font-bold rounded-lg shadow-sm transition-all active:scale-[0.98]",
                        isDisabled 
                          ? "bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] cursor-not-allowed border border-[var(--color-border)]" 
                          : "bg-amber-600 text-white hover:bg-amber-700"
                      )}
                      title={isDisabled 
                        ? (isReversal ? "This is a reversal voucher and cannot be reversed again." : "This voucher has already been reversed.")
                        : "This voucher is locked. Create a reversal to correct it."
                      }
                    >
                      <RotateCcw className="w-4 h-4" />
                      {isAlreadyReversed ? 'Already Reversed' : (isReversal ? 'Reversal' : 'Reverse Voucher')}
                    </button>
                  );
                })()
              ) : (
                <button
                  onClick={() => handleSaveVoucher()}
                  className={clsx(
                    "flex items-center gap-2 px-6 py-2 text-xs font-bold rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed border",
                    settingsLoading 
                      ? 'bg-[var(--color-bg-primary)] border-[var(--color-border)] text-[var(--color-text-primary)]' 
                      : forceStrictMode
                        ? 'bg-[var(--color-bg-primary)] border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'
                        : 'bg-emerald-600 text-white border-transparent hover:bg-emerald-700 shadow-sm',
                    // HIDE if not draft (and not pending which has its own label)
                    forceStrictMode && initialData?.status && initialData.status.toLowerCase() !== 'draft' && initialData.status.toLowerCase() !== 'pending' && 'hidden'
                  )}
                  disabled={isSaving || settingsLoading || !isBalanced || !hasMinLines}
                  title={!isBalanced ? "Voucher must be balanced to save" : !hasMinLines ? "Voucher must have at least 2 lines" : ""}
                >
                  {isSaving || settingsLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {settingsLoading ? 'Loading...' : (forceStrictMode ? 'Saving...' : 'Posting...')}
                    </>
                  ) : (
                    <>
                      {(() => {
                        if (!forceStrictMode) return <CheckCircle className="w-4 h-4" />;
                        const status = effectiveData?.status?.toLowerCase();
                        if (status === 'pending' || status === 'approved' || status === 'posted') return <Save className="w-4 h-4" />;
                        return <Save className="w-4 h-4" />;
                      })()}
                      {(() => {
                        if (!forceStrictMode) {
                           return effectiveData?.postedAt ? 'Update & Post' : 'Save & Post';
                        }
                        const status = effectiveData?.status?.toLowerCase();
                        if (status === 'pending') return 'Update Pending Voucher';
                        if (status === 'approved' || status === 'posted') return 'Save Changes';
                        return 'Save as Draft';
                      })()}
                    </>
                  )}
                </button>
              )}

              {/* Submit button only shown when strict mode is explicitly true */}
              {!settingsLoading && forceStrictMode && (!effectiveData?.status || effectiveData?.status?.toLowerCase() === 'draft' || effectiveData?.status?.toLowerCase() === 'rejected') && (
                <button
                  onClick={() => setShowConfirmSubmitModal(true)} 
                  className="flex items-center gap-2 px-6 py-2 text-xs font-bold bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-sm disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                  disabled={isSubmitting || !isBalanced}
                  title={!isBalanced ? "Voucher must be balanced to submit" : ""}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Approval
                    </>
                  )}
                </button>
              )}

              {/* Approval Action Buttons (Synced from VoucherWindow) */}
              {effectiveData?.status?.toLowerCase() === 'pending' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      if (onApprove && effectiveData?.id) {
                        setIsSubmitting(true);
                        try {
                          await onApprove(effectiveData.id);
                          setIsDirty(false);
                          setSuccessAction('APPROVE');
                          setShowSuccessModal(true);
                        } catch (err: any) {
                          setError(err.message || 'Approval failed');
                        } finally {
                          setIsSubmitting(false);
                        }
                      }
                    }}
                    className="flex items-center gap-2 px-6 py-2 text-xs font-bold bg-success-600 text-white rounded-lg hover:bg-success-700 shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
                    disabled={isSubmitting || !effectiveData?.metadata?.pendingFinancialApproval}
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Approve
                  </button>

                  {/* Confirm Custody Button - Only shown if user is a pending custodian */}
                  {effectiveData?.metadata?.pendingCustodyConfirmations?.some((id: string) => 
                    id.toLowerCase() === user?.uid?.toLowerCase() || 
                    (user?.email && id.toLowerCase() === user.email.toLowerCase())
                  ) && (
                    <button
                      onClick={async () => {
                        if (onConfirm && effectiveData?.id) {
                          setIsSubmitting(true);
                          try {
                            await onConfirm(effectiveData.id);
                            setIsDirty(false);
                            setSuccessAction('CONFIRM_CUSTODY');
                            setShowSuccessModal(true);
                          } catch (err: any) {
                            setError(err.message || 'Confirmation failed');
                          } finally {
                            setIsSubmitting(false);
                          }
                        }
                      }}
                      className="flex items-center gap-2 px-6 py-2 text-xs font-bold bg-purple-600 text-white rounded-lg hover:bg-purple-700 shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check size={16} />}
                      Confirm Custody
                    </button>
                  )}

                  <button
                    onClick={async () => {
                      if (onReject && effectiveData?.id) {
                        setIsSubmitting(true);
                        try {
                          await onReject(effectiveData.id);
                          setIsDirty(false);
                          onClose();
                        } catch (err: any) {
                          setError(err.message || 'Rejection failed');
                        } finally {
                          setIsSubmitting(false);
                        }
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-danger-600 text-white rounded-lg hover:bg-danger-700 shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
                    disabled={isSubmitting}
                  >
                    Reject
                  </button>
                </div>
              )}

              {/* Post Button for APPROVED vouchers that are not yet posted */}
              {effectiveData?.status?.toLowerCase() === 'approved' && !effectiveData?.postedAt && (
                <button
                  onClick={async () => {
                    if (onPost && effectiveData?.id) {
                      setIsSubmitting(true);
                      try {
                        await onPost(effectiveData.id);
                        setIsDirty(false);
                        setSuccessAction('POST');
                        setShowSuccessModal(true);
                      } catch (err: any) {
                        setError(err.message || 'Posting failed');
                      } finally {
                        setIsSubmitting(false);
                      }
                    }
                  }}
                  className="flex items-center gap-2 px-6 py-2 text-xs font-bold bg-success-600 text-white rounded-lg hover:bg-success-700 shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Post to Ledger
                </button>
              )}

            </div>
          </div>
        </div>
      </div>
      
      <UnsavedChangesModal 
        isOpen={showUnsavedModal}
        onCancel={() => setShowUnsavedModal(false)}
        onConfirm={handleConfirmClose}
      />

      {/* Confirmation Modal */}
      {showConfirmSubmitModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 animate-in fade-in duration-200">
          <div className="bg-[var(--color-bg-primary)] rounded-xl shadow-2xl w-96 p-6 border border-[var(--color-border)] scale-100 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/20 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-400">
                <Send size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Submit for Approval?</h3>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">This will lock the voucher and notify approvers. You cannot edit it afterwards.</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3 w-full mt-2">
                <button 
                  onClick={() => setShowConfirmSubmitModal(false)}
                  className="px-4 py-2 text-sm font-bold text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    setShowConfirmSubmitModal(false);
                    handleSaveVoucher('submitted');
                  }}
                  className="px-4 py-2 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-md transition-all active:scale-[0.98]"
                >
                  Confirm Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/50 animate-in fade-in duration-200">
          <div className="bg-[var(--color-bg-primary)] rounded-xl shadow-2xl w-96 p-6 border border-[var(--color-border)] scale-100 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 bg-success-50 dark:bg-success-900/20 rounded-full flex items-center justify-center text-success-600 dark:text-success-400 mb-2">
                <CheckCircle size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[var(--color-text-primary)]">
                  {successAction === 'CONFIRM_CUSTODY' ? 'Custody Confirmed!' :
                   successAction === 'APPROVE' ? 'Approved Successfully!' :
                   successAction === 'POST' ? 'Posted Successfully!' : 
                   successAction === 'SUBMIT' ? 'Submitted Successfully!' :
                   'Saved Successfully!'}
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  {successAction === 'CONFIRM_CUSTODY' ? 'You have successfully confirmed custody of this voucher.' :
                   successAction === 'APPROVE' ? 'Voucher has been approved and moved to next stage.' :
                   successAction === 'POST' ? 'Voucher has been posted to the ledger.' : 
                   successAction === 'SUBMIT' ? 'Voucher has been sent for approval.' :
                   'Voucher saved as draft.'}
                </p>
              </div>
              
              <div className="flex flex-col gap-3 w-full mt-4">
                <button 
                  onClick={() => {
                    if (rendererRef.current) {
                      rendererRef.current.resetData();
                      setIsDirty(false);
                      setShowSuccessModal(false);
                      // If parent is editing, we should navigate back to "new" or just clear state
                      // For now, let's just close the modal and let the user decide
                      onClose();
                    }
                  }}
                  className="w-full px-4 py-3 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={16} /> Create Another Voucher
                </button>
                <button 
                  onClick={() => {
                    setShowSuccessModal(false);
                    onClose();
                  }}
                  className="w-full px-4 py-3 text-sm font-bold text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] rounded-xl transition-all"
                >
                  Close Modal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Voucher Reversal/Correction Modal */}
      <VoucherCorrectionModal
        isOpen={showCorrectionModal}
        onClose={() => setShowCorrectionModal(false)}
        voucherId={initialData?.id || ''}
        voucherNumber={initialData?.voucherNumber || initialData?.voucherNo || ''}
        originalVoucher={initialData}
        initialMode={correctionMode}
        onSuccess={() => {
          // Trigger global refresh
          globalThis.window.dispatchEvent(new CustomEvent('vouchers-updated'));
          errorHandler.showSuccess('Voucher reversal submitted.');
          setShowCorrectionModal(false);
          onClose(); // Close the entry modal too
        }}
      />

      {/* Rate Deviation Warning Dialog */}
      {rateDeviationResult && (
        <RateDeviationDialog
          isOpen={!!rateDeviationResult}
          result={rateDeviationResult}
          baseCurrency={settings?.baseCurrency || 'SYP'}
          voucherDate={pendingSaveData.data.date || new Date().toISOString().split('T')[0]}
          onConfirm={handleRateDeviationConfirm}
          onConfirmWithSync={handleRateDeviationSync}
          onCancel={() => {
            setPendingSaveData(null);
            setRateDeviationResult(null);
          }}
        />
      )}
    </div>
  );
};
