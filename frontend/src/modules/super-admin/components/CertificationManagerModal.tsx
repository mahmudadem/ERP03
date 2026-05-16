/**
 * CertificationManagerModal.tsx
 *
 * Tabbed modal for managing AI model profile certifications.
 * Tabs: Overview | Run Certification | Manual Entry | History
 *
 * Replaced the previous design which used nested sub-modals.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { clsx } from 'clsx';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Info,
  Plus,
  RefreshCw,
  Shield,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  AiCertificationCategory,
  AiCertificationResult,
  AiCertificationStatus,
  AiModelProfile,
  ManualCertificationPayload,
  superAdminApi,
} from '../../../api/superAdmin';
import { errorHandler } from '../../../services/errorHandler';
import { SuperAdminBadge, SuperAdminModal } from './SuperAdminPage';

// ── Constants ──────────────────────────────────────────────────────────────────

const CERTIFICATION_CATEGORIES: AiCertificationCategory[] = [
  'GENERAL_CHAT', 'ACCOUNTING', 'FINANCE_REPORTING', 'SALES',
  'PURCHASES', 'INVENTORY', 'HR', 'CRM',
  'TOOL_CALLING', 'DATA_FILTERING', 'PROPOSAL_DRAFT', 'ANALYTICS',
];

// ── Helpers ────────────────────────────────────────────────────────────────────

const statusTone = (status: AiCertificationStatus): 'green' | 'amber' | 'red' | 'slate' => {
  switch (status) {
    case 'CERTIFIED': return 'green';
    case 'WARNING': return 'amber';
    case 'FAILED': return 'red';
    default: return 'slate';
  }
};

// ── Types ──────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'run' | 'manual' | 'history';

interface CertificationManagerModalProps {
  profile: AiModelProfile;
  isOpen: boolean;
  onClose: () => void;
  onCertChange: () => void;
}

// ── Tab components ─────────────────────────────────────────────────────────────

const OverviewTab: React.FC<{
  profile: AiModelProfile;
  certifications: AiCertificationResult[];
  onGoToRun: () => void;
  onGoToManual: () => void;
}> = ({ profile, certifications, onGoToRun, onGoToManual }) => {
  const { t } = useTranslation('common');

  const activeCerts = certifications.filter((c) => c.status !== 'EXPIRED');
  const certifiedCategories = [...new Set(
    activeCerts.filter((c) => c.status === 'CERTIFIED').map((c) => c.category)
  )];
  const highestStatus: AiCertificationStatus | null = (() => {
    if (activeCerts.length === 0) return null;
    if (activeCerts.some((c) => c.status === 'CERTIFIED')) return 'CERTIFIED';
    if (activeCerts.some((c) => c.status === 'WARNING')) return 'WARNING';
    return activeCerts[0].status;
  })();

  return (
    <div className="space-y-5">
      {/* What is certification */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-700">
            {t('superAdmin.aiModels.certifications.whatIsCertificationDesc',
              'Certification validates that a model profile is safe to use with specific ERP modules. Without certification, the AI runtime blocks tool access for that module.'
            )}
          </p>
        </div>
      </div>

      {/* Current status */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-800">
              {t('superAdmin.aiModels.certifications.currentStatus', 'Certification Status')}
            </span>
          </div>
          {highestStatus ? (
            <SuperAdminBadge tone={statusTone(highestStatus)}>{highestStatus}</SuperAdminBadge>
          ) : (
            <SuperAdminBadge tone="slate">
              {t('superAdmin.aiModels.certifications.noCerts', 'None')}
            </SuperAdminBadge>
          )}
        </div>

        {certifiedCategories.length > 0 ? (
          <div>
            <p className="text-xs text-slate-500 mb-2">
              {t('superAdmin.aiModels.certifications.certifiedFor', 'Certified for:')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {certifiedCategories.map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  {cat.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              {t('superAdmin.aiModels.certifications.noActiveCerts',
                'No active certifications. ERP tool access is blocked for this model profile.'
              )}
            </p>
          </div>
        )}

        {/* Profile hash */}
        {profile.profileHash && (
          <div>
            <p className="text-xs text-slate-400 mb-1">
              {t('superAdmin.aiModels.certifications.form.profileHash', 'Profile Hash')}
            </p>
            <code className="block w-full rounded bg-slate-50 border border-slate-200 px-2 py-1 text-xs font-mono text-slate-600 break-all">
              {profile.profileHash}
            </code>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={onGoToRun}
          className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          {t('superAdmin.aiModels.certifications.runShell', 'Run Certification')}
        </button>
        <button
          onClick={onGoToManual}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t('superAdmin.aiModels.certifications.recordManual', 'Record Manual')}
        </button>
      </div>
    </div>
  );
};

const RunCertTab: React.FC<{
  profile: AiModelProfile;
  onCertChange: () => void;
  onDone: () => void;
}> = ({ profile, onCertChange, onDone }) => {
  const { t } = useTranslation('common');
  const [category, setCategory] = useState<AiCertificationCategory>('ACCOUNTING');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AiCertificationResult | null>(null);

  const handleRun = async () => {
    if (!profile?.id) return;
    try {
      setRunning(true);
      setResult(null);
      const profileHash = profile.profileHash || '';
      const res = await superAdminApi.runGlobalCertification(profile.id, { profileHash, category });
      setResult(res as AiCertificationResult);
      errorHandler.showSuccess(t('superAdmin.aiModels.certifications.messages.shellRan'));
      onCertChange();
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setRunning(false);
    }
  };

  const statusColor = result
    ? result.status === 'CERTIFIED' ? 'border-green-200 bg-green-50 text-green-800'
      : result.status === 'WARNING' ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-red-200 bg-red-50 text-red-700'
    : '';

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        {t('superAdmin.aiModels.certifications.shellCertDesc',
          'Shell certification checks structural requirements (tool mode, data filter policy, safety policy). It does NOT run live AI tests.'
        )}
      </div>

      {/* Profile hash */}
      <div>
        <p className="text-xs font-medium text-slate-600 mb-1">
          {t('superAdmin.aiModels.certifications.form.profileHash', 'Profile Hash')}
        </p>
        <code className="block w-full rounded bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-mono text-slate-600">
          {profile?.profileHash || '—'}
        </code>
        {!profile?.profileHash && (
          <p className="mt-1 text-xs text-amber-700 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {t('superAdmin.aiModels.certifications.noProfileHash', 'Profile hash not available. Save the profile first.')}
          </p>
        )}
      </div>

      {/* Category + Run */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          {t('superAdmin.aiModels.certifications.form.category', 'Category')}
        </label>
        <div className="flex items-end gap-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as AiCertificationCategory)}
            className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {CERTIFICATION_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {t(`superAdmin.aiModels.certifications.categories.${cat}`, cat.replace(/_/g, ' '))}
              </option>
            ))}
          </select>
          <button
            onClick={handleRun}
            disabled={running || !profile?.profileHash}
            className="flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={clsx('h-4 w-4', running && 'animate-spin')} />
            {running
              ? t('superAdmin.aiModels.certifications.running', 'Running…')
              : t('superAdmin.aiModels.certifications.runShell', 'Run')
            }
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className={`rounded-lg border p-4 space-y-2 ${statusColor}`}>
          <div className="flex items-center gap-2">
            {result.status === 'CERTIFIED'
              ? <CheckCircle2 className="h-4 w-4" />
              : result.status === 'FAILED'
              ? <XCircle className="h-4 w-4" />
              : <AlertTriangle className="h-4 w-4" />
            }
            <span className="text-sm font-semibold">{result.status}</span>
            <span className="text-sm">{result.score}/{result.maxScore} · {result.category}</span>
          </div>
          {result.summary && <p className="text-xs">{result.summary}</p>}
          {result.failureReasons && result.failureReasons.length > 0 && (
            <ul className="list-disc list-inside text-xs space-y-0.5">
              {result.failureReasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={onDone}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {t('superAdmin.aiModels.certifications.done', 'Done')}
        </button>
      </div>
    </div>
  );
};

const ManualEntryTab: React.FC<{
  profile: AiModelProfile;
  onCertChange: () => void;
  onDone: () => void;
}> = ({ profile, onCertChange, onDone }) => {
  const { t } = useTranslation('common');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<ManualCertificationPayload>>({
    profileHash: profile?.profileHash || '',
    maxScore: 100,
    status: 'CERTIFIED',
    toolContractVersion: '1.0.0',
    dataFilterPolicyVersion: '1.0.0',
    testSuiteVersion: '',
    summary: '',
  });

  const isValid = Boolean(form.category && form.testSuiteVersion && form.summary && form.score != null);

  const handleSave = async () => {
    if (!profile?.id || !isValid) return;
    try {
      setSaving(true);
      await superAdminApi.recordGlobalCertification(profile.id, {
        profileHash: profile.profileHash || '',
        category: form.category!,
        moduleId: form.moduleId || undefined,
        skillId: form.skillId || undefined,
        score: form.score!,
        maxScore: form.maxScore!,
        status: form.status!,
        testSuiteVersion: form.testSuiteVersion!,
        toolContractVersion: form.toolContractVersion!,
        dataFilterPolicyVersion: form.dataFilterPolicyVersion!,
        summary: form.summary!,
      });
      errorHandler.showSuccess(t('superAdmin.aiModels.certifications.messages.recorded'));
      onCertChange();
      onDone();
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700">
            {t('superAdmin.aiModels.certifications.manualCertInfo',
              'Record a result from an external AI test suite. This does NOT run automated tests — it registers a result you have verified manually.'
            )}
          </p>
        </div>
      </div>

      {/* Profile hash (readonly) */}
      <div>
        <p className="text-xs font-medium text-slate-600 mb-1">Profile Hash</p>
        <code className="block w-full rounded bg-slate-50 border border-slate-200 px-2 py-1 text-xs font-mono text-slate-600 break-all">
          {profile?.profileHash || '—'}
        </code>
      </div>

      {/* Category */}
      <label className="block text-sm">
        <span className="block text-xs font-medium text-slate-600 mb-1">
          {t('superAdmin.aiModels.certifications.form.category', 'Category')} *
        </span>
        <select
          value={form.category || ''}
          onChange={(e) => setForm({ ...form, category: e.target.value as AiCertificationCategory })}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">— Select —</option>
          {CERTIFICATION_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {t(`superAdmin.aiModels.certifications.categories.${cat}`, cat.replace(/_/g, ' '))}
            </option>
          ))}
        </select>
      </label>

      {/* Status */}
      <label className="block text-sm">
        <span className="block text-xs font-medium text-slate-600 mb-1">
          {t('superAdmin.aiModels.certifications.form.status', 'Status')} *
        </span>
        <select
          value={form.status || 'CERTIFIED'}
          onChange={(e) => setForm({ ...form, status: e.target.value as AiCertificationStatus })}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {(['CERTIFIED', 'WARNING', 'FAILED'] as AiCertificationStatus[]).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>

      {/* Score */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="block text-xs font-medium text-slate-600 mb-1">
            {t('superAdmin.aiModels.certifications.form.score', 'Score')} *
          </span>
          <input
            type="number"
            value={form.score ?? ''}
            onChange={(e) => setForm({ ...form, score: Number(e.target.value) || 0 })}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="block text-xs font-medium text-slate-600 mb-1">
            {t('superAdmin.aiModels.certifications.form.maxScore', 'Max Score')} *
          </span>
          <input
            type="number"
            value={form.maxScore ?? 100}
            onChange={(e) => setForm({ ...form, maxScore: Number(e.target.value) || 100 })}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      {/* Versions */}
      <label className="block text-sm">
        <span className="block text-xs font-medium text-slate-600 mb-1">
          {t('superAdmin.aiModels.certifications.form.testSuiteVersion', 'Test Suite Version')} *
        </span>
        <input
          type="text"
          value={form.testSuiteVersion || ''}
          onChange={(e) => setForm({ ...form, testSuiteVersion: e.target.value })}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="block text-xs font-medium text-slate-600 mb-1">
            {t('superAdmin.aiModels.certifications.form.toolContractVersion', 'Tool Contract Ver.')}
          </span>
          <input
            type="text"
            value={form.toolContractVersion || '1.0.0'}
            onChange={(e) => setForm({ ...form, toolContractVersion: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="block text-xs font-medium text-slate-600 mb-1">
            {t('superAdmin.aiModels.certifications.form.dataFilterPolicyVersion', 'Data Filter Ver.')}
          </span>
          <input
            type="text"
            value={form.dataFilterPolicyVersion || '1.0.0'}
            onChange={(e) => setForm({ ...form, dataFilterPolicyVersion: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      {/* Summary */}
      <label className="block text-sm">
        <span className="block text-xs font-medium text-slate-600 mb-1">
          {t('superAdmin.aiModels.certifications.form.summary', 'Summary')} *
        </span>
        <textarea
          value={form.summary || ''}
          onChange={(e) => setForm({ ...form, summary: e.target.value })}
          rows={3}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onDone}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {t('superAdmin.aiModels.actions.cancel', 'Cancel')}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !isValid}
          className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors"
        >
          {saving ? '…' : t('superAdmin.aiModels.certifications.recordManual', 'Record')}
        </button>
      </div>
    </div>
  );
};

const HistoryTab: React.FC<{
  certifications: AiCertificationResult[];
  onExpire: (id: string) => void;
}> = ({ certifications, onExpire }) => {
  const { t } = useTranslation('common');

  if (certifications.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
        <Shield className="h-10 w-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500">
          {t('superAdmin.aiModels.certifications.empty', 'No certifications recorded')}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-3 py-2 font-medium">{t('superAdmin.aiModels.certifications.columns.category')}</th>
            <th className="px-3 py-2 font-medium">{t('superAdmin.aiModels.certifications.columns.status')}</th>
            <th className="px-3 py-2 font-medium">{t('superAdmin.aiModels.certifications.columns.score')}</th>
            <th className="px-3 py-2 font-medium">{t('superAdmin.aiModels.certifications.columns.testedBy')}</th>
            <th className="px-3 py-2 font-medium">{t('superAdmin.aiModels.certifications.columns.testedAt')}</th>
            <th className="px-3 py-2 font-medium">{t('superAdmin.aiModels.certifications.columns.summary')}</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {certifications.map((cert) => (
            <tr key={cert.id} className={`bg-white ${cert.status === 'EXPIRED' ? 'opacity-50' : 'hover:bg-slate-50'}`}>
              <td className="px-3 py-2">
                <span className="inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                  {cert.category.replace(/_/g, ' ')}
                </span>
              </td>
              <td className="px-3 py-2">
                <SuperAdminBadge tone={statusTone(cert.status)}>{cert.status}</SuperAdminBadge>
              </td>
              <td className="px-3 py-2 font-mono text-xs">{cert.score}/{cert.maxScore}</td>
              <td className="px-3 py-2 text-xs text-slate-600">{cert.testedBy}</td>
              <td className="px-3 py-2 text-xs text-slate-600">
                {new Date(cert.testedAt).toLocaleDateString()}
              </td>
              <td className="px-3 py-2 max-w-[160px] truncate text-xs text-slate-500" title={cert.summary}>
                {cert.summary || '—'}
              </td>
              <td className="px-3 py-2">
                {cert.status !== 'EXPIRED' ? (
                  <button
                    onClick={() => onExpire(cert.id)}
                    className="text-xs font-medium text-red-600 hover:text-red-800"
                  >
                    {t('superAdmin.aiModels.certifications.expire', 'Expire')}
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">
                    {t('superAdmin.aiModels.certifications.expired', 'Expired')}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ── Main modal ─────────────────────────────────────────────────────────────────

export const CertificationManagerModal: React.FC<CertificationManagerModalProps> = ({
  profile,
  isOpen,
  onClose,
  onCertChange,
}) => {
  const { t } = useTranslation('common');
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [certifications, setCertifications] = useState<AiCertificationResult[]>([]);

  useEffect(() => {
    if (isOpen && profile?.id) {
      loadCertifications();
      setActiveTab('overview');
    }
  }, [isOpen, profile?.id]);

  const loadCertifications = async () => {
    if (!profile?.id) return;
    try {
      const result = await superAdminApi.getAiModelProfileCertifications(profile.id);
      setCertifications(result as AiCertificationResult[]);
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  const handleExpire = async (certId: string) => {
    if (!window.confirm(t('superAdmin.aiModels.certifications.confirmExpire'))) return;
    try {
      await superAdminApi.expireCertification(certId);
      errorHandler.showSuccess(t('superAdmin.aiModels.certifications.messages.expired'));
      await loadCertifications();
      onCertChange();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  const handleCertChange = async () => {
    await loadCertifications();
    onCertChange();
  };

  const profileLabel = profile
    ? `${profile.modelId || profile.modelName} · ${profile.providerId || profile.provider}`
    : '';

  const activeCertCount = certifications.filter((c) => c.status !== 'EXPIRED').length;

  if (!isOpen) return null;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: t('superAdmin.aiModels.certifications.tabs.overview', 'Overview'), icon: <ShieldCheck className="h-3.5 w-3.5" /> },
    { id: 'run', label: t('superAdmin.aiModels.certifications.tabs.run', 'Run Cert'), icon: <RefreshCw className="h-3.5 w-3.5" /> },
    { id: 'manual', label: t('superAdmin.aiModels.certifications.tabs.manual', 'Manual Entry'), icon: <Plus className="h-3.5 w-3.5" /> },
    { id: 'history', label: `${t('superAdmin.aiModels.certifications.tabs.history', 'History')}${activeCertCount > 0 ? ` (${activeCertCount})` : ''}`, icon: <ClipboardList className="h-3.5 w-3.5" /> },
  ];

  return (
    <SuperAdminModal
      title={t('superAdmin.aiModels.certifications.modalTitle', 'Certification Manager')}
      subtitle={profileLabel}
      onClose={onClose}
      size="xl"
      footer={
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {t('superAdmin.aiModels.certifications.close', 'Close')}
          </button>
        </div>
      }
    >
      {/* Tabs */}
      <div className="border-b border-slate-200 mb-5">
        <nav className="-mb-px flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <OverviewTab
          profile={profile}
          certifications={certifications}
          onGoToRun={() => setActiveTab('run')}
          onGoToManual={() => setActiveTab('manual')}
        />
      )}
      {activeTab === 'run' && (
        <RunCertTab
          profile={profile}
          onCertChange={handleCertChange}
          onDone={() => setActiveTab('overview')}
        />
      )}
      {activeTab === 'manual' && (
        <ManualEntryTab
          profile={profile}
          onCertChange={handleCertChange}
          onDone={() => setActiveTab('overview')}
        />
      )}
      {activeTab === 'history' && (
        <HistoryTab certifications={certifications} onExpire={handleExpire} />
      )}
    </SuperAdminModal>
  );
};
