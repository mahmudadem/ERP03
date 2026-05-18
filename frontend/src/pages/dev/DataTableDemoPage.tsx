import React, { useState, useMemo } from 'react';
import { DataTable, ColumnDefinition } from '../../components/ui/DataTable';
import { Badge } from '../../components/ui/Badge';

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
  { key: 'voucherNo', label: 'Voucher #', width: '15%', priority: 1, accessor: 'voucherNo', sortable: true },
  { key: 'name', label: 'Name', width: '25%', priority: 1, accessor: 'name', truncate: true },
  { key: 'status', label: 'Status', width: '12%', priority: 1, render: (val: string) => {
    const variant = val === 'Posted' ? 'success' : val === 'Draft' ? 'default' : val === 'Cancelled' ? 'error' : 'warning';
    return <Badge variant={variant as any}>{val}</Badge>;
  }},
  { key: 'date', label: 'Date', width: '12%', priority: 2, accessor: 'date', sortable: true },
  { key: 'type', label: 'Type', width: '12%', priority: 2, accessor: 'type' },
  { key: 'amount', label: 'Amount', width: '12%', priority: 2, accessor: 'amount', align: 'right', render: (val: number, row: DemoVoucher) => (
    <span className="font-mono">{val.toLocaleString(undefined, { minimumFractionDigits: 2 })} {row.currency}</span>
  )},
  { key: 'debitAccount', label: 'Debit Account', width: '15%', priority: 3, accessor: 'debitAccount', truncate: true },
  { key: 'creditAccount', label: 'Credit Account', width: '15%', priority: 3, accessor: 'creditAccount', truncate: true },
  { key: 'reference', label: 'Reference', width: '12%', priority: 3, accessor: 'reference', truncate: true },
  { key: 'approvedAt', label: 'Approved', width: '12%', priority: 3, accessor: 'approvedAt' },
  { key: 'creationMode', label: 'Mode', width: '10%', priority: 3, accessor: 'creationMode' },
];

const DataTableDemoPage: React.FC = () => {
  const [allData] = useState(() => generateDemoData(127));
  const [filteredData, setFilteredData] = useState<DemoVoucher[]>(allData);
  const [sortField, setSortField] = useState<string>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(false);

  const sortedData = useMemo(() => {
    const sorted = [...filteredData].sort((a, b) => {
      const aVal = (a as any)[sortField];
      const bVal = (b as any)[sortField];
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredData, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = sortedData.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
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

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-secondary)] p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">DataTable Demo</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Responsive table component — resize your browser to see columns adapt.
          Priority 1 columns always visible, Priority 2 on tablet+, Priority 3 on desktop+.
        </p>
      </div>

      <div className="flex gap-4 text-xs text-[var(--color-text-muted)]">
        <span className="px-2 py-1 rounded bg-green-100 text-green-700">Mobile (&lt;640px): 3 columns</span>
        <span className="px-2 py-1 rounded bg-blue-100 text-blue-700">Tablet (640-1023px): 7 columns</span>
        <span className="px-2 py-1 rounded bg-purple-100 text-purple-700">Desktop (1024px+): 11 columns</span>
      </div>

      <DataTable
        columns={columns}
        data={paginatedData}
        loading={loading}
        searchable
        searchPlaceholder="Search vouchers..."
        sorting={{ field: sortField, direction: sortDirection, onSort: handleSort }}
        pagination={{
          page,
          pageSize,
          totalItems: sortedData.length,
          totalPages,
          onPageChange: setPage,
          onPageSizeChange: (size) => { setPageSize(size); setPage(1); },
        }}
        onRowClick={(row) => console.log('Row clicked:', row.voucherNo)}
        stickyHeader
        emptyMessage="No vouchers match your search"
        idKey="id"
      />
    </div>
  );
};

export default DataTableDemoPage;
