/**
 * ApprovalsPage.tsx
 * 
 * High-performance view for managers and custodians to track their pending actions.
 * Consolidates 'Awaiting Financial Approval' and 'Awaiting Custody Confirmation'.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
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
import { Tab } from '@headlessui/react';
import { clsx } from 'clsx';

import { RejectionModal } from '../components/RejectionModal';

const ApprovalsPage: React.FC = () => {
  const { t } = useTranslation('accounting');
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
      const normalize = (value: unknown) => String(value || '').trim().toLowerCase();
      const voucherType = normalize(fullVoucher.type);
      const voucherFormId = normalize(fullVoucher.formId);

      const formDef = voucherTypes.find((t: any) => normalize(t.id) === voucherFormId || normalize(t._typeId) === voucherFormId)
        || voucherTypes.find((t: any) => normalize(t.code) === voucherType || normalize(t.baseType) === voucherType || normalize(t.id) === voucherType)
        || voucherTypes.find((t: any) => {
          const code = normalize(t.code);
          const id = normalize(t.id);
          const name = normalize(t.name);
          const baseType = normalize(t.baseType);
          return (
            code.includes('journal') ||
            code === 'jv' ||
            id.includes('journal') ||
            name.includes('journal') ||
            baseType.includes('journal')
          );
        });
      
      if (formDef) {
        openWindow({
          type: 'voucher',
          title: `Edit ${formDef.name} - ${(fullVoucher as any).voucherNumber || fullVoucher.voucherNo || ''}`,
          data: { ...fullVoucher, voucherConfig: formDef }
        });
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
              <h1 className="text-3xl font-extrabold text-[var(--color-text-primary)] tracking-tight">{t('approvals.title')}</h1>
              <p className="text-[var(--color-text-muted)] mt-1 flex items-center gap-2">
                {t('approvals.subtitle')}
                {totalPending > 0 && (
                  <Badge variant="warning" className="animate-pulse">
                    {t('approvals.actionsRequired', { count: totalPending })}
                  </Badge>
                )}
              </p>
            </div>
            <button 
              onClick={handleRefresh}
              className="p-2 hover:bg-[var(--color-bg-tertiary)] rounded-full transition-colors"
              title={t('approvals.refresh')}
            >
               {isLoading ? <Loader2 size={20} className="animate-spin text-primary-500" /> : <AlertCircle size={20} className="text-[var(--color-text-muted)]" />}
            </button>
          </div>

            {/* Tabs for Financial Approvals and Custody Confirmations */}
            <Tab.Group>
              <Tab.List className="flex space-x-1 rounded-xl bg-[var(--color-bg-tertiary)] p-1 mb-6 max-w-2xl">
                <Tab
                  className={({ selected }) =>
                    clsx(
                      'w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium leading-5 transition-all',
                      'focus:outline-none focus:ring-2 focus:ring-primary-500/50',
                      selected
                        ? 'bg-[var(--color-bg-primary)] text-indigo-700 shadow dark:text-indigo-400'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-primary)]/50 hover:text-[var(--color-text-primary)]'
                    )
                  }
                >
                  <Shield size={18} />
                  {t('approvals.awaitingApproval')}
                  <span className={clsx(
                    "ml-2 text-xs font-bold px-2 py-0.5 rounded-full",
                    pendingApprovals.length > 0 ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" : "bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]"
                  )}>
                    {pendingApprovals.length}
                  </span>
                </Tab>
                <Tab
                  className={({ selected }) =>
                    clsx(
                      'w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium leading-5 transition-all',
                      'focus:outline-none focus:ring-2 focus:ring-primary-500/50',
                      selected
                        ? 'bg-[var(--color-bg-primary)] text-purple-700 shadow dark:text-purple-400'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-primary)]/50 hover:text-[var(--color-text-primary)]'
                    )
                  }
                >
                  <UserCheck size={18} />
                  {t('approvals.awaitingCustody')}
                  <span className={clsx(
                    "ml-2 text-xs font-bold px-2 py-0.5 rounded-full",
                    pendingCustody.length > 0 ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" : "bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]"
                  )}>
                    {pendingCustody.length}
                  </span>
                </Tab>
              </Tab.List>

              <Tab.Panels className="mt-2">
                {/* Financial Approvals Panel */}
                <Tab.Panel
                  className={clsx(
                    'rounded-2xl bg-[var(--color-bg-primary)] shadow-sm border border-[var(--color-border)] overflow-hidden min-h-[400px]',
                    'focus:outline-none'
                  )}
                >
                  {!loadingApprovals && pendingApprovals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[400px] text-[var(--color-text-muted)]">
                      <Shield size={64} className="opacity-10 mb-4" />
                      <p className="text-lg font-medium">{t('approvals.noneApproval')}</p>
                    </div>
                  ) : (
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
                  )}
                </Tab.Panel>

                {/* Custody Confirmations Panel */}
                <Tab.Panel
                  className={clsx(
                    'rounded-2xl bg-[var(--color-bg-primary)] shadow-sm border border-[var(--color-border)] overflow-hidden min-h-[400px]',
                    'focus:outline-none'
                  )}
                >
                  {!loadingCustody && pendingCustody.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[400px] text-[var(--color-text-muted)]">
                      <UserCheck size={64} className="opacity-10 mb-4" />
                      <p className="text-lg font-medium">{t('approvals.noneCustody')}</p>
                    </div>
                  ) : (
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
                  )}
                </Tab.Panel>
              </Tab.Panels>
            </Tab.Group>
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
