import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { accountingApi } from '../../../../api/accountingApi';
import { CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

export default function ApprovalCenterSection() {
  const { t } = useTranslation();
  const { data: responseData, isLoading, refetch } = useQuery({
    queryKey: ['vouchers-pending-approvals-apex'],
    queryFn: () => accountingApi.listVouchers({ status: 'pending', page: 1, pageSize: 50 })
  });

  const pendingVouchers = responseData?.items || [];

  const handleApprove = async (id: string) => {
    toast.success('Approval center integration coming in Phase 3.');
  };

  const handleReject = async (id: string) => {
    toast.success('Rejection controls coming in Phase 3.');
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Bento Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E2E8F0] p-4 rounded-lg shadow-xs flex flex-col justify-between h-24">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">{t('apex.approval.pendingApprovals', { defaultValue: 'Pending approvals' })}</span>
            <span className="text-2xl font-mono font-black text-amber-500 mt-1 block">{pendingVouchers.length}</span>
          </div>
          <div className="text-[10px] text-slate-500 font-medium">{t('apex.approval.pendingDesc', { defaultValue: 'Vouchers requiring review and financial approval.' })}</div>
        </div>

        <div className="bg-white border border-[#E2E8F0] p-4 rounded-lg shadow-xs flex flex-col justify-between h-24">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">{t('apex.approval.approvalRate', { defaultValue: 'Approval Rate' })}</span>
            <span className="text-2xl font-mono font-black text-blue-600 mt-1 block">94.2%</span>
          </div>
          <div className="text-[10px] text-slate-500 font-medium">{t('apex.approval.rateDesc', { defaultValue: 'Voucher approval rate this month.' })}</div>
        </div>

        <div className="bg-white border border-[#E2E8F0] p-4 rounded-lg shadow-xs flex flex-col justify-between h-24">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">{t('apex.approval.processingTime', { defaultValue: 'Processing Time' })}</span>
            <span className="text-2xl font-mono font-black text-emerald-600 mt-1 block">1.8 hrs</span>
          </div>
          <div className="text-[10px] text-emerald-600 font-bold">{t('apex.approval.processingDesc', { defaultValue: '✓ 12% improvement from last month.' })}</div>
        </div>
      </div>

      {/* Main Table Panel */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-bold text-slate-800 uppercase">{t('apex.approval.listTitle', { defaultValue: 'Vouchers Pending Financial Approval' })}</h3>
          </div>
          <button
            onClick={() => refetch()}
            className="p-2 border border-[#E2E8F0] hover:bg-slate-50 rounded text-slate-500 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-slate-500 font-bold">
                <th className="p-3 text-center w-36">{t('apex.vouchers.actions', { defaultValue: 'Actions' })}</th>
                <th className="p-3 text-left w-32">{t('apex.vouchers.amount', { defaultValue: 'Amount' })}</th>
                <th className="p-3">{t('apex.vouchers.description', { defaultValue: 'Description' })}</th>
                <th className="p-3 w-36">{t('apex.vouchers.number', { defaultValue: 'Voucher #' })}</th>
                <th className="p-3 w-28 text-center">{t('apex.vouchers.date', { defaultValue: 'Date' })}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-450 font-semibold">
                    {t('apex.approval.loading', { defaultValue: 'Loading approval requests...' })}
                  </td>
                </tr>
              ) : pendingVouchers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-400 font-medium">
                    {t('apex.approval.empty', { defaultValue: 'No vouchers are currently pending approval.' })}
                  </td>
                </tr>
              ) : (
                pendingVouchers.map((v: any) => (
                  <tr key={v.id} className="border-b border-[#F1F5F9] hover:bg-slate-50/50">
                    <td className="p-2.5 text-center flex items-center justify-center space-x-2">
                      <button
                        onClick={() => handleReject(v.id)}
                        className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded text-[10px] font-bold transition cursor-pointer"
                      >
                        {t('apex.approval.reject', { defaultValue: 'Reject' })}
                      </button>
                      <button
                        onClick={() => handleApprove(v.id)}
                        className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded text-[10px] font-bold transition cursor-pointer"
                      >
                        {t('apex.approval.approve', { defaultValue: 'Approve' })}
                      </button>
                    </td>
                    <td className="p-2.5 text-left font-mono text-[13px] font-bold text-slate-800">
                      {(v.voucherAmount || v.totalDebit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-[10px] font-sans font-bold text-slate-405">{v.currency || 'SYP'}</span>
                    </td>
                    <td className="p-2.5 text-slate-655 max-w-xs truncate">{v.description || '-'}</td>
                    <td className="p-2.5 font-mono text-xs font-semibold text-slate-800">{v.voucherNo || v.id.slice(-8)}</td>
                    <td className="p-2.5 text-center font-mono text-slate-500">{v.date ? v.date.split('T')[0] : '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
