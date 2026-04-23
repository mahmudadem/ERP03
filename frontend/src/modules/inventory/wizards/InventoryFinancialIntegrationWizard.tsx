import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Calendar,
  BookOpen,
  TrendingUp,
} from 'lucide-react';
import { Account, useAccounts } from '../../../context/AccountsContext';
import { AccountSelector } from '../../accounting/components/shared/AccountSelector';
import { inventoryApi } from '../../../api/inventoryApi';
import { emitCompanyModulesRefresh } from '../../../utils/companyModulesEvents';
import { useCompanyModules } from '../../../hooks/useCompanyModules';

const stepTitles = ['Impact Assessment', 'Accounting Method', 'Account Mappings', 'Start Behavior', 'Review & Confirm'];

const accountLabel = (account: Account): string => `${account.code} - ${account.name}`;

export const InventoryFinancialIntegrationWizard: React.FC = () => {
  const navigate = useNavigate();
  const { accounts, isLoading: loadingAccounts } = useAccounts();
  const { isModuleInitialized, loading: modulesLoading } = useCompanyModules();

  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!modulesLoading) {
      if (!isModuleInitialized('inventory')) {
        navigate('/inventory', { replace: true });
        return;
      }
      if (!isModuleInitialized('accounting')) {
        navigate('/inventory/settings', { replace: true });
        return;
      }
    }
  }, [modulesLoading, isModuleInitialized, navigate]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [accountingMethod, setAccountingMethod] = useState<'PERIODIC' | 'PERPETUAL'>('PERIODIC');
  const [accountingMode, setAccountingMode] = useState<'INVOICE_DRIVEN' | 'PERPETUAL'>('INVOICE_DRIVEN');
  const [defaultInventoryAssetAccountId, setDefaultInventoryAssetAccountId] = useState('');
  const [defaultCOGSAccountId, setDefaultCOGSAccountId] = useState('');
  const [startBehavior, setStartBehavior] = useState<'FROM_TODAY' | 'FROM_DATE'>('FROM_TODAY');
  const [accountingStartDate, setAccountingStartDate] = useState('');

  const inventoryAssetAccounts = useMemo(
    () => accounts.filter(
      (a) => String(a.accountRole || '').toUpperCase() === 'POSTING' &&
        String(a.classification || '').toUpperCase() === 'ASSET' &&
        String(a.status || '').toUpperCase() === 'ACTIVE' && !a.hasChildren
    ),
    [accounts]
  );

  const cogsAccounts = useMemo(
    () => accounts.filter(
      (a) => String(a.accountRole || '').toUpperCase() === 'POSTING' &&
        String(a.classification || '').toUpperCase() === 'EXPENSE' &&
        String(a.status || '').toUpperCase() === 'ACTIVE' && !a.hasChildren
    ),
    [accounts]
  );

  const stepError = useMemo(() => {
    if (currentStep === 2) {
      if (accountingMethod === 'PERPETUAL') {
        if (!defaultInventoryAssetAccountId) return 'Default Inventory Asset Account is required for perpetual mode.';
        if (!defaultCOGSAccountId) return 'Default COGS Account is required for perpetual mode.';
      }
    }
    if (currentStep === 3) {
      if (startBehavior === 'FROM_DATE' && !accountingStartDate) {
        return 'Accounting start date is required.';
      }
    }
    return null;
  }, [currentStep, accountingMethod, defaultInventoryAssetAccountId, defaultCOGSAccountId, startBehavior, accountingStartDate]);

  const goNext = () => {
    if (stepError) { setError(stepError); return; }
    setError(null);
    setCurrentStep((prev) => Math.min(prev + 1, stepTitles.length - 1));
  };

  const goBack = () => {
    setError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const submit = async () => {
    if (stepError) { setError(stepError); return; }
    try {
      setSubmitting(true);
      setError(null);
      await inventoryApi.configureFinancialIntegration({
        accountingMethod,
        accountingMode,
        defaultInventoryAssetAccountId: accountingMethod === 'PERPETUAL' ? defaultInventoryAssetAccountId : undefined,
        defaultCOGSAccountId: accountingMethod === 'PERPETUAL' ? defaultCOGSAccountId : undefined,
        accountingStartDate: startBehavior === 'FROM_DATE' ? accountingStartDate : undefined,
      });
      emitCompanyModulesRefresh({ moduleCode: 'inventory' });
      navigate('/inventory/settings');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to configure financial integration.');
    } finally {
      setSubmitting(false);
    }
  };

  const content = (() => {
    if (currentStep === 0) {
      return (
        <div className="text-center py-8">
          <div className="w-20 h-20 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center mx-auto mb-6">
            <TrendingUp className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Inventory Financial Integration</h2>
          <p className="text-gray-600 max-w-2xl mx-auto mb-8">
            Configure how inventory operations integrate with your Chart of Accounts. This setup enables financial/GL postings for inventory transactions.
          </p>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-left max-w-lg mx-auto">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <div className="font-semibold">Important</div>
                <div className="mt-1">Once financial integration is configured, the accounting method cannot be changed. Review your choices carefully.</div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (currentStep === 1) {
      return (
        <div className="py-6 max-w-2xl mx-auto space-y-5">
          <h2 className="text-2xl font-bold text-gray-900">Accounting Method</h2>
          <p className="text-sm text-gray-600">Choose how inventory valuation and cost of goods sold are calculated.</p>

          <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-5 cursor-pointer hover:border-primary-500">
            <input type="radio" name="accounting-method" checked={accountingMethod === 'PERIODIC'} onChange={() => setAccountingMethod('PERIODIC')} />
            <div>
              <div className="font-semibold text-gray-900">Periodic (Invoice-driven)</div>
              <div className="text-sm text-gray-600">COGS is calculated at period-end based on physical counts. Inventory asset account is updated through invoices.</div>
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-5 cursor-pointer hover:border-primary-500">
            <input type="radio" name="accounting-method" checked={accountingMethod === 'PERPETUAL'} onChange={() => setAccountingMethod('PERPETUAL')} />
            <div>
              <div className="font-semibold text-gray-900">Perpetual</div>
              <div className="text-sm text-gray-600">COGS and inventory asset accounts are updated in real-time with every stock movement. Requires account mappings.</div>
            </div>
          </label>
        </div>
      );
    }

    if (currentStep === 2) {
      return (
        <div className="py-6 max-w-2xl mx-auto space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Account Mappings</h2>

          {accountingMethod === 'PERPETUAL' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Default Inventory Asset Account <span className="text-red-500">*</span></label>
                <AccountSelector
                  value={defaultInventoryAssetAccountId}
                  onChange={(account: any) => setDefaultInventoryAssetAccountId(account?.id || '')}
                  placeholder="Select inventory asset account"
                  disabled={loadingAccounts}
                  accounts={inventoryAssetAccounts as any}
                />
                <p className="mt-1 text-xs text-gray-500">Balance sheet account that holds the value of stock on hand.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Default COGS Account <span className="text-red-500">*</span></label>
                <AccountSelector
                  value={defaultCOGSAccountId}
                  onChange={(account: any) => setDefaultCOGSAccountId(account?.id || '')}
                  placeholder="Select COGS account"
                  disabled={loadingAccounts}
                  accounts={cogsAccounts as any}
                />
                <p className="mt-1 text-xs text-gray-500">Expense account for cost of goods sold.</p>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-start gap-2">
                <BookOpen className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-gray-700">Periodic Method</div>
                  <div className="text-xs text-gray-500 mt-1">Account mappings are optional for periodic mode. Financial postings occur through invoices using the invoice account mappings.</div>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (currentStep === 3) {
      return (
        <div className="py-6 max-w-2xl mx-auto space-y-5">
          <h2 className="text-2xl font-bold text-gray-900">Start Behavior</h2>
          <p className="text-sm text-gray-600">Choose when financial integration begins.</p>

          <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-5 cursor-pointer hover:border-primary-500">
            <input type="radio" name="start-behavior" checked={startBehavior === 'FROM_TODAY'} onChange={() => setStartBehavior('FROM_TODAY')} />
            <div>
              <div className="font-semibold text-gray-900">Start Fresh from Today</div>
              <div className="text-sm text-gray-600">Only new transactions from today forward will post financially. Historical data stays operational-only.</div>
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-5 cursor-pointer hover:border-primary-500">
            <input type="radio" name="start-behavior" checked={startBehavior === 'FROM_DATE'} onChange={() => setStartBehavior('FROM_DATE')} />
            <div>
              <div className="font-semibold text-gray-900">Set a Start Date</div>
              <div className="text-sm text-gray-600">Transactions from the chosen date forward will post financially. Before that date: operational only.</div>
            </div>
          </label>

          {startBehavior === 'FROM_DATE' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Accounting Start Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={accountingStartDate}
                onChange={(e) => setAccountingStartDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="py-6 max-w-2xl mx-auto space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">Review & Confirm</h2>
        <p className="text-sm text-gray-600">Review your financial integration settings.</p>

        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <div className="text-sm">
            <span className="font-semibold text-gray-900">Accounting Method:</span>{' '}
            <span className="text-gray-700">{accountingMethod}</span>
          </div>
          <div className="text-sm">
            <span className="font-semibold text-gray-900">Accounting Mode:</span>{' '}
            <span className="text-gray-700">{accountingMode}</span>
          </div>
          {accountingMethod === 'PERPETUAL' && (
            <>
              <div className="text-sm">
                <span className="font-semibold text-gray-900">Inventory Asset Account:</span>{' '}
                <span className="text-gray-700">{inventoryAssetAccounts.find(a => a.id === defaultInventoryAssetAccountId) ? accountLabel(inventoryAssetAccounts.find(a => a.id === defaultInventoryAssetAccountId)!) : 'Not selected'}</span>
              </div>
              <div className="text-sm">
                <span className="font-semibold text-gray-900">COGS Account:</span>{' '}
                <span className="text-gray-700">{cogsAccounts.find(a => a.id === defaultCOGSAccountId) ? accountLabel(cogsAccounts.find(a => a.id === defaultCOGSAccountId)!) : 'Not selected'}</span>
              </div>
            </>
          )}
          <div className="text-sm">
            <span className="font-semibold text-gray-900">Start Behavior:</span>{' '}
            <span className="text-gray-700">{startBehavior === 'FROM_TODAY' ? 'From today' : `From ${accountingStartDate}`}</span>
          </div>
        </div>

        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>The accounting method cannot be changed after confirmation. Make sure your selections are correct.</span>
          </div>
        </div>
      </div>
    );
  })();

  if (modulesLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!isModuleInitialized('inventory') || !isModuleInitialized('accounting')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl h-[720px] bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col">
        <div className="px-8 pt-6 pb-4 bg-gradient-to-r from-primary-500 to-primary-600 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            {stepTitles.map((_, index) => {
              const isCompleted = index < currentStep;
              const isCurrent = index === currentStep;
              return (
                <div key={index} className="flex items-center flex-1">
                  <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${isCompleted ? 'bg-white' : isCurrent ? 'bg-white ring-2 ring-white/50' : 'bg-white/30'}`} />
                  {index < stepTitles.length - 1 && (
                    <div className="flex-1 h-0.5 mx-2">
                      <div className={`h-full transition-all duration-300 ${index < currentStep ? 'bg-white' : 'bg-white/30'}`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs font-medium text-white/90">Step {currentStep + 1} of {stepTitles.length}</span>
            <span className="text-xs font-semibold text-white">{stepTitles[currentStep]}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 min-h-0">{content}</div>

        {error && (
          <div className="px-8 pb-4">
            <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm p-3">{error}</div>
          </div>
        )}

        <div className="px-8 py-5 bg-gray-50 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
          <button type="button" onClick={goBack} disabled={currentStep === 0 || submitting} className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-3">
            {currentStep < stepTitles.length - 1 ? (
              <button type="button" onClick={goNext} className="flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 transition">
                Next Step <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button type="button" onClick={submit} disabled={submitting} className="flex items-center gap-2 rounded-lg bg-primary-600 px-8 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 disabled:opacity-50 transition">
                {submitting ? (<><Loader2 className="w-4 h-4 animate-spin" /> Configuring...</>) : (<><CheckCircle2 className="w-4 h-4" /> Enable Integration</>)}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
