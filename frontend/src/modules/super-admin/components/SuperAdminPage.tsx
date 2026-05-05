import React from 'react';
import { clsx } from 'clsx';
import { AlertCircle, Database, Loader2 } from 'lucide-react';

export type SortDirection = 'asc' | 'desc' | null;

export const SuperAdminPage: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={clsx('mx-auto flex w-full max-w-[1500px] flex-col gap-[var(--sa-page-gap)] px-[var(--sa-page-x)] py-[var(--sa-page-y)]', className)}>
    {children}
  </div>
);

export const SuperAdminHeader: React.FC<{
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, description, meta, actions }) => (
  <div className="flex flex-col gap-4 border-b border-[var(--sa-border)] pb-5 lg:flex-row lg:items-end lg:justify-between">
    <div className="min-w-0">
      {meta && <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--sa-muted)]">{meta}</div>}
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--sa-text)]">{title}</h1>
      {description && <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--sa-muted)]">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export const SuperAdminPanel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <section className={clsx('rounded-[var(--sa-radius)] border border-[var(--sa-border)] bg-[var(--sa-surface)] shadow-sm', className)}>
    {children}
  </section>
);

export const SuperAdminStatCard: React.FC<{
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  helper?: React.ReactNode;
}> = ({ label, value, icon: Icon = Database, helper }) => (
  <div className="rounded-[var(--sa-radius)] border border-[var(--sa-border)] bg-[var(--sa-surface)] p-[var(--sa-panel-pad)] shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-[var(--sa-muted)]">{label}</div>
        <div className="mt-2 text-2xl font-semibold text-[var(--sa-text)]">{value}</div>
        {helper && <div className="mt-1 text-xs text-[var(--sa-muted)]">{helper}</div>}
      </div>
      <div className="flex h-9 w-9 items-center justify-center rounded-[calc(var(--sa-radius)-2px)] bg-[var(--sa-surface-muted)] text-[var(--sa-muted)]">
        <Icon className="h-4 w-4" />
      </div>
    </div>
  </div>
);

export const SuperAdminTable: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={clsx('overflow-hidden rounded-[var(--sa-radius)] border border-[var(--sa-border)] bg-[var(--sa-surface)] shadow-sm', className)}>
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-[var(--sa-border)] text-sm">
        {children}
      </table>
    </div>
  </div>
);

export const tableHeadCellClass = 'px-4 py-[var(--sa-row-y)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--sa-muted)]';
export const tableSortHeaderClass = 'cursor-pointer select-none hover:text-[var(--sa-text)] hover:bg-[var(--sa-surface-muted)] transition-colors';
export const tableCellClass = 'px-4 py-[var(--sa-row-y)] align-middle text-[var(--sa-text)]';
export const tableRowClass = 'border-b border-[var(--sa-border)] last:border-0 hover:bg-[var(--sa-surface-muted)]';

export const SuperAdminSearchInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, placeholder, className }) => (
  <div className={clsx('relative max-w-sm', className)}>
    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
      <svg className="h-4 w-4 text-[var(--sa-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </div>
    <input
      type="text"
      className="block w-full rounded-[var(--sa-radius)] border border-[var(--sa-border)] bg-[var(--sa-surface)] py-2 pl-10 pr-3 text-sm placeholder:text-[var(--sa-muted)] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm transition-all"
      placeholder={placeholder || 'Search...'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
    {value && (
      <button
        onClick={() => onChange('')}
        className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--sa-muted)] hover:text-[var(--sa-text)]"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    )}
  </div>
);

export const SuperAdminEmptyState: React.FC<{ title: React.ReactNode; description?: React.ReactNode }> = ({ title, description }) => (
  <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--sa-surface-muted)] text-[var(--sa-muted)]">
      <AlertCircle className="h-5 w-5" />
    </div>
    <div className="text-sm font-medium text-[var(--sa-text)]">{title}</div>
    {description && <div className="max-w-md text-sm text-[var(--sa-muted)]">{description}</div>}
  </div>
);

export const SuperAdminLoading: React.FC<{ label: React.ReactNode }> = ({ label }) => (
  <div className="flex items-center gap-2 rounded-[var(--sa-radius)] border border-[var(--sa-border)] bg-[var(--sa-surface)] px-4 py-3 text-sm text-[var(--sa-muted)] shadow-sm">
    <Loader2 className="h-4 w-4 animate-spin" />
    {label}
  </div>
);

export const SuperAdminBadge: React.FC<{ children: React.ReactNode; tone?: 'slate' | 'green' | 'amber' | 'red' | 'blue' }> = ({
  children,
  tone = 'slate',
}) => {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
  };

  return (
    <span className={clsx('inline-flex items-center rounded px-2 py-0.5 text-xs font-medium', tones[tone])}>
      {children}
    </span>
  );
};

export const SortIcon: React.FC<{ direction: SortDirection }> = ({ direction }) => {
  if (!direction) return <span className="ml-1 opacity-20">↕</span>;
  return <span className="ml-1 text-indigo-600">{direction === 'asc' ? '↑' : '↓'}</span>;
};

export const SuperAdminModal: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  size?: 'md' | 'lg';
}> = ({ title, subtitle, children, footer, onClose, size = 'md' }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onClick={onClose}>
    <div
      className={clsx(
        'max-h-[90vh] w-full overflow-hidden rounded-[var(--sa-radius)] border border-[var(--sa-border)] bg-[var(--sa-surface)] shadow-xl',
        size === 'lg' ? 'max-w-2xl' : 'max-w-md'
      )}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="border-b border-[var(--sa-border)] px-5 py-4">
        <h2 className="text-lg font-semibold text-[var(--sa-text)]">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-[var(--sa-muted)]">{subtitle}</p>}
      </div>
      <div className="max-h-[65vh] overflow-y-auto px-5 py-4">{children}</div>
      {footer && <div className="border-t border-[var(--sa-border)] bg-[var(--sa-surface-muted)] px-5 py-4">{footer}</div>}
    </div>
  </div>
);
