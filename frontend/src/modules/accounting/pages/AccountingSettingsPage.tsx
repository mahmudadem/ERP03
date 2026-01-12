import React, { useState, useEffect } from 'react';
import { Settings, Shield, Lock, Building2, DollarSign, AlertTriangle, Globe, Calendar, Layout, Save, Coins } from 'lucide-react';
import { CompanyCurrencySettings } from './settings/CompanyCurrencySettings';
import client from '../../../api/client';
import { useAuth } from '../../../hooks/useAuth';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { errorHandler } from '../../../services/errorHandler';
import { InstructionsButton, accountingSettingsInstructions } from '../../../components/instructions';

interface PolicyConfig {
  // Approval Policy V1 Toggles
  financialApprovalEnabled: boolean;      // FA: Role-based financial approval
  faApplyMode: 'ALL' | 'MARKED_ONLY';     // FA scope: all vouchers or only marked accounts
  custodyConfirmationEnabled: boolean;    // CC: User-bound custody confirmation
  
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
}

export const AccountingSettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');
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
    policyErrorMode: 'FAIL_FAST'
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

  // Granular tabs as per implementation plan
  const tabs = [
    { id: 'general', label: 'General Settings', icon: Globe },
    { id: 'currencies', label: 'Currencies', icon: Coins },
    { id: 'policies', label: 'Approval & Posting', icon: Shield },
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
        const loadedConfig = { ...data };
        // Fallback for legacy data
        if ((loadedConfig as any).allowEditDeletePosted === undefined) {

        }
        setConfig(loadedConfig as any);
        setOriginalConfig(loadedConfig as any);
      }
    } catch (error: any) {
      errorHandler.showError(error.response?.data?.error?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!companyId) return;
    
    setSaving(true);
    try {
      // Note: client interceptor unwraps responses
      // PUT returns {success, message} which has no nested data, so it returns the object as-is
      const result = await client.put(`tenant/accounting/policy-config`, config) as any;
      
      // Check if success (interceptor returns the whole {success, message} for PUT responses)
      if (result?.success === false) {
        throw new Error(result.error?.message || 'Failed to save policy settings');
      }

      // ALWAYS ENSURE BIDIRECTIONAL SYNC
      // financialApprovalEnabled controls strictApprovalMode
      const settingsToSave = { 
        ...localCoreSettings,
        strictApprovalMode: config.financialApprovalEnabled 
      };

      // Force save regardless of optimization if approval setting is involved
      await updateCoreSettings(settingsToSave);

      // Explicit confirmation
      const modeText = settingsToSave.strictApprovalMode ? "Strict Mode [ON]" : "Strict Mode [OFF]";
      errorHandler.showSuccess(`Settings saved! ${modeText}`);

      setOriginalConfig(config);
      setOriginalCoreSettings(settingsToSave); // Update with what we actually saved
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

  const hasChanges = 
    JSON.stringify(config) !== JSON.stringify(originalConfig) ||
    JSON.stringify(localCoreSettings) !== JSON.stringify(originalCoreSettings);

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
      {/* Header with Instructions and Save Button */}
      <div className="flex-none px-8 py-6 bg-white dark:bg-[var(--color-bg-secondary)] border-b border-gray-200 dark:border-[var(--color-border)] flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">Accounting Settings</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-[var(--color-text-secondary)]">
            Manage your company's accounting preferences and policies
          </p>
        </div>
        <div className="flex items-center gap-3">
          <InstructionsButton instructions={accountingSettingsInstructions} />
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save size={18} />
            )}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
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
                  onClick={() => setActiveTab(tab.id)}
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
            {/* Mobile Tab Dropdown */}
            <div className="md:hidden mb-6">
              <select
                className="block w-full rounded-md border-gray-300 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-tertiary)] dark:text-[var(--color-text-primary)] focus:border-indigo-500 focus:ring-indigo-500"
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value)}
              >
                {tabs.map((tab) => (
                  <option key={tab.id} value={tab.id}>{tab.label}</option>
                ))}
              </select>
            </div>

            {/* General Settings Tab */}
            {activeTab === 'general' && (
              <div className="max-w-4xl mx-auto space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)] mb-2">General Settings</h2>
                  <p className="text-gray-600 dark:text-[var(--color-text-secondary)]">
                    Configure general company preferences that affect the accounting module
                  </p>
                </div>

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
            {activeTab === 'currencies' && (
              <CompanyCurrencySettings />
            )}

            {/* Policy Configuration Tab (Merged: Approval & Posting) */}
            {activeTab === 'policies' && (
              <div className="max-w-4xl mx-auto space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)] mb-2">Approval & Posting</h2>
                  <p className="text-gray-600 dark:text-[var(--color-text-secondary)]">
                    Configure approval gates and posting behavior
                  </p>
                </div>

                {/* Approval Gates Section */}
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800/50 rounded-xl p-6 shadow-sm">
                  <h3 className="flex items-center gap-2 font-bold text-gray-900 dark:text-[var(--color-text-primary)] mb-4">
                    <Shield size={20} className="text-indigo-600 dark:text-indigo-400" />
                    Approval Gates
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-[var(--color-text-secondary)] mb-6">
                    Enable approval requirements before vouchers can be posted to ledger
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Financial Approval Toggle */}
                    <div className="bg-white/70 dark:bg-[var(--color-bg-tertiary)] rounded-xl p-5 border border-indigo-100 dark:border-[var(--color-border)] shadow-sm">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <label className="font-semibold text-gray-800 dark:text-[var(--color-text-primary)]">Financial Approval (FA)</label>
                          <p className="text-xs text-gray-500 dark:text-[var(--color-text-secondary)] mt-1">
                            Role-based approval gate. Vouchers require manager approval before posting.
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
                          <label className="font-semibold text-gray-800 dark:text-[var(--color-text-primary)]">Custody Confirmation (CC)</label>
                          <p className="text-xs text-gray-500 dark:text-[var(--color-text-secondary)] mt-1">
                            User-bound custody gate. Custodians must confirm before posting.
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

                <div className="space-y-6">
                  {/* Period Lock */}
                  <div className="bg-white dark:bg-[var(--color-bg-tertiary)] border border-gray-200 dark:border-[var(--color-border)] rounded-xl p-6 shadow-sm">
                    <div className="flex items-start gap-6">
                      <div className="flex-1">
                        <label className="flex items-center gap-2 font-bold text-gray-900 dark:text-[var(--color-text-primary)]">
                          <Lock size={20} className="text-red-500" />
                          Period Lock
                        </label>
                        <p className="text-sm text-gray-500 dark:text-[var(--color-text-secondary)] mt-1">
                          Prevent posting to closed accounting periods
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-xs font-bold uppercase tracking-wider ${config.periodLockEnabled ? 'text-indigo-600' : 'text-gray-400'}`}>
                          {config.periodLockEnabled ? 'ON' : 'OFF'}
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={config.periodLockEnabled}
                            onChange={(e) => setConfig({ ...config, periodLockEnabled: e.target.checked })}
                          />
                          <div className="w-12 h-6 bg-gray-200 dark:bg-gray-700 rounded-full transition-colors peer-checked:bg-indigo-600">
                            <div className={`absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full shadow-md transition-transform ${config.periodLockEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                          </div>
                        </label>
                      </div>
                    </div>
                    
                    {config.periodLockEnabled && (
                      <div className="mt-6 pt-6 border-t border-gray-100 dark:border-[var(--color-border)]">
                        <label className="block text-sm font-semibold text-gray-900 dark:text-[var(--color-text-primary)] mb-2">
                          Locked Through Date
                        </label>
                        <input
                          type="date"
                          className="block w-full max-w-xs px-3 py-2 border border-gray-300 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-secondary)] dark:text-[var(--color-text-primary)] rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          value={config.lockedThroughDate || ''}
                          onChange={(e) => setConfig({ ...config, lockedThroughDate: e.target.value })}
                        />
                        <p className="mt-2 text-xs text-gray-500 dark:text-[var(--color-text-secondary)]">
                          Transactions on or before this date cannot be modified or posted.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Account Access Control */}
                  <div className="bg-white dark:bg-[var(--color-bg-tertiary)] border border-gray-200 dark:border-[var(--color-border)] rounded-xl p-6 shadow-sm">
                    <div className="flex items-start gap-6">
                      <div className="flex-1">
                        <label className="flex items-center gap-2 font-bold text-gray-900 dark:text-[var(--color-text-primary)]">
                          <Building2 size={20} className="text-green-500" />
                          Account Access Control
                        </label>
                        <p className="text-sm text-gray-500 dark:text-[var(--color-text-secondary)] mt-1">
                          Enforce permission-based access to specific ledger accounts
                        </p>
                        <div className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-2 rounded-lg">
                          <Shield size={14} />
                          Users can only post to accounts they have access to
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-xs font-bold uppercase tracking-wider ${config.accountAccessEnabled ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-[var(--color-text-muted)]'}`}>
                          {config.accountAccessEnabled ? 'ON' : 'OFF'}
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={config.accountAccessEnabled}
                            onChange={(e) => setConfig({ ...config, accountAccessEnabled: e.target.checked })}
                          />
                          <div className="w-12 h-6 bg-gray-200 dark:bg-gray-700 rounded-full transition-colors peer-checked:bg-indigo-600">
                            <div className={`absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full shadow-md transition-transform ${config.accountAccessEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Approval System Tab - Static Approval Policy V1 */}
            {activeTab === 'approval' && (
              <div className="space-y-4">
                {/* Header & Mode Indicator - Compact */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Approval Policy V1</h2>
                    <p className="text-sm text-gray-500">Dual-gate workflow for voucher approvals</p>
                  </div>
                  <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                    config.financialApprovalEnabled || config.custodyConfirmationEnabled
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {!config.financialApprovalEnabled && !config.custodyConfirmationEnabled && 'Mode A: Auto-Post'}
                    {!config.financialApprovalEnabled && config.custodyConfirmationEnabled && 'Mode B: Custody Only'}
                    {config.financialApprovalEnabled && !config.custodyConfirmationEnabled && 'Mode C: FA Only'}
                    {config.financialApprovalEnabled && config.custodyConfirmationEnabled && 'Mode D: Dual-Gate'}
                  </div>
                </div>

                {/* Two-Column Gate Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Financial Approval Card */}
                  <div className={`rounded-xl p-4 border transition-all ${
                    config.financialApprovalEnabled 
                      ? 'bg-indigo-50 border-indigo-200' 
                      : 'bg-white border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Shield size={16} className={config.financialApprovalEnabled ? 'text-indigo-600' : 'text-gray-400'} />
                        <span className="font-bold text-sm">Financial Approval</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={config.financialApprovalEnabled}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setConfig({ ...config, financialApprovalEnabled: val, approvalRequired: val });
                            setLocalCoreSettings(prev => ({ ...prev, strictApprovalMode: val }));
                          }}
                        />
                        <div className="w-9 h-5 bg-gray-200 rounded-full peer-checked:bg-indigo-600 transition-colors">
                          <div className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full shadow transition-transform ${config.financialApprovalEnabled ? 'translate-x-4' : 'translate-x-0'}`}></div>
                        </div>
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">Manager approval before posting</p>
                    
                    {config.financialApprovalEnabled && (
                      <div className="mt-3 pt-3 border-t border-indigo-100 space-y-2">
                        <p className="text-[10px] font-bold text-indigo-600 uppercase">Apply To:</p>
                        <label className="flex items-center gap-2 cursor-pointer text-xs">
                          <input type="radio" name="faApplyMode" checked={config.faApplyMode === 'ALL'} 
                            onChange={() => setConfig({ ...config, faApplyMode: 'ALL' })} className="w-3 h-3" />
                          <span className={config.faApplyMode === 'ALL' ? 'font-semibold' : ''}>All Vouchers</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs">
                          <input type="radio" name="faApplyMode" checked={config.faApplyMode === 'MARKED_ONLY'} 
                            onChange={() => setConfig({ ...config, faApplyMode: 'MARKED_ONLY' })} className="w-3 h-3" />
                          <span className={config.faApplyMode === 'MARKED_ONLY' ? 'font-semibold' : ''}>Marked Accounts Only</span>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Custody Confirmation Card */}
                  <div className={`rounded-xl p-4 border transition-all ${
                    config.custodyConfirmationEnabled 
                      ? 'bg-purple-50 border-purple-200' 
                      : 'bg-white border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Lock size={16} className={config.custodyConfirmationEnabled ? 'text-purple-600' : 'text-gray-400'} />
                        <span className="font-bold text-sm">Custody Confirmation</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={config.custodyConfirmationEnabled}
                          onChange={(e) => setConfig({ ...config, custodyConfirmationEnabled: e.target.checked })}
                        />
                        <div className="w-9 h-5 bg-gray-200 rounded-full peer-checked:bg-purple-600 transition-colors">
                          <div className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full shadow transition-transform ${config.custodyConfirmationEnabled ? 'translate-x-4' : 'translate-x-0'}`}></div>
                        </div>
                      </label>
                    </div>
                    <p className="text-xs text-gray-500">Custodian must confirm before posting</p>
                    
                    {config.custodyConfirmationEnabled && (
                      <div className="mt-3 pt-3 border-t border-purple-100">
                        <p className="text-[10px] text-purple-600">Applies to accounts with assigned custodians</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Governance Notice - Compact */}
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span><strong>Governance:</strong> Only Owner or Admin roles should modify these settings.</span>
                </div>

                {/* Hard Policy - Minimal */}
                <div className="px-3 py-2 bg-gray-800 rounded-lg text-xs text-gray-300">
                  <strong className="text-white">Hard Policy:</strong> Posting occurs ONLY after ALL enabled gates are satisfied.
                </div>
              </div>
            )}


            {/* Cost Center Required Tab */}
            {activeTab === 'cost-center' && (
              <div className="max-w-4xl mx-auto space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)] mb-2">Cost Center Required</h2>
                  <p className="text-gray-600 dark:text-[var(--color-text-secondary)]">
                    Define when cost center assignment is mandatory
                  </p>
                </div>

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
            {activeTab === 'error-mode' && (
              <div className="max-w-4xl mx-auto space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)] mb-2">Policy Error Mode</h2>
                  <p className="text-gray-600 dark:text-[var(--color-text-secondary)]">
                    Control how validation failures are reported
                  </p>
                </div>

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
            {activeTab === 'fiscal' && (
              <div className="max-w-4xl mx-auto space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Fiscal Year</h2>
                  <p className="text-gray-600">
                    Define your company's financial reporting period
                  </p>
                </div>
                
                <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl p-12 text-center">
                  <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-gray-200 flex items-center justify-center mx-auto mb-4 text-gray-400">
                    <Building2 size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Under Construction</h3>
                  <p className="text-gray-500 max-w-xs mx-auto mt-2">
                    Fiscal year settings are being migrated to the new policy framework.
                  </p>
                </div>
              </div>
            )}

            {/* Metadata */}
            {config.updatedAt && (
              <div className="mt-8 pt-4 border-t text-sm text-gray-500">
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
