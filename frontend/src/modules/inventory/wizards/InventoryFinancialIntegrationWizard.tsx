import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom'; import { CheckCircle2, ChevronLeft, ChevronRight, AlertTriangle, Calendar, BookOpen, TrendingUp, Info, X} from 'lucide-react';
import { Spinner } from '../../../components/ui/Spinner';
import { Account, useAccounts } from '../../../context/AccountsContext';
import { AccountSelector } from '../../accounting/components/shared/AccountSelector';
import { DatePicker } from '../../accounting/components/shared/DatePicker';
import { inventoryApi } from '../../../api/inventoryApi';
import { emitCompanyModulesRefresh } from '../../../utils/companyModulesEvents';
import { useCompanyModules } from '../../../hooks/useCompanyModules';
import { useTranslation } from "react-i18next";

const stepTitles = ['Impact Assessment', 'Accounting Method', 'Account Mappings', 'Start Behavior', 'Review & Confirm'];

const accountLabel = (account: Account): string => `${account.code} - ${account.name}`;

export const InventoryFinancialIntegrationWizard: React.FC = () => {
    const { t } = useTranslation('common');
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
  const [modalContent, setModalContent] = useState<'PERIODIC' | 'PERPETUAL' | null>(null);
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
        accountingMode: accountingMethod === 'PERPETUAL' ? 'PERPETUAL' : 'INVOICE_DRIVEN',
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
          <h2 className="text-3xl font-bold text-gray-900 mb-3">{t(`Inventory Financial Integration`)}</h2>
          <p className="text-gray-600 max-w-2xl mx-auto mb-8">
            Configure how inventory operations integrate with your Chart of Accounts. This setup enables financial/GL postings for inventory transactions.
          </p>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-left max-w-lg mx-auto">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <div className="font-semibold">{t(`Important`)}</div>
                <div className="mt-1">{t(`Once financial integration is configured, the accounting method cannot be changed. Review your choices carefully.`)}</div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (currentStep === 1) {
      return (
        <div className="py-6 max-w-2xl mx-auto space-y-5">
          <h2 className="text-2xl font-bold text-gray-900">{t(`Accounting Method`)}</h2>
          <p className="text-sm text-gray-600">{t(`Choose how inventory valuation and cost of goods sold are calculated.`)}</p>

          <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-5 cursor-pointer hover:border-primary-500">
            <input type="radio" name="accounting-method" checked={accountingMethod === 'PERIODIC'} onChange={() => setAccountingMethod('PERIODIC')} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">{t(`Periodic (Invoice-driven)`)}</span>
                <button type="button" onClick={(e) => { e.preventDefault(); setModalContent('PERIODIC'); }} className="text-primary-500 hover:text-primary-700 flex-shrink-0">
                  <Info className="w-4 h-4" />
                </button>
              </div>
              <div className="text-sm text-gray-600 mt-1">{t(`COGS is calculated at period-end based on physical counts. Inventory asset account is updated through invoices.`)}</div>
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-5 cursor-pointer hover:border-primary-500">
            <input type="radio" name="accounting-method" checked={accountingMethod === 'PERPETUAL'} onChange={() => setAccountingMethod('PERPETUAL')} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">{t(`Perpetual`)}</span>
                <button type="button" onClick={(e) => { e.preventDefault(); setModalContent('PERPETUAL'); }} className="text-primary-500 hover:text-primary-700 flex-shrink-0">
                  <Info className="w-4 h-4" />
                </button>
              </div>
              <div className="text-sm text-gray-600 mt-1">{t(`COGS and inventory asset accounts are updated in real-time with every stock movement. Requires account mappings.`)}</div>
            </div>
          </label>
        </div>
      );
    }

    if (currentStep === 2) {
      return (
        <div className="py-6 max-w-2xl mx-auto space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">{t(`Account Mappings`)}</h2>

          {accountingMethod === 'PERPETUAL' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t(`Default Inventory Asset Account`)} <span className="text-red-500">*</span></label>
                <AccountSelector
                  value={defaultInventoryAssetAccountId}
                  onChange={(account: any) => setDefaultInventoryAssetAccountId(account?.id || '')}
                  placeholder="Select inventory asset account"
                  disabled={loadingAccounts}
                  accounts={inventoryAssetAccounts as any}
                />
                <p className="mt-1 text-xs text-gray-500">{t(`Balance sheet account that holds the value of stock on hand.`)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t(`Default COGS Account`)} <span className="text-red-500">*</span></label>
                <AccountSelector
                  value={defaultCOGSAccountId}
                  onChange={(account: any) => setDefaultCOGSAccountId(account?.id || '')}
                  placeholder="Select COGS account"
                  disabled={loadingAccounts}
                  accounts={cogsAccounts as any}
                />
                <p className="mt-1 text-xs text-gray-500">{t(`Expense account for cost of goods sold.`)}</p>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-start gap-2">
                <BookOpen className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-gray-700">{t(`Periodic Method`)}</div>
                  <div className="text-xs text-gray-500 mt-1">{t(`Account mappings are optional for periodic mode. Financial postings occur through invoices using the invoice account mappings.`)}</div>
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
          <h2 className="text-2xl font-bold text-gray-900">{t(`Start Behavior`)}</h2>
          <p className="text-sm text-gray-600">{t(`Choose when financial integration begins.`)}</p>

          <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-5 cursor-pointer hover:border-primary-500">
            <input type="radio" name="start-behavior" checked={startBehavior === 'FROM_TODAY'} onChange={() => setStartBehavior('FROM_TODAY')} />
            <div>
              <div className="font-semibold text-gray-900">{t(`Start Fresh from Today`)}</div>
              <div className="text-sm text-gray-600">{t(`Only new transactions from today forward will post financially. Historical data stays operational-only.`)}</div>
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-5 cursor-pointer hover:border-primary-500">
            <input type="radio" name="start-behavior" checked={startBehavior === 'FROM_DATE'} onChange={() => setStartBehavior('FROM_DATE')} />
            <div>
              <div className="font-semibold text-gray-900">{t(`Set a Start Date`)}</div>
              <div className="text-sm text-gray-600">{t(`Transactions from the chosen date forward will post financially. Before that date: operational only.`)}</div>
            </div>
          </label>

          {startBehavior === 'FROM_DATE' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t(`Accounting Start Date`)} <span className="text-red-500">*</span></label>
              <DatePicker
                value={accountingStartDate}
                onChange={(val) => setAccountingStartDate(val)}
              />
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="py-6 max-w-2xl mx-auto space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">{t(`Review & Confirm`)}</h2>
        <p className="text-sm text-gray-600">{t(`Review your financial integration settings.`)}</p>

        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <div className="text-sm">
            <span className="font-semibold text-gray-900">{t(`Accounting Method:`)}</span>{' '}
            <span className="text-gray-700">{accountingMethod === 'PERPETUAL' ? 'Perpetual — real-time GL posting on every stock movement' : 'Periodic (Invoice-driven) — GL posting only on invoices'}</span>
          </div>
          {accountingMethod === 'PERPETUAL' && (
            <>
              <div className="text-sm">
                <span className="font-semibold text-gray-900">{t(`Inventory Asset Account:`)}</span>{' '}
                <span className="text-gray-700">{inventoryAssetAccounts.find(a => a.id === defaultInventoryAssetAccountId) ? accountLabel(inventoryAssetAccounts.find(a => a.id === defaultInventoryAssetAccountId)!) : 'Not selected'}</span>
              </div>
              <div className="text-sm">
                <span className="font-semibold text-gray-900">{t(`COGS Account:`)}</span>{' '}
                <span className="text-gray-700">{cogsAccounts.find(a => a.id === defaultCOGSAccountId) ? accountLabel(cogsAccounts.find(a => a.id === defaultCOGSAccountId)!) : 'Not selected'}</span>
              </div>
            </>
          )}
          <div className="text-sm">
            <span className="font-semibold text-gray-900">{t(`Start Behavior:`)}</span>{' '}
            <span className="text-gray-700">{startBehavior === 'FROM_TODAY' ? 'From today' : `From ${accountingStartDate}`}</span>
          </div>
        </div>

        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{t(`The accounting method cannot be changed after confirmation. Make sure your selections are correct.`)}</span>
          </div>
        </div>
      </div>
    );
  })();

  if (modulesLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isModuleInitialized('inventory') || !isModuleInitialized('accounting')) {
    return null;
  }

  const periodicModal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setModalContent(null)}>
      <div className="fixed inset-0 bg-black/50" />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h3 className="text-lg font-bold text-gray-900">{t(`Periodic (Invoice-driven) — Financial Effects`)}</h3>
          <button onClick={() => setModalContent(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="px-6 py-5 space-y-5 text-sm text-gray-700">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">{t(`How It Works`)}</h4>
            <p>{t(`In periodic mode, inventory quantities are tracked in real-time, but`)} <strong>{t(`financial (GL) postings only happen when an invoice is posted`)}</strong>{t(`. Stock movements like deliveries and receipts do not create accounting entries.`)}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200 rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold text-gray-900 border-b border-gray-200">{t(`Document`)}</th>
                  <th className="text-left px-4 py-2 font-semibold text-gray-900 border-b border-gray-200">{t(`GL Effect?`)}</th>
                  <th className="text-left px-4 py-2 font-semibold text-gray-900 border-b border-gray-200">{t(`Detail`)}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 font-medium">{t(`Goods Receipt`)}</td>
                  <td className="px-4 py-2"><span className="text-red-600 font-semibold">{t(`No`)}</span></td>
                  <td className="px-4 py-2">{t(`Stock quantity updated, no GL posting`)}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 font-medium">{t(`Delivery Note`)}</td>
                  <td className="px-4 py-2"><span className="text-red-600 font-semibold">{t(`No`)}</span></td>
                  <td className="px-4 py-2">{t(`Stock quantity updated, no GL posting`)}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 font-medium">{t(`Purchase Invoice`)}</td>
                  <td className="px-4 py-2"><span className="text-green-600 font-semibold">{t(`Yes`)}</span></td>
                  <td className="px-4 py-2">{t(`Dr Expense/COGS, Cr AP — inventory cost recognized at invoice time`)}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 font-medium">{t(`Sales Invoice`)}</td>
                  <td className="px-4 py-2"><span className="text-green-600 font-semibold">{t(`Yes`)}</span></td>
                  <td className="px-4 py-2">{t(`Dr AR, Cr Revenue — COGS not posted (calculated at period-end)`)}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 font-medium">{t(`Purchase Return (after invoice)`)}</td>
                  <td className="px-4 py-2"><span className="text-green-600 font-semibold">{t(`Yes`)}</span></td>
                  <td className="px-4 py-2">{t(`Reverses the original invoice posting`)}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 font-medium">{t(`Purchase Return (before invoice)`)}</td>
                  <td className="px-4 py-2"><span className="text-red-600 font-semibold">{t(`No`)}</span></td>
                  <td className="px-4 py-2">{t(`Only stock quantity adjusted`)}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 font-medium">{t(`Sales Return (after invoice)`)}</td>
                  <td className="px-4 py-2"><span className="text-green-600 font-semibold">{t(`Yes`)}</span></td>
                  <td className="px-4 py-2">{t(`Reverses the original invoice posting and restores stock`)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-medium">{t(`Sales Return (before invoice)`)}</td>
                  <td className="px-4 py-2"><span className="text-red-600 font-semibold">{t(`No`)}</span></td>
                  <td className="px-4 py-2">{t(`Only stock quantity restored`)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h4 className="font-semibold text-amber-900 mb-1">{t(`Important`)}</h4>
            <ul className="list-disc list-inside text-amber-800 space-y-1">
              <li>{t(`COGS is`)} <strong>{t(`not`)}</strong> {t(`posted on every transaction — it is calculated at period-end based on inventory counts.`)}</li>
              <li>{t(`No Inventory Asset or COGS account mappings are required for periodic mode.`)}</li>
              <li>{t(`Account mappings for Purchase/Sales invoices come from their respective module settings.`)}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const perpetualModal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setModalContent(null)}>
      <div className="fixed inset-0 bg-black/50" />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h3 className="text-lg font-bold text-gray-900">{t(`Perpetual — Financial Effects`)}</h3>
          <button onClick={() => setModalContent(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="px-6 py-5 space-y-5 text-sm text-gray-700">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">{t(`How It Works`)}</h4>
            <p>{t(`In perpetual mode,`)} <strong>{t(`every stock movement creates a financial (GL) posting in real-time`)}</strong>{t(`. The Inventory Asset and COGS accounts are updated immediately on each receipt, delivery, or adjustment.`)}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200 rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold text-gray-900 border-b border-gray-200">{t(`Document`)}</th>
                  <th className="text-left px-4 py-2 font-semibold text-gray-900 border-b border-gray-200">{t(`GL Effect?`)}</th>
                  <th className="text-left px-4 py-2 font-semibold text-gray-900 border-b border-gray-200">{t(`Detail`)}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 font-medium">{t(`Goods Receipt`)}</td>
                  <td className="px-4 py-2"><span className="text-green-600 font-semibold">{t(`Yes`)}</span></td>
                  <td className="px-4 py-2">{t(`Dr Inventory Asset, Cr GRNI (Goods Received Not Invoiced)`)}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 font-medium">{t(`Delivery Note`)}</td>
                  <td className="px-4 py-2"><span className="text-green-600 font-semibold">{t(`Yes`)}</span></td>
                  <td className="px-4 py-2">{t(`Dr COGS, Cr Inventory Asset — inventory cost recognized immediately`)}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 font-medium">{t(`Purchase Invoice`)}</td>
                  <td className="px-4 py-2"><span className="text-green-600 font-semibold">{t(`Yes`)}</span></td>
                  <td className="px-4 py-2">{t(`Clears GRNI: Cr GRNI, Dr AP. Any cost variance adjusts Inventory Asset.`)}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 font-medium">{t(`Sales Invoice`)}</td>
                  <td className="px-4 py-2"><span className="text-green-600 font-semibold">{t(`Yes`)}</span></td>
                  <td className="px-4 py-2">{t(`Dr AR, Cr Revenue. COGS already posted by Delivery Note.`)}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 font-medium">{t(`Purchase Return`)}</td>
                  <td className="px-4 py-2"><span className="text-green-600 font-semibold">{t(`Yes`)}</span></td>
                  <td className="px-4 py-2">{t(`Reverses GR entry: Cr Inventory Asset, Cr COGS (or Dr GRNI)`)}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 font-medium">{t(`Sales Return`)}</td>
                  <td className="px-4 py-2"><span className="text-green-600 font-semibold">{t(`Yes`)}</span></td>
                  <td className="px-4 py-2">{t(`Dr Inventory Asset, Cr COGS — reverses the delivery posting`)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-medium">{t(`Stock Adjustment`)}</td>
                  <td className="px-4 py-2"><span className="text-green-600 font-semibold">{t(`Yes`)}</span></td>
                  <td className="px-4 py-2">{t(`Dr/Cr Inventory Asset with offset to COGS or variance account`)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h4 className="font-semibold text-amber-900 mb-1">{t(`Important`)}</h4>
            <ul className="list-disc list-inside text-amber-800 space-y-1">
              <li><strong>{t(`Inventory Asset and COGS account mappings are required`)}</strong> {t(`— every stock movement posts to these accounts.`)}</li>
              <li>{t(`The accounting method`)} <strong>{t(`cannot be changed after confirmation`)}</strong> {t(`because all historical GL entries are based on this method.`)}</li>
              <li>{t(`GRNI (Goods Received Not Invoiced) is a temporary liability account that tracks received but not yet invoiced goods.`)}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {modalContent === 'PERIODIC' && periodicModal}
      {modalContent === 'PERPETUAL' && perpetualModal}
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
            <span className="text-xs font-medium text-white/90">{t(`Step`)} {currentStep + 1} {t(`of`)} {stepTitles.length}</span>
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
                {t(`Next Step`)} <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button type="button" onClick={submit} disabled={submitting} className="flex items-center gap-2 rounded-lg bg-primary-600 px-8 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 disabled:opacity-50 transition">
                {submitting ? (<><Spinner size="sm" /> {t(`Configuring...`)}</>) : (<><CheckCircle2 className="w-4 h-4" /> {t(`Enable Integration`)}</>)}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
};
