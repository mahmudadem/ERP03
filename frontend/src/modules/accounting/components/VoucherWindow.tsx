
 /**
 * Voucher Window Component - Legacy Style
 * 
 * Floating, draggable, resizable window matching legacy design.
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Minus, Square, ChevronDown, Save, Printer, Loader2, Send, AlertTriangle, CheckCircle, Plus, RotateCcw, RefreshCw, Ban, Check, Lock, Zap, Globe, FileText } from 'lucide-react';
import { GenericVoucherRenderer, GenericVoucherRendererRef } from './shared/GenericVoucherRenderer';
import { UIWindow as UIWindowType } from '../../../context/WindowManagerContext';
import { useWindowManager } from '../../../context/WindowManagerContext';
import { accountingApi } from '../../../api/accountingApi';
import { errorHandler } from '../../../services/errorHandler';
import { clsx } from 'clsx';
import { UnsavedChangesModal } from './shared/UnsavedChangesModal';
import { VoucherCorrectionModal } from './VoucherCorrectionModal';
import { RateDeviationDialog } from './shared/RateDeviationDialog';
import { checkVoucherRateDeviations, RateDeviationResult } from '../utils/rateDeviationCheck';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { PolicyGovernanceIndicator } from './PolicyGovernanceIndicator';
import { VoucherTotalsDisplay } from './VoucherTotalsDisplay';
import { useVoucherTotals } from '../hooks/useVoucherTotals';
import { useAuth } from '../../../hooks/useAuth';
import { AccountingPolicyConfig } from '../../../api/accountingApi';
import { PostingLockPolicy } from '../../../types/accounting/PostingLockPolicy';

import { getCompanyToday } from '../../../utils/dateUtils';
import { isActionAvailable, VoucherActionContext } from '../utils/voucherActions';

interface VoucherWindowProps {
  win: UIWindowType;
  onSave: (id: string, data: any) => Promise<any>;
  onSubmit: (id: string, data: any) => Promise<any>;
  onApprove?: (id: string) => Promise<void>;
  onReject?: (id: string) => Promise<void>;
  onConfirm?: (id: string) => Promise<void>;
  onPost?: (id: string) => Promise<void>;
  onCancel?: (id: string) => Promise<void>;
  onReverse?: (id: string) => Promise<void>;
  onPrint?: (id: string) => void;
}

export const VoucherWindow: React.FC<VoucherWindowProps> = ({ 
  win, 
  onSave,
  onSubmit,
  onApprove,
  onReject,
  onConfirm,
  onPost,
  onCancel,
  onReverse,
  onPrint
}) => {
  const { closeWindow, minimizeWindow, maximizeWindow, focusWindow, updateWindowPosition, updateWindowSize, updateWindowData } = useWindowManager();
  const { settings, isLoading: settingsLoading, refresh: refreshSettings, updateSettings } = useCompanySettings();
  const { user } = useAuth();
  const { t } = useTranslation('accounting');
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
  const [isPendingNew, setIsPendingNew] = useState(false);
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
  const [successAction, setSuccessAction] = useState<'SUBMIT' | 'APPROVE' | 'CONFIRM_CUSTODY' | 'POST' | null>(null);

  // NOTE: Totals are now calculated exclusively by useVoucherTotals hook (see below, ~line 170).
  // The old duplicate useMemo (totalDebitCalc/totalCreditCalc/isBalanced) has been removed.
  // All validation, button state, and display now use: totalDebitVoucher, totalCreditVoucher, isBalancedVoucher.

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

  const isVoucherStrict = React.useMemo(() => {
    return win.data?.metadata?.creationMode === 'STRICT' || 
           win.data?.postingLockPolicy === PostingLockPolicy.STRICT_LOCKED;
  }, [win.data?.metadata?.creationMode, win.data?.postingLockPolicy]);
  
  // Totals Calculation (Unified Logic)
  // Use live data from renderer to ensure rate changes are reflected immediately
  const renderData = rendererRef.current?.getData();
  const renderRows = rendererRef.current?.getRows();
  
  // Fallback to win.data if renderer is not ready (initial load)
  const headerRate = parseFloat(renderData?.exchangeRate || win.data?.exchangeRate) || 1;
  const calculationLines = (renderRows && renderRows.length > 0) ? renderRows : liveLines;
  const normalizedTypeKey = React.useMemo(() => {
    const rawType = (
      (win.data?.voucherConfig as any)?.baseType ||
      (win.data?.voucherConfig as any)?.code ||
      win.data?.type ||
      renderData?.type ||
      ''
    ).toString().toLowerCase();
    return rawType;
  }, [win.data?.voucherConfig, win.data?.type, renderData?.type]);
  const isReceiptType = normalizedTypeKey.includes('receipt');
  const isPaymentType = normalizedTypeKey.includes('payment');
  const isSemanticAmountType = isReceiptType || isPaymentType;
  const semanticLineAccountKey = isReceiptType ? 'receiveFromAccountId' : (isPaymentType ? 'payToAccountId' : null);
  const semanticHeaderAccountKey = isReceiptType ? 'depositToAccountId' : (isPaymentType ? 'payFromAccountId' : null);

  // Detect if voucher is posted/approved (stored in Base Currency Equivalents)
  const isPosted = win.data?.status === 'posted' || 
                   win.data?.status === 'approved' || 
                   !!win.data?.metadata?.isPosted;

  const { 
    totalDebitVoucher, 
    totalCreditVoucher, 
    isBalanced: isBalancedVoucher, 
    differenceVoucher 
  } = useVoucherTotals(calculationLines, headerRate, isPosted, isSemanticAmountType ? 'semantic' : 'journal');

  const isSystemStrict = React.useMemo(() => {
    return settings?.strictApprovalMode === true;
  }, [settings?.strictApprovalMode]);

  const refreshVoucher = async () => {
    if (!win.data?.id) return;
    try {
      const updated = await accountingApi.getVoucher(win.data.id);
      // PRESERVE voucherConfig: It's NOT returned by the backend but is REQUIRED for rendering.
      updateWindowData(win.id, { 
        ...updated, 
        voucherConfig: win.data?.voucherConfig 
      });
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
    if (isPendingNew) {
      performNew();
      setIsPendingNew(false);
    } else {
      closeWindow(win.id);
    }
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

  const normalizeSemanticPayload = (rawData: any): any => {
    if (!isSemanticAmountType || !semanticLineAccountKey || !semanticHeaderAccountKey) {
      return rawData;
    }

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

    const rows = rendererRef.current?.getRows() || calculationLines || [];

    const resolvedHeaderAccount =
      toAccountRef(rawData?.[semanticHeaderAccountKey]) ||
      toAccountRef(rawData?.metadata?.[semanticHeaderAccountKey]) ||
      toAccountRef(rawData?.accountId) ||
      toAccountRef(rawData?.metadata?.accountId) ||
      toAccountRef(rawData?.account) ||
      toAccountRef(rawData?.metadata?.account) ||
      toAccountRef(renderData?.[semanticHeaderAccountKey]) ||
      toAccountRef(renderData?.metadata?.[semanticHeaderAccountKey]) ||
      toAccountRef(renderData?.accountId) ||
      toAccountRef(renderData?.metadata?.accountId) ||
      toAccountRef(renderData?.account) ||
      toAccountRef(renderData?.metadata?.account) ||
      toAccountRef(win.data?.[semanticHeaderAccountKey]) ||
      toAccountRef(win.data?.metadata?.[semanticHeaderAccountKey]) ||
      toAccountRef(win.data?.accountId) ||
      toAccountRef(win.data?.metadata?.accountId) ||
      toAccountRef(win.data?.account);

    const semanticLines = (rows || [])
      .map((row: any) => {
        const dynamicAccountKey = Object.keys(row || {}).find(k => k.toLowerCase().includes('account'));
        const accountRef =
          toAccountRef(row?.[semanticLineAccountKey]) ||
          toAccountRef(row?.accountId) ||
          toAccountRef(row?.account) ||
          toAccountRef(dynamicAccountKey ? row?.[dynamicAccountKey] : undefined) ||
          toAccountRef(row?.metadata?.[semanticLineAccountKey]) ||
          toAccountRef(row?.metadata?.accountId) ||
          toAccountRef(row?.metadata?.account);

        const amount = Math.abs(Number(row?.amount ?? row?.debit ?? row?.credit ?? 0));
        const notes = row?.notes || row?.description || '';
        const costCenterId = row?.costCenterId || row?.costCenter || null;
        const metadata = row?.metadata || {};
        const lineCurrency = String(row?.currency || row?.lineCurrency || '').toUpperCase();
        const lineParity = Number(row?.parity ?? row?.exchangeRate ?? 1) || 1;

        if (isReceiptType) {
          return {
            receiveFromAccountId: accountRef,
            amount,
            notes,
            costCenterId,
            currency: lineCurrency || undefined,
            lineCurrency: lineCurrency || undefined,
            exchangeRate: lineParity,
            parity: lineParity,
            metadata
          };
        }
        return {
          payToAccountId: accountRef,
          amount,
          notes,
          costCenterId,
          currency: lineCurrency || undefined,
          lineCurrency: lineCurrency || undefined,
          exchangeRate: lineParity,
          parity: lineParity,
          metadata
        };
      })
      .filter((line: any) => {
        const accountRef = isReceiptType ? line.receiveFromAccountId : line.payToAccountId;
        return !!accountRef && Number(line.amount) > 0;
      });

    return {
      ...rawData,
      [semanticHeaderAccountKey]: resolvedHeaderAccount,
      lines: semanticLines
    };
  };

  const buildVoucherPayload = (formData: any, statusOverride?: string): any => {
    const formId =
      formData?.formId ||
      win.data?.formId ||
      (win.data?.voucherConfig as any)?.id;

    const typeId =
      formData?.typeId ||
      (win.data?.voucherConfig as any)?.baseType ||
      win.data?.voucherConfig?.id;

    return {
      ...formData,
      ...(formId ? { formId } : {}),
      ...(typeId ? { typeId } : {}),
      metadata: {
        ...(formData?.metadata || {}),
        ...(formId ? { formId } : {}),
        creationMode: settings?.strictApprovalMode ? 'STRICT' : 'FLEXIBLE'
      },
      status: typeof statusOverride === 'string'
        ? statusOverride
        : (formData?.status || win.data?.status || 'draft')
    };
  };

  const handleSave = async () => {
    if (!rendererRef.current) {
      return;
    }
    
    const formData = normalizeSemanticPayload(rendererRef.current.getData());
    const baseCurrency = (win.data?.voucherConfig as any)?.defaultCurrency || settings?.baseCurrency || 'SYP';
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
    if (!isBalancedVoucher) {
      errorHandler.showError(
        `Voucher is not balanced (${baseCurrency}). ` +
        `Total Debit: ${totalDebitVoucher.toLocaleString(undefined, { minimumFractionDigits: 2 })}, ` +
        `Total Credit: ${totalCreditVoucher.toLocaleString(undefined, { minimumFractionDigits: 2 })}. ` +
        `Diff: ${differenceVoucher.toLocaleString(undefined, { minimumFractionDigits: 2 })}. ` +
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
      const payload = buildVoucherPayload(formData);

      const result = await onSave(win.id, payload);
      
      // Sync saved state (ID, Status, Numbers)
      if (result) {
        // CRITICAL: Preserve the template config so the screen doesn't go white
        updateWindowData(win.id, { 
          ...result, 
          voucherConfig: win.data?.voucherConfig 
        });
      }

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
    
    const formData = normalizeSemanticPayload(rendererRef.current.getData());
    const baseCurrency = (win.data?.voucherConfig as any)?.defaultCurrency || settings?.baseCurrency || '';
    
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
    if (!isBalancedVoucher) {
      setShowConfirmSubmitModal(false);
      errorHandler.showError(
        `Voucher is not balanced (${baseCurrency}). ` +
        `Total Debit: ${totalDebitVoucher.toLocaleString(undefined, { minimumFractionDigits: 2 })}, ` +
        `Total Credit: ${totalCreditVoucher.toLocaleString(undefined, { minimumFractionDigits: 2 })}. ` +
        `Diff: ${differenceVoucher.toLocaleString(undefined, { minimumFractionDigits: 2 })}. ` +
        `Please ensure the voucher balances before submitting.`
      );
      return;
    }
    
    setShowConfirmSubmitModal(false);
    setIsSubmitting(true);
    
    try {
      const submissionData = buildVoucherPayload(formData, 'submitted');

      const result = await onSubmit(win.id, submissionData);
      
      // On Success: Sync saved state (including ID/Status)
      if (result) {
        // CRITICAL: Preserve the template config so the screen doesn't go white
        updateWindowData(win.id, { 
          ...result, 
          voucherConfig: win.data?.voucherConfig 
        });
      }
      
      setIsDirty(false);
      setSuccessAction('SUBMIT');
      setShowSuccessModal(true);
    } catch (error: any) {
      // HANDLE PARTIAL SUCCESS: If save succeeded but submit failed
      if (error.savedVoucher) {
        // Sync the ID so further clicks UPDATE instead of CREATE
        // CRITICAL: Preserve the template config so the screen doesn't go white
        updateWindowData(win.id, { 
          ...error.savedVoucher, 
          voucherConfig: win.data?.voucherConfig 
        });
        
        setIsDirty(false); // It's saved on server now, no longer technically "dirty"
        
        // Enhance error message to explain the state
        const originalMsg = error.message || 'Unknown error';
        error.message = `Voucher saved as draft, but couldn't be submitted: ${originalMsg}`;
      }
      
      errorHandler.showError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!win.data?.id) return;
    try {
      // Use centralized handler if available, fallback to direct API call
      if (onCancel) {
        await onCancel(win.data.id);
      } else {
        await accountingApi.cancelVoucher(win.data.id);
        errorHandler.showSuccess('Voucher cancelled successfully');
        globalThis.window.dispatchEvent(new CustomEvent('vouchers-updated'));
      }
      setContextMenu(null);
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

  const handleNew = () => {
    if (isDirty) {
      setIsPendingNew(true);
      setShowUnsavedModal(true);
    } else {
      performNew();
    }
  };

  const performNew = () => {
    if (rendererRef.current) {
      rendererRef.current.resetData();
    }
      
    // Reset ALL local window states
    setIsDirty(false);
    setLiveLines([]);
    setLiveCurrency(settings?.baseCurrency || '');
    setShowSuccessModal(false);
    setShowCorrectionModal(false);
    setContextMenu(null);
    
    // Build a completely CLEAN data object — no spreading of old voucher data
    // Only preserve the form definition so the renderer knows which template to use
    const cleanData: Record<string, any> = {
      voucherConfig: win.data?.voucherConfig,
      formId: win.data?.voucherConfig?.id,
      type: win.data?.voucherConfig?.code || win.data?.voucherConfig?.id,
      status: 'Draft',
      date: getCompanyToday(settings),
      currency: settings?.baseCurrency || '',
      baseCurrency: settings?.baseCurrency || '',
      exchangeRate: 1,
      lines: [],
      metadata: {},
      // Explicitly undefined — these must NOT carry over
      id: undefined,
      voucherNo: undefined,
      voucherNumber: undefined,
      description: '',
      reference: '',
      notes: '',
      postedAt: undefined,
      approvedAt: undefined,
      approvedBy: undefined,
      postingLockPolicy: undefined,
    };
    
    // Update window context to reflect the clean state
    updateWindowData(win.id, cleanData);
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
        className="window-header relative z-50 flex items-center justify-between px-3 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] cursor-move select-none"
        onMouseDown={handleMouseDown}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setContextMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-sm text-[var(--color-text-primary)]">
            {win.data?.id
              ? t('voucherEditor.existingTitle', { name: win.data?.voucherConfig?.name || win.title, id: win.data?.voucherNumber || win.data?.voucherNo || win.data?.id || '' })
              : t('voucherEditor.newTitle', { name: win.data?.voucherConfig?.name || win.title })}
          </h3>
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
                {t(`statuses.${win.data.status.toLowerCase()}`, { defaultValue: win.data.status })}
              </span>
              
              {/* V1: Posting Badge (derived from postedAt) */}
              {(win.data.status.toLowerCase() === 'approved' || win.data.status.toLowerCase() === 'posted') && (
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                  win.data.postedAt 
                    ? 'bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-orange-100/80 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                }`}>
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

              {win.data.status.toLowerCase() === 'pending' && win.data.metadata?.isEdited && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-50 text-amber-600 rounded-md border border-amber-100 animate-pulse">
                  {t('voucherWindow.edited', { defaultValue: 'Edited' })}
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
                      setContextMenu(null);
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
          definition={win.data?.voucherConfig as any}
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
            const hasValues = totalDebitVoucher > 0 || totalCreditVoucher > 0;
            
            // Use live currency from renderer/state FIRST, fall back to saved data
            const voucherCurrency = liveCurrency || 
                                   rendererRef.current?.getData()?.currency || 
                                   win.data?.currency || 
                                   settings?.baseCurrency || '';
            
            return (
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
            );
          })()}
        </div>

        {/* Action Buttons */}
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
            <div className="flex items-center gap-2">
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
                {t('voucherWindow.post', 'Post to Ledger')}
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
      onCancel={() => {
        setShowUnsavedModal(false);
        setIsPendingNew(false);
      }}
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
              <h3 className="text-lg font-bold text-gray-900">{t('voucherWindow.confirmSubmitTitle', 'Submit for Approval?')}</h3>
              <p className="text-sm text-gray-500 mt-1">{t('voucherWindow.confirmSubmitBody', 'This will lock the voucher and notify approvers. You cannot edit it afterwards.')}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3 w-full mt-2">
              <button 
                onClick={() => setShowConfirmSubmitModal(false)}
                className="px-4 py-2 text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button 
                onClick={handleConfirmSubmit}
                className="px-4 py-2 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-md transition-all active:scale-[0.98]"
              >
                {t('voucherWindow.confirmSubmit', 'Confirm Submit')}
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
};
