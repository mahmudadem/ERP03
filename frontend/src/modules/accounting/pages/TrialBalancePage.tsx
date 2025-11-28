
import React, { useEffect, useState } from 'react';
import { accountingApi, TrialBalanceLine } from '../../../api/accountingApi';
import { Button } from '../../../components/ui/Button';

const TrialBalancePage: React.FC = () => {
  const [data, setData] = useState<TrialBalanceLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await accountingApi.getTrialBalance();
      setData(result);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load report. Please try again.');
      // Remove demo fallback to ensure we see real errors in production
      setData([]); 
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const totalDebit = data.reduce((acc, row) => acc + row.totalDebit, 0);
  const totalCredit = data.reduce((acc, row) => acc + row.totalCredit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-20 print:pb-0">
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Trial Balance</h1>
          <p className="text-sm text-gray-500 mt-1">Financial Position Overview</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handlePrint} variant="secondary">Print / PDF</Button>
          <Button onClick={fetchReport} variant="primary">Refresh</Button>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Trial Balance Report</h1>
        <p className="text-sm text-gray-600">Generated on {new Date().toLocaleDateString()}</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded border border-red-200">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden print:shadow-none print:border">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 print:bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-24">Code</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Account Name</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-24">Type</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Debit</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Credit</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Net Balance</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">Loading Report...</td></tr>
              ) : data.length === 0 && !error ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">No transactions found for this period.</td></tr>
              ) : (
                data.map((row) => (
                  <tr key={row.accountId} className="hover:bg-gray-50 break-inside-avoid">
                    <td className="px-6 py-3 text-sm font-mono text-gray-600 font-medium">{row.code}</td>
                    <td className="px-6 py-3 text-sm text-gray-900">{row.name}</td>
                    <td className="px-6 py-3 text-xs text-gray-500 uppercase">{row.type}</td>
                    <td className="px-6 py-3 text-sm text-gray-800 text-right font-mono">
                      {row.totalDebit > 0 ? row.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-800 text-right font-mono">
                      {row.totalCredit > 0 ? row.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                    </td>
                    <td className={`px-6 py-3 text-sm font-bold text-right font-mono ${row.netBalance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      {row.netBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {data.length > 0 && (
              <tfoot className="bg-gray-50 font-bold border-t border-gray-200 print:bg-gray-100">
                 <tr>
                    <td colSpan={3} className="px-6 py-3 text-right uppercase text-xs text-gray-500 tracking-wider">Totals</td>
                    <td className="px-6 py-3 text-right font-mono text-sm text-blue-900">
                      {totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-3 text-right font-mono text-sm text-blue-900">
                      {totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-3 text-center">
                      {!isBalanced && <span className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded">UNBALANCED</span>}
                    </td>
                 </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default TrialBalancePage;
