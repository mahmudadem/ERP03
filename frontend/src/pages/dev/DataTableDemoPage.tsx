import React, { useState, useMemo, useCallback } from 'react';
import { DataTable, ColumnDefinition, RowAction, BulkAction, ActiveFilters } from '../../components/ui/DataTable';
import { Badge } from '../../components/ui/Badge';
import { Eye, Edit, Trash2, Printer, Download, CheckCircle, XCircle, FileText, Filter } from 'lucide-react';

interface DemoVoucher {
  id: string;
  voucherNo: string;
  name: string;
  date: string;
  type: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  currency: string;
  status: string;
  reference: string;
  approvedAt: string;
  creationMode: string;
}

const STATUSES = ['Draft', 'Pending', 'Approved', 'Posted', 'Cancelled'] as const;
const TYPES = ['Journal Entry', 'Payment', 'Receipt', 'Reversal', 'Sales Invoice', 'Purchase Invoice'] as const;
const CURRENCIES = ['USD', 'EUR', 'GBP', 'SYP', 'AED'] as const;
const ACCOUNTS = [
  'Cash on Hand', 'Bank - Main', 'Accounts Receivable', 'Accounts Payable',
  'Office Expenses', 'Sales Revenue', 'Cost of Goods Sold', 'Inventory',
  'Retained Earnings', 'Share Capital', 'Tax Payable', 'Depreciation',
];

