import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { inventoryApi } from '../../../api/inventoryApi';
import { SalesMessagingAccountDTO, SalesSettingsDTO, salesApi, GovernanceRuleDTO } from '../../../api/salesApi';
import { Card } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { AccountSelector } from '../../accounting/components/shared/AccountSelector';
import { WarehouseSelector } from '../../../components/shared/selectors/WarehouseSelector';
import { useAccounts } from '../../../context/AccountsContext';
import { Loader2, Settings, ShieldCheck, DollarSign, Hash, Info, Shield, Plus, Trash2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { ModuleSettingsLayout, SettingsSection } from '../../../components/shared/ModuleSettingsLayout';
import { AccountingIntegrationStatus } from '../../../components/shared/AccountingIntegrationStatus';
import { errorHandler } from '../../../services/errorHandler';
import toast from 'react-hot-toast';
import {
  getAccountingModeLabel,
  getWorkflowModeLabel,
  resolveInventoryAccountingMode,
} from '../../../utils/documentPolicy';

const newClientId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
type TabId = 'policy' | 'accounts' | 'numbering' | 'governance';
const PARTY_ACCOUNT_CODE_FORMAT_FALLBACK = '{parent}-{partyCode}';

const SalesSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('policy');
  const [settings, setSettings] = useState<SalesSettingsDTO | null>(null);
  const [originalSettings, setOriginalSettings] = useState<SalesSettingsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { getAccountById } = useAccounts();
  const [invSettings, setInvSettings] = useState<any>(null);
  const [newRule, setNewRule] = useState<Partial<GovernanceRuleDTO>>({
    scope: 'company',
    action: 'allow',
    persona: 'direct',
  });
  const [showAddRule, setShowAddRule] = useState(false);
  const [credentialDraftByAccountId, setCredentialDraftByAccountId] = useState<Record<string, string>>({});
  const [showBackfillConfirm, setShowBackfillConfirm] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const settingsResult = await salesApi.getSettings();
        const inventorySettings = await inventoryApi.getSettings().catch(() => null);

        const currentSettings = unwrap<any>(settingsResult)?.data ?? unwrap<any>(settingsResult);
        const invSettingsData = unwrap<any>(inventorySettings)?.data ?? unwrap<any>(inventorySettings);
        if (!Array.isArray(currentSettings.messagingAccounts)) {
          currentSettings.messagingAccounts = [];
        }

        setSettings(currentSettings);
        setOriginalSettings(currentSettings);
        setInvSettings(invSettingsData);
      } catch (err: any) {
        console.error('Failed to load sales settings', err);
        errorHandler.showError('Failed to load sales settings.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const updateSetting = <K extends keyof SalesSettingsDTO>(field: K, value: SalesSettingsDTO[K]) => {
    setSettings((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const applyWorkflowMode = (mode: 'SIMPLE' | 'OPERATIONAL') => {
    setSettings((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        workflowMode: mode,
        allowDirectInvoicing: mode === 'SIMPLE' ? true : prev.allowDirectInvoicing,
        requireSOForStockItems: mode === 'SIMPLE' ? false : prev.requireSOForStockItems,
      };
    });
  };

  const hasCredentialChanges = Object.values(credentialDraftByAccountId).some((value) => value.trim().length > 0);
  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings) || hasCredentialChanges;
  const accountingMode = resolveInventoryAccountingMode(invSettings);
  const isPerpetual = accountingMode === 'PERPETUAL';

  const addRule = () => {
    if (!newRule.persona || !newRule.action || !newRule.scope) return;
    if (newRule.scope === 'form' && !newRule.formType?.trim()) return;

    const rule: GovernanceRuleDTO = {
      id: Date.now().toString(36),
      persona: newRule.persona as any,
      action: newRule.action as any,
      scope: newRule.scope as any,
      formType: newRule.scope === 'form' ? newRule.formType?.trim() : undefined,
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

  const updateMessagingAccount = (id: string, patch: Partial<SalesMessagingAccountDTO>) => {
    const current = settings?.messagingAccounts || [];
    updateSetting(
      'messagingAccounts',
      current.map((account) => (account.id === id ? { ...account, ...patch } : account))
    );
  };

  const addMessagingAccount = (channel: SalesMessagingAccountDTO['channel']) => {
    const current = settings?.messagingAccounts || [];
    const hasActiveDefault = current.some((account) => account.channel === channel && account.isActive !== false && account.isDefault);
    const provider: SalesMessagingAccountDTO['provider'] =
      channel === 'WHATSAPP' ? 'META_WHATSAPP_CLOUD' : channel === 'EMAIL' ? 'SMTP' : 'TELEGRAM_BOT';
    const account: SalesMessagingAccountDTO = {
      id: newClientId(),
      channel,
      provider,
      label: '',
      isDefault: !hasActiveDefault,
      isActive: true,
      phoneNumberE164: '',
      phoneNumberId: '',
      fromAddress: '',
      fromDisplayName: '',
      botUsername: '',
      apiVersion: channel === 'WHATSAPP' ? 'v22.0' : undefined,
      hasCredential: false,
    };
    updateSetting('messagingAccounts', [...current, account]);
  };

  const removeMessagingAccount = (id: string) => {
    const current = settings?.messagingAccounts || [];
    updateSetting(
      'messagingAccounts',
      current.filter((account) => account.id !== id)
    );
    setCredentialDraftByAccountId((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const markMessagingAccountAsDefault = (id: string, channel: SalesMessagingAccountDTO['channel']) => {
    const current = settings?.messagingAccounts || [];
    updateSetting(
      'messagingAccounts',
      current.map((account) =>
        account.channel === channel
          ? { ...account, isDefault: account.id === id }
          : account
      )
    );
  };

  const handleBackfillArAccounts = async () => {
    try {
      setBackfilling(true);
      const result = await salesApi.backfillPartyAccounts();
      if (result.errors.length > 0) {
        toast(
          `Backfill completed with issues. Created: ${result.created}, skipped: ${result.skipped}, errors: ${result.errors.length}`,
          { icon: 'ℹ️' }
        );
      } else {
        toast.success(`Backfill completed. Created: ${result.created}, skipped: ${result.skipped}.`);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Failed to backfill customer AR sub-accounts.');
    } finally {
      setBackfilling(false);
      setShowBackfillConfirm(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    if (!settings.defaultRevenueAccountId) {
      errorHandler.showError('Default Revenue account is required.');
      return;
    }

    try {
      setSaving(true);
      const payload: Partial<SalesSettingsDTO> = {
        workflowMode: settings.workflowMode,
        allowDirectInvoicing: settings.workflowMode === 'SIMPLE' ? true : settings.allowDirectInvoicing,
        requireSOForStockItems: settings.workflowMode === 'SIMPLE' ? false : settings.requireSOForStockItems,
        arParentAccountId: settings.arParentAccountId || undefined,
        partyAccountCodeFormat: (settings.partyAccountCodeFormat || PARTY_ACCOUNT_CODE_FORMAT_FALLBACK).trim(),
        defaultRevenueAccountId: settings.defaultRevenueAccountId,
        defaultSalesExpenseAccountId: settings.defaultSalesExpenseAccountId || undefined,
        defaultRefundAccountId: settings.defaultRefundAccountId || undefined,
        restockingFeeAccountId: settings.restockingFeeAccountId || undefined,
        allowOverDelivery: settings.allowOverDelivery,
        overDeliveryTolerancePct: settings.overDeliveryTolerancePct,
        overInvoiceTolerancePct: settings.overInvoiceTolerancePct,
        defaultPaymentTermsDays: settings.defaultPaymentTermsDays,
        messagingAccounts: (settings.messagingAccounts || []).map((account) => ({
          ...account,
          credential: credentialDraftByAccountId[account.id]?.trim() || undefined,
        })),
        governanceRules: settings.governanceRules || [],
        defaultSalesInvoicePersona: settings.defaultSalesInvoicePersona,
        defaultWarehouseId: settings.defaultWarehouseId || undefined,
        soNumberPrefix: settings.soNumberPrefix,
        soNumberNextSeq: settings.soNumberNextSeq,
        dnNumberPrefix: settings.dnNumberPrefix,
        dnNumberNextSeq: settings.dnNumberNextSeq,
        siNumberPrefix: settings.siNumberPrefix,
        siNumberNextSeq: settings.siNumberNextSeq,
        srNumberPrefix: settings.srNumberPrefix,
        srNumberNextSeq: settings.srNumberNextSeq,
        quoteNumberPrefix: settings.quoteNumberPrefix,
        quoteNumberNextSeq: settings.quoteNumberNextSeq,
      };

      const result = await salesApi.updateSettings(payload);
      const saved = unwrap<SalesSettingsDTO>(result);
      saved.messagingAccounts = (saved.messagingAccounts || []).map((account) => ({
        ...account,
        credential: undefined,
      }));
      setSettings(saved);
      setOriginalSettings(saved);
      setCredentialDraftByAccountId({});
      errorHandler.showSuccess('Sales settings updated successfully.');
    } catch (err: any) {
      console.error('Failed to save sales settings', err);
      errorHandler.showError(err?.response?.data?.error?.message || err?.message || 'Failed to save sales settings.');
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

  const tabs = [
    { id: 'policy', label: 'Sales Policy', icon: ShieldCheck },
    { id: 'accounts', label: 'Account Defaults', icon: DollarSign },
    { id: 'numbering', label: 'No. Series', icon: Hash },
    { id: 'governance', label: 'Governance', icon: Shield },
  ];

  return (
    <>
      <ModuleSettingsLayout
        title="Sales Settings"
        subtitle="Control sales workflow, account defaults, tolerances, and numbering."
        tabs={tabs as any}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as TabId)}
        hasChanges={hasChanges}
        onSave={handleSave}
        onDiscard={() => {
          setSettings(originalSettings);
          setCredentialDraftByAccountId({});
          toast('Changes discarded', { icon: 'ℹ️' });
        }}
        saving={saving}
      >
      <AccountingIntegrationStatus
        moduleCode="sales"
        hasMappings={!!settings?.defaultRevenueAccountId}
        integrationRoute="/sales/financial-integration"
      />

      {activeTab === 'policy' && (
        <SettingsSection
          title="Sales Policy"
          description="Define which sales documents users can work with and how operational controls behave."
          onSave={handleSave}
          disabled={!hasChanges || saving}
          saving={saving}
          hideSaveButton={true}
        >
          <Card className="p-6">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="mb-3 text-sm font-bold text-gray-900">Workflow Mode</div>
                  <div className="space-y-3">
                    <label className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer ${settings.workflowMode === 'SIMPLE' ? 'border-indigo-500 bg-indigo-50/20' : 'border-gray-200 hover:border-indigo-200'}`}>
                      <input
                        type="radio"
                        name="sales-settings-workflow"
                        checked={settings.workflowMode === 'SIMPLE'}
                        onChange={() => applyWorkflowMode('SIMPLE')}
                      />
                      <div>
                        <div className="text-sm font-bold text-gray-900">Simple</div>
                        <div className="text-xs text-gray-500 uppercase tracking-tight">Show invoices and returns only.</div>
                      </div>
                    </label>

                    <label className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer ${settings.workflowMode === 'OPERATIONAL' ? 'border-indigo-500' : 'border-gray-200 hover:border-indigo-200'}`}>
                      <input
                        type="radio"
                        name="sales-settings-workflow"
                        checked={settings.workflowMode === 'OPERATIONAL'}
                        onChange={() => applyWorkflowMode('OPERATIONAL')}
                      />
                      <div>
                        <div className="text-sm font-bold text-gray-900">Operational</div>
                        <div className="text-xs text-gray-500 uppercase tracking-tight">Expose orders and delivery documents.</div>
                      </div>
                    </label>
                  </div>
                  {isPerpetual && settings.workflowMode === 'SIMPLE' && (
                    <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                      <div className="flex gap-2">
                        <Info size={14} className="flex-shrink-0" />
                        <span>
                          <strong>Policy Note:</strong> You are using <strong>Perpetual</strong> accounting with <strong>Simple</strong> workflow. Invoices will automatically trigger both stock movements and accounting effects.
                        </span>
                      </div>
                    </div>
                  )}
                  {settings.workflowMode === 'SIMPLE' && (
                    <label className="mt-3 flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded border-gray-300"
                        checked={settings.showOperationalDocsInSimple === true}
                        onChange={(e) =>
                          setSettings((prev) =>
                            prev ? { ...prev, showOperationalDocsInSimple: e.target.checked } : prev
                          )
                        }
                      />
                      <span className="text-xs">
                        <span className="font-semibold text-gray-900">
                          Show Sales Orders & Delivery Notes anyway
                        </span>
                        <span className="ml-1 text-gray-500">
                          Use these forms occasionally without leaving Simple mode.
                        </span>
                      </span>
                    </label>
                  )}
                  <label className="mt-3 flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-gray-300"
                      checked={settings.allowCreditOverride !== false}
                      onChange={(e) =>
                        setSettings((prev) =>
                          prev ? { ...prev, allowCreditOverride: e.target.checked } : prev
                        )
                      }
                    />
                    <span className="text-xs">
                      <span className="font-semibold text-gray-900">
                        Allow credit-limit overrides
                      </span>
                      <span className="ml-1 text-gray-500">
                        When off, BLOCK policy is absolute — no one can bypass it. Requires the{' '}
                        <code className="rounded bg-slate-100 px-1">sales.creditOverride</code> permission
                        when on (Owner always allowed).
                      </span>
                    </span>
                  </label>
                </div>

                {settings.workflowMode === 'OPERATIONAL' ? (
                  <>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
                      <div className="flex gap-2">
                        <Info size={14} className="flex-shrink-0 text-amber-700 mt-0.5" />
                        <div className="text-xs text-amber-800">
                          {t('sales.governance.settingsOperationalHint', 'Operational workflow blocks direct invoicing by default. To allow direct invoices, add a governance rule in the')}{' '}
                          <button onClick={() => setActiveTab('governance')} className="underline font-semibold hover:text-amber-900">{t('sales.governance.goToGovernanceTab', 'Governance tab')}</button>.
                        </div>
                      </div>
                    </div>

                    <label className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-white cursor-pointer hover:border-indigo-200 transition shadow-sm">
                      <div>
                        <div className="text-sm font-bold text-gray-900">Require SO for Stock Items</div>
                        <div className="text-xs text-gray-500 uppercase tracking-tight">Force Sales Order workflow for inventory.</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.requireSOForStockItems}
                        onChange={(e) => updateSetting('requireSOForStockItems', e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </label>
                  </>
                ) : (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 shadow-sm">
                    Simple workflow enables direct invoicing by default. Sales Orders and Delivery Notes are hidden from end users.
                  </div>
                )}

              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default Payment Terms (Days)</label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Over-delivery (%)</label>
                    <input
                      type="number"
                      step={0.01}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={settings.overDeliveryTolerancePct}
                      onChange={(e) => updateSetting('overDeliveryTolerancePct', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Over-invoice (%)</label>
                    <input
                      type="number"
                      step={0.01}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={settings.overInvoiceTolerancePct}
                      onChange={(e) => updateSetting('overInvoiceTolerancePct', Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </SettingsSection>
      )}

      {activeTab === 'accounts' && (
        <SettingsSection
          title="Account Defaults"
          description="Standard general ledger accounts used for sales transactions."
          onSave={handleSave}
          disabled={!hasChanges || saving}
          saving={saving}
          hideSaveButton={true}
        >
          <Card className="p-6">
            <div className="space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Default Revenue Account</label>
                    <AccountSelector
                      value={settings.defaultRevenueAccountId}
                      onChange={(account: any) => updateSetting('defaultRevenueAccountId', account?.id || '')}
                      placeholder="Select Revenue account"
                      allowedClassifications={['REVENUE']}
                      contextLabel="Income"
                    />
                    <p className="mt-1.5 text-xs text-gray-500 italic">Global fallback for all Sales Invoices.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Default Refund Account</label>
                    <AccountSelector
                      value={settings.defaultRefundAccountId}
                      onChange={(account: any) => updateSetting('defaultRefundAccountId', account?.id || undefined)}
                      placeholder="Select Cash / Bank account"
                      allowedClassifications={['ASSET']}
                      contextLabel="Cash/Bank (Asset)"
                    />
                    <p className="mt-1.5 text-xs text-gray-500 italic">Used when a Sales Return is posted with settlement mode = Refund. Can be overridden per return.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Restocking Fee Income Account</label>
                    <AccountSelector
                      value={settings.restockingFeeAccountId}
                      onChange={(account: any) => updateSetting('restockingFeeAccountId', account?.id || undefined)}
                      placeholder="Select Other Income / Fee Income account"
                      allowedClassifications={['REVENUE']}
                      contextLabel="Income"
                    />
                    <p className="mt-1.5 text-xs text-gray-500 italic">Where restocking fees are booked. Keep separate from product revenue (e.g. "Other Operating Income"). Falls back to the line's revenue account if unset.</p>
                  </div>

                  <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 px-3 py-2">
                    <p className="text-xs font-semibold text-indigo-900">
                      {t('sales.settings.arGeneration.title', 'AR Sub-account Generation')}
                    </p>
                    <p className="mt-1 text-[11px] text-indigo-700">
                      {t('sales.settings.arGeneration.description', 'Configure how customer-specific AR sub-accounts are generated during customer creation.')}
                    </p>
                    <div className="mt-2">
                      <button
                        type="button"
                        className="rounded-md border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => setShowBackfillConfirm(true)}
                        disabled={backfilling}
                      >
                        {t('sales.settings.arGeneration.backfillButton', 'Backfill customer AR sub-accounts')}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('sales.settings.arParent.label', 'AR Parent Account')}
                    </label>
                    <AccountSelector
                      value={settings.arParentAccountId || ''}
                      onChange={(account: any) => updateSetting('arParentAccountId', account?.id || undefined)}
                      placeholder={t('sales.settings.arParent.placeholder', 'Select AR parent account')}
                      allowedClassifications={['ASSET']}
                      contextLabel={t('sales.settings.arParent.context', 'Asset')}
                      enforceClassification
                    />
                    <p className="mt-1.5 text-xs text-gray-500 italic">
                      {t('sales.settings.arParent.help', 'Parent account under which per-customer AR sub-accounts are generated.')}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('sales.settings.partyAccountFormat.label', 'AR Sub-account Code Format')}
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={settings.partyAccountCodeFormat || PARTY_ACCOUNT_CODE_FORMAT_FALLBACK}
                      onChange={(e) => updateSetting('partyAccountCodeFormat', e.target.value)}
                      placeholder={PARTY_ACCOUNT_CODE_FORMAT_FALLBACK}
                    />
                    <p className="mt-1.5 text-xs text-gray-500 italic">
                      {t('sales.settings.partyAccountFormat.help', 'Tokens: {parent}, {partyCode}, {seq3}. Example: {parent}-{partyCode}.')}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Default Warehouse</label>
                    <WarehouseSelector
                      value={settings.defaultWarehouseId}
                      onChange={(warehouse: any) => updateSetting('defaultWarehouseId', warehouse?.id || '')}
                      placeholder="Select Warehouse"
                    />
                    <p className="mt-1.5 text-xs text-gray-500 italic">Used when no warehouse is specified on a sales line or invoice header.</p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 shadow-sm self-start">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-indigo-50 rounded-lg">
                      <Settings size={14} className="text-indigo-600" />
                    </div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Linked Inventory Context</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Mode:</span>
                      <span className="font-bold text-indigo-700">{getAccountingModeLabel(accountingMode)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Inventory Asset:</span>
                      <span className="font-medium text-slate-700">
                        {invSettings?.defaultInventoryAssetAccountId ? (getAccountById(invSettings.defaultInventoryAssetAccountId)?.name || 'Account Assigned') : 'Not Assigned'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">COGS Account:</span>
                      <span className="font-medium text-slate-700">
                        {invSettings?.defaultCOGSAccountId ? (getAccountById(invSettings.defaultCOGSAccountId)?.name || 'Account Assigned') : 'Not Assigned'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex gap-2">
                      <Info size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
                      <p className="text-[10px] leading-relaxed text-slate-500 italic">
                        Sales posting follows the inventory accounting mode chosen during inventory setup.
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
          title="Document Numbering"
          description="Prefixes and sequence counters for sales documents."
          onSave={handleSave}
          disabled={!hasChanges || saving}
          saving={saving}
          hideSaveButton={true}
        >
          <Card className="p-6">
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Workflow mode: <span className="font-semibold">{getWorkflowModeLabel(settings.workflowMode)}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              {[
                { id: 'qt', label: 'Quotes (QT)', prefix: 'quoteNumberPrefix', seq: 'quoteNumberNextSeq' },
                { id: 'so', label: 'Sales Orders', prefix: 'soNumberPrefix', seq: 'soNumberNextSeq' },
                { id: 'dn', label: 'Deliveries (DN)', prefix: 'dnNumberPrefix', seq: 'dnNumberNextSeq' },
                { id: 'si', label: 'Invoices (SI)', prefix: 'siNumberPrefix', seq: 'siNumberNextSeq' },
                { id: 'sr', label: 'Returns (SR)', prefix: 'srNumberPrefix', seq: 'srNumberNextSeq' },
              ].map((doc) => (
                <div key={doc.id} className="space-y-4 p-4 rounded-xl border border-slate-100 bg-slate-50 shadow-sm transition hover:shadow-md hover:border-indigo-100">
                  <div className="bg-white px-2 py-1 rounded text-[10px] font-bold text-slate-400 uppercase tracking-widest w-fit mb-1 border border-slate-100 shadow-sm">
                    {doc.label}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Prefix</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-bold uppercase focus:ring-1 focus:ring-indigo-500"
                      value={(settings as any)[doc.prefix]}
                      onChange={(e) => updateSetting(doc.prefix as any, e.target.value.toUpperCase())}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Next Number</label>
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
          title="Governance Rules"
          description={t('sales.governance.sectionDescription', 'Override default document policies at the company or form level.')}
          onSave={handleSave}
          disabled={!hasChanges || saving}
          saving={saving}
          hideSaveButton={true}
        >
          <div className="space-y-6">
            {/* Base Policy Summary */}
            <Card className="p-6 border-indigo-100 bg-indigo-50/30">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-5 w-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-gray-900">
                  Base Policy (Workflow: {settings.workflowMode === 'SIMPLE' ? 'Simple' : 'Operational'})
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { persona: 'Direct', allowed: settings.workflowMode === 'SIMPLE' },
                  { persona: 'Linked', allowed: settings.workflowMode === 'OPERATIONAL' },
                  { persona: 'Service', allowed: true },
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

            {/* Governance Rules List */}
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
                        onChange={(e) => setNewRule({
                          ...newRule,
                          scope: e.target.value as any,
                          branchId: undefined,
                          formType: e.target.value === 'form' ? newRule.formType : undefined,
                        })}
                      >
                        <option value="company">Company</option>
                        <option value="form">Form</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {newRule.scope === 'form' && (
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Form Type</label>
                        <input
                          type="text"
                          placeholder="e.g. sales_invoice_direct"
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
                            {rule.scope === 'company'
                              ? 'Global'
                              : rule.scope === 'branch'
                                ? t('sales.governance.branchRuleDeferred', '{{branchId}} (not active on invoices yet)', { branchId: rule.branchId || 'Branch rule' })
                                : rule.formType}
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
      </ModuleSettingsLayout>
    <ConfirmDialog
      isOpen={showBackfillConfirm}
      title={t('sales.settings.arGeneration.confirmTitle', 'Backfill Customer AR Sub-accounts')}
      message={t(
        'sales.settings.arGeneration.confirmMessage',
        'This will scan active customers and create dedicated AR sub-accounts for parties that do not already have one under the configured AR parent.'
      )}
      confirmLabel={t('sales.settings.arGeneration.confirmAction', 'Run Backfill')}
      cancelLabel={t('common.cancel', 'Cancel')}
      onConfirm={handleBackfillArAccounts}
      onCancel={() => setShowBackfillConfirm(false)}
      tone="warning"
      isConfirming={backfilling}
      icon={<AlertTriangle size={20} />}
    />
  </>
  );
};

export default SalesSettingsPage;
