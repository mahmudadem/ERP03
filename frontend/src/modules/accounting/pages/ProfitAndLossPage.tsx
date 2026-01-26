import React, { useState, useEffect } from 'react';
import { Button } from '../../../components/ui/Button';
import { accountingApi } from '../../../api/accountingApi';
import { RequirePermission } from '../../../components/auth/RequirePermission';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { formatCompanyDate, getCompanyToday } from '../../../utils/dateUtils';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { DatePicker } from '../components/shared/DatePicker';

interface ProfitAndLossData {
  revenue: number;
  expenses: number;
  netProfit: number;
  revenueByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
  expensesByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
  period: { from: string; to: string };
}

const ProfitAndLossPage: React.FC = () => {
  const { settings } = useCompanySettings();
  const { company } = useCompanyAccess();
  const baseCurrency = company?.baseCurrency || 'USD';
  const [data, setData] = useState<ProfitAndLossData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Default dates (will be refined once settings load)
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  // Sync defaults once settings load
  useEffect(() => {
    if (settings && !isInitialized) {
      const today = getCompanyToday(settings);
      const yearStart = `${today.split('-')[0]}-01-01`;
      setFromDate(yearStart);
      setToDate(today);
      setIsInitialized(true);
    }
  }, [settings, isInitialized]);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await accountingApi.getProfitAndLoss(fromDate, toDate);
      setData(response);
    } catch (err: any) {
      setError(err.message || 'Failed to load report');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const formatCurrency = (amount: number) => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: baseCurrency || 'USD',
        minimumFractionDigits: 2
      }).format(amount);
    } catch (e) {
      return `${baseCurrency} ${amount.toFixed(2)}`;
    }
  };

  const formatDate = (dateStr: string) => {
    return formatCompanyDate(dateStr, settings);
  };

  const handleExport = () => {
    if (!data) return;
    
    // Simple CSV export
    const csv = [
      ['Profit & Loss Statement'],
      [`Period: ${formatDate(data.period.from)} to ${formatDate(data.period.to)}`],
      [''],
      ['Revenue'],
      ...data.revenueByAccount.map(acc => [acc.accountName, formatCurrency(acc.amount)]),
      ['Total Revenue', formatCurrency(data.revenue)],
      [''],
      ['Expenses'],
      ...data.expensesByAccount.map(acc => [acc.accountName, formatCurrency(acc.amount)]),
      ['Total Expenses', formatCurrency(data.expenses)],
      [''],
      ['Net Profit/Loss', formatCurrency(data.netProfit)]
    ].map(row => row.join(',')).join('\\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `profit-loss-${fromDate}-${toDate}.csv`;
    a.click();
  };

  const profitMargin = data ? ((data.netProfit / data.revenue) * 100) : 0;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Profit & Loss Statement</h1>
          <p className="text-sm text-gray-500 mt-1">Revenue, Expenses, and Net Profit Analysis</p>
        </div>
        
        {data && (
          <Button onClick={handleExport} variant="secondary">
            📥 Export CSV
          </Button>
        )}
      </div>

      {/* Date Range Selector */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <DatePicker
              value={fromDate}
              onChange={(val: string) => setFromDate(val)}
            />
          </div>
          
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <DatePicker
              value={toDate}
              onChange={(val: string) => setToDate(val)}
            />
          </div>
          
          <Button onClick={loadReport} disabled={loading}>
            {loading ? 'Loading...' : 'Generate Report'}
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Report Content */}
      {data && !loading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg shadow border border-green-200">
              <div className="text-sm font-medium text-green-700 mb-1">Total Revenue</div>
              <div className="text-2xl font-bold text-green-900">{formatCurrency(data.revenue)}</div>
            </div>
            
            <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-lg shadow border border-red-200">
              <div className="text-sm font-medium text-red-700 mb-1">Total Expenses</div>
              <div className="text-2xl font-bold text-red-900">{formatCurrency(data.expenses)}</div>
            </div>
            
            <div className={`bg-gradient-to-br ${data.netProfit >= 0 ? 'from-blue-50 to-blue-100 border-blue-200' : 'from-orange-50 to-orange-100 border-orange-200'} p-6 rounded-lg shadow border`}>
              <div className={`text-sm font-medium ${data.netProfit >= 0 ? 'text-blue-700' : 'text-orange-700'} mb-1`}>
                Net {data.netProfit >= 0 ? 'Profit' : 'Loss'}
              </div>
              <div className={`text-2xl font-bold ${data.netProfit >= 0 ? 'text-blue-900' : 'text-orange-900'}`}>
                {formatCurrency(Math.abs(data.netProfit))}
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg shadow border border-purple-200">
              <div className="text-sm font-medium text-purple-700 mb-1">Profit Margin</div>
              <div className="text-2xl font-bold text-purple-900">
                {isFinite(profitMargin) ? profitMargin.toFixed(2) : '0.00'}%
              </div>
            </div>
          </div>

          {/* Detailed Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Revenue Breakdown */}
            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                Revenue Breakdown
              </h2>
              
              {data.revenueByAccount.length > 0 ? (
                <div className="space-y-2">
                  {data.revenueByAccount.map((acc, idx) => (
                    <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-700">{acc.accountName || acc.accountId}</span>
                      <span className="font-semibold text-green-600">{formatCurrency(acc.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center py-2 pt-4 border-t-2 border-green-200">
                    <span className="font-bold text-gray-900">Total</span>
                    <span className="font-bold text-green-600 text-lg">{formatCurrency(data.revenue)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No revenue data for this period</p>
              )}
            </div>

            {/* Expenses Breakdown */}
            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                Expenses Breakdown
              </h2>
              
              {data.expensesByAccount.length > 0 ? (
                <div className="space-y-2">
                  {data.expensesByAccount.map((acc, idx) => (
                    <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-700">{acc.accountName || acc.accountId}</span>
                      <span className="font-semibold text-red-600">{formatCurrency(acc.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center py-2 pt-4 border-t-2 border-red-200">
                    <span className="font-bold text-gray-900">Total</span>
                    <span className="font-bold text-red-600 text-lg">{formatCurrency(data.expenses)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No expense data for this period</p>
              )}
            </div>
          </div>

          {/* Period Info */}
          <div className="text-center text-sm text-gray-500 pt-4 border-t border-gray-200">
            Report Period: {formatDate(data.period.from)} to {formatDate(data.period.to)}
          </div>
        </>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-500">Generating report...</p>
        </div>
      )}
    </div>
  );
};

export default ProfitAndLossPage;
