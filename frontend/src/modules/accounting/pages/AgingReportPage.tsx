import React, { useEffect, useMemo, useState } from 'react';
import { accountingApi, AgingReportData } from '../../../api/accountingApi';

const bucketColors = ['text-green-700', 'text-green-600', 'text-amber-600', 'text-amber-700', 'text-orange-700', 'text-red-700'];

const AgingReportPage: React.FC = () => {
  const [type, setType] = useState<'AR' | 'AP'>('AR');
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<AgingReportData | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    const result = await accountingApi.getAgingReport(type, asOfDate);
    setData(result);
  };

  useEffect(() => {
    load();
  }, []); // initial load

  const totalsRow = useMemo(() => data?.totals || [], [data]);

  const toggle = (id: string) => setExpanded((prev) => (prev === id ? null : id));

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <select className="border rounded px-3 py-2" value={type} onChange={(e) => setType(e.target.value as any)}>
          <option value="AR">Accounts Receivable</option>
          <option value="AP">Accounts Payable</option>
        </select>
        <input type="date" className="border rounded px-3 py-2" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
        <button className="btn btn-primary" onClick={load}>Load</button>
      </div>

      <div className="border rounded overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-2 text-left">Account</th>
              {data?.buckets.map((b, i) => (
                <th key={b} className="p-2 text-right">{b}</th>
              ))}
              <th className="p-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {data?.accounts.map((acc) => (
              <React.Fragment key={acc.accountId}>
                <tr className="border-t cursor-pointer hover:bg-gray-50" onClick={() => toggle(acc.accountId)}>
                  <td className="p-2">{acc.accountCode} — {acc.accountName}</td>
                  {acc.bucketAmounts.map((amt, idx) => (
                    <td key={idx} className={`p-2 text-right ${bucketColors[idx]}`}>{amt.toLocaleString()}</td>
                  ))}
                  <td className="p-2 text-right font-semibold">{acc.total.toLocaleString()}</td>
                </tr>
                {expanded === acc.accountId && acc.entries && (
                  <tr className="bg-gray-50">
                    <td colSpan={(data?.buckets.length || 0) + 2} className="p-2">
                      <div className="text-xs font-semibold mb-1">Transactions</div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr>
                            <th className="text-left py-1">Date</th>
                            <th className="text-left py-1">Description</th>
                            <th className="text-right py-1">Amount</th>
                            <th className="text-right py-1">Days</th>
                          </tr>
                        </thead>
                        <tbody>
                          {acc.entries.map((e) => (
                            <tr key={e.id}>
                              <td className="py-1">{e.date}</td>
                              <td className="py-1">{e.description}</td>
                              <td className="py-1 text-right">{e.amount.toLocaleString()}</td>
                              <td className="py-1 text-right">{e.days}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
          {data && (
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                <td className="p-2">Totals</td>
                {totalsRow.map((t, idx) => (
                  <td key={idx} className="p-2 text-right">{t.toLocaleString()}</td>
                ))}
                <td className="p-2 text-right">{data.grandTotal.toLocaleString()}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

export default AgingReportPage;
