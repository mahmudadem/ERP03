/**
 * PendingApprovalsWidget.tsx
 * 
 * A compact dashboard widget showing the count of pending approval/custody actions.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { accountingApi } from '../../../api/accountingApi';
import { Shield, UserCheck, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

export const PendingApprovalsWidget: React.FC = () => {
  const navigate = useNavigate();

  // 1. Fetch Vouchers Pending Financial Approval
  const { 
    data: pendingApprovals = [], 
    isLoading: loadingApprovals 
  } = useQuery({
    queryKey: ['vouchers', 'pending-approvals'],
    queryFn: accountingApi.getPendingApprovals
  });

  // 2. Fetch Vouchers Pending Custody Confirmation (User Specific)
  const { 
    data: pendingCustody = [], 
    isLoading: loadingCustody
  } = useQuery({
    queryKey: ['vouchers', 'pending-custody'],
    queryFn: accountingApi.getPendingCustody
  });

  const isLoading = loadingApprovals || loadingCustody;
  const total = pendingApprovals.length + pendingCustody.length;

  if (total === 0 && !isLoading) return null; // Don't show if no actions needed

  return (
    <div 
      onClick={() => navigate('/accounting/approvals')}
      className={clsx(
        "group cursor-pointer relative overflow-hidden flex flex-col gap-4 p-5 rounded-2xl border transition-all duration-300",
        total > 0 
          ? "bg-white border-amber-200 shadow-sm hover:shadow-md hover:border-amber-400" 
          : "bg-[var(--color-bg-primary)] border-[var(--color-border)]"
      )}
    >
      {/* Background Glow for high priority */}
      {total > 0 && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-100/50 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
      )}

      <div className="flex justify-between items-start">
        <div className="flex flex-col">
          <h3 className="text-sm font-bold text-gray-900 group-hover:text-primary-600 transition-colors">Action Required</h3>
          <p className="text-xs text-gray-500">You have {total} pending workflow tasks</p>
        </div>
        <div className={clsx(
            "p-2 rounded-xl transition-colors",
            total > 0 ? "bg-amber-100 text-amber-600" : "bg-gray-100 text-gray-400"
          )}>
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {pendingApprovals.length > 0 && (
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
            <Shield size={14} className="text-indigo-500" />
            <span>{pendingApprovals.length} Awaiting Approval</span>
          </div>
        )}
        {pendingCustody.length > 0 && (
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
            <UserCheck size={14} className="text-purple-500" />
            <span>{pendingCustody.length} Awaiting My Custody</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-1 pt-3 border-t border-gray-100">
        <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Open Approval Center</span>
        <ChevronRight size={14} className="text-amber-400 group-hover:translate-x-1 transition-transform" />
      </div>
    </div>
  );
};
