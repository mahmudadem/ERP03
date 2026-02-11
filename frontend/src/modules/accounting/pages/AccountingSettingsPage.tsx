import React, { useState, useEffect } from 'react';
import { Settings, Shield, Lock, Building2, DollarSign, AlertTriangle, Globe, Calendar, Layout, Save, Coins, CreditCard, Plus, Trash2, X, CheckCircle2, Info, RefreshCw, Check } from 'lucide-react';
import { CompanyCurrencySettings } from './settings/CompanyCurrencySettings';
import client from '../../../api/client';
import { useAuth } from '../../../hooks/useAuth';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { errorHandler } from '../../../services/errorHandler';
import { accountingApi, FiscalYearDTO } from '../../../api/accountingApi';
import { 
  InstructionsButton, 
  generalSettingsInstructions,
  currenciesInstructions,
  policiesInstructions,
  paymentMethodsInstructions,
  costCenterInstructions,
  errorModeInstructions,
  fiscalYearInstructions
} from '../../../components/instructions';

interface PolicyConfig {
  // Approval Policy V1 Toggles
  financialApprovalEnabled: boolean;      // FA: Role-based financial approval
  faApplyMode: 'ALL' | 'MARKED_ONLY';     // FA scope: all vouchers or only marked accounts
  custodyConfirmationEnabled: boolean;    // CC: User-bound custody confirmation
  
  // Smart CC Settings (V2)
  ccThirdPartyMode?: 'RECEIVER_ONLY' | 'BOTH';  // Who confirms third-party vouchers
  ccAmountThreshold?: number;                     // Min amount for CC
  ccAllowSelfConfirmation?: boolean;              // Allow creator to confirm own receipt
  ccBlockIfNoCustodian?: boolean;                 // Block if custodian unassigned
  ccReversalMode?: 'SAME_AS_ORIGINAL' | 'AUTO_APPROVE';  // Reversal CC behavior
  
  // Legacy (kept for backward compatibility)
  approvalRequired: boolean;              // Maps to financialApprovalEnabled
  
  // Mode A Controls (V1)
  autoPostEnabled: boolean;               // Auto-post when approved
  allowEditDeletePosted: boolean;         // Allow editing posted vouchers
  
  periodLockEnabled: boolean;
  lockedThroughDate?: string;
  accountAccessEnabled: boolean;
  costCenterPolicy: {
    enabled: boolean;
    requiredFor: {
      accountTypes?: string[];
      accountIds?: string[];
    };
  };
  policyErrorMode: 'FAIL_FAST' | 'AGGREGATE';
  updatedAt?: string;
  updatedBy?: string;
  paymentMethods?: PaymentMethodDefinition[];
}

interface PaymentMethodDefinition {
  id: string;
  name: string;
  isEnabled: boolean;
}

const SectionHeader: React.FC<{ 
  title: string; 
  description: string; 
  onSave: () => void;
  disabled: boolean;
  saving: boolean;
}> = ({ title, description, onSave, disabled, saving }) => (
  <div className="flex flex-col gap-4 mb-8">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)] mb-1">{title}</h2>
        <p className="text-gray-600 dark:text-[var(--color-text-secondary)]">{description}</p>
      </div>
      <button
        onClick={onSave}
        disabled={disabled}
        className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm font-bold active:scale-95"
      >
        {saving ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <Save size={18} />
        )}
        {saving ? 'Saving...' : `Save ${title}`}
      </button>
    </div>
  </div>
);

