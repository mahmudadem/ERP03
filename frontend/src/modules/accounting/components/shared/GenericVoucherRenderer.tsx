import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { VoucherTypeDefinition } from '../../../../designer-engine/types/VoucherTypeDefinition';
import { JournalRow } from '../../forms-designer/types';
import { Plus, Trash2, Calendar, ChevronDown, Download, Image as ImageIcon, Loader2, Printer, Mail, Save, Send, FileText, Check, X, Upload, FileSpreadsheet } from 'lucide-react';
import { CurrencyExchangeWidget } from './CurrencyExchangeWidget';
import { AccountSelector } from './AccountSelector';
import { CostCenterSelector } from './CostCenterSelector';
import { CurrencySelector } from './CurrencySelector';
import { AmountInput } from './AmountInput';
import { CustomComponentRegistry } from './registry';
import { Account } from '../../../../context/AccountsContext';
import { useAccounts } from '../../../../context/AccountsContext';
import { useCompanySettings } from '../../../../hooks/useCompanySettings';
import { formatCompanyDate, formatCompanyTime, formatForInput, getCompanyToday } from '../../../../utils/dateUtils';
import { DatePicker } from './DatePicker';
import { useCompanyAccess } from '../../../../context/CompanyAccessContext';
import { accountingApi } from '../../../../api/accountingApi';
import { useCompanyCurrencies } from '../../hooks/useCompanyCurrencies';
import { CurrencyDropdown } from './CurrencyDropdown';
import { PaymentMethodDropdown } from './PaymentMethodDropdown';
import { roundMoney } from '../../../../utils/mathUtils';

interface GenericVoucherRendererProps {
  definition: VoucherTypeDefinition;
  mode?: 'classic' | 'windows';
  initialData?: any;
  onChange?: (data: any) => void;
  onBlur?: () => void;
  readOnly?: boolean;
}

// Helper to get initial rows with unique IDs
const getInitialRows = () => Array.from({ length: 5 }, (_, i) => ({
  id: -(Date.now() + i), // Negative IDs for local draft rows
  account: '',
  notes: '',
  debit: 0,
  credit: 0,
  currency: '',
  parity: 1.0,
  equivalent: 0,
  category: '',
  metadata: {}
}));

export interface GenericVoucherRendererRef {
  getData: () => any;
  getRows: () => JournalRow[];
  resetData: () => void;
}

