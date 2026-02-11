import React, { useEffect, useMemo, useState } from 'react';
import { accountingApi, BudgetDTO, BudgetLineDTO } from '../../../api/accountingApi';

const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const emptyLine = (): BudgetLineDTO => ({
  accountId: '',
  costCenterId: undefined,
  monthlyAmounts: Array(12).fill(0),
  annualTotal: 0
});

const BudgetPage: React.FC = () => {
  const [budgets, setBudgets] = useState<BudgetDTO[]>([]);
  const [selected, setSelected] = useState<BudgetDTO | null>(null);
  const [lines, setLines] = useState<BudgetLineDTO[]>([emptyLine()]);
  const [name, setName] = useState('');
  const [fiscalYearId, setFiscalYearId] = useState('');
  const [version, setVersion] = useState(1);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, []);

  const refresh = async () => {
    const data = await accountingApi.listBudgets();
    setBudgets(data);
  };

  const recalcLine = (idx: number, updater: (l: BudgetLineDTO) => BudgetLineDTO) => {
    setLines((prev) => {
      const next = [...prev];
      const updated = updater(prev[idx]);
      const total = updated.monthlyAmounts.reduce((s, v) => s + Number(v || 0), 0);
      next[idx] = { ...updated, annualTotal: total };
      return next;
    });
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);

  const save = async () => {
    const payload = { fiscalYearId, name, version, lines };
    const saved = await accountingApi.createBudget(payload);
    setStatusMessage('Budget saved');
    setSelected(saved);
    refresh();
  };

  const approve = async (id: string) => {
    await accountingApi.approveBudget(id);
    setStatusMessage('Budget approved');
    refresh();
  };

  const totalBudget = useMemo(
    () => lines.reduce((s, l) => s + (l.annualTotal || 0), 0),
    [lines]
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <input className="border rounded px-3 py-2" placeholder="Fiscal Year Id" value={fiscalYearId} onChange={(e) => setFiscalYearId(e.target.value)} />
        <input className="border rounded px-3 py-2" placeholder="Budget Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="border rounded px-3 py-2 w-24" type="number" min={1} value={version} onChange={(e) => setVersion(Number(e.target.value))} />
        <button className="btn btn-primary" onClick={save}>Save Budget</button>
      </div>

      {statusMessage && <div className="p-2 bg-green-50 border border-green-200 rounded">{statusMessage}</div>}

      <div className="border rounded overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-2 text-left w-40">Account ID</th>
              <th className="p-2 text-left w-32">Cost Center</th>
              {months.map((m) => (
                <th key={m} className="p-2 text-right">{m}</th>
              ))}
              <th className="p-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} className="border-t">
                <td className="p-2">
                  <input className="border rounded px-2 py-1 w-full" value={line.accountId} onChange={(e) => recalcLine(idx, (l) => ({ ...l, accountId: e.target.value }))} />
                </td>
                <td className="p-2">
                  <input className="border rounded px-2 py-1 w-full" value={line.costCenterId || ''} onChange={(e) => recalcLine(idx, (l) => ({ ...l, costCenterId: e.target.value || undefined }))} />
                </td>
                {line.monthlyAmounts.map((val, mIdx) => (
                  <td key={mIdx} className="p-1">
                    <input
                      type="number"
                      className="border rounded px-2 py-1 w-full text-right"
                      value={val}
                      onChange={(e) =>
                        recalcLine(idx, (l) => {
                          const arr = [...l.monthlyAmounts];
                          arr[mIdx] = Number(e.target.value);
                          return { ...l, monthlyAmounts: arr };
                        })
                      }
                    />
                  </td>
                ))}
                <td className="p-2 text-right font-semibold">{line.annualTotal.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-2 flex justify-between items-center">
          <button className="btn btn-secondary" onClick={addLine}>Add Line</button>
          <div className="text-right font-semibold">Budget Total: {totalBudget.toLocaleString()}</div>
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Existing Budgets</h3>
        <table className="w-full text-sm border">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Fiscal Year</th>
              <th className="p-2 text-left">Version</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {budgets.map((b) => (
              <tr key={b.id} className="border-t">
                <td className="p-2">{b.name}</td>
                <td className="p-2">{b.fiscalYearId}</td>
                <td className="p-2">{b.version}</td>
                <td className="p-2">{b.status}</td>
                <td className="p-2 space-x-2">
                  <button className="btn btn-link" onClick={() => { setSelected(b); setLines(b.lines); setName(b.name); setFiscalYearId(b.fiscalYearId); setVersion(b.version); }}>Edit</button>
                  {b.status !== 'APPROVED' && (
                    <button className="btn btn-link text-green-600" onClick={() => approve(b.id)}>Approve</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BudgetPage;
