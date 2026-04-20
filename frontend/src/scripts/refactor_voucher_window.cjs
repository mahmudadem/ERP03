const fs = require('fs');
const file = 'd:/DEV2026/ERP03/frontend/src/modules/accounting/components/VoucherWindow.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add MdiWindowFrame import
content = content.replace("import { clsx } from 'clsx';", "import { clsx } from 'clsx';\nimport { MdiWindowFrame } from '../../../components/mdi/MdiWindowFrame';");

// 2. Remove dragging/resizing state
const stateToRemove = `  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const [resizeType, setResizeType] = useState('');
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);`;
content = content.replace(stateToRemove, "");

// 3. Remove windowRef
content = content.replace("const windowRef = useRef<HTMLDivElement>(null);", "");

// 4. Remove handleMouseDown and handleResizeMouseDown
const mouseDeleteStart = content.indexOf('  const handleMouseDown = (e: React.MouseEvent) => {');
const mouseDeleteEnd = content.indexOf('  useEffect(() => {\n    const fetchPolicy', mouseDeleteStart);
if(mouseDeleteStart > -1 && mouseDeleteEnd > -1) {
  content = content.slice(0, mouseDeleteStart) + content.slice(mouseDeleteEnd);
}

// 5. Remove useEffect for mouse move
const effectStart = content.indexOf('  useEffect(() => {\n    const handleMouseMove');
const nextUseEffect = content.indexOf('  const normalizeSemanticPayload', effectStart);
if(effectStart > -1 && nextUseEffect > -1) {
    content = content.slice(0, effectStart) + content.slice(nextUseEffect);
}

