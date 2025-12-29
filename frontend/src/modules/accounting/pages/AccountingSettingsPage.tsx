import React, { useState, useEffect } from 'react';
import { Settings, Shield, Lock, Building2, DollarSign, AlertTriangle, Globe, Calendar, Layout } from 'lucide-react';
import client from '../../../api/client';
import { useAuth } from '../../../hooks/useAuth';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { errorHandler } from '../../../services/errorHandler';

interface PolicyConfig {
  approvalRequired: boolean;
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
  const [activeTab, setActiveTab] = useState('policies');
  const { user } = useAuth();
  const { companyId } = useCompanyAccess();
  const { settings: coreSettings, updateSettings: updateCoreSettings } = useCompanySettings();

  const [config, setConfig] = useState<PolicyConfig>({
    approvalRequired: false,
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
    uiMode: 'windows' as 'windows' | 'classic'
  });
  const [originalCoreSettings, setOriginalCoreSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const tabs = [
    { id: 'policies', label: 'Policy Configuration', icon: Shield },
    { id: 'general', label: 'General', icon: Settings },
    { id: 'fiscal', label: 'Fiscal Year', icon: Building2 },
  ];

  // Diagnostic: log renders to detect loops
  console.debug('AccountingSettingsPage Render', { loading, companyId });

  useEffect(() => {
    if (coreSettings) {
      const newCore = {
        timezone: coreSettings.timezone || 'UTC',
        dateFormat: coreSettings.dateFormat || 'DD/MM/YYYY',
        uiMode: coreSettings.uiMode || 'windows'
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
      const response = await client.get(
        `tenant/accounting/policy-config`
      );
      
      if (response.data.success) {
        setConfig(response.data.data);
        setOriginalConfig(response.data.data);
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
      // 1. Save Policy Config
      const policyResponse = await client.put(
        `tenant/accounting/policy-config`,
        config
      );
      
      if (!policyResponse.data.success) {
        throw new Error(policyResponse.data.error?.message || 'Failed to save policy settings');
      }

      // 2. Save Core Settings if changed
      const coreChanged = JSON.stringify(localCoreSettings) !== JSON.stringify(originalCoreSettings);
      if (coreChanged) {
        await updateCoreSettings(localCoreSettings);
      }

      errorHandler.showSuccess('Settings saved successfully');
      setOriginalConfig(config);
      setOriginalCoreSettings(localCoreSettings);
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
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-2 text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Settings className="text-indigo-600" size={32} />
          Accounting Settings
        </h1>
        <p className="text-gray-600 mt-2">
          Configure your accounting module preferences and policies
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Tab Headers */}
        <div className="border-b border-gray-200 bg-gray-50">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                    ${activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'policies' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Shield className="text-indigo-600" size={24} />
                  Policy Configuration
                </h2>
                <p className="text-gray-600 mb-6">
                  Configure posting policies and validation rules for financial transactions
                </p>
              </div>

              {/* Approval Required */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <label className="flex items-center gap-2 font-medium text-gray-900">
                      <Shield size={18} className="text-blue-500" />
                      Approval Required
                    </label>
                    <p className="text-sm text-gray-600 mt-1">
                      Require approval before posting vouchers
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded">
                      <AlertTriangle size={16} />
                      Unapproved vouchers cannot be posted when enabled
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-4">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={config.approvalRequired}
                      onChange={(e) => setConfig({ ...config, approvalRequired: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
              </div>

              {/* Period Lock */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <label className="flex items-center gap-2 font-medium text-gray-900">
                      <Lock size={18} className="text-red-500" />
                      Period Lock
                    </label>
                    <p className="text-sm text-gray-600 mt-1">
                      Prevent posting to closed accounting periods
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-4">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={config.periodLockEnabled}
                      onChange={(e) => setConfig({ ...config, periodLockEnabled: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
                
                {config.periodLockEnabled && (
                  <div className="mt-3 pl-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Locked Through Date
                    </label>
                    <input
                      type="date"
                      className="block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      value={config.lockedThroughDate || ''}
                      onChange={(e) => setConfig({ ...config, lockedThroughDate: e.target.value })}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      All dates ≤ this date will be locked for posting
                    </p>
                  </div>
                )}
              </div>

              {/* Account Access Control */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <label className="flex items-center gap-2 font-medium text-gray-900">
                      <Building2 size={18} className="text-green-500" />
                      Account Access Control
                    </label>
                    <p className="text-sm text-gray-600 mt-1">
                      Restrict posting based on user access scopes and account ownership
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded">
                      <AlertTriangle size={16} />
                      Users can only post to accounts they have access to
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-4">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={config.accountAccessEnabled}
                      onChange={(e) => setConfig({ ...config, accountAccessEnabled: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
              </div>

              {/* Cost Center Required */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <label className="flex items-center gap-2 font-medium text-gray-900">
                      <DollarSign size={18} className="text-purple-500" />
                      Cost Center Required
                    </label>
                    <p className="text-sm text-gray-600 mt-1">
                      Require cost center assignment on specific account types
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-4">
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
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
                
                {config.costCenterPolicy.enabled && (
                  <div className="mt-3 pl-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Required for Account Types
                    </label>
                    <div className="space-y-2">
                      {['expense', 'revenue', 'asset', 'liability'].map((type) => (
                        <label key={type} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
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
                          <span className="text-sm text-gray-700 capitalize">{type}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Policy Error Mode */}
              <div className="border border-gray-200 rounded-lg p-4">
                <label className="block font-medium text-gray-900 mb-2">
                  Policy Error Mode
                </label>
                <p className="text-sm text-gray-600 mb-4">
                  Choose how policy violations are reported
                </p>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="policyErrorMode"
                      value="FAIL_FAST"
                      checked={config.policyErrorMode === 'FAIL_FAST'}
                      onChange={(e) => setConfig({ ...config, policyErrorMode: e.target.value as any })}
                      className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">Fail Fast (Default)</div>
                      <div className="text-sm text-gray-600">Stop at first policy violation</div>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="policyErrorMode"
                      value="AGGREGATE"
                      checked={config.policyErrorMode === 'AGGREGATE'}
                      onChange={(e) => setConfig({ ...config, policyErrorMode: e.target.value as any })}
                      className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">Aggregate</div>
                      <div className="text-sm text-gray-600">Collect all policy violations before failing</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Metadata */}
              {config.updatedAt && (
                <div className="text-sm text-gray-500 border-t pt-4">
                  Last updated: {new Date(config.updatedAt).toLocaleString()}
                  {config.updatedBy && ` by ${config.updatedBy}`}
                </div>
              )}
            </div>
          )}

          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Settings className="text-indigo-600" size={24} />
                  General Settings
                </h2>
                <p className="text-gray-600 mb-6">
                  Configure general company preferences that affect the accounting module and platform behavior
                </p>
              </div>

              {/* Timezone */}
              <div className="border border-gray-200 rounded-lg p-4">
                <label className="flex items-center gap-2 font-medium text-gray-900 mb-2">
                  <Globe size={18} className="text-blue-500" />
                  Company Timezone
                </label>
                <p className="text-sm text-gray-600 mb-4">
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
              <div className="border border-gray-200 rounded-lg p-4">
                <label className="flex items-center gap-2 font-medium text-gray-900 mb-2">
                  <Calendar size={18} className="text-green-500" />
                  Date Format
                </label>
                <p className="text-sm text-gray-600 mb-4">
                  Choose how dates are displayed across the application
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
                  {['DD/MM/YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY', 'DD.MM.YYYY'].map((format) => (
                    <label 
                      key={format}
                      className={`
                        flex items-center p-3 border rounded-lg cursor-pointer transition-all
                        ${localCoreSettings.dateFormat === format 
                          ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' 
                          : 'border-gray-200 hover:border-gray-300'}
                      `}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        checked={localCoreSettings.dateFormat === format}
                        onChange={() => setLocalCoreSettings({ ...localCoreSettings, dateFormat: format })}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">{format}</span>
                        <span className="text-xs text-gray-500">Example: {(() => {
                          const d = new Date();
                          const day = String(d.getDate()).padStart(2, '0');
                          const month = String(d.getMonth() + 1).padStart(2, '0');
                          const year = String(d.getFullYear());
                          if (format === 'DD/MM/YYYY') return `${day}/${month}/${year}`;
                          if (format === 'YYYY-MM-DD') return `${year}-${month}-${day}`;
                          if (format === 'MM/DD/YYYY') return `${month}/${day}/${year}`;
                          if (format === 'DD.MM.YYYY') return `${day}.${month}.${year}`;
                          return format;
                        })()}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* UI Mode */}
              <div className="border border-gray-200 rounded-lg p-4">
                <label className="flex items-center gap-2 font-medium text-gray-900 mb-2">
                  <Layout size={18} className="text-purple-500" />
                  Interface Style
                </label>
                <p className="text-sm text-gray-600 mb-4">
                  Choose the primary desktop experience
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={() => setLocalCoreSettings({ ...localCoreSettings, uiMode: 'classic' })}
                    className={`flex-1 p-4 border rounded-xl text-left transition-all ${
                      localCoreSettings.uiMode === 'classic' 
                      ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-100' 
                      : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-bold text-gray-900">Classic</div>
                    <div className="text-xs text-gray-500">Tabbed, flat interface</div>
                  </button>
                  <button
                    onClick={() => setLocalCoreSettings({ ...localCoreSettings, uiMode: 'windows' })}
                    className={`flex-1 p-4 border rounded-xl text-left transition-all ${
                      localCoreSettings.uiMode === 'windows' 
                      ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-100' 
                      : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-bold text-gray-900">Windows (V3)</div>
                    <div className="text-xs text-gray-500">Multi-window multitasking</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'fiscal' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Fiscal Year Settings</h2>
              <p className="text-gray-600">
                Configure fiscal year start date and year-end closing preferences.
              </p>
              {/* Fiscal year settings will go here */}
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={loadSettings}
          disabled={!hasChanges || saving}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reset
        </button>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving && (
            <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          )}
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};