function randomItem<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateDemoData(count: number): DemoVoucher[] {
  return Array.from({ length: count }, (_, i) => {
    const year = 2026;
    const month = Math.floor(Math.random() * 12) + 1;
    const day = Math.floor(Math.random() * 28) + 1;
    return {
      id: `v-${i + 1}`,
      voucherNo: `VCH-${String(i + 1).padStart(5, '0')}`,
      name: randomItem([
        'Office Supplies Purchase', 'Client Retainer - May', 'Monthly Rent Payment',
        'Equipment Depreciation', 'Payroll - Engineering', 'Server Hosting Fee',
        'Consulting Revenue - Q2', 'Tax Payment - VAT', 'Insurance Premium',
        'Travel Expense - Dubai', 'Software License Renewal', 'Marketing Campaign',
      ]),
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      type: randomItem(TYPES),
      debitAccount: randomItem(ACCOUNTS),
      creditAccount: randomItem(ACCOUNTS.filter(a => a !== ACCOUNTS[0])),
      amount: Math.round((Math.random() * 50000 + 100) * 100) / 100,
      currency: randomItem(CURRENCIES),
      status: randomItem(STATUSES),
      reference: `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      approvedAt: Math.random() > 0.3 ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '',
      creationMode: Math.random() > 0.5 ? 'STRICT' : Math.random() > 0.5 ? 'FLEXIBLE' : '-',
    };
  });
}

const columns: ColumnDefinition<DemoVoucher>[] = [
  { key: 'voucherNo', label: 'Voucher #', width: '12%', priority: 1, accessor: 'voucherNo', sortable: true, filter: { type: 'text' } },
  { key: 'name', label: 'Name', width: '20%', priority: 1, accessor: 'name', truncate: true, filter: { type: 'text' } },
  {
    key: 'status', label: 'Status', width: '10%', priority: 1, accessor: 'status', sortable: true,
    filter: { type: 'multi-select', options: STATUSES.map(s => ({ value: s, label: s })) },
    badge: {
      variantMap: { Posted: 'success', Draft: 'default', Cancelled: 'error', Pending: 'warning', Approved: 'info' },
    },
  },
  { key: 'date', label: 'Date', width: '10%', priority: 2, accessor: 'date', sortable: true, filter: { type: 'date-range' } },
  {
    key: 'type', label: 'Type', width: '12%', priority: 2, accessor: 'type',
    filter: { type: 'multi-select', options: TYPES.map(t => ({ value: t, label: t })) },
  },
  {
    key: 'amount', label: 'Amount', width: '12%', priority: 2, accessor: 'amount', align: 'right',
    filter: { type: 'number-range' },
    render: (val: number, row: DemoVoucher) => (
      <span className="font-mono">{val.toLocaleString(undefined, { minimumFractionDigits: 2 })} {row.currency}</span>
    ),
  },
  { key: 'debitAccount', label: 'Debit Account', width: '14%', priority: 3, accessor: 'debitAccount', truncate: true },
  { key: 'creditAccount', label: 'Credit Account', width: '14%', priority: 3, accessor: 'creditAccount', truncate: true },
  { key: 'reference', label: 'Reference', width: '10%', priority: 3, accessor: 'reference', truncate: true },
  { key: 'approvedAt', label: 'Approved', width: '10%', priority: 3, accessor: 'approvedAt' },
  { key: 'creationMode', label: 'Mode', width: '8%', priority: 3, accessor: 'creationMode' },
];

const rowActions: RowAction<DemoVoucher>[] = [
  { key: 'view', label: 'View', icon: Eye, onClick: (row) => console.log('View', row.voucherNo), primary: true, tooltip: 'View voucher' },
  { key: 'print', label: 'Print', icon: Printer, onClick: (row) => console.log('Print', row.voucherNo), primary: true, tooltip: 'Print voucher' },
  { key: 'edit', label: 'Edit', icon: Edit, onClick: (row) => console.log('Edit', row.voucherNo), isEnabled: (row) => row.status === 'Draft' },
  { key: 'approve', label: 'Approve', icon: CheckCircle, onClick: (row) => console.log('Approve', row.voucherNo), variant: 'success', isEnabled: (row) => row.status === 'Pending' },
  { key: 'cancel', label: 'Cancel', icon: XCircle, onClick: (row) => console.log('Cancel', row.voucherNo), variant: 'danger', isEnabled: (row) => row.status !== 'Cancelled' && row.status !== 'Posted' },
  { key: 'delete', label: 'Delete', icon: Trash2, onClick: (row) => console.log('Delete', row.voucherNo), variant: 'danger', isEnabled: (row) => row.status === 'Draft' },
];

const bulkActions: BulkAction<DemoVoucher>[] = [
  { key: 'export', label: 'Export CSV', icon: Download, onClick: (rows) => console.log('Export', rows.length, 'rows') },
  { key: 'print', label: 'Print Selected', icon: Printer, onClick: (rows) => console.log('Print', rows.length, 'vouchers') },
  { key: 'approve', label: 'Approve', icon: CheckCircle, onClick: (rows) => console.log('Approve', rows.length), variant: 'success', requiresCount: 1 },
  { key: 'delete', label: 'Delete', icon: Trash2, onClick: (rows) => console.log('Delete', rows.length), variant: 'danger', requiresCount: 1 },
];

const DataTableDemoPage: React.FC = () => {
  const [allData] = useState(() => generateDemoData(127));
  const [filteredData, setFilteredData] = useState<DemoVoucher[]>(allData);
  const [sortField, setSortField] = useState<string>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(false);
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({});

  const applyFilters = useCallback((baseData: DemoVoucher[], filters: ActiveFilters) => {
    let result = [...baseData];

    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined) return;

      if (key === 'voucherNo' && typeof value === 'string' && value) {
        result = result.filter(r => r.voucherNo.toLowerCase().includes(value.toLowerCase()));
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
  }, []);

  const handleFilterChange = useCallback((filters: ActiveFilters) => {
    setActiveFilters(prev => {
      const next = { ...prev };
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

  const dataWithFilters = useMemo(() => applyFilters(allData, activeFilters), [allData, activeFilters, applyFilters]);

  const sortedData = useMemo(() => {
    if (!sortField || !sortDirection) return dataWithFilters;
    return [...dataWithFilters].sort((a, b) => {
      const aVal = (a as any)[sortField];
      const bVal = (b as any)[sortField];
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [dataWithFilters, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = sortedData.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') setSortDirection(null);
      else setSortDirection('asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleSearch = (term: string) => {
    setLoading(true);
    setTimeout(() => {
      const lower = term.toLowerCase();
      if (!lower) {
        setFilteredData(allData);
      } else {
        setFilteredData(allData.filter(row =>
          row.voucherNo.toLowerCase().includes(lower) ||
          row.name.toLowerCase().includes(lower) ||
          row.type.toLowerCase().includes(lower) ||
          row.status.toLowerCase().includes(lower) ||
          row.reference.toLowerCase().includes(lower)
        ));
      }
      setPage(1);
      setLoading(false);
    }, 200);
  };

  const statusSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    STATUSES.forEach(s => counts[s] = 0);
    allData.forEach(r => counts[r.status]++);
    return counts;
  }, [allData]);

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-secondary)] p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">DataTable Demo</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Universal data table — selection, actions, filters, resizing, expandable rows, density, badges.
        </p>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {STATUSES.map(status => (
          <div
            key={status}
            className="flex items-center justify-between px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)]"
          >
            <span className="text-xs text-[var(--color-text-secondary)]">{status}</span>
            <span className="text-sm font-bold text-[var(--color-text-primary)]">{statusSummary[status]}</span>
          </div>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={paginatedData}
        loading={loading}
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
        renderExpanded={(row) => (
          <div className="grid grid-cols-2 gap-4 text-sm">
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
              <span className="text-[var(--color-text-primary)] font-mono">{row.reference}</span>
            </div>
            <div>
              <span className="text-[var(--color-text-muted)]">Mode: </span>
              <span className="text-[var(--color-text-primary)]">{row.creationMode}</span>
            </div>
          </div>
        )}
        resizable
        onRowClick={(row) => console.log('Row clicked:', row.voucherNo)}
        stickyHeader
        emptyMessage="No vouchers match your search"
        idKey="id"
        toolbar={
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors">
              <FileText className="w-4 h-4" />
              New Voucher
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-md hover:bg-[var(--color-bg-tertiary)] transition-colors text-[var(--color-text-primary)]">
              <Filter className="w-4 h-4" />
              Advanced Filters
            </button>
          </div>
        }
      />
    </div>
  );
};

export default DataTableDemoPage;
