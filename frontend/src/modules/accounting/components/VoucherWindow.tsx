
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
import { RateDeviationDialog } from './shared/RateDeviationDialog';
import { checkVoucherRateDeviations, RateDeviationResult } from '../utils/rateDeviationCheck';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { AccountingPolicyConfig } from '../../../api/accountingApi';
import { PostingLockPolicy } from '../../../types/accounting/PostingLockPolicy';
import { roundMoney } from '../../../utils/mathUtils';

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
  const [liveCurrency, setLiveCurrency] = useState<string>(win.data?.currency || '');
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionMode, setCorrectionMode] = useState<'REVERSE_ONLY' | 'REVERSE_AND_REPLACE'>('REVERSE_ONLY');
  const isInitialLoadRef = useRef(true); // Track initial load to prevent false dirty state
  const [policyConfig, setPolicyConfig] = useState<AccountingPolicyConfig | null>(null);
  const [policyLoading, setPolicyLoading] = useState(true);
  
  // Rate Deviation Warning State
  const [rateDeviationResult, setRateDeviationResult] = useState<RateDeviationResult | null>(null);
  const [pendingSaveData, setPendingSaveData] = useState<any>(null);
  const [isCheckingRates, setIsCheckingRates] = useState<boolean>(false);

  // Memoized Totals & Balance State
  const { totalDebitCalc, totalCreditCalc, isBalanced } = React.useMemo(() => {
    const rows = liveLines.length > 0 ? liveLines : (rendererRef.current?.getRows() || []);
    let td = 0;
    let tc = 0;

    for (const row of rows) {
      let debit = Number(row.debit) || 0;
      let credit = Number(row.credit) || 0;

      // Fallback: if debit/credit are both 0, try side/amount format
      if (debit === 0 && credit === 0 && row.side && row.amount) {
        const amt = Number(row.amount) || 0;
        if (row.side.toLowerCase() === 'debit') debit = amt;
        else if (row.side.toLowerCase() === 'credit') credit = amt;
      }

      // Apply parity for base currency equivalent and ROUND each line
      const parity = Number(row.parity) || Number(row.exchangeRate) || 1;
      td = roundMoney(td + roundMoney(debit * parity));
      tc = roundMoney(tc + roundMoney(credit * parity));
    }

    // Increased tolerance (0.1) to allow for "Penny Balancing" residuals
    const balanced = Math.abs(td - tc) <= 0.1;
    
    return { 
      totalDebitCalc: td, 
      totalCreditCalc: tc, 
      isBalanced: balanced 
    };
  }, [liveLines, forceUpdate, win.data?.id]);

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

  // Sync liveLines with win.data?.lines when it changes (e.g., after async fetch)
  useEffect(() => {
    if (win.data?.lines && win.data.lines.length > 0) {
      // Normalize lines to ensure debit/credit fields exist
      const normalized = win.data.lines.map((l: any) => {
        const debit = l.debit !== undefined ? l.debit : (l.side === 'Debit' ? l.amount : 0);
        const credit = l.credit !== undefined ? l.credit : (l.side === 'Credit' ? l.amount : 0);
        return { ...l, debit, credit };
      });
      setLiveLines(normalized);
    }
  }, [win.data?.lines]);

  // Sync liveLines from rendererRef after initial render to ensure totals display correctly
  // ONLY if liveLines is still empty (renderer hasn't been populated by win.data.lines yet)
  useEffect(() => {
    const syncFromRenderer = () => {
      // Only sync if we don't already have liveLines from win.data.lines
      if (liveLines.length > 0) {
        return;
      }
      
      const rendererRows = rendererRef.current?.getRows();
      if (rendererRows && rendererRows.length > 0) {
        // Check if rows have actual data (not just empty placeholders)
        const hasData = rendererRows.some((r: any) => 
          (parseFloat(r.debit) || 0) > 0 || (parseFloat(r.credit) || 0) > 0 || r.accountId
        );
        if (hasData) {
          setLiveLines(rendererRows);
        }
      }
    };
    
    // Initial sync after a short delay to allow renderer to initialize
    const timer = setTimeout(syncFromRenderer, 100);
    return () => clearTimeout(timer);
  }, [win.data?.id, liveLines.length]); // Re-run when voucher ID changes

  // Mark initial load as complete after a short delay
  // ONLY after policy loading is finished to prevent false dirty states from default values
  useEffect(() => {
    if (!policyLoading) {
      const timer = setTimeout(() => {
        isInitialLoadRef.current = false;
      }, 800); // Allow 800ms for initial data transformation and policy settlement
      return () => clearTimeout(timer);
    }
  }, [policyLoading]);

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
    const baseCurrency = (win.voucherType as any)?.defaultCurrency || settings?.baseCurrency || 'SYP';
    const voucherCurrency = formData.currency || baseCurrency;
    const headerRate = parseFloat(formData.exchangeRate) || 1;
    
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
    if (!isBalanced) {
      errorHandler.showError(
        `Voucher is not balanced in base currency (${baseCurrency}). ` +
        `Total Debit: ${totalDebitCalc.toLocaleString(undefined, { minimumFractionDigits: 2 })}, ` +
        `Total Credit: ${totalCreditCalc.toLocaleString(undefined, { minimumFractionDigits: 2 })}. ` +
        `Diff: ${Math.abs(totalDebitCalc - totalCreditCalc).toLocaleString(undefined, { minimumFractionDigits: 2 })}. ` +
        `Please ensure the voucher balances before saving.`
      );
      return;
    }
    
    // RATE DEVIATION CHECK: Compare effective rate vs system rate before save
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
          // Store data and show dialog
          setPendingSaveData(formData);
          setRateDeviationResult(deviationResult);
          setIsCheckingRates(false);
          return; // Wait for user confirmation
        }
      } catch (error) {
        console.error('Rate deviation check failed:', error);
        // Continue with save if check fails
      } finally {
        setIsCheckingRates(false);
      }
    }

    // Proceed with normal save
    await performSave(formData);
  };

  const performSave = async (formData: any) => {
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

  const handleRateDeviationSync = async () => {
    if (rateDeviationResult && pendingSaveData) {
      const voucherDate = (pendingSaveData as any).date || new Date().toISOString().split('T')[0];
      const baseCurrency = settings?.baseCurrency || 'SYP';
      
      try {
        // Bulk sync all deviated rates to the system history for the voucher date
        await Promise.all(
          rateDeviationResult.warnings.map(warning => 
            accountingApi.saveExchangeRate(warning.lineCurrency, baseCurrency, warning.effectiveRate, voucherDate)
          )
        );
        
        errorHandler.showSuccess(`Synced ${rateDeviationResult.warnings.length} rate(s) to system for ${voucherDate}`);
        
        // Proceed with voucher save
        await performSave(pendingSaveData);
      } catch (error) {
        console.error('Failed to sync rates:', error);
        errorHandler.showError('Successfully saved voucher with your rates, but some system rate updates failed.');
        // Fallback: Still save the voucher even if sync fails
        await performSave(pendingSaveData);
      } finally {
        setPendingSaveData(null);
        setRateDeviationResult(null);
      }
    }
  };

  const handleRateDeviationConfirm = async () => {
    if (pendingSaveData) {
      await performSave(pendingSaveData);
      setPendingSaveData(null);
      setRateDeviationResult(null);
    }
  };

  const handleRateDeviationCancel = () => {
    setPendingSaveData(null);
    setRateDeviationResult(null);
  };

  // Handle submit for approval - Stage 1 (Confirmation)
  const handleSubmit = () => {
    setShowConfirmSubmitModal(true);
  };

  // Handle submit for approval - Stage 2 (Execution)
  const handleConfirmSubmit = async () => {
    if (!rendererRef.current) return;
    
    const formData = rendererRef.current.getData();
    const baseCurrency = (win.voucherType as any)?.defaultCurrency || settings?.baseCurrency || '';
    
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
    if (!isBalanced) {
      setShowConfirmSubmitModal(false);
      errorHandler.showError(
        `Voucher is not balanced in base currency (${baseCurrency}). ` +
        `Total Debit: ${totalDebitCalc.toLocaleString(undefined, { minimumFractionDigits: 2 })}, ` +
        `Total Credit: ${totalCreditCalc.toLocaleString(undefined, { minimumFractionDigits: 2 })}. ` +
        `Diff: ${Math.abs(totalDebitCalc - totalCreditCalc).toLocaleString(undefined, { minimumFractionDigits: 2 })}. ` +
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
    // While loading policies, default to ReadOnly for safety
    if (!win.data?.status || policyLoading) return true;
    
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
    if (!settingsLoading && !policyLoading && settings) {
      console.log('[VoucherWindow] Active Settings:', {
        companyId: settings.companyId,
        strictApprovalMode: settings.strictApprovalMode,
        isVoucherReadOnly,
        policyLoading
      });
    }
  }, [settings, settingsLoading, policyLoading, isVoucherReadOnly]);

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
                      {settings?.strictApprovalMode ? 'Strict (Approval Required)' : 'Flexible (Auto-Post)'}
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
      <div className="flex-1 overflow-y-auto p-4 bg-[var(--color-bg-primary)] overflow-x-auto custom-scroll transition-colors">
        <GenericVoucherRenderer
          ref={rendererRef}
          definition={win.voucherType as any}
          mode="windows"
          initialData={win.data}
          readOnly={isVoucherReadOnly}
          onChange={(newData: any) => {
            // Never set dirty for read-only vouchers - they cannot be edited
            if (!isInitialLoadRef.current && !isVoucherReadOnly) {
              setIsDirty(true);
            }
            if (newData) {
               if (newData.currency) {
                 setLiveCurrency(newData.currency);
               }
               if (newData.lines && Array.isArray(newData.lines)) {
                  // Only update liveLines if the new lines have actual data
                  const hasRealData = newData.lines.some((l: any) => 
                    (parseFloat(l.debit) || 0) > 0 || 
                    (parseFloat(l.credit) || 0) > 0 || 
                    l.accountId
                  );
                  if (hasRealData) {
                    setLiveLines(newData.lines);
                  }
               }
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
            const rows = liveLines.length > 0 ? liveLines : (rendererRef.current?.getRows() || []);
            const hasValues = totalDebitCalc > 0 || totalCreditCalc > 0;
            
            // Gray when both are 0, green when balanced with values, red when unbalanced
            const bgColor = !hasValues ? 'bg-[var(--color-bg-tertiary)]' : (isBalanced ? 'bg-success-100/30 dark:bg-success-900/20' : 'bg-danger-100/30 dark:bg-danger-900/20');
            const borderColor = !hasValues ? 'border-[var(--color-border)]' : (isBalanced ? 'border-success-500/30' : 'border-danger-500/30');
            
            const liveData = rendererRef.current?.getData();
            const voucherCurrency = liveCurrency || 
                                   liveData?.currency || 
                                   win.data?.currency || 
                                   rows.find((r: any) => r.currency)?.currency || 
                                   (win.voucherType as any)?.defaultCurrency || 
                                   settings?.baseCurrency || '';
            
            return (
              <div className="flex flex-col gap-2">
                <div className={`flex items-center gap-6 px-4 py-2 ${bgColor} rounded-md transition-all border ${borderColor} shadow-sm`}>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest list-none">Total Debit ({voucherCurrency})</span>
                    <span className="text-base font-bold text-[var(--color-text-primary)] font-mono">
                      {new Intl.NumberFormat('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(totalDebitCalc)}
                    </span>
                  </div>
                  
                  {/* Vertical Divider (Pipeline) */}
                  <div className="w-[1px] h-5 bg-[var(--color-border)] opacity-50" />
                  
                  <div className="flex items-baseline gap-2">
                    <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Total Credit ({voucherCurrency})</span>
                    <span className="text-base font-bold text-[var(--color-text-primary)] font-mono">
                      {new Intl.NumberFormat('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(totalCreditCalc)}
                    </span>
                  </div>
                </div>

                {!isBalanced && hasValues && (
                  <div className="flex items-center gap-1.5 px-2 text-[10px] font-bold text-danger-600 dark:text-danger-400 uppercase tracking-tight animate-pulse">
                    <AlertTriangle size={12} strokeWidth={3} />
                    Voucher Unbalanced: {Math.abs(totalDebitCalc - totalCreditCalc).toFixed(2)} {voucherCurrency} difference
                  </div>
                )}
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
            // UNIFIED LOADING STATE: Prevent button flicker while policies are fetching
            if (settingsLoading || policyLoading) {
              return (
                <div className="flex items-center gap-2 px-6 py-2 bg-gray-100 text-gray-400 border border-gray-200 rounded-lg animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs font-bold">Loading Policies...</span>
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
                    ? (isReversal ? "This is a reversal voucher and cannot be reversed again." : "This voucher has already been reversed.")
                    : "This voucher is locked. Create a reversal to correct it."
                  }
                >
                  <RotateCcw className="w-4 h-4" />
                  {isAlreadyReversed ? 'Already Reversed' : (isReversal ? 'Reversal' : 'Reverse Voucher')}
                </button>
              );
            }

            const currentRows = liveLines.length > 0 ? liveLines : (rendererRef.current?.getRows() || []);
            const hasLines = currentRows.filter(r => r.accountId && (Number(r.debit) > 0 || Number(r.credit) > 0)).length >= 2;
            const canSave = isBalanced && hasLines;

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
                title={!isBalanced ? "Voucher must be balanced to save" : !hasLines ? "Voucher must have at least 2 lines" : ""}
              >
                {isSaving || settingsLoading || policyLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {settingsLoading || policyLoading ? 'Loading...' : (forceStrictMode ? 'Saving...' : 'Posting...')}
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
          {(() => {
            return !settingsLoading && !policyLoading && forceStrictMode && (!win.data?.status || win.data?.status?.toLowerCase() === 'draft' || win.data?.status?.toLowerCase() === 'rejected') && (
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 px-6 py-2 text-xs font-bold bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-sm disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                disabled={isSubmitting || !isBalanced}
                title={!isBalanced ? "Voucher must be balanced to submit" : ""}
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {isSubmitting ? 'Submitting...' : 'Submit Approval'}
              </button>
            );
          })()}

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

          {/* Post Button for APPROVED vouchers that are not yet posted */}
          {win.data?.status?.toLowerCase() === 'approved' && !win.data?.postedAt && (
            <div className="flex items-center gap-2">
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
                Post to Ledger
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
};
