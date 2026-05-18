/**
 * VouchersListPage.tsx
 */
import React, { useMemo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useVouchersWithCache, VoucherFilters } from '../../../hooks/useVouchersWithCache';
import { VoucherFiltersBar } from '../components/VoucherFiltersBar';
import { Button } from '../../../components/ui/Button';
import { AlertTriangle, RefreshCw, Eye, Edit, Trash2, Printer, CheckCircle, XCircle, RotateCcw, RefreshCw as RefreshIcon, Ban, Lock, FilePlus } from 'lucide-react';
import { RequirePermission } from '../../../components/auth/RequirePermission';
import { useVoucherTypes } from '../../../hooks/useVoucherTypes';
import { useWindowManager } from '../../../context/WindowManagerContext';
import { WindowsDesktop } from '../components/WindowsDesktop';
import { useUserPreferences } from '../../../hooks/useUserPreferences';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { accountingApi } from '../../../api/accountingApi';
import { AccountsProvider } from '../../../context/AccountsContext';
import { errorHandler } from '../../../services/errorHandler';
import { VoucherEntryModal } from '../components/VoucherEntryModal';
import { VoucherPrintView } from '../components/VoucherPrintView';
import { RateDeviationDialog } from '../components/shared/RateDeviationDialog';
import { checkVoucherRateDeviations, RateDeviationResult } from '../utils/rateDeviationCheck';
import { useVoucherActions } from '../../../hooks/useVoucherActions';
import {
  DataTable,
  ColumnDefinition,
  RowAction,
  BulkAction,
  ActiveFilters,
  BadgeVariant,
} from '../../../components/ui/DataTable';

// ── Types ────────────────────────────────────────────────────────────

interface VoucherListItem {
  id: string;
  voucherNo?: string;
  date?: string;
  type?: string;
  name?: string;
  description?: string;
  debitAccount?: string;
  creditAccount?: string;
  creationMode?: string;
  approvedAt?: string;
  status?: string;
  currency?: string;
  amount?: number;
  totalAmount?: number;
  ref?: string;
  reference?: string;
  reversalOfVoucherId?: string;
  postedAt?: string;
  locked?: boolean;
  metadata?: Record<string, any>;
  formId?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

const getStatusVariant = (status: string): BadgeVariant => {
  switch (status?.toLowerCase()) {
    case 'approved': case 'posted': return 'success';
    case 'pending': return 'warning';
    case 'draft': return 'default';
    case 'cancelled': case 'rejected': return 'error';
    case 'locked': return 'info';
    default: return 'default';
  }
};

const getStatusIcon = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'posted': return CheckCircle;
    case 'pending': return RefreshIcon;
    case 'approved': return CheckCircle;
    case 'cancelled': return Ban;
    case 'draft': return FilePlus;
    default: return undefined;
  }
};

