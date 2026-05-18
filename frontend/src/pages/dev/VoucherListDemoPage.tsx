import React, { useState, useMemo, useCallback } from 'react';
import {
  DataTable,
  ColumnDefinition,
  RowAction,
  BulkAction,
  ActiveFilters,
  BadgeVariant,
} from '../../components/ui/DataTable';
import {
  Eye,
  Edit,
  Trash2,
  Printer,
  CheckCircle,
  XCircle,
  RotateCcw,
  RefreshCw,
  Ban,
  Lock,
  ChevronRight,
  ChevronDown,
  FilePlus,
  Download,
  Filter,
} from 'lucide-react';

// ── Data Types ───────────────────────────────────────────────────────

interface DemoVoucher {
  id: string;
  date: string;
  number: string;
  type: string;
  name: string;
  debitAccount: string;
  creditAccount: string;
  creationMode: string;
  approvedAt: string;
  status: string;
  currency: string;
  amount: number;
  ref: string;
  reversalOfVoucherId?: string;
  postedAt?: string;
  locked?: boolean;
}

interface ReversalGroup {
  parent: DemoVoucher;
  children: DemoVoucher[];
}

// ── Constants ────────────────────────────────────────────────────────

const STATUSES = ['Draft', 'Pending', 'Approved', 'Posted', 'Cancelled'] as const;
const TYPES = ['Journal Entry', 'Payment Voucher', 'Receipt Voucher', 'Sales Invoice', 'Purchase Invoice', 'Reversal'] as const;
const CURRENCIES = ['USD', 'EUR', 'GBP', 'SYP', 'AED'] as const;
const CREATION_MODES = ['STRICT', 'FLEXIBLE', 'CLONED'] as const;
const ACCOUNTS = [
  'Cash on Hand', 'Bank - Main', 'Accounts Receivable', 'Accounts Payable',
  'Office Expenses', 'Sales Revenue', 'Cost of Goods Sold', 'Inventory',
  'Retained Earnings', 'Share Capital', 'Tax Payable', 'Depreciation',
  'Rent Expense', 'Utilities Expense', 'Consulting Revenue',
];

