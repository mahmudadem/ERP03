import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { inventoryApi } from '../../../api/inventoryApi';
import { PurchaseSettingsDTO, PurchaseGovernanceRuleDTO, purchasesApi } from '../../../api/purchasesApi';
import { Card } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { AccountSelector } from '../../accounting/components/shared/AccountSelector';
import { useAccounts } from '../../../context/AccountsContext';
import { Loader2, Settings, ShieldCheck, DollarSign, Hash, Info, Shield, Plus, Trash2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { ModuleSettingsLayout, SettingsSection } from '../../../components/shared/ModuleSettingsLayout';
import { ModuleControlsTab } from '../../../components/shared/ModuleControlsTab';
import { AccountingIntegrationStatus } from '../../../components/shared/AccountingIntegrationStatus';
import { errorHandler } from '../../../services/errorHandler';
import toast from 'react-hot-toast';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { notifySettingsChanged } from '../../../utils/settingsSync';
import {
  getAccountingModeLabel,
  getWorkflowModeLabel,
  isPersonaAllowedByGovernance,
  resolveInventoryAccountingMode,
} from '../../../utils/documentPolicy';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const PARTY_ACCOUNT_CODE_FORMAT_FALLBACK = '{parent}-{partyCode}';
const PARTY_ACCOUNT_CODE_PRESETS: Array<{ template: string; label: string }> = [
  { template: '{parent}-{partyCode}', label: 'Parent-Party  (20101-V001)' },
  { template: '{parent}.{partyCode}', label: 'Parent.Party  (20101.V001)' },
  { template: '{parent}-{seq3}', label: 'Parent-Sequence  (20101-001)' },
];
const DIRECT_PURCHASE_INVOICE_COMPANY_RULE_ID = 'purchase-direct-invoicing-company-policy';

const isCompanyDirectInvoiceRule = (rule: PurchaseGovernanceRuleDTO): boolean =>
  rule.persona === 'direct' && rule.scope === 'company';

const hasCompanyDirectInvoiceAllowRule = (rules: PurchaseGovernanceRuleDTO[] = []): boolean =>
  rules.some((rule) => isCompanyDirectInvoiceRule(rule) && rule.action === 'allow');

const reconcileCompanyDirectInvoiceRule = (
  rules: PurchaseGovernanceRuleDTO[] = [],
  allowDirect: boolean
): PurchaseGovernanceRuleDTO[] => {
  const withoutCompanyDirect = rules.filter((rule) => !isCompanyDirectInvoiceRule(rule));
  if (!allowDirect) return withoutCompanyDirect;

  return [
    ...withoutCompanyDirect,
    {
      id: DIRECT_PURCHASE_INVOICE_COMPANY_RULE_ID,
      scope: 'company',
      action: 'allow',
      persona: 'direct',
    },
  ];
};

const normalizePurchaseDirectPolicy = (settings: PurchaseSettingsDTO | null): PurchaseSettingsDTO | null => {
  if (!settings || settings.workflowMode !== 'OPERATIONAL') return settings;

  const companyDirectAllowed = hasCompanyDirectInvoiceAllowRule(settings.governanceRules);
  const shouldAllowDirect = settings.allowDirectInvoicing || companyDirectAllowed;
  if (!shouldAllowDirect) return settings;

  return {
    ...settings,
    allowDirectInvoicing: true,
    governanceRules: reconcileCompanyDirectInvoiceRule(settings.governanceRules, true),
  };
};

type TabId = 'policy' | 'accounts' | 'numbering' | 'governance' | 'controls';

const PurchaseSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('policy');
  const [settings, setSettings] = useState<PurchaseSettingsDTO | null>(null);
  const [originalSettings, setOriginalSettings] = useState<PurchaseSettingsDTO | null>(null);
  const [apFormatCustom, setApFormatCustom] = useState(false);
  const [invSettings, setInvSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { validAccounts, getAccountById } = useAccounts();
  const [newRule, setNewRule] = useState<Partial<PurchaseGovernanceRuleDTO>>({
    scope: 'company',
    action: 'allow',
    persona: 'direct',
  });
  const [showAddRule, setShowAddRule] = useState(false);
  const [showBackfillConfirm, setShowBackfillConfirm] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const settingsResult = await purchasesApi.getSettings();
        const inventorySettingsResult = await inventoryApi.getSettings().catch(() => null);

        const currentSettings = unwrap<any>(settingsResult)?.data ?? unwrap<any>(settingsResult);
        const invSettingsData = unwrap<any>(inventorySettingsResult)?.data ?? unwrap<any>(inventorySettingsResult);

        setSettings(normalizePurchaseDirectPolicy(currentSettings));
        setOriginalSettings(currentSettings);
        setInvSettings(invSettingsData);
      } catch (err: any) {
        console.error('Failed to load purchase settings', err);
        errorHandler.showError('Failed to load purchase settings.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const updateSetting = <K extends keyof PurchaseSettingsDTO>(field: K, value: PurchaseSettingsDTO[K]) => {
    setSettings((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const applyWorkflowMode = (mode: 'SIMPLE' | 'OPERATIONAL') => {
    setSettings((prev) => {
      if (!prev) return prev;
      const allowDirectInvoicing = mode === 'SIMPLE' ? true : prev.allowDirectInvoicing;
      return {
        ...prev,
        workflowMode: mode,
        allowDirectInvoicing,
        requirePOForStockItems: mode === 'SIMPLE' ? false : prev.requirePOForStockItems,
        governanceRules:
          mode === 'OPERATIONAL'
            ? reconcileCompanyDirectInvoiceRule(prev.governanceRules, allowDirectInvoicing)
            : prev.governanceRules,
      };
    });
  };

  const applyDirectInvoicingPolicy = (allowDirectInvoicing: boolean) => {
    setSettings((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        allowDirectInvoicing,
        governanceRules: reconcileCompanyDirectInvoiceRule(prev.governanceRules, allowDirectInvoicing),
      };
    });
  };

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);
  const accountingMode = resolveInventoryAccountingMode(invSettings);
  const simpleWorkflowDisabled = accountingMode === 'PERPETUAL';

  const addRule = () => {
    if (!newRule.persona || !newRule.action || !newRule.scope) return;

    const rule: PurchaseGovernanceRuleDTO = {
      id: Date.now().toString(36),
      persona: newRule.persona as any,
      action: newRule.action as any,
      scope: newRule.scope as any,
      branchId: newRule.branchId,
      formType: newRule.formType,
    };

    const currentRules = settings?.governanceRules || [];
    updateSetting('governanceRules', [...currentRules, rule]);
    setNewRule({ scope: 'company', action: 'allow', persona: 'direct' });
    setShowAddRule(false);
  };

  const removeRule = (id: string) => {
    const currentRules = settings?.governanceRules || [];
    updateSetting('governanceRules', currentRules.filter((r) => r.id !== id));
  };

  const handleBackfillApAccounts = async () => {
    try {
      setBackfilling(true);
      const result = await purchasesApi.backfillPartyAccounts();
      if (result.errors.length > 0) {
        toast(
          `Backfill completed with issues. Created: ${result.created}, skipped: ${result.skipped}, errors: ${result.errors.length}`,
          { icon: 'ℹ️' }
        );
      } else {
        toast.success(`Backfill completed. Created: ${result.created}, skipped: ${result.skipped}.`);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Failed to backfill vendor AP sub-accounts.');
    } finally {
      setBackfilling(false);
      setShowBackfillConfirm(false);
    }
  };

  const liabilityAccounts = useMemo(
    () =>
      validAccounts.filter((account) => {
        const classification = String(account.classification || account.type || '').toUpperCase();
        return classification === 'LIABILITY';
      }),
    [validAccounts]
  );

  const expenseAccounts = useMemo(
    () =>
      validAccounts.filter((account) => {
        const classification = String(account.classification || account.type || '').toUpperCase();
        return classification === 'EXPENSE';
      }),
    [validAccounts]
  );

  const handleSave = async () => {
    if (!settings) return;
    if (!settings.defaultAPAccountId) {
      errorHandler.showError('Default Accounts Payable account is required.');
      return;
    }
    if (accountingMode === 'PERPETUAL' && !settings.defaultGRNIAccountId) {
      errorHandler.showError('Default GRNI account is required for perpetual purchasing workflows.');
      return;
    }

    try {
      setSaving(true);
      const settingsForSave =
        settings.workflowMode === 'OPERATIONAL'
          ? {
              ...settings,
              governanceRules: reconcileCompanyDirectInvoiceRule(
                settings.governanceRules,
                settings.allowDirectInvoicing
              ),
            }
          : {
              ...settings,
              allowDirectInvoicing: true,
            };
      const payload: Partial<PurchaseSettingsDTO> = {
        workflowMode: settingsForSave.workflowMode,
        allowDirectInvoicing: settingsForSave.workflowMode === 'SIMPLE' ? true : settingsForSave.allowDirectInvoicing,
        requirePOForStockItems: settingsForSave.workflowMode === 'SIMPLE' ? false : settingsForSave.requirePOForStockItems,
        defaultAPAccountId: settingsForSave.defaultAPAccountId,
        apParentAccountId: settingsForSave.apParentAccountId || undefined,
        partyAccountCodeFormat: (settingsForSave.partyAccountCodeFormat || PARTY_ACCOUNT_CODE_FORMAT_FALLBACK).trim(),
        defaultPurchaseExpenseAccountId: settingsForSave.defaultPurchaseExpenseAccountId || undefined,
        defaultGRNIAccountId: accountingMode === 'PERPETUAL' ? settingsForSave.defaultGRNIAccountId || undefined : undefined,
        allowOverDelivery: settingsForSave.allowOverDelivery,
        allowOverpayment: settingsForSave.allowOverpayment,
        deriveLinePriceAcrossUom: settingsForSave.deriveLinePriceAcrossUom === true,
        overDeliveryTolerancePct: settingsForSave.overDeliveryTolerancePct,
        overInvoiceTolerancePct: settingsForSave.overInvoiceTolerancePct,
        defaultPaymentTermsDays: settingsForSave.defaultPaymentTermsDays,
        purchaseVoucherTypeId: settingsForSave.purchaseVoucherTypeId || undefined,
        defaultWarehouseId: settingsForSave.defaultWarehouseId || undefined,
        poNumberPrefix: settingsForSave.poNumberPrefix,
        poNumberNextSeq: settingsForSave.poNumberNextSeq,
        grnNumberPrefix: settingsForSave.grnNumberPrefix,
        grnNumberNextSeq: settingsForSave.grnNumberNextSeq,
        piNumberPrefix: settingsForSave.piNumberPrefix,
        piNumberNextSeq: settingsForSave.piNumberNextSeq,
        prNumberPrefix: settingsForSave.prNumberPrefix,
        prNumberNextSeq: settingsForSave.prNumberNextSeq,
        exchangeGainLossAccountId: settingsForSave.exchangeGainLossAccountId || undefined,
        governanceRules: settingsForSave.governanceRules || [],
        defaultPurchaseInvoicePersona: settingsForSave.defaultPurchaseInvoicePersona,
      };

      const result = await purchasesApi.updateSettings(payload);
      const saved = unwrap<PurchaseSettingsDTO>(result);
      setSettings(saved);
      setOriginalSettings(saved);
      errorHandler.showSuccess('Purchase settings updated successfully.');
    } catch (err: any) {
      console.error('Failed to save purchase settings', err);
      errorHandler.showError(err?.response?.data?.error?.message || 'Failed to save purchase settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!settings) return null;

  const personaPolicy = {
    direct: isPersonaAllowedByGovernance(settings.workflowMode, settings.governanceRules as any, 'direct'),
    linked: isPersonaAllowedByGovernance(settings.workflowMode, settings.governanceRules as any, 'linked'),
    service: isPersonaAllowedByGovernance(settings.workflowMode, settings.governanceRules as any, 'service'),
  };

  const tabs = [
    { id: 'policy', label: t('purchaseSettings.labels.procurementPolicy', 'Procurement Policy'), icon: ShieldCheck },
    { id: 'accounts', label: t('purchaseSettings.labels.accountDefaults', 'Account Defaults'), icon: DollarSign },
    { id: 'numbering', label: t('purchaseSettings.labels.noSeries', 'No. Series'), icon: Hash },
    { id: 'governance', label: t('purchaseSettings.labels.governance', 'Governance'), icon: Shield },
    { id: 'controls', label: t('controls:settingsTabLabel'), icon: ShieldCheck },
  ];

  return (
    <>
      <ModuleSettingsLayout
        title={t('purchaseSettings.title', 'Purchase Settings')}
        subtitle={t('purchaseSettings.title', 'Control purchasing workflow, posting defaults, tolerances, and numbering.')}
        tabs={tabs as any}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as TabId)}
        hasChanges={hasChanges}
        onSave={handleSave}
        onDiscard={() => {
          setSettings(originalSettings);
          toast('Changes discarded', { icon: 'ℹ️' });
        }}
        saving={saving}
      >
      <AccountingIntegrationStatus
        moduleCode="purchases"
        hasMappings={!!settings?.defaultAPAccountId}
        integrationRoute="/purchases/financial-integration"
      />

      {activeTab === 'policy' && (
        <SettingsSection
          title={t('purchaseSettings.title', 'Procurement Policy')}
          description="Define which purchasing documents users can work with and how operational controls behave."
          onSave={handleSave}
          disabled={!hasChanges || saving}
          saving={saving}
          hideSaveButton={true}
        >
          <Card className="p-6">
            <div className="grid gap-8 md:grid-cols-2">
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="mb-3 text-sm font-bold text-gray-900">Workflow Mode</div>
                  <div className="space-y-3">
                    <label className={`flex items-start gap-3 rounded-lg border p-4 ${simpleWorkflowDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${settings.workflowMode === 'SIMPLE' ? 'border-indigo-500' : 'border-gray-200 hover:border-indigo-200'}`}>
                      <input
                        type="radio"
                        name="purchase-settings-workflow"
                        checked={settings.workflowMode === 'SIMPLE'}
                        onChange={() => applyWorkflowMode('SIMPLE')}
                        disabled={simpleWorkflowDisabled}
                      />
                      <div>
                        <div className="text-sm font-bold text-gray-900">Simple</div>
                        <div className="text-xs uppercase tracking-tight text-gray-500">Show invoices and returns only.</div>
                      </div>
                    </label>

                    <label className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer ${settings.workflowMode === 'OPERATIONAL' ? 'border-indigo-500' : 'border-gray-200 hover:border-indigo-200'}`}>
                      <input
                        type="radio"
                        name="purchase-settings-workflow"
                        checked={settings.workflowMode === 'OPERATIONAL'}
                        onChange={() => applyWorkflowMode('OPERATIONAL')}
                      />
                      <div>
                        <div className="text-sm font-bold text-gray-900">Operational</div>
                        <div className="text-xs uppercase tracking-tight text-gray-500">Expose orders and goods receipts.</div>
                      </div>
                    </label>
                  </div>

                  {simpleWorkflowDisabled && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Perpetual accounting requires the operational workflow because Goods Receipts create inventory accounting.
                    </div>
                  )}
                </div>

                {settings.workflowMode === 'OPERATIONAL' ? (
                  <>
                    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-indigo-200">
                      <div>
                        <div className="text-sm font-bold text-gray-900">Allow Direct Invoicing</div>
                        <div className="text-xs uppercase tracking-tight text-gray-500">Invoice vendors without a preceding PO/GRN.</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.allowDirectInvoicing}
                        onChange={(e) => applyDirectInvoicingPolicy(e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </label>

                    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-indigo-200">
                      <div>
                        <div className="text-sm font-bold text-gray-900">Require PO For Stock Items</div>
                        <div className="text-xs uppercase tracking-tight text-gray-500">Force stock-item procurement to start from a Purchase Order.</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.requirePOForStockItems}
                        onChange={(e) => updateSetting('requirePOForStockItems', e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </label>
                  </>
                ) : (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 shadow-sm">
                    Simple workflow automatically enables direct invoicing and hides Purchase Orders and Goods Receipts from end users.
                  </div>
                )}

              </div>

              <div className="space-y-6">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Default Payment Terms (Days)</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={settings.defaultPaymentTermsDays}
                    onChange={(e) => updateSetting('defaultPaymentTermsDays', Number(e.target.value))}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Over-delivery (%)</label>
                    <input
                      type="number"
                      step={0.01}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={settings.overDeliveryTolerancePct}
                      onChange={(e) => updateSetting('overDeliveryTolerancePct', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Over-invoice (%)</label>
                    <input
                      type="number"
                      step={0.01}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={settings.overInvoiceTolerancePct}
                      onChange={(e) => updateSetting('overInvoiceTolerancePct', Number(e.target.value))}
                    />
                  </div>
                </div>

                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-indigo-200">
                  <div className="pr-4">
                    <div className="text-sm font-bold text-gray-900">Allow over-payment</div>
                    <div className="text-xs text-gray-500">When on, a payment may exceed the invoice total. The extra becomes a credit on the vendor's account (their AP balance goes negative) and offsets their future bills.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.allowOverpayment === true}
                    onChange={(e) => updateSetting('allowOverpayment', e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-indigo-200">
                  <div className="pr-4">
                    <div className="text-sm font-bold text-gray-900">Derive remembered prices across UOM</div>
                    <div className="text-xs text-gray-500">When on, same-vendor same-currency price memory can convert between item UOMs. It never converts across currencies.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.deriveLinePriceAcrossUom === true}
                    onChange={(e) => updateSetting('deriveLinePriceAcrossUom', e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </label>
              </div>
            </div>
          </Card>
        </SettingsSection>
      )}

      {activeTab === 'accounts' && (
        <SettingsSection
          title={t('purchaseSettings.title', 'Account Defaults')}
          description="Standard general ledger accounts used for purchasing transactions."
          onSave={handleSave}
          disabled={!hasChanges || saving}
          saving={saving}
          hideSaveButton={true}
        >
          <Card className="p-6">
            <div className="space-y-8">
              <div className="grid gap-8 md:grid-cols-2">
                <div className="space-y-6">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Default Accounts Payable</label>
                    <AccountSelector
                      value={settings.defaultAPAccountId || ''}
                      onChange={(account: any) => updateSetting('defaultAPAccountId', account?.id || '')}
                      accounts={liabilityAccounts}
                      placeholder="Select AP account"
                    />
                    <p className="mt-1.5 text-xs italic text-gray-500">Primary vendor liability account.</p>
                  </div>

                  <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 px-3 py-2">
                    <p className="text-xs font-semibold text-indigo-900">
                      {t('purchases.settings.apGeneration.title', 'AP Sub-account Generation')}
                    </p>
                    <p className="mt-1 text-[11px] text-indigo-700">
                      {t('purchases.settings.apGeneration.description', 'Configure how vendor-specific AP sub-accounts are generated during vendor creation.')}
                    </p>
                    <div className="mt-2">
                      <button
                        type="button"
                        className="rounded-md border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => setShowBackfillConfirm(true)}
                        disabled={backfilling}
                      >
                        {t('purchases.settings.apGeneration.backfillButton', 'Backfill vendor AP sub-accounts')}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t('purchases.settings.apParent.label', 'AP Parent Account')}
                    </label>
                    <AccountSelector
                      value={settings.apParentAccountId || ''}
                      onChange={(account: any) => updateSetting('apParentAccountId', account?.id || undefined)}
                      placeholder={t('purchases.settings.apParent.placeholder', 'Select AP parent account')}
                      allowedClassifications={['LIABILITY']}
                      contextLabel={t('purchases.settings.apParent.context', 'Liability')}
                      enforceClassification
                    />
                    <p className="mt-1.5 text-xs italic text-gray-500">
                      {t('purchases.settings.apParent.help', 'Parent account under which per-vendor AP sub-accounts are generated.')}
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t('purchases.settings.partyAccountFormat.label', 'AP Sub-account Code Format')}
                    </label>
                    {(() => {
                      const raw = (settings.partyAccountCodeFormat ?? '').trim();
                      const matched = PARTY_ACCOUNT_CODE_PRESETS.find((p) => p.template === raw);
                      const showCustom = apFormatCustom || (raw.length > 0 && !matched);
                      const selectValue = showCustom ? 'CUSTOM' : (matched ? matched.template : PARTY_ACCOUNT_CODE_PRESETS[0].template);
                      return (
                        <>
                          <select
                            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={selectValue}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'CUSTOM') { setApFormatCustom(true); }
                              else { setApFormatCustom(false); updateSetting('partyAccountCodeFormat', val); }
                            }}
                          >
                            {PARTY_ACCOUNT_CODE_PRESETS.map((p) => (
                              <option key={p.template} value={p.template}>{p.label}</option>
                            ))}
                            <option value="CUSTOM">{t('purchases.settings.partyAccountFormat.custom', 'Custom…')}</option>
                          </select>
                          {showCustom && (
                            <input
                              type="text"
                              autoFocus
                              className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              value={settings.partyAccountCodeFormat || ''}
                              onChange={(e) => updateSetting('partyAccountCodeFormat', e.target.value)}
                              placeholder={PARTY_ACCOUNT_CODE_FORMAT_FALLBACK}
                            />
                          )}
                        </>
                      );
                    })()}
                    <p className="mt-1.5 text-xs italic text-gray-500">
                      {t('purchases.settings.partyAccountFormat.help', 'Applied to every new vendor AP sub-account. Tokens: {parent}, {partyCode}, {seq3}.')}
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Default Purchase Expense</label>
                    <AccountSelector
                      value={settings.defaultPurchaseExpenseAccountId || ''}
                      onChange={(account: any) => updateSetting('defaultPurchaseExpenseAccountId', account?.id || undefined)}
                      accounts={expenseAccounts}
                      placeholder="Select expense fallback for non-stock items"
                    />
                    <p className="mt-1.5 text-xs italic text-gray-500">Optional fallback for service and non-stock posting.</p>
                  </div>

                  {accountingMode === 'PERPETUAL' && (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Default GRNI</label>
                      <AccountSelector
                        value={settings.defaultGRNIAccountId || ''}
                        onChange={(account: any) => updateSetting('defaultGRNIAccountId', account?.id || undefined)}
                        accounts={liabilityAccounts}
                        placeholder="Select GRNI account"
                      />
                      <p className="mt-1.5 text-xs italic text-gray-500">Required for perpetual receipt accrual posting.</p>
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">FX Gain/Loss Account</label>
                    <AccountSelector
                      value={settings.exchangeGainLossAccountId || ''}
                      onChange={(account: any) => updateSetting('exchangeGainLossAccountId', account?.id || undefined)}
                      placeholder="Select FX account"
                    />
                    <p className="mt-1.5 text-xs italic text-gray-500">Used for posting supplier exchange differences.</p>
                  </div>
                </div>

                <div className="self-start rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="rounded-lg bg-indigo-50 p-1.5">
                      <Settings size={14} className="text-indigo-600" />
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-800">Linked Inventory Context</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Mode:</span>
                      <span className="font-bold text-indigo-700">{getAccountingModeLabel(accountingMode)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Inventory Asset:</span>
                      <span className="font-medium text-slate-700">
                        {invSettings?.defaultInventoryAssetAccountId
                          ? getAccountById(invSettings.defaultInventoryAssetAccountId)?.name || 'Account Assigned'
                          : 'Not Assigned'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Workflow:</span>
                      <span className="font-medium text-slate-700">{getWorkflowModeLabel(settings.workflowMode)}</span>
                    </div>
                  </div>
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <div className="flex gap-2">
                      <Info size={14} className="mt-0.5 flex-shrink-0 text-slate-400" />
                      <p className="text-[10px] italic leading-relaxed text-slate-500">
                        Purchase posting follows the inventory accounting mode chosen during inventory setup. Perpetual mode requires GRNI for receipt accruals.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </SettingsSection>
      )}

      {activeTab === 'numbering' && (
        <SettingsSection
          title={t('purchaseSettings.title', 'Document Numbering')}
          description="Prefixes and sequence counters for purchase documents."
          onSave={handleSave}
          disabled={!hasChanges || saving}
          saving={saving}
          hideSaveButton={true}
        >
          <Card className="p-6">
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Workflow mode: <span className="font-semibold">{getWorkflowModeLabel(settings.workflowMode)}</span>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {[
                { id: 'po', label: t('purchaseSettings.labels.purchaseOrders', 'Purchase Orders'), prefix: 'poNumberPrefix', seq: 'poNumberNextSeq' },
                { id: 'grn', label: t('purchaseSettings.labels.receiptsGRN', 'Receipts (GRN)'), prefix: 'grnNumberPrefix', seq: 'grnNumberNextSeq' },
                { id: 'pi', label: t('purchaseSettings.labels.invoicesPI', 'Invoices (PI)'), prefix: 'piNumberPrefix', seq: 'piNumberNextSeq' },
                { id: 'pr', label: t('purchaseSettings.labels.returnsPR', 'Returns (PR)'), prefix: 'prNumberPrefix', seq: 'prNumberNextSeq' },
              ].map((doc) => (
                <div key={doc.id} className="space-y-4 rounded-xl border border-slate-100 bg-slate-50 p-4 shadow-sm transition hover:border-indigo-100 hover:shadow-md">
                  <div className="mb-1 w-fit rounded border border-slate-100 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 shadow-sm">
                    {doc.label}
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Prefix</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-bold uppercase focus:ring-1 focus:ring-indigo-500"
                      value={(settings as any)[doc.prefix]}
                      onChange={(e) => updateSetting(doc.prefix as any, e.target.value.toUpperCase())}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Next Number</label>
                    <input
                      type="number"
                      min={1}
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-mono focus:ring-1 focus:ring-indigo-500"
                      value={(settings as any)[doc.seq]}
                      onChange={(e) => updateSetting(doc.seq as any, Number(e.target.value))}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </SettingsSection>
      )}

      {activeTab === 'governance' && (
        <SettingsSection
          title={t('purchaseSettings.title', 'Governance Rules')}
          description="Override default document policies at the company, branch, or form level."
          onSave={handleSave}
          disabled={!hasChanges || saving}
          saving={saving}
          hideSaveButton={true}
        >
          <div className="space-y-6">
            <Card className="p-6 border-indigo-100 bg-indigo-50/30">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-5 w-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-gray-900">
                  Base Policy (Workflow: {settings.workflowMode === 'SIMPLE' ? 'Simple' : 'Operational'})
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { persona: 'Direct', key: 'direct' as const, allowed: personaPolicy.direct },
                  { persona: 'Linked', key: 'linked' as const, allowed: personaPolicy.linked },
                  { persona: 'Service', key: 'service' as const, allowed: personaPolicy.service },
                ].map((p) => (
                  <div key={p.persona} className="flex flex-col items-center p-3 rounded-xl border border-white bg-white/50 shadow-sm">
                    <span className="text-xs font-medium text-gray-500 mb-2">{p.persona}</span>
                    {p.allowed ? (
                      <div className="flex items-center gap-1.5 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-xs font-bold uppercase">Allow</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-red-600">
                        <XCircle className="h-4 w-4" />
                        <span className="text-xs font-bold uppercase">Block</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-gray-500 italic">
                Base policies are derived from your active workflow mode. Use governance rules below to override these defaults.
              </p>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Active Overrides</h3>
                  <p className="text-xs text-gray-500">Specific rules that change the base policy behavior.</p>
                </div>
                {!showAddRule && (
                  <button
                    onClick={() => setShowAddRule(true)}
                    className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition"
                  >
                    <Plus className="h-4 w-4" />
                    Add Rule
                  </button>
                )}
              </div>

              {showAddRule && (
                <div className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Persona</label>
                      <select
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={newRule.persona}
                        onChange={(e) => setNewRule({ ...newRule, persona: e.target.value as any })}
                      >
                        <option value="direct">Direct</option>
                        <option value="linked">Linked</option>
                        <option value="service">Service</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Action</label>
                      <select
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={newRule.action}
                        onChange={(e) => setNewRule({ ...newRule, action: e.target.value as any })}
                      >
                        <option value="allow">Allow</option>
                        <option value="block">Block</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Scope</label>
                      <select
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={newRule.scope}
                        onChange={(e) => setNewRule({ ...newRule, scope: e.target.value as any })}
                      >
                        <option value="company">Company</option>
                        <option value="branch">Branch</option>
                        <option value="form">Form</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {newRule.scope === 'branch' && (
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Branch ID</label>
                        <input
                          type="text"
                          placeholder="e.g. branch-001"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          value={newRule.branchId || ''}
                          onChange={(e) => setNewRule({ ...newRule, branchId: e.target.value })}
                        />
                      </div>
                    )}
                    {newRule.scope === 'form' && (
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Form Type</label>
                        <input
                          type="text"
                          placeholder="e.g. purchase_invoice_direct"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          value={newRule.formType || ''}
                          onChange={(e) => setNewRule({ ...newRule, formType: e.target.value })}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowAddRule(false)}
                      className="rounded-lg px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addRule}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition"
                    >
                      Add Override Rule
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-hidden rounded-xl border border-gray-100 shadow-sm text-gray-900">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    <tr>
                      <th className="px-4 py-3">Persona</th>
                      <th className="px-4 py-3">Scope</th>
                      <th className="px-4 py-3">Target</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {settings.governanceRules && settings.governanceRules.length > 0 ? (
                      settings.governanceRules.map((rule) => (
                        <tr key={rule.id} className="hover:bg-slate-50 transition">
                          <td className="px-4 py-3 font-medium capitalize">{rule.persona}</td>
                          <td className="px-4 py-3 capitalize text-gray-600">{rule.scope}</td>
                          <td className="px-4 py-3 text-gray-500 italic">
                            {rule.scope === 'company' ? 'Global' : rule.scope === 'branch' ? rule.branchId : rule.formType}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${rule.action === 'allow' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {rule.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => removeRule(rule.id)}
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500 italic">
                          No override rules defined. Base policy applies to all documents.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </SettingsSection>
      )}

      {activeTab === 'controls' && (
        <ModuleControlsTab
          module="purchases"
          load={purchasesApi.getPolicies}
          save={purchasesApi.updatePolicies}
          knownActions={['invoicePosting', 'return']}
        />
      )}
      </ModuleSettingsLayout>
      <ConfirmDialog
        isOpen={showBackfillConfirm}
        title={t('purchases.settings.apGeneration.confirmTitle', 'Backfill Vendor AP Sub-accounts')}
        message={t(
          'purchases.settings.apGeneration.confirmMessage',
          'This will scan active vendors and create dedicated AP sub-accounts for parties that do not already have one under the configured AP parent.'
        )}
        confirmLabel={t('purchases.settings.apGeneration.confirmAction', 'Run Backfill')}
        cancelLabel={t('common.cancel', 'Cancel')}
        onConfirm={handleBackfillApAccounts}
        onCancel={() => setShowBackfillConfirm(false)}
        tone="warning"
        isConfirming={backfilling}
        icon={<AlertTriangle size={20} />}
      />
    </>
  );
};

export default PurchaseSettingsPage;
