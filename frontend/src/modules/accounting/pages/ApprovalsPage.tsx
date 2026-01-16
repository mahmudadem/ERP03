/**
 * ApprovalsPage.tsx
 * 
 * High-performance view for managers and custodians to track their pending actions.
 * Consolidates 'Awaiting Financial Approval' and 'Awaiting Custody Confirmation'.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { accountingApi } from '../../../api/accountingApi';
import { VoucherTable } from '../components/VoucherTable';
import { useVoucherTypes } from '../../../hooks/useVoucherTypes';
import { useVoucherActions } from '../../../hooks/useVoucherActions';
import { useWindowManager } from '../../../context/WindowManagerContext';
import { Shield, UserCheck, AlertCircle, Loader2 } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { errorHandler } from '../../../services/errorHandler';
import { AccountsProvider } from '../../../context/AccountsContext';

import { RejectionModal } from '../components/RejectionModal';

const ApprovalsPage: React.FC = () => {
  const { voucherTypes } = useVoucherTypes();
  const { openWindow } = useWindowManager();
  const { handleApproveVoucher, handleRejectVoucher, handleConfirmVoucher } = useVoucherActions();
  const [rejectionTarget, setRejectionTarget] = React.useState<string | null>(null);

  // 1. Fetch Vouchers Pending Financial Approval
  const { 
    data: pendingApprovals = [], 
    isLoading: loadingApprovals,
    refetch: refetchApprovals 
  } = useQuery({
    queryKey: ['vouchers', 'pending-approvals'],
    queryFn: accountingApi.getPendingApprovals
  });

  // 2. Fetch Vouchers Pending Custody Confirmation (User Specific)
  const { 
    data: pendingCustody = [], 
    isLoading: loadingCustody,
    refetch: refetchCustody
  } = useQuery({
    queryKey: ['vouchers', 'pending-custody'],
    queryFn: accountingApi.getPendingCustody
  });

  const handleRefresh = async () => {
    await Promise.all([refetchApprovals(), refetchCustody()]);
  };

  const handleRowClick = async (id: string) => {
    try {
      const fullVoucher = await accountingApi.getVoucher(id);
      const formDef = voucherTypes.find(t => t.id === fullVoucher.formId) || 
                      voucherTypes.find(t => t.code === fullVoucher.type);
      
      if (formDef) {
        openWindow(formDef, fullVoucher);
      } else {
        errorHandler.showError({ message: 'Voucher form definition not found.' } as any);
      }
    } catch (err) {
      errorHandler.showError(err);
    }
  };

  const confirmRejection = async (reason: string) => {
    if (rejectionTarget) {
      await handleRejectVoucher('approvals-page', rejectionTarget, reason);
      setRejectionTarget(null);
      handleRefresh();
    }
  };

  const isLoading = loadingApprovals || loadingCustody;
  const totalPending = pendingApprovals.length + pendingCustody.length;

  return (
    <AccountsProvider>
      <div className="flex flex-col h-full bg-[var(--color-bg-secondary)] overflow-y-auto">
        <div className="flex-none p-8 pb-4">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h1 className="text-3xl font-extrabold text-[var(--color-text-primary)] tracking-tight">Approval Center</h1>
              <p className="text-[var(--color-text-muted)] mt-1 flex items-center gap-2">
                Manage your pending financial verifications and custody gate satisfactions.
                {totalPending > 0 && (
                  <Badge variant="warning" className="animate-pulse">
                    {totalPending} ACTIONS REQUIRED
                  </Badge>
                )}
              </p>
            </div>
            <button 
              onClick={handleRefresh}
              className="p-2 hover:bg-[var(--color-bg-tertiary)] rounded-full transition-colors"
              title="Refresh lists"
            >
               {isLoading ? <Loader2 size={20} className="animate-spin text-primary-500" /> : <AlertCircle size={20} className="text-[var(--color-text-muted)]" />}
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            
            {/* Section 1: Financial Approvals */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 px-1">
                 <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                    <Shield size={18} />
                 </div>
                 <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Awaiting My Approval</h2>
                 <span className="ml-auto text-xs font-bold text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] px-2 py-0.5 rounded-full">
                   {pendingApprovals.length}
                 </span>
              </div>
              
              <div className="bg-[var(--color-bg-primary)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden min-h-[300px]">
                <VoucherTable 
                  vouchers={pendingApprovals}
                  voucherTypes={voucherTypes}
                  isLoading={loadingApprovals}
                  onRowClick={handleRowClick}
                  onApprove={async (id) => {
                    await handleApproveVoucher('approvals-page', id);
                    handleRefresh();
                  }}
                  onReject={(id) => setRejectionTarget(id)}
                />
                {pendingApprovals.length === 0 && !loadingApprovals && (
                   <div className="flex flex-col items-center justify-center h-full py-12 text-[var(--color-text-muted)]">
                      <Shield size={48} className="opacity-10 mb-2" />
                      <p className="text-sm font-medium">All caught up! No vouchers pending your approval.</p>
                   </div>
                )}
              </div>
            </div>

            {/* Section 2: Custody Confirmations */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 px-1">
                 <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600">
                    <UserCheck size={18} />
                 </div>
                 <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Awaiting Custody Confirmation</h2>
                 <span className="ml-auto text-xs font-bold text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] px-2 py-0.5 rounded-full">
                   {pendingCustody.length}
                 </span>
              </div>

              <div className="bg-[var(--color-bg-primary)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden min-h-[300px]">
                <VoucherTable 
                  vouchers={pendingCustody}
                  voucherTypes={voucherTypes}
                  isLoading={loadingCustody}
                  onRowClick={handleRowClick}
                  onConfirm={async (id) => {
                    await handleConfirmVoucher('approvals-page', id);
                    handleRefresh();
                  }}
                  onReject={(id) => setRejectionTarget(id)}
                />
                {pendingCustody.length === 0 && !loadingCustody && (
                   <div className="flex flex-col items-center justify-center h-full py-12 text-[var(--color-text-muted)]">
                      <UserCheck size={48} className="opacity-10 mb-2" />
                      <p className="text-sm font-medium">No assets awaiting your physical confirmation.</p>
                   </div>
                )}
              </div>
            </div>

          </div>
        </div>

        <RejectionModal 
          isOpen={!!rejectionTarget}
          onClose={() => setRejectionTarget(null)}
          onConfirm={confirmRejection}
        />
      </div>
    </AccountsProvider>
  );
};

export default ApprovalsPage;
