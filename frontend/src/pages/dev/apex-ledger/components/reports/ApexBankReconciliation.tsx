import React, { useState, useEffect, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileText,
  Check,
  CheckCheck,
  AlertTriangle,
  Landmark,
} from 'lucide-react';
import {
  accountingApi,
  AccountDTO,
  BankStatementDTO,
  BankStatementLineDTO,
} from '../../../../../api/accountingApi';

// ─── helpers ────────────────────────────────────────────────────────────────

const fmt = (amount: number) =>
  amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type MatchStatus = 'UNMATCHED' | 'AUTO_MATCHED' | 'MANUAL_MATCHED';

interface LedgerEntry {
  id: string;
  date?: string;
  amount?: number;
  side?: string;
  notes?: string;
  description?: string;
  voucherId?: string;
  currency?: string;
}

// ─── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  switch (status as MatchStatus) {
    case 'MANUAL_MATCHED':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-2.5 h-2.5" />
          Matched
        </span>
      );
    case 'AUTO_MATCHED':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
          <RefreshCw className="w-2.5 h-2.5" />
          Auto-matched
        </span>
      );
    case 'UNMATCHED':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <AlertCircle className="w-2.5 h-2.5" />
          Unmatched
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600">
          {status}
        </span>
      );
  }
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function ApexBankReconciliation() {
  // Filter state
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState('');

  // Reconciliation data
  const [statement, setStatement] = useState<BankStatementDTO | null>(null);
  const [unreconciled, setUnreconciled] = useState<LedgerEntry[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  // File import
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load bank/cash accounts
  useEffect(() => {
    accountingApi
      .getAccounts()
      .then((data) => setAccounts(data || []))
      .catch(() => toast.error('Failed to load accounts'))
      .finally(() => setAccountsLoading(false));
  }, []);

  const bankAccounts = useMemo(
    () => accounts.filter((a) => ['BANK', 'CASH'].includes((a.accountRole || '').toUpperCase())),
    [accounts],
  );

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId),
    [accounts, selectedAccountId],
  );

  // Load reconciliation data
  const loadReconciliation = useCallback(async (accountId: string) => {
    if (!accountId) return;
    setDataLoading(true);
    try {
      const data = await accountingApi.getReconciliation(accountId);
      setStatement(data.statement || null);
      setUnreconciled(data.unreconciledLedger || []);
    } catch {
      toast.error('Failed to load reconciliation data');
    } finally {
      setDataLoading(false);
    }
  }, []);

  const handleLoad = () => {
    if (!selectedAccountId) return;
    setStatement(null);
    setUnreconciled([]);
    setFile(null);
    setGenerated(true);
    loadReconciliation(selectedAccountId);
  };

  // Import bank statement
  const handleImport = async () => {
    if (!file || !selectedAccountId) return;
    setIsProcessing(true);
    try {
      const text = await file.text();
      const imported = await accountingApi.importBankStatement({
        accountId: selectedAccountId,
        bankName: file.name,
        statementDate: new Date().toISOString().slice(0, 10),
        format: file.name.toLowerCase().endsWith('.ofx') ? 'ofx' : 'csv',
        content: text,
      });
      setStatement(imported);
      toast.success('Bank statement imported successfully');
      await loadReconciliation(selectedAccountId);
      setFile(null);
    } catch {
      toast.error('Failed to import bank statement');
    } finally {
      setIsProcessing(false);
    }
  };

  // Match a line
  const handleMatch = async (line: BankStatementLineDTO, ledgerEntryId: string) => {
    if (!ledgerEntryId || !statement) return;
    setIsProcessing(true);
    try {
      await accountingApi.manualMatch({ statementId: statement.id, lineId: line.id, ledgerEntryId });
      toast.success('Entry matched');
      await loadReconciliation(selectedAccountId);
    } catch {
      toast.error('Failed to match entry');
    } finally {
      setIsProcessing(false);
    }
  };

  // Complete reconciliation
  const handleComplete = async () => {
    if (!statement) return;
    setIsProcessing(true);
    try {
      await accountingApi.completeReconciliation(selectedAccountId, {
        statementId: statement.id,
        adjustments: [],
      });
      toast.success('Reconciliation completed successfully');
      await loadReconciliation(selectedAccountId);
    } catch {
      toast.error('Failed to complete reconciliation');
    } finally {
      setIsProcessing(false);
    }
  };

  const bankBalance = useMemo(() => {
    if (!statement) return 0;
    const lastWithBal = [...statement.lines].reverse().find((l) => typeof l.balance === 'number');
    if (lastWithBal?.balance !== undefined) return lastWithBal.balance;
    return statement.lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  }, [statement]);

  const allMatched = useMemo(
    () =>
      !!statement &&
      statement.lines.length > 0 &&
      statement.lines.every(
        (l) => l.matchStatus === 'MANUAL_MATCHED' || l.matchStatus === 'AUTO_MATCHED',
      ),
    [statement],
  );

  const unmatchedCount = useMemo(
    () => (statement ? statement.lines.filter((l) => l.matchStatus === 'UNMATCHED').length : 0),
    [statement],
  );

  return (
    <div className="space-y-4 font-sans">
      {/* ── Filter bar ── */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Account selector */}
          <div className="flex-1 min-w-[240px]">
            <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">
              Bank / Cash Account
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              disabled={accountsLoading}
              className="w-full bg-white border border-[#E2E8F0] rounded px-3 py-1.5 text-xs font-semibold outline-none text-slate-800 disabled:opacity-60"
            >
              <option value="">Select bank account…</option>
              {bankAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.userCode} — {a.name}
                  {a.fixedCurrencyCode ? ` (${a.fixedCurrencyCode})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Load button */}
          <button
            onClick={handleLoad}
            disabled={!selectedAccountId || dataLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {dataLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Landmark className="w-3.5 h-3.5" />}
            Load Reconciliation
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
      {generated && (
        <>
          {/* Account info + action bar */}
          <div className="bg-white border border-[#E2E8F0] rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <Landmark className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {selectedAccount ? `${selectedAccount.userCode} — ${selectedAccount.name}` : selectedAccountId}
                </p>
                {statement && (
                  <p className="text-[10px] text-slate-400 font-mono">
                    Statement: {statement.bankName} · {statement.statementDate}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Import file */}
              {!statement && (
                <>
                  <label className="flex items-center gap-2 px-3 py-1.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 rounded text-xs font-semibold text-slate-700 cursor-pointer">
                    <FileText className="w-3.5 h-3.5" />
                    {file ? file.name : 'Choose OFX / CSV'}
                    <input
                      type="file"
                      className="hidden"
                      accept=".csv,.ofx"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                  </label>
                  <button
                    onClick={handleImport}
                    disabled={!file || isProcessing}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isProcessing ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    Import
                  </button>
                </>
              )}

              {/* Complete reconciliation */}
              {statement && (
                <button
                  onClick={handleComplete}
                  disabled={!allMatched || isProcessing}
                  title={!allMatched ? 'All statement lines must be matched first' : ''}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
                    allMatched
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {isProcessing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  Complete Reconciliation
                </button>
              )}
            </div>
          </div>

          {/* Loading state */}
          {dataLoading ? (
            <div className="bg-white border border-[#E2E8F0] rounded-lg p-16 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 text-slate-300 animate-spin" />
              <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                Loading reconciliation data…
              </p>
            </div>
          ) : !statement ? (
            /* No statement — import prompt */
            <div className="bg-white border border-[#E2E8F0] rounded-lg p-12 flex flex-col items-center justify-center gap-4 max-w-lg mx-auto">
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center">
                <Upload className="w-7 h-7 text-blue-600" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-800 mb-1">Import Bank Statement</p>
                <p className="text-xs text-slate-500">
                  Upload a bank statement file (OFX, QFX, or CSV) to begin reconciliation.
                </p>
              </div>
              <div className="w-full bg-[#FAFAFB] border border-[#E2E8F0] rounded-lg p-4 text-[10px] font-mono text-slate-500 space-y-1">
                <p className="font-bold text-slate-600">Supported formats:</p>
                <p>• .OFX or .QFX — bank export</p>
                <p>• .CSV — date, description, amount, reference, balance</p>
              </div>
            </div>
          ) : (
            /* Two-column reconciliation view */
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* ─ Bank Statement ─ */}
              <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                      Bank Statement
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {unmatchedCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        {unmatchedCount} unmatched
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 font-mono">
                      {statement.statementDate}
                    </span>
                  </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                        <th className="px-4 py-2 text-left text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                          Date
                        </th>
                        <th className="px-4 py-2 text-left text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                          Description
                        </th>
                        <th className="px-4 py-2 text-right text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                          Amount
                        </th>
                        <th className="px-4 py-2 text-left text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest w-52">
                          Status / Match
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {statement.lines.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                            No transactions in imported statement
                          </td>
                        </tr>
                      ) : (
                        statement.lines.map((line, idx) => (
                          <tr
                            key={line.id}
                            className={`border-b border-[#E2E8F0] hover:bg-slate-50/50 ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFB]'
                            }`}
                          >
                            <td className="px-4 py-2 font-mono text-slate-600 whitespace-nowrap">
                              {line.date}
                            </td>
                            <td className="px-4 py-2 text-slate-700">
                              {line.description}
                              {line.reference && (
                                <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                                  Ref: {line.reference}
                                </div>
                              )}
                            </td>
                            <td
                              className={`px-4 py-2 text-right font-mono font-bold ${
                                line.amount < 0 ? 'text-red-600' : 'text-slate-800'
                              }`}
                            >
                              {fmt(line.amount)}
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex flex-col gap-1.5">
                                <StatusBadge status={line.matchStatus} />
                                {line.matchStatus === 'UNMATCHED' && (
                                  <select
                                    className="w-full bg-white border border-[#E2E8F0] rounded px-2 py-1 text-[10px] font-semibold outline-none text-slate-700 disabled:opacity-60"
                                    value=""
                                    onChange={(e) => handleMatch(line, e.target.value)}
                                    disabled={isProcessing}
                                  >
                                    <option value="" disabled>
                                      Match with ledger…
                                    </option>
                                    {unreconciled.length === 0 && (
                                      <option disabled>No unreconciled entries</option>
                                    )}
                                    {unreconciled.map((entry) => (
                                      <option key={entry.id} value={entry.id}>
                                        {entry.date} ·{' '}
                                        {fmt(
                                          Number(entry.amount) * (entry.side === 'Credit' ? -1 : 1),
                                        )}{' '}
                                        · {entry.notes || entry.description || 'No description'}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer — bank balance */}
                <div className="px-4 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between">
                  <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                    Ending Bank Balance
                  </span>
                  <span className="text-sm font-mono font-bold text-slate-800">{fmt(bankBalance)}</span>
                </div>
              </div>

              {/* ─ Unreconciled Ledger ─ */}
              <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                      Unreconciled Ledger Entries
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">{unreconciled.length} items</span>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                        <th className="px-4 py-2 text-left text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                          Date
                        </th>
                        <th className="px-4 py-2 text-left text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                          Voucher / Description
                        </th>
                        <th className="px-4 py-2 text-right text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                          Amount (Net)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {unreconciled.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-12 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <CheckCheck className="w-10 h-10 text-emerald-200" />
                              <p className="text-xs font-semibold text-slate-600">
                                All ledger entries are matched
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        unreconciled.map((entry, idx) => {
                          const netAmt = Number(entry.amount) * (entry.side === 'Credit' ? -1 : 1);
                          return (
                            <tr
                              key={entry.id}
                              className={`border-b border-[#E2E8F0] hover:bg-slate-50/50 ${
                                idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFB]'
                              }`}
                            >
                              <td className="px-4 py-2 font-mono text-slate-600 whitespace-nowrap">
                                {entry.date || '—'}
                              </td>
                              <td className="px-4 py-2 text-slate-700">
                                {entry.notes || entry.description || (
                                  <span className="text-slate-400 italic">No description</span>
                                )}
                                {entry.voucherId && (
                                  <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                                    {entry.voucherId.slice(0, 8)}…
                                  </div>
                                )}
                              </td>
                              <td
                                className={`px-4 py-2 text-right font-mono font-bold ${
                                  netAmt < 0 ? 'text-red-600' : 'text-slate-800'
                                }`}
                              >
                                {fmt(netAmt)}
                                {entry.currency ? (
                                  <span className="text-[9px] text-slate-400 ml-1">{entry.currency}</span>
                                ) : null}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer note */}
                <div className="px-4 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center gap-2">
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                  <span className="text-[9px] font-mono text-slate-400">
                    Only unreconciled entries are shown
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty / initial state */}
      {!generated && (
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-16 flex flex-col items-center justify-center gap-3 text-center">
          <Landmark className="w-10 h-10 text-slate-200" />
          <p className="text-sm font-bold text-slate-400">Select a bank account and click Load</p>
          <p className="text-xs text-slate-400">
            You can then import a bank statement and match it against ledger entries.
          </p>
        </div>
      )}
    </div>
  );
}
