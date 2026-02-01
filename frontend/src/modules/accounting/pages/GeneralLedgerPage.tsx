
import { useEffect, useState, useMemo, useRef } from 'react';
import { accountingApi, GeneralLedgerEntry } from '../../../api/accountingApi';
import { useAccounts } from '../../../context/AccountsContext';
import { Button } from '../../../components/ui/Button';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { formatCompanyDate, formatCompanyDateTime } from '../../../utils/dateUtils';
import { Search, RefreshCw, Printer, Filter, X, Settings2 } from 'lucide-react';
import { AccountSelector } from '../components/shared/AccountSelector';

const GeneralLedgerPage: React.FC = () => {
  const { settings } = useCompanySettings();
  const { company } = useCompanyAccess();
  const { accounts } = useAccounts();
  const currency = company?.baseCurrency || '';
  const [data, setData] = useState<GeneralLedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [searchText, setSearchText] = useState('');

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await accountingApi.getGeneralLedger(
        selectedAccountId || undefined,
        fromDate || undefined,
        toDate || undefined
      );
      // Response might be wrapped in { success, data } or just be the array
      const entries = Array.isArray(response) ? response : (response as any)?.data || [];
      setData(entries);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load General Ledger. Please try again.');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // Column Configuration
  const defaultColumns = ['date', 'voucherNo', 'code', 'account', 'description', 'debit', 'credit', 'balance', 'createdAt', 'createdByName'];
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('gl_visible_columns_v3');
    return saved ? JSON.parse(saved) : defaultColumns;
  });
  
  const [fontSize, setFontSize] = useState<string>(() => {
    return localStorage.getItem('gl_font_size') || 'text-sm';
  });

  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('gl_visible_columns_v3', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    localStorage.setItem('gl_font_size', fontSize);
  }, [fontSize]);

  // Click outside handler for settings
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleColumn = (col: string) => {
    setVisibleColumns(prev => 
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const getFontSizeClass = (size: string) => {
    switch (size) {
      case 'xs': return 'text-xs';
      case 'sm': return 'text-sm';
      case 'base': return 'text-base';
      default: return 'text-sm';
    }
  };


  useEffect(() => {
    fetchReport();
  }, []);

  // Filter data by search text
  const filteredData = useMemo(() => {
    if (!searchText) return data;
    const lower = searchText.toLowerCase();
    return data.filter(entry => 
      entry.voucherNo?.toLowerCase().includes(lower) ||
      entry.accountCode?.toLowerCase().includes(lower) ||
      entry.accountName?.toLowerCase().includes(lower) ||
      entry.description?.toLowerCase().includes(lower)
    );
  }, [data, searchText]);

  // Calculate totals
  const totalDebit = filteredData.reduce((acc, row) => acc + (row.debit || 0), 0);
  const totalCredit = filteredData.reduce((acc, row) => acc + (row.credit || 0), 0);

  const handlePrint = () => {
    window.print();
  };

  const handleClearFilters = () => {
    setSelectedAccountId('');
    setFromDate('');
    setToDate('');
    setSearchText('');
  };

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  return (
    <div className="grid grid-cols-1 w-full max-w-full overflow-hidden space-y-6 pb-20 print:pb-0">
      {/* Header */}
      <div className="flex justify-between items-start print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">General Ledger</h1>
          <p className="flex items-center text-sm text-[var(--color-text-muted)] mt-1">
            <span>View all posted transactions</span>
            <span className="ml-3 px-2.5 py-0.5 rounded-full bg-primary-100 text-primary-700 font-semibold text-xs border border-primary-200 shadow-sm">
              Base Currency: {currency}
            </span>
            {selectedAccount && <span className="ml-2 text-primary-600 font-medium">• {selectedAccount.code} - {selectedAccount.name}</span>}
          </p>
        </div>
        <div className="flex gap-2 items-center">
           {/* Settings Button */}
           <div className="relative" ref={settingsRef}>
             <button 
               onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }}
               className="p-1 hover:bg-[var(--color-bg-tertiary)] rounded-md transition-colors text-[var(--color-text-secondary)]"
               title="Table Settings"
             >
               <Settings2 size={16} />
             </button>
             
             {showSettings && (
               <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50 p-4 animate-in fade-in zoom-in-95 duration-200 text-left">
                 <div className="mb-4">
                   <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Font Size</h4>
                   <div className="flex bg-gray-100 p-1 rounded-lg">
                     {['xs', 'sm', 'base'].map((size) => (
                        <button
                          key={size}
                          onClick={() => setFontSize(size)}
                          className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${
                            fontSize === size 
                              ? 'bg-white text-primary-600 shadow-sm' 
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          {size.toUpperCase()}
                        </button>
                     ))}
                   </div>
                 </div>
                 
                 <div>
                   <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Visible Columns</h4>
                   <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto">
                     {[
                       { id: 'date', label: 'Date' },
                       { id: 'voucherNo', label: 'Voucher #' },
                       { id: 'code', label: 'Account Code' },
                       { id: 'account', label: 'Account Name' },
                       { id: 'description', label: 'Description' },
                       { id: 'debit', label: 'Debit' },
                       { id: 'credit', label: 'Credit' },
                       { id: 'balance', label: 'Balance' },
                        { id: 'createdAt', label: 'Created At' },
                        { id: 'createdBy', label: 'Created By (ID)' },
                        { id: 'createdByName', label: 'Created By (Name)' },
                        { id: 'createdByEmail', label: 'Created By (Email)' },
                        { id: 'approvedAt', label: 'Approved At' },
                        { id: 'approvedBy', label: 'Approved By (ID)' },
                        { id: 'approvedByName', label: 'Approved By (Name)' },
                        { id: 'approvedByEmail', label: 'Approved By (Email)' },
                        { id: 'postedAt', label: 'Posted At' },
                        { id: 'postedBy', label: 'Posted By (ID)' },
                        { id: 'postedByName', label: 'Posted By (Name)' },
                        { id: 'postedByEmail', label: 'Posted By (Email)' },
                        { id: 'amount', label: 'Orig. Amount' },
                        { id: 'currency', label: 'Orig. Currency' },
                        { id: 'exchangeRate', label: 'Exch. Rate' },
                     ].map((col) => (
                       <label key={col.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer select-none">
                         <input 
                           type="checkbox" 
                           checked={visibleColumns.includes(col.id)}
                           onChange={() => toggleColumn(col.id)}
                           className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                         />
                         <span className="text-sm text-gray-700">{col.label}</span>
                       </label>
                     ))}
                   </div>
                 </div>
               </div>
             )}
           </div>

          <Button onClick={handlePrint} variant="secondary" className="flex items-center gap-2">
            <Printer className="w-4 h-4" />
            Print
          </Button>
          <Button onClick={fetchReport} variant="primary" className="flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] p-4 print:hidden">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Account Filter */}
          <div className="flex-1 min-w-[300px]">
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Account</label>
            <AccountSelector
              value={selectedAccountId}
              onChange={(account) => setSelectedAccountId(account ? account.id : '')}
              placeholder="All Accounts"
            />
          </div>

          {/* Date Filters */}
          <div className="w-40">
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="w-40">
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search voucher, account, description..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={fetchReport} variant="primary" className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Apply
            </Button>
            {(selectedAccountId || fromDate || toDate || searchText) && (
              <Button onClick={handleClearFilters} variant="secondary" className="flex items-center gap-2">
                <X className="w-4 h-4" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block mb-8">
        <h1 className="text-2xl font-bold text-gray-900">General Ledger Report</h1>
        <p className="text-sm text-gray-600">Generated on {(() => {
          const now = new Date();
          return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        })()}</p>
        {selectedAccount && (
          <p className="text-sm text-gray-600 mt-1">Account: {selectedAccount.code} - {selectedAccount.name}</p>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-danger-50 text-danger-700 p-4 rounded border border-danger-200">
          {error}
        </div>
      )}

      {/* Data Table */}
      <div className="bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] shadow-sm print:shadow-none print:border h-[calc(100vh-340px)] flex flex-col min-w-0">
        <div className="overflow-auto flex-1 relative max-w-full">
          <table className="min-w-full divide-y divide-[var(--color-border)] relative">
            <thead className="bg-[var(--color-bg-tertiary)] print:bg-gray-100 sticky top-0 z-10 shadow-sm">
              <tr>
                {visibleColumns.includes('date') && <th className="px-4 py-3 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-28 whitespace-nowrap bg-[var(--color-bg-tertiary)]">Date</th>}
                {visibleColumns.includes('voucherNo') && <th className="px-4 py-3 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-36 whitespace-nowrap bg-[var(--color-bg-tertiary)]">Voucher #</th>}
                {!selectedAccountId && visibleColumns.includes('code') && (
                  <th className="px-4 py-3 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-24 whitespace-nowrap bg-[var(--color-bg-tertiary)]">Code</th>
                )}
                {!selectedAccountId && visibleColumns.includes('account') && (
                  <th className="px-4 py-3 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider whitespace-nowrap bg-[var(--color-bg-tertiary)]">Account</th>
                )}
                {visibleColumns.includes('description') && <th className="px-4 py-3 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider whitespace-nowrap bg-[var(--color-bg-tertiary)]">Description</th>}
                
                {/* New Metadata Columns */}
                {visibleColumns.includes('createdAt') && <th className="px-4 py-3 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-32 whitespace-nowrap bg-[var(--color-bg-tertiary)]">Created At</th>}
                {visibleColumns.includes('createdBy') && <th className="px-4 py-3 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-24 whitespace-nowrap bg-[var(--color-bg-tertiary)]">Created By (ID)</th>}
                {visibleColumns.includes('createdByName') && <th className="px-4 py-3 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-32 whitespace-nowrap bg-[var(--color-bg-tertiary)]">Created By</th>}
                {visibleColumns.includes('createdByEmail') && <th className="px-4 py-3 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-40 whitespace-nowrap bg-[var(--color-bg-tertiary)]">Created Email</th>}
                
                {visibleColumns.includes('approvedAt') && <th className="px-4 py-3 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-32 whitespace-nowrap bg-[var(--color-bg-tertiary)]">Approved At</th>}
                {visibleColumns.includes('approvedBy') && <th className="px-4 py-3 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-24 whitespace-nowrap bg-[var(--color-bg-tertiary)]">Approved By (ID)</th>}
                {visibleColumns.includes('approvedByName') && <th className="px-4 py-3 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-32 whitespace-nowrap bg-[var(--color-bg-tertiary)]">Approved By</th>}
                {visibleColumns.includes('approvedByEmail') && <th className="px-4 py-3 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-40 whitespace-nowrap bg-[var(--color-bg-tertiary)]">Approved Email</th>}
                
                {visibleColumns.includes('postedAt') && <th className="px-4 py-3 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-32 whitespace-nowrap bg-[var(--color-bg-tertiary)]">Posted At</th>}
                {visibleColumns.includes('postedBy') && <th className="px-4 py-3 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-24 whitespace-nowrap bg-[var(--color-bg-tertiary)]">Posted By (ID)</th>}
                {visibleColumns.includes('postedByName') && <th className="px-4 py-3 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-32 whitespace-nowrap bg-[var(--color-bg-tertiary)]">Posted By</th>}
                {visibleColumns.includes('postedByEmail') && <th className="px-4 py-3 text-left text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-40 whitespace-nowrap bg-[var(--color-bg-tertiary)]">Posted Email</th>}
                
                {visibleColumns.includes('amount') && <th className="px-4 py-3 text-right text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-28 whitespace-nowrap bg-[var(--color-bg-tertiary)]">Orig. Amount</th>}
                {visibleColumns.includes('currency') && <th className="px-4 py-3 text-right text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-24 whitespace-nowrap bg-[var(--color-bg-tertiary)]">Orig. Currency</th>}
                {visibleColumns.includes('exchangeRate') && <th className="px-4 py-3 text-right text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-24 whitespace-nowrap bg-[var(--color-bg-tertiary)]">Exch. Rate</th>}

                {visibleColumns.includes('debit') && <th className="px-4 py-3 text-right text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-28 whitespace-nowrap bg-[var(--color-bg-tertiary)]">Debit</th>}
                {visibleColumns.includes('credit') && <th className="px-4 py-3 text-right text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-28 whitespace-nowrap bg-[var(--color-bg-tertiary)]">Credit</th>}
                {selectedAccountId && visibleColumns.includes('balance') && (
                  <th className="px-4 py-3 text-right text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-32 whitespace-nowrap bg-[var(--color-bg-tertiary)]">Balance</th>
                )}
              </tr>
            </thead>
            <tbody className={`bg-[var(--color-bg-primary)] divide-y divide-[var(--color-border)] ${getFontSizeClass(fontSize)}`}>
              {loading ? (
                <tr><td colSpan={20} className="px-6 py-12 text-center text-[var(--color-text-muted)]">Loading General Ledger...</td></tr>
              ) : filteredData.length === 0 && !error ? (
                <tr><td colSpan={20} className="px-6 py-12 text-center text-[var(--color-text-muted)]">No ledger entries found. Post some vouchers to see data here.</td></tr>
              ) : (
                filteredData.map((entry) => (
                  <tr key={entry.id} className="hover:bg-[var(--color-bg-tertiary)] break-inside-avoid transition-colors">
                    {visibleColumns.includes('date') && (
                      <td className="px-4 py-2 text-[var(--color-text-secondary)] whitespace-nowrap align-top">
                        {(() => {
                          const d = entry.date as any;
                          if (!d) return '-';
                          if (typeof d === 'string') return d.split('T')[0];
                          if (d instanceof Date) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                          if (typeof d === 'object' && 'seconds' in d) {
                            const date = new Date(d.seconds * 1000);
                            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                          }
                          return String(d);
                        })()}
                      </td>
                    )}
                    
                    {visibleColumns.includes('voucherNo') && (
                      <td className="px-4 py-2 font-mono text-primary-600 font-medium whitespace-nowrap align-top">
                        {entry.voucherNo && entry.voucherNo !== 'N/A' ? entry.voucherNo : (entry.voucherId?.slice(0, 8) || '-')}
                      </td>
                    )}

                    {!selectedAccountId && visibleColumns.includes('code') && (
                      <td className="px-4 py-2 font-mono text-[var(--color-text-muted)] whitespace-nowrap align-top">{entry.accountCode || '-'}</td>
                    )}
                    {!selectedAccountId && visibleColumns.includes('account') && (
                      <td className="px-4 py-2 text-[var(--color-text-primary)] max-w-[200px] truncate align-top" title={entry.accountName}>{entry.accountName || 'Unknown Account'}</td>
                    )}
                    
                    {visibleColumns.includes('description') && (
                      <td className="px-4 py-2 text-[var(--color-text-secondary)] max-w-[300px] truncate align-top" title={entry.description}>{entry.description || '-'}</td>
                    )}

                    {/* New Metadata Columns Data */}
                    {visibleColumns.includes('createdAt') && <td className="px-4 py-2 text-[var(--color-text-muted)] whitespace-nowrap align-top">{entry.createdAt ? formatCompanyDateTime(entry.createdAt, settings) : '-'}</td>}
                    {visibleColumns.includes('createdBy') && <td className="px-4 py-2 text-[var(--color-text-muted)] font-mono text-xs max-w-[100px] truncate align-top" title={entry.createdBy}>{entry.createdBy || '-'}</td>}
                    {visibleColumns.includes('createdByName') && <td className="px-4 py-2 text-[var(--color-text-primary)] max-w-[150px] truncate align-top" title={entry.createdByEmail}>{entry.createdByName || entry.createdBy || '-'}</td>}
                    {visibleColumns.includes('createdByEmail') && <td className="px-4 py-2 text-[var(--color-text-muted)] max-w-[150px] truncate align-top" title={entry.createdByEmail}>{entry.createdByEmail || '-'}</td>}
                    
                    {visibleColumns.includes('approvedAt') && <td className="px-4 py-2 text-[var(--color-text-muted)] whitespace-nowrap align-top">{entry.approvedAt ? formatCompanyDateTime(entry.approvedAt, settings) : '-'}</td>}
                    {visibleColumns.includes('approvedBy') && <td className="px-4 py-2 text-[var(--color-text-muted)] font-mono text-xs max-w-[100px] truncate align-top" title={entry.approvedBy}>{entry.approvedBy || '-'}</td>}
                    {visibleColumns.includes('approvedByName') && <td className="px-4 py-2 text-[var(--color-text-primary)] max-w-[150px] truncate align-top" title={entry.approvedByEmail}>{entry.approvedByName || entry.approvedBy || '-'}</td>}
                    {visibleColumns.includes('approvedByEmail') && <td className="px-4 py-2 text-[var(--color-text-muted)] max-w-[150px] truncate align-top" title={entry.approvedByEmail}>{entry.approvedByEmail || '-'}</td>}
                    
                    {visibleColumns.includes('postedAt') && <td className="px-4 py-2 text-[var(--color-text-muted)] whitespace-nowrap align-top">{entry.postedAt ? formatCompanyDateTime(entry.postedAt, settings) : '-'}</td>}
                    {visibleColumns.includes('postedBy') && <td className="px-4 py-2 text-[var(--color-text-muted)] font-mono text-xs max-w-[100px] truncate align-top" title={entry.postedBy}>{entry.postedBy || '-'}</td>}
                    {visibleColumns.includes('postedByName') && <td className="px-4 py-2 text-[var(--color-text-primary)] max-w-[150px] truncate align-top" title={entry.postedByEmail}>{entry.postedByName || entry.postedBy || '-'}</td>}
                    {visibleColumns.includes('postedByEmail') && <td className="px-4 py-2 text-[var(--color-text-muted)] max-w-[150px] truncate align-top" title={entry.postedByEmail}>{entry.postedByEmail || '-'}</td>}
                    
                    {visibleColumns.includes('amount') && <td className="px-4 py-2 text-[var(--color-text-primary)] text-right font-mono whitespace-nowrap align-top">{entry.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '-'}</td>}
                    {visibleColumns.includes('currency') && <td className="px-4 py-2 text-[var(--color-text-muted)] text-right font-medium whitespace-nowrap align-top">{entry.currency || '-'}</td>}
                    {visibleColumns.includes('exchangeRate') && <td className="px-4 py-2 text-[var(--color-text-muted)] text-right font-mono text-xs whitespace-nowrap align-top">{entry.exchangeRate && entry.exchangeRate !== 1 ? entry.exchangeRate.toLocaleString(undefined, { minimumFractionDigits: 4 }) : '-'}</td>}

                    {visibleColumns.includes('debit') && (
                      <td className="px-4 py-2 text-[var(--color-text-primary)] text-right font-mono whitespace-nowrap align-top">
                        {entry.debit > 0 ? entry.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                      </td>
                    )}
                    {visibleColumns.includes('credit') && (
                      <td className="px-4 py-2 text-[var(--color-text-primary)] text-right font-mono whitespace-nowrap align-top">
                        {entry.credit > 0 ? entry.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                      </td>
                    )}
                    {selectedAccountId && visibleColumns.includes('balance') && (
                      <td className={`px-4 py-2 text-right font-mono font-bold whitespace-nowrap align-top ${(entry.runningBalance || 0) < 0 ? 'text-danger-600' : 'text-[var(--color-text-primary)]'}`}>
                        {(entry.runningBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
            {filteredData.length > 0 && (
              <tfoot className="bg-[var(--color-bg-tertiary)] font-bold border-t border-[var(--color-border)] print:bg-gray-100 sticky bottom-0 z-10 shadow-sm">
                <tr>
                  <td colSpan={
                    visibleColumns.length
                    - (selectedAccountId && visibleColumns.includes('code') ? 1 : 0)
                    - (selectedAccountId && visibleColumns.includes('account') ? 1 : 0)
                    - (visibleColumns.includes('debit') ? 1 : 0)
                    - (visibleColumns.includes('credit') ? 1 : 0)
                    - (visibleColumns.includes('balance') ? 1 : 0)
                  } className="px-4 py-3 text-right uppercase text-xs text-[var(--color-text-muted)] tracking-wider">
                    Totals ({filteredData.length} entries)
                  </td>
                  {visibleColumns.includes('debit') && (
                    <td className="px-4 py-3 text-right font-mono text-sm text-primary-700 whitespace-nowrap bg-[var(--color-bg-tertiary)]">
                      {totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}
                    </td>
                  )}
                  {visibleColumns.includes('credit') && (
                    <td className="px-4 py-3 text-right font-mono text-sm text-primary-700 whitespace-nowrap bg-[var(--color-bg-tertiary)]">
                      {totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}
                    </td>
                  )}
                  {selectedAccountId && visibleColumns.includes('balance') && (
                    <td className={`px-4 py-3 text-right font-mono text-sm font-bold whitespace-nowrap bg-[var(--color-bg-tertiary)] ${
                      (filteredData[filteredData.length - 1]?.runningBalance || 0) < 0 ? 'text-danger-700' : 'text-primary-700'
                    }`}>
                      {(filteredData[filteredData.length - 1]?.runningBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}
                    </td>
                  )}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default GeneralLedgerPage;
