
 /**
 * Voucher Window Component - Legacy Style
 * 
 * Floating, draggable, resizable window matching legacy design.
 */

import React, { useRef, useState, useEffect } from 'react';
import { X, Minus, Square, ChevronDown, Save, Printer, Loader2, Send, AlertTriangle, CheckCircle, Plus, RotateCcw, RefreshCw, Ban, Check } from 'lucide-react';
import { GenericVoucherRenderer, GenericVoucherRendererRef } from './shared/GenericVoucherRenderer';
import { VoucherWindow as VoucherWindowType } from '../../../context/WindowManagerContext';
import { useWindowManager } from '../../../context/WindowManagerContext';
import { accountingApi } from '../../../api/accountingApi';
import { errorHandler } from '../../../services/errorHandler';
import { clsx } from 'clsx';
import { UnsavedChangesModal } from './shared/UnsavedChangesModal';
import { VoucherCorrectionModal } from './VoucherCorrectionModal';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { AccountingPolicyConfig } from '../../../api/accountingApi';
import { PostingLockPolicy } from '../../../types/accounting/PostingLockPolicy';

interface VoucherWindowProps {
  win: VoucherWindowType;
  onSave: (id: string, data: any) => Promise<void>;
  onSubmit: (id: string, data: any) => Promise<void>;
  onApprove?: (id: string) => Promise<void>;
  onReject?: (id: string) => Promise<void>;
  onConfirm?: (id: string) => Promise<void>;
}

