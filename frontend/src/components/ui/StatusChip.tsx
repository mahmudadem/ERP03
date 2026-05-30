import React from 'react';
import { clsx } from 'clsx';

interface StatusChipProps {
  status: string;
  type: 'quote' | 'so' | 'si' | 'dn' | 'sr';
  className?: string;
}

const STATUS_CLASS_MAP: Record<string, string> = {
  // Slate
  'DRAFT': 'bg-slate-100 text-slate-700',
  'CLOSED': 'bg-slate-100 text-slate-700',
  'NONE': 'bg-slate-100 text-slate-700',

  // Indigo
  'CONFIRMED': 'bg-indigo-100 text-indigo-700',

  // Blue
  'SENT': 'bg-blue-100 text-blue-700',

  // Amber
  'PARTIALLY_DELIVERED': 'bg-amber-100 text-amber-700',
  'PARTIALLY_PAID': 'bg-amber-100 text-amber-700',
  'EXPIRED': 'bg-amber-100 text-amber-700',

  // Emerald
  'POSTED': 'bg-emerald-100 text-emerald-700',
  'FULLY_DELIVERED': 'bg-emerald-100 text-emerald-700',
  'PAID': 'bg-emerald-100 text-emerald-700',
  'ACCEPTED': 'bg-emerald-100 text-emerald-700',

  // Rose
  'CANCELLED': 'bg-rose-100 text-rose-700',
  'REJECTED': 'bg-rose-100 text-rose-700',

  // Violet
  'CONVERTED': 'bg-violet-100 text-violet-700',
};

export const statusChipClass = (status: string): string => {
  return STATUS_CLASS_MAP[status] ?? 'bg-slate-100 text-slate-700';
};

export const StatusChip: React.FC<StatusChipProps> = ({
  status,
  type,
  className = ''
}) => {
  return (
    <span
      className={clsx(
        'inline-flex rounded-full px-3 py-1 text-xs font-semibold',
        statusChipClass(status),
        className
      )}
    >
      {status}
    </span>
  );
};
