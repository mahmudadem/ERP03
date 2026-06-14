/**
 * DiagnosticsPanel.tsx
 *
 * Model diagnostics run button and results display.
 * Includes ModelDiagnosticsResult, DiagnosticPill, DiagnosticFact, and DiagnosticCheckRow helpers.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Activity, CheckCircle2, XCircle, CircleMinus } from 'lucide-react';
import { Spinner } from '../../../components/ui/Spinner';
import type { ProviderHealthResponse } from '../../../api/aiAssistantApi';
import {
  DIAGNOSTIC_CHECK_FALLBACKS,
  DIAGNOSTIC_MODE_FALLBACKS,
  getDiagnosticStatusClasses,
  getDiagnosticStatusIcon,
} from '../utils/settingsHelpers';

// ── Main Component ──────────────────────────────────────────────────────────────

interface DiagnosticsPanelProps {
  onRunDiagnostics: () => void;
  healthTesting: boolean;
  healthResult: ProviderHealthResponse | null;
  healthError: string | null;
  hasUnsavedChanges: boolean;
  runtimeMode: string;
  canManage: boolean;
}

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({
  onRunDiagnostics,
  healthTesting,
  healthResult,
  healthError,
  hasUnsavedChanges,
  runtimeMode,
  canManage,
}) => {
  const { t } = useTranslation('aiAssistant');

  return (
    <div className="mb-6 rounded-md border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Activity className="mt-0.5 h-5 w-5 flex-shrink-0 text-indigo-600" />
          <div>
            <h3 className="text-sm font-medium text-gray-800">
              {t('settings.diagnosticsTitle', 'Model diagnostics')}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {t('settings.diagnosticsDesc', 'Tests the saved provider with safe prompts. No ERP data is sent.')}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {t('settings.diagnosticsTokenNote', 'This sends a few provider requests and may consume tokens.')}
            </p>
            {runtimeMode === 'CREDITS' && (
              <p className="mt-1 text-xs text-blue-600">
                {t('settings.diagnosticsCreditsNote', 'Tests the selected model using platform credits.')}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onRunDiagnostics}
          disabled={!canManage || healthTesting || hasUnsavedChanges}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {healthTesting ? (
            <Spinner size="xs" variant="indigo" />
          ) : (
            <Activity className="h-4 w-4" />
          )}
          {healthTesting
            ? t('settings.diagnosticsRunning', 'Testing...')
            : t('settings.runDiagnostics', 'Run diagnostics')}
        </button>
      </div>

      {hasUnsavedChanges && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {t('settings.saveBeforeDiagnostics', 'Save settings before testing this provider and model.')}
        </div>
      )}

      {healthError && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {healthError}
        </div>
      )}

      {healthResult && !hasUnsavedChanges && (
        <ModelDiagnosticsResult result={healthResult} t={t} />
      )}
    </div>
  );
};

// ── Helper Components ────────────────────────────────────────────────────────────

const ModelDiagnosticsResult: React.FC<{
  result: ProviderHealthResponse;
  t: TFunction;
}> = ({ result, t }) => {
  const checks = result.checks ?? [
    {
      id: 'network',
      status: result.networkOk ? 'passed' : 'failed',
      ok: Boolean(result.networkOk),
      detail: result.reason,
    },
    {
      id: 'inference',
      status: result.inferenceOk ? 'passed' : 'failed',
      ok: Boolean(result.inferenceOk),
      detail: result.error,
    },
  ];

  const toolDiagnostics = result.toolDiagnostics;
  const recommendedMode = toolDiagnostics?.recommendedMode ?? 'unavailable';
  const profile = result.modelProfile;

  return (
    <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
      <div className="flex flex-wrap gap-2">
        <DiagnosticPill
          status={result.ready ? 'passed' : 'failed'}
          label={result.ready
            ? t('settings.diagnosticsChatReady', 'Chat ready')
            : t('settings.diagnosticsChatNotReady', 'Chat not ready')}
        />
        <DiagnosticPill
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
          <DiagnosticFact
            label={t('settings.diagnosticCatalogStatus', 'Catalog status')}
            value={t(`settings.modelStatuses.${profile.status}`, profile.status)}
          />
          <DiagnosticFact
            label={t('settings.diagnosticNativeCatalog', 'Native in catalog')}
            value={profile.supportsToolCalling ? t('settings.yes', 'Yes') : t('settings.no', 'No')}
          />
          <DiagnosticFact
            label={t('settings.diagnosticStructuredJson', 'Structured JSON')}
            value={profile.supportsStructuredJson ? t('settings.yes', 'Yes') : t('settings.no', 'No')}
          />
          <DiagnosticFact
            label={t('settings.diagnosticTextOnly', 'Catalog text-only mode')}
            value={profile.textOnlyMode ? t('settings.yes', 'Yes') : t('settings.no', 'No')}
          />
          {profile.warningMessage && (
            <div className="text-xs text-amber-700 sm:col-span-2">
              {profile.warningMessage}
            </div>
          )}
        </div>
      )}

      <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
        {checks.map((check) => (
          <DiagnosticCheckRow
            key={check.id}
            label={t(
              `settings.diagnosticChecks.${check.id}`,
              DIAGNOSTIC_CHECK_FALLBACKS[check.id] ?? check.id
            )}
            status={check.status}
            detail={check.detail}
            t={t}
          />
        ))}
      </div>
    </div>
  );
};

const DiagnosticPill: React.FC<{ status: string; label: string }> = ({ status, label }) => {
  const Icon = getDiagnosticStatusIcon(status);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${getDiagnosticStatusClasses(status)}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
};

const DiagnosticFact: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div className="text-xs text-gray-500">{label}</div>
    <div className="mt-0.5 font-medium text-gray-800">{value}</div>
  </div>
);

const DiagnosticCheckRow: React.FC<{
  label: string;
  status: string;
  detail?: string;
  t: TFunction;
}> = ({ label, status, detail, t }) => {
  const Icon = getDiagnosticStatusIcon(status);
  return (
    <div className="flex items-start gap-3 bg-white px-3 py-3">
      <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
        status === 'passed' ? 'text-green-600' : status === 'failed' ? 'text-red-600' : 'text-gray-400'
      }`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-800">{label}</span>
          <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${getDiagnosticStatusClasses(status)}`}>
            {t(`settings.diagnosticStatus.${status}`, status)}
          </span>
        </div>
        {detail && (
          <p className="mt-1 break-words text-xs text-gray-500">{detail}</p>
        )}
      </div>
    </div>
  );
};