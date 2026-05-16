/**
 * AiAssistantSettingsPage.tsx
 *
 * Rebuilt for clarity. Three tabs: Setup | Analytics | Security
 *
 * Setup tab layout (top to bottom):
 *   1. Status banner — what's active right now
 *   2. Enable/Disable toggle
 *   3. Mode selector (BYOK / Credits / Disabled)
 *   4. Mode-specific content:
 *        BYOK    → Provider card  →  Certification card  →  Advanced (collapsed)
 *        CREDITS → Model selector →  Advanced (collapsed)
 *        DISABLED → info message
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Globe,
  Loader2,
  Shield,
  ShieldCheck,
  ToggleLeft,
} from 'lucide-react';
import { ModuleSettingsLayout, SettingsSection } from '../../../components/shared/ModuleSettingsLayout';
import { useRBAC } from '../../../api/rbac/useRBAC';
import { CertifiedModelsModal } from '../components/CertifiedModelsModal';
import { AiSetupWizard } from '../components/AiSetupWizard';
import { useAiSettings } from '../hooks/useAiSettings';
import { RuntimeModeSelector } from '../components/RuntimeModeSelector';
import { ProviderSelector } from '../components/ProviderSelector';
import { ModelSelector } from '../components/ModelSelector';
import { ApiKeyInput } from '../components/ApiKeyInput';
import { ContextBudgetSettings } from '../components/ContextBudgetSettings';
import { DiagnosticsPanel } from '../components/DiagnosticsPanel';
import { CreditsModelSelector } from '../components/CreditsModelSelector';
import { CreditBalanceCard } from '../components/CreditBalanceCard';
import { AiCertificationCard } from '../components/AiCertificationCard';
import { SettingsSecurityTab } from '../components/SettingsSecurityTab';
import { SettingsAnalyticsTab } from '../components/SettingsAnalyticsTab';

// ── Helpers ────────────────────────────────────────────────────────────────────

function resolveStatusLabel(
  isEnabled: boolean,
  runtimeMode: string,
  provider: string,
  model: string,
): { text: string; color: 'green' | 'amber' | 'gray' } {
  if (!isEnabled) return { text: 'Disabled', color: 'gray' };
  if (runtimeMode === 'DISABLED') return { text: 'Module off', color: 'gray' };
  if (runtimeMode === 'CREDITS') return { text: 'Credits mode active', color: 'green' };
  if (provider === 'mock') return { text: 'Mock mode (dev only)', color: 'amber' };
  if (model) return { text: `${model} · BYOK`, color: 'green' };
  return { text: 'BYOK — model not configured', color: 'amber' };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const StatusBanner: React.FC<{
  isEnabled: boolean;
  runtimeMode: string;
  provider: string;
  model: string;
}> = ({ isEnabled, runtimeMode, provider, model }) => {
  const { color, text } = resolveStatusLabel(isEnabled, runtimeMode, provider, model);

  const dot =
    color === 'green' ? 'bg-green-400' :
    color === 'amber' ? 'bg-amber-400' :
    'bg-gray-400';

  const banner =
    color === 'green' ? 'border-green-200 bg-green-50 text-green-800' :
    color === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-800' :
    'border-gray-200 bg-gray-50 text-gray-600';

  return (
    <div className={`mb-6 flex items-center gap-2.5 rounded-lg border px-4 py-2.5 text-sm font-medium ${banner}`}>
      <span className={`h-2 w-2 rounded-full flex-shrink-0 ${dot}`} />
      {text}
    </div>
  );
};

const SectionCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({
  title, icon, children,
}) => (
  <div className="rounded-lg border border-gray-200 bg-white">
    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
      <span className="text-gray-500">{icon}</span>
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const Toggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
  description?: string;
}> = ({ checked, onChange, disabled, label, description }) => (
  <div className="flex items-center justify-between">
    <div>
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
        checked ? 'bg-indigo-600' : 'bg-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  </div>
);

const CollapsibleSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, icon, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-gray-500">{icon}</span>
          <span className="text-sm font-semibold text-gray-800">{title}</span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>
      {open && <div className="border-t border-gray-100 p-4">{children}</div>}
    </div>
  );
};

// ── Provider + Model config block (BYOK) ─────────────────────────────────────

const ByokProviderConfig: React.FC<{
  ai: ReturnType<typeof useAiSettings>;
  canManage: boolean;
}> = ({ ai, canManage }) => {
  const { t } = useTranslation('aiAssistant');

  return (
    <div className="space-y-4">
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
        <div className="space-y-3 pl-4 border-l-2 border-indigo-200">
          {ai.showApiKeyField && (
            <ApiKeyInput
              apiKey={ai.apiKey}
              hasApiKey={ai.settings?.hasApiKey}
              canManage={canManage}
              onChange={ai.setApiKey}
            />
          )}

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
              className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                !!ai.selectedProviderOption && ai.selectedProviderId !== '__custom__'
                  ? 'bg-gray-50 text-gray-500'
                  : ''
              }`}
            />
            {!!ai.selectedProviderOption && ai.selectedProviderId !== '__custom__' && canManage && (
              <p className="text-xs text-gray-400 mt-1">
                {t('settings.endpointFromProvider', 'Set by provider. Switch to Custom to edit.')}
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
    </div>
  );
};

// ── Main page ──────────────────────────────────────────────────────────────────

export const AiAssistantSettingsPage: React.FC = () => {
  const { t } = useTranslation('aiAssistant');
  const navigate = useNavigate();
  const { hasPermission } = useRBAC();
  const [activeTab, setActiveTab] = useState('setup');
  const [setupComplete, setSetupComplete] = useState(false);

  const canManage = hasPermission('ai-assistant.settings.manage');
  const canView = hasPermission('ai-assistant.settings.view');
  const canChat = hasPermission('ai-assistant.chat.use');

  const ai = useAiSettings(canView, canManage);

  const hasConfiguredAi = Boolean(
    ai.settings && (
      ai.settings.runtimeMode === 'DISABLED' ||
      (ai.settings.runtimeMode === 'CREDITS' && ai.settings.selectedModelProfileId && ai.settings.selectedProfileHash) ||
      (ai.settings.runtimeMode === 'BYOK' && ai.settings.provider !== 'mock' && (ai.settings.hasApiKey || ai.settings.provider === 'ollama'))
    )
  );

  const shouldShowSetupWizard = Boolean(
    canManage && !ai.loading && !ai.error && !setupComplete &&
    ai.settings?.isEnabled && !hasConfiguredAi
  );

  const handleSetupComplete = () => {
    setSetupComplete(true);
    if (canChat) navigate('/ai-assistant');
  };

  // ── No permission ────────────────────────────────────────────────────────────

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">{t('settings.noPermission')}</p>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <ModuleSettingsLayout
      title={t('settings.title', 'AI Assistant Settings')}
      subtitle={t('settings.subtitle', 'Configure the AI provider and preferences for your company.')}
      tabs={[
        { id: 'setup', label: t('settings.setupTab', 'Setup'), icon: ShieldCheck },
        { id: 'analytics', label: t('settings.analyticsTab', 'Analytics'), icon: BarChart3 },
        { id: 'security', label: t('settings.securityTab', 'Security'), icon: Shield },
      ]}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {/* ── Setup Tab ─────────────────────────────────────────────────────────── */}
      {activeTab === 'setup' && (
        <SettingsSection
          title={t('settings.setupTab', 'AI Setup')}
          description={t('settings.setupDesc', 'Configure how your company connects to AI.')}
          onSave={canManage ? ai.handleSave : () => {}}
          disabled={!ai.hasChanges || ai.saving}
          saving={ai.saving}
          hideSaveButton={ai.loading || shouldShowSetupWizard}
        >
          {/* Loading */}
          {ai.loading && (
            <div className="flex items-center justify-center py-16 text-sm text-gray-500">
              <Loader2 className="w-5 h-5 mr-2 animate-spin text-indigo-600" />
              {t('settings.loading', 'Loading settings…')}
            </div>
          )}

          {/* First-run wizard */}
          {shouldShowSetupWizard && (
            <AiSetupWizard isConfigured={hasConfiguredAi} onComplete={handleSetupComplete} />
          )}

          {!ai.loading && !shouldShowSetupWizard && (
            <div className="space-y-4">
              {ai.error && (
                <div className="px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
                  {ai.error}
                </div>
              )}

              {/* Status banner */}
              {ai.settings && (
                <StatusBanner
                  isEnabled={ai.isEnabled}
                  runtimeMode={ai.runtimeMode}
                  provider={ai.provider}
                  model={ai.model}
                />
              )}

              {/* Enable toggle */}
              <SectionCard
                title={t('settings.enableSection', 'Module')}
                icon={<ToggleLeft className="h-4 w-4" />}
              >
                <Toggle
                  checked={ai.isEnabled}
                  onChange={(v) => canManage && ai.setIsEnabled(v)}
                  disabled={!canManage}
                  label={t('settings.enableAssistant', 'Enable AI Assistant')}
                  description={t('settings.enableAssistantDesc', 'When disabled, users cannot access the AI Assistant chat.')}
                />
              </SectionCard>

              {/* Rest dimmed when module is off */}
              <div className={ai.isEnabled ? '' : 'opacity-40 pointer-events-none select-none'}>
                <div className="space-y-4">

                  {/* Mode selector */}
                  {ai.allowedRuntimeModes.length > 1 && (
                    <SectionCard
                      title={t('settings.modeSection', 'Connection Mode')}
                      icon={<Shield className="h-4 w-4" />}
                    >
                      <RuntimeModeSelector
                        runtimeMode={ai.runtimeMode}
                        allowedRuntimeModes={ai.allowedRuntimeModes}
                        canManage={canManage}
                        onChange={ai.setRuntimeMode}
                      />
                    </SectionCard>
                  )}

                  {/* ─── BYOK ─── */}
                  {ai.runtimeMode === 'BYOK' && (
                    <>
                      <SectionCard
                        title={t('settings.providerSection', 'Provider & Model')}
                        icon={<Globe className="h-4 w-4" />}
                      >
                        <ByokProviderConfig ai={ai} canManage={canManage} />
                      </SectionCard>

                      <SectionCard
                        title={t('settings.certificationSection', 'Certification')}
                        icon={<ShieldCheck className="h-4 w-4" />}
                      >
                        <AiCertificationCard
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
                      </SectionCard>

                      <CollapsibleSection
                        title={t('settings.advancedSection', 'Advanced Settings')}
                        icon={<Activity className="h-4 w-4" />}
                      >
                        <div className="space-y-4">
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
                          <DiagnosticsPanel
                            onRunDiagnostics={ai.handleRunDiagnostics}
                            healthTesting={ai.healthTesting}
                            healthResult={ai.healthResult}
                            healthError={ai.healthError}
                            hasUnsavedChanges={ai.hasUnsavedChanges}
                            runtimeMode={ai.runtimeMode}
                            canManage={canManage}
                          />
                        </div>
                      </CollapsibleSection>
                    </>
                  )}

                  {/* ─── CREDITS ─── */}
                  {ai.runtimeMode === 'CREDITS' && (
                    <>
                      <SectionCard
                        title={t('settings.creditsModelSection', 'AI Model')}
                        icon={<ShieldCheck className="h-4 w-4" />}
                      >
                        <CreditBalanceCard />
                        <div className="mt-4">
                          <CreditsModelSelector
                            erp03AvailableModels={ai.erp03AvailableModels}
                            erp03ModelsLoading={ai.erp03ModelsLoading}
                            selectedErp03Profile={ai.selectedErp03Profile}
                            canManage={canManage}
                            onSelect={ai.setSelectedErp03Profile}
                            onDeselect={() => ai.setSelectedErp03Profile(null)}
                            creditBalance={null}
                          />
                        </div>
                      </SectionCard>

                      <CollapsibleSection
                        title={t('settings.advancedSection', 'Advanced Settings')}
                        icon={<Activity className="h-4 w-4" />}
                      >
                        <div className="space-y-4">
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
                          <DiagnosticsPanel
                            onRunDiagnostics={ai.handleRunDiagnostics}
                            healthTesting={ai.healthTesting}
                            healthResult={ai.healthResult}
                            healthError={ai.healthError}
                            hasUnsavedChanges={ai.hasUnsavedChanges}
                            runtimeMode={ai.runtimeMode}
                            canManage={canManage}
                          />
                        </div>
                      </CollapsibleSection>
                    </>
                  )}

                  {/* ─── DISABLED ─── */}
                  {ai.runtimeMode === 'DISABLED' && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
                      <ToggleLeft className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                      <h3 className="text-sm font-medium text-gray-700 mb-1">
                        {t('settings.disabledInfoTitle', 'AI Assistant is off')}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {t('settings.disabledInfoDesc', 'No configuration needed. Enable it above to use AI features.')}
                      </p>
                    </div>
                  )}

                </div>
              </div>

              {/* Current config footer */}
              {ai.settings && (
                <div className="text-xs text-gray-400 pt-3 border-t border-gray-100">
                  {t('settings.currentProvider', 'Provider')}: <strong>{ai.settings.provider}</strong>
                  {ai.settings.model && <> · {t('settings.currentModel', 'Model')}: <strong>{ai.settings.model}</strong></>}
                  {' · '}{t('settings.hasApiKey', 'API Key')}: <strong>{ai.settings.hasApiKey ? '✓' : '✗'}</strong>
                  {' · '}{t('settings.lastUpdated', 'Updated')}: {new Date(ai.settings.updatedAt).toLocaleString()}
                </div>
              )}
            </div>
          )}

          <CertifiedModelsModal
            isOpen={ai.showCertifiedModels}
            onClose={() => ai.setShowCertifiedModels(false)}
            onSelectProfile={ai.handleSelectCertifiedProfile}
          />
        </SettingsSection>
      )}

      {activeTab === 'analytics' && (
        <SettingsAnalyticsTab usageLoading={ai.usageLoading} usageAnalytics={ai.usageAnalytics} />
      )}
      {activeTab === 'security' && <SettingsSecurityTab />}
    </ModuleSettingsLayout>
  );
};

export default AiAssistantSettingsPage;
