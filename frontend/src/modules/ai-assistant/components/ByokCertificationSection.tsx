/**
 * ByokCertificationSection.tsx
 *
 * BYOK mode certification status, registration, diagnostics, and safety disclaimers.
 * This is the largest section of the BYOK settings — scenarios A through D.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Shield,
  ShieldCheck,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import { Spinner } from '../../../components/ui/Spinner';
import type {
  CertifiedProfileEntry,
  ProviderHealthResponse,
  AiCertificationResult,
  AiCertificationCategory,
} from '../../../api/aiAssistantApi';
import { DIAGNOSTIC_CHECK_FALLBACKS, DIAGNOSTIC_MODE_FALLBACKS, getDiagnosticStatusClasses, getDiagnosticStatusIcon } from '../utils/settingsHelpers';

interface ByokCertificationSectionProps {
  selectedCertifiedProfile: CertifiedProfileEntry | null;
  certificationMatch: { entry: CertifiedProfileEntry; isGlobal: boolean } | null;
  registeredProfileId: string | null;
  registeredProfileData: Record<string, unknown> | null;
  registeredDiagnosticResult: ProviderHealthResponse | null;
  registeredCertResult: AiCertificationResult | null;
  registeredCertCategory: AiCertificationCategory;
  isRegistering: boolean;
  isRunningDiag: boolean;
  isRunningCert: boolean;
  isDeprecating: boolean;
  canManage: boolean;
  onShowCertifiedModels: () => void;
  onRegisterAndCertify: () => void;
  onRunRegisteredDiagnostics: () => void;
  onRunRegisteredCertification: () => void;
  onCancelRegistration: () => void;
  onDeprecateProfile: () => void;
  onSetRegisteredCertCategory: (category: AiCertificationCategory) => void;
}

const CERT_CATEGORY_OPTIONS: AiCertificationCategory[] = [
  'GENERAL_CHAT', 'ACCOUNTING', 'FINANCE_REPORTING', 'SALES',
  'PURCHASES', 'INVENTORY', 'HR', 'CRM',
  'TOOL_CALLING', 'DATA_FILTERING', 'PROPOSAL_DRAFT', 'ANALYTICS',
];

export const ByokCertificationSection: React.FC<ByokCertificationSectionProps> = ({
  selectedCertifiedProfile,
  certificationMatch,
  registeredProfileId,
  registeredProfileData,
  registeredDiagnosticResult,
  registeredCertResult,
  registeredCertCategory,
  isRegistering,
  isRunningDiag,
  isRunningCert,
  isDeprecating,
  canManage,
  onShowCertifiedModels,
  onRegisterAndCertify,
  onRunRegisteredDiagnostics,
  onRunRegisteredCertification,
  onCancelRegistration,
  onDeprecateProfile,
  onSetRegisteredCertCategory,
}) => {
  const { t } = useTranslation('aiAssistant');

  return (
    <div className="mt-6 pt-6 border-t border-gray-200">
      <h3 className="text-sm font-medium text-gray-800 mb-3">
        <ShieldCheck className="w-4 h-4 inline mr-1.5 text-indigo-600" />
        {t('settings.certificationStatus.title', 'Certification Status')}
      </h3>

      {/* Scenario A: User selected a certified profile from modal */}
      {selectedCertifiedProfile ? (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-green-800">
            <ShieldCheck className="w-4 h-4" />
            {t('settings.certifiedModels.selectedProfile', 'Certified Profile Selected')}
          </div>
          <div className="mt-1 text-xs text-green-700">
            {(() => {
              const p = selectedCertifiedProfile.profile as Record<string, unknown>;
              const name = String(p.displayName || p.modelName || 'Unknown');
              return t('settings.certifiedModels.profileSelected', { defaultValue: 'Profile: {{name}}', name });
            })()}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {(() => {
              const cats = selectedCertifiedProfile.certifications
                ?.filter((c) => !['blocked', 'deprecated', 'expired'].includes(String(c.status).toLowerCase()))
                .map((c) => c.category) ?? [];
              const uniqueCats = [...new Set(cats)];
              const hasGlobal = selectedCertifiedProfile.certifications?.some((c) => c.scope === 'GLOBAL');
              const scopeLabel = hasGlobal
                ? t('settings.certifiedModels.scopeGlobal', 'GLOBAL')
                : t('settings.certifiedModels.scopeTenant', 'TENANT');
              const scopeColor = hasGlobal ? 'bg-green-100 text-green-800 border-green-200' : 'bg-blue-100 text-blue-800 border-blue-200';
              return (
                <>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${scopeColor}`}>
                    {scopeLabel}
                  </span>
                  {uniqueCats.map((cat) => (
                    <span key={cat} className="inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                      {cat}
                    </span>
                  ))}
                </>
              );
            })()}
          </div>
        </div>
      ) : (
        <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
          {t('settings.certifiedModels.noProfile', 'No certified profile selected')}
        </div>
      )}

      {/* Browse Certified Models button */}
      <button
        type="button"
        onClick={onShowCertifiedModels}
        className="mb-4 inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
      >
        <ExternalLink className="w-4 h-4" />
        {t('settings.certifiedModels.openModal', 'Browse Certified Models')}
      </button>

      {/* Scenario B: Current model matches an existing certified profile */}
      {certificationMatch && !selectedCertifiedProfile && !registeredProfileId && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-green-800">
            <CheckCircle2 className="w-4 h-4" />
            {certificationMatch.isGlobal
              ? t('settings.certificationStatus.globalMatch', 'This model is globally certified')
              : t('settings.certificationStatus.tenantMatch', 'This model is company certified')
            }
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {(() => {
              const cats = certificationMatch.entry.certifications
                ?.filter((c) => !['blocked', 'deprecated', 'expired'].includes(String(c.status).toLowerCase()))
                .map((c) => c.category) ?? [];
              const uniqueCats = [...new Set(cats)];
              const scopeLabel = certificationMatch.isGlobal
                ? t('settings.certifiedModels.scopeGlobal', 'GLOBAL')
                : t('settings.certifiedModels.scopeTenant', 'TENANT');
              const scopeColor = certificationMatch.isGlobal ? 'bg-green-100 text-green-800 border-green-200' : 'bg-blue-100 text-blue-800 border-blue-200';
              return (
                <>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${scopeColor}`}>
                    {scopeLabel}
                  </span>
                  {uniqueCats.map((cat) => (
                    <span key={cat} className="inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                      {cat}
                    </span>
                  ))}
                </>
              );
            })()}
          </div>
          <p className="mt-2 text-xs text-green-700">
            {t('settings.certificationStatus.globalMatchDesc', 'Sensitive ERP tools are available for this model.')}
          </p>
        </div>
      )}

      {/* Scenario C: Model registered but not yet certified */}
      {registeredProfileId && !selectedCertifiedProfile && !certificationMatch && (
        <div className="space-y-4">
          {/* Profile info card */}
          <div className="rounded-md border border-gray-200 bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs text-gray-500">{t('settings.certificationStatus.profileId', 'Profile ID')}</div>
                <div className="mt-0.5 font-mono text-sm text-gray-800 truncate" title={registeredProfileId}>
                  {registeredProfileId.length > 20 ? `${registeredProfileId.slice(0, 20)}...` : registeredProfileId}
                </div>
              </div>
              {(registeredProfileData as any)?.modelId && (
                <div>
                  <div className="text-xs text-gray-500">{t('settings.customModel.modelId', 'Model ID')}</div>
                  <div className="mt-0.5 font-mono text-sm text-gray-800">{String((registeredProfileData as any).modelId)}</div>
                </div>
              )}
              <div>
                <div className="text-xs text-gray-500">{t('settings.customModel.status', 'Status')}</div>
                <div className="mt-0.5 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {t('settings.certificationStatus.tenantProfile', 'Company Profile')}
                  </span>
                  {registeredCertResult ? (
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
                      registeredCertResult.status === 'CERTIFIED' ? 'border-green-200 bg-green-100 text-green-800'
                      : registeredCertResult.status === 'WARNING' ? 'border-amber-200 bg-amber-100 text-amber-800'
                      : registeredCertResult.status === 'FAILED' ? 'border-red-200 bg-red-100 text-red-800'
                      : 'border-slate-200 bg-slate-100 text-slate-700'
                    }`}>
                      {registeredCertResult.status}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      {t('settings.certificationStatus.uncertified', 'Uncertified — sensitive ERP tools are blocked')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Profile Configuration (auto-configured, read-only) */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-medium text-gray-500">
                  {t('settings.certificationStatus.profileConfig', 'Auto-Configured Profile Settings')}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">{t('settings.certificationStatus.configToolMode', 'Tool Mode')}:</span>
                  <span className="font-mono text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded">
                    {String((registeredProfileData as any)?.toolMode || 'text_plan')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">{t('settings.certificationStatus.configDataFilter', 'Data Filter')}:</span>
                  <span className="font-mono text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded">
                    {String((registeredProfileData as any)?.dataFilterPolicyId || 'ai-data-filter-v1')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">{t('settings.certificationStatus.configTemp', 'Temperature')}:</span>
                  <span className="font-mono text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded">
                    {String((registeredProfileData as any)?.temperature ?? 0.7)}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                {t('settings.certificationStatus.configNote', 'Auto-configured for safe ERP tool access. Contact your administrator to change these settings.')}
              </p>
            </div>
          </div>

          {/* Diagnostics */}
          <div className="rounded-md border border-gray-200 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <Activity className="mt-0.5 h-5 w-5 flex-shrink-0 text-indigo-600" />
                <div>
                  <h4 className="text-sm font-medium text-gray-800">
                    {t('settings.certificationStatus.runDiagnostics', 'Run Diagnostics')}
                  </h4>
                  <p className="mt-1 text-xs text-amber-700">
                    {t('settings.certificationStatus.diagnosticsDisclaimer', 'Connection and capability test only. This does not certify ERP module compatibility.')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onRunRegisteredDiagnostics}
                disabled={!canManage || isRunningDiag}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRunningDiag ? (
                  <Spinner size="xs" variant="indigo" />
                ) : (
                  <Activity className="h-4 w-4" />
                )}
                {isRunningDiag
                  ? t('settings.customModel.diagnosticsRunning', 'Running diagnostics...')
                  : t('settings.certificationStatus.runDiagnostics', 'Run Diagnostics')}
              </button>
            </div>
            {registeredDiagnosticResult && (
              <div className="mt-4">
                <RegisteredDiagnosticsResult result={registeredDiagnosticResult} />
              </div>
            )}
          </div>

          {/* Certification */}
          <div className="rounded-md border border-gray-200 bg-white p-4">
            <div className="flex items-start gap-3 mb-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-indigo-600" />
              <div>
                <h4 className="text-sm font-medium text-gray-800">
                  {t('settings.certificationStatus.runCertification', 'Run Company Certification')}
                </h4>
                <p className="mt-1 text-xs text-gray-400">
                  {t('settings.certificationStatus.certificationDisclaimer', 'Company certification is tenant-scoped only. It does not appear as global recommended.')}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {(registeredProfileData as any)?.profileHash && (
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    {t('settings.customModel.profileHash', 'Profile Hash')}
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={String((registeredProfileData as any).profileHash)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm font-mono text-gray-500 cursor-default"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  {t('settings.customModel.category', 'Category')}
                </label>
                <select
                  value={registeredCertCategory}
                  onChange={(e) => onSetRegisteredCertCategory(e.target.value as AiCertificationCategory)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white"
                >
                  {CERT_CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>{cat.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={onRunRegisteredCertification}
                disabled={!canManage || isRunningCert || !(registeredProfileData as any)?.profileHash}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRunningCert ? (
                  <>
                    <Spinner size="xs" variant="indigo" />
                    {t('settings.customModel.certRunning', 'Running certification...')}
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    {t('settings.certificationStatus.runCertification', 'Run Company Certification')}
                  </>
                )}
              </button>
              {!(registeredProfileData as any)?.profileHash && registeredProfileId && (
                <p className="text-xs text-amber-700">
                  {t('settings.customModel.noProfileHash', 'Profile hash not available. Run diagnostics first.')}
                </p>
              )}
            </div>
            {registeredCertResult && (
              <div className="mt-4 rounded-md border border-gray-100 bg-gray-50 p-3">
                <h5 className="text-sm font-medium text-gray-700 mb-2">
                  {t('settings.customModel.certificationResult', 'Certification Result')}
                </h5>
                <div className="grid gap-2 sm:grid-cols-2 text-sm">
                  <div>
                    <span className="text-xs text-gray-500">{t('settings.customModel.category', 'Category')}</span>
                    <div className="font-medium text-gray-800">{registeredCertResult.category}</div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">{t('settings.customModel.status', 'Status')}</span>
                    <div>
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
                        registeredCertResult.status === 'CERTIFIED' ? 'border-green-200 bg-green-100 text-green-800'
                        : registeredCertResult.status === 'WARNING' ? 'border-amber-200 bg-amber-100 text-amber-800'
                        : registeredCertResult.status === 'FAILED' ? 'border-red-200 bg-red-100 text-red-800'
                        : 'border-slate-200 bg-slate-100 text-slate-700'
                      }`}>
                        {registeredCertResult.status}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">{t(`Score`)}</span>
                    <div className="font-medium text-gray-800">{registeredCertResult.score}/{registeredCertResult.maxScore}</div>
                  </div>
                  {registeredCertResult.summary && (
                    <div className="sm:col-span-2">
                      <span className="text-xs text-gray-500">{t(`Summary`)}</span>
                      <div className="text-gray-700">{registeredCertResult.summary}</div>
                    </div>
                  )}
                  {registeredCertResult.failureReasons && registeredCertResult.failureReasons.length > 0 && (
                    <div className="sm:col-span-2">
                      <span className="text-xs text-gray-500">{t(`Failure Reasons`)}</span>
                      <ul className="mt-1 list-disc list-inside text-sm text-red-700">
                        {registeredCertResult.failureReasons.map((reason, idx) => (
                          <li key={idx}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Cancel registration & Deprecate profile */}
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={onCancelRegistration}
              className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
            >
              <XCircle className="h-4 w-4" />
              {t('settings.certificationStatus.cancelRegistration', 'Cancel Registration')}
            </button>
            <button
              type="button"
              onClick={onDeprecateProfile}
              disabled={!canManage || isDeprecating}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDeprecating ? (
                <>
                  <Spinner size="xs" variant="secondary" />
                  {t('settings.customModel.deprecating', 'Deprecating...')}
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4" />
                  {t('settings.customModel.deprecate', 'Deprecate Profile')}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Scenario D: No match, no registration — show register button */}
      {!selectedCertifiedProfile && !certificationMatch && !registeredProfileId && (
        <>
          <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              {t('settings.certificationStatus.notCertified', 'This model is not certified. Sensitive ERP tools are blocked.')}
            </span>
          </div>
          <button
            type="button"
            onClick={onRegisterAndCertify}
            disabled={!canManage || isRegistering}
            className="inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRegistering ? (
              <>
                <Spinner size="xs" variant="indigo" />
                {t('settings.certificationStatus.registering', 'Registering...')}
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                {t('settings.certificationStatus.registerAndCertify', 'Register & Certify This Model')}
              </>
            )}
          </button>
        </>
      )}

      {/* Safety disclaimers */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-400">
        <div className="rounded-md border border-gray-100 bg-gray-50/50 px-3 py-2">
          <span className="font-medium text-gray-600">
            {t('settings.certifiedModels.diagnosticsLabel', 'Diagnostics')}:
          </span>{' '}
          {t('settings.certifiedModels.diagnosticsDisclaimer', 'Connection and capability test only. This does not certify ERP module compatibility.')}
        </div>
        <div className="rounded-md border border-gray-100 bg-gray-50/50 px-3 py-2">
          <span className="font-medium text-gray-600">
            {t('settings.certifiedModels.certificationLabel', 'Certification')}:
          </span>{' '}
          {t('settings.certifiedModels.certificationDisclaimer', 'ERP compatibility approval for specific categories/modules.')}
        </div>
      </div>
    </div>
  );
};

// ── Registered model diagnostics result (sub-component, used only here) ───────

const RegisteredDiagnosticsResult: React.FC<{
  result: ProviderHealthResponse;
}> = ({ result }) => {
  const { t } = useTranslation('aiAssistant');

  const checks = result.checks ?? [
    {
      id: 'network' as const,
      status: result.networkOk ? 'passed' : 'failed',
      ok: Boolean(result.networkOk),
      detail: result.reason,
    },
    {
      id: 'inference' as const,
      status: result.inferenceOk ? 'passed' : 'failed',
      ok: Boolean(result.inferenceOk),
      detail: result.error,
    },
  ];

  const toolDiagnostics = result.toolDiagnostics;
  const recommendedMode = toolDiagnostics?.recommendedMode ?? 'unavailable';
  const profile = result.modelProfile;

  return (
    <div className="space-y-4 border-t border-gray-100 pt-4">
      <div className="flex flex-wrap gap-2">
        <DiagnosticPillLocal
          status={result.ready ? 'passed' : 'failed'}
          label={result.ready
            ? t('settings.diagnosticsChatReady', 'Chat ready')
            : t('settings.diagnosticsChatNotReady', 'Chat not ready')}
        />
        <DiagnosticPillLocal
          status={toolDiagnostics?.erpToolsReady ? 'passed' : 'failed'}
          label={toolDiagnostics?.erpToolsReady
            ? t('settings.diagnosticsToolsReady', 'ERP tools ready')
            : t('settings.diagnosticsToolsLimited', 'ERP tools limited')}
        />
        <span className="inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
          {t('settings.diagnosticRecommendedMode', 'Recommended mode')}:{' '}
          {t(
            `settings.diagnosticModes.${recommendedMode}`,
            DIAGNOSTIC_MODE_FALLBACKS[recommendedMode] ?? recommendedMode
          )}
        </span>
      </div>

      {profile && (
        <div className="grid gap-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm sm:grid-cols-2">
          <DiagnosticFactLocal
            label={t('settings.diagnosticCatalogStatus', 'Catalog status')}
            value={t(`settings.modelStatuses.${profile.status}`, profile.status)}
          />
          <DiagnosticFactLocal
            label={t('settings.diagnosticNativeCatalog', 'Native in catalog')}
            value={profile.supportsToolCalling ? t('settings.yes', 'Yes') : t('settings.no', 'No')}
          />
        </div>
      )}

      <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
        {checks.map((check) => {
          const Icon = getDiagnosticStatusIcon(check.status);
          return (
            <div key={check.id} className="flex items-start gap-3 bg-white px-3 py-3">
              <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                check.status === 'passed' ? 'text-green-600' : check.status === 'failed' ? 'text-red-600' : 'text-gray-400'
              }`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-gray-800">
                    {t(`settings.diagnosticChecks.${check.id}`, DIAGNOSTIC_CHECK_FALLBACKS[check.id] ?? check.id)}
                  </span>
                  <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${getDiagnosticStatusClasses(check.status)}`}>
                    {t(`settings.diagnosticStatus.${check.status}`, check.status)}
                  </span>
                </div>
                {check.detail && (
                  <p className="mt-1 break-words text-xs text-gray-500">{check.detail}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const DiagnosticPillLocal: React.FC<{ status: string; label: string }> = ({ status, label }) => {
  const Icon = getDiagnosticStatusIcon(status);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${getDiagnosticStatusClasses(status)}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
};

const DiagnosticFactLocal: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div className="text-xs text-gray-500">{label}</div>
    <div className="mt-0.5 font-medium text-gray-800">{value}</div>
  </div>
);