export const VoucherWindow: React.FC<VoucherWindowProps> = ({ 
  win, 
  onSave,
  onSubmit,
  onApprove,
  onReject,
  onConfirm
}) => {
  const { closeWindow, minimizeWindow, maximizeWindow, focusWindow, updateWindowPosition, updateWindowSize, updateWindowData } = useWindowManager();
  const { settings, isLoading: settingsLoading, refresh: refreshSettings, updateSettings } = useCompanySettings();
  const windowRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<GenericVoucherRendererRef>(null);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const [resizeType, setResizeType] = useState('');
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  
  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, forceUpdate] = useState(0); // Force re-render for totals
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [showConfirmSubmitModal, setShowConfirmSubmitModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [liveLines, setLiveLines] = useState<any[]>(win.data?.lines || []);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionMode, setCorrectionMode] = useState<'REVERSE_ONLY' | 'REVERSE_AND_REPLACE'>('REVERSE_ONLY');
  const [policyConfig, setPolicyConfig] = useState<AccountingPolicyConfig | null>(null);
  const [policyLoading, setPolicyLoading] = useState(true);

  const isReversal = React.useMemo(() => {
    return !!win.data?.reversalOfVoucherId || win.data?.type?.toLowerCase() === 'reversal';
  }, [win.data?.reversalOfVoucherId, win.data?.type]);

  const isAlreadyReversed = React.useMemo(() => {
    return !!win.data?.metadata?.reversedByVoucherId || !!win.data?.metadata?.isReversed;
  }, [win.data?.metadata?.reversedByVoucherId, win.data?.metadata?.isReversed]);

  const isCancelled = React.useMemo(() => {
    const status = win.data?.status?.toLowerCase();
    return status === 'cancelled' || status === 'void';
  }, [win.data?.status]);

  const forceStrictMode = React.useMemo(() => {
    return settings?.strictApprovalMode === true || isReversal;
  }, [settings?.strictApprovalMode, isReversal]);

  // V1: nested check (simple version for now to satisfy types)
  const isNested = React.useMemo(() => {
    return !!win.data?.reversalOfVoucherId;
  }, [win.data?.reversalOfVoucherId]);

  const refreshVoucher = async () => {
    if (!win.data?.id) return;
    try {
      const updated = await accountingApi.getVoucher(win.data.id);
      updateWindowData(win.id, updated);
      if (updated.lines) setLiveLines(updated.lines);
    } catch (error) {
      console.error('Failed to refresh voucher:', error);
    }
  };

  const handleCloseAttempt = () => {
    if (isDirty) {
      setShowUnsavedModal(true);
    } else {
      closeWindow(win.id);
    }
  };

  const handleConfirmClose = () => {
    setShowUnsavedModal(false);
    closeWindow(win.id);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.window-header') && 
        !(e.target as HTMLElement).closest('button')) {
      setIsDragging(true);
      const rect = windowRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
      focusWindow(win.id);
    }
  };

  const handleResizeMouseDown = (e: React.MouseEvent, type: string) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeType(type);
    focusWindow(win.id);
  };

  useEffect(() => {
    const fetchPolicy = async () => {
      setPolicyLoading(true);
      try {
        const config = await accountingApi.getPolicyConfig();
        setPolicyConfig(config);
      } catch (error) {
        console.error('[VoucherWindow] Failed to fetch policy config:', error);
      } finally {
        setPolicyLoading(false);
      }
    };
    fetchPolicy();
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && !win.isMaximized) {
        updateWindowPosition(win.id, {
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
      
      if (isResizing && !win.isMaximized && windowRef.current) {
        const rect = windowRef.current.getBoundingClientRect();
        let newWidth = win.size.width;
        let newHeight = win.size.height;
        let newX = win.position.x;
        let newY = win.position.y;

        // Calculate new dimensions based on resize type
        if (resizeType.includes('e')) {
          newWidth = e.clientX - rect.left;
        }
        if (resizeType.includes('w')) {
          const deltaX = rect.left - e.clientX;
          newWidth = win.size.width + deltaX;
          newX = e.clientX;
        }
        if (resizeType.includes('s')) {
          newHeight = e.clientY - rect.top;
        }
        if (resizeType.includes('n')) {
          const deltaY = rect.top - e.clientY;
          newHeight = win.size.height + deltaY;
          newY = e.clientY;
        }

        // Apply minimum size constraints
        newWidth = Math.max(400, Math.min(newWidth, globalThis.window.innerWidth - 20));
        newHeight = Math.max(300, Math.min(newHeight, globalThis.window.innerHeight - 100));

        // Update window size and position
        updateWindowSize(win.id, { width: newWidth, height: newHeight });
        if (newX !== win.position.x || newY !== win.position.y) {
          updateWindowPosition(win.id, { x: newX, y: newY });
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeType('');
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragOffset, resizeType, win.id, win.isMaximized, win.size, win.position, updateWindowPosition, updateWindowSize]);

  const handleSave = async () => {
    if (!rendererRef.current) {
      return;
    }
    
    const formData = rendererRef.current.getData();
    const baseCurrency = (win.voucherType as any)?.defaultCurrency || 'USD';
    
    // FX Rate Validation: Block save if any FX line is missing exchange rate
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
      errorHandler.showError(
        `Cannot save: ${fxLinesWithoutRate.length} line(s) with foreign currency (${currencies.join(', ')}) are missing parity rates. ` +
        `Please enter the parity for each FX line before saving.`
      );
      return;
    }
    
    // Balance Validation: For multi-currency, check equivalent totals in base currency
    const equivDebit = lines.reduce((sum: number, r: any) => sum + ((parseFloat(r.debit as any) || 0) * (parseFloat(r.parity as any) || 1)), 0);
    const equivCredit = lines.reduce((sum: number, r: any) => sum + ((parseFloat(r.credit as any) || 0) * (parseFloat(r.parity as any) || 1)), 0);
    const balanced = Math.abs(equivDebit - equivCredit) < 0.01;
    
    if (!balanced) {
      errorHandler.showError(
        `Voucher is not balanced in base currency (${baseCurrency}). ` +
        `Total Debit: ${equivDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}, ` +
        `Total Credit: ${equivCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}. ` +
        `Diff: ${(equivDebit - equivCredit).toLocaleString(undefined, { minimumFractionDigits: 2 })}. ` +
        `Please ensure the voucher balances before saving.`
      );
      return;
    }
    
    setIsSaving(true);
    try {
      // Inject creation mode for audit transparency
      formData.metadata = {
        ...formData.metadata,
        creationMode: settings?.strictApprovalMode ? 'STRICT' : 'FLEXIBLE'
      };

      await onSave(win.id, formData);

      // Success! Reset dirty state
      setIsDirty(false);
      setShowSuccessModal(true);
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle submit for approval - Stage 1 (Confirmation)
  const handleSubmit = () => {
    setShowConfirmSubmitModal(true);
  };

  // Handle submit for approval - Stage 2 (Execution)
  const handleConfirmSubmit = async () => {
    if (!rendererRef.current) return;
    
    const formData = rendererRef.current.getData();
    const baseCurrency = (win.voucherType as any)?.defaultCurrency || 'USD';
    
    // FX Rate Validation: Block submit if any FX line is missing exchange rate
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
      setShowConfirmSubmitModal(false);
      errorHandler.showError(
        `Cannot submit: ${fxLinesWithoutRate.length} line(s) with foreign currency (${currencies.join(', ')}) are missing parity rates. ` +
        `Please enter the parity for each FX line before submitting.`
      );
      return;
    }
    
    // Balance Validation: For multi-currency, check equivalent totals in base currency
    const equivDebit = lines.reduce((sum: number, r: any) => sum + ((parseFloat(r.debit as any) || 0) * (parseFloat(r.parity as any) || 1)), 0);
    const equivCredit = lines.reduce((sum: number, r: any) => sum + ((parseFloat(r.credit as any) || 0) * (parseFloat(r.parity as any) || 1)), 0);
    const balanced = Math.abs(equivDebit - equivCredit) < 0.01;
    
    if (!balanced) {
      setShowConfirmSubmitModal(false);
      errorHandler.showError(
        `Voucher is not balanced in base currency (${baseCurrency}). ` +
        `Total Debit: ${equivDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}, ` +
        `Total Credit: ${equivCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}. ` +
        `Diff: ${(equivDebit - equivCredit).toLocaleString(undefined, { minimumFractionDigits: 2 })}. ` +
        `Please ensure the voucher balances before submitting.`
      );
      return;
    }
    
    setShowConfirmSubmitModal(false);
    setIsSubmitting(true);
    
    try {
      // Inject creation mode for audit transparency
      formData.metadata = {
        ...formData.metadata,
        creationMode: settings?.strictApprovalMode ? 'STRICT' : 'FLEXIBLE'
      };

      await onSubmit(win.id, formData);
      
      // Success! Reset dirty state to prevent "Unsaved Changes" prompt
      setIsDirty(false);
      setShowSuccessModal(true);
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!win.data?.id) return;
    try {
      await accountingApi.cancelVoucher(win.data.id);
      errorHandler.showSuccess('Voucher cancelled successfully');
      setContextMenu(null);
      // Trigger global refresh so list updates
      globalThis.window.dispatchEvent(new CustomEvent('vouchers-updated'));
      // Close window after cancellation as it's a terminal state
      closeWindow(win.id);
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  // Post-Success Action: Close
  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    closeWindow(win.id);
  };

  // Post-Success Action: New
  const handleSuccessNew = () => {
    handleNew();
    setIsDirty(false); // Ensure clean state for new form
    setShowSuccessModal(false);
  };

  const handleDataChange = (newData: any) => {
    updateWindowData(win.id, newData);
  };

  const handleNew = () => {
    if (rendererRef.current) {
      rendererRef.current.resetData();
      // Update window context data to reflect new state
      updateWindowData(win.id, {
        ...win.data,
        id: undefined,
        status: 'Draft',
        lines: []
      });
    }
  };

  const isVoucherReadOnly = React.useMemo(() => {
    if (!win.data?.status) return false;
    const status = win.data.status.toLowerCase();
    
    // Rule 1: CANCELLED vouchers are always read-only
    if (status === 'cancelled' || status === 'void') return true;

    // Rule 2: Non-posted vouchers are editable (Workflow phase)
    if (!win.data.postedAt) {
       // In STRICT mode, 'approved' is also read-only (waiting for auto-post or manual post)
       const isStrictNow = policyConfig ? policyConfig.strictApprovalMode : settings?.strictApprovalMode;
       if (isStrictNow && status === 'approved') return true;
       return false; 
    }

    // Rule 3: STRICT FOREVER - Born and posted under strict policy
    if (win.data.postingLockPolicy === PostingLockPolicy.STRICT_LOCKED) return true;

    // Rule 4: CURRENT SYSTEM LOCK
    // If system is in Strict mode, all posted vouchers (even Flexible ones) are locked
    const isStrictNow = policyConfig ? policyConfig.strictApprovalMode : settings?.strictApprovalMode;
    if (isStrictNow) return true;

    // Rule 5: FLEXIBLE MODE - Check the module-specific toggle
    // If we have policyConfig, we trust its allowEditDeletePosted toggle.
    const allowEdit = policyConfig ? policyConfig.allowEditDeletePosted : false;
    if (!allowEdit) return true;

    // FLEXIBLE + toggle ON + FLEXIBLE_LOCKED voucher -> Edit allowed
    return false;
  }, [win.data, settings, policyConfig]);

  useEffect(() => {
    if (!settingsLoading && settings) {
      console.log('[VoucherWindow] Active Settings:', {
        companyId: settings.companyId,
        strictApprovalMode: settings.strictApprovalMode,
        isVoucherReadOnly
      });
    }
  }, [settings, settingsLoading, isVoucherReadOnly]);

  if (win.isMinimized) return null;

  const style: React.CSSProperties = win.isMaximized
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: '80px',
        width: 'auto',
        height: 'auto',
        zIndex: win.isFocused ? 1000 : 999
      }
    : {
        position: 'fixed',
        left: win.position.x,
        top: win.position.y,
        width: win.size.width,
        height: win.size.height,
        zIndex: win.isFocused ? 1000 : 999
      };

  return (
    <>
      {/* Invisible overlay during drag/resize to prevent events leaking to background */}
      {(isDragging || isResizing) && (
        <div 
          className="fixed inset-0 z-[9999]"
          style={{ cursor: isDragging ? 'move' : 'se-resize' }}
        />
      )}
      
      <div
        ref={windowRef}
        style={style}
        className={`flex flex-col bg-[var(--color-bg-primary)] rounded-lg shadow-2xl overflow-hidden border transition-all duration-300 ${
          win.isFocused ? 'border-primary-500/50 ring-1 ring-primary-500/20' : 'border-[var(--color-border)]'
        }`}
        onMouseDown={() => focusWindow(win.id)}
      >
      {/* Window Header */}
      <div
        className="window-header flex items-center justify-between px-3 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] cursor-move select-none"
        onMouseDown={handleMouseDown}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setContextMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-sm text-[var(--color-text-primary)]">{win.title}</h3>
          {win.data?.status && (
            <div className="flex items-center gap-1.5">
              {/* V1: Workflow Badge */}
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                win.data.status.toLowerCase() === 'approved' ? 'bg-success-100/80 text-success-700 dark:bg-success-900/30 dark:text-success-400' :
                win.data.status.toLowerCase() === 'draft' ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]' :
                win.data.status.toLowerCase() === 'pending' ? 'bg-amber-100/80 text-amber-700' :
                win.data.status.toLowerCase() === 'rejected' ? 'bg-red-100/80 text-red-700' :
                'bg-primary-100/80 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
              }`}>
                {win.data.status}
              </span>
              
              {/* V1: Posting Badge (derived from postedAt) */}
              {(win.data.status.toLowerCase() === 'approved' || win.data.status.toLowerCase() === 'posted') && (
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                  win.data.postedAt 
                    ? 'bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-orange-100/80 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                }`}>
                  {win.data.postedAt ? 'POSTED' : 'NOT POSTED'}
                </span>
              )}
              
              {/* Status Indicator Dot - Visual Clue for Approval Mode */}
              <div className="group relative ml-1">
                <div 
                  className={`w-2 h-2 rounded-full transition-all cursor-help ${
                    settingsLoading ? 'bg-gray-400 animate-pulse' : 
                    (settings?.strictApprovalMode ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]')
                  }`} 
                />
                <div className="absolute left-0 top-4 hidden group-hover:block bg-gray-800 text-white text-[10px] p-2 rounded-md shadow-xl whitespace-nowrap z-50 border border-gray-700">
                  <div className="font-bold mb-1 border-b border-gray-600 pb-1">System Mode</div>
                  <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                    <span className="text-gray-400">Policy:</span>
                    <span className={settings?.strictApprovalMode ? "text-indigo-300" : "text-emerald-300"}>
                      {settings?.strictApprovalMode ? 'Strict (Approval Required)' : 'Simple (Auto-Post)'}
                    </span>
                    <span className="text-gray-400">CID:</span>
                    <span className="font-mono opacity-70">{settings?.companyId?.slice(0, 8)}...</span>
                  </div>
                </div>
              </div>

              {win.data.status.toLowerCase() === 'pending' && win.data.metadata?.isEdited && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-50 text-amber-600 rounded-md border border-amber-100 animate-pulse">
                  (EDITED)
                </span>
              )}
              
              {/* Completion Status for Pending Vouchers - shows gate progress */}
              {win.data.status.toLowerCase() === 'pending' && (
                <div className="group relative cursor-help">
                  <span className={`px-2 py-0.5 text-[9px] font-semibold rounded-full ${
                    win.data.metadata?.pendingFinancialApproval 
                      ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' 
                      : win.data.metadata?.pendingCustodyConfirmations?.length > 0
                        ? 'bg-purple-50 text-purple-600 border border-purple-100'
                        : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                  }`}>
                    {win.data.metadata?.pendingFinancialApproval 
                      ? '⏳ Awaiting Approval' 
                      : win.data.metadata?.pendingCustodyConfirmations?.length > 0
                        ? `⏳ Custody (${win.data.metadata.pendingCustodyConfirmations.length})`
                        : '✓ All Gates Satisfied'}
                  </span>
                  {/* Tooltip with details */}
                  <div className="absolute left-0 top-5 hidden group-hover:block bg-gray-800 text-white text-[10px] p-2 rounded-md shadow-xl z-50 min-w-48">
                    <p className="font-bold border-b border-gray-600 pb-1 mb-1">Gate Status</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={win.data.metadata?.pendingFinancialApproval ? 'text-amber-300' : 'text-emerald-300'}>
                          {win.data.metadata?.pendingFinancialApproval ? '⏳' : '✓'}
                        </span>
                        <span>Financial Approval</span>
                      </div>
                      {win.data.metadata?.custodyConfirmationRequired && (
                        <div className="flex items-center gap-2">
                          <span className={win.data.metadata?.pendingCustodyConfirmations?.length > 0 ? 'text-amber-300' : 'text-emerald-300'}>
                            {win.data.metadata?.pendingCustodyConfirmations?.length > 0 ? '⏳' : '✓'}
                          </span>
                          <span>Custody ({win.data.metadata?.pendingCustodyConfirmations?.length || 0} pending)</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => minimizeWindow(win.id)}
            className="p-1.5 hover:bg-[var(--color-bg-tertiary)] rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            title="Minimize"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={() => maximizeWindow(win.id)}
            className="p-1.5 hover:bg-[var(--color-bg-tertiary)] rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            title={win.isMaximized ? "Restore" : "Maximize"}
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            onClick={handleCloseAttempt}
            className="p-1.5 hover:bg-danger-500/10 rounded-full text-[var(--color-text-muted)] hover:text-danger-500 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div 
            className="fixed inset-0 z-[9998]" 
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setContextMenu(null);
            }}
          />
          <div 
            className="fixed bg-[var(--color-bg-primary)] rounded-lg shadow-2xl border border-[var(--color-border)] z-[9999] py-1.5 w-52 transition-colors animate-in fade-in zoom-in duration-200"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <button
              onClick={() => {
                handleSave();
                setContextMenu(null);
              }}
              className="w-full px-4 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-3 transition-colors"
            >
              <Save className="w-4 h-4 text-[var(--color-text-secondary)]" />
              Save
            </button>
            <button
              onClick={() => {
                window.print();
                setContextMenu(null);
              }}
              className="w-full px-4 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-3 transition-colors"
            >
              <Printer className="w-4 h-4 text-[var(--color-text-secondary)]" />
              Print
            </button>
            
            {/* Show correction options for posted/approved vouchers that aren't already reversed */}
            {win.data && (win.data.status?.toLowerCase() === 'posted' || win.data.status?.toLowerCase() === 'approved') && !isReversal && !isAlreadyReversed && (
              <>
                <div className="border-t border-[var(--color-border)] my-1.5 opacity-50"></div>
                <button
                  onClick={() => {
                    const met = win.data?.metadata;
                    if (met?.reversedByVoucherId || met?.isReversed) return;
                    setCorrectionMode('REVERSE_ONLY');
                    setShowCorrectionModal(true);
                    setContextMenu(null);
                  }}
                  disabled={!!win.data?.metadata?.reversedByVoucherId || !!win.data?.metadata?.isReversed || win.data?.type === 'REVERSAL'}
                  className="w-full px-4 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-3 transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  {win.data?.metadata?.reversedByVoucherId || win.data?.metadata?.isReversed ? 'Already Reversed' : 'Reverse Voucher'}
                </button>
                {settings?.strictApprovalMode === false && (
                  <button
                    onClick={() => {
                      const met = win.data?.metadata;
                      if (met?.reversedByVoucherId || met?.isReversed) return;
                      setCorrectionMode('REVERSE_AND_REPLACE');
                      setShowCorrectionModal(true);
                      setContextMenu(null);
                    }}
                    disabled={!!win.data?.metadata?.reversedByVoucherId || !!win.data?.metadata?.isReversed || win.data?.type === 'REVERSAL'}
                    className="w-full px-4 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-3 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className="w-4 h-4 text-[var(--color-text-secondary)]" />
                    Reverse & Replace
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
            <div className="border-t border-[var(--color-border)] my-1.5 opacity-50"></div>
            <button
              onClick={() => {
                minimizeWindow(win.id);
                setContextMenu(null);
              }}
              className="w-full px-4 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-3 transition-colors"
            >
              <Minus className="w-4 h-4 text-[var(--color-text-secondary)]" />
              Minimize
            </button>
            <button
              onClick={() => {
                setContextMenu(null);
                handleCloseAttempt();
              }}
              className="w-full px-4 py-2 text-left text-sm text-danger-600 hover:bg-danger-50 flex items-center gap-3 transition-colors"
            >
              <X className="w-4 h-4" />
              Close
            </button>
          </div>
        </>
      )}

      {/* Voucher Content */}
      <div className="flex-1 overflow-y-auto p-4 bg-[var(--color-bg-primary)] overflow-x-hidden custom-scroll transition-colors">
        <GenericVoucherRenderer
          ref={rendererRef}
          definition={win.voucherType as any}
          mode="windows"
          initialData={win.data}
          readOnly={isVoucherReadOnly}
          onChange={(newData: any) => {
            setIsDirty(true);
            if (newData?.lines) {
              setLiveLines(newData.lines);
            }
          }}
          onBlur={() => {
            forceUpdate(prev => prev + 1);
          }}
        />
      </div>

      {/* Window Footer - Core Actions */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] transition-colors">
        {/* Totals Display */}
        <div className="flex items-center gap-4">
          {(() => {
            // Get current rows directly from live state update
            // Fallback to rendererRef for initial load only if liveLines is empty
            const rows = liveLines.length > 0 ? liveLines : (rendererRef.current?.getRows() || []);
            
            // For balanced state, we MUST use equivalent (Base Amount)
            const safeParse = (val: any) => {
              const num = parseFloat(val);
              return isNaN(num) ? 0 : num;
            };

            const getLineAmounts = (row: any) => {
              // Handle V2 Format (from onChange / liveLines)
              if (row.side) {
                const amount = safeParse(row.amount);
                const parity = safeParse(row.exchangeRate || row.parity || 1);
                const baseAmount = amount * parity;
                
                return {
                  debit: row.side === 'Debit' ? baseAmount : 0,
                  credit: row.side === 'Credit' ? baseAmount : 0
                };
              }
              
              // Handle V1 Format (from rendererRef / internal state)
              const parity = safeParse(row.parity || 1);
              return {
                debit: safeParse(row.debit) * parity,
                credit: safeParse(row.credit) * parity
              };
            };

            const totalDebit = rows.reduce((sum: number, row: any) => sum + getLineAmounts(row).debit, 0);
            const totalCredit = rows.reduce((sum: number, row: any) => sum + getLineAmounts(row).credit, 0);
            
            const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
            const hasValues = totalDebit > 0 || totalCredit > 0;
            
            // Gray when both are 0, green when balanced with values, red when unbalanced
            const bgColor = !hasValues ? 'bg-[var(--color-bg-tertiary)]' : (isBalanced ? 'bg-success-100/30 dark:bg-success-900/20' : 'bg-danger-100/30 dark:bg-danger-900/20');
            const borderColor = !hasValues ? 'border-[var(--color-border)]' : (isBalanced ? 'border-success-500/30' : 'border-danger-500/30');
            
            const baseCurrency = (win.voucherType as any)?.defaultCurrency || 'USD';
            
            return (
              <div className={`flex items-center gap-6 px-4 py-2 ${bgColor} rounded-md transition-all border ${borderColor} shadow-sm`}>
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest list-none">Total Debit ({baseCurrency})</span>
                  <span className="text-base font-bold text-[var(--color-text-primary)] font-mono">
                    {new Intl.NumberFormat('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(totalDebit)}
                  </span>
                </div>
                
                {/* Vertical Divider (Pipeline) */}
                <div className="w-[1px] h-5 bg-[var(--color-border)] opacity-50" />
                
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Total Credit ({baseCurrency})</span>
                  <span className="text-base font-bold text-[var(--color-text-primary)] font-mono">
                    {new Intl.NumberFormat('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(totalCredit)}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {!isVoucherReadOnly && (
            <button
              className="px-3 py-1.5 text-sm text-primary-600 hover:text-primary-700 font-bold transition-colors"
              onClick={handleNew}
              title="Create a new voucher in this window"
            >
              New
            </button>
          )}

          {(() => {
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
                    ? (isReversal ? "This is a reversal voucher and cannot be reversed again." : "This voucher has already been reversed.")
                    : "This voucher is locked. Create a reversal to correct it."
                  }
                >
                  <RotateCcw className="w-4 h-4" />
                  {isAlreadyReversed ? 'Already Reversed' : (isReversal ? 'Reversal' : 'Reverse Voucher')}
                </button>
              );
            }

            // FOR EDITABLE VOUCHERS: Show standard Save/Post logic
            return (
              <button
                onClick={handleSave}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 border ${
                  settingsLoading 
                    ? 'bg-[var(--color-bg-primary)] border-[var(--color-border)] text-[var(--color-text-primary)]' 
                    : forceStrictMode
                      ? 'bg-[var(--color-bg-primary)] border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'
                      : 'bg-emerald-600 text-white border-transparent hover:bg-emerald-700 shadow-sm'
                }`}
                disabled={isSaving || settingsLoading}
              >
                {isSaving || settingsLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {settingsLoading ? 'Loading...' : (forceStrictMode ? 'Saving...' : 'Posting...')}
                  </>
                ) : (
                  <>
                    {!forceStrictMode ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {(() => {
                      if (!forceStrictMode) {
                        return win.data?.postedAt ? 'Update & Post' : 'Save & Post';
                      }
                      const s = win.data?.status?.toLowerCase();
                      if (s === 'pending') return 'Update Pending Voucher';
                      return 'Save as Draft';
                    })()}
                  </>
                )}
              </button>
            );
          })()}
          
          {/* Submit button shown when strict mode is true OR it's a reversal */}
          {!settingsLoading && forceStrictMode && (!win.data?.status || win.data?.status?.toLowerCase() === 'draft' || win.data?.status?.toLowerCase() === 'rejected') && (
            <button
            onClick={handleSubmit}
            className="flex items-center gap-2 px-6 py-2 text-xs font-bold bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {isSubmitting ? 'Submitting...' : 'Submit Approval'}
          </button>
          )}

          {win.data?.status?.toLowerCase() === 'pending' && (
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  if (onApprove && win.data?.id) {
                    setIsSubmitting(true);
                    try {
                      await onApprove(win.data.id);
                      setIsDirty(false);
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
                Approve
              </button>

              {/* Confirm Custody Button - Only shown if user is a pending custodian */}
              {win.data?.metadata?.pendingCustodyConfirmations?.length > 0 && (
                <button
                  onClick={async () => {
                    if (onConfirm && win.data?.id) {
                      setIsSubmitting(true);
                      try {
                        await onConfirm(win.data.id);
                        setIsDirty(false);
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
                  Confirm Custody
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
                Reject
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Resize Handles - Only when not maximized */}
      {!win.isMaximized && (
        <>
          {/* Corner resize handles */}
          <div 
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
          />
          <div 
            className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, 'sw')}
          />
          <div 
            className="absolute top-0 right-0 w-4 h-4 cursor-nesw-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, 'ne')}
          />
          <div 
            className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, 'nw')}
          />
        </>
      )}
    </div>
    
    <UnsavedChangesModal 
      isOpen={showUnsavedModal}
      onCancel={() => setShowUnsavedModal(false)}
      onConfirm={handleConfirmClose}
    />

    {/* Confirmation Modal */}
    {showConfirmSubmitModal && (
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 animate-in fade-in duration-200">
        <div className="bg-white rounded-xl shadow-2xl w-96 p-6 border border-gray-100 scale-100 animate-in zoom-in-95 duration-200">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-12 h-12 bg-primary-50 rounded-full flex items-center justify-center text-primary-600">
              <Send size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Submit for Approval?</h3>
              <p className="text-sm text-gray-500 mt-1">This will lock the voucher and notify approvers. You cannot edit it afterwards.</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3 w-full mt-2">
              <button 
                onClick={() => setShowConfirmSubmitModal(false)}
                className="px-4 py-2 text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmSubmit}
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
        <div className="bg-white rounded-xl shadow-2xl w-96 p-6 border border-gray-100 scale-100 animate-in zoom-in-95 duration-200">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 bg-success-50 rounded-full flex items-center justify-center text-success-600 mb-2">
              <CheckCircle size={32} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                {win.data?.status?.toLowerCase() === 'posted' ? 'Posted Successfully!' : 
                 win.data?.status?.toLowerCase() === 'draft' ? 'Saved Successfully!' : 
                 'Submitted Successfully!'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {win.data?.status?.toLowerCase() === 'posted' ? 'Voucher has been posted to the ledger.' : 
                 win.data?.status?.toLowerCase() === 'draft' ? 'Voucher saved as draft.' : 
                 'Voucher has been sent for approval.'}
              </p>
            </div>
            
            <div className="flex flex-col gap-3 w-full mt-4">
              <button 
                onClick={handleSuccessNew}
                className="w-full px-4 py-3 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Plus size={16} /> Create Another Voucher
              </button>
              <button 
                onClick={handleSuccessClose}
                className="w-full px-4 py-3 text-sm font-bold text-gray-700 bg-white border-2 border-gray-100 hover:border-gray-200 hover:bg-gray-50 rounded-xl transition-all"
              >
                Close Window
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
        // 1. Update local window data with reversal linkage
        updateWindowData(win.id, { 
          ...win.data, 
          // Inject reversal info into metadata so UI buttons respond immediately
          metadata: {
            ...win.data?.metadata,
            reversedByVoucherId: result.reverseVoucherId,
            isReversed: true
          }
        });
        
        // 2. TRIGGER GLOBAL REFRESH for the list page
        globalThis.window.dispatchEvent(new CustomEvent('vouchers-updated'));
        
        errorHandler.showSuccess('Voucher reversal submitted for approval.');
        setShowCorrectionModal(false);
      }}
    />
    </>
  );
};
