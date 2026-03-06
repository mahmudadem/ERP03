import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  Upload,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  FileText,
  Check,
  AlertTriangle,
  CircleDashed,
  CheckCheck,
} from 'lucide-react';
import { ReportContainer } from '../../../components/reports/ReportContainer';
import { Button } from '../../../components/ui/Button';
import { accountingApi, AccountDTO, BankStatementDTO, BankStatementLineDTO } from '../../../api/accountingApi';
import { errorHandler } from '../../../services/errorHandler';
import { formatCompanyDate } from '../../../utils/dateUtils';
import { useCompanySettings } from '../../../hooks/useCompanySettings';

interface BankReconciliationParams {
  accountId: string;
}

const fmt = (amount: number, currency?: string) =>
  `${currency ? `${currency} ` : ''}${(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const BankReconciliationInitiator: React.FC<{
  onSubmit: (params: BankReconciliationParams) => void;
  initialParams?: BankReconciliationParams | null;
}> = ({ onSubmit, initialParams }) => {
  const { t } = useTranslation('accounting');
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [accountId, setAccountId] = useState(initialParams?.accountId || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!initialParams) {
      setAccountId('');
    } else {
      setAccountId(initialParams.accountId);
    }
  }, [initialParams]);

  useEffect(() => {
    const loadAccounts = async () => {
      setLoading(true);
      try {
        const response = await accountingApi.getAccounts();
        setAccounts(response || []);
      } catch (err) {
        errorHandler.showError(err);
      } finally {
        setLoading(false);
      }
    };
    loadAccounts();
  }, []);

  const bankAccounts = useMemo(
    () => accounts.filter((a) => ['BANK', 'CASH'].includes((a.accountRole || '').toUpperCase())),
    [accounts]
  );

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!accountId) return;
        onSubmit({ accountId });
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div className="md:col-span-2">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            {t('bankRec.selectAccount', { defaultValue: 'Select Bank Account' })}
          </label>
          <select
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            disabled={loading}
          >
            <option value="">{t('bankRec.selectAccount', { defaultValue: 'Select Bank Account' })}</option>
            {bankAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.userCode} - {account.name} ({account.fixedCurrencyCode || account.currency || 'USD'})
              </option>
            ))}
          </select>
        </div>
        <div>
          <Button type="submit" disabled={!accountId} className="bg-slate-900 hover:bg-black text-white">
            {t('consolidated.load', { defaultValue: 'Load' })}
          </Button>
        </div>
      </div>
    </form>
  );
};

const BankReconciliationReportContent: React.FC<{ params: BankReconciliationParams }> = ({ params }) => {
  const { t } = useTranslation('accounting');
  const { settings } = useCompanySettings();
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [statement, setStatement] = useState<BankStatementDTO | null>(null);
  const [unreconciled, setUnreconciled] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const selectedAccountId = params.accountId;

  const refresh = async (targetAccountId: string) => {
    if (!targetAccountId) return;
    setLoading(true);
    try {
      const data = await accountingApi.getReconciliation(targetAccountId);
      setStatement(data.statement || null);
      setUnreconciled(data.unreconciledLedger || []);
    } catch (err) {
      errorHandler.showError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    accountingApi.getAccounts().then(setAccounts).catch((err) => errorHandler.showError(err));
  }, []);

  useEffect(() => {
    setStatement(null);
    setUnreconciled([]);
    setFile(null);
    if (selectedAccountId) {
      refresh(selectedAccountId);
    }
  }, [selectedAccountId]);

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
      toast.success(t('bankRec.importSuccess', { defaultValue: 'Bank statement imported successfully.' }));
      await refresh(selectedAccountId);
      setFile(null);
    } catch (err) {
      errorHandler.showError(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMatch = async (line: BankStatementLineDTO, ledgerId: string) => {
    if (!ledgerId || !statement) return;
    setIsProcessing(true);
    try {
      await accountingApi.manualMatch({ statementId: statement.id, lineId: line.id, ledgerEntryId: ledgerId });
      await refresh(selectedAccountId);
    } catch (err) {
      errorHandler.showError(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleComplete = async () => {
    if (!statement) return;
    setIsProcessing(true);
    try {
      await accountingApi.completeReconciliation(selectedAccountId, { statementId: statement.id, adjustments: [] });
      toast.success(t('bankRec.completed', { defaultValue: 'Reconciliation completed successfully.' }));
      await refresh(selectedAccountId);
    } catch (err) {
      errorHandler.showError(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const bankBalance = useMemo(() => {
    if (!statement) return 0;
    const lastWithBalance = [...statement.lines].reverse().find((line) => typeof line.balance === 'number');
    if (lastWithBalance?.balance !== undefined) return lastWithBalance.balance;
    return statement.lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
  }, [statement]);

  const allMatched = useMemo(() => {
    if (!statement) return false;
    return statement.lines.every(
      (line) => line.matchStatus === 'MANUAL_MATCHED' || line.matchStatus === 'AUTO_MATCHED'
    );
  }, [statement]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'MANUAL_MATCHED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-green-100 text-green-700">
            <CheckCircle2 className="w-3 h-3" />
            {t('bankRec.status.matched', { defaultValue: 'Matched' })}
          </span>
        );
      case 'AUTO_MATCHED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
            <RefreshCw className="w-3 h-3" />
            {t('bankRec.status.auto_matched', { defaultValue: 'Auto matched' })}
          </span>
        );
      case 'UNMATCHED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
            <AlertCircle className="w-3 h-3" />
            {t('bankRec.status.unmatched', { defaultValue: 'Unmatched' })}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const selectedAccountDetails = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId),
    [accounts, selectedAccountId]
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      <div className="shrink-0 px-6 py-4 bg-white border-b border-slate-200 dark:bg-slate-900 dark:border-slate-700">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="text-sm text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-slate-100">{selectedAccountDetails?.name || selectedAccountId}</span>
          </div>
          <div className="flex items-center gap-3">
            {!statement && (
              <>
                <label className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded cursor-pointer transition text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700">
                  <FileText className="w-4 h-4" />
                  <span>{file ? file.name : t('bankRec.chooseFile', { defaultValue: 'Choose OFX/CSV' })}</span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".csv,.ofx"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </label>
                <button
                  className="flex items-center gap-2 bg-slate-900 hover:bg-black text-white px-4 py-2 rounded text-sm font-bold uppercase tracking-wider transition disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!file || isProcessing}
                  onClick={handleImport}
                >
                  {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {t('bankRec.import', { defaultValue: 'Import' })}
                </button>
              </>
            )}
            {statement && (
              <button
                className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-bold uppercase tracking-wider transition ${
                  allMatched
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-700 dark:text-slate-500'
                }`}
                disabled={!allMatched || isProcessing}
                onClick={handleComplete}
                title={
                  !allMatched
                    ? t('bankRec.completeHint', {
                        defaultValue: 'All statement lines must be matched before completing.',
                      })
                    : ''
                }
              >
                {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {t('bankRec.complete', { defaultValue: 'Complete Reconciliation' })}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-6">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center p-8">
            <RefreshCw className="w-8 h-8 text-slate-400 animate-spin mb-4" />
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">
              {t('bankRec.loading', { defaultValue: 'Loading reconciliation data...' })}
            </p>
          </div>
        ) : !statement ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm flex flex-col justify-center max-w-2xl mx-auto mt-8 dark:bg-slate-900 dark:border-slate-700">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4 dark:bg-indigo-900/30 dark:text-indigo-300">
              <Upload className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2 dark:text-slate-100">
              {t('bankRec.importTitle', { defaultValue: 'Import Bank Statement' })}
            </h3>
            <p className="text-slate-500 text-sm mb-6 dark:text-slate-300">
              {t('bankRec.importPrompt', {
                defaultValue:
                  'To begin reconciliation, upload a bank statement file for the selected account.',
              })}
            </p>
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-xs text-slate-600 font-mono space-y-2 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
              <p>
                <strong>{t('bankRec.supportedFormats', { defaultValue: 'Supported formats:' })}</strong>
              </p>
              <ul className="list-disc pl-5 opacity-80">
                <li>{t('bankRec.supportedOfx', { defaultValue: '.OFX or .QFX (bank export)' })}</li>
                <li>
                  {t('bankRec.supportedCsv', {
                    defaultValue: '.CSV (date, description, amount, reference, balance)',
                  })}
                </li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 h-full">
            <div className="flex flex-col h-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-700">
              <div className="shrink-0 px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center dark:bg-slate-800 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500" />
                  <h3 className="text-sm font-bold uppercase tracking-widest text-slate-800 dark:text-slate-100">
                    {t('bankRec.statement', { defaultValue: 'Bank Statement' })}
                  </h3>
                </div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                  {t('bankRec.importedOn', {
                    defaultValue: 'Imported: {{date}}',
                    date: formatCompanyDate(statement.statementDate, settings),
                  })}
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100/50 sticky top-0 backdrop-blur-sm shadow-sm z-10 dark:bg-slate-800 dark:text-slate-200">
                    <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
                      <th className="px-4 py-3">{t('bankRec.date', { defaultValue: 'Date' })}</th>
                      <th className="px-4 py-3">{t('bankRec.description', { defaultValue: 'Description' })}</th>
                      <th className="px-4 py-3 text-right">{t('bankRec.amount', { defaultValue: 'Amount' })}</th>
                      <th className="px-4 py-3">{t('bankRec.matchStatus', { defaultValue: 'Match Status' })}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {statement.lines.map((line) => (
                      <tr key={line.id} className="hover:bg-slate-50/50 transition-colors dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 text-slate-600 font-medium whitespace-nowrap dark:text-slate-300">
                          {formatCompanyDate(line.date, settings)}
                        </td>
                        <td className="px-4 py-3 text-slate-800 dark:text-slate-100">
                          {line.description}
                          {line.reference && (
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {t('bankRec.reference', { defaultValue: 'Ref' })}: {line.reference}
                            </div>
                          )}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-mono font-bold ${
                            line.amount < 0 ? 'text-red-600' : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {fmt(line.amount)}
                        </td>
                        <td className="px-4 py-3 w-64">
                          <div className="flex flex-col gap-2">
                            {getStatusBadge(line.matchStatus)}
                            {line.matchStatus === 'UNMATCHED' && (
                              <select
                                className="w-full bg-white border border-rose-200 text-slate-700 text-xs rounded shadow-sm focus:ring-rose-500 focus:border-rose-500 block p-1.5 dark:bg-slate-900 dark:text-slate-100 dark:border-rose-400/40"
                                onChange={(e) => handleMatch(line, e.target.value)}
                                disabled={isProcessing}
                                value=""
                              >
                                <option value="" disabled>
                                  {t('bankRec.matchPlaceholder', { defaultValue: 'Match with ledger entry...' })}
                                </option>
                                {unreconciled.length === 0 && (
                                  <option disabled>
                                    {t('bankRec.noUnreconciled', { defaultValue: 'No unreconciled entries' })}
                                  </option>
                                )}
                                {unreconciled.map((entry) => (
                                  <option key={entry.id} value={entry.id}>
                                    {formatCompanyDate(entry.date, settings)} -{' '}
                                    {fmt(Number(entry.amount) * (entry.side === 'Credit' ? -1 : 1))} -{' '}
                                    {entry.notes || entry.description || t('bankRec.noDescription', { defaultValue: 'No description' })}
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
                {statement.lines.length === 0 && (
                  <div className="p-8 text-center text-slate-400 text-sm dark:text-slate-300">
                    {t('bankRec.noTransactions', { defaultValue: 'No transactions found in imported statement.' })}
                  </div>
                )}
              </div>
              <div className="shrink-0 px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-sm dark:bg-slate-800 dark:border-slate-700">
                <span className="font-bold text-slate-600 dark:text-slate-200">{t('bankRec.bankBalance', { defaultValue: 'Ending Bank Balance' })}</span>
                <span className="font-mono font-black text-slate-900 text-base dark:text-slate-100">{fmt(bankBalance)}</span>
              </div>
            </div>

            <div className="flex flex-col h-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-700">
              <div className="shrink-0 px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2 dark:bg-slate-800 dark:border-slate-700">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-800 dark:text-slate-100">
                  {t('bankRec.bookEntries', { defaultValue: 'Unreconciled Ledger Entries' })}
                </h3>
              </div>
              <div className="flex-1 overflow-auto bg-slate-50/30 dark:bg-slate-900/60">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100/80 sticky top-0 backdrop-blur-sm z-10 dark:bg-slate-800">
                    <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
                      <th className="px-4 py-3">{t('bankRec.date', { defaultValue: 'Date' })}</th>
                      <th className="px-4 py-3">{t('bankRec.voucherDesc', { defaultValue: 'Voucher / Description' })}</th>
                      <th className="px-4 py-3 text-right">{t('bankRec.netAmount', { defaultValue: 'Amount (Net)' })}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {unreconciled.map((entry) => {
                      const netAmount = Number(entry.amount) * (entry.side === 'Credit' ? -1 : 1);
                      return (
                        <tr key={entry.id} className="hover:bg-slate-50 transition-colors dark:hover:bg-slate-800/50">
                          <td className="px-4 py-3 text-slate-600 font-medium whitespace-nowrap dark:text-slate-300">
                            {typeof entry.date === 'string' ? formatCompanyDate(entry.date, settings) : ''}
                          </td>
                          <td className="px-4 py-3 text-slate-800 dark:text-slate-100">
                            {entry.notes || entry.description || (
                              <span className="text-slate-400 italic">
                                {t('bankRec.noDescription', { defaultValue: 'No description' })}
                              </span>
                            )}
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{entry.voucherId?.slice(0, 8)}...</div>
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-mono font-bold ${
                              netAmount < 0 ? 'text-red-600' : 'text-slate-900 dark:text-slate-100'
                            }`}
                          >
                            {fmt(netAmount, entry.currency)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {unreconciled.length === 0 && (
                  <div className="p-8 flex flex-col items-center justify-center text-slate-400 text-sm h-full max-h-64 dark:text-slate-300">
                    <CheckCheck className="w-12 h-12 mb-3 text-emerald-200" />
                    <span className="font-semibold text-slate-600 dark:text-slate-200">
                      {t('bankRec.allMatched', { defaultValue: 'All ledger entries are matched.' })}
                    </span>
                  </div>
                )}
              </div>
              <div className="shrink-0 px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span>{t('bankRec.onlyUnreconciled', { defaultValue: 'Only unreconciled entries are shown.' })}</span>
                </div>
                <span className="font-bold">
                  {unreconciled.length} {t('bankRec.items', { defaultValue: 'items' })}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const BankReconciliationPage: React.FC = () => {
  const { t } = useTranslation('accounting');
  return (
    <ReportContainer<BankReconciliationParams>
      title={t('bankRec.title', { defaultValue: 'Bank Reconciliation' })}
      subtitle={t('bankRec.subtitle', { defaultValue: 'Reconcile bank statements with ledger entries' })}
      initiator={BankReconciliationInitiator}
      ReportContent={BankReconciliationReportContent}
      config={{ paginated: false }}
    />
  );
};

export default BankReconciliationPage;