export const AccountingSettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'currencies' | 'policies' | 'payment-methods' | 'cost-center' | 'error-mode' | 'fiscal'>('general');
  const { user } = useAuth();
  const { companyId } = useCompanyAccess();
  const { settings: coreSettings, updateSettings: updateCoreSettings } = useCompanySettings();

  const [config, setConfig] = useState<PolicyConfig>({
    financialApprovalEnabled: false,
    faApplyMode: 'ALL',
    custodyConfirmationEnabled: false,
    approvalRequired: false,  // Legacy sync
    autoPostEnabled: true,                    // V1 Default: auto-post when approved
    allowEditDeletePosted: false,             // V1 Default: posted vouchers are immutable
    periodLockEnabled: false,
    accountAccessEnabled: false,
    costCenterPolicy: {
      enabled: false,
      requiredFor: {}
    },
    policyErrorMode: 'FAIL_FAST',
    paymentMethods: []
  });
  const [originalConfig, setOriginalConfig] = useState<PolicyConfig | null>(null);
  const [localCoreSettings, setLocalCoreSettings] = useState({
    timezone: 'UTC',
    dateFormat: 'DD/MM/YYYY',
    uiMode: 'windows' as 'windows' | 'classic',
    strictApprovalMode: true
  });
  const [originalCoreSettings, setOriginalCoreSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fiscalYears, setFiscalYears] = useState<FiscalYearDTO[]>([]);
  const [fiscalLoading, setFiscalLoading] = useState(false);
  const [fyYear, setFyYear] = useState<number>(new Date().getFullYear());
  const [fyStartMonth, setFyStartMonth] = useState<number>(1);
  const [retainedEarningsAccountId, setRetainedEarningsAccountId] = useState<string>('');

  // Granular tabs as per implementation plan
  const tabs = [
    { id: 'general', label: 'General Settings', icon: Globe },
    { id: 'currencies', label: 'Currencies', icon: Coins },
    { id: 'policies', label: 'Approval & Posting', icon: Shield },
    { id: 'payment-methods', label: 'Payment Methods', icon: CreditCard },
    { id: 'cost-center', label: 'Cost Center Required', icon: DollarSign },
    { id: 'error-mode', label: 'Policy Error Mode', icon: AlertTriangle },
    { id: 'fiscal', label: 'Fiscal Year', icon: Building2 },
  ];

  // Mode A = both Financial Approval AND Custody Confirmation are OFF
  const isModeA = !config.financialApprovalEnabled && !config.custodyConfirmationEnabled;

  useEffect(() => {
    if (coreSettings) {
      const newCore = {
        timezone: coreSettings.timezone || 'UTC',
        dateFormat: coreSettings.dateFormat || 'DD/MM/YYYY',
        uiMode: coreSettings.uiMode || 'windows',
        strictApprovalMode: coreSettings.strictApprovalMode !== false
      };
      setLocalCoreSettings(newCore);
      setOriginalCoreSettings(newCore);
    }
  }, [coreSettings]);

  useEffect(() => {
    loadSettings();
  }, [companyId]);

  useEffect(() => {
    if (activeTab === 'fiscal') {
      loadFiscalYears();
    }
  }, [activeTab]);

  const loadSettings = async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      // Note: client interceptor unwraps { success, data } - returns data directly
      const data = await client.get(`tenant/accounting/policy-config`);
      console.log('[AccountingSettings] Load response:', data);
      
      if (data) {
        console.log('[AccountingSettings] Setting config:', data);
        // Filter out baseCurrency as it's a Global attribute, not a module setting
        const { baseCurrency, ...rest } = data as any;
        const loadedConfig = { 
          ...rest,
          paymentMethods: (data as any).paymentMethods || []
        };
        setConfig(loadedConfig as any);
        setOriginalConfig(loadedConfig as any);
      }
    } catch (error: any) {
      errorHandler.showError(error.response?.data?.error?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const loadFiscalYears = async () => {
    setFiscalLoading(true);
    try {
      const data = await accountingApi.listFiscalYears();
      setFiscalYears(data as any);
    } catch (error: any) {
      errorHandler.showError(error?.response?.data?.error?.message || 'Failed to load fiscal years');
    } finally {
      setFiscalLoading(false);
    }
  };

  const handleSave = async (section?: string) => {
    if (!companyId) return;
    
    setSaving(true);
    try {
      if (section === 'general') {
        // Save ONLY core settings (timezone, dateFormat, uiMode, strictApprovalMode)
        const settingsToSave = {
          ...localCoreSettings,
          strictApprovalMode: config.financialApprovalEnabled
        };
        await updateCoreSettings(settingsToSave);
        setOriginalCoreSettings(settingsToSave);
        errorHandler.showSuccess('General settings saved!');
      } else {
        // Save policy config for the active section
        const { baseCurrency, ...savePayload } = config as any;
        const result = await client.put(`tenant/accounting/policy-config`, savePayload) as any;
        if (result?.success === false) {
          throw new Error(result.error?.message || 'Failed to save policy settings');
        }
        setOriginalConfig(config);

        // If policies tab, also sync strictApprovalMode bidirectionally
        if (section === 'policies') {
          const settingsToSave = {
            ...localCoreSettings,
            strictApprovalMode: config.financialApprovalEnabled
          };
          await updateCoreSettings(settingsToSave);
          setOriginalCoreSettings(settingsToSave);
          const modeText = settingsToSave.strictApprovalMode ? 'Strict Mode [ON]' : 'Strict Mode [OFF]';
          errorHandler.showSuccess(`Approval & Posting saved! ${modeText}`);
        } else {
          const label = section ? section.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Settings';
          errorHandler.showSuccess(`${label} saved!`);
        }
      }
    } catch (error: any) {
      const errorData = error.response?.data?.error;
      if (errorData?.details?.violations) {
        const messages = errorData.details.violations.map((v: any) => v.message).join(', ');
        errorHandler.showError(messages);
      } else {
        errorHandler.showError(errorData?.message || 'Failed to save settings');
      }
    } finally {
      setSaving(false);
    }
  };

  // Section-specific change detection
  const hasGeneralChanges = JSON.stringify(localCoreSettings) !== JSON.stringify(originalCoreSettings);
  
  const hasPolicyChanges = originalConfig ? (
    config.financialApprovalEnabled !== originalConfig.financialApprovalEnabled ||
    config.faApplyMode !== originalConfig.faApplyMode ||
    config.custodyConfirmationEnabled !== originalConfig.custodyConfirmationEnabled ||
    config.ccThirdPartyMode !== originalConfig.ccThirdPartyMode ||
    config.ccAmountThreshold !== originalConfig.ccAmountThreshold ||
    config.ccAllowSelfConfirmation !== originalConfig.ccAllowSelfConfirmation ||
    config.ccBlockIfNoCustodian !== originalConfig.ccBlockIfNoCustodian ||
    config.ccReversalMode !== originalConfig.ccReversalMode ||
    config.autoPostEnabled !== originalConfig.autoPostEnabled ||
    config.allowEditDeletePosted !== originalConfig.allowEditDeletePosted
  ) : false;

  const hasMethodChanges = JSON.stringify(config.paymentMethods) !== JSON.stringify(originalConfig?.paymentMethods);
  const hasCostCenterChanges = JSON.stringify(config.costCenterPolicy) !== JSON.stringify(originalConfig?.costCenterPolicy);
  const hasErrorModeChanges = config.policyErrorMode !== originalConfig?.policyErrorMode;
  const hasFiscalChanges = config.periodLockEnabled !== originalConfig?.periodLockEnabled || 
                          config.lockedThroughDate !== originalConfig?.lockedThroughDate;

  // Global change flag (for reference)
  const hasAnyChanges = hasGeneralChanges || hasPolicyChanges || hasMethodChanges || hasCostCenterChanges || hasErrorModeChanges || hasFiscalChanges;

  const handleCreateFiscalYear = async () => {
    try {
      setFiscalLoading(true);
      await accountingApi.createFiscalYear({ year: fyYear, startMonth: fyStartMonth });
      await loadFiscalYears();
      errorHandler.showSuccess('Fiscal year created');
    } catch (error: any) {
      errorHandler.showError(error?.response?.data?.error?.message || 'Failed to create fiscal year');
    } finally {
      setFiscalLoading(false);
    }
  };

  const handleClosePeriod = async (fyId: string, periodId: string) => {
    try {
      setFiscalLoading(true);
      await accountingApi.closeFiscalPeriod(fyId, periodId);
      await loadFiscalYears();
      errorHandler.showSuccess('Period closed');
    } catch (error: any) {
      errorHandler.showError(error?.response?.data?.error?.message || 'Failed to close period');
    } finally {
      setFiscalLoading(false);
    }
  };

  const handleReopenPeriod = async (fyId: string, periodId: string) => {
    try {
      setFiscalLoading(true);
      await accountingApi.reopenFiscalPeriod(fyId, periodId);
      await loadFiscalYears();
      errorHandler.showSuccess('Period reopened');
    } catch (error: any) {
      errorHandler.showError(error?.response?.data?.error?.message || 'Failed to reopen period');
    } finally {
      setFiscalLoading(false);
    }
  };

  const handleCloseYear = async (fyId: string) => {
    if (!retainedEarningsAccountId) {
      errorHandler.showError('Retained earnings account is required');
      return;
    }
    try {
      setFiscalLoading(true);
      await accountingApi.closeFiscalYear(fyId, retainedEarningsAccountId);
      await loadFiscalYears();
      errorHandler.showSuccess('Fiscal year closed');
    } catch (error: any) {
      errorHandler.showError(error?.response?.data?.error?.message || 'Failed to close fiscal year');
    } finally {
      setFiscalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-[var(--color-bg-primary)]">
      {/* Header (Simplified - Save buttons moved to sections) */}
      <div className="flex-none px-8 py-6 bg-white dark:bg-[var(--color-bg-secondary)] border-b border-gray-200 dark:border-[var(--color-border)] flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">Accounting Settings</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-[var(--color-text-secondary)]">
            Manage your company's accounting preferences and policies
          </p>
        </div>
        <div className="flex items-center gap-3">
          <InstructionsButton 
            instructions={
              activeTab === 'general' ? generalSettingsInstructions :
              activeTab === 'currencies' ? currenciesInstructions :
              activeTab === 'policies' ? policiesInstructions :
              activeTab === 'payment-methods' ? paymentMethodsInstructions :
              activeTab === 'cost-center' ? costCenterInstructions :
              activeTab === 'error-mode' ? errorModeInstructions :
              fiscalYearInstructions
            } 
          />
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Vertical Sidebar Navigation */}
        <aside className="w-64 border-r border-gray-200 dark:border-[var(--color-border)] bg-gray-50 dark:bg-[var(--color-bg-primary)] overflow-y-auto hidden md:block">
          <nav className="p-4 space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                    ${isActive
                      ? 'bg-white dark:bg-[var(--color-bg-secondary)] text-indigo-700 dark:text-primary-400 shadow-sm ring-1 ring-gray-200 dark:ring-[var(--color-border)]'
                      : 'text-gray-600 dark:text-[var(--color-text-secondary)] hover:bg-gray-100 dark:hover:bg-[var(--color-bg-tertiary)] hover:text-gray-900 dark:hover:text-[var(--color-text-primary)]'
                    }
                  `}
                >
                  <Icon 
                    size={18} 
                    className={isActive ? 'text-indigo-600 dark:text-primary-400' : 'text-gray-400 dark:text-[var(--color-text-muted)]'} 
                  />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-white dark:bg-[var(--color-bg-secondary)]">
          <div className="p-8">


                  {/* General Settings Tab */}
                  {activeTab === 'general' && (
                    <div className="max-w-4xl mx-auto space-y-8">
                      <SectionHeader 
                        title="General Settings" 
                        description="Configure general company preferences that affect the accounting module"
                        onSave={() => handleSave('general')}
                        disabled={!hasGeneralChanges || saving}
                        saving={saving}
                      />
                      
                      <div className="space-y-6">
                  {/* Timezone */}
                  <div className="bg-white dark:bg-[var(--color-bg-tertiary)] border border-gray-200 dark:border-[var(--color-border)] rounded-xl p-6 shadow-sm">
                    <label className="flex items-center gap-2 font-semibold text-gray-900 dark:text-[var(--color-text-primary)] mb-2">
                      <Globe size={20} className="text-blue-500" />
                      Company Timezone
                    </label>
                    <p className="text-sm text-gray-500 dark:text-[var(--color-text-secondary)] mb-4">
                      Select the primary timezone for financial reports and transaction timestamps
                    </p>
                    <select
                      className="block w-full max-w-xs px-3 py-2 border border-gray-300 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-secondary)] dark:text-[var(--color-text-primary)] rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      value={localCoreSettings.timezone}
                      onChange={(e) => setLocalCoreSettings({ ...localCoreSettings, timezone: e.target.value })}
                    >
                      <option value="UTC">UTC (Universal Time)</option>
                      <option value="Europe/Istanbul">Europe/Istanbul (UTC+03:00)</option>
                      <option value="Europe/London">Europe/London (GMT/BST)</option>
                      <option value="America/New_York">America/New_York (EST/EDT)</option>
                      <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                    </select>
                  </div>

                  {/* Date Format */}
                  <div className="bg-white dark:bg-[var(--color-bg-tertiary)] border border-gray-200 dark:border-[var(--color-border)] rounded-xl p-6 shadow-sm">
                    <label className="flex items-center gap-2 font-semibold text-gray-900 dark:text-[var(--color-text-primary)] mb-2">
                      <Calendar size={20} className="text-green-500" />
                      Date Format
                    </label>
                    <p className="text-sm text-gray-500 dark:text-[var(--color-text-secondary)] mb-4">
                      Choose how dates are displayed across the application
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
                      {['DD/MM/YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY', 'DD.MM.YYYY'].map((format) => (
                        <label 
                          key={format}
                          className={`
                            flex items-center p-4 border rounded-xl cursor-pointer transition-all
                            ${localCoreSettings.dateFormat === format 
                              ? 'border-indigo-500 dark:border-primary-500 bg-indigo-50 dark:bg-primary-900/20 ring-2 ring-indigo-100 dark:ring-primary-900/30' 
                              : 'border-gray-200 dark:border-[var(--color-border)] hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-[var(--color-bg-secondary)]'}
                          `}
                        >
                          <input
                            type="radio"
                            className="sr-only"
                            checked={localCoreSettings.dateFormat === format}
                            onChange={() => setLocalCoreSettings({ ...localCoreSettings, dateFormat: format })}
                          />
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-900 dark:text-[var(--color-text-primary)]">{format}</span>
                            <span className="text-xs text-gray-500 dark:text-[var(--color-text-secondary)]">
                              Example: {(() => {
                                const d = new Date();
                                const day = String(d.getDate()).padStart(2, '0');
                                const month = String(d.getMonth() + 1).padStart(2, '0');
                                const year = String(d.getFullYear());
                                if (format === 'DD/MM/YYYY') return `${day}/${month}/${year}`;
                                if (format === 'YYYY-MM-DD') return `${year}-${month}-${day}`;
                                if (format === 'MM/DD/YYYY') return `${month}/${day}/${year}`;
                                if (format === 'DD.MM.YYYY') return `${day}.${month}.${year}`;
                                return format;
                              })()}
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* UI Mode */}
                  <div className="bg-white dark:bg-[var(--color-bg-tertiary)] border border-gray-200 dark:border-[var(--color-border)] rounded-xl p-6 shadow-sm">
                    <label className="flex items-center gap-2 font-semibold text-gray-900 dark:text-[var(--color-text-primary)] mb-2">
                      <Layout size={20} className="text-purple-500" />
                      Interface Style
                    </label>
                    <p className="text-sm text-gray-500 dark:text-[var(--color-text-secondary)] mb-4">
                      Choose the primary desktop experience
                    </p>
                    <div className="flex gap-4">
                      <button
                        onClick={() => setLocalCoreSettings({ ...localCoreSettings, uiMode: 'classic' })}
                        className={`flex-1 p-5 border rounded-2xl text-left transition-all ${
                          localCoreSettings.uiMode === 'classic' 
                          ? 'border-indigo-600 dark:border-primary-500 bg-indigo-50 dark:bg-primary-900/20 ring-2 ring-indigo-200 dark:ring-primary-900/30' 
                          : 'border-gray-200 dark:border-[var(--color-border)] hover:bg-gray-50 dark:hover:bg-[var(--color-bg-secondary)]'
                        }`}
                      >
                        <div className="font-bold text-gray-900 dark:text-[var(--color-text-primary)]">Classic</div>
                        <div className="text-xs text-gray-500 dark:text-[var(--color-text-secondary)]">Tabbed, flat interface</div>
                      </button>
                      <button
                        onClick={() => setLocalCoreSettings({ ...localCoreSettings, uiMode: 'windows' })}
                        className={`flex-1 p-5 border rounded-2xl text-left transition-all ${
                          localCoreSettings.uiMode === 'windows' 
                          ? 'border-indigo-600 dark:border-primary-500 bg-indigo-50 dark:bg-primary-900/20 ring-2 ring-indigo-200 dark:ring-primary-900/30' 
                          : 'border-gray-200 dark:border-[var(--color-border)] hover:bg-gray-50 dark:hover:bg-[var(--color-bg-secondary)]'
                        }`}
                      >
                        <div className="font-bold text-gray-900 dark:text-[var(--color-text-primary)]">Windows (V3)</div>
                        <div className="text-xs text-gray-500 dark:text-[var(--color-text-secondary)]">Multi-window multitasking</div>
                      </button>
                    </div>
                    </div>
                  </div>
                </div>
              )}

                  {/* Currencies Tab */}
                  {(activeTab as string) === 'currencies' && (
                    <div className="max-w-6xl mx-auto space-y-8">
                      <SectionHeader 
                        title="Currencies" 
                        description="Manage your enterprise currency list and base currency"
                        onSave={() => handleSave('currencies')}
                        disabled={saving} // Currencies handled internally by CompanyCurrencySettings components
                        saving={saving}
                      />
                      <CompanyCurrencySettings />
                    </div>
                  )}

                  {/* Policy Configuration Tab (Merged: Approval & Posting) */}
                  {(activeTab as string) === 'policies' && (
                    <div className="w-full space-y-8">
                      <SectionHeader 
                        title="Approval & Posting" 
                        description="Configure approval gates and posting behavior"
                        onSave={() => handleSave('policies')}
                        disabled={!hasPolicyChanges || saving}
                        saving={saving}
                      />

                {/* Approval Gates Section */}
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800/50 rounded-xl p-6 shadow-sm">
                  <h3 className="flex items-center gap-2 font-bold text-gray-900 dark:text-[var(--color-text-primary)] mb-4">
                    <Shield size={20} className="text-indigo-600 dark:text-indigo-400" />
                    Approval Gates
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-[var(--color-text-secondary)] mb-6">
                    Enable approval requirements before vouchers can be posted to ledger
                  </p>
                  
                  <div className="flex flex-col gap-6">
                    {/* Financial Approval Toggle */}
                    <div className="bg-white/70 dark:bg-[var(--color-bg-tertiary)] rounded-xl p-5 border border-indigo-100 dark:border-[var(--color-border)] shadow-sm">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <label className="font-semibold text-gray-800 dark:text-[var(--color-text-primary)]">Financial Approval (FA)</label>
                            <div className="group relative">
                              <Info size={14} className="text-gray-400 hover:text-indigo-600 cursor-help" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none text-center">
                                Require manager approval for vouchers before they affect the ledger.
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-[var(--color-text-secondary)] mt-1">
                            Role-based approval gate.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-4">
                          <span className={`text-xs font-bold uppercase tracking-wider ${config.financialApprovalEnabled ? 'text-indigo-600' : 'text-gray-400'}`}>
                            {config.financialApprovalEnabled ? 'ON' : 'OFF'}
                          </span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={config.financialApprovalEnabled}
                              onChange={(e) => setConfig({ 
                                ...config, 
                                financialApprovalEnabled: e.target.checked,
                                approvalRequired: e.target.checked  // Legacy sync
                              })}
                            />
                            <div className={`w-12 h-6 rounded-full transition-colors ${config.financialApprovalEnabled ? 'bg-indigo-600' : 'bg-gray-200'}`}>
                              <div className={`absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full shadow-md transition-transform ${config.financialApprovalEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                            </div>
                          </label>
                        </div>
                      </div>
                      
                      {config.financialApprovalEnabled && (
                        <div className="mt-4 pt-4 border-t border-indigo-100">
                          <label className="text-xs font-semibold text-gray-700 mb-2 block">Apply To:</label>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setConfig({ ...config, faApplyMode: 'ALL' })}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                                config.faApplyMode === 'ALL' 
                                  ? 'bg-indigo-600 text-white' 
                                  : 'bg-gray-100 dark:bg-[var(--color-bg-secondary)] text-gray-600 dark:text-[var(--color-text-secondary)] hover:bg-gray-200 dark:hover:bg-[var(--color-bg-tertiary)]'
                              }`}
                            >
                              All Vouchers
                            </button>
                            <button
                              onClick={() => setConfig({ ...config, faApplyMode: 'MARKED_ONLY' })}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                                config.faApplyMode === 'MARKED_ONLY' 
                                  ? 'bg-indigo-600 text-white' 
                                  : 'bg-gray-100 dark:bg-[var(--color-bg-secondary)] text-gray-600 dark:text-[var(--color-text-secondary)] hover:bg-gray-200 dark:hover:bg-[var(--color-bg-tertiary)]'
                              }`}
                            >
                              Marked Accounts Only
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Custody Confirmation Toggle */}
                    <div className="bg-white/70 dark:bg-[var(--color-bg-tertiary)] rounded-xl p-5 border border-indigo-100 dark:border-[var(--color-border)] shadow-sm">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <label className="font-semibold text-gray-800 dark:text-[var(--color-text-primary)]">Custody Confirmation (CC)</label>
                            <div className="group relative">
                              <Info size={14} className="text-gray-400 hover:text-purple-600 cursor-help" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none text-center">
                                Ensure funds/assets are physically received by the custodian.
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-[var(--color-text-secondary)] mt-1">
                            User-bound custody gate.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-4">
                          <span className={`text-xs font-bold uppercase tracking-wider ${config.custodyConfirmationEnabled ? 'text-purple-600' : 'text-gray-400'}`}>
                            {config.custodyConfirmationEnabled ? 'ON' : 'OFF'}
                          </span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={config.custodyConfirmationEnabled}
                              onChange={(e) => setConfig({ ...config, custodyConfirmationEnabled: e.target.checked })}
                            />
                            <div className={`w-12 h-6 rounded-full transition-colors ${config.custodyConfirmationEnabled ? 'bg-purple-600' : 'bg-gray-200'}`}>
                              <div className={`absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full shadow-md transition-transform ${config.custodyConfirmationEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                            </div>
                          </label>
                        </div>
                      </div>
                      
                      {/* Smart CC Settings - Horizontal Row */}
                      {config.custodyConfirmationEnabled && (
                        <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-700/50">
                          <p className="text-[10px] text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wider mb-3">Smart Configuration</p>
                          
                          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
                             
                             {/* 1. Third Party Mode */}
                             <div className="xl:col-span-1">
                               <div className="flex items-center gap-1.5 mb-2">
                                 <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">Third-Party</label>
                                 <div className="group relative">
                                   <Info size={12} className="text-gray-400 hover:text-purple-600 cursor-help" />
                                   <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none">
                                     Who validates vouchers where creator ≠ sender/receiver (e.g. transfers).
                                   </div>
                                 </div>
                               </div>
                               <div className="flex flex-col gap-1.5">
                                 <button
                                   onClick={() => setConfig({ ...config, ccThirdPartyMode: 'RECEIVER_ONLY' })}
                                   className={`w-full px-3 py-1.5 text-xs font-medium rounded-md transition-all text-left flex items-center justify-between group ${
                                     (config.ccThirdPartyMode || 'RECEIVER_ONLY') === 'RECEIVER_ONLY'
                                       ? 'bg-purple-50 text-purple-700 ring-1 ring-purple-600 py-2'
                                       : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                   }`}
                                 >
                                   <span>Receiver Only</span>
                                   {(config.ccThirdPartyMode || 'RECEIVER_ONLY') === 'RECEIVER_ONLY' && <CheckCircle2 size={12} className="text-purple-600" />}
                                 </button>
                                 <button
                                   onClick={() => setConfig({ ...config, ccThirdPartyMode: 'BOTH' })}
                                   className={`w-full px-3 py-1.5 text-xs font-medium rounded-md transition-all text-left flex items-center justify-between group ${
                                     config.ccThirdPartyMode === 'BOTH'
                                       ? 'bg-purple-50 text-purple-700 ring-1 ring-purple-600 py-2'
                                       : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                   }`}
                                 >
                                   <span>Both Parties</span>
                                   {config.ccThirdPartyMode === 'BOTH' && <CheckCircle2 size={12} className="text-purple-600" />}
                                 </button>
                               </div>
                             </div>

                             {/* 2. Reversal Mode */}
                             <div className="xl:col-span-1">
                               <div className="flex items-center gap-1.5 mb-2">
                                 <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">Reversal Logic</label>
                                 <div className="group relative">
                                   <Info size={12} className="text-gray-400 hover:text-purple-600 cursor-help" />
                                   <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none">
                                     How to handle confirmation for reversal (correction) vouchers.
                                   </div>
                                 </div>
                               </div>
                               <div className="flex flex-col gap-1.5">
                                 <button
                                   onClick={() => setConfig({ ...config, ccReversalMode: 'SAME_AS_ORIGINAL' })}
                                   className={`w-full px-3 py-1.5 text-xs font-medium rounded-md transition-all text-left flex items-center justify-between group ${
                                     (config.ccReversalMode || 'SAME_AS_ORIGINAL') === 'SAME_AS_ORIGINAL'
                                       ? 'bg-purple-50 text-purple-700 ring-1 ring-purple-600 py-2'
                                       : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                   }`}
                                 >
                                   <span>Match Original</span>
                                   {(config.ccReversalMode || 'SAME_AS_ORIGINAL') === 'SAME_AS_ORIGINAL' && <CheckCircle2 size={12} className="text-purple-600" />}
                                 </button>
                                 <button
                                   onClick={() => setConfig({ ...config, ccReversalMode: 'AUTO_APPROVE' })}
                                   className={`w-full px-3 py-1.5 text-xs font-medium rounded-md transition-all text-left flex items-center justify-between group ${
                                     config.ccReversalMode === 'AUTO_APPROVE'
                                       ? 'bg-purple-50 text-purple-700 ring-1 ring-purple-600 py-2'
                                       : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                   }`}
                                 >
                                   <span>Auto-Approve</span>
                                   {config.ccReversalMode === 'AUTO_APPROVE' && <CheckCircle2 size={12} className="text-purple-600" />}
                                 </button>
                               </div>
                             </div>

                             {/* 3. Self Confirm */}
                             <div className="xl:col-span-1">
                               <div className="flex items-center gap-1.5 mb-2">
                                 <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">Self-Confirm</label>
                                 <div className="group relative">
                                   <Info size={12} className="text-gray-400 hover:text-purple-600 cursor-help" />
                                   <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none">
                                     Allow the voucher creator to also confirm custody if they are the receiver.
                                   </div>
                                 </div>
                               </div>
                               <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50/50">
                                  <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                      type="checkbox"
                                      className="sr-only peer"
                                      checked={config.ccAllowSelfConfirmation || false}
                                      onChange={(e) => setConfig({ ...config, ccAllowSelfConfirmation: e.target.checked })}
                                    />
                                    <div className="w-9 h-5 rounded-full bg-gray-200 dark:bg-gray-600 peer-checked:bg-purple-600 transition-colors">
                                      <div className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full shadow transition-transform ${config.ccAllowSelfConfirmation ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                    </div>
                                  </label>
                                  <span className="text-[10px] text-gray-500 leading-tight">Allow creators to confirm their own receipts.</span>
                               </div>
                             </div>

                             {/* 4. Block Missing */}
                             <div className="xl:col-span-1">
                               <div className="flex items-center gap-1.5 mb-2">
                                 <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">Block Missing</label>
                                 <div className="group relative">
                                   <Info size={12} className="text-gray-400 hover:text-purple-600 cursor-help" />
                                   <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none">
                                     Prevent submission if no valid custodian user is assigned to the cash account.
                                   </div>
                                 </div>
                               </div>
                               <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50/50">
                                  <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                      type="checkbox"
                                      className="sr-only peer"
                                      checked={config.ccBlockIfNoCustodian ?? true}
                                      onChange={(e) => setConfig({ ...config, ccBlockIfNoCustodian: e.target.checked })}
                                    />
                                    <div className="w-9 h-5 rounded-full bg-gray-200 dark:bg-gray-600 peer-checked:bg-purple-600 transition-colors">
                                      <div className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full shadow transition-transform ${(config.ccBlockIfNoCustodian ?? true) ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                    </div>
                                  </label>
                                  <span className="text-[10px] text-gray-500 leading-tight">Block submission if custodian is missing.</span>
                               </div>
                             </div>

                          </div>
                        </div>
                      )}
                    </div>

                    {/* Voucher Amount Threshold (Extracted) */}
                    <div className="bg-white/70 dark:bg-[var(--color-bg-tertiary)] rounded-xl p-5 border border-indigo-100 dark:border-[var(--color-border)] shadow-sm">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <label className="font-semibold text-gray-800 dark:text-[var(--color-text-primary)]">Voucher Amount Threshold</label>
                            <div className="group relative">
                              <Info size={14} className="text-gray-400 hover:text-indigo-600 cursor-help" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none text-center">
                                Set a minimum monetary value. Vouchers below this amount skip custody confirmation.
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                              </div>
                            </div>
                            
                            {/* Toggle Switch */}
                            <div className="flex items-center gap-2">
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={!!config.ccAmountThreshold}
                                    onChange={(e) => {
                                       if (e.target.checked) {
                                          setConfig({ ...config, ccAmountThreshold: 100 });
                                       } else {
                                          setConfig({ ...config, ccAmountThreshold: 0 });
                                       }
                                    }}
                                  />
                                  <div className={`w-9 h-5 rounded-full transition-colors ${config.ccAmountThreshold ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'}`}>
                                    <div className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full shadow transition-transform ${config.ccAmountThreshold ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                  </div>
                                </label>
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${config.ccAmountThreshold ? 'text-indigo-600' : 'text-gray-400'}`}>
                                  {config.ccAmountThreshold ? 'ON' : 'OFF'}
                                </span>
                            </div>
                          </div>
                          
                          <p className="text-xs text-gray-500 dark:text-[var(--color-text-secondary)] mt-1">
                            {config.ccAmountThreshold 
                              ? 'Custody confirmation required only for vouchers exceeding this amount.' 
                              : 'Minimum amount disabled. Custody confirmation required for ALL vouchers.'}
                          </p>
                        </div>
                        
                        {/* Dynamic Input (Always Visible, Disabled if OFF) */}
                        <div className={`flex items-center gap-2 shrink-0 ml-4 border-b-2 px-2 py-1 transition-all ${
                          config.ccAmountThreshold 
                            ? 'border-indigo-100 dark:border-indigo-900/50 opacity-100' 
                            : 'border-gray-100 dark:border-gray-800 opacity-50'
                        }`}>
                           <span className={`text-xs font-semibold uppercase ${
                             config.ccAmountThreshold ? 'text-gray-400' : 'text-gray-300'
                           }`}>
                               {coreSettings?.baseCurrency || 'USD'}
                           </span>
                           <input
                             type="number"
                             min="0"
                             value={config.ccAmountThreshold || 0}
                             disabled={!config.ccAmountThreshold}
                             onChange={(e) => setConfig({ ...config, ccAmountThreshold: Number(e.target.value) })}
                             className={`w-24 text-base font-bold bg-transparent border-none focus:ring-0 p-0 text-right ${
                               config.ccAmountThreshold 
                                ? 'text-gray-900 dark:text-gray-100' 
                                : 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                             }`}
                           />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mode Indicator */}
                  <div className={`mt-4 p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                    isModeA 
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50'
                      : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${isModeA ? 'bg-emerald-500' : 'bg-indigo-500'}`}></div>
                    {isModeA 
                      ? 'Flexible Posting Mode — Fast-track posting without approval gates' 
                      : 'Strict Approval Mode — Audit-compliant workflow with permanent lock'
                    }
                  </div>

                  {/* Posting Behavior Section - Always Visible */}
                  <div className="mt-6 pt-6 border-t border-indigo-100 dark:border-[var(--color-border)]">
                    <h4 className="flex items-center gap-2 font-semibold text-gray-800 dark:text-[var(--color-text-primary)] mb-4">
                      {isModeA ? (
                        <Settings size={18} className="text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Shield size={18} className="text-indigo-600 dark:text-indigo-400" />
                      )}
                      Posting Behavior
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Auto-Post Toggle */}
                      <div className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                        isModeA ? 'bg-white/70 dark:bg-[var(--color-bg-tertiary)] border-emerald-100 dark:border-emerald-800/30' : 'bg-gray-50/50 dark:bg-[var(--color-bg-tertiary)] border-gray-100 dark:border-[var(--color-border)]'
                      }`}>
                        <div className="flex-1">
                          <label className="font-medium text-gray-800 dark:text-[var(--color-text-primary)] text-sm">Auto-Post When Approved</label>
                          <p className="text-xs text-gray-500 dark:text-[var(--color-text-secondary)] mt-0.5">
                            {isModeA 
                              ? 'Post to ledger automatically upon submission' 
                              : 'System automatically posts vouchers only after all approval gates are cleared'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-4">
                          <span className={`text-xs font-bold uppercase tracking-wider ${
                            config.autoPostEnabled ? (isModeA ? 'text-emerald-600' : 'text-indigo-600') : 'text-gray-400'
                          }`}>
                            {config.autoPostEnabled ? 'ON' : 'OFF'}
                          </span>
                          <label className={`relative inline-flex items-center ${isModeA ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={config.autoPostEnabled ?? true}
                              disabled={!isModeA}
                              onChange={(e) => setConfig({ ...config, autoPostEnabled: e.target.checked })}
                            />
                            <div className={`w-12 h-6 rounded-full transition-colors ${
                              config.autoPostEnabled 
                                ? (isModeA ? 'bg-emerald-500' : 'bg-indigo-600') 
                                : 'bg-gray-200'
                            }`}>
                              <div className={`absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full shadow-md transition-transform ${config.autoPostEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Allow Edit Posted Toggle - Always Visible, Disabled in Strict Mode */}
                        <div className={`flex items-center justify-between p-4 bg-white/70 dark:bg-[var(--color-bg-tertiary)] rounded-lg border transition-all ${
                          isModeA 
                            ? 'border-amber-100 dark:border-amber-800/30' 
                            : 'border-gray-200 dark:border-[var(--color-border)] opacity-60'
                        }`}>
                          <div className="flex-1">
                            <label className={`font-medium text-sm flex items-center gap-2 ${isModeA ? 'text-gray-800 dark:text-[var(--color-text-primary)]' : 'text-gray-500 dark:text-[var(--color-text-muted)]'}`}>
                              Allow Edit/Delete Posted
                              {!isModeA && <Lock size={14} className="text-gray-400" />}
                            </label>
                            <p className={`text-xs mt-0.5 ${isModeA ? 'text-gray-500 dark:text-[var(--color-text-secondary)]' : 'text-gray-400 dark:text-[var(--color-text-muted)]'}`}>
                              {isModeA 
                                ? 'Edit or delete posted vouchers (modifies/removes ledger entries)'
                                : 'Not available in Strict Mode — posted vouchers are immutable'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-4">
                            <span className={`text-xs font-bold uppercase tracking-wider ${
                              !isModeA 
                                ? 'text-gray-400 dark:text-[var(--color-text-muted)]'
                                : config.allowEditDeletePosted
                                  ? 'text-amber-600 dark:text-amber-500' 
                                  : 'text-gray-400 dark:text-[var(--color-text-muted)]'
                            }`}>
                              {config.allowEditDeletePosted ? 'ON' : 'OFF'}
                            </span>
                            <label className={`relative inline-flex items-center ${isModeA ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={config.allowEditDeletePosted ?? false}
                                disabled={!isModeA}
                                onChange={(e) => setConfig({ ...config, allowEditDeletePosted: e.target.checked })}
                              />
                              <div className={`w-12 h-6 rounded-full transition-colors ${
                                !isModeA 
                                  ? 'bg-gray-300 dark:bg-gray-600'
                                  : config.allowEditDeletePosted 
                                    ? 'bg-amber-500' 
                                    : 'bg-gray-200 dark:bg-gray-700'
                              }`}>
                                <div className={`absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full shadow-md transition-transform ${config.allowEditDeletePosted && isModeA ? 'translate-x-6' : 'translate-x-0'}`}></div>
                              </div>
                            </label>
                          </div>
                        </div>
                    </div>

                    {/* Mode-Specific Message */}
                    {isModeA && config.allowEditDeletePosted ? (
                      /* Flexible Mode + Allow Edit ON: Show caution */
                      <div className="mt-3 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg">
                        <AlertTriangle size={14} className="text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800 dark:text-amber-300">
                          <strong>Caution:</strong> Editing posted vouchers modifies ledger entries. Consider using reversals for better audit trail.
                        </p>
                      </div>
                    ) : !isModeA ? (
                      /* Strict Mode: Show info about immutability */
                      <div className="mt-3 flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg">
                        <Shield size={14} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-800 dark:text-blue-300">
                          <strong>Strict Mode Active:</strong> Posted vouchers are immutable and cannot be edited or deleted. To correct a financial effect, create a <strong>Reversal Voucher</strong> that posts offsetting entries.
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )}

              {/* Payment Methods Tab */}
              {(activeTab as string) === 'payment-methods' && (
              <div className="max-w-4xl mx-auto space-y-8">
                <SectionHeader 
                  title="Payment Methods" 
                  description="Define and manage payment methods used across vouchers"
                  onSave={() => handleSave('payment-methods')}
                  disabled={!hasMethodChanges || saving}
                  saving={saving}
                />

                <div className="bg-white dark:bg-[var(--color-bg-tertiary)] border border-gray-200 dark:border-[var(--color-border)] rounded-xl overflow-hidden shadow-sm">
                  <div className="p-6 border-b border-gray-200 dark:border-[var(--color-border)] bg-gray-50/50 dark:bg-[var(--color-bg-tertiary)] flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-[var(--color-text-primary)]">Configured Methods</h3>
                      <p className="text-xs text-gray-500 mt-1">Status of payment options in voucher forms</p>
                    </div>
                    <button 
                      onClick={() => {
                        const newId = `method_${Date.now()}`;
                        const updated = [...(config.paymentMethods || []), { id: newId, name: 'New Payment Method', isEnabled: true }];
                        setConfig({ ...config, paymentMethods: updated });
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                    >
                      <Plus size={14} />
                      Add Method
                    </button>
                  </div>

                  <div className="divide-y divide-gray-100 dark:divide-[var(--color-border)]">
                    {(!config.paymentMethods || config.paymentMethods.length === 0) ? (
                      <div className="p-12 text-center text-gray-500 text-sm italic">
                        No payment methods defined. Click 'Add Method' to get started.
                      </div>
                    ) : (
                      config.paymentMethods.map((pm, index) => (
                        <div key={pm.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[var(--color-bg-secondary)] transition-colors group">
                          <div className="flex items-center gap-4 flex-1 mr-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${pm.isEnabled ? 'bg-indigo-100 dark:bg-indigo-900/30' : 'bg-gray-100 dark:bg-[var(--color-bg-secondary)]'}`}>
                              <CreditCard size={18} className={pm.isEnabled ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'} />
                            </div>
                            <div className="flex-1">
                              <input 
                                type="text"
                                className={`w-full bg-transparent border-none focus:ring-0 font-bold p-0 ${pm.isEnabled ? 'text-gray-900 dark:text-[var(--color-text-primary)]' : 'text-gray-400'}`}
                                value={pm.name}
                                onChange={(e) => {
                                  const updated = [...(config.paymentMethods || [])];
                                  updated[index] = { ...pm, name: e.target.value };
                                  setConfig({ ...config, paymentMethods: updated });
                                }}
                              />
                              <p className="text-[10px] text-gray-400 font-mono mt-0.5">{pm.id}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${pm.isEnabled ? 'text-emerald-600' : 'text-gray-400'}`}>
                                {pm.isEnabled ? 'Enabled' : 'Disabled'}
                              </span>
                              <label className="relative inline-flex items-center cursor-pointer scale-90">
                                <input
                                  type="checkbox"
                                  className="sr-only peer"
                                  checked={pm.isEnabled}
                                  onChange={(e) => {
                                    const updated = [...(config.paymentMethods || [])];
                                    updated[index] = { ...pm, isEnabled: e.target.checked };
                                    setConfig({ ...config, paymentMethods: updated });
                                  }}
                                />
                                <div className={`w-10 h-5 rounded-full transition-colors ${pm.isEnabled ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700'}`}>
                                  <div className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full shadow transition-transform ${pm.isEnabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                </div>
                              </label>
                            </div>
                            <button 
                              onClick={() => {
                                const updated = (config.paymentMethods || []).filter(item => item.id !== pm.id);
                                setConfig({ ...config, paymentMethods: updated });
                              }}
                              className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>


                <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-800/30 flex items-center justify-center shrink-0">
                    <Layout size={16} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-blue-900 dark:text-blue-300">Form Integration</h4>
                    <p className="text-xs text-blue-800 dark:text-blue-400 mt-1 leading-relaxed">
                      Payment methods defined here will automatically populate the dropdowns in the Voucher Editor. 
                      Disabled methods will be hidden from the selector but preserved in existing records.
                    </p>
                  </div>
                </div>
              </div>
              )}


            {/* Cost Center Required Tab */}
            {(activeTab as string) === 'cost-center' && (
              <div className="max-w-4xl mx-auto space-y-8">
                <SectionHeader 
                  title="Cost Center Required" 
                  description="Define when cost center assignment is mandatory"
                  onSave={() => handleSave('cost-center')}
                  disabled={!hasCostCenterChanges || saving}
                  saving={saving}
                />

                <div className="bg-white dark:bg-[var(--color-bg-tertiary)] border border-gray-200 dark:border-[var(--color-border)] rounded-xl p-6 shadow-sm">
                  <div className="flex items-start gap-6 mb-4">
                    <div className="flex-1">
                      <label className="flex items-center gap-2 font-bold text-gray-900 dark:text-[var(--color-text-primary)]">
                        <DollarSign size={20} className="text-purple-500" />
                        Enforce Cost Centers
                      </label>
                      <p className="text-sm text-gray-500 dark:text-[var(--color-text-secondary)] mt-1">
                        Require cost center assignment on specific account types
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-xs font-bold uppercase tracking-wider ${config.costCenterPolicy.enabled ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-[var(--color-text-muted)]'}`}>
                        {config.costCenterPolicy.enabled ? 'ON' : 'OFF'}
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={config.costCenterPolicy.enabled}
                          onChange={(e) => setConfig({
                            ...config,
                            costCenterPolicy: {
                              ...config.costCenterPolicy,
                              enabled: e.target.checked
                            }
                          })}
                        />
                        <div className="w-12 h-6 bg-gray-200 dark:bg-gray-700 rounded-full transition-colors peer-checked:bg-indigo-600">
                          <div className={`absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full shadow-md transition-transform ${config.costCenterPolicy.enabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </div>
                      </label>
                    </div>
                  </div>
                  
                  {config.costCenterPolicy.enabled && (
                    <div className="mt-6 pt-6 border-t border-gray-100">
                      <p className="text-sm font-semibold text-gray-900 mb-4">Required for Account Types:</p>
                      <div className="grid grid-cols-2 gap-4">
                        {['EXPENSE', 'ASSET', 'LIABILITY', 'REVENUE'].map((type) => (
                          <label key={type} className="flex items-center p-3 border border-gray-100 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                              checked={config.costCenterPolicy.requiredFor.accountTypes?.includes(type)}
                              onChange={(e) => {
                                const current = config.costCenterPolicy.requiredFor.accountTypes || [];
                                const updated = e.target.checked
                                  ? [...current, type]
                                  : current.filter((t: string) => t !== type);
                                setConfig({
                                  ...config,
                                  costCenterPolicy: {
                                    ...config.costCenterPolicy,
                                    requiredFor: {
                                      ...config.costCenterPolicy.requiredFor,
                                      accountTypes: updated
                                    }
                                  }
                                });
                              }}
                            />
                            <span className="ml-3 text-sm font-medium text-gray-700 dark:text-[var(--color-text-secondary)]">{type}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Policy Error Mode Tab */}
            {(activeTab as string) === 'error-mode' && (
              <div className="max-w-4xl mx-auto space-y-8">
                <SectionHeader 
                  title="Policy Error Mode" 
                  description="Control how validation failures are reported"
                  onSave={() => handleSave('error-mode')}
                  disabled={!hasErrorModeChanges || saving}
                  saving={saving}
                />

                <div className="bg-white dark:bg-[var(--color-bg-tertiary)] border border-gray-200 dark:border-[var(--color-border)] rounded-xl p-6 shadow-sm">
                  <div className="flex items-center gap-2 font-bold text-gray-900 dark:text-[var(--color-text-primary)] mb-2">
                    <AlertTriangle size={20} className="text-amber-500" />
                    Validation Behavior
                  </div>
                  <p className="text-sm text-gray-500 dark:text-[var(--color-text-secondary)] mb-6">
                    Choose how the system reacts when multiple policy rules are violated
                  </p>
                  <div className="space-y-4">
                    <label className={`
                      flex items-start p-4 border rounded-xl cursor-pointer transition-all
                      ${config.policyErrorMode === 'FAIL_FAST' ? 'border-indigo-500 dark:border-primary-500 bg-indigo-50 dark:bg-primary-900/20 ring-2 ring-indigo-100 dark:ring-primary-900/30' : 'border-gray-200 dark:border-[var(--color-border)] hover:bg-gray-50 dark:hover:bg-[var(--color-bg-secondary)]'}
                    `}>
                      <input
                        type="radio"
                        className="sr-only"
                        checked={config.policyErrorMode === 'FAIL_FAST'}
                        onChange={() => setConfig({ ...config, policyErrorMode: 'FAIL_FAST' })}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-gray-900">FAIL_FAST</span>
                          {config.policyErrorMode === 'FAIL_FAST' && <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold uppercase">Recommended</span>}
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          Stop and report on the first error encountered. Faster performance but may require multiple attempts to fix all issues.
                        </p>
                      </div>
                    </label>

                    <label className={`
                      flex items-start p-4 border rounded-xl cursor-pointer transition-all
                      ${config.policyErrorMode === 'AGGREGATE' ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100' : 'border-gray-200 hover:bg-gray-50'}
                    `}>
                      <input
                        type="radio"
                        className="sr-only"
                        checked={config.policyErrorMode === 'AGGREGATE'}
                        onChange={() => setConfig({ ...config, policyErrorMode: 'AGGREGATE' })}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-gray-900">AGGREGATE</span>
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          Run all checks and report all errors at once. Provides a comprehensive list of what needs fixing.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Fiscal Year Tab */}
            {(activeTab as string) === 'fiscal' && (
              <div className="max-w-4xl mx-auto space-y-8">
                <SectionHeader 
                  title="Fiscal Year" 
                  description="Define your company's financial reporting period"
                  onSave={() => handleSave('fiscal')}
                  disabled={!hasFiscalChanges || saving}
                  saving={saving}
                />
                
                <div className="bg-white dark:bg-[var(--color-bg-tertiary)] border border-gray-200 dark:border-[var(--color-border)] rounded-2xl p-6 shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-end gap-4">
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-[var(--color-text-muted)]">Fiscal Year</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          className="w-32 px-3 py-2 border rounded-md"
                          value={fyYear}
                          onChange={(e) => setFyYear(Number(e.target.value))}
                        />
                        <select
                          className="px-3 py-2 border rounded-md"
                          value={fyStartMonth}
                          onChange={(e) => setFyStartMonth(Number(e.target.value))}
                        >
                          {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
                            <option key={m} value={m}>{new Date(2000, m-1, 1).toLocaleString('en', { month: 'long' })}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-[var(--color-text-muted)]">Retained Earnings Account ID</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-md"
                        value={retainedEarningsAccountId}
                        onChange={(e) => setRetainedEarningsAccountId(e.target.value)}
                        placeholder="Enter retained earnings account id"
                      />
                    </div>
                    <button
                      onClick={handleCreateFiscalYear}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 transition"
                      disabled={fiscalLoading}
                    >
                      {fiscalLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Create Year
                    </button>
                  </div>
                </div>

                <div className="bg-white dark:bg-[var(--color-bg-tertiary)] border border-gray-200 dark:border-[var(--color-border)] rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Fiscal Years</h3>
                    <button
                      onClick={loadFiscalYears}
                      className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700"
                    >
                      <RefreshCw className={`w-4 h-4 ${fiscalLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                  </div>

                  {fiscalYears.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-muted)]">No fiscal years defined yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {fiscalYears.map((fy) => (
                        <div key={fy.id} className="border border-[var(--color-border)] rounded-xl p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-bold text-[var(--color-text-primary)]">{fy.name}</div>
                              <div className="text-xs text-[var(--color-text-muted)]">
                                {fy.startDate} → {fy.endDate}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-bold ${fy.status === 'CLOSED' ? 'bg-emerald-100 text-emerald-700' : fy.status === 'LOCKED' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                {fy.status}
                              </span>
                              <button
                                onClick={() => handleCloseYear(fy.id)}
                                disabled={fiscalLoading || fy.status !== 'OPEN'}
                                className="px-3 py-1 text-xs bg-indigo-600 text-white rounded-md disabled:opacity-50"
                              >
                                Close Year
                              </button>
                          </div>
                          </div>

                          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                            {fy.periods.map((p) => (
                              <div key={p.id} className="flex items-center justify-between bg-[var(--color-bg-secondary)] rounded-lg px-3 py-2">
                                <div>
                                  <div className="text-sm font-semibold">{p.name}</div>
                                  <div className="text-[10px] text-[var(--color-text-muted)]">{p.startDate} → {p.endDate}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${p.status === 'CLOSED' ? 'bg-emerald-100 text-emerald-700' : p.status === 'LOCKED' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {p.status}
                                  </span>
                                  {p.status === 'OPEN' ? (
                                    <button
                                      onClick={() => handleClosePeriod(fy.id, p.id)}
                                      className="text-xs px-2 py-1 bg-gray-900 text-white rounded"
                                      disabled={fiscalLoading}
                                    >
                                      Close
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleReopenPeriod(fy.id, p.id)}
                                      className="text-xs px-2 py-1 bg-white border border-[var(--color-border)] rounded"
                                      disabled={fiscalLoading || fy.status !== 'OPEN'}
                                    >
                                      Reopen
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Metadata and Closing of IIFE */}
            {config.updatedAt && (
              <div className="mt-8 pt-4 border-t border-[var(--color-border)] text-sm text-[var(--color-text-muted)] italic">
                Last updated: {new Date(config.updatedAt).toLocaleString()}
                {config.updatedBy && ` by ${config.updatedBy}`}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