const VouchersListPage: React.FC = () => {
  const { t } = useTranslation('accounting');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const typeFromUrl = searchParams.get('type')?.trim();

  const { companyId, company } = useCompanyAccess();

  const {
    vouchers,
    isLoading: vouchersLoading,
    error,
    dateRange,
    setDateRange,
    filters: clientFilters,
    setFilters: setClientFilters,
    pagination,
    setPage,
    invalidateVouchers,
  } = useVouchersWithCache(companyId);

  const { voucherTypes, loading: typesLoading } = useVoucherTypes();
  const { openWindow } = useWindowManager();
  const { uiMode } = useUserPreferences();
  const voucherActions = useVoucherActions();

  const isJournalEntry = !typeFromUrl || typeFromUrl.toLowerCase() === 'all';
  const isWindowsMode = uiMode === 'windows';
  const [selectedType, setSelectedType] = React.useState<string>('');

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingVoucher, setEditingVoucher] = React.useState<any>(null);
  const [modalType, setModalType] = React.useState<any>(null);
  const [deleteVoucherId, setDeleteVoucherId] = React.useState<string | null>(null);
  const [rateDeviationResult, setRateDeviationResult] = React.useState<RateDeviationResult | null>(null);
  const [pendingSaveData, setPendingSaveData] = React.useState<any>(null);
  const [isCheckingRates, setIsCheckingRates] = React.useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // ── Sync URL type with filters ─────────────────────────────────────

  React.useEffect(() => {
    if (typesLoading && voucherTypes.length === 0) return;

    if (isJournalEntry) {
      if (clientFilters.formId || clientFilters.type) {
        setClientFilters({});
      }
      if (!selectedType && voucherTypes.length > 0) {
        setSelectedType(voucherTypes[0].id);
      }
    } else {
      const found = voucherTypes.find(vt =>
        vt.id === typeFromUrl ||
        (vt as any)._typeId === typeFromUrl ||
        vt.code?.toLowerCase() === typeFromUrl?.toLowerCase()
      );

      if (!found && typesLoading) return;

      const targetId = found?.id || typeFromUrl || '';

      if (selectedType !== targetId) {
        setSelectedType(targetId);
      }

      if (clientFilters.formId !== targetId) {
        setClientFilters({ formId: targetId });
      }
    }
  }, [typeFromUrl, isJournalEntry, voucherTypes, typesLoading]);

  const handleClearFilters = () => {
    const baseline: Partial<VoucherFilters> = {};
    if (!isJournalEntry && selectedType) {
      baseline.formId = selectedType;
    }
    setClientFilters(baseline);
    const now = new Date();
    const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    setDateRange({ from: '2000-01-01', to });
  };

  const currentVoucherType = voucherTypes.find(vt => vt.id === selectedType);
  const pageTitle = !isJournalEntry && currentVoucherType
    ? t('voucherList.titleType', { name: currentVoucherType.name })
    : t('voucherList.titleAll');

  const isLoading = vouchersLoading || typesLoading;

  // ── Resolve voucher form ───────────────────────────────────────────

  const resolveVoucherForm = React.useCallback((voucherLike: any) => {
    const normalize = (value: unknown) => String(value || '').trim().toLowerCase();
    const getVoucherFormId = (v: any): string | undefined => v?.formId || v?.metadata?.formId;
    const matchByFormId = (formId?: string | null) =>
      voucherTypes.find(t => formId && (t.id === formId || (t as any)._typeId === formId));
    const getJournalFallbackForm = () =>
      voucherTypes.find(t => {
        const baseType = String((t as any)?.formType || (t as any)?.baseType || '').toLowerCase();
        const code = String(t?.code || '').toLowerCase();
        const id = String(t?.id || '').toLowerCase();
        const name = String(t?.name || '').toLowerCase();
        return baseType.includes('journal') || code.includes('journal') || code === 'jv' || id.includes('journal') || id.includes('jv') || name.includes('journal');
      });

    let formDefinition = matchByFormId(getVoucherFormId(voucherLike));

    if (!formDefinition && voucherLike?.reversalOfVoucherId) {
      const parentVoucher = vouchers.find(v => v.id === voucherLike.reversalOfVoucherId);
      formDefinition = matchByFormId(getVoucherFormId(parentVoucher));
    }

    if (!formDefinition) {
      const rawType = normalize(voucherLike?.type);
      const originType = normalize(voucherLike?.metadata?.originType);
      const candidateTypes = [rawType, originType].filter(Boolean);
      formDefinition = voucherTypes.find((type) => {
        const code = normalize(type.code);
        const id = normalize(type.id);
        const formType = normalize((type as any)?.formType);
        const baseType = normalize((type as any)?.baseType);
        const voucherType = normalize((type as any)?.voucherType);
        return candidateTypes.some((candidate) =>
          candidate === code || candidate === id || candidate === formType || candidate === baseType || candidate === voucherType
        );
      });
    }

    if (!formDefinition) {
      const typeKeywords: Record<string, string[]> = {
        journal_entry: ['journal', 'journal_entry', 'jv'], jv: ['journal', 'journal_entry', 'jv'],
        payment: ['payment', 'pv'], payment_voucher: ['payment', 'pv'],
        receipt: ['receipt', 'rv'], receipt_voucher: ['receipt', 'rv'],
        opening_balance: ['opening', 'balance'], fx_revaluation: ['fx_revaluation', 'revaluation', 'journal'],
        reversal: ['reversal', 'reverse', 'journal'],
        purchase_invoice: ['purchase_invoice', 'purchase', 'invoice', 'pinv', 'ap_invoice', 'journal'],
        purchase_return: ['purchase_return', 'purchase', 'return', 'pr', 'journal'],
        sales_invoice: ['sales_invoice', 'sales', 'invoice', 'sinv', 'ar_invoice', 'journal'],
        sales_return: ['sales_return', 'sales', 'return', 'sr', 'journal'],
      };
      const candidateTypes = [normalize(voucherLike?.type), normalize(voucherLike?.metadata?.originType)].filter(Boolean);
      const keywords = Array.from(new Set(candidateTypes.flatMap((type) => typeKeywords[type] || [])));
      formDefinition = voucherTypes.find((type) => {
        const id = normalize(type.id);
        const code = normalize(type.code);
        const name = normalize(type.name);
        return keywords.some((keyword) => id.includes(keyword) || code.includes(keyword) || name.includes(keyword));
      });
    }

    return formDefinition || getJournalFallbackForm();
  }, [voucherTypes, vouchers]);

  // ── Action handlers ────────────────────────────────────────────────

  const handleCreate = () => {
    if (!selectedType || !currentVoucherType) return;
    if (isWindowsMode) {
      openWindow({ type: 'voucher', title: `New ${currentVoucherType.name}`, data: { status: 'draft', voucherConfig: currentVoucherType } });
    } else {
      setModalType(currentVoucherType);
      setEditingVoucher(null);
      setIsModalOpen(true);
    }
  };

  React.useEffect(() => {
    const handleRefresh = () => invalidateVouchers();
    window.addEventListener('vouchers-updated', handleRefresh);
    return () => window.removeEventListener('vouchers-updated', handleRefresh);
  }, [invalidateVouchers]);

  const handleRowClick = async (row: VoucherListItem) => {
    const summary = vouchers.find(v => v.id === row.id);
    if (!summary) return;
    const formDefinition = resolveVoucherForm(summary);
    if (!formDefinition) {
      errorHandler.showError({ code: 'VOUCH_NOT_FOUND', message: `Cannot find form for voucher type: ${summary.type}`, severity: 'ERROR' } as any);
      return;
    }
    if (isWindowsMode) {
      try {
        const fullVoucher = await accountingApi.getVoucher(row.id);
        openWindow({ type: 'voucher', title: `Edit ${formDefinition.name} - ${(fullVoucher as any).voucherNumber || fullVoucher.voucherNo || ''}`, data: { ...fullVoucher, voucherConfig: formDefinition } });
      } catch {
        openWindow({ type: 'voucher', title: `Edit ${formDefinition.name} - ${summary.voucherNo || ''}`, data: { ...summary, voucherConfig: formDefinition } });
      }
    } else {
      try {
        const fullVoucher = await accountingApi.getVoucher(row.id);
        setModalType(formDefinition);
        setEditingVoucher(fullVoucher);
        setIsModalOpen(true);
      } catch {
        errorHandler.showError({ code: 'FETCH_ERROR', message: 'Failed to load voucher details', severity: 'ERROR' } as any);
      }
    }
  };

  const handleViewPrint = (id: string) => {
    const summary = vouchers.find(v => v.id === id);
    if (!summary) return;
    const formDefinition = resolveVoucherForm(summary);
    window.dispatchEvent(new CustomEvent('print-voucher', { detail: { id, formType: formDefinition } }));
  };

  const handleSaveWeb = async (data: any) => {
    const baseCurrency = company?.baseCurrency || 'SYP';
    const voucherCurrency = data.currency || baseCurrency;
    const headerRate = parseFloat(data.exchangeRate) || 1;
    const voucherDate = data.date || new Date().toISOString().split('T')[0];

    if (voucherCurrency !== baseCurrency || data.lines?.some((l: any) => l.currency && l.currency !== voucherCurrency)) {
      setIsCheckingRates(true);
      try {
        const deviationResult = await checkVoucherRateDeviations(data.lines || [], voucherCurrency, headerRate, baseCurrency, voucherDate);
        if (deviationResult.hasDeviations) {
          setPendingSaveData(data);
          setRateDeviationResult(deviationResult);
          setIsCheckingRates(false);
          return;
        }
      } catch { /* continue */ } finally { setIsCheckingRates(false); }
    }
    await performSave(data);
  };

  const performSave = async (data: any) => {
    try {
      const normalizedPayload = editingVoucher?.id ? { ...data, id: data?.id || editingVoucher.id } : data;
      const savedVoucher = await voucherActions.save('web-modal', normalizedPayload);
      errorHandler.showSuccess(editingVoucher ? 'Voucher updated successfully' : 'Voucher created successfully');
      invalidateVouchers();
      setIsModalOpen(false);
      setEditingVoucher(savedVoucher);
      return savedVoucher;
    } catch (error: any) {
      console.error('Save failed:', error);
      throw error;
    }
  };

  const handleRateDeviationSync = async () => {
    if (rateDeviationResult && pendingSaveData) {
      const voucherDate = (pendingSaveData as any).date || new Date().toISOString().split('T')[0];
      const baseCurrency = company?.baseCurrency || 'SYP';
      try {
        await Promise.all(rateDeviationResult.warnings.map(warning =>
          accountingApi.saveExchangeRate(warning.lineCurrency, baseCurrency, warning.effectiveRate, voucherDate)
        ));
        errorHandler.showSuccess(`Synced ${rateDeviationResult.warnings.length} rate(s) to system for ${voucherDate}`);
        await performSave(pendingSaveData);
      } catch {
        errorHandler.showError('Successfully saved voucher with your rates, but some system rate updates failed.');
        await performSave(pendingSaveData);
      } finally {
        setPendingSaveData(null);
        setRateDeviationResult(null);
      }
    }
  };

  const handleRateDeviationConfirm = async () => {
    if (pendingSaveData) { await performSave(pendingSaveData); setPendingSaveData(null); setRateDeviationResult(null); }
  };

  const handleRateDeviationCancel = () => { setPendingSaveData(null); setRateDeviationResult(null); };

  const handleApprove = voucherActions.approve;
  const handleReject = (id: string) => voucherActions.reject(id);
  const handleConfirm = voucherActions.confirmCustody;
  const handlePost = voucherActions.post;
  const handleCancel = voucherActions.cancel;
  const handleReverse = voucherActions.reverse;
  const handleDelete = voucherActions.remove;

  // ── Build reversal groups ──────────────────────────────────────────

  const { childrenByParent, parentIds } = useMemo(() => {
    const childrenByParent: Record<string, VoucherListItem[]> = {};
    const parentIds = new Set<string>();
    (vouchers || []).forEach(v => {
      if ((v as any).reversalOfVoucherId) {
        const parentId = (v as any).reversalOfVoucherId;
        if (!childrenByParent[parentId]) childrenByParent[parentId] = [];
        childrenByParent[parentId].push(v);
        parentIds.add(parentId);
      }
    });
    return { childrenByParent, parentIds };
  }, [vouchers]);

  // Filter out reversal children from the main list (they appear as expanded rows)
  const parentVouchers = useMemo(() =>
    (vouchers || []).filter(v => !parentIds.has(v.id)),
    [vouchers, parentIds]
  );

  // ── DataTable columns ──────────────────────────────────────────────

  const columns: ColumnDefinition<VoucherListItem>[] = useMemo(() => [
    {
      key: 'number', label: t('voucherTable.columns.number') || 'Voucher #', width: '15%', priority: 1,
      accessor: (row) => row.voucherNo || row.ref || '-',
      sortable: true,
      render: (val: string) => <span className="font-mono text-primary-600 dark:text-primary-400">{val}</span>,
    },
    {
      key: 'date', label: t('voucherTable.columns.date') || 'Date', width: '14%', priority: 1,
      accessor: 'date', sortable: true,
    },
    {
      key: 'status', label: t('voucherTable.columns.status') || 'Status', width: '12%', priority: 1,
      accessor: 'status',
      badge: {
        variantMap: { posted: 'success', approved: 'success', pending: 'warning', draft: 'default', cancelled: 'error', locked: 'info' },
        iconMap: { posted: CheckCircle, approved: CheckCircle, pending: RefreshIcon, cancelled: Ban, draft: FilePlus },
      },
    },
    {
      key: 'type', label: t('voucherTable.columns.type') || 'Type', width: '14%', priority: 2,
      accessor: 'type',
      render: (val: string) => {
        const colors: Record<string, string> = {
          journal_entry: 'text-blue-600', payment: 'text-red-600', receipt: 'text-green-600',
          sales_invoice: 'text-purple-600', purchase_invoice: 'text-orange-600', reversal: 'text-gray-500',
        };
        return <span className={colors[val?.toLowerCase()] || 'text-[var(--color-text-primary)]'}>{val}</span>;
      },
    },
    {
      key: 'name', label: t('voucherTable.columns.name') || 'Description', width: '25%', priority: 2,
      accessor: (row) => row.name || row.description || '-',
      truncate: true,
    },
    {
      key: 'amount', label: t('voucherTable.columns.amount') || 'Amount', width: '12%', priority: 2,
      accessor: (row) => row.amount ?? row.totalAmount ?? 0,
      align: 'right', sortable: true,
      render: (val: number, row: VoucherListItem) => (
        <span className="font-mono font-medium">
          {val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          <span className="text-[var(--color-text-muted)] ml-1 text-[0.85em]">{row.currency || ''}</span>
        </span>
      ),
    },
    {
      key: 'debitAccount', label: t('voucherTable.columns.debitAccount') || 'Debit Account', width: '14%', priority: 3,
      accessor: 'debitAccount', truncate: true,
    },
    {
      key: 'creditAccount', label: t('voucherTable.columns.creditAccount') || 'Credit Account', width: '14%', priority: 3,
      accessor: 'creditAccount', truncate: true,
    },
    {
      key: 'creationMode', label: t('voucherTable.columns.creationMode') || 'Mode', width: '10%', priority: 3,
      accessor: 'creationMode',
      render: (val: string) => {
        if (!val || val === '-') return <span className="text-[var(--color-text-muted)]">-</span>;
        const variant = val === 'STRICT' ? 'info' : val === 'FLEXIBLE' ? 'default' : 'warning';
        return (
          <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${
            variant === 'info' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
            variant === 'warning' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
            'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
          }`}>{val}</span>
        );
      },
    },
    { key: 'approvedAt', label: t('voucherTable.columns.approvedAt') || 'Approved', width: '12%', priority: 3, accessor: 'approvedAt' },
    { key: 'ref', label: t('voucherTable.columns.ref') || 'Reference', width: '12%', priority: 3, accessor: (row) => row.ref || row.reference || '-', truncate: true },
  ], [t]);

  // ── Row actions ────────────────────────────────────────────────────

  const rowActions: RowAction<VoucherListItem>[] = useMemo(() => [
    { key: 'view', label: 'View', icon: Eye, onClick: (row) => handleRowClick(row), primary: true, tooltip: 'View voucher' },
    { key: 'print', label: 'Print', icon: Printer, onClick: (row) => handleViewPrint(row.id), primary: true, tooltip: 'Print voucher' },
    { key: 'edit', label: 'Edit', icon: Edit, onClick: (row) => handleRowClick(row), isEnabled: (row) => row.status?.toLowerCase() === 'draft' },
    { key: 'approve', label: 'Approve', icon: CheckCircle, onClick: (row) => handleApprove(row.id), variant: 'success', isEnabled: (row) => row.status?.toLowerCase() === 'pending' },
    { key: 'post', label: 'Post', icon: RefreshIcon, onClick: (row) => handlePost(row.id), variant: 'primary', isEnabled: (row) => row.status?.toLowerCase() === 'approved' },
    { key: 'cancel', label: 'Cancel', icon: XCircle, onClick: (row) => handleCancel(row.id), variant: 'danger', isEnabled: (row) => !['cancelled', 'posted'].includes(row.status?.toLowerCase() || '') },
    { key: 'reverse', label: 'Reverse', icon: RotateCcw, onClick: (row) => handleReverse(row.id), variant: 'warning', isEnabled: (row) => row.status?.toLowerCase() === 'posted' && !row.locked },
    { key: 'delete', label: 'Delete', icon: Trash2, onClick: (row) => setDeleteVoucherId(row.id), variant: 'danger', isEnabled: (row) => row.status?.toLowerCase() === 'draft' },
  ], [handleApprove, handleCancel, handlePost, handleReverse]);

  // ── Expanded row renderer ──────────────────────────────────────────

  const renderExpanded = useCallback((row: VoucherListItem) => {
    const children = childrenByParent[row.id];
    if (!children || children.length === 0) {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div><span className="text-[var(--color-text-muted)]">Debit: </span><span className="text-[var(--color-text-primary)]">{row.debitAccount || '-'}</span></div>
          <div><span className="text-[var(--color-text-muted)]">Credit: </span><span className="text-[var(--color-text-primary)]">{row.creditAccount || '-'}</span></div>
          <div><span className="text-[var(--color-text-muted)]">Reference: </span><span className="text-[var(--color-text-primary)] font-mono">{row.ref || row.reference || '-'}</span></div>
          <div><span className="text-[var(--color-text-muted)]">Mode: </span><span className="text-[var(--color-text-primary)]">{row.creationMode || '-'}</span></div>
          <div><span className="text-[var(--color-text-muted)]">Approved: </span><span className="text-[var(--color-text-primary)]">{row.approvedAt || '-'}</span></div>
          {row.locked && (
            <div className="flex items-center gap-1 text-amber-600">
              <Lock className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Audit Locked</span>
            </div>
          )}
        </div>
      );
    }

    return (
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
          Reversals ({children.length})
        </div>
        <div className="space-y-1">
          {children.map(child => (
            <div key={child.id} className="flex items-center gap-3 text-sm px-3 py-1.5 rounded bg-[var(--color-bg-primary)]/50">
              <span className="font-mono text-primary-600 dark:text-primary-400">{child.voucherNo || '-'}</span>
              <span className={child.status?.toLowerCase() === 'posted' ? 'text-green-600' : child.status?.toLowerCase() === 'cancelled' ? 'text-red-600' : 'text-[var(--color-text-muted)]'}>
                {child.status}
              </span>
              <span className="text-[var(--color-text-muted)]">{child.date || '-'}</span>
              <span className="font-mono ml-auto">{(child.amount ?? child.totalAmount ?? 0).toLocaleString()} {child.currency || ''}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }, [childrenByParent]);

  const hasReversals = parentIds.size > 0;

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <AccountsProvider>
      <div className="flex flex-col h-full bg-[var(--color-bg-secondary)] relative transition-colors duration-300">
        <div className="flex-none p-4 pb-0">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{pageTitle}</h1>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => invalidateVouchers()}
                className="gap-2"
                title={t('voucherList.refresh')}
              >
                <RefreshCw size={16} />
                {t('voucherList.refresh')}
              </Button>
              <RequirePermission permission="accounting.vouchers.create">
                <div className="flex items-center gap-2">
                  {isJournalEntry && (
                    <select
                      value={selectedType}
                      onChange={(e) => setSelectedType(e.target.value)}
                      className="p-2 border border-[var(--color-border)] rounded text-sm bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                    >
                      {voucherTypes.map(type => (
                        <option key={type.id} value={type.id}>{type.name}</option>
                      ))}
                    </select>
                  )}
                  <Button onClick={handleCreate} disabled={!selectedType}>
                    + {t('voucherList.new', { name: currentVoucherType?.name || t('voucherList.voucher') })}
                  </Button>
                </div>
              </RequirePermission>
            </div>
          </div>

          <VoucherFiltersBar
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            filters={clientFilters}
            onChange={(partial) => setClientFilters(prev => ({ ...prev, ...partial }))}
            onClear={handleClearFilters}
            hideTypeFilter={false}
            voucherTypes={voucherTypes}
          />
        </div>

        <div className="flex-1 flex flex-col p-2 overflow-hidden">
          <div className="flex flex-col bg-[var(--color-bg-primary)] rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden transition-colors duration-300 flex-1">
            <DataTable
              columns={columns}
              data={parentVouchers}
              loading={isLoading}
              error={error ? error.message : null}
              emptyMessage={t('voucherList.empty') || 'No vouchers found'}
              pagination={pagination ? {
                page: pagination.page,
                pageSize: pagination.pageSize,
                totalItems: pagination.totalItems,
                totalPages: pagination.totalPages,
                onPageChange: (p) => setPage(p),
              } : undefined}
              expandable={hasReversals}
              renderExpanded={renderExpanded}
              expandedIds={expandedIds}
              onExpandedChange={setExpandedIds}
              resizable
              onRowClick={handleRowClick}
              stickyHeader
              idKey="id"
              rowActions={rowActions}
            />
          </div>
        </div>

        {/* Web View Modal */}
        {modalType && (
          <VoucherEntryModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            voucherType={modalType}
            uiMode={uiMode}
            onSave={handleSaveWeb}
            initialData={editingVoucher}
            onApprove={handleApprove}
            onReject={handleReject}
            onConfirm={handleConfirm}
            onPost={handlePost}
            onCancel={handleCancel}
            onReverse={handleReverse}
            onPrint={handleViewPrint}
          />
        )}

        {/* Delete Confirmation Modal */}
        {deleteVoucherId && (
          <div className="fixed inset-0 z-[50] flex items-center justify-center bg-black/50 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-[480px] p-6 border border-gray-100 scale-100 animate-in zoom-in-95 duration-200">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <AlertTriangle className="text-red-600" size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{t('voucherList.deleteTitle')}</h3>
                    <p className="text-sm text-gray-500">{t('voucherList.deleteBody')}</p>
                  </div>
                </div>
                <div className="p-4 bg-red-50 border border-red-100 rounded-lg text-sm text-red-800">
                  <strong>{t('voucherList.warningLabel')}</strong> {t('voucherList.deleteWarning')}
                </div>
                <div className="flex items-center justify-end gap-3 mt-2">
                  <button
                    onClick={() => setDeleteVoucherId(null)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await accountingApi.deleteVoucher(deleteVoucherId);
                        invalidateVouchers();
                        setDeleteVoucherId(null);
                        errorHandler.showSuccess(t('voucherList.deleted'));
                      } catch (e: any) {
                        console.error('Delete failed:', e);
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                  >
                    {t('voucherList.confirmDelete')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rate Deviation Warning Dialog */}
        {rateDeviationResult && (
          <RateDeviationDialog
            isOpen={!!rateDeviationResult}
            result={rateDeviationResult}
            baseCurrency={company?.baseCurrency || 'SYP'}
            voucherDate={(pendingSaveData as any)?.date || new Date().toISOString().split('T')[0]}
            onConfirm={handleRateDeviationConfirm}
            onConfirmWithSync={handleRateDeviationSync}
            onCancel={handleRateDeviationCancel}
          />
        )}
      </div>
    </AccountsProvider>
  );
};

export default VouchersListPage;
