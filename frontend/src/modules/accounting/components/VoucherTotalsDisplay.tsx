import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface VoucherTotalsDisplayProps {
  totalDebit: number;
  totalCredit: number;
  currency: string;
  isBalanced: boolean;
  difference?: number;
}

export const VoucherTotalsDisplay: React.FC<VoucherTotalsDisplayProps> = ({
  totalDebit,
  totalCredit,
  currency,
  isBalanced,
  difference
}) => {
  const hasValues = totalDebit > 0 || totalCredit > 0;
  const diff = difference !== undefined ? difference : Math.abs(totalDebit - totalCredit);
  
  // Logic from VoucherWindow: 
  // - Gray when both are 0
  // - Green when balanced (with values)
  // - Red when unbalanced
  const bgColor = !hasValues 
    ? 'bg-[var(--color-bg-tertiary)]' 
    : (isBalanced ? 'bg-success-100/30 dark:bg-success-900/20' : 'bg-danger-100/30 dark:bg-danger-900/20');
    
  const borderColor = !hasValues 
    ? 'border-[var(--color-border)]' 
    : (isBalanced ? 'border-success-500/30' : 'border-danger-500/30');

  // Format number helper
  const format = (val: number) => new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);

  return (
    <div className="flex flex-col gap-2">
      <div className={`flex items-center gap-6 px-4 py-2 ${bgColor} rounded-md transition-all border ${borderColor} shadow-sm`}>
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest list-none">
            Total Debit ({currency})
          </span>
          <span className="text-base font-bold text-[var(--color-text-primary)] font-mono">
            {format(totalDebit)}
          </span>
        </div>
        
        {/* Vertical Divider (Pipeline) */}
        <div className="w-[1px] h-5 bg-[var(--color-border)] opacity-50" />
        
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
            Total Credit ({currency})
          </span>
          <span className="text-base font-bold text-[var(--color-text-primary)] font-mono">
            {format(totalCredit)}
          </span>
        </div>
      </div>

      {!isBalanced && hasValues && (
        <div className="flex items-center gap-1.5 px-2 text-[10px] font-bold text-danger-600 dark:text-danger-400 uppercase tracking-tight animate-pulse">
          <AlertTriangle size={12} strokeWidth={3} />
          Voucher Unbalanced: {diff.toFixed(2)} {currency} difference
        </div>
      )}
    </div>
  );
};