// Backend-owned fields should always come from voucher document, never from source snapshot.
const SYSTEM_MANAGED_FIELDS = new Set([
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
const SYSTEM_MANAGED_FIELDS_LOWER = new Set(
  Array.from(SYSTEM_MANAGED_FIELDS).map((key) => key.toLowerCase())
);
const isSystemManagedField = (key: string): boolean =>
  !!key && SYSTEM_MANAGED_FIELDS_LOWER.has(String(key).toLowerCase());

const stripSystemManagedSnapshotFields = (snapshot: any): any => {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return snapshot;
  }
  return Object.entries(snapshot).reduce((acc, [key, value]) => {
    if (isSystemManagedField(key)) return acc;
    acc[key] = value;
    return acc;
  }, {} as Record<string, any>);
};

export const GenericVoucherRenderer = React.memo(forwardRef<GenericVoucherRendererRef, GenericVoucherRendererProps>(({ definition, mode = 'windows', initialData, onChange, onBlur, readOnly }, ref) => {
  // GUARD: definition must be present
  if (!definition) return null;

  // GUARD: Validate canonical (only if schemaVersion is present)
  if (definition.schemaVersion && definition.schemaVersion !== 2) {
    throw new Error('Cleanup violation: legacy view type detected. Only Schema V2 allowed.');
  }

  const { settings } = useCompanySettings();
  const { getAccountByCode, getAccountById } = useAccounts();
  const { company } = useCompanyAccess();
  const { data: companyCurrencies = [] } = useCompanyCurrencies();

  // Language support
  const { t, i18n } = useTranslation('accounting');
  const isRTL = (i18n.language || '').startsWith('ar');

  // Helper: Detect format and get table columns
  const getTableColumns = (): any[] => {
    const rawColumns = (definition as any).tableColumns;
    
    // Only return defaults if property is missing entirely
    if (rawColumns === undefined || rawColumns === null) {
      const baseColumns = [
        { id: 'account', label: t('voucherRenderer.columns.account', { defaultValue: 'Account' }), width: '25%' },
        { id: 'debit', label: t('voucherRenderer.columns.debit', { defaultValue: 'Debit' }), width: '15%' },
        { id: 'credit', label: t('voucherRenderer.columns.credit', { defaultValue: 'Credit' }), width: '15%' }
      ];
      
      // Safety Net: If it's a Journal Entry or FX Revaluation, include multi-currency columns in the default view
      const isJE = definition.code?.toLowerCase().includes('journal') || 
                   (definition as any).baseType?.toLowerCase().includes('journal-entry');
      const isReval = definition.code?.toLowerCase().includes('revaluation') || (definition as any)._typeId?.toLowerCase().includes('revaluation');
                   
      if (isJE || isReval) {
        baseColumns.push(
          { id: 'currency', label: t('voucherRenderer.columns.currency', { defaultValue: 'Currency' }), width: '80px' },
          { id: 'parity', label: t('voucherRenderer.columns.parity', { defaultValue: 'Parity' }), width: '80px' },
          { id: 'equivalent', label: t('voucherRenderer.columns.equivalent', { defaultValue: 'Equivalent' }), width: '100px' }
        );
      }
      
      baseColumns.push({ id: 'notes', label: t('voucherRenderer.columns.notes', { defaultValue: 'Notes' }), width: 'auto' });
      return baseColumns;
    }

    if (!Array.isArray(rawColumns) || rawColumns.length === 0) {
      return [];
    }

    return rawColumns.map((col: any) => {
      // Handle legacy string array
      if (typeof col === 'string') {
        const fallbackLabel = col.charAt(0).toUpperCase() + col.slice(1);
        return { 
          id: col, 
          label: t(`voucherRenderer.columns.${col}`, { defaultValue: fallbackLabel }),
          width: 'auto'
        };
      }
      
      // Handle structured object array (Schema V2)
      const colId = col.id || col.fieldId;
      // If we have no ID at all, then "Column" is the last resort fallback
      const fallbackLabel = colId ? (colId.charAt(0).toUpperCase() + colId.slice(1)) : 'Column';
      
      const currentLabel = col.labelOverride || col.label || '';
      const normalizedCurrent = currentLabel.replace(/\s+/g, '').toLowerCase();
      const normalizedFallback = (fallbackLabel || '').replace(/\s+/g, '').toLowerCase();
      const shouldTranslate = !currentLabel || normalizedCurrent === (colId || '').toLowerCase() || normalizedCurrent === normalizedFallback;

      return {
        ...col,
        id: colId,
        label: shouldTranslate ? t(`voucherRenderer.fields.${colId}`, { defaultValue: fallbackLabel }) : (col.labelOverride || col.label || fallbackLabel),
        width: col.width || 'auto'
      };
    });
  };

  const getRowValue = (row: JournalRow, colId: string): any => {
    if (colId.includes('.')) {
      const parts = colId.split('.');
      let current: any = row;
      for (const part of parts) {
        if (current === undefined || current === null) return '';
        current = current[part];
      }
      return current ?? '';
    }

    const val = (row as any)[colId] ?? (row as any).metadata?.[colId];
    if (val !== undefined && val !== null) return val;
    
    // Alias Fallback: costCenter <-> costCenterId
    if (colId === 'costCenter') return (row as any).costCenterId ?? (row as any).metadata?.costCenterId ?? '';
    if (colId === 'costCenterId') return (row as any).costCenter ?? (row as any).metadata?.costCenter ?? '';
    
    return '';
  };
  
  // Cache the result of getTableColumns
  const columns = useMemo(() => getTableColumns(), [definition.tableColumns, definition.id, t]);
  
  const [formData, setFormData] = useState<any>(initialData || {});
  const [rows, setRows] = useState<JournalRow[]>(getInitialRows());
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [rateDeviations, setRateDeviations] = useState<Record<number, any>>({});
  const [savingRate, setSavingRate] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFirstRender = useRef(true);
  const hasUserTouchedHeaderFxRef = useRef(false);
  const [fiscalYears, setFiscalYears] = useState<any[]>([]); // Cache fiscal years for period checking

  // Load fiscal years on mount
  useEffect(() => {
    accountingApi.listFiscalYears().then(data => {
      setFiscalYears(data || []);
    }).catch(err => console.error('Failed to load fiscal years', err));
  }, []);

  // ─── Reopen Hydration ─────────────────────────────────────────────────────
  // Priority chain for restoring form state from a persisted voucher:
  //
  //   1. formData (Option-A structured field) — trusted, direct mapping
  //   2. sourcePayload / metadata.sourceVoucher — legacy fallback
  //   3. initialData.lines — last resort (canonical accounting lines)
  //
  // When formData is present (all vouchers created after the Option-A refactor),
  // we skip the heuristic type-detection and reverse-engineering entirely.
  // ──────────────────────────────────────────────────────────────────────────

  // Shared helper: ensure every mapped row has a unique numeric id
  const deduplicateRowIds = (rows: any[]): any[] => {
    const seen = new Set<number>();
    return rows.map((r, i) => {
      if (seen.has(r.id)) {
        const newId = -(Date.now() + i + 1000);
        seen.add(newId);
        return { ...r, id: newId };
      }
      seen.add(r.id);
      return r;
    });
  };

  // Shared helper: resolve an account reference to its ID string
  const resolveAccountRef = (value: any): string | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      return value.id || value.accountId || value.code || value.account || undefined;
    }
    return undefined;
  };

  useEffect(() => {
    if (!initialData) return;

    // ── TIER 1: formData (Option-A) ──────────────────────────────────────
    const fd = initialData.formData;
    if (fd && typeof fd === 'object' && !Array.isArray(fd)) {
      const headerFields = fd.headerFields || {};
      const detailLines: any[] = Array.isArray(fd.detailLines) ? fd.detailLines : [];

      // Build merged header: canonical system fields win over form snapshot
      // Step 1: resolve the header account from whatever key it was saved under
      const rawHeaderAccountRef =
        headerFields.depositToAccountId ||
        headerFields.payFromAccountId ||
        headerFields.accountId ||
        headerFields.account ||
        null;
      const resolvedHeaderAccount = rawHeaderAccountRef
        ? (getAccountById(String(rawHeaderAccountRef)) || getAccountByCode(String(rawHeaderAccountRef)) || null)
        : null;
      // Step 2: determine the voucher type to populate the correct semantic key
      const tier1IsReceipt = String(initialData.type || '').toLowerCase().includes('receipt');
      const tier1IsPayment = String(initialData.type || '').toLowerCase().includes('payment');
      const semanticHeaderAccountId = resolvedHeaderAccount?.id || (typeof rawHeaderAccountRef === 'string' ? rawHeaderAccountRef : '') || '';
      const semanticHeaderAccountCode = resolvedHeaderAccount?.code || '';

      const mergedHeader: any = {
        ...headerFields,
        // Explicitly normalize header account across ALL possible field key variants
        // so any form config (fieldId='account', 'accountId', 'depositToAccountId', etc.) finds the value
        ...(semanticHeaderAccountId ? {
          accountId: semanticHeaderAccountId,
          account: semanticHeaderAccountCode || semanticHeaderAccountId,
          ...(tier1IsReceipt ? { depositToAccountId: semanticHeaderAccountId } : {}),
          ...(tier1IsPayment ? { payFromAccountId: semanticHeaderAccountId } : {}),
        } : {}),
        // Always take these from the live voucher document
        id: initialData.id,
        // Prefer the real assigned sequence number; skip placeholder values like "Pending"
        voucherNo: initialData.voucherNo || initialData.voucherNumber,
        voucherNumber: (() => {
          const n = initialData.voucherNumber;
          const placeholder = !n || n === 'Pending' || n === 'pending' || n === '-';
          return placeholder
            ? (initialData.voucherNo || initialData.id || n)
            : n;
        })(),
        status: initialData.status,
        date: initialData.date,
        currency: initialData.currency,
        baseCurrency: initialData.baseCurrency,
        exchangeRate: initialData.exchangeRate,
        description: initialData.description ?? headerFields.description,
        reference: initialData.reference ?? headerFields.reference,
        postedAt: initialData.postedAt,
        approvedAt: initialData.approvedAt,
        postingLockPolicy: initialData.postingLockPolicy,
        createdBy: initialData.createdBy,
        createdAt: initialData.createdAt,
        metadata: initialData.metadata,
        type: initialData.type,
        formId: initialData.formId || fd.formId,
      };

      // Map detail lines → row shape the table expects
      // Use canonical lines (initialData.lines) to resolve side when detailLines lack debit/credit info
      const canonicalLines: any[] = Array.isArray(initialData.lines) ? initialData.lines : [];
      const mappedLines = deduplicateRowIds(
        detailLines.map((l: any, i: number) => {
          const accountId = resolveAccountRef(
            l.receiveFromAccountId || l.payToAccountId || l.accountId || l.account
          );
          const accountObj = accountId ? getAccountById(accountId) : undefined;
          const accountCode = accountObj?.code || (typeof l.account === 'string' ? l.account : (accountId || ''));
          const amount = Math.abs(Number(l.amount ?? l.debit ?? l.credit ?? 0));

          // Resolve debit/credit: prefer explicit fields, then side field, then canonical line side
          let debit = 0;
          let credit = 0;
          if (l.debit !== undefined || l.credit !== undefined) {
            // Explicit debit/credit stored — use them directly
            debit = Number(l.debit ?? 0);
            credit = Number(l.credit ?? 0);
          } else if (l.side) {
            // Side field present on the detail line
            debit = l.side === 'Debit' ? amount : 0;
            credit = l.side === 'Credit' ? amount : 0;
          } else if (canonicalLines[i] && canonicalLines[i].side) {
            // Fallback: look up the canonical line at the same index for side info
            debit = canonicalLines[i].side === 'Debit' ? amount : 0;
            credit = canonicalLines[i].side === 'Credit' ? amount : 0;
          } else {
            // Last resort: everything goes to debit (preserves old behavior)
            debit = amount;
            credit = 0;
          }

          return {
            ...l,
            id: l.id ?? -(Date.now() + i),
            _rowId: i + 1,
            accountId,
            account: accountCode,
            amount,
            debit,
            credit,
            notes: l.notes || l.description || '',
            currency: l.currency || l.lineCurrency || initialData.currency || '',
            parity: Number(l.exchangeRate || l.parity || 1) || 1.0,
            equivalent: l.baseAmount || l.equivalent || 0,
            metadata: l.metadata || {},
          };
        })
      );

      setFormData((prev: any) => {
        if (prev?.id !== initialData.id || !prev?.id) {
          return {
            ...mergedHeader,
            date: mergedHeader.date ? formatForInput(mergedHeader.date) : (prev?.date || getCompanyToday(settings)),
          };
        }
        // Same voucher: sync system-managed field changes AND newly-resolved account fields
        const patch: any = {};
        SYSTEM_MANAGED_FIELDS.forEach((key) => {
          if ((initialData as any)[key] !== undefined && prev[key] !== (initialData as any)[key]) {
            patch[key] = (initialData as any)[key];
          }
        });
        // Also sync account fields that may have just resolved when accounts loaded
        const accountPatchKeys = ['accountId', 'account', 'depositToAccountId', 'payFromAccountId'];
        accountPatchKeys.forEach((key) => {
          const newVal = (mergedHeader as any)[key];
          if (newVal && newVal !== prev[key]) {
            patch[key] = newVal;
          }
        });
        return Object.keys(patch).length > 0 ? { ...prev, ...patch } : prev;

      });

      if (mappedLines.length > 0) {
        setRows((prev) => {
          const isNew = initialData.id !== (formData.id || initialData.id);
          const isEmpty = prev.length === 0 || (prev.length <= 5 && prev.every(r => !r.account));
          if (isNew || isEmpty) return mappedLines;
          return prev;
        });
      }

      hasUserTouchedHeaderFxRef.current = false;
      return; // ← Done. No fallback needed.
    }

    // ── TIER 2: sourcePayload / metadata.sourceVoucher (legacy) ─────────
    // Keep the existing heuristic logic unchanged for old vouchers that
    // pre-date the formData field. This path will naturally phase out as
    // vouchers are re-saved through normal edits.

    const resolveBackendType = (): string => {
      const defAny = definition as any;
      const payloadType = String(initialData?.type || '').toLowerCase();
      if (payloadType === 'reversal' || initialData?.reversalOfVoucherId) return 'reversal';
      if (payloadType.includes('receipt')) return 'receipt';
      if (payloadType.includes('payment')) return 'payment';
      if (payloadType.includes('opening')) return 'opening_balance';
      if (payloadType.includes('journal') || payloadType === 'jv') return 'journal_entry';

      const typeMap: Record<string, string> = {
        JOURNAL_ENTRY: 'journal_entry', PAYMENT: 'payment',
        RECEIPT: 'receipt', OPENING_BALANCE: 'opening_balance', REVERSAL: 'reversal'
      };
      if (defAny._typeId && typeMap[String(defAny._typeId).toUpperCase()]) return typeMap[String(defAny._typeId).toUpperCase()];
      if (defAny.baseType && typeMap[String(defAny.baseType).toUpperCase()]) return typeMap[String(defAny.baseType).toUpperCase()];
      if (definition.code && typeMap[String(definition.code).toUpperCase()]) return typeMap[String(definition.code).toUpperCase()];
      const nameLower = String(definition.name || '').toLowerCase();
      const codeLower = String(definition.code || '').toLowerCase();
      if (nameLower.includes('receipt') || codeLower.includes('receipt')) return 'receipt';
      if (nameLower.includes('payment') || codeLower.includes('payment')) return 'payment';
      if (nameLower.includes('opening') || codeLower.includes('opening')) return 'opening_balance';
      return 'journal_entry';
    };

    const backendType = resolveBackendType();
    const isReceipt = backendType === 'receipt';
    const isPayment = backendType === 'payment';
    const semanticLineKey = isReceipt ? 'receiveFromAccountId' : (isPayment ? 'payToAccountId' : null);
    const semanticHeaderKey = isReceipt ? 'depositToAccountId' : (isPayment ? 'payFromAccountId' : null);

    const initialMetadata = initialData.metadata && typeof initialData.metadata === 'object' ? initialData.metadata : {};
    const sourceVoucher = stripSystemManagedSnapshotFields(
      (initialData.sourcePayload && typeof initialData.sourcePayload === 'object')
        ? initialData.sourcePayload
        : (initialMetadata.sourceVoucher && typeof initialMetadata.sourceVoucher === 'object'
          ? initialMetadata.sourceVoucher
          : null)
    );

    const sourceLines = Array.isArray((sourceVoucher as any)?.lines) ? (sourceVoucher as any).lines : [];
    const rawLines = sourceLines.length > 0
      ? sourceLines
      : (Array.isArray(initialData.lines) ? initialData.lines : []);
    const amountOf = (line: any): number => Math.abs(Number(line?.amount ?? line?.debit ?? line?.credit ?? 0));

    const mergedInitialData = {
      ...initialData,
      ...(sourceVoucher || {}),
      metadata: {
        ...(initialMetadata || {}),
        ...(((sourceVoucher as any)?.metadata && typeof (sourceVoucher as any).metadata === 'object')
          ? (sourceVoucher as any).metadata
          : {})
      }
    };
    (['currency', 'baseCurrency', 'exchangeRate'] as const).forEach((key) => {
      const canonicalValue = (initialData as any)?.[key];
      if (canonicalValue !== undefined && canonicalValue !== null && canonicalValue !== '') {
        (mergedInitialData as any)[key] = canonicalValue;
      }
    });
    SYSTEM_MANAGED_FIELDS.forEach((key) => {
      if ((initialData as any)?.[key] !== undefined) {
        (mergedInitialData as any)[key] = (initialData as any)[key];
      }
    });

    const cleanInitialData = Object.entries(mergedInitialData).reduce((acc, [key, value]) => {
      if (key === 'voucherConfig') return acc;
      acc[key] = value;
      return acc;
    }, {} as any);

    const resolveFieldCI = (obj: any, key: string): any => {
      if (!obj || !key) return undefined;
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
      const lowered = key.toLowerCase();
      const found = Object.keys(obj).find(k => k.toLowerCase() === lowered);
      if (found && obj[found] !== undefined && obj[found] !== null && obj[found] !== '') return obj[found];
      return undefined;
    };

    let semanticHeaderAccount = semanticHeaderKey
      ? (
        resolveAccountRef(resolveFieldCI(cleanInitialData, semanticHeaderKey)) ||
        resolveAccountRef(cleanInitialData.accountId) ||
        resolveAccountRef(cleanInitialData.account) ||
        resolveAccountRef(resolveFieldCI(cleanInitialData.metadata, semanticHeaderKey)) ||
        resolveAccountRef(cleanInitialData.metadata?.accountId) ||
        resolveAccountRef(cleanInitialData.metadata?.account)
      )
      : undefined;

    if (!semanticHeaderAccount && semanticHeaderKey && rawLines.length > 0) {
      const expectedHeaderSide = isReceipt ? 'Debit' : (isPayment ? 'Credit' : '');
      const headerAnchor = rawLines.find((line: any) =>
        String(line?.side || '').toLowerCase() === expectedHeaderSide.toLowerCase()
      );
      semanticHeaderAccount = resolveAccountRef(headerAnchor?.accountId || headerAnchor?.account);
    }

    if (!semanticHeaderAccount && semanticHeaderKey && Array.isArray(initialData.lines) && initialData.lines.length > 0) {
      const expectedHeaderSide = isReceipt ? 'Debit' : (isPayment ? 'Credit' : '');
      const canonicalHeaderAnchor = initialData.lines.find((line: any) =>
        String(line?.side || '').toLowerCase() === expectedHeaderSide.toLowerCase()
      );
      semanticHeaderAccount = resolveAccountRef(canonicalHeaderAnchor?.accountId || canonicalHeaderAnchor?.account);
    }

    let semanticHeaderAccountId: string | undefined;
    let headerAccountCode: string | undefined;
    if (semanticHeaderAccount) {
      const accountById = getAccountById(semanticHeaderAccount);
      const accountByCode = accountById ? undefined : getAccountByCode(semanticHeaderAccount);
      semanticHeaderAccountId = accountById?.id || accountByCode?.id || semanticHeaderAccount;
      headerAccountCode = accountById?.code || accountByCode?.code || (accountByCode ? semanticHeaderAccount : undefined);
    }
    if (!semanticHeaderAccountId && typeof cleanInitialData.accountId === 'string' && cleanInitialData.accountId) {
      semanticHeaderAccountId = cleanInitialData.accountId;
    }
    if (!headerAccountCode && typeof cleanInitialData.account === 'string' && cleanInitialData.account) {
      headerAccountCode = cleanInitialData.account;
    }

    const hydratedInitialData = {
      ...cleanInitialData,
      ...(semanticHeaderKey && (semanticHeaderAccountId || semanticHeaderAccount)
        ? { [semanticHeaderKey]: semanticHeaderAccountId || semanticHeaderAccount }
        : {}),
      ...(semanticHeaderAccountId ? { accountId: semanticHeaderAccountId } : {}),
      ...(headerAccountCode ? { account: headerAccountCode } : {})
    };

    // 1. Sync Form Metadata
    setFormData((prev: any) => {
      if (prev?.id !== initialData.id || !prev?.id) {
        return {
          ...prev,
          ...hydratedInitialData,
          date: hydratedInitialData.date ? formatForInput(hydratedInitialData.date) : (prev.date || getCompanyToday(settings))
        };
      }

      const systemFieldPatch = Array.from(SYSTEM_MANAGED_FIELDS).reduce((acc, key) => {
        const nextValue = (initialData as any)?.[key];
        if (nextValue !== undefined && prev?.[key] !== nextValue) acc[key] = nextValue;
        return acc;
      }, {} as Record<string, any>);

      const nextVoucherNumber = initialData.voucherNumber || initialData.voucherNo || initialData.id || prev?.voucherNumber;
      if (nextVoucherNumber !== undefined && prev?.voucherNumber !== nextVoucherNumber) {
        systemFieldPatch.voucherNumber = nextVoucherNumber;
      }

      if (Object.keys(systemFieldPatch).length > 0) return { ...prev, ...systemFieldPatch };

      const hasStringDiff = (key: string): boolean => {
        if (hydratedInitialData[key] === undefined || hydratedInitialData[key] === null) return false;
        return String(prev?.[key] ?? '') !== String(hydratedInitialData[key] ?? '');
      };
      const hasNumberDiff = (key: string): boolean => {
        if (hydratedInitialData[key] === undefined || hydratedInitialData[key] === null || hydratedInitialData[key] === '') return false;
        const nextNum = Number(hydratedInitialData[key] ?? 0);
        if (!Number.isFinite(nextNum)) return false;
        return Math.abs(Number(prev?.[key] ?? 0) - nextNum) > 0.000001;
      };

      const needsRepair =
        hasStringDiff('account') || hasStringDiff('accountId') ||
        hasStringDiff('depositToAccountId') || hasStringDiff('payFromAccountId') ||
        hasStringDiff('currency') || hasStringDiff('baseCurrency') ||
        hasStringDiff('description') || hasStringDiff('date') ||
        hasNumberDiff('exchangeRate');

      if (needsRepair) {
        return {
          ...prev,
          ...hydratedInitialData,
          date: hydratedInitialData.date ? formatForInput(hydratedInitialData.date) : (prev.date || getCompanyToday(settings))
        };
      }
      return prev;
    });

    // 2. Sync Rows (Lines) — Tier 2/3 path
    if (rawLines.length > 0) {
      setRows((prev) => {
        const isNewVoucher = initialData.id !== (formData.id || initialData.id);
        const isEmptyRows = prev.length === 0 || (prev.length <= 5 && prev.every(r => !r.account));

        if (isNewVoucher || isEmptyRows) {
          let mappedLines: any[] = [];

          if (semanticLineKey) {
            const hasSemanticShape = rawLines.some((line: any) =>
              !!resolveAccountRef(resolveFieldCI(line, semanticLineKey))
            );
            const expectedLineSide = isReceipt ? 'Credit' : 'Debit';
            const sideFilteredLines = rawLines.filter((line: any) =>
              String(line?.side || '').toLowerCase() === expectedLineSide.toLowerCase()
            );
            const semanticSourceLines = hasSemanticShape
              ? rawLines
              : (sideFilteredLines.length > 0 ? sideFilteredLines : rawLines);

            mappedLines = semanticSourceLines
              .map((l: any, i: number) => {
                const semanticAccountId =
                  resolveAccountRef(resolveFieldCI(l, semanticLineKey)) ||
                  resolveAccountRef(l.accountId) ||
                  resolveAccountRef(l.account);
                const amount = amountOf(l);
                const accountObj = semanticAccountId ? getAccountById(semanticAccountId) : undefined;
                const accountCode = accountObj?.code || (typeof l.account === 'string' ? l.account : (semanticAccountId || ''));
                return {
                  ...l,
                  id: l.id ?? -(Date.now() + i),
                  _rowId: i + 1,
                  [semanticLineKey]: semanticAccountId,
                  accountId: semanticAccountId,
                  account: accountCode,
                  amount,
                  debit: amount,
                  credit: 0,
                  notes: l.notes || l.description || '',
                  currency: l.currency || l.lineCurrency || hydratedInitialData.currency || '',
                  parity: Number(l.exchangeRate || l.parity || 1) || 1.0,
                  equivalent: l.baseAmount || l.equivalent || 0,
                  metadata: l.metadata || {}
                };
              })
              .filter((line: any) => line.accountId && line.amount > 0);
          } else {
            mappedLines = rawLines.map((l: any, i: number) => {
              const debit = l.debit !== undefined ? l.debit : (l.side === 'Debit' ? l.amount : 0);
              const credit = l.credit !== undefined ? l.credit : (l.side === 'Credit' ? l.amount : 0);
              const semanticAccountId = l.accountId || l.account || l.receiveFromAccountId || l.payToAccountId;
              let accountCode = l.account || '';
              if (!accountCode && semanticAccountId) {
                const acc = getAccountById(semanticAccountId);
                accountCode = acc ? acc.code : semanticAccountId;
              }
              return {
                ...l,
                debit, credit,
                amount: amountOf(l),
                id: l.id ?? -(Date.now() + i),
                _rowId: i + 1,
                account: accountCode,
                accountId: semanticAccountId,
                notes: l.notes || l.description || '',
                currency: l.currency || l.lineCurrency || '',
                parity: l.exchangeRate || l.parity || 1.0,
                equivalent: l.baseAmount || l.equivalent || 0,
                metadata: l.metadata || {}
              };
            });
          }

          mappedLines = deduplicateRowIds(mappedLines);

          if (isNewVoucher) {
            onChangeRef.current?.({ ...formData, ...hydratedInitialData, lines: mappedLines });
          }
          return mappedLines;
        }
        return prev;
      });
    }

    hasUserTouchedHeaderFxRef.current = false;
  }, [initialData, getAccountById, getAccountByCode, settings, definition]);



  
  // Recalculate parities when voucher currency or exchange rate changes
  // IMPORTANT: This sync is ONLY for header-level changes. 
  // Individual line parity changes (including Alt+B) are handled in handleRowChange.
  useEffect(() => {
    // 1. Skip for read-only vouchers.
    if (readOnly) {
      isFirstRender.current = false;
      return;
    }

    // 2. Existing vouchers: do not auto-rewrite persisted parities/rates on reopen.
    // Only recalc after user explicitly changes header FX fields.
    if (formData.id && !hasUserTouchedHeaderFxRef.current) {
      isFirstRender.current = false;
      return;
    }
    
    // We only want to trigger this if the HEADER currency or rate changed.
    // If individual lines changed, handleRowChange already updated them.
    const voucherRate = parseFloat(formData.exchangeRate as any) || 1.0;
    const voucherCurrency = (formData.currency || company?.baseCurrency || '').toUpperCase();
    const baseCurrency = (company?.baseCurrency || '').toUpperCase();
    
    const syncParitiesWithHeader = async () => {
      // 1. Identify which lines need a rate fetch
      const updatedRows = [...rows];
      let hasChanges = false;

      // We need to collect all async tasks to run them properly
      const patchTasks: Promise<void>[] = [];

      for (let i = 0; i < updatedRows.length; i++) {
        const row = updatedRows[i];
        if (!row.account) continue;

        const lineCurrency = (row.currency || voucherCurrency).toUpperCase();
        
        // Case 1: If line currency matches VOUCHER currency, parity is ALWAYS 1.0
        if (lineCurrency === voucherCurrency) {
          if (row.parity !== 1.0) {
            const amount = parseFloat(row.debit as any) || parseFloat(row.credit as any) || 0;
            updatedRows[i] = { ...row, parity: 1.0, equivalent: amount };
            hasChanges = true;
          }
          continue;
        }

        // Case 2: If line is base currency (e.g. SYP) and voucher is foreign (e.g. USD)
        // Parity is the inverse of the header rate (1 / rate)
        if (lineCurrency === baseCurrency && voucherCurrency !== baseCurrency) {
          const inverse = voucherRate !== 0 ? (1 / voucherRate) : 1.0;
          if (Math.abs(row.parity - inverse) > 0.000001) {
            const amount = parseFloat(row.debit as any) || parseFloat(row.credit as any) || 0;
            updatedRows[i] = { ...row, parity: inverse, equivalent: Math.round(amount * inverse * 100) / 100 };
            hasChanges = true;
          }
          continue;
        }

        // Case 3: Foreign-to-Foreign parity (e.g. Line is TRY, Voucher is USD)
        // We need to fetch the suggested rate for TRY -> USD
        const task = (async (index: number, r: JournalRow) => {
          try {
             const result = await accountingApi.getSuggestedRate(
               lineCurrency, 
               voucherCurrency,
               formData.date || getCompanyToday(settings)
             );
             if (result.rate !== null && Math.abs(r.parity - result.rate) > 0.000001) {
                const amount = parseFloat(r.debit as any) || parseFloat(r.credit as any) || 0;
                updatedRows[index] = { 
                  ...r, 
                  parity: result.rate, 
                  equivalent: Math.round(amount * result.rate * 100) / 100 
                };
                hasChanges = true;
             }
          } catch (err) {
            console.error('[PARITY SYNC] Foreign-to-Foreign fetch failed:', err);
          }
        })(i, row);
        
        patchTasks.push(task);
      }

      // Wait for all foreign fetch tasks to complete
      if (patchTasks.length > 0) {
        await Promise.all(patchTasks);
      }

      if (hasChanges) {
        // DEFENSIVE CHECK: Ensure we aren't overwriting a newer state that was updated during our async fetches
        setRows(prevCurrent => {
            const merged = prevCurrent.map((r) => {
                // Find matching row by ID (stable reference)
                const matchingUpdate = updatedRows.find(ur => ur.id === r.id);
                if (matchingUpdate) {
                    return { 
                      ...r, 
                      parity: matchingUpdate.parity, 
                      equivalent: matchingUpdate.equivalent 
                    };
                }
                return r;
            });
            onChangeRef.current?.({ ...formData, lines: merged });
            return merged;
        });
      }
    };
    
    syncParitiesWithHeader();
    isFirstRender.current = false;
  }, [readOnly, formData.id, formData.exchangeRate, formData.currency]); // STRIPPED: No more rows-based dependencies! 


  // --- Math & Auto-Balance Logic ---
  const evaluateMathExpression = (expression: string): number | null => {
    // Normalize: replace comma with dot for international users
    const normalized = expression.replace(/,/g, '.');
    
    // Only allow safe characters: 0-9 . + - * / ( ) space
    if (!/^[\d\.\+\-\*\/\(\)\s]+$/.test(normalized)) {
        console.warn('Math evaluation blocked due to invalid chars:', normalized);
        return null; // Strict security check against injection
    }
    
    try {
      // Create a specific function context to prevent accessing global/window
      // eslint-disable-next-line no-new-func
      const result = new Function('return ' + normalized)();
      return isFinite(result) ? result : null;
    } catch (err) {
      console.warn('Math evaluation failed:', err);
      return null;
    }
  };

  // Editing state for amount fields (allows typing "10+5")
  const [editingCell, setEditingCell] = useState<{ rowId: number, field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const handleAmountFocus = (rowId: number, field: string, currentValue: number) => {
    setEditingCell({ rowId, field });
    setEditValue(currentValue === 0 ? '' : currentValue.toString());
  };

  const handleAmountChange = (val: string) => {
    setEditValue(val);
    // Don't update row state immediately to avoid parsing partial expressions
  };

  const handleAmountBlur = (rowId: number, field: keyof JournalRow) => {
    if (!editingCell) return;
    
    // Evaluate if it looks like math
    let finalValue = parseFloat(editValue);
    
    // Simple check if it contains math operators
    if (/[\+\-\*\/]/.test(editValue)) {
       const result = evaluateMathExpression(editValue);
       if (result !== null) {
         finalValue = result;
       }
    }

    if (isNaN(finalValue)) finalValue = 0;
    
    // Update row
    handleRowChange(rowId, field, finalValue);
    
    // Clear edit state
    setEditingCell(null);
    setEditValue('');
    onBlurRef.current?.();
  };

  const handleAmountKeyDown = (e: React.KeyboardEvent, rowId: number, field: 'debit' | 'credit' | 'parity' | 'equivalent', idx: number, colIdx: number) => {
    // Check for Alt+B (Auto Balance)
    if (e.altKey && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      e.stopPropagation();
      
      // Calculate target to balance existing lines
      // Goal: Sum(Debit * Parity) = Sum(Credit * Parity)
      
      let otherDebitBase = 0;
      let otherCreditBase = 0;
      
      rows.forEach(r => {
        if (r.id === rowId) return; // Skip current
        
        // Use equivalent as the truth for current balance state
        const isDebit = (parseFloat(r.debit as any) || 0) > 0;
        const equiv = parseFloat(r.equivalent as any) || 0;
        
        if (isDebit) {
          otherDebitBase += equiv;
        } else {
          otherCreditBase += equiv;
        }
      });
      
      // PARITY BALANCING: Adjust Rate to match Amount
      if (field === 'parity') {
         const currentRow = rows.find(r => r.id === rowId);
         if (!currentRow) return;
         
         const currentAmount = (parseFloat(currentRow.debit as any) || 0) + (parseFloat(currentRow.credit as any) || 0);
         if (currentAmount === 0) {
             return; 
         }
         
         const isDebit = (parseFloat(currentRow.debit as any) || 0) > 0;
         
         let requiredBase = 0;
         if (isDebit) {
            requiredBase = otherCreditBase - otherDebitBase;
         } else {
             requiredBase = otherDebitBase - otherCreditBase;
         }
         
         if (requiredBase <= 0) return;
         
         const newParity = requiredBase / currentAmount;
         const roundedParity = Number(newParity.toFixed(6));
         
         handleRowChange(rowId, 'parity', roundedParity);
         setEditValue(roundedParity.toString());
         return;
      }

      // EQUIVALENT BALANCING: Force Base Amount (Adjust Rate)
      if (field === 'equivalent') {
        const currentRow = rows.find(r => r.id === rowId);
        if (!currentRow) return;

         const isDebit = (parseFloat(currentRow.debit as any) || 0) > 0;
         
         let requiredBase = 0;
         if (isDebit) {
            requiredBase = otherCreditBase - otherDebitBase;
         } else {
             requiredBase = otherDebitBase - otherCreditBase;
         }
         
         if (requiredBase <= 0) return;

         // Set Equivalent directly. handleRowChange determines new Parity.
         handleRowChange(rowId, 'equivalent', requiredBase);
         setEditValue(requiredBase.toString());
         return;
      }

      // AMOUNT BALANCING (Debit/Credit)
      let requiredBase = 0;
      if (field === 'credit') {
        // Use Credit to balance Debit excess
        requiredBase = Math.max(0, otherDebitBase - otherCreditBase);
      } else {
        // Use Debit to balance Credit excess
        requiredBase = Math.max(0, otherCreditBase - otherDebitBase);
      }
      
      // Convert back to line currency
      const currentParity = rows.find(r => r.id === rowId)?.parity || 1.0;
      const finalAmount = requiredBase / currentParity;
      const rounded = Math.round(finalAmount * 1000000) / 1000000;
      
      // Update immediately
      handleRowChange(rowId, field, rounded);
      setEditValue(rounded.toString());
      return; // Handled
    }
    
    // Standard navigation
    handleCellKeyDown(e, idx, colIdx, columns.length);
  };
  // Column resize state (for Classic table)
  const storageKey = `columnWidths_${definition.id}`;
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : {};
  });
  const [resizing, setResizing] = useState<{ columnId: string; startX: number; startWidth: number } | null>(null);
  
  // Line context menu state
  const [lineContextMenu, setLineContextMenu] = useState<{ x: number; y: number; rowId: number } | null>(null);
  const [highlightedRows, setHighlightedRows] = useState<Set<number>>(new Set());
  const [copiedLineData, setCopiedLineData] = useState<JournalRow | null>(null);
  
  // Line context menu handlers
  const handleLineContextMenu = (e: React.MouseEvent, rowId: number) => {
    e.preventDefault();
    e.stopPropagation();
    setLineContextMenu({ x: e.clientX, y: e.clientY, rowId });
  };
  
  const closeLineContextMenu = () => setLineContextMenu(null);
  
  const handleDeleteLine = (rowId: number) => {
    setRows((prev: JournalRow[]) => {
      const next = prev.filter(r => r.id !== rowId);
      onChangeRef.current?.({ ...formData, lines: next });
      return next;
    });
    closeLineContextMenu();
  };
  
  const handleCopyLine = (rowId: number) => {
    const row = rows.find(r => r.id === rowId);
    if (row) {
      setCopiedLineData(row);
      navigator.clipboard.writeText(JSON.stringify(row, null, 2));
    }
    closeLineContextMenu();
  };
  
  const handlePasteLine = async (rowId: number) => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      const data = JSON.parse(clipboardText);
      if (data && typeof data === 'object') {
        setRows((prev: JournalRow[]) => {
          const next = prev.map(r => r.id === rowId ? { ...r, ...data, id: rowId } : r);
          onChangeRef.current?.({ ...formData, lines: next });
          return next;
        });
      }
    } catch (err) {
      // If clipboard doesn't have valid JSON, use internal copied data
      if (copiedLineData) {
        setRows((prev: JournalRow[]) => {
          const next = prev.map(r => r.id === rowId ? { ...copiedLineData, id: rowId } : r);
          onChangeRef.current?.({ ...formData, lines: next });
          return next;
        });
      }
    }
    closeLineContextMenu();
  };
  
  const handleInsertLine = (rowId: number) => {
    const rowIndex = rows.findIndex(r => r.id === rowId);
    const nextId = rows.length > 0 ? Math.max(...rows.map(r => Math.abs(r.id))) + 1 : Date.now();
    const newRow: JournalRow = {
      id: -nextId, // Unique negative ID
      account: '', notes: '', debit: 0, credit: 0, currency: '', parity: 1, equivalent: 0, category: '', metadata: {}
    };
    setRows((prev: JournalRow[]) => {
      const next = [
        ...prev.slice(0, rowIndex + 1),
        newRow,
        ...prev.slice(rowIndex + 1)
      ];
      onChangeRef.current?.({ ...formData, lines: next });
      return next;
    });
    closeLineContextMenu();
  };
  
  const handleHighlightLine = (rowId: number) => {
    setHighlightedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
      }
      return newSet;
    });
    closeLineContextMenu();
  };
  
  const handleOpenStatement = (rowId: number) => {
    const row = rows.find(r => r.id === rowId);
    if (row?.account) {
      // TODO: Open account statement window
      console.log('Open statement for account:', row.account);
      alert(`Account Statement for: ${row.account}\n(Feature to be implemented)`);
    }
    closeLineContextMenu();
  };
  
  const handleAccountBalance = (rowId: number) => {
    const row = rows.find(r => r.id === rowId);
    if (row?.account) {
      // TODO: Show account balance
      console.log('Show balance for account:', row.account);
      alert(`Account Balance for: ${row.account}\n(Feature to be implemented)`);
    }
    closeLineContextMenu();
  };

  const handleSaveRateToSystem = async (rowId: number) => {
    // Placeholder implementation for lint resolution
    console.log('Save rate to system for row:', rowId);
  };
  
  // Cell navigation - refs for all focusable cells
  const cellRefs = useRef<Map<string, HTMLInputElement | HTMLSelectElement>>(new Map());
  
  const getCellKey = (rowIndex: number, colIndex: number) => `${rowIndex}-${colIndex}`;
  
  const handleCellKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number, totalCols: number) => {
    const totalRows = rows.length;
    let newRowIndex = rowIndex;
    let newColIndex = colIndex;
    // Respect RTL: visual left/right should mirror column movement
    const leftDelta = isRTL ? 1 : -1;
    const rightDelta = isRTL ? -1 : 1;
    
    switch (e.key) {
      case 'ArrowUp':
        if (rowIndex > 0) {
          newRowIndex = rowIndex - 1;
          e.preventDefault();
        }
        break;
      case 'ArrowDown':
        if (rowIndex < totalRows - 1) {
          newRowIndex = rowIndex + 1;
          e.preventDefault();
        }
        break;
      case 'ArrowLeft':
        if ((isRTL && colIndex < totalCols - 1) || (!isRTL && colIndex > 0)) {
          newColIndex = colIndex + leftDelta;
          e.preventDefault();
        }
        break;
      case 'ArrowRight':
        if ((isRTL && colIndex > 0) || (!isRTL && colIndex < totalCols - 1)) {
          newColIndex = colIndex + rightDelta;
          e.preventDefault();
        }
        break;
      case 'Tab':
        // Let Tab work naturally for form navigation
        return;
      case 'Enter':
        // Move to same column, next row
        if (rowIndex < totalRows - 1) {
          newRowIndex = rowIndex + 1;
          e.preventDefault();
        }
        break;
      default:
        return;
    }
    
    // Focus the new cell
    const newKey = getCellKey(newRowIndex, newColIndex);
    const newCell = cellRefs.current.get(newKey);
    if (newCell) {
      newCell.focus();
      if (newCell instanceof HTMLInputElement) {
        newCell.select();
      }
    }
  };
  
  const registerCellRef = (rowIndex: number, colIndex: number, el: HTMLInputElement | HTMLSelectElement | null) => {
    const key = getCellKey(rowIndex, colIndex);
    if (el) {
      cellRefs.current.set(key, el);
    } else {
      cellRefs.current.delete(key);
    }
  };
  
  // Save column widths to localStorage
  useEffect(() => {
    if (Object.keys(columnWidths).length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(columnWidths));
    }
  }, [columnWidths, storageKey]);

  // Ref to hold the latest onChange callback to avoid effect dependencies
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const onBlurRef = useRef(onBlur);
  useEffect(() => {
    onBlurRef.current = onBlur;
  }, [onBlur]);

  
  // Handle column resize
  useEffect(() => {
    if (!resizing) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizing.startX;
      const newWidth = Math.max(50, resizing.startWidth + delta);
      setColumnWidths((prev: Record<string, number>) => ({ ...prev, [resizing.columnId]: newWidth }));
    };
    
    const handleMouseUp = () => {
      setResizing(null);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing]);
  
  // Initialize form data: merge initialData with defaults
  // This effect is now mostly for setting up HEADER defaults on mount.
  // Line sync is handled by the first effect to avoid conflicts.
  useEffect(() => {
    if (!initialData) {
      const today = getCompanyToday(settings);
      
      // System field defaults for new vouchers
      const systemDefaults = {
        voucherNumber: 'Auto-generated',
        status: 'Draft',
        createdBy: 'Current User'
      };
      
      // User input field defaults
      const inputDefaults = {
        date: today,
        currency: company?.baseCurrency || '',
        exchangeRate: 1,
        paymentMethod: 'Bank Transfer'
      };
      
      setFormData({ ...systemDefaults, ...inputDefaults });
    }
  }, [!initialData, settings]);
  
  // Expose getData method to parent via ref
  useImperativeHandle(ref, () => ({
    getData: () => {
      // Map designer codes to backend types
      const typeMap: Record<string, string> = {
        'JOURNAL': 'journal_entry',
        'JOURNAL_ENTRY': 'journal_entry',
        'PAYMENT': 'payment',
        'RECEIPT': 'receipt',
        'OPENING_BALANCE': 'opening_balance',
        'OPENING': 'opening_balance',
        'FX_REVALUATION': 'fx_revaluation'
      };
      
      // Try to resolve backend type from multiple sources
      const defAny = definition as any;
      let backendType = 'journal_entry'; // Default fallback
      
      // 0. Check explicit baseType (stored when form is cloned/created)
      if (defAny.baseType && typeMap[defAny.baseType.toUpperCase()]) {
        backendType = typeMap[defAny.baseType.toUpperCase()];
      }
      // 1. Check explicit _typeId (from custom forms)
      else if (defAny._typeId && typeMap[defAny._typeId.toUpperCase()]) {
        backendType = typeMap[defAny._typeId.toUpperCase()];
      }
      // 2. Check code directly
      else if (definition.code && typeMap[definition.code.toUpperCase()]) {
        backendType = typeMap[definition.code.toUpperCase()];
      }
      // 3. Try to infer from name (for cloned forms like "Journal Entry - Copy")
      else if (definition.name) {
        const nameLower = definition.name.toLowerCase();
        if (nameLower.includes('journal')) backendType = 'journal_entry';
        else if (nameLower.includes('payment')) backendType = 'payment';
        else if (nameLower.includes('receipt')) backendType = 'receipt';
        else if (nameLower.includes('opening')) backendType = 'opening_balance';
      }
      // 4. Check if code contains a base type pattern
      else if (definition.code) {
        const codeLower = definition.code.toLowerCase();
        if (codeLower.includes('journal')) backendType = 'journal_entry';
        else if (codeLower.includes('payment')) backendType = 'payment';
        else if (codeLower.includes('receipt')) backendType = 'receipt';
        else if (codeLower.includes('opening')) backendType = 'opening_balance';
      }

      // 5. REVERSAL PROTECTION: If this voucher is already identified as a reversal (e.g., from backend or correction flow),
      // do NOT let the form definition override it back to 'journal_entry' or 'payment'.
      if (formData.type === 'reversal' || formData.reversalOfVoucherId) {
        backendType = 'reversal';
      }
      
      const resolveRowField = (row: any, key: string): any => {
        if (!row || !key) return undefined;
        if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];

        const lowerKey = key.toLowerCase();
        const foundKey = Object.keys(row).find(k => k.toLowerCase() === lowerKey);
        if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== '') {
          return row[foundKey];
        }
        return undefined;
      };

      const resolveAccountIdentity = (rawValue: any): { id?: string; code?: string } => {
        if (!rawValue) return {};
        if (typeof rawValue === 'object') {
          const id = typeof rawValue.id === 'string' && rawValue.id ? rawValue.id : undefined;
          const code = typeof rawValue.code === 'string' && rawValue.code ? rawValue.code : undefined;
          if (id || code) return { id, code };
        }

        const ref = String(rawValue);
        const accountById = getAccountById(ref);
        if (accountById) {
          return { id: accountById.id, code: accountById.code };
        }
        const accountByCode = getAccountByCode(ref);
        if (accountByCode) {
          return { id: accountByCode.id, code: accountByCode.code };
        }
        return {};
      };

      // Map rows to backend payload format based on resolved strategy type.
      // IMPORTANT: Frontend sends RAW values only. Backend calculates all derived values.
      let backendLines: any[] = [];
      if (backendType === 'receipt') {
        backendLines = rows
          .map(row => {
            const sourceRef = resolveRowField(row, 'receiveFromAccountId') || row.accountId || row.account;
            const accountIdentity = resolveAccountIdentity(sourceRef);
            const receiveFromAccountId = accountIdentity.id || sourceRef;
            const amount = Math.abs(Number(resolveRowField(row, 'amount') || (row as any).amount || row.debit || row.credit || 0));
            return {
              receiveFromAccountId,
              amount,
              notes: row.notes || (row as any).description || ''
            };
          })
          .filter(line => line.receiveFromAccountId && line.amount > 0);
      } else if (backendType === 'payment') {
        backendLines = rows
          .map(row => {
            const sourceRef = resolveRowField(row, 'payToAccountId') || row.accountId || row.account;
            const accountIdentity = resolveAccountIdentity(sourceRef);
            const payToAccountId = accountIdentity.id || sourceRef;
            const amount = Math.abs(Number(resolveRowField(row, 'amount') || (row as any).amount || row.debit || row.credit || 0));
            return {
              payToAccountId,
              amount,
              notes: row.notes || (row as any).description || ''
            };
          })
          .filter(line => line.payToAccountId && line.amount > 0);
      } else {
        backendLines = rows
          .filter(row => row.account && ((Number(row.debit) || 0) > 0 || (Number(row.credit) || 0) > 0))
          .map(row => {
            const isDebit = (Number(row.debit) || 0) > 0;
            const amt = isDebit ? row.debit : row.credit;
            
            return {
              accountId: row.accountId || row.account,
              description: row.notes || '',
              side: isDebit ? 'Debit' : 'Credit',
              amount: Math.abs(Number(amt) || 0),
              lineCurrency: (row.currency || formData.currency || '').toUpperCase(),
              exchangeRate: Number(row.parity) || 1,
              costCenterId: (row as any).costCenterId || (row as any).costCenter || null,
              costCenter: (row as any).costCenter || (row as any).costCenterId || null,
              metadata: row.metadata || {}
            };
          });
      }
      
      const resultFormId = definition.id;
      const resultPrefix = (definition as any).prefix || definition.code?.slice(0, 3).toUpperCase() || 'V';
      const resultNumberFormat = (definition as any).numberFormat || undefined;
      const sourceFormData = Object.entries(formData || {}).reduce((acc, [key, value]) => {
        if (key === 'voucherConfig') return acc;
        if (isSystemManagedField(key)) return acc;
        acc[key] = value;
        return acc;
      }, {} as Record<string, any>);

      // Keep snapshot shape stable: include all declared header fields even if untouched.
      (definition.headerFields || []).forEach((field: any) => {
        const fid = String(field?.id || '').trim();
        if (!fid) return;
        if (isSystemManagedField(fid)) return;
        if (sourceFormData[fid] === undefined) {
          sourceFormData[fid] = null;
        }
      });

      const sourceRows = rows.map((row: any) => {
        const out: Record<string, any> = {};
        Object.entries(row || {}).forEach(([key, value]) => {
          if (key === '_rowId' || value === undefined) return;
          out[key] = value;
        });
        return out;
      });

      const receiptHeaderAccountRaw = formData.depositToAccountId || formData.accountId || formData.account || undefined;
      const paymentHeaderAccountRaw = formData.payFromAccountId || formData.accountId || formData.account || undefined;
      const semanticHeaderRaw =
        backendType === 'receipt'
          ? receiptHeaderAccountRaw
          : backendType === 'payment'
            ? paymentHeaderAccountRaw
            : (formData.accountId || formData.account || undefined);
      const semanticHeaderIdentity = resolveAccountIdentity(semanticHeaderRaw);
      const normalizedHeaderAccountId = semanticHeaderIdentity.id || (typeof semanticHeaderRaw === 'string' ? semanticHeaderRaw : undefined);
      const normalizedHeaderAccountCode = semanticHeaderIdentity.code ||
        (typeof semanticHeaderRaw === 'string' ? (getAccountByCode(semanticHeaderRaw)?.code || undefined) : undefined) ||
        (typeof formData.account === 'string' ? formData.account : undefined);

      const sourcePayload = {
        ...sourceFormData,
        ...(normalizedHeaderAccountId ? { accountId: normalizedHeaderAccountId } : {}),
        ...(normalizedHeaderAccountCode ? { account: normalizedHeaderAccountCode } : {}),
        ...(backendType === 'receipt' && normalizedHeaderAccountId ? { depositToAccountId: normalizedHeaderAccountId } : {}),
        ...(backendType === 'payment' && normalizedHeaderAccountId ? { payFromAccountId: normalizedHeaderAccountId } : {}),
        lines: sourceRows,
        type: backendType,
        formId: resultFormId,
        prefix: resultPrefix,
        numberFormat: resultNumberFormat
      };
      
      return {
        ...sourceFormData,
        ...((formData?.id || initialData?.id) ? { id: formData?.id || initialData?.id } : {}),
        ...(normalizedHeaderAccountId ? { accountId: normalizedHeaderAccountId } : {}),
        ...(normalizedHeaderAccountCode ? { account: normalizedHeaderAccountCode } : {}),
        ...(backendType === 'receipt' ? { depositToAccountId: normalizedHeaderAccountId || receiptHeaderAccountRaw } : {}),
        ...(backendType === 'payment' ? { payFromAccountId: normalizedHeaderAccountId || paymentHeaderAccountRaw } : {}),
        lines: backendLines,
        type: backendType,  // Backend type for strategy (payment, receipt, journal_entry, opening_balance)
        formId: resultFormId, // Which form was used for rendering
        prefix: resultPrefix, // Voucher number prefix
        numberFormat: resultNumberFormat, // Custom number format template
        sourcePayload
      };
    },
    getRows: () => rows,
    resetData: () => {
      const today = getCompanyToday(settings);
      
      setRows(getInitialRows());
      hasUserTouchedHeaderFxRef.current = false;
      setFormData({
        date: today,
        currency: company?.baseCurrency || '',
        exchangeRate: 1,
        status: 'Draft',
        voucherNumber: 'Auto-generated'
      });
    }
  }), [definition, company, settings, rows, formData]);
  
  const handleInputChange = (fieldId: string, value: any) => {
    if (fieldId === 'currency' || fieldId === 'exchangeRate') {
      hasUserTouchedHeaderFxRef.current = true;
    }
    setFormData((prev: any) => {
      let next: any;
      if (fieldId.startsWith('metadata.')) {
        const metaProp = fieldId.split('.')[1];
        next = {
          ...prev,
          metadata: {
            ...(prev.metadata || {}),
            [metaProp]: value
          }
        };
      } else {
        next = { ...prev, [fieldId]: value };
      }
      
      onChangeRef.current?.({ ...next, lines: rows });
      return next;
    });

    // HEADER CURRENCY CHANGED: Recalculate ALL line parities relative to the new voucher currency
    if (fieldId === 'currency' && value) {
      const newVoucherCurrency = (value as string).toUpperCase();
      const baseCurrency = (company?.baseCurrency || '').toUpperCase();

      // We need the current exchange rate for the new currency
      const currentHeaderRate = Number(formData?.exchangeRate) || 1.0;

      const recalculateAllParities = async () => {
        const updatedRows: JournalRow[] = [];
        const ratePromises: Promise<void>[] = [];

        for (const row of rows) {
          const lineCurrency = (row.currency || '').toUpperCase();
          const debit = Number(row.debit) || 0;
          const credit = Number(row.credit) || 0;
          const amount = debit || credit || 0;

          if (!lineCurrency || !amount) {
            updatedRows.push(row);
            continue;
          }

          if (lineCurrency === newVoucherCurrency) {
            // Same as new voucher currency → parity = 1
            updatedRows.push({ ...row, parity: 1.0, equivalent: amount });
          } else if (lineCurrency === baseCurrency) {
            // Line is in base currency, voucher is in foreign currency
            const parity = currentHeaderRate !== 0 ? (1 / currentHeaderRate) : 1.0;
            updatedRows.push({ ...row, parity, equivalent: roundMoney(amount * parity) });
          } else {
            // Line is in a different foreign currency — need to fetch rate
            const idx = updatedRows.length;
            updatedRows.push(row); // placeholder, will be updated by promise
            ratePromises.push(
              accountingApi.getSuggestedRate(
                lineCurrency,
                newVoucherCurrency,
                formData?.date || getCompanyToday(settings)
              ).then(result => {
                if (result.rate) {
                  const parity = result.rate;
                  updatedRows[idx] = { ...row, parity, equivalent: roundMoney(amount * parity) };
                }
              }).catch(err => {
                console.error(`[HEADER CURRENCY CHANGE] Failed to fetch rate for ${lineCurrency}→${newVoucherCurrency}:`, err);
              })
            );
          }
        }

        // Wait for any async rate fetches
        if (ratePromises.length > 0) {
          await Promise.all(ratePromises);
        }

        // Apply all updated rows at once
        setRows(updatedRows);
        onChangeRef.current?.({ ...formData, currency: value, lines: updatedRows });
      };

      recalculateAllParities();
    }
  };

  const handleRowChange = async (id: number, field: keyof JournalRow | string | Record<string, any>, value?: any) => {
    // 1. Update state synchronously for snappiness
    let targetRow: JournalRow | undefined;

    setRows((prev: JournalRow[]) => {
      const next = prev.map(row => {
        if (row.id === id) {
          let updated: JournalRow;
          
          if (typeof field === 'object' && field !== null) {
            updated = { ...row, ...field };
          } else if ((field as string).startsWith('metadata.')) {
            const metaProp = (field as string).split('.')[1];
            updated = {
              ...row,
              metadata: {
                ...(row.metadata || {}),
                [metaProp]: value
              }
            };
          } else {
            updated = { ...row, [field as string]: value };
            
            // Sync costCenter / costCenterId
            if (field === 'costCenterId') updated.costCenter = updated.costCenter || '';
            if (field === 'costCenter') updated.costCenterId = updated.costCenterId || '';
          }
          
          // ACCOUNT-CURRENCY SYNC: If any account-like field changes, normalize and sync currency.
          const fieldName = typeof field === 'string' ? field : '';
          const isAccountLikeField =
            fieldName === 'account' ||
            fieldName === 'accountId' ||
            fieldName === 'accountSelector' ||
            fieldName.toLowerCase().includes('accountid');

          if (isAccountLikeField) {
            const accVal = value as Account | null | string;
            const defaultCurrency = formData.currency || company?.baseCurrency || '';
            const normalizedAccountField = fieldName === 'accountSelector' ? 'accountId' : fieldName;

            let selectedAccount: Account | undefined;
            if (accVal && typeof accVal === 'object') {
              selectedAccount = accVal;
            } else if (accVal) {
              const rawValue = accVal as string;
              selectedAccount = getAccountByCode(rawValue) || getAccountById(rawValue);
            }

            if (selectedAccount) {
              // Keep generic aliases in sync for shared logic/compatibility.
              updated.account = selectedAccount.code;
              updated.accountId = selectedAccount.id;
              (updated as any)[normalizedAccountField] = normalizedAccountField.toLowerCase().includes('accountid')
                ? selectedAccount.id
                : selectedAccount.code;

              // Rule 1.3: Currency Policy Enforcement
              if (selectedAccount.currencyPolicy === 'FIXED' && selectedAccount.fixedCurrencyCode) {
                updated.currency = selectedAccount.fixedCurrencyCode;
                console.log(`[POLICY] Account ${selectedAccount.code} has FIXED currency policy. Setting line to ${selectedAccount.fixedCurrencyCode}.`);
              } else if (selectedAccount.currency) {
                updated.currency = selectedAccount.currency;
              } else {
                updated.currency = defaultCurrency;
              }
            } else {
              // Preserve raw value and keep aliases best-effort when account lookup fails.
              (updated as any)[normalizedAccountField] = accVal || '';
              if (normalizedAccountField !== 'account') {
                updated.account = (typeof accVal === 'string' ? accVal : '') || updated.account || '';
              }
              updated.currency = defaultCurrency;
            }
          }

          // Mutual exclusion: debit and credit cannot both have values
          if (field === 'debit' && value > 0) {
            updated.credit = 0;
            (updated as any).side = 'Debit';
            (updated as any).amount = value;
          } else if (field === 'credit' && value > 0) {
            updated.debit = 0;
            (updated as any).side = 'Credit';
            (updated as any).amount = value;
          }

          // Handle numeric fields safely without stripping partial decimals
          if (['debit', 'credit', 'parity', 'equivalent'].includes(field as string)) {
            updated[field as 'debit' | 'credit' | 'parity' | 'equivalent'] = value as any;
          }
          
          // SPECIAL CASE: If Equivalent modified, reverse-calculate Parity
          if (field === 'equivalent') {
             const debit = parseFloat(updated.debit as any) || 0;
             const credit = parseFloat(updated.credit as any) || 0;
             const amount = debit || credit || 0;
             const newEquiv = parseFloat(value as any) || 0;
             
             if (amount !== 0) {
                 updated.parity = Number((newEquiv / amount).toFixed(6));
             }
          }

          // MULTI-CURRENCY LOGIC: Re-calculate equivalent (Base Amount)
          const debit = parseFloat(updated.debit as any) || 0;
          const credit = parseFloat(updated.credit as any) || 0;
          const parity = parseFloat(updated.parity as any) || 1.0;
          const amount = debit || credit || 0;
          
          // ALWAYS Recalculate Equivalent to ensure it matches Amount * Parity
          // Rounding to 2 decimal places is standard for currency values in accounting.
          updated.equivalent = roundMoney(amount * parity);
          
          targetRow = updated;
          return updated;
        }
        return row;
      });
      onChangeRef.current?.({ ...formData, lines: next });
      return next;
    });

    // 2. PARITY SYNC: (Calculates parity when currencies change)
    // Only trigger if currency actually changes AND it's not the initial load of an existing voucher
    const fieldKey = typeof field === 'string' ? field : '';
    const isAccountLikeField =
      fieldKey === 'account' ||
      fieldKey === 'accountId' ||
      fieldKey === 'accountSelector' ||
      fieldKey.toLowerCase().includes('accountid');

    if ((fieldKey === 'currency' || isAccountLikeField || fieldKey === 'exchangeRate') && targetRow) {
      const isNewVoucher = !initialData?.id;
      const rowId = id;
      
      const lineCurrency = targetRow.currency || '';
      const voucherCurrency = formData.currency || company?.baseCurrency || '';
      const baseCurrency = company?.baseCurrency || '';
      
      // If we are loading an existing voucher, don't auto-fetch/overwrite saved parities 
      // unless the user just changed the currency.
      if (!isNewVoucher && fieldKey !== 'currency' && !isAccountLikeField) {
        return;
      }

      if (lineCurrency.toUpperCase() === voucherCurrency.toUpperCase()) {
        // Same as voucher currency → parity = 1
        setRows((prev: JournalRow[]) => {
          const next = prev.map(r => {
            if (r.id === rowId) {
              const debit = Number(r.debit) || 0;
              const credit = Number(r.credit) || 0;
              return { ...r, parity: 1.0, equivalent: debit || credit || 0 };
            }
            return r;
          });
          onChangeRef.current?.({ ...formData, lines: next });
          return next;
        });
      } else if (lineCurrency.toUpperCase() === baseCurrency.toUpperCase()) {
        // Line is in base currency, voucher is in foreign currency
        const voucherRate = Number(formData.exchangeRate) || 1.0;
        const parity = voucherRate !== 0 ? (1 / voucherRate) : 1.0;
        
        setRows((prev: JournalRow[]) => {
          const next = prev.map(r => {
            if (r.id === rowId) {
              const debit = Number(r.debit) || 0;
              const credit = Number(r.credit) || 0;
              const amount = debit || credit || 0;
              return { 
                ...r, 
                parity, 
                equivalent: roundMoney(amount * parity)
              };
            }
            return r;
          });
          onChangeRef.current?.({ ...formData, lines: next });
          return next;
        });
      } else {
        // Line is in different foreign currency
        try {
          const result = await accountingApi.getSuggestedRate(
            lineCurrency, 
            voucherCurrency,
            formData.date || getCompanyToday(settings)
          );
          
          if (result.rate) {
            setRows((prev: JournalRow[]) => {
              const next = prev.map(r => {
                if (r.id === rowId) {
                  const parity = result.rate || 1.0;
                  const debit = Number(r.debit) || 0;
                  const credit = Number(r.credit) || 0;
                  const amount = debit || credit || 0;
                  return { 
                    ...r, 
                    parity, 
                    equivalent: roundMoney(amount * parity)
                  };
                }
                return r;
              });
              onChangeRef.current?.({ ...formData, lines: next });
              return next;
            });
          }
        } catch (error) {
          console.error('[PARITY SYNC] Failed to fetch rate:', error);
        }
      }
    }
  };

  const addRow = () => {
    setRows(prev => {
      const nextId = prev.length > 0 ? Math.max(...prev.map(r => Math.abs(r.id))) + 1 : Date.now();
      const next = [...prev, {
        id: -nextId, // Negative ID for draft rows
        account: '', notes: '', debit: 0, credit: 0, currency: '', parity: 1, equivalent: 0, category: '', metadata: {}
      }];
      onChangeRef.current?.({ ...formData, lines: next });
      return next;
    });
  };

  // Helper: Get display prefix from definition
  const getVoucherPrefix = (): string => {
    return definition.code?.substring(0, 3) || 'VOC';
  };

  // --- Field Renderers ---

  const renderField = (fieldId: string, labelOverride?: string, typeOverride?: string, displayMode: string = 'standard', iconOverride?: string, isGrouped: boolean = false) => {
    // Helper to get field value with case-insensitive lookup
    const getFieldValue = (fid: string) => {
      if (fid.includes('.')) {
        const parts = fid.split('.');
        let current: any = formData;
        for (const part of parts) {
          if (current === undefined || current === null) return '';
          current = current[part];
        }
        return current ?? '';
      }
      const lower = fid.toLowerCase();
      return formData[fid] ?? formData[lower] ?? formData.metadata?.[fid] ?? formData.metadata?.[lower] ?? '';
    };

    // SAFETY: Strip any legacy debug labels if they come from the database/override
    const cleanLabel = (label: string) => {
      if (!label) return label;
      return label.replace(/🔴\s*TEST:\s*/gi, '').replace(/TEST:\s*/gi, '');
    };

    const finalLabel = cleanLabel(
      labelOverride || t(`voucherRenderer.fields.${fieldId}`, { defaultValue: labelOverride || fieldId })
    );
    
    // 0. Suppress standalone exchangeRate if it's handled by CurrencyExchangeWidget (at currency slot)
    if (fieldId === 'exchangeRate') {
      const hasCurrency = (definition.headerFields || []).some(f => f.id === 'currency' || f.id === 'currencyExchange');
      const hasCurrencyInUI = (definition as any).uiModeOverrides?.[mode]?.sections?.HEADER?.fields?.some((f: any) => f.fieldId === 'currency' || f.fieldId === 'currencyExchange');
      
      if (hasCurrency || hasCurrencyInUI) {
        return null;
      }
    }

    // 0. Special Components (Currency Exchange Widget via Registry)
    if (fieldId === 'currencyExchange' || fieldId === 'exchangeRate') {
      const CurrencyComp = CustomComponentRegistry.currencyExchange;
      // Fix label if it comes through as the raw ID
      const displayLabel = (finalLabel === 'CURRENCYEXCHANGE' || finalLabel === 'currencyExchange') 
                          ? t('voucherRenderer.fields.exchangeRate', { defaultValue: 'Exchange Rate' }) 
                          : finalLabel;
                          
      return (
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide">{displayLabel}</label>
          <CurrencyComp
            currency={formData.currency || formData.baseCurrency || company?.baseCurrency || 'USD'}
            value={formData.exchangeRate}
            baseCurrency={formData.baseCurrency || company?.baseCurrency || 'USD'}
            voucherDate={formData.date}
            disabled={readOnly}
            onChange={(rate: number) => {
              handleInputChange('exchangeRate', rate);
            }}
          />
        </div>
      );
    }

    // 0.5. Custom Components from Registry
    // Also route any field that is an account selector by name or type:
    //   - explicit registry entry
    //   - fieldId === 'account' or 'accountSelector'
    //   - semantic header account fields: depositToAccountId, payFromAccountId
    //   - any field ending in 'accountid' (case-insensitive)
    //   - typeOverride === 'account-selector'
    const lowerFieldId = fieldId.toLowerCase();
    const isAccountSelectorField =
      !!CustomComponentRegistry[fieldId] ||
      fieldId === 'account' ||
      fieldId === 'accountSelector' ||
      fieldId === 'depositToAccountId' ||
      fieldId === 'payFromAccountId' ||
      lowerFieldId.endsWith('accountid') ||
      typeOverride === 'account-selector' ||
      typeOverride === 'AccountSelector';

    if (isAccountSelectorField) {
      // Prefer any registered custom component, then fall back to the imported AccountSelector
      const AccountComponent = CustomComponentRegistry[fieldId] || CustomComponentRegistry.account || AccountSelector;
      // Resolve value: check exact field key, then semantic siblings, then generic accountId
      const fieldValue =
        formData[fieldId] ||
        (lowerFieldId === 'deposittoaccountid' ? formData.depositToAccountId : undefined) ||
        (lowerFieldId === 'payfromaccountid' ? formData.payFromAccountId : undefined) ||
        formData.accountId ||
        '';
      return (
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide">{finalLabel}</label>
          <AccountComponent
            value={fieldValue}
            disabled={readOnly}
            onChange={(val: any) => {
               if (val && typeof val === 'object' && (val.id || val.code)) {
                  const stored = fieldId === 'account' ? val.code : (val.id || val.code);
                  handleInputChange(fieldId, stored);
                  if (fieldId !== 'account') handleInputChange('accountId', val.id || val.code);
                  if (fieldId !== 'accountId') handleInputChange('account', val.code || val.id);
               } else {
                  handleInputChange(fieldId, val);
               }
            }}
          />
        </div>
      );
    }
    
    // 0.8. Action Fields
    if (fieldId.startsWith('action_')) {
      const actionKey = fieldId.replace(/^action_/, '');
      const configDef = definition as any;
      const actionConfig = configDef.actions?.find((a: any) => a.type === actionKey);
      // Determine label: override > layout label > config label > default translation
      const actionLabel = labelOverride || actionConfig?.label || t(`voucherRenderer.actions.${actionKey}`, { defaultValue: labelOverride || actionKey });
      
      const DownloadPdfIcon = ({ size = 18, ...props }: any) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-90" {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h5" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
          <line x1="8" y1="13" x2="10" y2="13" />
          <line x1="8" y1="17" x2="10" y2="17" />
          <line x1="16" y1="12" x2="16" y2="21" />
          <polyline points="13 18 16 21 19 18" />
        </svg>
      );

      const DownloadExcelIcon = ({ size = 18, ...props }: any) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-90" {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h5" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
          <path d="M7 13l4 4" />
          <path d="M11 13l-4 4" />
          <line x1="16" y1="12" x2="16" y2="21" />
          <polyline points="13 18 16 21 19 18" />
        </svg>
      );

      const ImportCsvIcon = ({ size = 18, ...props }: any) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-90" {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h5" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
          <line x1="8" y1="13" x2="10" y2="13" />
          <line x1="8" y1="17" x2="10" y2="17" />
          <line x1="16" y1="21" x2="16" y2="12" />
          <polyline points="13 15 16 12 19 15" />
        </svg>
      );
      
      const ExportJsonIcon = ({ size = 18, ...props }: any) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-90" {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h5" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
          <path d="M10 13l-2 2 2 2" />
          <line x1="16" y1="12" x2="16" y2="21" />
          <polyline points="13 18 16 21 19 18" />
        </svg>
      );

      const Icon = iconOverride === 'Printer' ? Printer :
                   iconOverride === 'Save' ? Save :
                   iconOverride === 'Download' ? Download :
                   iconOverride === 'Mail' ? Mail :
                   iconOverride === 'Send' ? Send :
                   iconOverride === 'FileText' ? FileText :
                   iconOverride === 'Check' ? Check :
                   iconOverride === 'X' ? X :
                   iconOverride === 'Upload' ? Upload :
                   iconOverride === 'Image' ? ImageIcon :
                   iconOverride === 'Excel' ? FileSpreadsheet :
                   actionKey === 'print' ? Printer :
                   actionKey === 'save' ? Save :
                   actionKey === 'download_pdf' ? DownloadPdfIcon :
                   actionKey === 'download_excel' ? DownloadExcelIcon :
                   actionKey === 'import_csv' ? ImportCsvIcon :
                   actionKey === 'export_json' ? ExportJsonIcon :
                   actionKey === 'email' ? Mail :
                   null;

      const iconOnly = (actionConfig?.isCompact) || (displayMode === 'compact') || (displayMode === 'badge');

      if (iconOnly && Icon) {
        const btn = (
            <button 
              title={actionLabel}
              type="button"
              className={`flex items-center justify-center p-2 transition-all text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] active:scale-[0.98] text-indigo-600 dark:text-indigo-400 aspect-square h-9 w-9 shrink-0 mx-auto ${isGrouped ? 'hover:z-10 relative bg-transparent' : 'bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-full shadow-sm'}`}
            >
              <Icon size={18} />
            </button>
        );
        if (isGrouped) return btn;
        return (
          <div className="flex items-center justify-center p-1 w-full h-full">
            {btn}
          </div>
        );
      }

      const stdBtn = (
          <button 
            type="button"
            className={`flex items-center justify-center w-full h-full gap-2 px-4 text-xs font-bold transition-all bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] active:scale-[0.98] ${isGrouped ? 'hover:z-10 relative' : 'rounded-lg shadow-sm'}`}
          >
            {Icon && <Icon size={16} />}
            <span className="truncate">{actionLabel}</span>
          </button>
      );
      
      if (isGrouped) return stdBtn;
      
      return (
        <div className="flex items-end h-full py-1 min-h-[40px]">
          {stdBtn}
        </div>
      );
    }

    
    // 1. System Fields (Read Only)
    // Removed 'date' from this list as it should be editable via CompanyDatePicker
    const lowerFid = fieldId.toLowerCase();
    if (['vouchernumber', 'voucherno', 'status', 'createdby', 'createdat', 'updatedby', 'updatedat'].includes(lowerFid)) {
       const isDate = lowerFid === 'createdat' || lowerFid === 'updatedat';
       // Case-insensitive value lookup
       const rawValue = formData[fieldId] ?? formData[lowerFid] ?? '';
       
       let displayValue;
       if (isDate) {
           // If it's already a formatted string (e.g., "31/12/2025"), use it directly
           // Otherwise, format it using formatCompanyDate and add time
           if (typeof rawValue === 'string' && rawValue.includes('/')) {
               displayValue = rawValue;
           } else if (rawValue) {
               // Parse ISO timestamp and format with date + time
               const date = new Date(rawValue);
               if (!isNaN(date.getTime())) {
                   const dateStr = formatCompanyDate(rawValue, settings);
                   const timeStr = date.toLocaleTimeString('en-US', { 
                       hour: '2-digit', 
                       minute: '2-digit',
                       hour12: true 
                   });
                   displayValue = `${dateStr} ${timeStr}`;
               } else {
                   displayValue = formatCompanyDate(rawValue, settings);
               }
           } else {
               displayValue = '-';
           }
       } else if ((lowerFid === 'createdby' || lowerFid === 'updatedby') && typeof rawValue === 'string' && rawValue.length > 15) {
           // Truncate long user IDs
           displayValue = rawValue.substring(0, 12) + '...';
       } else {
           // For voucherNumber: fall back to voucherNo (backend canonical field) before showing placeholder
           let resolvedValue = rawValue;
           if (!resolvedValue && (lowerFid === 'vouchernumber' || lowerFid === 'voucherno')) {
             resolvedValue = formData.voucherNo || formData.voucherNumber || '';
           }
           displayValue = resolvedValue || '-';
       }
       
       if (displayMode === 'badge') {
         return (
            <div className="flex items-center gap-2 py-1">
               <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wide">{finalLabel}:</span>
               {lowerFid === 'status' ? (
                 <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                   displayValue === 'POSTED' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800' :
                   displayValue === 'VOID' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800' :
                   'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                 }`}>
                   {displayValue}
                 </span>
               ) : (
                 <span className="text-[11px] font-medium text-[var(--color-text-primary)]">{displayValue}</span>
               )}
            </div>
         );
       } else if (displayMode === 'compact') {
         return (
            <div className="flex flex-col space-y-0.5">
               <span className="text-[9px] uppercase font-bold text-[var(--color-text-muted)] leading-none tracking-wide">{finalLabel}</span>
               <span className="text-[11px] font-bold text-[var(--color-text-primary)] leading-none">{displayValue}</span>
            </div>
         );
       }
       
       return (
          <div className="space-y-0.5">
             <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide">{finalLabel}</label>
             <div 
                 className="w-full h-[32px] px-2 border border-[var(--color-border)] rounded bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] text-xs shadow-sm flex items-center transition-colors"
                 style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                 title={rawValue}
             >
               {displayValue}
             </div>
          </div>
       );
    }

    // 2. Line Items Table
    if (fieldId === 'lineItems') {
        const columns = getTableColumns();
        const isClassic = (definition as any).tableStyle === 'classic';
        
        // Handle resize start
        const handleResizeStart = (e: React.MouseEvent, columnId: string, currentWidth: number) => {
            e.preventDefault();
            setResizing({ columnId, startX: e.clientX, startWidth: currentWidth });
        };

        if (isClassic) {
            return (
                <div className="border border-[var(--color-border)] rounded overflow-hidden shadow-sm bg-[var(--color-bg-primary)] transition-colors">
                    <div className="max-h-[300px] overflow-y-auto custom-scroll">
                    <table className="w-full text-sm min-w-[600px] border-collapse">
                        <thead className="sticky top-0 bg-[var(--color-bg-tertiary)] z-10 transition-colors">
                             <tr className="border-b-2 border-[var(--color-border)]">
                                 <th className="p-2 text-center w-10 text-[11px] font-bold text-[var(--color-text-primary)] border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)]/30">#</th>
                                 {columns.map(col => {
                                     // Parse initial width from column definition
                                     let initialWidth = 150; // Default
                                     if (col.width) {
                                       if (typeof col.width === 'number') {
                                         initialWidth = col.width;
                                       } else if (typeof col.width === 'string') {
                                         const parsed = parseInt(col.width);
                                         if (!isNaN(parsed)) initialWidth = parsed;
                                       }
                                     }
                                     
                                     const colWidth = columnWidths[col.id] || initialWidth;
                                     
                                     return (
                                         <th 
                                           key={col.id} 
                                           className="p-2 text-start text-[11px] font-bold text-[var(--color-text-primary)] uppercase tracking-wide border-r border-[var(--color-border)] relative group transition-colors"
                                           style={{ width: `${colWidth}px`, minWidth: `${colWidth}px` }}
                                         >
                                           {col.label}
                                           {/* Resize handle */}
                                           <div
                                             className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                             onMouseDown={(e) => handleResizeStart(e, col.id, colWidth)}
                                           />
                                         </th>
                                     );
                                 })}
                                 <th className="p-2 w-8 border-[var(--color-border)] border-r-0"></th>
                             </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)] transition-colors">
                            {rows.map((row, index) => (
                                 <tr 
                                   key={row.id} 
                                   className={`hover:bg-primary-50/40 dark:hover:bg-primary-900/10 hover:shadow-sm transition-all duration-150 border-b border-[var(--color-border)] group ${highlightedRows.has(row.id) ? 'bg-warning-100/50 dark:bg-warning-900/30' : ''}`}
                                 >
                                    <td 
                                      className="p-2 text-[var(--color-text-muted)] text-[11px] font-medium text-center border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)]/30 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                                      onContextMenu={(e) => handleLineContextMenu(e, row.id)}
                                    >
                                      {index + 1}
                                    </td>
                                     {columns.map((col, colIndex) => {
                                         const colId = col.id;
                                         const totalCols = columns.length;
                                         
                                         // Parse initial width (same logic as header)
                                         let initialWidth = 150;
                                         if (col.width) {
                                           if (typeof col.width === 'number') {
                                             initialWidth = col.width;
                                           } else if (typeof col.width === 'string') {
                                             const parsed = parseInt(col.width);
                                             if (!isNaN(parsed)) initialWidth = parsed;
                                           }
                                         }
                                         const colWidth = columnWidths[colId] || initialWidth;
                                         
                                         return (
                                             <td 
                                               key={`${row.id}-${colId}`} 
                                               className="p-0 border-r border-[var(--color-border)]"
                                               style={{ width: `${colWidth}px`, minWidth: `${colWidth}px` }}
                                             >
                                                 {(colId === 'account' || colId === 'accountId' || colId === 'accountSelector' || colId.toLowerCase().includes('accountid') || col.type === 'account-selector') ? (
                                                     <div className="p-0.5">
                                                        <AccountSelector 
                                                            ref={(el) => registerCellRef(index, colIndex, el)}
                                                            value={(getRowValue(row, colId) || row.accountId || row.account) as string}
                                                            onChange={(val) => handleRowChange(row.id, colId as any, val)} 
                                                            noBorder={true}
                                                            disabled={readOnly}
                                                            placeholder={t('accountSelector.placeholder', { defaultValue: '...Account code' })}
                                                            onKeyDown={(e) => handleCellKeyDown(e, index, colIndex, totalCols)}
                                                            onBlur={() => onBlurRef.current?.()}
                                                        />
                                                    </div>

                                                  ) : (colId === 'costCenterId' || colId === 'costCenter' || colId.toLowerCase().includes('costcenter') || col.type === 'cost-center-selector') ? (
                                                      <div className="p-0.5">
                                                         <CostCenterSelector 
                                                             ref={(el) => registerCellRef(index, colIndex, el)}
                                                             value={(row as any).costCenterId || (row as any).costCenter} 
                                                             onChange={(val) => {
                                                               handleRowChange(row.id, { costCenterId: val ? val.id : undefined, costCenter: val ? val.code : '' } as any);
                                                             }} 
                                                             noBorder={true}
                                                             disabled={readOnly}
                                                             placeholder={t('costCenterSelector.placeholder', { defaultValue: '...Cost center' })}
                                                             onKeyDown={(e) => handleCellKeyDown(e, index, colIndex, totalCols)}
                                                             onBlur={() => onBlurRef.current?.()}
                                                         />
                                                     </div>

                                                  ) : (colId === 'debit' || colId === 'credit' || colId === 'equivalent' || col.type === 'number' || col.type === 'amount') ? (
                                                      <AmountInput
                                                          ref={(el) => registerCellRef(index, colIndex, el)}
                                                          value={parseFloat(getRowValue(row, colId) as any) || 0}
                                                          disabled={readOnly || col.readOnly}
                                                          onChange={(val) => handleRowChange(row.id, colId as any, val)}
                                                          onKeyDown={(e) => {
                                                              if (colId === 'debit' || colId === 'credit') {
                                                                  handleAmountKeyDown(e, row.id, colId as 'debit' | 'credit', index, colIndex);
                                                              } else {
                                                                  handleCellKeyDown(e, index, colIndex, totalCols);
                                                              }
                                                          }}
                                                          onBlur={() => onBlurRef.current?.()}
                                                          placeholder=""
                                                       />
                                                 ) : colId === 'parity' ? (
                                                     <div className="relative group/parity">
                                                       <AmountInput
                                                         ref={(el) => registerCellRef(index, colIndex, el)}
                                                         value={(row.parity as number) || 1}
                                                         disabled={readOnly}
                                                         onChange={(val) => handleRowChange(row.id, 'parity', val)}
                                                         onKeyDown={(e) => handleAmountKeyDown(e, row.id, 'parity', index, colIndex)}
                                                         onBlur={() => onBlurRef.current?.()}
                                                         placeholder=""
                                                       />
                                                       {/* Rate Deviation Warning */}
                                                       {false && (rateDeviations[row.id]?.showWarning) && (
                                                         <div className="absolute left-0 top-full z-50 mt-1 p-2 bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-600 rounded-md shadow-lg min-w-[200px] text-xs">
                                                           <div className="flex items-center gap-1 text-amber-700 dark:text-amber-300 font-medium mb-1">
                                                             <span>⚠️ Rate differs by {rateDeviations[row.id]?.deviation}%</span>
                                                           </div>
                                                           <div className="text-amber-600 dark:text-amber-400 mb-2">
                                                             <div>Your rate: {row.parity}</div>
                                                             <div>System rate: {rateDeviations[row.id]?.systemRate}</div>
                                                           </div>
                                                           <button
                                                             onClick={() => handleSaveRateToSystem(row.id)}
                                                             disabled={savingRate === row.id}
                                                             className="w-full px-2 py-1 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded transition-colors disabled:opacity-50"
                                                           >
                                                             {savingRate === row.id ? 'Saving...' : 'Add rate to system'}
                                                           </button>
                                                         </div>
                                                       )}
                                                       {/* Warning indicator dot */}
                                                       {false && (rateDeviations[row.id]?.showWarning) && (
                                                         <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full animate-pulse" title={`Rate differs by ${rateDeviations[row.id]?.deviation}%`} />
                                                       )}
                                                     </div>
                                                 ) : colId === 'currency' ? (
                                                     <div className="p-0.5 relative group/curr">
                                                        <CurrencySelector
                                                            ref={(el) => registerCellRef(index, colIndex, el)}
                                                            value={row.currency}
                                                            disabled={readOnly || (() => {
                                                              const acc = getAccountByCode(row.account);
                                                              return acc?.currencyPolicy === 'FIXED';
                                                            })()}
                                                            placeholder={t('currencySelector.placeholder', { defaultValue: '...Cur' })}
                                                            onChange={(val) => handleRowChange(row.id, 'currency', val)}
                                                            onKeyDown={(e) => handleCellKeyDown(e, index, colIndex, totalCols)}
                                                            onBlur={() => onBlurRef.current?.()}
                                                            noBorder
                                                        />
                                                       {getAccountByCode(row.account)?.currencyPolicy === 'FIXED' && (
                                                         <div className="absolute -top-1 -right-1 opacity-0 group-hover/curr:opacity-100 transition-opacity">
                                                           <span className="bg-primary-500 text-white text-[8px] px-1 rounded-sm shadow-sm">FIXED</span>
                                                         </div>
                                                       )}
                                                     </div>
                                                  ) : (
                                                      <input
                                                        ref={(el) => registerCellRef(index, colIndex, el)}
                                                        type="text" 
                                                        value={getRowValue(row, colId)}
                                                        disabled={readOnly || col.readOnly} 
                                                        onChange={(e) => handleRowChange(row.id, colId as any, e.target.value)}
                                                        onKeyDown={(e) => handleCellKeyDown(e, index, colIndex, totalCols)}
                                                        onBlur={() => onBlurRef.current?.()}
                                                        className={`w-full h-9 p-2 border-none bg-transparent text-xs focus:ring-2 focus:ring-primary-500 outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] transition-colors ${readOnly || col.readOnly ? 'cursor-not-allowed opacity-70' : ''}`} 
                                                       />
                                                  )}
                                         </td>
                                     );
                                 })}
                                <td className="p-1 text-center w-8">
                                    {!readOnly && (
                                      <button 
                                        onClick={() => {
                                          setRows(prev => {
                                            const next = prev.filter(r => r.id !== row.id);
                                            onChangeRef.current?.({ ...formData, lines: next });
                                            return next;
                                          });
                                        }}
                                        className="p-1.5 text-[var(--color-text-muted)] hover:text-danger-50 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded transition-all"
                                      >
                                          <Trash2 size={14} />
                                      </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
                {!readOnly && (
                  <button onClick={addRow} className="w-full py-2.5 text-center text-[11px] font-bold text-primary-600 bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)] hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all uppercase tracking-widest">
                      + {t('addLine')}
                  </button>
                )}
                
                {/* Line Context Menu */}
                {lineContextMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-[9998]" 
                      onClick={closeLineContextMenu}
                      onContextMenu={(e) => { e.preventDefault(); closeLineContextMenu(); }}
                    />
                    <div 
                      className="fixed bg-[var(--color-bg-primary)] rounded-lg shadow-2xl border border-[var(--color-border)] z-[9999] py-1.5 w-52 transition-colors animate-in fade-in zoom-in duration-200"
                      style={{ left: lineContextMenu.x, top: lineContextMenu.y }}
                    >
                      <button
                        onClick={() => handleDeleteLine(lineContextMenu.rowId)}
                        className="w-full px-4 py-2 text-left text-sm text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 flex items-center gap-3 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Line
                      </button>
                      <div className="border-t border-[var(--color-border)] my-1.5 opacity-50"></div>
                      <button
                        onClick={() => handleCopyLine(lineContextMenu.rowId)}
                        className="w-full px-4 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-3 transition-colors"
                      >
                        <Download className="w-4 h-4 text-[var(--color-text-secondary)]" />
                        Copy
                      </button>
                      <button
                        onClick={() => handlePasteLine(lineContextMenu.rowId)}
                        className="w-full px-4 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-3 transition-colors"
                      >
                        <Plus className="w-4 h-4 text-[var(--color-text-secondary)]" />
                        Paste
                      </button>
                      <button
                        onClick={() => handleInsertLine(lineContextMenu.rowId)}
                        className="w-full px-4 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-3 transition-colors"
                      >
                        <Plus className="w-4 h-4 text-[var(--color-text-secondary)]" />
                        Insert Below
                      </button>
                      <div className="border-t border-[var(--color-border)] my-1.5 opacity-50"></div>
                      <button
                        onClick={() => handleHighlightLine(lineContextMenu.rowId)}
                        className="w-full px-4 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-3 transition-colors"
                      >
                        <span className={`w-4 h-4 rounded-sm ${highlightedRows.has(lineContextMenu.rowId) ? 'bg-warning-500' : 'bg-warning-300'} border border-warning-400`}></span>
                        {highlightedRows.has(lineContextMenu.rowId) ? 'Remove Highlight' : 'Highlight'}
                      </button>
                      <div className="border-t border-[var(--color-border)] my-1.5 opacity-50"></div>
                      <button
                        onClick={() => handleOpenStatement(lineContextMenu.rowId)}
                        className="w-full px-4 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-3 transition-colors"
                      >
                        <Calendar className="w-4 h-4 text-[var(--color-text-secondary)]" />
                        Statement
                      </button>
                      <button
                        onClick={() => handleAccountBalance(lineContextMenu.rowId)}
                        className="w-full px-4 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-3 transition-colors"
                      >
                        <ChevronDown className="w-4 h-4 text-[var(--color-text-secondary)]" />
                        Account Balance
                      </button>
                    </div>
                  </>
                )}
            </div>
        );
    }

    // Default Web Style
    return (
        <div className="border border-[var(--color-border)] rounded-lg shadow-sm min-h-[200px] bg-[var(--color-bg-primary)] transition-colors w-full overflow-hidden">
            <div className="overflow-x-auto w-full" style={{ maxWidth: '100%', display: 'block' }}>
            <table className="w-full text-sm min-w-[600px] table-fixed">
                <thead className="bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] font-medium">
                     <tr>
                         <th className="p-2 text-start w-10 text-xs">#</th>
                         {columns.map(col => (
                             <th 
                               key={col.id} 
                               className="p-2 text-start text-xs capitalize"
                               style={col.width ? { width: col.width, minWidth: col.width === 'auto' ? '150px' : col.width } : {}}
                             >
                               {col.label}
                             </th>
                         ))}
                         <th className="p-2 w-8"></th>
                     </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] opacity-80">
                    {rows.map((row, index) => (
                        <tr key={row.id} className="hover:bg-primary-50/30 dark:hover:bg-primary-900/10 transition-colors">
                            <td className="p-2 text-[var(--color-text-muted)] text-xs text-center">{index + 1}</td>
                             {columns.map((col, colIdx) => {
                                 const colId = col.id;
                                 return (
                                     <td 
                                       key={`${row.id}-${colId}`} 
                                       className="p-1"
                                       style={col.width ? { width: col.width } : {}}
                                     >
                                         {(colId === 'account' || colId === 'accountId' || colId === 'accountSelector' || colId.toLowerCase().includes('accountid') || col.type === 'account-selector') ? (
                                             <AccountSelector 
                                                 ref={(el) => registerCellRef(index, colIdx, el)}
                                                 value={(getRowValue(row, colId) || row.accountId || row.account) as string}
                                                 disabled={readOnly}
                                                 onChange={(val) => handleRowChange(row.id, colId as any, val)} 
                                                 onKeyDown={(e) => handleCellKeyDown(e, index, colIdx, columns.length)}
                                                 onBlur={() => onBlurRef.current?.()}
                                             />
                                         ) : colId === 'currency' ? (
                                             <div className="relative group/curr">
                                              <CurrencySelector
                                                  ref={(el) => registerCellRef(index, colIdx, el)}
                                                  value={row.currency}
                                                  disabled={readOnly || (() => {
                                                    const acc = getAccountByCode(row.account);
                                                    return acc?.currencyPolicy === 'FIXED';
                                                  })()}
                                                  placeholder={t('currencySelector.placeholder', { defaultValue: '...Cur' })}
                                                  onChange={(val) => handleRowChange(row.id, 'currency', val)}
                                                  onKeyDown={(e) => handleCellKeyDown(e, index, colIdx, columns.length)}
                                                  onBlur={() => onBlurRef.current?.()}
                                                  noBorder
                                              />
                                               {getAccountByCode(row.account)?.currencyPolicy === 'FIXED' && (
                                                 <div className="absolute -top-1 -right-1 opacity-0 group-hover/curr:opacity-100 transition-opacity">
                                                   <span className="bg-primary-500 text-white text-[8px] px-1 rounded-sm shadow-sm">FIXED</span>
                                                 </div>
                                               )}
                                             </div>
                                         ) : (colId === 'debit' || colId === 'credit' || colId === 'equivalent' || col.type === 'number' || col.type === 'amount') ? (
                                            <AmountInput
                                               ref={(el) => registerCellRef(index, colIdx, el)}
                                               value={parseFloat(getRowValue(row, colId) as any) || 0}
                                               onChange={(val) => handleRowChange(row.id, colId as any, val)}
                                               disabled={readOnly || col.readOnly}
                                               placeholder=""
                                               onKeyDown={(e) => {
                                                  handleCellKeyDown(e, index, colIdx, columns.length);
                                                  if (colId === 'debit' || colId === 'credit') {
                                                    handleAmountKeyDown(e, row.id, colId as 'debit' | 'credit', index, colIdx);
                                                  }
                                               }}
                                               onBlur={() => onBlurRef.current?.()}
                                               className={`w-full p-1.5 border border-[var(--color-border)] rounded text-xs text-end focus:ring-1 focus:ring-primary-500 outline-none font-mono bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] ${readOnly || col.readOnly ? 'bg-[var(--color-bg-secondary)] cursor-not-allowed opacity-80' : ''}`}
                                            />
                                         ) : colId === 'parity' ? (
                                              <AmountInput
                                                ref={(el) => registerCellRef(index, colIdx, el)}
                                                value={parseFloat(row.parity as any) || 1}
                                                onChange={(val) => handleRowChange(row.id, 'parity', val)}
                                                disabled={readOnly || col.readOnly}
                                                placeholder=""
                                                onKeyDown={(e) => {
                                                   handleCellKeyDown(e, index, colIdx, columns.length);
                                                   handleAmountKeyDown(e, row.id, 'parity', index, colIdx);
                                                }}
                                                onBlur={() => onBlurRef.current?.()}
                                                className={`w-full p-1.5 border border-[var(--color-border)] rounded text-xs text-end focus:ring-1 focus:ring-primary-500 outline-none font-mono bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] ${readOnly || col.readOnly ? 'bg-[var(--color-bg-secondary)] cursor-not-allowed opacity-80' : ''}`}
                                              />
                                         ) : (
                                              <input 
                                                ref={(el) => registerCellRef(index, colIdx, el)}
                                                type="text" 
                                                value={getRowValue(row, colId)}
                                                disabled={readOnly || col.readOnly}
                                                onChange={(e) => handleRowChange(row.id, colId as any, e.target.value)}
                                                onKeyDown={(e) => handleCellKeyDown(e, index, colIdx, columns.length)}
                                                onBlur={() => onBlurRef.current?.()}
                                                className={`w-full h-8 p-1.5 border border-[var(--color-border)] rounded text-xs focus:ring-1 focus:ring-primary-500 outline-none bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] ${readOnly || col.readOnly ? 'bg-[var(--color-bg-secondary)] cursor-not-allowed opacity-80' : ''}`}
                                              />
                                         )}
                                     </td>
                                 );
                             })}
                            <td className="p-2 text-center w-8">
                                {!readOnly && (
                                  <button 
                                    onClick={() => {
                                      setRows(prev => {
                                        const next = prev.filter(r => r.id !== row.id);
                                        onChangeRef.current?.({ ...formData, lines: next });
                                        return next;
                                      });
                                    }}
                                     className="text-[var(--color-text-muted)] hover:text-danger-500 transition-colors"
                                  >
                                      <Trash2 size={14} />
                                  </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="bg-[var(--color-bg-secondary)] border-t-2 border-[var(--color-border)] sticky bottom-0 z-10">
                    <tr>
                        <td className="p-2 text-center text-[10px] font-bold text-[var(--color-text-muted)]">∑</td>
                        {columns.map((col, idx) => {
                            const isDebitCol = col.id === 'debit';
                            const isCreditCol = col.id === 'credit';
                            const isEquivCol = col.id === 'equivalent';
                            
                            // Calculate simple transaction totals for Debit/Credit columns
                            if (isDebitCol || isCreditCol) {
                                const total = rows.reduce((sum, r) => sum + (r[col.id as 'debit' | 'credit'] || 0), 0);
                                return (
                                    <td key={`total-${col.id}`} className="p-2 text-end font-mono text-xs font-bold text-[var(--color-text-primary)]">
                                        {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        <span className="text-[10px] text-[var(--color-text-muted)] ml-1 font-normal">
                                          {formData.currency || company?.baseCurrency || ''}
                                        </span>
                                    </td>
                                );
                            }

                            // Calculate Equivalent (Base Currency) totals for the Equivalent column
                             if (isEquivCol) {
                                const equivDebit = rows.reduce((sum, r) => roundMoney(sum + roundMoney((parseFloat(r.debit as any) || 0) * (parseFloat(r.parity as any) || 1))), 0);
                                const equivCredit = rows.reduce((sum, r) => roundMoney(sum + roundMoney((parseFloat(r.credit as any) || 0) * (parseFloat(r.parity as any) || 1))), 0);
                                const balanced = Math.abs(equivDebit - equivCredit) <= 0.1;
                                const baseCode = company?.baseCurrency || '';
                                
                                return (
                                    <td key={`total-${col.id}`} className="p-2 text-end">
                                      <div className="flex flex-col items-end">
                                        <div className="flex gap-2 text-[10px] text-[var(--color-text-muted)] font-bold uppercase">
                                          <span>D: {equivDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })} {baseCode}</span>
                                          <span>C: {equivCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })} {baseCode}</span>
                                        </div>
                                        <div className={`text-xs font-mono font-bold ${balanced ? 'text-success-600' : 'text-danger-600'}`}>
                                          Diff: {(equivDebit - equivCredit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </div>
                                      </div>
                                    </td>
                                );
                            }

                            return <td key={`total-empty-${idx}`} className="p-2"></td>;
                        })}
                        <td></td>
                    </tr>
                </tfoot>
            </table>
            </div>
              {!readOnly && (
              <button onClick={addRow} className="w-full py-2 text-center text-xs font-medium text-primary-600 bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)] hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all">
                   + {t('voucherRenderer.addLine')}
               </button>
              )}
        </div>
    );
}

    // 3. Standard Inputs (from canonical headerFields)
    
    // System fields list - these are read-only display fields
    const systemFields = ['voucherNumber', 'voucherNo', 'status', 'createdBy', 'createdAt', 'updatedAt', 'updatedBy'];
    // lowerFieldId is already declared above; reuse it here
    const isSystemField = systemFields.some(sf => sf.toLowerCase() === lowerFieldId) || 
                          lowerFieldId.endsWith('createdat') || 
                          lowerFieldId.endsWith('updatedat') || 
                          lowerFieldId.endsWith('createdby') || 
                          lowerFieldId.endsWith('updatedby');
    
    // DEBUG: Log for system fields
    if (fieldId.toLowerCase().includes('created') || fieldId.toLowerCase().includes('updated')) {
        console.log(`🔍 ${fieldId} → isSystemField: ${isSystemField}, lowerFieldId: ${lowerFieldId}`);
    }

    return (
        <div className="space-y-0.5">
            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide">{finalLabel}</label>
            {/* System fields - display as read-only */}
            {(isSystemField || lowerFieldId.includes('created') || lowerFieldId.includes('updated')) ? (
                <div 
                    className="w-full p-1.5 border border-[var(--color-border)] rounded bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-secondary)] italic transition-colors block" 
                    style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={getFieldValue(fieldId)}
                >
                    {(() => {
                        // Normalize field name for checks
                        const normId = lowerFieldId.includes('createdby') ? 'createdBy' : 
                                      lowerFieldId.includes('updatedby') ? 'updatedBy' : 
                                      lowerFieldId.includes('createdat') ? 'createdAt' : 
                                      lowerFieldId.includes('updatedat') ? 'updatedAt' : fieldId;
                        
                        // Get value using helper
                        const rawVal = getFieldValue(fieldId);

                        /* Removed forced min0dXFj test */

                        const val = (normId === 'createdAt' || normId === 'updatedAt')
                            ? formatCompanyDate(rawVal, settings) 
                            : (normId === 'createdBy' && formData.createdByName) ? formData.createdByName
                            : (normId === 'updatedBy' && formData.updatedByName) ? formData.updatedByName
                            : rawVal || 'Pending';
                        
                        // Aggressive truncation for user ID fields
                        if ((normId === 'createdBy' || normId === 'updatedBy') && typeof val === 'string' && val.length > 15) {
                            return val.substring(0, 12) + '...';
                        }
                        return val;
                    })()}
                </div>
            ) : fieldId === 'currency' ? (
                 <CurrencyDropdown 
                   value={formData[fieldId] || ''}
                   readOnly={readOnly}
                   onChange={(val) => handleInputChange(fieldId, val)}
                 />
            ) : fieldId === 'paymentMethod' ? (
                 <PaymentMethodDropdown 
                   value={formData[fieldId] || ''}
                   readOnly={readOnly}
                   onChange={(val) => handleInputChange(fieldId, val)}
                   onBlur={() => onBlurRef.current?.()}
                 />
            ) : fieldId === 'date' ? (
                 <div className="space-y-1.5">
                   <DatePicker 
                     value={formData[fieldId] || ''}
                     disabled={readOnly}
                     onChange={(val: string) => handleInputChange(fieldId, val)}
                   />
                   {(() => {
                      // Check if date matches any FY end date AND has special periods
                      const date = formData[fieldId];
                      if (!date) return null;
                      
                      const matchingFY = fiscalYears.find(fy => fy.endDate === date);
                      if (matchingFY && matchingFY.specialPeriodsCount > 0) {
                          const options = [];
                          // Option 0: Regular Period (null)
                          options.push({ value: '', label: t('fiscal.period.regular', 'Regular Period') });
                          
                          // Options for special periods: 13, 14, ...
                          for (let i = 0; i < matchingFY.specialPeriodsCount; i++) {
                              const pNo = 13 + i;
                              // e.g. "Special Period 13" or lookup name if available
                              options.push({ value: pNo, label: t(`fiscal.period.${pNo}`, `Special Period ${pNo}`) });
                          }

                          return (
                              <div className="animate-in fade-in slide-in-from-top-1 duration-200 mt-2 p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded border border-indigo-100 dark:border-indigo-800">
                                  <label className="block text-[10px] font-bold text-indigo-800 dark:text-indigo-300 uppercase mb-1">
                                      {t('fiscal.postingPeriod', 'Posting Period')}
                                  </label>
                                  <select
                                      value={formData.postingPeriodNo || ''}
                                      onChange={(e) => {
                                          const val = e.target.value ? parseInt(e.target.value) : null;
                                          handleInputChange('postingPeriodNo', val);
                                      }}
                                      disabled={readOnly}
                                      className="w-full text-xs p-1.5 rounded border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-gray-800 text-indigo-900 dark:text-indigo-100 focus:ring-1 focus:ring-indigo-500 outline-none"
                                  >
                                      {options.map(opt => (
                                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                                      ))}
                                  </select>
                              </div>
                          );
                      }
                      
                      // Legacy Fallback: IsAdjustment metadata check (keep for backward compatibility)
                      if (formData[fieldId]?.endsWith('-12-31') && !matchingFY) {
                         return (
                           <label className="flex items-center gap-2 cursor-pointer group mt-1">
                             <input
                               type="checkbox"
                               className="sr-only"
                               checked={!!formData.metadata?.isAdjustment}
                               disabled={readOnly}
                               onChange={(e) => {
                                 const isAdj = e.target.checked;
                                 handleInputChange('metadata', { 
                                   ...(formData.metadata || {}), 
                                   isAdjustment: isAdj 
                                 });
                               }}
                             />
                             <div className={`relative w-8 h-4 rounded-full transition-all ${formData.metadata?.isAdjustment ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'}`}>
                               <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all ${formData.metadata?.isAdjustment ? 'translate-x-4' : 'translate-x-0'}`}></div>
                             </div>
                             <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 group-hover:text-indigo-600 transition-colors">
                               {t('fiscal.isAdjustment', 'Adjustment Period (P13)')}
                             </span>
                           </label>
                         );
                      }
                      return null;
                   })()}
                 </div>
            ) : (typeOverride === 'textarea' || (!typeOverride && (fieldId === 'notes' || fieldId === 'description'))) ? (
                  <textarea 
                    value={formData[fieldId] || ''}
                    disabled={readOnly}
                    onChange={(e) => handleInputChange(fieldId, e.target.value)}
                    onBlur={() => onBlurRef.current?.()}
                    className={`w-full p-1.5 border border-[var(--color-border)] rounded bg-[var(--color-bg-primary)] text-xs text-[var(--color-text-primary)] focus:ring-1 focus:ring-primary-500 outline-none shadow-sm min-h-[60px] transition-colors ${readOnly ? 'bg-[var(--color-bg-secondary)] cursor-not-allowed opacity-80' : ''}`} 
                  />
            ) : (
                <input 
                    type={fieldId === 'exchangeRate' || fieldId === 'amount' ? 'number' : 'text'}
                    value={getFieldValue(fieldId)}
                    disabled={readOnly}
                    onChange={(e) => handleInputChange(fieldId, e.target.value)}
                    onBlur={() => onBlurRef.current?.()}
                    className={`w-full h-[32px] px-2 border border-[var(--color-border)] rounded bg-[var(--color-bg-primary)] text-xs text-[var(--color-text-primary)] focus:ring-1 focus:ring-primary-500 outline-none shadow-sm transition-colors ${readOnly ? 'bg-[var(--color-bg-secondary)] cursor-not-allowed opacity-80' : ''}`}
                />
            )}
        </div>
    );
  };

  // Helper to render a list of fields, grouping adjacent compact actions on the same row
  const renderFieldList = (fields: any[]) => {
    const elements: React.ReactNode[] = [];
    let i = 0;
            
    while (i < fields.length) {
      const field = fields[i];
              
      const isAction = field.fieldId.startsWith('action_');
      const isCompact = isAction && (field.displayMode === 'compact' || field.displayMode === 'badge' || field.isCompact);
              
      if (isCompact) {
        const group = [field];
        let j = i + 1;
        while (j < fields.length) {
          const nextField = fields[j];
          const nextIsAction = nextField.fieldId.startsWith('action_');
          const nextIsCompact = nextIsAction && (nextField.displayMode === 'compact' || nextField.displayMode === 'badge' || nextField.isCompact);
                  
          if (nextIsCompact && nextField.row === field.row) {
            group.push(nextField);
            j++;
          } else {
            break;
          }
        }
                
        if (group.length > 1) {
          const totalColSpan = group.reduce((sum, f) => sum + (f.colSpan || 4), 0);
                  
          elements.push(
            <div 
              key={`group_${field.row}_${field.col}`}
              className={`col-span-${Math.min(12, totalColSpan)}`}
              style={{ 
                gridColumnStart: (group[0].col || 0) + 1,
                gridColumnEnd: `span ${totalColSpan}`,
                gridRowStart: (group[0].row || 0) + 1,
                gridRowEnd: `span ${group[0].rowSpan || 1}`
              }}
            >
              <div className="flex items-center justify-end h-full">
                <div className="flex bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded shadow-sm overflow-hidden h-9 divide-x divide-[var(--color-border)]">
                   {group.map((gf: any) => (
                     <div key={gf.fieldId} className="h-full flex items-center justify-center min-w-[36px]">
                       {renderField(gf.fieldId, gf.labelOverride, gf.typeOverride, gf.isCompact ? 'compact' : gf.displayMode, gf.iconOverride, true)}
                     </div>
                   ))}
                </div>
              </div>
            </div>
          );
          i = j;
          continue;
        }
      }
              
      elements.push(
        <div 
          key={field.fieldId || i}
          className={`col-span-${Math.min(12, field.colSpan || 4)}`}
          style={{ 
            gridColumnStart: (field.col || 0) + 1,
            gridColumnEnd: `span ${field.colSpan || 4}`,
            gridRowStart: (field.row || 0) + 1,
            gridRowEnd: `span ${field.rowSpan || 1}`
          }}
        >
          {renderField(field.fieldId, field.labelOverride, field.typeOverride, field.isCompact ? 'compact' : field.displayMode, field.iconOverride)}
        </div>
      );
      i++;
    }
    return elements;
  };

  // Render header fields - supports both formats
  const renderHeaderFields = () => {
    const configDef = definition as any;
    
    // Format 1: VoucherFormConfig (designer) - uses uiModeOverrides.sections
    // PRIORITY: If custom layout exists, use it!
    if (configDef.uiModeOverrides) {
      const modeConfig = configDef.uiModeOverrides?.[mode] || configDef.uiModeOverrides?.['classic'];
      if (modeConfig) {
        const sections = modeConfig.sections || {};
        const headerSection = sections.HEADER;
      
      if (headerSection && headerSection.fields && headerSection.fields.length > 0) {
        // Sort fields by row and col
        const sortedFields = [...headerSection.fields].sort((a: any, b: any) => {
          if (a.row !== b.row) return a.row - b.row;
          return a.col - b.col;
        });
        
         return (
           <div className="bg-[var(--color-bg-primary)] px-4 py-3 border-b border-[var(--color-border)] mb-4 transition-colors">
            <div className="grid grid-cols-12 gap-x-4 gap-y-2">
              {renderFieldList(sortedFields)}
            </div>
          </div>
        );
      }
    }
  }

    // Format 2: VoucherTypeDefinition (canonical system) - fallback if no UI override
    if (definition.headerFields && definition.headerFields.length > 0) {
      return (
        <div className="bg-[var(--color-bg-primary)] px-4 py-3 border-b border-[var(--color-border)] mb-4 transition-colors">
          <div className="grid grid-cols-12 gap-x-4 gap-y-2">
            {definition.headerFields.map((field: any) => (
              <div key={field.id} className="col-span-6 md:col-span-4">
                {renderField(field.id, field.label)}
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    return null;
  };

  // Render table if multi-line - supports both formats
  const renderLineItems = () => {
    const configDef = definition as any;
    
    // Check VoucherTypeDefinition format
    const hasTableColumns = definition.tableColumns && definition.tableColumns.length > 0;
    // Check VoucherFormConfig format
    const isMultiLine = configDef.isMultiLine || configDef.tableColumns;
    
    if (!hasTableColumns && !isMultiLine) {
      return null;
    }

    return (
       <div className="bg-[var(--color-bg-primary)] px-4 py-3 border-b border-[var(--color-border)] mb-4 transition-colors">
         <h3 className="text-xs font-bold text-[var(--color-text-muted)] mb-3 uppercase tracking-wider">{t('voucherRenderer.lineItems')}</h3>
        {renderField('lineItems')}
      </div>
    );
  };

  // Render any section from uiModeOverrides (BODY, EXTRA, etc.)
  const renderSection = (sectionKey: string, title?: string) => {
    const configDef = definition as any;
    
    const modeConfig = configDef.uiModeOverrides?.[mode] || configDef.uiModeOverrides?.['classic'];
    if (!modeConfig) {
      return null;
    }
    
    const sections = modeConfig.sections || {};
    const section = sections?.[sectionKey];
    
    if (!section || !section.fields || section.fields.length === 0) {
      return null;
    }
    
    // Sort fields by row and col
    const sortedFields = [...section.fields].sort((a: any, b: any) => {
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    });
    
    return (
       <div className="bg-[var(--color-bg-primary)] px-4 py-3 border-b border-[var(--color-border)] mb-4 transition-colors">
         {title && <h3 className="text-xs font-bold text-[var(--color-text-muted)] mb-3 uppercase tracking-wider">{title}</h3>}
        <div className="grid grid-cols-12 gap-x-4 gap-y-2">
          {renderFieldList(sortedFields)}
        </div>
      </div>
    );
  };

  // Check if BODY section has lineItems to avoid rendering twice
  const bodyHasLineItems = () => {
    const configDef = definition as any;
    const modeConfig = configDef.uiModeOverrides?.[mode] || configDef.uiModeOverrides?.['classic'];
    if (!modeConfig) return false;
    const bodySection = modeConfig.sections?.BODY;
    return bodySection?.fields?.some((f: any) => f.fieldId === 'lineItems');
  };

  // Render action buttons from config
  const renderActions = () => {
    const configDef = definition as any;
    // Try to get actions from ACTIONS section in uiModeOverrides (respects layout)
    let actionFields: any[] = [];
    const modeConfig = configDef.uiModeOverrides?.[mode] || configDef.uiModeOverrides?.['classic'];
    if (modeConfig) {
      const actionsSection = modeConfig.sections?.ACTIONS;
      if (actionsSection?.fields && actionsSection.fields.length > 0) {
        // Sort by row and col
        actionFields = [...actionsSection.fields].sort((a: any, b: any) => {
          if (a.row !== b.row) return a.row - b.row;
          return a.col - b.col;
        });
      }
    }
    
    // Fallback to config.actions if no ACTIONS section
    if (actionFields.length === 0) {
      const actions = configDef.actions || [];
      const enabledActions = actions.filter((a: any) => a.enabled !== false);
      
      // If no custom actions defined, render default buttons
      if (!enabledActions.length) {
        return (
           <div className="bg-[var(--color-bg-primary)] border-t border-[var(--color-border)] p-3 grid grid-cols-2 gap-3 transition-colors">
             <button className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold shadow-md shadow-primary-500/10 transition-all bg-primary-600 text-white hover:bg-primary-700 active:scale-[0.98]">
               <Save size={16} />
               {t('voucherRenderer.actions.save')}
             </button>
             <button className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-all bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] active:scale-[0.98]">
               <Printer size={16} />
               {t('voucherRenderer.actions.print')}
             </button>
           </div>
        );
      }
      
      // Create action fields from config.actions
      actionFields = enabledActions.map((action: any, index: number) => ({
        fieldId: `action_${action.type}`,
        labelOverride: action.label,
        row: 0,
        col: index,
        colSpan: 4,
        isCompact: action.isCompact
      }));
    }
    
    // Render actions from ACTIONS section layout using CSS Grid
    const maxRow = actionFields.reduce((max, f) => Math.max(max, f.row || 0), 0) + 1;
    
    return (
       <div 
         className="bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)] p-3 grid grid-cols-12 gap-3 transition-colors"
         style={{ gridTemplateRows: `repeat(${maxRow}, minmax(2.5rem, auto))` }}
       >
          {renderFieldList(actionFields)}
       </div>
    );
  };

   return (
     <div className="flex flex-col h-full bg-[var(--color-bg-secondary)] font-sans text-[var(--color-text-primary)] overflow-y-auto custom-scroll transition-colors">
        {/* Header Fields from Canonical */}
        {renderHeaderFields()}
        
        {/* Body Section (if defined) - may include lineItems */}
        {renderSection('BODY')}
        
        {/* Line Items Table (if multi-line and not already in BODY) */}
        {!bodyHasLineItems() && renderLineItems()}
        
         {/* Extra Section (if defined) */}
        {renderSection('EXTRA', 'Additional Information')}

        {/* Action Buttons - from config or default */}
        {renderActions()}
    </div>
  );
}));

GenericVoucherRenderer.displayName = 'GenericVoucherRenderer';
