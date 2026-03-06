import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Calculator, FileText, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { accountingApi } from '../../../../api/accountingApi';
import AccountSelector from '../../components/shared/AccountSelector';
import { DatePicker } from '../../components/shared/DatePicker';

interface FXRevaluationTabProps {
  // No props needed — AccountSelector fetches accounts from context
}

interface DetectedCurrency {
  code: string;
  suggestedRate: number;
  userRate: number;
}

interface RevalLine {
  accountId: string;
  accountName: string;
  accountSystemCode: string;
  currency: string;
  foreignBalance: number;
  historicalBaseBalance: number;
  newRate: number;
  targetBaseBalance: number;
  deltaBase: number;
}

interface CalculationResult {
  asOfDate: string;
  lines: RevalLine[];
  totalGain: number;
  totalLoss: number;
  netDelta: number;
}

type WizardStep = 'SCOPE' | 'PREVIEW' | 'DONE';

const FXRevaluationTab: React.FC<FXRevaluationTabProps> = () => {
  const { t } = useTranslation('accounting');

  // Step 1: Scope & Rates
  const [step, setStep] = useState<WizardStep>('SCOPE');
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterAccountIds, setFilterAccountIds] = useState<string[]>([]);
  const [targetGainLossAccountId, setTargetGainLossAccountId] = useState('');

  // Detected currencies & rates
  const [detectedCurrencies, setDetectedCurrencies] = useState<DetectedCurrency[]>([]);
  const [baseCurrency, setBaseCurrency] = useState('');
  const [detecting, setDetecting] = useState(false);

  // Step 2: Preview
  const [calculationResult, setCalculationResult] = useState<CalculationResult | null>(null);
  const [calculating, setCalculating] = useState(false);

  // Step 3: Done
  const [generatedVoucher, setGeneratedVoucher] = useState<any>(null);
  const [generating, setGenerating] = useState(false);

  const [error, setError] = useState('');

  // === Step 1: Detect currencies ===
  const handleDetectCurrencies = useCallback(async () => {
    setDetecting(true);
    setError('');
    try {
      const result = await accountingApi.fxDetectCurrencies(
        asOfDate,
        filterAccountIds.length > 0 ? filterAccountIds : undefined
      );
      setBaseCurrency(result.baseCurrency || '');
      const currencies = (result.currencies || []).map((code: string) => ({
        code,
        suggestedRate: result.suggestedRates?.[code] || 1.0,
        userRate: result.suggestedRates?.[code] || 1.0
      }));
      setDetectedCurrencies(currencies);
      if (currencies.length === 0) {
        setError(t('settings.fxRevaluation.errors.noForeignBalances', { defaultValue: 'No foreign currency balances found for the selected scope and date.' }));
      }
    } catch (err: any) {
      setError(err?.message || t('settings.fxRevaluation.errors.detectFailed', { defaultValue: 'Failed to detect currencies' }));
    } finally {
      setDetecting(false);
    }
  }, [asOfDate, filterAccountIds]);

  // === Step 1 → Step 2: Calculate ===
  const handleCalculate = useCallback(async () => {
    if (!targetGainLossAccountId) {
      setError(t('settings.fxRevaluation.errors.selectGainLoss', { defaultValue: 'Please select an Unrealized Gain/Loss account.' }));
      return;
    }
    if (detectedCurrencies.length === 0) {
      setError(t('settings.fxRevaluation.errors.detectFirst', { defaultValue: 'No currencies detected. Click \"Detect Currencies\" first.' }));
      return;
    }
    setCalculating(true);
    setError('');
    try {
      const exchangeRates: Record<string, number> = {};
      detectedCurrencies.forEach(c => { exchangeRates[c.code] = c.userRate; });
      const result = await accountingApi.fxCalculate(
        asOfDate,
        exchangeRates,
        filterAccountIds.length > 0 ? filterAccountIds : undefined
      );
      setCalculationResult(result);
      setStep('PREVIEW');
    } catch (err: any) {
      setError(err?.message || t('settings.fxRevaluation.errors.calculateFailed', { defaultValue: 'Failed to calculate revaluation' }));
    } finally {
      setCalculating(false);
    }
  }, [asOfDate, filterAccountIds, detectedCurrencies, targetGainLossAccountId]);

  // === Step 2 → Step 3: Generate Voucher ===
  const handleGenerateVoucher = useCallback(async () => {
    if (!calculationResult) return;
    setGenerating(true);
    setError('');
    try {
      const result = await accountingApi.fxGenerateVoucher(calculationResult, targetGainLossAccountId);
      setGeneratedVoucher(result);
      setStep('DONE');
    } catch (err: any) {
      setError(err?.message || t('settings.fxRevaluation.errors.generateFailed', { defaultValue: 'Failed to generate voucher' }));
    } finally {
      setGenerating(false);
    }
  }, [calculationResult, targetGainLossAccountId]);

  // === Reset wizard ===
  const handleReset = () => {
    setStep('SCOPE');
    setDetectedCurrencies([]);
    setCalculationResult(null);
    setGeneratedVoucher(null);
    setError('');
  };

  const updateRate = (code: string, newRate: number) => {
    setDetectedCurrencies(prev =>
      prev.map(c => c.code === code ? { ...c, userRate: newRate } : c)
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Calculator size={20} />
            {t('settings.fxRevaluation.title', { defaultValue: 'FX Revaluation' })}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {t('settings.fxRevaluation.subtitle', { defaultValue: 'Revalue foreign currency balances to current exchange rates and generate adjustment vouchers.' })}
          </p>
        </div>
        {step !== 'SCOPE' && (
          <button onClick={handleReset} className="px-3 py-1.5 text-sm border rounded-md text-slate-600 hover:bg-slate-50 flex items-center gap-1.5">
            <RefreshCw size={14} /> {t('settings.fxRevaluation.startOver', { defaultValue: 'Start Over' })}
          </button>
        )}
      </div>

      {/* Progress Steps */}
      <div className="flex gap-2 items-center text-sm font-medium">
        <div className={`px-3 py-1 rounded-full ${step === 'SCOPE' ? 'bg-indigo-600 text-white' : 'bg-green-100 text-green-800'}`}>
          {t('settings.fxRevaluation.steps.scopeRates', { defaultValue: '1. Scope & Rates' })}
        </div>
        <span className="text-slate-300">→</span>
        <div className={`px-3 py-1 rounded-full ${step === 'PREVIEW' ? 'bg-indigo-600 text-white' : step === 'DONE' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-400'}`}>
          {t('settings.fxRevaluation.steps.preview', { defaultValue: '2. Preview' })}
        </div>
        <span className="text-slate-300">→</span>
        <div className={`px-3 py-1 rounded-full ${step === 'DONE' ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
          {t('settings.fxRevaluation.steps.done', { defaultValue: '3. Done' })}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* === STEP 1: SCOPE & RATES === */}
      {step === 'SCOPE' && (
        <div className="space-y-4">
          {/* Date & Filter */}
          <div className="bg-white border rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-700">{t('settings.fxRevaluation.configuration', { defaultValue: 'Configuration' })}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{t('settings.fxRevaluation.asOfDate', { defaultValue: 'As Of Date' })}</label>
                <DatePicker
                  value={asOfDate}
                  onChange={setAsOfDate}
                  className="w-full text-base"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  {t('settings.fxRevaluation.filterByAccount', { defaultValue: 'Filter by Account' })} <span className="text-slate-400">({t('settings.common.optional', { defaultValue: 'Optional' })})</span>
                </label>
                <AccountSelector
                  value={filterAccountIds[0] || ''}
                  onChange={(acct: any) => setFilterAccountIds(acct?.id ? [acct.id] : [])}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Unrealized Gain/Loss Account <span className="text-red-500">*</span>
              </label>
              <AccountSelector
                value={targetGainLossAccountId}
                onChange={(acct: any) => setTargetGainLossAccountId(acct?.id || '')}
              />
              <p className="text-xs text-slate-400 mt-1">{t('settings.fxRevaluation.gainLossHint', { defaultValue: 'The account where the FX gain/loss adjustment will be posted.' })}</p>
            </div>

            <button
              onClick={handleDetectCurrencies}
              disabled={detecting}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              {detecting ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {t('settings.fxRevaluation.detectCurrencies', { defaultValue: 'Detect Currencies' })}
            </button>
          </div>

          {/* Detected Currencies & Rate Override Grid */}
          {detectedCurrencies.length > 0 && (
            <div className="bg-white border rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700">
                  {t('settings.fxRevaluation.foreignDetected', { count: detectedCurrencies.length, defaultValue: `Foreign Currencies Detected (${detectedCurrencies.length})` })}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                  {t('settings.fxRevaluation.base', { defaultValue: 'Base' })}: {baseCurrency}
                </span>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 text-xs text-blue-700 flex items-start gap-1.5">
                <Info size={14} className="mt-0.5 shrink-0" />
                {t('settings.fxRevaluation.latestRatesHint', { defaultValue: 'The system has fetched the latest exchange rates. You may override them below before processing.' })}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-slate-500">
                    <th className="py-2 px-2">{t('settings.fxRevaluation.columns.currency', { defaultValue: 'Currency' })}</th>
                    <th className="py-2 px-2">{t('settings.fxRevaluation.columns.suggestedRate', { defaultValue: 'Suggested Rate' })}</th>
                    <th className="py-2 px-2">{t('settings.fxRevaluation.columns.yourRate', { defaultValue: 'Your Rate' })}</th>
                  </tr>
                </thead>
                <tbody>
                  {detectedCurrencies.map(c => (
                    <tr key={c.code} className="border-b last:border-b-0 hover:bg-slate-50">
                      <td className="py-2 px-2 font-medium">{c.code}</td>
                      <td className="py-2 px-2 text-slate-500">{c.suggestedRate.toFixed(4)}</td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          step="0.0001"
                          min="0"
                          className="w-32 border rounded px-2 py-1 text-sm"
                          value={c.userRate}
                          onChange={(e) => updateRate(c.code, parseFloat(e.target.value) || 0)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button
                onClick={handleCalculate}
                disabled={calculating || !targetGainLossAccountId}
                className="px-5 py-2.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
              >
                {calculating ? <RefreshCw size={14} className="animate-spin" /> : <Calculator size={14} />}
                {t('settings.fxRevaluation.calculate', { defaultValue: 'Calculate Revaluation' })}
              </button>
            </div>
          )}
        </div>
      )}

      {/* === STEP 2: PREVIEW === */}
      {step === 'PREVIEW' && calculationResult && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="text-xs font-semibold text-green-700">{t('settings.fxRevaluation.totalGain', { defaultValue: 'Total Unrealized Gain' })}</div>
              <div className="text-2xl font-bold text-green-800 mt-1">
                {calculationResult.totalGain.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="text-xs font-semibold text-red-700">{t('settings.fxRevaluation.totalLoss', { defaultValue: 'Total Unrealized Loss' })}</div>
              <div className="text-2xl font-bold text-red-800 mt-1">
                ({calculationResult.totalLoss.toLocaleString(undefined, { minimumFractionDigits: 2 })})
              </div>
            </div>
            <div className={`border rounded-xl p-4 ${calculationResult.netDelta >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="text-xs font-semibold text-slate-700">{t('settings.fxRevaluation.netDelta', { defaultValue: 'Net Delta' })}</div>
              <div className={`text-2xl font-bold mt-1 ${calculationResult.netDelta >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                {calculationResult.netDelta.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Detail Table */}
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-700 mb-3">{t('settings.fxRevaluation.affectedAccounts', { count: calculationResult.lines.length, defaultValue: `Affected Accounts (${calculationResult.lines.length})` })}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-slate-500">
                    <th className="py-2 px-2">{t('settings.fxRevaluation.preview.account', { defaultValue: 'Account' })}</th>
                    <th className="py-2 px-2">{t('settings.fxRevaluation.preview.currency', { defaultValue: 'Currency' })}</th>
                    <th className="py-2 px-2 text-right">{t('settings.fxRevaluation.preview.foreignBalance', { defaultValue: 'Foreign Balance' })}</th>
                    <th className="py-2 px-2 text-right">{t('settings.fxRevaluation.preview.historicalBase', { defaultValue: 'Historical Base' })}</th>
                    <th className="py-2 px-2 text-right">{t('settings.fxRevaluation.preview.newRate', { defaultValue: 'New Rate' })}</th>
                    <th className="py-2 px-2 text-right">{t('settings.fxRevaluation.preview.targetBase', { defaultValue: 'Target Base' })}</th>
                    <th className="py-2 px-2 text-right">{t('settings.fxRevaluation.preview.delta', { defaultValue: 'Delta' })}</th>
                  </tr>
                </thead>
                <tbody>
                  {calculationResult.lines.map((line, i) => (
                    <tr key={i} className="border-b last:border-b-0 hover:bg-slate-50">
                      <td className="py-2 px-2">
                        <div className="font-medium">{line.accountSystemCode}</div>
                        <div className="text-xs text-slate-400">{line.accountName}</div>
                      </td>
                      <td className="py-2 px-2">{line.currency}</td>
                      <td className="py-2 px-2 text-right font-mono">{line.foreignBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-2 px-2 text-right font-mono">{line.historicalBaseBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-2 px-2 text-right">{line.newRate.toFixed(4)}</td>
                      <td className="py-2 px-2 text-right font-mono">{line.targetBaseBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className={`py-2 px-2 text-right font-mono font-bold ${line.deltaBase >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {line.deltaBase >= 0 ? '+' : ''}{line.deltaBase.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setStep('SCOPE')}
              className="px-4 py-2 border rounded-lg text-sm text-slate-600 hover:bg-slate-50"
            >
              {t('settings.common.back', { defaultValue: '← Back' })}
            </button>
            <button
              onClick={handleGenerateVoucher}
              disabled={generating || calculationResult.lines.length === 0}
              className="px-5 py-2.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              {generating ? <RefreshCw size={14} className="animate-spin" /> : <FileText size={14} />}
              {t('settings.fxRevaluation.generateDraft', { defaultValue: 'Generate Draft Voucher' })}
            </button>
          </div>
        </div>
      )}

      {/* === STEP 3: DONE === */}
      {step === 'DONE' && generatedVoucher && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center space-y-3">
          <CheckCircle2 size={48} className="text-green-600 mx-auto" />
          <h3 className="text-lg font-bold text-green-800">{t('settings.fxRevaluation.done.title', { defaultValue: 'FX Revaluation Voucher Created!' })}</h3>
          <p className="text-sm text-green-700">
            {t('settings.fxRevaluation.done.savedAsDraftPrefix', { defaultValue: 'Voucher' })} <strong>{generatedVoucher.voucherNo}</strong> {t('settings.fxRevaluation.done.savedAsDraftSuffix', { defaultValue: 'has been saved as a' })} <strong>{t('settings.fxRevaluation.done.draft', { defaultValue: 'DRAFT' })}</strong>.
          </p>
          <p className="text-xs text-green-600">
            {t('settings.fxRevaluation.done.reviewHint', { defaultValue: 'You can review and post it from the Voucher List.' })}
          </p>
          <button
            onClick={handleReset}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
          >
            {t('settings.fxRevaluation.done.runAnother', { defaultValue: 'Run Another Revaluation' })}
          </button>
        </div>
      )}
    </div>
  );
};

export default FXRevaluationTab;
