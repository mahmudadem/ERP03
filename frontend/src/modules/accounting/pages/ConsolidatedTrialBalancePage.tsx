import React, { useEffect, useState } from 'react';
import { accountingApi, CompanyGroupDTO, ConsolidatedTrialBalanceDTO } from '../../../api/accountingApi';

const ConsolidatedTrialBalancePage: React.FC = () => {
  const [groups, setGroups] = useState<CompanyGroupDTO[]>([]);
  const [groupId, setGroupId] = useState('');
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<ConsolidatedTrialBalanceDTO | null>(null);

  useEffect(() => {
    accountingApi.listCompanyGroups().then(setGroups);
  }, []);

  const load = async () => {
    if (!groupId) return;
    const res = await accountingApi.getConsolidatedTrialBalance(groupId, asOfDate);
    setData(res);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <select className="border rounded px-3 py-2" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">Select Group</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name} ({g.reportingCurrency})</option>
          ))}
        </select>
        <input type="date" className="border rounded px-3 py-2" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
        <button className="btn btn-primary" onClick={load}>Load</button>
      </div>

      {data && (
        <div className="border rounded overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-2 text-left">Account</th>
                <th className="p-2 text-right">Debit ({data.reportingCurrency})</th>
                <th className="p-2 text-right">Credit ({data.reportingCurrency})</th>
                <th className="p-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((l) => (
                <tr key={l.accountId} className="border-t">
                  <td className="p-2">{l.accountCode} — {l.accountName}</td>
                  <td className="p-2 text-right">{l.debit.toLocaleString()}</td>
                  <td className="p-2 text-right">{l.credit.toLocaleString()}</td>
                  <td className="p-2 text-right font-semibold">{l.balance.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                <td className="p-2">Totals</td>
                <td className="p-2 text-right">{data.totals.debit.toLocaleString()}</td>
                <td className="p-2 text-right">{data.totals.credit.toLocaleString()}</td>
                <td className="p-2 text-right">{data.totals.balance.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

export default ConsolidatedTrialBalancePage;
