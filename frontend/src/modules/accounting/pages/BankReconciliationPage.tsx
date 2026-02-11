import React, { useEffect, useMemo, useState } from 'react';
import { accountingApi, AccountDTO, BankStatementDTO, BankStatementLineDTO } from '../../../api/accountingApi';

const fmt = (amount: number, currency?: string) =>
  `${currency ? currency + ' ' : ''}${(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const BankReconciliationPage: React.FC = () => {
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [accountId, setAccountId] = useState('');
  const [statement, setStatement] = useState<BankStatementDTO | null>(null);
  const [unreconciled, setUnreconciled] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    accountingApi.getAccounts().then(setAccounts);
  }, []);

  const bankAccounts = useMemo(
    () => accounts.filter((a) => ['BANK', 'CASH'].includes((a.accountRole || '').toUpperCase())),
    [accounts]
  );

  const refresh = async (accountIdValue: string) => {
    if (!accountIdValue) return;
    const data = await accountingApi.getReconciliation(accountIdValue);
    setStatement(data.statement || null);
    setUnreconciled(data.unreconciledLedger || []);
  };

  const handleImport = async () => {
    if (!file || !accountId) return;
    setLoading(true);
    setMessage(null);
    const text = await file.text();
    try {
      const imported = await accountingApi.importBankStatement({
        accountId,
        bankName: file.name,
        statementDate: new Date().toISOString().slice(0, 10),
        format: file.name.toLowerCase().endsWith('.ofx') ? 'ofx' : 'csv',
        content: text
      });
      setStatement(imported);
      setMessage('Statement imported and auto-matched');
      refresh(accountId);
    } catch (e: any) {
      setMessage(e?.message || 'Failed to import');
    } finally {
      setLoading(false);
    }
  };

  const handleMatch = async (line: BankStatementLineDTO, ledgerId: string) => {
    await accountingApi.manualMatch({ statementId: statement!.id, lineId: line.id, ledgerEntryId: ledgerId });
    await refresh(accountId);
  };

  const handleComplete = async () => {
    if (!statement) return;
    await accountingApi.completeReconciliation(accountId, { statementId: statement.id, adjustments: [] });
    setMessage('Reconciliation completed');
    await refresh(accountId);
  };

  const bankBalance = useMemo(() => {
    if (!statement) return 0;
    const last = [...statement.lines].reverse().find((l) => typeof l.balance === 'number');
    if (last?.balance !== undefined) return last.balance;
    return statement.lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  }, [statement]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <select
          className="border rounded px-3 py-2"
          value={accountId}
          onChange={(e) => {
            setAccountId(e.target.value);
            refresh(e.target.value);
          }}
        >
          <option value="">Select bank account</option>
          {bankAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.userCode} — {a.name} ({a.fixedCurrencyCode || a.currency || ''})
            </option>
          ))}
        </select>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <button className="btn btn-primary" disabled={!file || !accountId || loading} onClick={handleImport}>
          {loading ? 'Importing...' : 'Import Statement'}
        </button>
        <button className="btn btn-secondary" disabled={!statement} onClick={handleComplete}>
          Complete Reconciliation
        </button>
      </div>

      {message && <div className="p-3 bg-blue-50 border border-blue-200 rounded">{message}</div>}

      {statement && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="font-semibold mb-2">Bank Statement</h3>
            <table className="w-full text-sm border">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Description</th>
                  <th className="p-2 text-right">Amount</th>
                  <th className="p-2">Match</th>
                </tr>
              </thead>
              <tbody>
                {statement.lines.map((line) => (
                  <tr key={line.id} className="border-t">
                    <td className="p-2">{line.date}</td>
                    <td className="p-2">{line.description}</td>
                    <td className="p-2 text-right">{fmt(line.amount)}</td>
                    <td className="p-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            line.matchStatus === 'UNMATCHED'
                              ? 'text-red-500'
                              : line.matchStatus === 'AUTO_MATCHED'
                              ? 'text-amber-600'
                              : 'text-green-600'
                          }
                        >
                          {line.matchStatus.replace('_', ' ')}
                        </span>
                        {line.matchStatus === 'UNMATCHED' && (
                          <select
                            className="border rounded px-2 py-1"
                            onChange={(e) => handleMatch(line, e.target.value)}
                          >
                            <option value="">Match…</option>
                            {unreconciled.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.date} · {l.notes || l.description || ''} · {fmt(l.amount, l.currency)}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Book Entries (unreconciled)</h3>
            <table className="w-full text-sm border">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Description</th>
                  <th className="p-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {unreconciled.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="p-2">{typeof l.date === 'string' ? l.date : ''}</td>
                    <td className="p-2">{l.notes || l.description || ''}</td>
                    <td className="p-2 text-right">{fmt(l.amount, l.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 text-sm">
              Bank balance: {fmt(bankBalance)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankReconciliationPage;
