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

const VouchersListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const typeFromUrl = searchParams.get('type')?.trim();
  
  const { 
    vouchers, 
    filters, 
    setFilters, 
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
    if (typeFromUrl) {
      setSelectedType(typeFromUrl);
    } else if (voucherTypes.length > 0 && !selectedType) {
      setSelectedType(voucherTypes[0].id);
    }
  }, [typeFromUrl, voucherTypes.length]);

  const currentVoucherType = voucherTypes.find(vt => vt.id === selectedType);

  const handleCreate = () => {
    if (!selectedType || !currentVoucherType) {
      console.error('❌ Cannot create: missing selectedType or currentVoucherType');
      return;
    }
    
    if (isWindowsMode) {
      // Windows Mode: Open in MDI window
      openWindow(currentVoucherType, { status: 'draft' });
    } else {
      // Classic Mode: Navigate to editor page
      navigate(`/accounting/vouchers/new?type=${selectedType}`);
    }
  };
  
  // Helper to save data first
  const saveVoucherInternal = async (data: any) => {
    // 1. Transform UI Data -> API Payload
    const payload = {
      ...data,
      // Header Mappings
      voucherNo: data.voucherNumber || data.voucherNo,
      description: data.description || data.notes, 
      
      // Line Items Mapping
      lines: (data.lines || []).map((line: any) => ({
        id: line.id && typeof line.id === 'string' ? line.id : undefined, 
        accountId: line.account, 
        description: line.notes, 
        debitFx: Number(line.debit || 0),
        creditFx: Number(line.credit || 0),
        debitBase: Number(line.debit || 0) * (Number(line.parity || 1)),
        creditBase: Number(line.credit || 0) * (Number(line.parity || 1)),
        lineCurrency: line.currency || 'USD',
        exchangeRate: Number(line.parity || 1),
        costCenterId: line.category || null, 
      }))
    };
    
    // Clean up UI-only ID if it's a temp ID
    if (payload.id && payload.id.toString().startsWith('voucher-')) {
       delete payload.id;
    }

    let savedVoucher;
    if (data.id && !data.id.toString().startsWith('voucher-')) {
       // Update existing
       await accountingApi.updateVoucher(data.id, payload);
       savedVoucher = { ...payload, id: data.id }; // Simplified return
    } else {
       // Create new
       const res = await accountingApi.createVoucher(payload);
       savedVoucher = res;
    }
    return savedVoucher;
  };

  const handleSaveVoucher = async (windowId: string, data: any) => {
    console.log('💾 Saving voucher from window:', windowId, data);
    try {
      await saveVoucherInternal(data);
      console.log('✅ Voucher saved successfully!');
      setFilters({...filters}); 
    } catch (error) {
      console.error('❌ Failed to save voucher:', error);
      alert('Failed to save voucher. Please check console for details.');
    }
  };

  const handleSubmitVoucher = async (windowId: string, data: any) => {
    console.log('🚀 Submitting voucher from window:', windowId);
    try {
      // 1. Save any pending changes first
      const saved = await saveVoucherInternal(data);
      
      // 2. Update status to 'pending' (Submitted for Approval)
      // We use updateVoucher instead of sendVoucherToApproval because the latter hits /approve endpoint
      // which requires 'voucher.approve' permission (usually for admins/approvers).
      // Regular users "submit" by changing status to 'pending'.
      if (saved && saved.id) {
         await accountingApi.updateVoucher(saved.id, { status: 'pending' });
         
         console.log('✅ Voucher submitted successfully!');
         alert('Voucher Submitted for Approval!');
         setFilters({...filters}); // Refresh list
         
         // Ideally close window or update its local state to show 'Pending' badge
         // For now, refreshing the list is enough as the user will see it there.
      } else {
         throw new Error('Could not retrieve Voucher ID after save.');
      }
    } catch (error) {
       console.error('❌ Failed to submit voucher:', error);
       alert('Failed to submit voucher. Please check console.');
    }
  };

  const handleRowClick = async (id: string) => {
    if (isWindowsMode) {
      const summary = vouchers.find(v => v.id === id);
      if (!summary) return;

      // Try to find voucher type by voucherTypeId (if saved), otherwise fallback to type enum
      let type = summary.voucherTypeId 
        ? voucherTypes.find(t => t.id === summary.voucherTypeId)
        : voucherTypes.find(t => {
            // Fallback: match by code or type enum
            const typeMap: Record<string, string> = {
              'journal_entry': 'JOURNAL',
              'payment': 'PAYMENT',
              'receipt': 'RECEIPT',
              'opening_balance': 'OPENING_BALANCE'
            };
            const expectedCode = typeMap[summary.type];
            return t.code === expectedCode || t.id === expectedCode;
          });
      
      if (!type) {
        console.warn('Voucher type not found for:', summary);
        alert(`Cannot find form definition for voucher type: ${summary.type}`);
        return;
      }

      try {
        // Fetch full details (includes lines)
        const fullVoucher = await accountingApi.getVoucher(id);
        openWindow(type, fullVoucher);
      } catch (error) {
        console.error('Failed to fetch full voucher details:', error);
        // Fallback to summary if fetch fails
        openWindow(type, summary);
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

        <VoucherFiltersBar filters={filters} onFilterChange={setFilters} />
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
                } catch (e) {
                   console.error("Failed to delete", e);
                   alert("Failed to delete voucher");
                }
              }
            }}
          />
        </div>
      </div>

      {/* Render the Windows Desktop if in Windows Mode */}
      {isWindowsMode && (
        <WindowsDesktop 
          onSaveVoucher={handleSaveVoucher} 
          onSubmitVoucher={handleSubmitVoucher}
        />
      )}
    </div>
  );
};

export default VouchersListPage;
