import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useVouchersWithCache } from '../../../../hooks/useVouchersWithCache';
import { useVoucherTypes } from '../../../../hooks/useVoucherTypes';
import { useVoucherActions } from '../../../../hooks/useVoucherActions';
import { useUserPreferences } from '../../../../hooks/useUserPreferences';
import { useWindowManager } from '../../../../context/WindowManagerContext';
import { useCompanyAccess } from '../../../../context/CompanyAccessContext';
import { VoucherEntryModal } from '../../../../modules/accounting/components/VoucherEntryModal';
import { RateDeviationDialog } from '../../../../modules/accounting/components/shared/RateDeviationDialog';
import { checkVoucherRateDeviations, RateDeviationResult } from '../../../../modules/accounting/utils/rateDeviationCheck';
import { accountingApi } from '../../../../api/accountingApi';
import { errorHandler } from '../../../../services/errorHandler';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { 
  Search, 
  RefreshCw, 
  Eye, 
  Printer, 
  Trash2, 
  AlertTriangle,
  RotateCcw,
  Layers,
  ChevronDown
} from 'lucide-react';

export default function VoucherListSection() {
  const { t } = useTranslation('accounting');
  const [searchParams] = useSearchParams();
  const typeFromUrl = searchParams.get('type')?.trim();
  const isJournalEntry = !typeFromUrl || typeFromUrl.toLowerCase() === 'all';

  const { uiMode } = useUserPreferences();
  const { openWindow } = useWindowManager();
  const { companyId, company } = useCompanyAccess();
  const voucherActions = useVoucherActions();
  const { voucherTypes, loading: typesLoading } = useVoucherTypes();

  // Modals & Action States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<any>(null);
  const [modalType, setModalType] = useState<any>(null);
  const [deleteVoucherId, setDeleteVoucherId] = useState<string | null>(null);
  const [isCreateDropdownOpen, setIsCreateDropdownOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('');

  // Rate Deviation Warning States
  const [rateDeviationResult, setRateDeviationResult] = useState<RateDeviationResult | null>(null);
  const [pendingSaveData, setPendingSaveData] = useState<any>(null);
  const [isCheckingRates, setIsCheckingRates] = useState(false);

  const isWindowsMode = uiMode === 'windows';

  // Core caching and querying hook
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

  // Sync url search parameters with the cache filters
  useEffect(() => {
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

  // Handle global updates
  useEffect(() => {
    const handleRefresh = () => invalidateVouchers();
    window.addEventListener('vouchers-updated', handleRefresh);
    return () => window.removeEventListener('vouchers-updated', handleRefresh);
  }, [invalidateVouchers]);

  // Overview metrics from search matches
  const metrics = useMemo(() => {
    const total = vouchers.length;
    const posted = vouchers.filter(v => !!v.postedAt).length;
    const draft = vouchers.filter(v => v.status === 'draft').length;
    const pending = vouchers.filter(v => v.status === 'pending').length;
    const totalAmountSum = vouchers.reduce((sum, v) => sum + (v.voucherAmount || v.totalDebit || 0), 0);
    return { total, posted, draft, pending, totalAmountSum };
  }, [vouchers]);

  const resolveVoucherForm = useCallback((voucher: any) => {
    if (!voucherTypes) return null;
    return voucherTypes.find(t => t.id === voucher.formId || t.code === voucher.type);
  }, [voucherTypes]);

  const handleCreateVoucher = (type: any) => {
    setIsCreateDropdownOpen(false);
    if (isWindowsMode) {
      openWindow({
        type: 'voucher',
        title: `New ${type.name}`,
        data: { status: 'draft', voucherConfig: type }
      });
    } else {
      setModalType(type);
      setEditingVoucher(null);
      setIsModalOpen(true);
    }
  };

  const handleRowClick = async (id: string) => {
    const summary = vouchers.find(v => v.id === id);
    if (!summary) return;

    const formDefinition = resolveVoucherForm(summary);
    if (!formDefinition) {
      toast.error('Cannot resolve template form for this voucher.');
      return;
    }

    if (isWindowsMode) {
      try {
        const fullVoucher = await accountingApi.getVoucher(id);
        openWindow({
          type: 'voucher',
          title: `Edit ${formDefinition.name} - ${(fullVoucher as any).voucherNumber || fullVoucher.voucherNo || ''}`,
          data: { ...fullVoucher, voucherConfig: formDefinition }
        });
      } catch (error) {
        openWindow({
          type: 'voucher',
          title: `Edit ${formDefinition.name} - ${summary.voucherNo || ''}`,
          data: { ...summary, voucherConfig: formDefinition }
        });
      }
    } else {
      try {
        const fullVoucher = await accountingApi.getVoucher(id);
        setModalType(formDefinition);
        setEditingVoucher(fullVoucher);
        setIsModalOpen(true);
      } catch (error) {
        toast.error('Failed to load voucher details.');
      }
    }
  };

  const handleSaveWeb = async (data: any) => {
    const baseCurrency = company?.baseCurrency || 'SYP';
    const voucherCurrency = data.currency || baseCurrency;
    const headerRate = parseFloat(data.exchangeRate) || 1;
    const voucherDate = data.date || new Date().toISOString().split('T')[0];
    
    if (voucherCurrency !== baseCurrency || data.lines?.some((l: any) => l.currency && l.currency !== voucherCurrency)) {
      setIsCheckingRates(true);
      try {
        const deviationResult = await checkVoucherRateDeviations(
          data.lines || [],
          voucherCurrency,
          headerRate,
          baseCurrency,
          voucherDate
        );

        if (deviationResult.hasDeviations) {
          setPendingSaveData(data);
          setRateDeviationResult(deviationResult);
          setIsCheckingRates(false);
          return;
        }
      } catch (error) {
        console.error('Rate deviation check failed:', error);
      } finally {
        setIsCheckingRates(false);
      }
    }

    await performSave(data);
  };

  const performSave = async (data: any) => {
    try {
      const normalizedPayload = editingVoucher?.id
        ? { ...data, id: data?.id || editingVoucher.id }
        : data;

      const savedVoucher = await voucherActions.save('web-modal', normalizedPayload);
      toast.success(editingVoucher ? 'Voucher updated successfully.' : 'Voucher created successfully.');
      invalidateVouchers();
      setIsModalOpen(false);
      setEditingVoucher(savedVoucher);
    } catch (error: any) {
      toast.error(`Save failed: ${error.message || error}`);
    }
  };

  const handleRateDeviationSync = async () => {
    if (rateDeviationResult && pendingSaveData) {
      const voucherDate = (pendingSaveData as any).date || new Date().toISOString().split('T')[0];
      const baseCurrency = company?.baseCurrency || 'SYP';
      
      try {
        await Promise.all(
          rateDeviationResult.warnings.map(warning => 
            accountingApi.saveExchangeRate(warning.lineCurrency, baseCurrency, warning.effectiveRate, voucherDate)
          )
        );
        toast.success(`Synced ${rateDeviationResult.warnings.length} rate(s) to system.`);
        await performSave(pendingSaveData);
      } catch (error) {
        console.error('Failed to sync rates:', error);
        toast.error('Sync failed; saving voucher anyway.');
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

  const handleDeleteConfirm = async () => {
    if (!deleteVoucherId) return;
    try {
      await accountingApi.deleteVoucher(deleteVoucherId);
      toast.success('Voucher deleted successfully.');
      invalidateVouchers();
      setDeleteVoucherId(null);
    } catch (err: any) {
      toast.error(`Failed to delete: ${err.message || err}`);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Metrics bento-row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E2E8F0] p-4 rounded-lg shadow-xs relative overflow-hidden flex flex-col justify-between h-24">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">سجل القيود / Vouchers Count</span>
            <span className="text-2xl font-mono font-black text-slate-800 mt-1 block">{metrics.total}</span>
          </div>
          <div className="text-[10px] text-slate-500 font-medium">سند مسجل في الدورة الحالية</div>
        </div>

        <div className="bg-white border border-[#E2E8F0] p-4 rounded-lg shadow-xs relative overflow-hidden flex flex-col justify-between h-24">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">مجموع القيم / Total Value</span>
            <span className="text-xl font-mono font-bold text-emerald-600 mt-1 block">
              {metrics.totalAmountSum.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-xs">SYP</span>
            </span>
          </div>
          <div className="text-[10px] text-slate-500 font-medium">القيمة الإجمالية للحركات الحالية</div>
        </div>

        <div className="bg-white border border-[#E2E8F0] p-4 rounded-lg shadow-xs relative overflow-hidden flex flex-col justify-between h-24">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">المسودات / Draft & Pending</span>
            <span className="text-2xl font-mono font-black text-amber-500 mt-1 block">
              {metrics.draft} <span className="text-xs font-sans font-bold text-slate-404">/ {metrics.pending} pending</span>
            </span>
          </div>
          <div className="text-[10px] text-slate-500 font-medium">بانتظار المراجعة أو الترحيل المالي</div>
        </div>

        <div className="bg-white border border-[#E2E8F0] p-4 rounded-lg shadow-xs relative overflow-hidden flex flex-col justify-between h-24">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">المرحل للدفاتر / Posted to GL</span>
            <span className="text-2xl font-mono font-black text-blue-600 mt-1 block">{metrics.posted}</span>
          </div>
          <div className="text-[10px] text-emerald-600 font-bold">✓ حركات مالية نشطة في الحسابات</div>
        </div>
      </div>

      {/* Modern Filter panel */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase">سجل القيود المحاسبية والسندات</h3>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => invalidateVouchers()}
              className="p-2 border border-[#E2E8F0] hover:bg-slate-50 rounded text-slate-500 cursor-pointer"
              title="Refresh ledger"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            {/* Create voucher dropdown menu */}
            <div className="relative">
              <button
                onClick={() => setIsCreateDropdownOpen(!isCreateDropdownOpen)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded flex items-center gap-1 cursor-pointer shadow-xs"
              >
                + إنشاء سند جديد
                <ChevronDown className="w-3 h-3" />
              </button>

              {isCreateDropdownOpen && (
                <div className="absolute right-0 mt-1 w-56 bg-white border border-[#E2E8F0] rounded-lg shadow-lg py-1.5 z-25 text-right font-sans">
                  <span className="block px-3 py-1 text-[10px] text-slate-400 font-mono tracking-wider font-bold">SELECT VOUCHER TYPE</span>
                  {voucherTypes.map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleCreateVoucher(t)}
                      className="w-full text-right px-4 py-2 hover:bg-blue-50 text-xs font-semibold text-slate-700 block transition-all"
                    >
                      {t.name} ({t.code})
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filter Inputs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
          {/* Search bar */}
          <div className="relative col-span-1 md:col-span-2">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="البحث بالرقم أو الوصف..."
              value={clientFilters.search || ''}
              onChange={(e) => setClientFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full pl-8 pr-2.5 py-2 border border-[#E2E8F0] rounded font-medium outline-none focus:border-blue-500 text-right"
            />
          </div>

          {/* Status select */}
          <div>
            <select
              value={clientFilters.status || 'ALL'}
              onChange={(e) => setClientFilters(prev => ({ ...prev, status: e.target.value === 'ALL' ? undefined : e.target.value }))}
              className="w-full px-2.5 py-2 border border-[#E2E8F0] rounded font-semibold outline-none bg-white text-right"
            >
              <option value="ALL">جميع الحالات / All Statuses</option>
              <option value="draft">مسودة / Draft</option>
              <option value="pending">بانتظار الموافقة / Pending</option>
              <option value="approved">موافق عليه / Approved</option>
              <option value="posted">مرحل للدفاتر / Posted</option>
              <option value="cancelled">ملغي / Cancelled</option>
            </select>
          </div>

          {/* Date from */}
          <div className="flex items-center border border-[#E2E8F0] rounded bg-white px-2">
            <input
              type="date"
              value={dateRange.from ? dateRange.from.split('T')[0] : ''}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
              className="w-full bg-transparent outline-none py-1.5 font-mono text-[11px] text-center"
            />
            <span className="text-[10px] text-zinc-400 font-bold ml-1">من</span>
          </div>

          {/* Date to */}
          <div className="flex items-center border border-[#E2E8F0] rounded bg-white px-2">
            <input
              type="date"
              value={dateRange.to ? dateRange.to.split('T')[0] : ''}
              onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
              className="w-full bg-transparent outline-none py-1.5 font-mono text-[11px] text-center"
            />
            <span className="text-[10px] text-zinc-400 font-bold ml-1">إلى</span>
          </div>
        </div>
      </div>

      {/* Spreadsheet-like Table view */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full border-collapse text-right text-xs">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-slate-500 font-bold font-sans">
                <th className="p-3 text-center w-24">الخيارات / Actions</th>
                <th className="p-3 w-32">الحالة / Status</th>
                <th className="p-3 text-left w-36">القيمة المدونة / Amount</th>
                <th className="p-3">البيان / Description</th>
                <th className="p-3 w-36">النوع / Type</th>
                <th className="p-3 w-36">رقم السند / Number</th>
                <th className="p-3 w-28 text-center">التاريخ / Date</th>
              </tr>
            </thead>
            <tbody>
              {vouchersLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 font-semibold">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                      جاري تحميل القيود المحاسبية والسندات...
                    </div>
                  </td>
                </tr>
              ) : vouchers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-zinc-400 font-semibold">
                    لا توجد سندات مطابقة للمحددات الحالية.
                  </td>
                </tr>
              ) : (
                vouchers.map((v) => {
                  const form = resolveVoucherForm(v);
                  const amount = v.voucherAmount || v.totalDebit || 0;
                  return (
                    <tr 
                      key={v.id} 
                      className="border-b border-[#F1F5F9] hover:bg-slate-50/70 transition-colors font-medium text-slate-700"
                    >
                      {/* Actions */}
                      <td className="p-2.5 text-center flex items-center justify-center space-x-1">
                        <button
                          onClick={() => handleRowClick(v.id)}
                          className="p-1 hover:bg-blue-50 text-blue-600 rounded transition-all cursor-pointer"
                          title="View / Edit Voucher"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => window.dispatchEvent(new CustomEvent('print-voucher', { detail: { id: v.id, formType: form } }))}
                          className="p-1 hover:bg-emerald-50 text-emerald-600 rounded transition-all cursor-pointer"
                          title="Print PDF Invoice"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {v.status === 'draft' && (
                          <button
                            onClick={() => setDeleteVoucherId(v.id)}
                            className="p-1 hover:bg-red-50 text-red-600 rounded transition-all cursor-pointer"
                            title="Delete Draft"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          v.postedAt
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : v.status === 'pending'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : v.status === 'cancelled' || v.status === 'rejected'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {v.postedAt ? 'مرحل / Posted' : v.status === 'pending' ? 'انتظار / Pending' : v.status === 'draft' ? 'مسودة / Draft' : v.status}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="p-2.5 text-left font-mono text-[13px] font-bold text-slate-800">
                        {amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] font-sans font-bold text-slate-400">{v.currency}</span>
                      </td>

                      {/* Description */}
                      <td className="p-2.5 text-slate-600 max-w-xs truncate" title={v.description}>
                        {v.description || '-'}
                      </td>

                      {/* Type */}
                      <td className="p-2.5">
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {form?.name || v.type}
                        </span>
                      </td>

                      {/* Number */}
                      <td className="p-2.5 font-mono text-xs font-semibold text-slate-800 flex items-center justify-end gap-1">
                        {v.reversalOfVoucherId && <RotateCcw className="w-3.5 h-3.5 text-amber-500" />}
                        {v.voucherNo || v.id.slice(-8)}
                      </td>

                      {/* Date */}
                      <td className="p-2.5 text-center font-mono text-slate-500">
                        {v.date ? v.date.split('T')[0] : '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {pagination && pagination.totalPages > 1 && (
          <div className="p-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between text-xs font-sans">
            <span className="text-slate-500 font-semibold">
              Showing page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.totalItems} entries)
            </span>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setPage(Math.max(1, pagination.page - 1))}
                disabled={pagination.page === 1}
                className="px-2.5 py-1 rounded border border-[#E2E8F0] hover:bg-slate-100 disabled:opacity-50 font-bold"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="px-2.5 py-1 rounded border border-[#E2E8F0] hover:bg-slate-100 disabled:opacity-50 font-bold"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Web View Modal */}
      {modalType && (
        <VoucherEntryModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          voucherType={modalType}
          uiMode="classic"
          onSave={handleSaveWeb}
          initialData={editingVoucher}
          onApprove={voucherActions.approve}
          onReject={voucherActions.reject}
          onConfirm={voucherActions.confirmCustody}
          onPost={voucherActions.post}
          onCancel={voucherActions.cancel}
          onReverse={voucherActions.reverse}
          onPrint={(id) => window.dispatchEvent(new CustomEvent('print-voucher', { detail: { id } }))}
        />
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

      {/* Delete Confirmation Modal */}
      {deleteVoucherId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-lg shadow-xl w-[400px] p-5 border border-[#E2E8F0] text-right font-sans">
            <div className="flex flex-row-reverse items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="text-rose-600 w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-800">حذف مسودة القيد</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  هل أنت متأكد من حذف مسودة القيد المحاسبي بالكامل؟ لا يمكن التراجع عن هذا الإجراء لاحقاً.
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-start gap-2.5 mt-5">
              <button 
                onClick={() => setDeleteVoucherId(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 border border-slate-200 rounded cursor-pointer"
              >
                إلغاء / Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded shadow-xs cursor-pointer"
              >
                تأكيد الحذف / Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
