/**
 * ApprovalsPage.tsx
 * 
 * High-performance view for managers and custodians to track their pending actions.
 * Consolidates 'Awaiting Financial Approval' and 'Awaiting Custody Confirmation'.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { accountingApi, type PendingApprovalSourceDoc } from '../../../api/accountingApi';
import { salesApi } from '../../../api/salesApi';
import { purchasesApi } from '../../../api/purchasesApi';
import { VoucherTable } from '../components/VoucherTable';
import { useVoucherTypes } from '../../../hooks/useVoucherTypes';
import { useVoucherActions } from '../../../hooks/useVoucherActions';
import { useWindowManager } from '../../../context/WindowManagerContext';
import { Shield, UserCheck, AlertCircle, Loader2, FileText } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { errorHandler } from '../../../services/errorHandler';
import { AccountsProvider } from '../../../context/AccountsContext';
import { Tab } from '@headlessui/react';
import { clsx } from 'clsx';

import { RejectionModal } from '../components/RejectionModal';

const ApprovalsPage: React.FC = () => {
  const { t } = useTranslation('accounting');
  const navigate = useNavigate();
  const { voucherTypes } = useVoucherTypes();
  const { openWindow } = useWindowManager();
  const { handleApproveVoucher, handleRejectVoucher, handleConfirmVoucher } = useVoucherActions();
  const [rejectionTarget, setRejectionTarget] = React.useState<string | null>(null);
  const [busySourceId, setBusySourceId] = React.useState<string | null>(null);

  // 1. Fetch Vouchers Pending Financial Approval (legacy: voucher-based, Stage 2a/manual flows)
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

  // 3. SoD Approval Center feed: source documents (SI/PI) in PENDING_APPROVAL.
  // See docs/architecture/posting-authority.md §4.1.
  const {
    data: pendingSourceDocs = [],
    isLoading: loadingSourceDocs,
    refetch: refetchSourceDocs,
  } = useQuery({
    queryKey: ['accounting', 'pending-approval-source-docs'],
    queryFn: accountingApi.getPendingApprovalSourceDocuments,
  });

  const handleRefresh = async () => {
    await Promise.all([refetchApprovals(), refetchCustody(), refetchSourceDocs()]);
  };

  const handleApproveSourceDoc = async (row: PendingApprovalSourceDoc) => {
    setBusySourceId(row.id);
    try {
      if (row.source === 'SALES_INVOICE') {
        await salesApi.approveSI(row.id);
      } else {
        await purchasesApi.approvePI(row.id);
      }
      await refetchSourceDocs();
    } catch (err) {
      errorHandler.showError(err);
    } finally {
      setBusySourceId(null);
    }
  };

  const openSourceDoc = (row: PendingApprovalSourceDoc) => {
    if (row.source === 'SALES_INVOICE') {
      navigate(`/sales/invoices/${row.id}`);
    } else {
      navigate(`/purchases/invoices/${row.id}`);
    }
  };

  const fmtMoney = (amount: number, currency: string): string => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(2)}`;
    }
  };

  const handleRowClick = async (id: string) => {
    try {
      const fullVoucher = await accountingApi.getVoucher(id);
      const normalize = (value: unknown) => String(value || '').trim().toLowerCase();
      const voucherType = normalize(fullVoucher.type);
      const voucherFormId = normalize(fullVoucher.formId);

      const formDef = voucherTypes.find((t: any) => normalize(t.id) === voucherFormId || normalize(t._typeId) === voucherFormId)
        || voucherTypes.find((t: any) => normalize(t.code) === voucherType || normalize(t.formType) === voucherType || normalize(t.baseType) === voucherType || normalize(t.id) === voucherType)
        || voucherTypes.find((t: any) => {
          const code = normalize(t.code);
          const id = normalize(t.id);
          const name = normalize(t.name);
          const formType = normalize(t.formType || t.baseType);
          return (
            code.includes('journal') ||
            code === 'jv' ||
            id.includes('journal') ||
            name.includes('journal') ||
            formType.includes('journal')
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

  const isLoading = loadingApprovals || loadingCustody || loadingSourceDocs;
  const totalPending = pendingApprovals.length + pendingCustody.length + pendingSourceDocs.length;

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
                {/* SoD: source documents (SI/PI) pending accounting approval — the post-Stage-2b feed. */}
                <Tab
                  className={({ selected }) =>
                    clsx(
                      'w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium leading-5 transition-all',
                      'focus:outline-none focus:ring-2 focus:ring-primary-500/50',
                      selected
                        ? 'bg-[var(--color-bg-primary)] text-amber-700 shadow dark:text-amber-400'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-primary)]/50 hover:text-[var(--color-text-primary)]'
                    )
                  }
                >
                  <FileText size={18} />
                  {t('approvals.awaitingSourceDocs', 'Source Documents')}
                  <span className={clsx(
                    "ml-2 text-xs font-bold px-2 py-0.5 rounded-full",
                    pendingSourceDocs.length > 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]"
                  )}>
                    {pendingSourceDocs.length}
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

                {/* SoD Source Documents Panel — SI/PI in PENDING_APPROVAL */}
                <Tab.Panel
                  className={clsx(
                    'rounded-2xl bg-[var(--color-bg-primary)] shadow-sm border border-[var(--color-border)] overflow-hidden min-h-[400px]',
                    'focus:outline-none'
                  )}
                >
                  {!loadingSourceDocs && pendingSourceDocs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[400px] text-[var(--color-text-muted)]">
                      <FileText size={64} className="opacity-10 mb-4" />
                      <p className="text-lg font-medium">{t('approvals.noneSourceDocs', 'No source documents pending approval')}</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm divide-y divide-[var(--color-border)]">
                        <thead className="bg-[var(--color-bg-secondary)]">
                          <tr>
                            <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)]">{t('approvals.sourceDocs.type', 'Type')}</th>
                            <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)]">{t('approvals.sourceDocs.number', 'Number')}</th>
                            <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)]">{t('approvals.sourceDocs.party', 'Party')}</th>
                            <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)]">{t('approvals.sourceDocs.date', 'Date')}</th>
                            <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)]">{t('approvals.sourceDocs.total', 'Total')}</th>
                            <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)]">{t('approvals.sourceDocs.actions', 'Actions')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)]">
                          {pendingSourceDocs.map((row) => (
                            <tr key={`${row.source}-${row.id}`} className="hover:bg-[var(--color-bg-secondary)]/50">
                              <td className="px-4 py-3">
                                <span className={clsx(
                                  "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                  row.source === 'SALES_INVOICE'
                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                    : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                                )}>
                                  {row.source === 'SALES_INVOICE' ? 'SI' : 'PI'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  className="font-medium text-indigo-600 hover:text-indigo-700 hover:underline dark:text-indigo-400"
                                  onClick={() => openSourceDoc(row)}
                                >
                                  {row.number}
                                </button>
                              </td>
                              <td className="px-4 py-3 text-[var(--color-text-primary)]">{row.partyName}</td>
                              <td className="px-4 py-3 text-[var(--color-text-secondary)]">{row.date}</td>
                              <td className="px-4 py-3 text-right font-mono text-[var(--color-text-primary)]">{fmtMoney(row.totalDoc, row.currency)}</td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                                    onClick={() => handleApproveSourceDoc(row)}
                                    disabled={busySourceId === row.id}
                                  >
                                    {busySourceId === row.id ? t('approvals.sourceDocs.approving', 'Approving...') : t('approvals.sourceDocs.approve', 'Approve')}
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-400 cursor-not-allowed"
                                    title={t('approvals.sourceDocs.rejectPendingTooltip', 'Reject endpoint pending — Task 165')}
                                    disabled
                                  >
                                    {t('approvals.sourceDocs.reject', 'Reject')}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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
