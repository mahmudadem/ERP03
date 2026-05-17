/**
 * AiAssistantSettingsPage.tsx
 *
 * Settings page for AI Assistant provider configuration.
 * Uses the shared ModuleSettingsLayout component.
 * Allows company admins to select provider preset, configure API keys, and toggle the module.
 *
 * Provider presets auto-fill endpoint and model fields.
 * The backend receives 'openai_compatible' for OpenAI, OpenRouter, Groq, and Custom.
 * Only 'mock' and 'ollama' are sent as distinct provider types.
 *
 * State management is encapsulated in the useAiSettings hook.
 * This component is purely presentational (layout + composition).
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, ShieldCheck, ExternalLink, Globe, BarChart3, ToggleLeft, Loader2 } from 'lucide-react';
import { ModuleSettingsLayout, SettingsSection } from '../../../components/shared/ModuleSettingsLayout';
import { useRBAC } from '../../../api/rbac/useRBAC';
import { CertifiedModelsModal } from '../components/CertifiedModelsModal';

import { useAiSettings } from '../hooks/useAiSettings';

import { RuntimeModeSelector } from '../components/RuntimeModeSelector';
import { ProviderSelector } from '../components/ProviderSelector';
import { ModelSelector } from '../components/ModelSelector';
import { ApiKeyInput } from '../components/ApiKeyInput';
import { ContextBudgetSettings } from '../components/ContextBudgetSettings';
import { DiagnosticsPanel } from '../components/DiagnosticsPanel';
import { CreditsModelSelector } from '../components/CreditsModelSelector';
import { CreditBalanceCard } from '../components/CreditBalanceCard';
import { ByokCertificationSection } from '../components/ByokCertificationSection';
import { SettingsSecurityTab } from '../components/SettingsSecurityTab';
import { SettingsAnalyticsTab } from '../components/SettingsAnalyticsTab';

// ── Component ───────────────────────────────────────────────────────────────────

export const AiAssistantSettingsPage: React.FC = () => {
  const { t } = useTranslation('aiAssistant');
  const { hasPermission } = useRBAC();
  const [activeTab, setActiveTab] = useState('provider');

  const canManage = hasPermission('ai-assistant.settings.manage');
  const canView = hasPermission('ai-assistant.settings.view');

  const ai = useAiSettings(canView, canManage);

  // ── Early return: no permission ────────────────────────────────────────────

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">{t('settings.noPermission')}</p>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <ModuleSettingsLayout
      title={t('settings.title', 'AI Assistant Settings')}
      subtitle={t('settings.subtitle', 'Configure the AI provider and preferences for your company.')}
      tabs={[
        { id: 'provider', label: t('settings.providerTab', 'Provider'), icon: Globe },
        { id: 'security', label: t('settings.securityTab', 'Security'), icon: Shield },
        { id: 'analytics', label: t('settings.analyticsTab', 'Analytics'), icon: BarChart3 },
      ]}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {activeTab === 'provider' && (
        <SettingsSection
          title={t('settings.providerTab', 'AI Provider')}
          description={t('settings.providerDesc', 'Select and configure the AI provider for your company.')}
          onSave={canManage ? ai.handleSave : () => {}}
          disabled={!ai.hasChanges || ai.saving}
          saving={ai.saving}
          hideSaveButton={ai.loading}
        >
          {ai.loading && (
            <div className="flex items-center justify-center py-16 text-sm text-gray-500">
              <Loader2 className="w-5 h-5 mr-2 animate-spin text-indigo-600" />
              {t('settings.loading', 'Loading settings...')}
            </div>
          )}

          {!ai.loading && (
            <>
          {ai.error && (
            <div className="mb-4 px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
              {ai.error}
            </div>
          )}

          {/* Enable/Disable Toggle */}
          <div className="mb-4 flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div>
              <span className="text-sm font-medium text-gray-700">
                {t('settings.enableAssistant', 'Enable AI Assistant')}
              </span>
              <p className="text-xs text-gray-400 mt-0.5">
                {t('settings.enableAssistantDesc', 'When disabled, users cannot access the AI Assistant chat.')}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={ai.isEnabled}
              onClick={() => canManage && ai.setIsEnabled(!ai.isEnabled)}
              disabled={!canManage}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                ai.isEnabled ? 'bg-indigo-600' : 'bg-gray-300'
              } ${!canManage ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  ai.isEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Allow Unverified Models (Hybrid Safety Switch) */}
          <div className="mb-6 flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-900">
                  {t('settings.allowUnverifiedModels', 'Allow Unverified Models')}
                </span>
              </div>
              <p className="text-xs text-amber-700 mt-0.5">
                {t('settings.allowUnverifiedModelsDesc', 'Allow the AI to use models that are not certified. Recommended only for testing or with highly trusted private models.')}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={ai.allowUnverifiedModels}
              onClick={() => canManage && ai.setAllowUnverifiedModels(!ai.allowUnverifiedModels)}
              disabled={!canManage}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-600 focus:ring-offset-2 ${
                ai.allowUnverifiedModels ? 'bg-amber-600' : 'bg-gray-300'
              } ${!canManage ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  ai.allowUnverifiedModels ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Config wrapper — dimmed when disabled */}
          <div className={ai.isEnabled ? '' : 'opacity-40 pointer-events-none select-none'}>

            <RuntimeModeSelector
              runtimeMode={ai.runtimeMode}
              allowedRuntimeModes={ai.allowedRuntimeModes}
              canManage={canManage}
              onChange={ai.setRuntimeMode}
            />

            {/* Certified Models Reference (always visible) */}
            <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-indigo-800">
                    {t('settings.certifiedModelsReferenceTitle', 'Certified Models')}
                  </h3>
                  <p className="text-xs text-indigo-600 mt-0.5">
                    {t('settings.certifiedModelsReferenceDesc', 'See which models are tested and certified by the platform.')}
                  </p>
                  <button
                    type="button"
                    onClick={() => ai.setShowCertifiedModels(true)}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 hover:text-indigo-900 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {t('settings.certifiedModels.openModal', 'Browse Certified Models')}
                  </button>
                </div>
              </div>
            </div>

            {/* ═══ BYOK Mode ═══ */}
            {ai.runtimeMode === 'BYOK' && (
              <>
                <ProviderSelector
                  selectedProviderId={ai.selectedProviderId}
                  presetId={ai.presetId}
                  availableProviders={ai.availableProviders}
                  selectedProviderOption={ai.selectedProviderOption}
                  currentPreset={ai.currentPreset}
                  providersLoading={ai.providersLoading}
                  canManage={canManage}
                  onChange={ai.handleProviderChange}
                />

                {ai.showProviderFields && (
                  <div className="space-y-4 mb-6 pl-4 border-l-2 border-indigo-200">
                    {ai.showApiKeyField && (
                      <ApiKeyInput
                        apiKey={ai.apiKey}
                        hasApiKey={ai.settings?.hasApiKey}
                        canManage={canManage}
                        onChange={ai.setApiKey}
                      />
                    )}

                    {/* API Endpoint */}
                    <div>
                      <label htmlFor="api-endpoint" className="block text-sm font-medium text-gray-700 mb-1">
                        <Globe className="w-4 h-4 inline mr-1" />
                        {t('settings.apiEndpoint', 'API Endpoint')}
                      </label>
                      <input
                        id="api-endpoint"
                        type="text"
                        value={ai.apiEndpoint}
                        onChange={(e) => ai.setApiEndpoint(e.target.value)}
                        placeholder="https://api.openai.com/v1"
                        disabled={!canManage || (!!ai.selectedProviderOption && ai.selectedProviderId !== '__custom__')}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm ${
                          !!ai.selectedProviderOption && ai.selectedProviderId !== '__custom__' ? 'bg-gray-50 text-gray-600' : ''
                        }`}
                      />
                      {!!ai.selectedProviderOption && ai.selectedProviderId !== '__custom__' && canManage && (
                        <p className="text-xs text-gray-400 mt-1">
                          {t('settings.endpointFromProvider', 'Endpoint set by provider. Switch to Custom to edit.')}
                        </p>
                      )}
                      {!ai.selectedProviderOption && !ai.isCustom && canManage && (
                        <p className="text-xs text-gray-400 mt-1">
                          {t('settings.endpointPresetLocked', 'Switch to "Custom" to edit the endpoint URL.')}
                        </p>
                      )}
                    </div>

                    <ModelSelector
                      model={ai.model}
                      providerModels={ai.providerModels}
                      selectedProviderOption={ai.selectedProviderOption}
                      useDynamicProvider={ai.useDynamicProvider}
                      modelsLoading={ai.modelsLoading}
                      currentPreset={ai.currentPreset}
                      canManage={canManage}
                      modelFieldId={ai.modelFieldId}
                      onModelChange={ai.setModel}
                    />
                  </div>
                )}

                <ByokCertificationSection
                  selectedCertifiedProfile={ai.selectedCertifiedProfile}
                  certificationMatch={ai.certificationMatch}
                  registeredProfileId={ai.registeredProfileId}
                  registeredProfileData={ai.registeredProfileData}
                  registeredDiagnosticResult={ai.registeredDiagnosticResult}
                  registeredCertResult={ai.registeredCertResult}
                  registeredCertCategory={ai.registeredCertCategory}
                  isRegistering={ai.isRegistering}
                  isRunningDiag={ai.isRunningDiag}
                  isRunningCert={ai.isRunningCert}
                  isDeprecating={ai.isDeprecating}
                  canManage={canManage}
                  onShowCertifiedModels={() => ai.setShowCertifiedModels(true)}
                  onRegisterAndCertify={ai.handleRegisterAndCertify}
                  onRunRegisteredDiagnostics={ai.handleRunRegisteredDiagnostics}
                  onRunRegisteredCertification={ai.handleRunRegisteredCertification}
                  onCancelRegistration={ai.handleCancelRegistration}
                  onDeprecateProfile={ai.handleDeprecateProfile}
                  onSetRegisteredCertCategory={ai.setRegisteredCertCategory}
                />
              </>
            )}

            {/* ═══ CREDITS Mode ═══ */}
            {ai.runtimeMode === 'CREDITS' && (
              <>
                <CreditBalanceCard />
                <CreditsModelSelector
                erp03AvailableModels={ai.erp03AvailableModels}
                erp03ModelsLoading={ai.erp03ModelsLoading}
                selectedErp03Profile={ai.selectedErp03Profile}
                canManage={canManage}
                onSelect={ai.setSelectedErp03Profile}
                onDeselect={() => ai.setSelectedErp03Profile(null)}
                creditBalance={null}
              />
              </>
            )}

            {/* ═══ DISABLED Mode ═══ */}
            {ai.runtimeMode === 'DISABLED' && (
              <div className="mb-6 p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
                <ToggleLeft className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                <h3 className="text-sm font-medium text-gray-700 mb-1">
                  {t('settings.disabledInfoTitle', 'AI Assistant is disabled')}
                </h3>
                <p className="text-xs text-gray-500">
                  {t('settings.disabledInfoDesc', 'No configuration needed. Contact your administrator to enable AI Assistant for your company.')}
                </p>
              </div>
            )}

            {/* Advanced Settings (BYOK + CREDITS only) */}
            {ai.runtimeMode !== 'DISABLED' && (
              <ContextBudgetSettings
                conversationContextMode={ai.conversationContextMode}
                includePreviousToolResults={ai.includePreviousToolResults}
                maxTokens={ai.maxTokens}
                maxRequestsPerDay={ai.maxRequestsPerDay}
                canManage={canManage}
                onConversationContextModeChange={ai.setConversationContextMode}
                onIncludePreviousToolResultsChange={ai.setIncludePreviousToolResults}
                onMaxTokensChange={ai.setMaxTokens}
                onMaxRequestsPerDayChange={ai.setMaxRequestsPerDay}
              />
            )}

            {/* Diagnostics (BYOK + CREDITS only) */}
            {ai.runtimeMode !== 'DISABLED' && (
              <DiagnosticsPanel
                onRunDiagnostics={ai.handleRunDiagnostics}
                healthTesting={ai.healthTesting}
                healthResult={ai.healthResult}
                healthError={ai.healthError}
                hasUnsavedChanges={ai.hasUnsavedChanges}
                runtimeMode={ai.runtimeMode}
                canManage={canManage}
              />
            )}

            {/* Current Config Info */}
            {ai.settings && (
              <div className="text-xs text-gray-400 mt-4 pt-4 border-t">
                {t('settings.currentProvider', 'Current Provider')}: <strong>{ai.settings.provider}</strong>
                {ai.settings.model && <> | {t('settings.currentModel', 'Model')}: <strong>{ai.settings.model}</strong></>}
                {' | '}{t('settings.hasApiKey', 'API Key')}: <strong>{ai.settings.hasApiKey ? '✓' : '✗'}</strong>
                {' | '}{t('settings.lastUpdated', 'Updated')}: {new Date(ai.settings.updatedAt).toLocaleString()}
              </div>
            )}

          </div>{/* end isEnabled wrapper */}

          <CertifiedModelsModal
            isOpen={ai.showCertifiedModels}
            onClose={() => ai.setShowCertifiedModels(false)}
            onSelectProfile={ai.handleSelectCertifiedProfile}
          />
            </>
          )}
        </SettingsSection>
      )}

      {activeTab === 'security' && <SettingsSecurityTab />}
      {activeTab === 'analytics' && <SettingsAnalyticsTab usageLoading={ai.usageLoading} usageAnalytics={ai.usageAnalytics} />}
    </ModuleSettingsLayout>
  );
};

export default AiAssistantSettingsPage;