function randomItem<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateVouchers(count: number): DemoVoucher[] {
  const vouchers: DemoVoucher[] = [];

  for (let i = 0; i < count; i++) {
    const year = 2026;
    const month = Math.floor(Math.random() * 12) + 1;
    const day = Math.floor(Math.random() * 28) + 1;
    const status = randomItem(STATUSES);
    const type = randomItem(TYPES);
    const isReversal = type === 'Reversal';
    const reversalParentId = isReversal && i > 5 ? `v-${Math.floor(Math.random() * Math.max(1, i - 3)) + 1}` : undefined;

    vouchers.push({
      id: `v-${i + 1}`,
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      number: `VCH-${String(i + 1).padStart(5, '0')}`,
      type,
      name: randomItem([
        'Office Supplies Purchase', 'Client Retainer - May', 'Monthly Rent Payment',
        'Equipment Depreciation', 'Payroll - Engineering', 'Server Hosting Fee',
        'Consulting Revenue - Q2', 'Tax Payment - VAT', 'Insurance Premium',
        'Travel Expense - Dubai', 'Software License Renewal', 'Marketing Campaign',
        'Utility Bill Payment', 'Freight Charges', 'Bank Service Fee',
      ]),
      debitAccount: randomItem(ACCOUNTS),
      creditAccount: randomItem(ACCOUNTS.filter(a => a !== ACCOUNTS[0])),
      creationMode: randomItem(CREATION_MODES),
      approvedAt: status === 'Posted' || status === 'Approved'
        ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        : '',
      status,
      currency: randomItem(CURRENCIES),
      amount: Math.round((Math.random() * 50000 + 100) * 100) / 100,
      ref: `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      reversalOfVoucherId: reversalParentId,
      postedAt: status === 'Posted' ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : undefined,
      locked: status === 'Posted' && Math.random() > 0.5,
    });
  }

  return vouchers;
}

const allVouchers = generateVouchers(85);

// ── Derived Data: Group Reversals ────────────────────────────────────

function buildReversalGroups(vouchers: DemoVoucher[]): {
  parents: DemoVoucher[];
  childrenByParent: Record<string, DemoVoucher[]>;
} {
  const childrenByParent: Record<string, DemoVoucher[]> = {};
  const parentIds = new Set<string>();

  vouchers.forEach(v => {
    if (v.reversalOfVoucherId) {
      if (!childrenByParent[v.reversalOfVoucherId]) {
        childrenByParent[v.reversalOfVoucherId] = [];
      }
      childrenByParent[v.reversalOfVoucherId].push(v);
      parentIds.add(v.reversalOfVoucherId);
    }
  });

  const parents = vouchers.filter(v => parentIds.has(v.id));

  return { parents, childrenByParent };
}

// ── Page Component ───────────────────────────────────────────────────

const VoucherListDemoPage: React.FC = () => {
  const [sortField, setSortField] = useState<string>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>('all');

  const { parents, childrenByParent } = useMemo(
    () => buildReversalGroups(allVouchers),
    []
  );
  const parentIds = useMemo(() => new Set(parents.map(p => p.id)), [parents]);

  const filteredVouchers = useMemo(() => {
    let result = [...allVouchers];

    if (filterType !== 'all') {
      result = result.filter(v => v.type === filterType);
    }

    Object.entries(activeFilters).forEach(([key, value]) => {
      if (value === undefined) return;

      if (key === 'number' && typeof value === 'string' && value) {
        result = result.filter(r => r.number.toLowerCase().includes(value.toLowerCase()));
      }
      if (key === 'name' && typeof value === 'string' && value) {
        result = result.filter(r => r.name.toLowerCase().includes(value.toLowerCase()));
      }
      if (key === 'status' && Array.isArray(value) && value.length > 0) {
        result = result.filter(r => value.includes(r.status));
      }
      if (key === 'type' && Array.isArray(value) && value.length > 0) {
        result = result.filter(r => value.includes(r.type));
      }
      if (key === 'date' && typeof value === 'object' && !Array.isArray(value)) {
        const { from, to } = value as { from?: string; to?: string };
        if (from) result = result.filter(r => r.date >= from);
        if (to) result = result.filter(r => r.date <= to);
      }
      if (key === 'amount' && typeof value === 'object' && !Array.isArray(value)) {
        const { min, max } = value as { min?: number; max?: number };
        if (min !== undefined) result = result.filter(r => r.amount >= min);
        if (max !== undefined) result = result.filter(r => r.amount <= max);
      }
    });

    return result;
  }, [activeFilters, filterType]);

  const sortedData = useMemo(() => {
    if (!sortField || !sortDirection) return filteredVouchers;
    return [...filteredVouchers].sort((a, b) => {
      const aVal = (a as any)[sortField];
      const bVal = (b as any)[sortField];
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredVouchers, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = sortedData.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') setSortDirection(null);
      else setSortDirection('asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }, [sortField, sortDirection]);

  const handleFilterChange = useCallback((filters: ActiveFilters) => {
    setActiveFilters(prev => {
      const next: ActiveFilters = { ...prev };
      Object.entries(filters).forEach(([key, value]) => {
        if (value === undefined) {
          delete next[key];
        } else {
          next[key] = value;
        }
      });
      return next;
    });
  }, []);

  const clearFilter = useCallback((key: string) => {
    setActiveFilters(prev => {
      const next: ActiveFilters = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const handleAction = useCallback((action: string, voucher: DemoVoucher) => {
    console.log(`Action: ${action} on ${voucher.number}`);
  }, []);

  // ── Columns ────────────────────────────────────────────────────────

  const columns: ColumnDefinition<DemoVoucher>[] = [
    {
      key: 'number', label: 'Voucher #', width: '15%', priority: 1, accessor: 'number',
      sortable: true, filter: { type: 'text' },
      render: (val: string, row: DemoVoucher) => (
        <span className="font-mono text-primary-600 dark:text-primary-400">{val}</span>
      ),
    },
    {
      key: 'date', label: 'Date', width: '14%', priority: 1, accessor: 'date',
      sortable: true, filter: { type: 'date-range' },
    },
    {
      key: 'status', label: 'Status', width: '12%', priority: 1, accessor: 'status',
      filter: { type: 'multi-select', options: STATUSES.map(s => ({ value: s, label: s })) },
      badge: {
        variantMap: {
          Posted: 'success', Draft: 'default', Cancelled: 'error',
          Pending: 'warning', Approved: 'info',
        },
        iconMap: {
          Posted: CheckCircle, Pending: RefreshCw, Approved: CheckCircle,
          Cancelled: Ban, Draft: FilePlus,
        },
      },
    },
    {
      key: 'name', label: 'Description', width: '25%', priority: 2, accessor: 'name',
      truncate: true, filter: { type: 'text' },
    },
    {
      key: 'type', label: 'Type', width: '14%', priority: 2, accessor: 'type',
      filter: { type: 'multi-select', options: TYPES.map(t => ({ value: t, label: t })) },
      render: (val: string) => {
        const colors: Record<string, string> = {
          'Journal Entry': 'text-blue-600',
          'Payment Voucher': 'text-red-600',
          'Receipt Voucher': 'text-green-600',
          'Sales Invoice': 'text-purple-600',
          'Purchase Invoice': 'text-orange-600',
          'Reversal': 'text-gray-500',
        };
        return <span className={colors[val] || 'text-[var(--color-text-primary)]'}>{val}</span>;
      },
    },
    {
      key: 'amount', label: 'Amount', width: '14%', priority: 2, accessor: 'amount',
      align: 'right', sortable: true, filter: { type: 'number-range' },
      render: (val: number, row: DemoVoucher) => (
        <span className="font-mono font-medium">
          {val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          <span className="text-[var(--color-text-muted)] ml-1 text-[0.85em]">{row.currency}</span>
        </span>
      ),
    },
    {
      key: 'debitAccount', label: 'Debit Account', width: '14%', priority: 3,
      accessor: 'debitAccount', truncate: true,
    },
    {
      key: 'creditAccount', label: 'Credit Account', width: '14%', priority: 3,
      accessor: 'creditAccount', truncate: true,
    },
    {
      key: 'creationMode', label: 'Mode', width: '10%', priority: 3, accessor: 'creationMode',
      render: (val: string) => {
        const variant = val === 'STRICT' ? 'info' : val === 'FLEXIBLE' ? 'default' : 'warning';
        return (
          <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${
            variant === 'info' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
            variant === 'warning' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
            'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
          }`}>
            {val}
          </span>
        );
      },
    },
    { key: 'approvedAt', label: 'Approved', width: '12%', priority: 3, accessor: 'approvedAt' },
    { key: 'ref', label: 'Reference', width: '12%', priority: 3, accessor: 'ref', truncate: true },
  ];

  // ── Row Actions ────────────────────────────────────────────────────

  const rowActions: RowAction<DemoVoucher>[] = [
    { key: 'view', label: 'View', icon: Eye, onClick: (r) => handleAction('view', r), primary: true, tooltip: 'View voucher' },
    { key: 'print', label: 'Print', icon: Printer, onClick: (r) => handleAction('print', r), primary: true, tooltip: 'Print voucher' },
    { key: 'edit', label: 'Edit', icon: Edit, onClick: (r) => handleAction('edit', r), isEnabled: (r) => r.status === 'Draft' },
    { key: 'approve', label: 'Approve', icon: CheckCircle, onClick: (r) => handleAction('approve', r), variant: 'success', isEnabled: (r) => r.status === 'Pending' },
    { key: 'post', label: 'Post', icon: RefreshCw, onClick: (r) => handleAction('post', r), variant: 'primary', isEnabled: (r) => r.status === 'Approved' },
    { key: 'cancel', label: 'Cancel', icon: XCircle, onClick: (r) => handleAction('cancel', r), variant: 'danger', isEnabled: (r) => r.status !== 'Cancelled' && r.status !== 'Posted' },
    { key: 'reverse', label: 'Reverse', icon: RotateCcw, onClick: (r) => handleAction('reverse', r), variant: 'warning', isEnabled: (r) => r.status === 'Posted' && !r.locked },
    { key: 'delete', label: 'Delete', icon: Trash2, onClick: (r) => handleAction('delete', r), variant: 'danger', isEnabled: (r) => r.status === 'Draft' },
  ];

  // ── Bulk Actions ───────────────────────────────────────────────────

  const bulkActions: BulkAction<DemoVoucher>[] = [
    { key: 'export', label: 'Export CSV', icon: Download, onClick: (rows) => console.log('Export', rows.length, 'vouchers') },
    { key: 'print', label: 'Print Selected', icon: Printer, onClick: (rows) => console.log('Print', rows.length, 'vouchers') },
    { key: 'approve', label: 'Approve', icon: CheckCircle, onClick: (rows) => console.log('Approve', rows.length), variant: 'success', requiresCount: 1 },
    { key: 'delete', label: 'Delete', icon: Trash2, onClick: (rows) => console.log('Delete', rows.length), variant: 'danger', requiresCount: 1 },
  ];

  // ── Status Summary ─────────────────────────────────────────────────

  const statusSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    STATUSES.forEach(s => counts[s] = 0);
    allVouchers.forEach(r => counts[r.status]++);
    return counts;
  }, []);

  const statusColors: Record<string, string> = {
    Draft: 'bg-gray-500',
    Pending: 'bg-amber-500',
    Approved: 'bg-blue-500',
    Posted: 'bg-green-500',
    Cancelled: 'bg-red-500',
  };

  // ── Expandable Row Renderer ────────────────────────────────────────

  const renderExpanded = useCallback((row: DemoVoucher) => {
    const children = childrenByParent[row.id];
    if (!children || children.length === 0) {
      return (
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-[var(--color-text-muted)]">Debit: </span>
            <span className="text-[var(--color-text-primary)]">{row.debitAccount}</span>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)]">Credit: </span>
            <span className="text-[var(--color-text-primary)]">{row.creditAccount}</span>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)]">Reference: </span>
            <span className="text-[var(--color-text-primary)] font-mono">{row.ref}</span>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)]">Mode: </span>
            <span className="text-[var(--color-text-primary)]">{row.creationMode}</span>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)]">Approved: </span>
            <span className="text-[var(--color-text-primary)]">{row.approvedAt || '—'}</span>
          </div>
          {row.locked && (
            <div className="flex items-center gap-1 text-amber-600">
              <Lock className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Audit Locked</span>
            </div>
          )}
        </div>
      );
    }

    return (
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
          Reversals ({children.length})
        </div>
        <div className="space-y-1">
          {children.map(child => (
            <div key={child.id} className="flex items-center gap-3 text-sm px-3 py-1.5 rounded bg-[var(--color-bg-primary)]/50">
              <span className="font-mono text-primary-600 dark:text-primary-400">{child.number}</span>
              <span className={
                child.status === 'Posted' ? 'text-green-600' :
                child.status === 'Cancelled' ? 'text-red-600' :
                'text-[var(--color-text-muted)]'
              }>
                {child.status}
              </span>
              <span className="text-[var(--color-text-muted)]">{child.date}</span>
              <span className="font-mono ml-auto">{child.amount.toLocaleString()} {child.currency}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }, [childrenByParent]);

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-secondary)] p-3 sm:p-4 space-y-3 sm:space-y-4 overflow-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">Vouchers</h1>
          <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mt-0.5">
            {allVouchers.length} total &middot; {filteredVouchers.length} shown
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors font-medium">
            <FilePlus className="w-4 h-4" />
            <span className="hidden sm:inline">New Voucher</span>
            <span className="sm:hidden">New</span>
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm border border-[var(--color-border)] rounded-md hover:bg-[var(--color-bg-tertiary)] transition-colors text-[var(--color-text-primary)]">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Type Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
        <button
          onClick={() => { setFilterType('all'); setPage(1); }}
          className={`px-2.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${
            filterType === 'all'
              ? 'bg-primary-600 text-white'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
          }`}
        >
          All
        </button>
        {TYPES.map(type => (
          <button
            key={type}
            onClick={() => { setFilterType(type); setPage(1); }}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${
              filterType === type
                ? 'bg-primary-600 text-white'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Active Filter Indicators */}
      {Object.keys(activeFilters).length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[var(--color-text-muted)]">Active:</span>
          {Object.entries(activeFilters).map(([key, value]) => {
            let label = `${key}: `;
            if (typeof value === 'string') label += value;
            else if (Array.isArray(value)) label += value.join(', ');
            else if (typeof value === 'object') {
              const parts = Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${v}`);
              label += parts.join(', ');
            }
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 rounded-full"
              >
                {label}
                <button
                  onClick={() => clearFilter(key)}
                  className="ml-0.5 hover:text-primary-900"
                >
                  &times;
                </button>
              </span>
            );
          })}
          <button
            onClick={() => { setActiveFilters({}); setPage(1); }}
            className="text-xs text-red-500 hover:text-red-700 underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* DataTable */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <DataTable
          columns={columns}
          data={paginatedData}
          loading={false}
          searchable
          searchPlaceholder="Search vouchers..."
          sorting={{ field: sortField, direction: sortDirection, onSort: handleSort, sortCycle: 'cycle' }}
          pagination={{
            page,
            pageSize,
            totalItems: sortedData.length,
            totalPages,
            onPageChange: setPage,
            onPageSizeChange: (size) => { setPageSize(size); setPage(1); },
          }}
          selectable
          bulkActions={bulkActions}
          rowActions={rowActions}
          onFilterChange={handleFilterChange}
          activeFilters={activeFilters}
          expandable
          renderExpanded={renderExpanded}
          expandedIds={expandedIds}
          onExpandedChange={setExpandedIds}
          onRowClick={(row) => console.log('Row clicked:', row.number)}
          stickyHeader
          emptyMessage="No vouchers match your filters"
          idKey="id"
          toolbar={
            <div className="flex items-center gap-2 flex-wrap">
              {STATUSES.map(status => (
                <button
                  key={status}
                  onClick={() => {
                    const currentStatus = activeFilters.status;
                    const currentStatusArray = Array.isArray(currentStatus) ? currentStatus : [];
                    if (currentStatusArray.includes(status)) {
                      clearFilter('status');
                    } else {
                      handleFilterChange({ status: [status] });
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    Array.isArray(activeFilters.status) && activeFilters.status.includes(status)
                      ? 'border-primary-400 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:border-primary-700 dark:text-primary-300'
                      : 'border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] hover:border-[var(--color-border)]/80'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${statusColors[status]}`} />
                  {status}
                  <span className="font-bold ml-0.5">{statusSummary[status]}</span>
                </button>
              ))}
              <div className="flex-1" />
              <span className="text-xs text-[var(--color-text-muted)] hidden sm:inline">
                Tap headers to sort &middot; Filter icons for filters &middot; Drag edges to resize
              </span>
            </div>
          }
        />
      </div>
    </div>
  );
};

export default VoucherListDemoPage;
