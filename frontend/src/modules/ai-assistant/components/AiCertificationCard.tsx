/**
 * AiCertificationCard.tsx
 *
 * Replaces ByokCertificationSection with a clear state-machine approach.
 *
 * The certification state is one of four mutually exclusive states — each has
 * its own dedicated render block. No nested if/else chains.
 *
 * States:
 *   global_certified   — model matched a globally certified platform profile
 *   tenant_certified   — model matched a tenant-scoped cert, or user picked one from the modal
 *   profile_registered — custom profile registered but not yet certified
 *   uncertified        — no registration, no match
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Shield,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type {
  AiCertificationCategory,
  AiCertificationResult,
  CertifiedProfileEntry,
  ProviderHealthResponse,
} from '../../../api/aiAssistantApi';
import {
  DIAGNOSTIC_CHECK_FALLBACKS,
  DIAGNOSTIC_MODE_FALLBACKS,
  getDiagnosticStatusClasses,
  getDiagnosticStatusIcon,
} from '../utils/settingsHelpers';

// ── Types ──────────────────────────────────────────────────────────────────────

type CertificationState =
  | 'global_certified'
  | 'tenant_certified'
  | 'profile_registered'
  | 'uncertified';

interface AiCertificationCardProps {
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

const CERT_CATEGORIES: AiCertificationCategory[] = [
  'GENERAL_CHAT', 'ACCOUNTING', 'FINANCE_REPORTING', 'SALES',
  'PURCHASES', 'INVENTORY', 'HR', 'CRM',
  'TOOL_CALLING', 'DATA_FILTERING', 'PROPOSAL_DRAFT', 'ANALYTICS',
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function getCertifiedCategories(entry: CertifiedProfileEntry): string[] {
  const cats = entry.certifications
    ?.filter((c) => !['blocked', 'deprecated', 'expired'].includes(String(c.status).toLowerCase()))
    .map((c) => c.category) ?? [];
  return [...new Set(cats)];
}

function resolveCertState(
  selectedCertifiedProfile: CertifiedProfileEntry | null,
  certificationMatch: { entry: CertifiedProfileEntry; isGlobal: boolean } | null,
  registeredProfileId: string | null,
): CertificationState {
  if (selectedCertifiedProfile) return 'tenant_certified';
  if (certificationMatch?.isGlobal) return 'global_certified';
  if (certificationMatch) return 'tenant_certified';
  if (registeredProfileId) return 'profile_registered';
  return 'uncertified';
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const CategoryBadges: React.FC<{ categories: string[] }> = ({ categories }) => (
  <div className="flex flex-wrap gap-1 mt-2">
    {categories.map((cat) => (
      <span
        key={cat}
        className="inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700"
      >
        {cat.replace(/_/g, ' ')}
      </span>
    ))}
  </div>
);

const ScopeBadge: React.FC<{ isGlobal: boolean }> = ({ isGlobal }) => {
  const { t } = useTranslation('aiAssistant');
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
        isGlobal
          ? 'border-green-200 bg-green-100 text-green-800'
          : 'border-blue-200 bg-blue-100 text-blue-800'
      }`}
    >
      {isGlobal
        ? t('settings.certifiedModels.scopeGlobal', 'GLOBAL')
        : t('settings.certifiedModels.scopeTenant', 'COMPANY')}
    </span>
  );
};

const DiagnosticsResultView: React.FC<{ result: ProviderHealthResponse }> = ({ result }) => {
  const { t } = useTranslation('aiAssistant');

  const checks = result.checks ?? [
    { id: 'network', status: result.networkOk ? 'passed' : 'failed', ok: Boolean(result.networkOk), detail: result.reason },
    { id: 'inference', status: result.inferenceOk ? 'passed' : 'failed', ok: Boolean(result.inferenceOk), detail: result.error },
  ];

  const recommendedMode = result.toolDiagnostics?.recommendedMode ?? 'unavailable';

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        <StatusPill
          passed={result.ready}
          label={result.ready
            ? t('settings.diagnosticsChatReady', 'Chat ready')
            : t('settings.diagnosticsChatNotReady', 'Not ready')}
        />
        <StatusPill
          passed={Boolean(result.toolDiagnostics?.erpToolsReady)}
          label={result.toolDiagnostics?.erpToolsReady
            ? t('settings.diagnosticsToolsReady', 'ERP tools ready')
            : t('settings.diagnosticsToolsLimited', 'ERP tools limited')}
        />
        <span className="inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
          {t('settings.diagnosticRecommendedMode', 'Mode')}:{' '}
          {DIAGNOSTIC_MODE_FALLBACKS[recommendedMode] ?? recommendedMode}
        </span>
      </div>

      <div className="divide-y divide-gray-100 rounded-md border border-gray-200 bg-white overflow-hidden">
        {checks.map((check) => {
          const Icon = getDiagnosticStatusIcon(check.status);
          return (
            <div key={check.id} className="flex items-start gap-3 px-3 py-2.5">
              <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                check.status === 'passed' ? 'text-green-600' : check.status === 'failed' ? 'text-red-600' : 'text-gray-400'
              }`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-gray-800">
                    {DIAGNOSTIC_CHECK_FALLBACKS[check.id] ?? check.id}
                  </span>
                  <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${getDiagnosticStatusClasses(check.status)}`}>
                    {check.status}
                  </span>
                </div>
                {check.detail && (
                  <p className="mt-0.5 break-words text-xs text-gray-500">{check.detail}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CertificationResultView: React.FC<{ result: AiCertificationResult }> = ({ result }) => {
  const statusColor =
    result.status === 'CERTIFIED' ? 'border-green-200 bg-green-100 text-green-800'
    : result.status === 'WARNING' ? 'border-amber-200 bg-amber-100 text-amber-800'
    : result.status === 'FAILED' ? 'border-red-200 bg-red-100 text-red-800'
    : 'border-slate-200 bg-slate-100 text-slate-700';

  return (
    <div className="mt-3 rounded-md border border-gray-100 bg-gray-50 p-3 space-y-2">
      <div className="flex items-center gap-3">
        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${statusColor}`}>
          {result.status}
        </span>
        <span className="text-sm text-gray-600">
          {result.score}/{result.maxScore} &middot; {result.category}
        </span>
      </div>
      {result.summary && (
        <p className="text-xs text-gray-600">{result.summary}</p>
      )}
      {result.failureReasons && result.failureReasons.length > 0 && (
        <ul className="list-disc list-inside text-xs text-red-700 space-y-0.5">
          {result.failureReasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}
    </div>
  );
};

const StatusPill: React.FC<{ passed: boolean; label: string }> = ({ passed, label }) => {
  const Icon = passed ? CheckCircle2 : XCircle;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${
      passed ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700'
    }`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
};

const Spinner: React.FC = () => (
  <div className="h-4 w-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
);

// ── State views ────────────────────────────────────────────────────────────────

const GlobalCertifiedView: React.FC<{
  entry: CertifiedProfileEntry;
  onShowCertifiedModels: () => void;
}> = ({ entry, onShowCertifiedModels }) => {
  const { t } = useTranslation('aiAssistant');
  const profile = entry.profile as Record<string, unknown>;
  const categories = getCertifiedCategories(entry);

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-green-800">
                {t('settings.certificationStatus.globalCertified', 'Platform Certified')}
              </span>
              <ScopeBadge isGlobal={true} />
            </div>
            <p className="mt-0.5 text-xs text-green-700">
              {String(profile.displayName || profile.modelName || '')}
              {' · '}
              {t('settings.certificationStatus.globalCertifiedDesc', 'All sensitive ERP tools are available.')}
            </p>
            {categories.length > 0 && <CategoryBadges categories={categories} />}
          </div>
        </div>
        <button
          type="button"
          onClick={onShowCertifiedModels}
          className="flex-shrink-0 flex items-center gap-1 text-xs text-green-700 hover:text-green-900 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {t('settings.certifiedModels.browseLink', 'Change')}
        </button>
      </div>
    </div>
  );
};

const TenantCertifiedView: React.FC<{
  entry: CertifiedProfileEntry;
  onShowCertifiedModels: () => void;
}> = ({ entry, onShowCertifiedModels }) => {
  const { t } = useTranslation('aiAssistant');
  const profile = entry.profile as Record<string, unknown>;
  const categories = getCertifiedCategories(entry);

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-blue-800">
                {t('settings.certificationStatus.companyCertified', 'Company Certified')}
              </span>
              <ScopeBadge isGlobal={false} />
            </div>
            <p className="mt-0.5 text-xs text-blue-700">
              {String(profile.displayName || profile.modelName || '')}
            </p>
            {categories.length > 0 && <CategoryBadges categories={categories} />}
          </div>
        </div>
        <button
          type="button"
          onClick={onShowCertifiedModels}
          className="flex-shrink-0 flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {t('settings.certifiedModels.browseLink', 'Change')}
        </button>
      </div>
    </div>
  );
};

const ProfileRegisteredView: React.FC<{
  registeredProfileId: string;
  registeredProfileData: Record<string, unknown> | null;
  registeredDiagnosticResult: ProviderHealthResponse | null;
  registeredCertResult: AiCertificationResult | null;
  registeredCertCategory: AiCertificationCategory;
  isRunningDiag: boolean;
  isRunningCert: boolean;
  isDeprecating: boolean;
  canManage: boolean;
  onRunDiagnostics: () => void;
  onRunCertification: () => void;
  onCancelRegistration: () => void;
  onDeprecateProfile: () => void;
  onSetCertCategory: (cat: AiCertificationCategory) => void;
}> = ({
  registeredProfileId,
  registeredProfileData: data,
  registeredDiagnosticResult,
  registeredCertResult,
  registeredCertCategory,
  isRunningDiag,
  isRunningCert,
  isDeprecating,
  canManage,
  onRunDiagnostics,
  onRunCertification,
  onCancelRegistration,
  onDeprecateProfile,
  onSetCertCategory,
}) => {
  const { t } = useTranslation('aiAssistant');
  const profileHash = String(data?.profileHash ?? '');
  const shortId = registeredProfileId.length > 24
    ? `${registeredProfileId.slice(0, 24)}…`
    : registeredProfileId;

  return (
    <div className="space-y-3">
      {/* Profile info */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-amber-800">
              {t('settings.certificationStatus.registeredNotCertified', 'Profile Registered — Not Yet Certified')}
            </span>
            <p className="mt-0.5 text-xs text-amber-700">
              {t('settings.certificationStatus.registeredDesc', 'Sensitive ERP tools are blocked until certification passes.')}
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-amber-700">
              <span className="font-mono truncate" title={registeredProfileId}>{shortId}</span>
              {data?.toolMode && (
                <span>Tool mode: <span className="font-mono">{String(data.toolMode)}</span></span>
              )}
              {data?.dataFilterPolicyId && (
                <span>Data filter: <span className="font-mono">{String(data.dataFilterPolicyId)}</span></span>
              )}
            </div>
            {registeredCertResult && (
              <div className="mt-1">
                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
                  registeredCertResult.status === 'CERTIFIED' ? 'border-green-200 bg-green-100 text-green-800'
                  : registeredCertResult.status === 'WARNING' ? 'border-amber-200 bg-amber-100 text-amber-800'
                  : 'border-red-200 bg-red-100 text-red-800'
                }`}>
                  {registeredCertResult.status}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Step 1: Diagnostics */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-indigo-600" />
            <div>
              <p className="text-sm font-medium text-gray-800">
                {t('settings.certificationStatus.step1Diag', 'Step 1 — Run Diagnostics')}
              </p>
              <p className="text-xs text-gray-500">
                {t('settings.certificationStatus.diagnosticsNote', 'Tests connection and model capabilities. Does not certify ERP tools.')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRunDiagnostics}
            disabled={!canManage || isRunningDiag}
            className="flex-shrink-0 inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isRunningDiag ? <Spinner /> : <Activity className="h-3.5 w-3.5" />}
            {isRunningDiag
              ? t('settings.customModel.diagnosticsRunning', 'Testing…')
              : t('settings.certificationStatus.runDiagnostics', 'Run Diagnostics')}
          </button>
        </div>
        {registeredDiagnosticResult && (
          <DiagnosticsResultView result={registeredDiagnosticResult} />
        )}
      </div>

      {/* Step 2: Certification */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-start gap-2 mb-3">
          <ShieldCheck className="h-4 w-4 text-indigo-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-gray-800">
              {t('settings.certificationStatus.step2Cert', 'Step 2 — Run Certification')}
            </p>
            <p className="text-xs text-gray-500">
              {t('settings.certificationStatus.certNote', 'Company-scoped certification. Unlocks ERP tool access for the selected category.')}
            </p>
          </div>
        </div>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {t('settings.customModel.category', 'Category')}
            </label>
            <select
              value={registeredCertCategory}
              onChange={(e) => onSetCertCategory(e.target.value as AiCertificationCategory)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {CERT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={onRunCertification}
            disabled={!canManage || isRunningCert || !profileHash}
            className="flex-shrink-0 inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isRunningCert ? <Spinner /> : <ShieldCheck className="h-3.5 w-3.5" />}
            {isRunningCert
              ? t('settings.customModel.certRunning', 'Certifying…')
              : t('settings.certificationStatus.runCertification', 'Certify')}
          </button>
        </div>
        {!profileHash && (
          <p className="mt-1.5 text-xs text-amber-700 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {t('settings.customModel.noProfileHash', 'Run diagnostics first to enable certification.')}
          </p>
        )}
        {registeredCertResult && (
          <CertificationResultView result={registeredCertResult} />
        )}
      </div>

      {/* Danger actions */}
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={onCancelRegistration}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <XCircle className="h-3.5 w-3.5" />
          {t('settings.certificationStatus.cancelRegistration', 'Cancel Registration')}
        </button>
        <button
          type="button"
          onClick={onDeprecateProfile}
          disabled={!canManage || isDeprecating}
          className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isDeprecating ? <Spinner /> : <Shield className="h-3.5 w-3.5" />}
          {isDeprecating
            ? t('settings.customModel.deprecating', 'Removing…')
            : t('settings.customModel.deprecate', 'Deprecate Profile')}
        </button>
      </div>
    </div>
  );
};

const UncertifiedView: React.FC<{
  isRegistering: boolean;
  canManage: boolean;
  onShowCertifiedModels: () => void;
  onRegisterAndCertify: () => void;
}> = ({ isRegistering, canManage, onShowCertifiedModels, onRegisterAndCertify }) => {
  const { t } = useTranslation('aiAssistant');

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {t('settings.certificationStatus.notCertifiedTitle', 'Model Not Certified')}
            </p>
            <p className="mt-0.5 text-xs text-amber-700">
              {t('settings.certificationStatus.notCertified', 'Sensitive ERP tools (accounting, sales, inventory…) are blocked until this model is certified.')}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onShowCertifiedModels}
          className="inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          {t('settings.certifiedModels.openModal', 'Browse Certified Models')}
        </button>
        <button
          type="button"
          onClick={onRegisterAndCertify}
          disabled={!canManage || isRegistering}
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isRegistering ? <Spinner /> : <ShieldCheck className="h-4 w-4" />}
          {isRegistering
            ? t('settings.certificationStatus.registering', 'Registering…')
            : t('settings.certificationStatus.registerAndCertify', 'Register & Certify This Model')}
        </button>
      </div>

      <div className="flex items-start gap-1.5 text-xs text-gray-400">
        <Shield className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <span>
          {t('settings.certifiedModels.certificationDisclaimer', 'Registration creates a company-scoped profile with safe default policies (data filter, tool mode) then runs certification tests.')}
        </span>
      </div>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────

export const AiCertificationCard: React.FC<AiCertificationCardProps> = (props) => {
  const { t } = useTranslation('aiAssistant');

  const {
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
  } = props;

  const certState = resolveCertState(selectedCertifiedProfile, certificationMatch, registeredProfileId);

  const certEntry =
    certState === 'tenant_certified' && selectedCertifiedProfile
      ? selectedCertifiedProfile
      : certificationMatch?.entry ?? null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="h-4 w-4 text-gray-500" />
        <h3 className="text-sm font-semibold text-gray-800">
          {t('settings.certificationStatus.title', 'Certification')}
        </h3>
        <span className="text-xs text-gray-400">
          <ChevronRight className="h-3.5 w-3.5 inline" />
          {certState === 'global_certified' && t('settings.certificationStatus.stateGlobal', 'Platform certified')}
          {certState === 'tenant_certified' && t('settings.certificationStatus.stateTenant', 'Company certified')}
          {certState === 'profile_registered' && t('settings.certificationStatus.stateRegistered', 'Pending certification')}
          {certState === 'uncertified' && t('settings.certificationStatus.stateUncertified', 'Not certified')}
        </span>
      </div>

      {certState === 'global_certified' && certEntry && (
        <GlobalCertifiedView entry={certEntry} onShowCertifiedModels={onShowCertifiedModels} />
      )}

      {certState === 'tenant_certified' && certEntry && (
        <TenantCertifiedView entry={certEntry} onShowCertifiedModels={onShowCertifiedModels} />
      )}

      {certState === 'profile_registered' && registeredProfileId && (
        <ProfileRegisteredView
          registeredProfileId={registeredProfileId}
          registeredProfileData={registeredProfileData}
          registeredDiagnosticResult={registeredDiagnosticResult}
          registeredCertResult={registeredCertResult}
          registeredCertCategory={registeredCertCategory}
          isRunningDiag={isRunningDiag}
          isRunningCert={isRunningCert}
          isDeprecating={isDeprecating}
          canManage={canManage}
          onRunDiagnostics={onRunRegisteredDiagnostics}
          onRunCertification={onRunRegisteredCertification}
          onCancelRegistration={onCancelRegistration}
          onDeprecateProfile={onDeprecateProfile}
          onSetCertCategory={onSetRegisteredCertCategory}
        />
      )}

      {certState === 'uncertified' && (
        <UncertifiedView
          isRegistering={isRegistering}
          canManage={canManage}
          onShowCertifiedModels={onShowCertifiedModels}
          onRegisterAndCertify={onRegisterAndCertify}
        />
      )}
    </div>
  );
};
