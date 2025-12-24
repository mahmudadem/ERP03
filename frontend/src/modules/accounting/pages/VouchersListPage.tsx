/**
 * VouchersListPage.tsx
 */
import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useVouchersList } from '../../../hooks/useVouchersList';
import { VoucherFiltersBar } from '../components/VoucherFiltersBar';
import { VoucherTable } from '../components/VoucherTable';
import { Button } from '../../../components/ui/Button';
import { RequirePermission } from '../../../components/auth/RequirePermission';
import { useVoucherTypes } from '../../../hooks/useVoucherTypes';
import { useWindowManager } from '../../../context/WindowManagerContext';
import { WindowsDesktop } from '../components/WindowsDesktop';
import { useUserPreferences } from '../../../hooks/useUserPreferences';
import { accountingApi } from '../../../api/accountingApi';
import { AccountsProvider } from '../../../context/AccountsContext';
import { errorHandler } from '../../../services/errorHandler';

const VouchersListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const typeFromUrl = searchParams.get('type')?.trim();
  
  const { 
    vouchers, 
    filters, 
    setFilters,
    refresh, 
    pagination, 
    isLoading, 
    error 
  } = useVouchersList();

  const { voucherTypes, loading: typesLoading } = useVoucherTypes();
  const { openWindow } = useWindowManager();
   const { uiMode } = useUserPreferences();
  const [selectedType, setSelectedType] = React.useState<string>(typeFromUrl || '');
  
  // Check if Windows Mode is enabled
  const isWindowsMode = uiMode === 'windows';

  // Update selected type when URL changes or voucher types load
  React.useEffect(() => {
    console.log('📋 VoucherTypes loaded:', voucherTypes.map(t => ({ id: t.id, name: t.name, code: t.code })));
    console.log('🔍 selectedType:', selectedType, 'typeFromUrl:', typeFromUrl);
    
    if (typeFromUrl) {
      // Try to find by exact ID or by typeId (for new voucherForms)
      const found = voucherTypes.find(vt => 
        vt.id === typeFromUrl || 
        (vt as any)._typeId === typeFromUrl ||
        vt.code?.toLowerCase() === typeFromUrl.toLowerCase()
      );
      if (found) {
        setSelectedType(found.id);
      } else {
        setSelectedType(typeFromUrl);
      }
    } else if (voucherTypes.length > 0 && !selectedType) {
      setSelectedType(voucherTypes[0].id);
    }
  }, [typeFromUrl, voucherTypes.length]);

  const currentVoucherType = voucherTypes.find(vt => vt.id === selectedType);

  const handleCreate = () => {
    console.log('🆕 handleCreate - selectedType:', selectedType, 'currentVoucherType:', currentVoucherType);
    if (!selectedType || !currentVoucherType) {
      console.error('❌ Cannot create: missing selectedType or currentVoucherType', { selectedType, voucherTypes });
      return;
    }
    
    if (isWindowsMode) {
      // Windows Mode: Open in MDI window
      openWindow(currentVoucherType, { status: 'draft' });
    } else {
      // Classic Mode: Navigate to editor page
      // Use baseType for backend compatibility, pass formId separately
      const baseType = (currentVoucherType as any).baseType || currentVoucherType.code || selectedType;
      navigate(`/accounting/vouchers/new?type=${baseType}&formId=${selectedType}`);
    }
  };
  
  // Handle refresh from global events (e.g. when a voucher is saved in another page)
  React.useEffect(() => {
    const handleRefresh = () => refresh();
    window.addEventListener('vouchers-updated', handleRefresh);
    return () => window.removeEventListener('vouchers-updated', handleRefresh);
  }, [refresh]);


  const handleRowClick = async (id: string) => {
    if (isWindowsMode) {
      const summary = vouchers.find(v => v.id === id);
      if (!summary) return;

      console.log('🔍 Editing voucher:', summary);
      console.log('📋 Available forms:', voucherTypes.map(t => ({ id: t.id, code: t.code, name: t.name })));

      // Try to find form by formId (if saved), otherwise fallback to matching by base type
      let formDefinition = summary.formId 
        ? voucherTypes.find(t => t.id === summary.formId)
        : voucherTypes.find(t => {
            // Fallback: find first form that matches the voucher type
            // Check if form's id or name contains the type
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
            
            console.log(`🔎 Checking form:`, { 
              id: t.id, 
              name: t.name, 
              code: t.code,
              matches: keywords.some(kw => 
                formIdLower.includes(kw) || 
                formNameLower.includes(kw) ||
                formCodeLower.includes(kw)
              )
            });
            
            return keywords.some(kw => 
              formIdLower.includes(kw) || 
              formNameLower.includes(kw) ||
              formCodeLower.includes(kw)
            );
          });
      
      console.log('✅ Found form:', formDefinition);
      
      if (!formDefinition) {
        errorHandler.showError({
          code: 'VOUCH_NOT_FOUND',
          message: `Cannot find form for voucher type: ${summary.type}`,
          severity: 'ERROR'
        } as any);
        return;
      }

      try {
        // Fetch full details (includes lines)
        const fullVoucher = await accountingApi.getVoucher(id);
        openWindow(formDefinition, fullVoucher);
      } catch (error) {
        console.error('Failed to fetch full voucher details:', error);
        // Fallback to summary if fetch fails
        openWindow(formDefinition, summary);
      }
    } else {
      navigate(`/accounting/vouchers/${id}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <div className="flex-none p-6 pb-0">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Accounting Vouchers</h1>
          <div className="flex items-center gap-3">
            <RequirePermission permission="accounting:voucher:create">
              <div className="flex items-center gap-2">
                <select 
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="p-2 border border-slate-200 rounded text-sm bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                >
                  {voucherTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
                <Button onClick={handleCreate} disabled={!selectedType}>
                  + New {currentVoucherType?.name || 'Voucher'}
                </Button>
              </div>
            </RequirePermission>
          </div>
        </div>

        <VoucherFiltersBar filters={filters} onChange={setFilters} />
      </div>

      <div className="flex-1 p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <VoucherTable 
            vouchers={vouchers} 
            isLoading={isLoading || typesLoading}
            error={error}
            pagination={pagination}
            onPageChange={(page) => setFilters({ ...filters, page })}
            onRowClick={handleRowClick}
            onEdit={(voucher) => {
              if (isWindowsMode) {
                handleRowClick(voucher.id);
              } else {
                navigate(`/accounting/vouchers/${voucher.id}/edit`);
              }
            }}
            onDelete={async (id) => {
              if (window.confirm('Are you sure you want to delete this voucher?')) {
                try {
                   await accountingApi.deleteVoucher(id);
                   setFilters({...filters}); 
                } catch (e: any) {
                   errorHandler.showError(e);
                 }
              }
            }}
          />
        </div>
      </div>

    </div>
  );
};

export default VouchersListPage;
