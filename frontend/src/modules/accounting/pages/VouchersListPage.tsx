/**
 * VouchersListPage.tsx
 */
import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useVouchersWithCache } from '../../../hooks/useVouchersWithCache';
import { VoucherFiltersBar } from '../components/VoucherFiltersBar';
import { VoucherTable } from '../components/VoucherTable';
import { Button } from '../../../components/ui/Button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
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


const VouchersListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const typeFromUrl = searchParams.get('type')?.trim();
  
  
  const { companyId, company } = useCompanyAccess();
  
  // Use new caching hook
  const {
    vouchers,
    isLoading: vouchersLoading,
    error,
    dateRange,
    setDateRange,
    filters: clientFilters,
    setFilters: setClientFilters,
    invalidateVouchers,
  } = useVouchersWithCache(companyId);

  const { voucherTypes, loading: typesLoading } = useVoucherTypes();
  const { openWindow } = useWindowManager();
  const { uiMode } = useUserPreferences();
  
  // Determine view mode
  const isJournalEntry = !typeFromUrl || typeFromUrl.toLowerCase() === 'all';
  const isWindowsMode = uiMode === 'windows';
  const [selectedType, setSelectedType] = React.useState<string>('');
  
  // Web View Modal State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingVoucher, setEditingVoucher] = React.useState<any>(null);
  const [modalType, setModalType] = React.useState<any>(null);
  
  // Print View State
  const [isPrintViewOpen, setIsPrintViewOpen] = React.useState(false);
  const [viewingVoucher, setViewingVoucher] = React.useState<any>(null);
  const [viewingFormType, setViewingFormType] = React.useState<any>(null);

  // Delete Modal State
  const [deleteVoucherId, setDeleteVoucherId] = React.useState<string | null>(null);

  // Rate Deviation Warning State
  const [rateDeviationResult, setRateDeviationResult] = React.useState<RateDeviationResult | null>(null);
  const [pendingSaveData, setPendingSaveData] = React.useState<any>(null);
  const [isCheckingRates, setIsCheckingRates] = React.useState(false);

  // Update logic to sync URL/Type with client-side filters
  React.useEffect(() => {
    // Wait for voucher types to be loaded before trying to resolve IDs from URL
    if (typesLoading && voucherTypes.length === 0) return;

    if (isJournalEntry) {
      // Journal Entry view: show everything (clear filters)
      if (clientFilters.formId || clientFilters.type) {
        setClientFilters({});
      }
      // If no type selected for creation, default to first available
      if (!selectedType && voucherTypes.length > 0) {
        setSelectedType(voucherTypes[0].id);
      }
    } else {
      // Specific voucher type view
      const found = voucherTypes.find(vt => 
        vt.id === typeFromUrl || 
        (vt as any)._typeId === typeFromUrl ||
        vt.code?.toLowerCase() === typeFromUrl?.toLowerCase()
      );
      
      // CRITICAL: We only apply the filter if we actually found the form definition
      // or if types are fully loaded and we still can't find it (to handle deleted types)
      if (!found && typesLoading) return;

      const targetId = found?.id || typeFromUrl || '';
      const backendType = found ? (found as any).baseType || found.code || found.id : typeFromUrl;
      
      if (selectedType !== targetId) {
        setSelectedType(targetId);
      }
      
      // Set client-side filters
      // Use the actual found ID (UUID) for formId filter
      if (clientFilters.formId !== targetId) {
        setClientFilters({ formId: targetId, type: backendType || undefined });
      }
    }
  }, [typeFromUrl, isJournalEntry, voucherTypes, typesLoading]);

  // Dynamic Title
  const currentVoucherType = voucherTypes.find(vt => vt.id === selectedType);
  const pageTitle = !isJournalEntry && currentVoucherType 
    ? `${currentVoucherType.name}s` 
    : 'All Vouchers';
  
  const isLoading = vouchersLoading || typesLoading;

  const handleCreate = () => {
    if (!selectedType || !currentVoucherType) {
      console.error('❌ Cannot create: missing selectedType or currentVoucherType', { selectedType, voucherTypes });
      return;
    }
    
    if (isWindowsMode) {
      // Windows Mode: Open in MDI window
      openWindow(currentVoucherType, { status: 'draft' });
    } else {
      // Classic/Web Mode: Open Modal
      setModalType(currentVoucherType);
      setEditingVoucher(null); // Clear for new
      setIsModalOpen(true);
    }
  };
  
  // Handle refresh from global events (e.g. when a voucher is saved in another page)
  React.useEffect(() => {
    const handleRefresh = () => invalidateVouchers();
    window.addEventListener('vouchers-updated', handleRefresh);
    return () => window.removeEventListener('vouchers-updated', handleRefresh);
  }, [invalidateVouchers]);

  const handleRowClick = async (id: string) => {
    // Shared Logic: Find the correct Form Definition
    const summary = vouchers.find(v => v.id === id);
    if (!summary) return;
    
    // Try to find form by formId (if saved), otherwise fallback to matching by base type
    let formDefinition = summary.formId 
      ? voucherTypes.find(t => t.id === summary.formId)
      : voucherTypes.find(t => {
          const typeKeywords: Record<string, string[]> = {
            'journal_entry': ['journal', 'journal_entry'],
            'payment': ['payment'],
            'receipt': ['receipt'],
            'opening_balance': ['opening', 'balance']
          };
          
          const keywords = typeKeywords[summary.type] || [];
          const formIdLower = (t.id || '').toLowerCase();
          const formNameLower = (t.name || '').toLowerCase();
          const formCodeLower = (t.code || '').toLowerCase();
          
          return keywords.some(kw => 
            formIdLower.includes(kw) || 
            formNameLower.includes(kw) ||
            formCodeLower.includes(kw)
          );
        });

    if (!formDefinition) {
      errorHandler.showError({
        code: 'VOUCH_NOT_FOUND',
        message: `Cannot find form for voucher type: ${summary.type}`,
        severity: 'ERROR'
      } as any);
      return;
    }

    // Windows Mode
    if (isWindowsMode) {
      try {
        const fullVoucher = await accountingApi.getVoucher(id);
        openWindow(formDefinition, fullVoucher);
      } catch (error) {
        console.error('Failed to fetch full voucher details:', error);
        openWindow(formDefinition, summary);
      }
    } else {
      // Classic/Web View Mode: Open Modal
      try {
        const fullVoucher = await accountingApi.getVoucher(id);
        setModalType(formDefinition);
        setEditingVoucher(fullVoucher);
        setIsModalOpen(true);
      } catch (error) {
        console.error('Failed to fetch full voucher details:', error);
        errorHandler.showError({
          code: 'FETCH_ERROR',
          message: 'Failed to load voucher details',
          severity: 'ERROR'
        } as any);
      }
    }
  };

  const handleViewPrint = async (id: string) => {
    const summary = vouchers.find(v => v.id === id);
    if (!summary) return;
    
    // Find form definition (same logic as handleRowClick)
    const formDefinition = summary.formId 
      ? voucherTypes.find(t => t.id === summary.formId)
      : voucherTypes.find(t => {
          const typeKeywords: Record<string, string[]> = {
            'journal_entry': ['journal', 'journal_entry'],
            'payment': ['payment'],
            'receipt': ['receipt'],
            'opening_balance': ['opening', 'balance']
          };
          const keywords = typeKeywords[summary.type] || [];
          const formIdLower = (t.id || '').toLowerCase();
          const formNameLower = (t.name || '').toLowerCase();
          const formCodeLower = (t.code || '').toLowerCase();
          return keywords.some(kw => formIdLower.includes(kw) || formNameLower.includes(kw) || formCodeLower.includes(kw));
        });

    try {
      const fullVoucher = await accountingApi.getVoucher(id);
      setViewingVoucher(fullVoucher);
      setViewingFormType(formDefinition);
      setIsPrintViewOpen(true);
    } catch (error) {
      console.error('Failed to fetch voucher for viewing:', error);
      errorHandler.showError({
        code: 'FETCH_ERROR',
        message: 'Failed to load voucher for viewing',
        severity: 'ERROR'
      } as any);
    }
  };

  const handleSaveWeb = async (data: any) => {
    // First check for rate deviations
    const baseCurrency = company?.baseCurrency || 'SYP';
    const voucherCurrency = data.currency || baseCurrency;
    const headerRate = parseFloat(data.exchangeRate) || 1;
    const voucherDate = data.date || new Date().toISOString().split('T')[0];
    
    // Only check for multi-currency vouchers
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
          // Store the data and show the dialog
          setPendingSaveData(data);
          setRateDeviationResult(deviationResult);
          setIsCheckingRates(false);
          return; // Don't save yet, wait for user confirmation
        }
      } catch (error) {
        console.error('Rate deviation check failed:', error);
        // Continue with save even if check fails
      } finally {
        setIsCheckingRates(false);
      }
    }

    // Proceed with normal save
    await performSave(data);
  };

  const performSave = async (data: any) => {
    try {
      if (editingVoucher) {
        // Edit Mode
        await accountingApi.updateVoucher(editingVoucher.id, data);
        errorHandler.showSuccess('Voucher updated successfully');
      } else {
        // Create Mode
        await accountingApi.createVoucher(data);
        errorHandler.showSuccess('Voucher created successfully');
      }
      invalidateVouchers();
      setIsModalOpen(false);
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

  return (
    <AccountsProvider>
      <div className="flex flex-col h-full bg-[var(--color-bg-secondary)] relative transition-colors duration-300">
        <div className="flex-none p-6 pb-0">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{pageTitle}</h1>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                onClick={() => invalidateVouchers()} 
                className="gap-2"
                title="Refresh List"
              >
                <RefreshCw size={16} />
                Refresh
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
                    + New {currentVoucherType?.name || 'Voucher'}
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
            hideTypeFilter={!isJournalEntry} 
            voucherTypes={voucherTypes}
          />
        </div>

        <div className="flex-1 p-6 min-w-0 overflow-hidden">
          <div className="grid grid-cols-1 bg-[var(--color-bg-primary)] rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden transition-colors duration-300">
            <div className="min-w-0 overflow-x-auto">
              <VoucherTable 
                vouchers={vouchers} 
                voucherTypes={voucherTypes}
                isLoading={vouchersLoading || typesLoading}
                error={error ? error.message : null}
                onViewPrint={handleViewPrint}
                onRowClick={handleRowClick}
                onEdit={(voucher) => handleRowClick(voucher.id)}
                onDelete={(id) => setDeleteVoucherId(id)}
                onCancel={async (id) => {
                  try {
                    await accountingApi.cancelVoucher(id);
                    invalidateVouchers();
                    errorHandler.showSuccess('Voucher cancelled successfully');
                  } catch (e: any) {
                    console.error('Cancel failed:', e);
                  }
                }}
                onApprove={async (id) => {
                  try {
                     await accountingApi.approveVoucher(id);
                     invalidateVouchers();
                     errorHandler.showSuccess('Voucher approved successfully');
                  } catch (e: any) {
                     console.error('Approval failed:', e);
                  }
                }}
                onReject={async (id) => {
                  try {
                     await accountingApi.rejectVoucher(id);
                     invalidateVouchers();
                     errorHandler.showSuccess('Voucher rejected');
                  } catch (e: any) {
                     console.error('Rejection failed:', e);
                  }
                }}
                onConfirm={async (id) => {
                  try {
                     await accountingApi.confirmVoucherCustody(id);
                     invalidateVouchers();
                     errorHandler.showSuccess('Custody confirmed');
                  } catch (e: any) {
                     console.error('Confirmation failed:', e);
                  }
                }}
                onRefresh={() => invalidateVouchers()}
                externalFilters={clientFilters}
                dateRange={dateRange}
              />
            </div>
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
          />
        )}

        {/* Official View / Print View */}
        {isPrintViewOpen && viewingVoucher && (
          <VoucherPrintView 
            voucher={viewingVoucher}
            voucherType={viewingFormType}
            onClose={() => setIsPrintViewOpen(false)}
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
                      <h3 className="text-lg font-bold text-gray-900">Confirm Deletion</h3>
                      <p className="text-sm text-gray-500">Are you sure you want to delete this voucher?</p>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-red-50 border border-red-100 rounded-lg text-sm text-red-800">
                    <strong>Warning:</strong> After confirming deletion, you cannot undo this action ever, and the entry will be lost forever.
                  </div>
                  
                  <div className="flex items-center justify-end gap-3 mt-2">
                    <button 
                      onClick={() => setDeleteVoucherId(null)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                         try {
                            await accountingApi.deleteVoucher(deleteVoucherId);
                            invalidateVouchers();
                            setDeleteVoucherId(null);
                            errorHandler.showSuccess('Voucher deleted permanently');
                         } catch (e: any) {
                            console.error('Delete failed:', e);
                         }
                      }}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                    >
                      Confirm Deletion
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