// 6. Rewrite the huge return statement
const returnStart = content.indexOf('  if (win.isMinimized) return null;');
if(returnStart > -1) {
  content = content.slice(0, returnStart);

  const newReturnBlock = `
  const StatusBadges = () => (
    <>
      <span className={\`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider \${
        win.data?.status?.toLowerCase() === 'approved' ? 'bg-success-100/80 text-success-700 dark:bg-success-900/30 dark:text-success-400' :
        win.data?.status?.toLowerCase() === 'draft' ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]' :
        win.data?.status?.toLowerCase() === 'pending' ? 'bg-amber-100/80 text-amber-700' :
        win.data?.status?.toLowerCase() === 'rejected' ? 'bg-red-100/80 text-red-700' :
        'bg-primary-100/80 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
      }\`}>
        {t(\`statuses.\${win.data?.status?.toLowerCase()}\`, { defaultValue: win.data?.status })}
      </span>
      
      {/* V1: Posting Badge (derived from postedAt) */}
      {(win.data?.status?.toLowerCase() === 'approved' || win.data?.status?.toLowerCase() === 'posted') && (
        <span className={\`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider \${
          win.data.postedAt 
            ? 'bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
            : 'bg-orange-100/80 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
        }\`}>
          {win.data.postedAt ? t('statuses.posted') : t('voucherWindow.notPosted', { defaultValue: 'Not Posted' })}
        </span>
      )}
      
      {/* Policy Duo Indicator - Distinguishes between System Policy and Voucher Governance */}
      <PolicyGovernanceIndicator 
        isSystemStrict={isSystemStrict || false}
        isVoucherStrict={isVoucherStrict}
        settingsLoading={settingsLoading}
        isNewVoucher={!win.data?.id}
      />

      {win.data?.status?.toLowerCase() === 'pending' && win.data.metadata?.isEdited && (
        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-50 text-amber-600 rounded-md border border-amber-100 animate-pulse">
          {t('voucherWindow.edited', { defaultValue: 'Edited' })}
        </span>
      )}
      
      {/* Completion Status for Pending Vouchers - shows gate progress */}
      {win.data?.status?.toLowerCase() === 'pending' && (
        <div className="group relative cursor-help">
          <span className={\`px-2 py-0.5 text-[9px] font-semibold rounded-full \${
            win.data.metadata?.pendingFinancialApproval 
              ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' 
              : win.data.metadata?.pendingCustodyConfirmations?.length > 0
                ? 'bg-purple-50 text-purple-600 border border-purple-100'
                : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
          }\`}>
            {win.data.metadata?.pendingFinancialApproval 
              ? t('voucherWindow.awaitingApproval', { defaultValue: '⏳ Awaiting Approval' })
              : win.data.metadata?.pendingCustodyConfirmations?.length > 0
                ? t('voucherWindow.awaitingCustody', { count: win.data.metadata.pendingCustodyConfirmations.length, defaultValue: \`⏳ Custody (\${win.data.metadata.pendingCustodyConfirmations.length})\` })
                : t('voucherWindow.allGatesSatisfied', { defaultValue: '✓ All Gates Satisfied' })}
          </span>
          {/* Tooltip with details */}
          <div className="absolute left-0 top-5 hidden group-hover:block bg-gray-800 text-white text-[10px] p-2 rounded-md shadow-xl z-50 min-w-48">
            <p className="font-bold border-b border-gray-600 pb-1 mb-1">{t('voucherWindow.gateStatus', { defaultValue: 'Gate Status' })}</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={win.data.metadata?.pendingFinancialApproval ? 'text-amber-300' : 'text-emerald-300'}>
                  {win.data.metadata?.pendingFinancialApproval ? '⏳' : '✓'}
                </span>
                <span>{t('voucherWindow.financialApproval', { defaultValue: 'Financial Approval' })}</span>
              </div>
              {win.data.metadata?.custodyConfirmationRequired && (
                <div className="flex items-center gap-2">
                  <span className={win.data.metadata?.pendingCustodyConfirmations?.length > 0 ? 'text-amber-300' : 'text-emerald-300'}>
                    {win.data.metadata?.pendingCustodyConfirmations?.length > 0 ? '⏳' : '✓'}
                  </span>
                  <span>{t('voucherWindow.custodyPending', { count: win.data.metadata?.pendingCustodyConfirmations?.length || 0, defaultValue: \`Custody (\${win.data.metadata?.pendingCustodyConfirmations?.length || 0} pending)\` })}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );

  const ContextMenuExtra = () => (
    <>
      <button
        onClick={() => {
          handleSave();
        }}
        className="w-full px-4 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-3 transition-colors"
      >
        <Save className="w-4 h-4 text-[var(--color-text-secondary)]" />
        Save
      </button>
      <button
        onClick={() => {
          window.print();
        }}
        className="w-full px-4 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-3 transition-colors"
      >
        <Printer className="w-4 h-4 text-[var(--color-text-secondary)]" />
        Print
      </button>
      
      {win.data && (win.data.status?.toLowerCase() === 'posted' || win.data.status?.toLowerCase() === 'approved') && !isReversal && !isAlreadyReversed && (
        <>
          <div className="border-t border-[var(--color-border)] my-1.5 opacity-50"></div>
          <button
            onClick={() => {
              const met = win.data?.metadata;
              if (met?.reversedByVoucherId || met?.isReversed) return;
              setCorrectionMode('REVERSE_ONLY');
              setShowCorrectionModal(true);
            }}
            disabled={!!win.data?.metadata?.reversedByVoucherId || !!win.data?.metadata?.isReversed || win.data?.type === 'REVERSAL'}
            className="w-full px-4 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-3 transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4 text-[var(--color-text-secondary)]" />
            {win.data?.metadata?.reversedByVoucherId || win.data?.metadata?.isReversed
              ? t('voucherWindow.alreadyReversed', 'Already Reversed')
              : t('voucherWindow.reverseVoucher', 'Reverse Voucher')}
          </button>
          {settings?.strictApprovalMode === false && (
            <button
              onClick={() => {
                const met = win.data?.metadata;
                if (met?.reversedByVoucherId || met?.isReversed) return;
                setCorrectionMode('REVERSE_AND_REPLACE');
                setShowCorrectionModal(true);
              }}
              disabled={!!win.data?.metadata?.reversedByVoucherId || !!win.data?.metadata?.isReversed || win.data?.type === 'REVERSAL'}
              className="w-full px-4 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-3 transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4 text-[var(--color-text-secondary)]" />
              {t('voucherWindow.reverseReplace', 'Reverse & Replace')}
            </button>
          )}
        </>
      )}
      {win.data && (win.data.status?.toLowerCase() === 'draft' || win.data.status?.toLowerCase() === 'approved') && !win.data.postedAt && !isNested && (
        <>
          <div className="border-t border-[var(--color-border)] my-1.5 opacity-50"></div>
          <button
            onClick={handleCancel}
            className="w-full px-4 py-2 text-left text-sm text-amber-600 hover:bg-amber-50 flex items-center gap-3 transition-colors"
          >
            <Ban className="w-4 h-4" />
            Cancel / Void Voucher
          </button>
        </>
      )}
    </>
  );

  const FooterActions = () => {
    const hasValues = totalDebitVoucher > 0 || totalCreditVoucher > 0;
            
    // Use live currency from renderer/state FIRST, fall back to saved data
    const voucherCurrency = liveCurrency || 
                            rendererRef.current?.getData()?.currency || 
                            win.data?.currency || 
                            settings?.baseCurrency || '';
                            
    const currentRows = liveLines.length > 0 ? liveLines : (rendererRef.current?.getRows() || []);
    const semanticLineCount = isSemanticAmountType && semanticLineAccountKey
      ? currentRows.filter((r: any) => {
          const accountVal = r?.[semanticLineAccountKey] || r?.accountId || r?.account;
          const amountVal = Number(r?.amount) || 0;
          return !!accountVal && amountVal > 0;
        }).length
      : 0;
    const semanticHeaderHasAccount = isSemanticAmountType && semanticHeaderAccountKey
      ? !!(
        renderData?.[semanticHeaderAccountKey] ||
        renderData?.metadata?.[semanticHeaderAccountKey] ||
        win.data?.[semanticHeaderAccountKey] ||
        win.data?.metadata?.[semanticHeaderAccountKey] ||
        renderData?.accountId ||
        renderData?.metadata?.accountId ||
        renderData?.account ||
        win.data?.accountId ||
        win.data?.metadata?.accountId ||
        win.data?.account
      )
      : false;
    const hasLines = isSemanticAmountType
      ? (semanticLineCount >= 1 && semanticHeaderHasAccount)
      : (currentRows.filter(r => r.accountId && (Number(r.debit) > 0 || Number(r.credit) > 0)).length >= 2);
    const canSave = isBalancedVoucher && hasLines;

    return (
      <>
        <div className="flex items-center gap-4">
          <VoucherTotalsDisplay
            totalDebit={totalDebitVoucher}
            totalCredit={totalCreditVoucher}
            currency={voucherCurrency}
            isBalanced={isBalancedVoucher}
            difference={differenceVoucher}
            lines={calculationLines}
            baseCurrency={settings?.baseCurrency || 'SYP'}
            headerRate={headerRate}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 text-sm text-primary-600 hover:text-primary-700 font-bold transition-colors"
            onClick={handleNew}
            title={t('voucherWindow.newTooltip', 'Create a new voucher in this window')}
          >
            {t('voucherWindow.new', 'New')}
          </button>

          <button
            className="px-3 py-1.5 text-sm text-primary-600 hover:text-primary-700 font-bold transition-colors flex items-center gap-1.5"
            onClick={() => win.data?.id && onPrint?.(win.data.id)}
            disabled={!win.data?.id}
            title={t('voucherWindow.printTooltip', 'Print voucher')}
          >
            <Printer className="w-4 h-4" />
            {t('voucherWindow.print', 'Print')}
          </button>

          {(() => {
            // UNIFIED LOADING STATE: Prevent button flicker while policies are fetching
            if (settingsLoading || policyLoading) {
              return (
                <div className="flex items-center gap-2 px-6 py-2 bg-gray-100 text-gray-400 border border-gray-200 rounded-lg animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs font-bold">{t('voucherWindow.loadingPolicies', 'Loading Policies...')}</span>
                </div>
              );
            }

            if (isVoucherReadOnly) {
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
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200" 
                      : "bg-amber-600 text-white hover:bg-amber-700"
                  )}
                  title={isDisabled 
                    ? (isReversal 
                        ? t('voucherWindow.tooltip.reversalCannotReverse', 'This is a reversal voucher and cannot be reversed again.')
                        : t('voucherWindow.tooltip.alreadyReversed', 'This voucher has already been reversed.'))
                    : t('voucherWindow.tooltip.createReversal', 'This voucher is locked. Create a reversal to correct it.')
                  }
                >
                  <RotateCcw className="w-4 h-4" />
                  {isAlreadyReversed 
                    ? t('voucherWindow.alreadyReversed', 'Already Reversed') 
                    : (isReversal 
                        ? t('voucherWindow.reversal', 'Reversal') 
                        : t('voucherWindow.reverseVoucher', 'Reverse Voucher'))}
                </button>
              );
            }

            return (
              <button
                onClick={handleSave}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed border",
                  (settingsLoading || policyLoading)
                    ? 'bg-[var(--color-bg-primary)] border-[var(--color-border)] text-[var(--color-text-primary)]' 
                    : forceStrictMode
                      ? 'bg-[var(--color-bg-primary)] border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'
                      : 'bg-emerald-600 text-white border-transparent hover:bg-emerald-700 shadow-sm',
                  // HIDE "Save as Draft" if not draft (and not pending which has its own label)
                  forceStrictMode && win.data?.status && win.data.status.toLowerCase() !== 'draft' && win.data.status.toLowerCase() !== 'pending' && 'hidden'
                )}
                disabled={isSaving || settingsLoading || policyLoading || !canSave}
                title={
                  !isBalancedVoucher
                    ? t('voucherWindow.mustBalance', 'Voucher must be balanced')
                    : !hasLines
                      ? (isSemanticAmountType
                        ? t('voucherWindow.mustSemanticLines', 'Voucher needs header account + at least 1 amount line')
                        : t('voucherWindow.mustLines', 'Voucher must have at least 2 lines'))
                      : ""
                }
              >
                {isSaving || settingsLoading || policyLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {settingsLoading || policyLoading ? t('voucherWindow.loading', 'Loading...') : (forceStrictMode ? t('voucherWindow.saving', 'Saving...') : t('voucherWindow.posting', 'Posting...'))}
                  </>
                ) : (
                  <>
                    {!forceStrictMode ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {(() => {
                      if (!forceStrictMode) {
                        return win.data?.postedAt ? t('voucherWindow.updatePost', 'Update & Post') : t('voucherWindow.savePost', 'Save & Post');
                      }
                      const s = win.data?.status?.toLowerCase();
                      if (s === 'pending') return t('voucherWindow.updatePending', 'Update Pending Voucher');
                      return t('voucherWindow.saveDraft', 'Save as Draft');
                    })()}
                  </>
                )}
              </button>
            );
          })()}
          
          {/* Submit button shown when strict mode is true OR it's a reversal */}
          {(() => {
            return !settingsLoading && !policyLoading && forceStrictMode && (!win.data?.status || win.data?.status?.toLowerCase() === 'draft' || win.data?.status?.toLowerCase() === 'rejected') && (
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 px-6 py-2 text-xs font-bold bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-sm disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                disabled={isSubmitting || !isBalancedVoucher}
                title={!isBalancedVoucher ? t('voucherWindow.mustBalance', 'Voucher must be balanced') : ""}
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {isSubmitting ? t('voucherWindow.submitting', 'Submitting...') : t('voucherWindow.submitApproval', 'Submit Approval')}
              </button>
            );
          })()}

          {win.data?.status?.toLowerCase() === 'pending' && (
            <>
              <button
                onClick={async () => {
                  if (onApprove && win.data?.id) {
                    setIsSubmitting(true);
                    try {
                      await onApprove(win.data.id);
                      setIsDirty(false);
                      setSuccessAction('APPROVE');
                      setShowSuccessModal(true);
                    } catch (error: any) {
                      errorHandler.showError(error);
                    } finally {
                      setIsSubmitting(false);
                    }
                  }
                }}
                className="flex items-center gap-2 px-6 py-2 text-xs font-bold bg-success-600 text-white rounded-lg hover:bg-success-700 shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
                disabled={isSubmitting || !win.data?.metadata?.pendingFinancialApproval}
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {t('voucherWindow.approve', 'Approve')}
              </button>

              {/* Confirm Custody Button - Only shown if user is a pending custodian (ID or Email check) */}
              {win.data?.metadata?.pendingCustodyConfirmations?.some((id: string) => 
                id.toLowerCase() === user?.uid?.toLowerCase() || 
                (user?.email && id.toLowerCase() === user.email.toLowerCase())
              ) && (
                <button
                  onClick={async () => {
                    if (onConfirm && win.data?.id) {
                      setIsSubmitting(true);
                      try {
                        await onConfirm(win.data.id);
                        setIsDirty(false);
                        setSuccessAction('CONFIRM_CUSTODY');
                        setShowSuccessModal(true);
                      } catch (error: any) {
                        errorHandler.showError(error);
                      } finally {
                        setIsSubmitting(false);
                      }
                    }
                  }}
                  className="flex items-center gap-2 px-6 py-2 text-xs font-bold bg-purple-600 text-white rounded-lg hover:bg-purple-700 shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check size={16} />}
                  {t('voucherWindow.confirmCustody', 'Confirm Custody')}
                </button>
              )}

              <button
                onClick={async () => {
                  if (onReject && win.data?.id) {
                    setIsSubmitting(true);
                    try {
                      await onReject(win.data.id);
                      setIsDirty(false);
                      await refreshVoucher();
                    } catch (error: any) {
                      errorHandler.showError(error);
                    } finally {
                      setIsSubmitting(false);
                    }
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-danger-600 text-white rounded-lg hover:bg-danger-700 shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
                disabled={isSubmitting}
              >
                {t('voucherWindow.reject', 'Reject')}
              </button>
            </>
          )}

          {/* Post Button for APPROVED vouchers that are not yet posted */}
          {win.data?.status?.toLowerCase() === 'approved' && !win.data?.postedAt && (
            <button
              onClick={async () => {
                if (win.data?.id) {
                  setIsSubmitting(true);
                  try {
                    await accountingApi.postVoucher(win.data.id);
                    setIsDirty(false);
                    setShowSuccessModal(true);
                    await refreshVoucher();
                  } catch (error: any) {
                    errorHandler.showError(error);
                  } finally {
                    setIsSubmitting(false);
                  }
                }
              }}
              className="flex items-center gap-2 px-6 py-2 text-xs font-bold bg-success-600 text-white rounded-lg hover:bg-success-700 shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {t('voucherWindow.post', 'Post to Ledger')}
            </button>
          )}
        </div>
      </>
    );
  };

  const Modals = () => (
    <>
      <ConfirmDialog
        isOpen={showUnsavedModal}
        title={t('unsavedChangesModal.title')}
        message={t('unsavedChangesModal.description')}
        onCancel={() => {
          setShowUnsavedModal(false);
          setIsPendingNew(false);
        }}
        onConfirm={handleConfirmClose}
        confirmLabel={t('unsavedChangesModal.closeWithoutSaving')}
        cancelLabel={t('unsavedChangesModal.cancel')}
        tone="danger"
      />

      {/* Confirmation Modal */}
      <ConfirmDialog
        isOpen={showConfirmSubmitModal}
        title={t('voucherWindow.confirmSubmitTitle')}
        message={t('voucherWindow.confirmSubmitBody')}
        onCancel={() => setShowConfirmSubmitModal(false)}
        onConfirm={handleConfirmSubmit}
        confirmLabel={t('voucherWindow.confirmSubmit')}
        cancelLabel={t('common.cancel', 'Cancel')}
        tone="warning"
        isConfirming={isSubmitting}
        icon={<Send size={24} />}
      />

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/50 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-96 p-6 border border-gray-100 scale-100 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 bg-success-50 rounded-full flex items-center justify-center text-success-600 mb-2">
                <CheckCircle size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {successAction === 'CONFIRM_CUSTODY' ? t('voucherWindow.success.custody', 'Custody Confirmed!') :
                   win.data?.status?.toLowerCase() === 'posted' ? t('voucherWindow.success.posted', 'Posted Successfully!') : 
                   win.data?.status?.toLowerCase() === 'draft' ? t('voucherWindow.success.saved', 'Saved Successfully!') : 
                   t('voucherWindow.success.submitted', 'Submitted Successfully!')}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {successAction === 'CONFIRM_CUSTODY' ? t('voucherWindow.success.custodyMsg', 'You have successfully confirmed custody of this voucher.') :
                   win.data?.status?.toLowerCase() === 'posted' ? t('voucherWindow.success.postedMsg', 'Voucher has been posted to the ledger.') : 
                   win.data?.status?.toLowerCase() === 'draft' ? t('voucherWindow.success.savedMsg', 'Voucher saved as draft.') : 
                   t('voucherWindow.success.submittedMsg', 'Voucher has been sent for approval.')}
                </p>
              </div>
              
              <div className="flex flex-col gap-3 w-full mt-4">
                <button 
                  onClick={handleSuccessNew}
                  className="w-full px-4 py-3 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={16} /> {t('voucherWindow.success.createAnother', 'Create Another Voucher')}
                </button>
                <button 
                  onClick={handleSuccessClose}
                  className="w-full px-4 py-3 text-sm font-bold text-gray-700 bg-white border-2 border-gray-100 hover:border-gray-200 hover:bg-gray-50 rounded-xl transition-all"
                >
                  {t('voucherWindow.success.close', 'Close Window')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Voucher Correction Modal */}
      <VoucherCorrectionModal
        isOpen={showCorrectionModal}
        onClose={() => setShowCorrectionModal(false)}
        voucherId={win.data?.id || ''}
        voucherNumber={win.data?.voucherNumber || win.data?.voucherNo || ''}
        originalVoucher={win.data}
        initialMode={correctionMode}
        onSuccess={(result) => {
          updateWindowData(win.id, { 
            ...win.data, 
            metadata: {
              ...win.data?.metadata,
              reversedByVoucherId: result.reverseVoucherId,
              isReversed: true
            }
          });
          globalThis.window.dispatchEvent(new CustomEvent('vouchers-updated'));
          errorHandler.showSuccess(t('voucherWindow.reversalSubmitted'));
          setShowCorrectionModal(false);
        }}
      />

      {/* Rate Deviation Warning Dialog */}
      {rateDeviationResult && (
        <RateDeviationDialog
          isOpen={!!rateDeviationResult}
          result={rateDeviationResult}
          baseCurrency={settings?.baseCurrency || 'SYP'}
          voucherDate={(pendingSaveData as any)?.date || new Date().toISOString().split('T')[0]}
          onConfirm={handleRateDeviationConfirm}
          onConfirmWithSync={handleRateDeviationSync}
          onCancel={handleRateDeviationCancel}
        />
      )}
    </>
  );

  const title = win.data?.id
    ? t('voucherEditor.existingTitle', { name: win.data?.voucherConfig?.name || win.title, id: win.data?.voucherNumber || win.data?.voucherNo || win.data?.id || '' })
    : t('voucherEditor.newTitle', { name: win.data?.voucherConfig?.name || win.title });

  return (
    <MdiWindowFrame
      win={win}
      title={title}
      onClose={handleCloseAttempt}
      headerExtra={<StatusBadges />}
      contextMenuExtra={<ContextMenuExtra />}
      footer={<FooterActions />}
      modals={<Modals />}
    >
      <GenericVoucherRenderer
        ref={rendererRef}
        definition={win.data?.voucherConfig as any}
        mode="windows"
        initialData={win.data}
        readOnly={isVoucherReadOnly}
        onChange={handleRendererChange}
        onBlur={handleRendererBlur}
      />
    </MdiWindowFrame>
  );
};
  
export const VoucherWindow = React.memo(_VoucherWindow, (prevProps, nextProps) => {
  if (prevProps.win.id !== nextProps.win.id) return false;
  if (prevProps.win.isMaximized !== nextProps.win.isMaximized) return false;
  if (prevProps.win.isMinimized !== nextProps.win.isMinimized) return false;
  if (prevProps.win.isFocused !== nextProps.win.isFocused) return false;
  if (prevProps.win.position.x !== nextProps.win.position.x) return false;
  if (prevProps.win.position.y !== nextProps.win.position.y) return false;
  if (prevProps.win.size.width !== nextProps.win.size.width) return false;
  if (prevProps.win.size.height !== nextProps.win.size.height) return false;
  return prevProps.win.data?.id === nextProps.win.data?.id;
});
`;

  content += newReturnBlock;
}

fs.writeFileSync('d:/DEV2026/ERP03/frontend/src/modules/accounting/components/VoucherWindow.tsx', content);
