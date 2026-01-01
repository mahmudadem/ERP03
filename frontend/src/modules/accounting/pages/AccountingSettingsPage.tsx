import React, { useState, useEffect } from 'react';
import { Settings, Shield, Lock, Building2, DollarSign, AlertTriangle, Globe, Calendar, Layout, Save } from 'lucide-react';
import client from '../../../api/client';
import { useAuth } from '../../../hooks/useAuth';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { errorHandler } from '../../../services/errorHandler';

interface PolicyConfig {
  // Approval Policy V1 Toggles
  financialApprovalEnabled: boolean;      // FA: Role-based financial approval
  faApplyMode: 'ALL' | 'MARKED_ONLY';     // FA scope: all vouchers or only marked accounts
  custodyConfirmationEnabled: boolean;    // CC: User-bound custody confirmation
  
  // Legacy (kept for backward compatibility)
  approvalRequired: boolean;              // Maps to financialApprovalEnabled
  
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
    { id: 'policies', label: 'Policy Configuration', icon: Shield },
    { id: 'approval', label: 'Approval System', icon: Shield },
    { id: 'cost-center', label: 'Cost Center Required', icon: DollarSign },
    { id: 'error-mode', label: 'Policy Error Mode', icon: AlertTriangle },
    { id: 'fiscal', label: 'Fiscal Year', icon: Building2 },
  ];

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
        setConfig(data as any);
        setOriginalConfig(data as any);
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
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header with Save Button */}
      <div className="flex-none px-8 py-6 bg-white border-b border-gray-200 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounting Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your company's accounting preferences and policies
          </p>
        </div>
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

      <div className="flex-1 flex overflow-hidden">
        {/* Vertical Sidebar Navigation */}
        <aside className="w-64 border-r border-gray-200 bg-gray-50 overflow-y-auto hidden md:block">
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
                      ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-gray-200'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }
                  `}
                >
                  <Icon 
                    size={18} 
                    className={isActive ? 'text-indigo-600' : 'text-gray-400'} 
                  />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-white">
          <div className="max-w-4xl p-8">
            {/* Mobile Tab Dropdown */}
            <div className="md:hidden mb-6">
              <select
                className="block w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
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
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">General Settings</h2>
                  <p className="text-gray-600">
                    Configure general company preferences that affect the accounting module
                  </p>
                </div>

                <div className="space-y-6">
                  {/* Timezone */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                    <label className="flex items-center gap-2 font-semibold text-gray-900 mb-2">
                      <Globe size={20} className="text-blue-500" />
                      Company Timezone
                    </label>
                    <p className="text-sm text-gray-500 mb-4">
                      Select the primary timezone for financial reports and transaction timestamps
                    </p>
                    <select
                      className="block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
                  <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                    <label className="flex items-center gap-2 font-semibold text-gray-900 mb-2">
                      <Calendar size={20} className="text-green-500" />
                      Date Format
                    </label>
                    <p className="text-sm text-gray-500 mb-4">
                      Choose how dates are displayed across the application
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
                      {['DD/MM/YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY', 'DD.MM.YYYY'].map((format) => (
                        <label 
                          key={format}
                          className={`
                            flex items-center p-4 border rounded-xl cursor-pointer transition-all
                            ${localCoreSettings.dateFormat === format 
                              ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100' 
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
                          `}
                        >
                          <input
                            type="radio"
                            className="sr-only"
                            checked={localCoreSettings.dateFormat === format}
                            onChange={() => setLocalCoreSettings({ ...localCoreSettings, dateFormat: format })}
                          />
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-900">{format}</span>
                            <span className="text-xs text-gray-500">
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
                  <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                    <label className="flex items-center gap-2 font-semibold text-gray-900 mb-2">
                      <Layout size={20} className="text-purple-500" />
                      Interface Style
                    </label>
                    <p className="text-sm text-gray-500 mb-4">
                      Choose the primary desktop experience
                    </p>
                    <div className="flex gap-4">
                      <button
                        onClick={() => setLocalCoreSettings({ ...localCoreSettings, uiMode: 'classic' })}
                        className={`flex-1 p-5 border rounded-2xl text-left transition-all ${
                          localCoreSettings.uiMode === 'classic' 
                          ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-200' 
                          : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="font-bold text-gray-900">Classic</div>
                        <div className="text-xs text-gray-500">Tabbed, flat interface</div>
                      </button>
                      <button
                        onClick={() => setLocalCoreSettings({ ...localCoreSettings, uiMode: 'windows' })}
                        className={`flex-1 p-5 border rounded-2xl text-left transition-all ${
                          localCoreSettings.uiMode === 'windows' 
                          ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-200' 
                          : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="font-bold text-gray-900">Windows (V3)</div>
                        <div className="text-xs text-gray-500">Multi-window multitasking</div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Policy Configuration Tab */}
            {activeTab === 'policies' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Policy Configuration</h2>
                  <p className="text-gray-600">
                    Manage ledger control policies and transactional rules
                  </p>
                </div>

                <div className="space-y-6">
                  {/* Period Lock */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                    <div className="flex items-start gap-6">
                      <div className="flex-1">
                        <label className="flex items-center gap-2 font-bold text-gray-900">
                          <Lock size={20} className="text-red-500" />
                          Period Lock
                        </label>
                        <p className="text-sm text-gray-500 mt-1">
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
                          <div className="w-12 h-6 bg-gray-200 rounded-full transition-colors peer-checked:bg-indigo-600">
                            <div className={`absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full shadow-md transition-transform ${config.periodLockEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                          </div>
                        </label>
                      </div>
                    </div>
                    
                    {config.periodLockEnabled && (
                      <div className="mt-6 pt-6 border-t border-gray-100">
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          Locked Through Date
                        </label>
                        <input
                          type="date"
                          className="block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          value={config.lockedThroughDate || ''}
                          onChange={(e) => setConfig({ ...config, lockedThroughDate: e.target.value })}
                        />
                        <p className="mt-2 text-xs text-gray-500">
                          Transactions on or before this date cannot be modified or posted.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Account Access Control */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                    <div className="flex items-start gap-6">
                      <div className="flex-1">
                        <label className="flex items-center gap-2 font-bold text-gray-900">
                          <Building2 size={20} className="text-green-500" />
                          Account Access Control
                        </label>
                        <p className="text-sm text-gray-500 mt-1">
                          Enforce permission-based access to specific ledger accounts
                        </p>
                        <div className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">
                          <Shield size={14} />
                          Users can only post to accounts they have access to
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-xs font-bold uppercase tracking-wider ${config.accountAccessEnabled ? 'text-indigo-600' : 'text-gray-400'}`}>
                          {config.accountAccessEnabled ? 'ON' : 'OFF'}
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={config.accountAccessEnabled}
                            onChange={(e) => setConfig({ ...config, accountAccessEnabled: e.target.checked })}
                          />
                          <div className="w-12 h-6 bg-gray-200 rounded-full transition-colors peer-checked:bg-indigo-600">
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
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Cost Center Required</h2>
                  <p className="text-gray-600">
                    Define when cost center assignment is mandatory
                  </p>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                  <div className="flex items-start gap-6 mb-4">
                    <div className="flex-1">
                      <label className="flex items-center gap-2 font-bold text-gray-900">
                        <DollarSign size={20} className="text-purple-500" />
                        Enforce Cost Centers
                      </label>
                      <p className="text-sm text-gray-500 mt-1">
                        Require cost center assignment on specific account types
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-xs font-bold uppercase tracking-wider ${config.costCenterPolicy.enabled ? 'text-indigo-600' : 'text-gray-400'}`}>
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
                        <div className="w-12 h-6 bg-gray-200 rounded-full transition-colors peer-checked:bg-indigo-600">
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
                            <span className="ml-3 text-sm font-medium text-gray-700">{type}</span>
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
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Policy Error Mode</h2>
                  <p className="text-gray-600">
                    Control how validation failures are reported
                  </p>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                  <div className="flex items-center gap-2 font-bold text-gray-900 mb-2">
                    <AlertTriangle size={20} className="text-amber-500" />
                    Validation Behavior
                  </div>
                  <p className="text-sm text-gray-500 mb-6">
                    Choose how the system reacts when multiple policy rules are violated
                  </p>
                  <div className="space-y-4">
                    <label className={`
                      flex items-start p-4 border rounded-xl cursor-pointer transition-all
                      ${config.policyErrorMode === 'FAIL_FAST' ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100' : 'border-gray-200 hover:bg-gray-50'}
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
              <div className="space-y-8">
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
