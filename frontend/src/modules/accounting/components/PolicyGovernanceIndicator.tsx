import React from 'react';
import { Lock, Zap, HelpCircle } from 'lucide-react';

interface PolicyGovernanceIndicatorProps {
  isSystemStrict: boolean;
  isVoucherStrict: boolean;
  settingsLoading: boolean;
  isNewVoucher?: boolean;
}

export const PolicyGovernanceIndicator: React.FC<PolicyGovernanceIndicatorProps> = ({
  isSystemStrict,
  isVoucherStrict,
  settingsLoading,
  isNewVoucher = false,
}) => {
  return (
    <div className="flex items-center gap-2 px-1.5 py-0.5 bg-black/5 dark:bg-white/5 rounded-md border border-[var(--color-border)] group relative z-50 cursor-help ml-1 transition-all hover:bg-black/[0.08] dark:hover:bg-white/[0.08] scale-95 origin-left">
      {/* System Dot Indicator */}
      <div className="flex items-center gap-1.5">
        <div 
          className={`w-2 h-2 rounded-full transition-all ${
            settingsLoading ? 'bg-gray-400 animate-pulse' : 
            (isSystemStrict ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]')
          }`} 
        />
        <span className="text-[8px] font-black uppercase tracking-tighter text-[var(--color-text-muted)] leading-none italic opacity-70">SYS</span>
      </div>
      
      <div className="w-[1px] h-3 bg-[var(--color-border)]" />
      
      {/* Voucher Icon Indicator */}
      <div className="flex items-center gap-1.5">
        {isNewVoucher ? (
          <HelpCircle size={10} className="text-gray-400" />
        ) : isVoucherStrict ? (
          <Lock size={10} className="text-indigo-500 transition-all group-hover:scale-110" />
        ) : (
          <Zap size={10} className="text-emerald-500 animate-pulse transition-all group-hover:scale-110" />
        )}
        <span className="text-[8px] font-black uppercase tracking-tighter text-[var(--color-text-muted)] leading-none italic opacity-70">
          {isNewVoucher ? 'N/A' : 'VOC'}
        </span>
      </div>

      {/* Rich Unified Tooltip */}
      <div className="absolute left-0 top-full mt-2 hidden group-hover:block bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] text-[10px] p-2.5 rounded-lg shadow-2xl z-[9999] border border-[var(--color-border)] min-w-[220px] backdrop-blur-md">
        <div className="flex justify-between items-center border-b border-[var(--color-border)] shadow-sm pb-1.5 mb-2">
          <span className="font-black tracking-widest text-[var(--color-text-secondary)] uppercase">Policy Governance</span>
          <span className="text-[8px] bg-[var(--color-bg-tertiary)] px-1 rounded text-[var(--color-text-muted)]">V2.1</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-start gap-2.5">
            <div className={`mt-1 w-2 h-2 rounded-full flex-none ${isSystemStrict ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
            <div className="flex flex-col">
              <span className="font-bold">System Mode: {isSystemStrict ? 'Strict' : 'Flexible'}</span>
              <span className="text-[9px] text-[var(--color-text-secondary)] leading-tight">Global policy for new vouchers. Current setting: {isSystemStrict ? 'All require FA.' : 'Auto-post enabled.'}</span>
            </div>
          </div>
          
          <div className="flex items-start gap-2.5 pt-1 border-t border-[var(--color-border)]">
            <div className="mt-0.5 flex-none">
              {isNewVoucher ? (
                 <HelpCircle size={10} className="text-gray-400" />
              ) : isVoucherStrict ? (
                 <Lock size={10} className="text-indigo-500" /> 
              ) : (
                 <Zap size={10} className="text-emerald-500" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="font-bold">
                Voucher Policy: {isNewVoucher ? 'Not Defined (New)' : isVoucherStrict ? 'Strict Audit' : 'Flexible Edit'}
              </span>
              <span className="text-[9px] text-[var(--color-text-secondary)] leading-tight">
                {isNewVoucher 
                  ? 'This voucher has not been created yet. Policy will be assigned upon saving.' 
                  : isVoucherStrict 
                    ? 'This specific document is locked by audit rules from its creation. Permanent immutability.' 
                    : 'This document was created under flexible rules. Self-correction is permitted.'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
