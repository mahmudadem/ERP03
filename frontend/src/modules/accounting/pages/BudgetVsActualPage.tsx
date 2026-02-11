import React, { useEffect, useState } from 'react';
import { accountingApi, BudgetDTO } from '../../../api/accountingApi';

const BudgetVsActualPage: React.FC = () => {
  const [budgets, setBudgets] = useState<BudgetDTO[]>([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState('');
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    accountingApi.listBudgets().then(setBudgets);
  }, []);

  const load = async (budgetId: string) => {
    const data = await accountingApi.budgetVsActual(budgetId);
    setRows(data);
  };

  const color = (variance: number) => (variance <= 0 ? 'text-green-600' : 'text-red-600');

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <select
          className="border rounded px-3 py-2"
          value={selectedBudgetId}
          onChange={(e) => {
            setSelectedBudgetId(e.target.value);
            if (e.target.value) load(e.target.value);
          }}
        >
          <option value="">Select Budget</option>
          {budgets.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} (v{b.version}) — {b.status}
            </option>
          ))}
        </select>
      </div>

      <table className="w-full text-sm border">
        <thead>
          <tr className="bg-gray-50">
            <th className="p-2 text-left">Account</th>
            <th className="p-2 text-right">Budget</th>
            <th className="p-2 text-right">Actual</th>
            <th className="p-2 text-right">Variance</th>
            <th className="p-2 text-right">Variance %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.accountId}-${r.costCenterId || 'all'}`} className="border-t">
              <td className="p-2">
                {r.accountId}
                {r.costCenterId ? ` · CC ${r.costCenterId}` : ''}
              </td>
              <td className="p-2 text-right">{r.budget.toLocaleString()}</td>
              <td className="p-2 text-right">{r.actual.toLocaleString()}</td>
              <td className={`p-2 text-right ${color(r.variance)}`}>{r.variance.toLocaleString()}</td>
              <td className={`p-2 text-right ${color(r.variance)}`}>{r.variancePct.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default BudgetVsActualPage;
