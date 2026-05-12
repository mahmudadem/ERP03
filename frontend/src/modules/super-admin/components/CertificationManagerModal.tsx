/**
 * CertificationManagerModal.tsx
 *
 * Dedicated modal for managing AI model profile certifications.
 * Separated from the profile edit modal for clarity and focus.
 * Diagnostics has its own dedicated modal (SuperAdminDiagnosticsModal).
 */

import React, { useEffect, useState, useMemo } from 'react';
import { clsx } from 'clsx';
import {
  AlertTriangle,
  CheckCircle2,
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
import {
  SuperAdminBadge,
  SuperAdminModal,
} from './SuperAdminPage';

const CERTIFICATION_CATEGORIES: AiCertificationCategory[] = [
  'GENERAL_CHAT', 'ACCOUNTING', 'FINANCE_REPORTING', 'SALES',
  'PURCHASES', 'INVENTORY', 'HR', 'CRM',
  'TOOL_CALLING', 'DATA_FILTERING', 'PROPOSAL_DRAFT', 'ANALYTICS',
];

const certificationStatusTone = (status: AiCertificationStatus): 'green' | 'amber' | 'red' | 'slate' => {
  switch (status) {
    case 'CERTIFIED': return 'green';
    case 'WARNING': return 'amber';
    case 'FAILED': return 'red';
    case 'EXPIRED': return 'slate';
    default: return 'slate';
  }
};

const diagnosticTone = (status: string): 'green' | 'red' | 'slate' => {
  switch (status) {
    case 'passed': return 'green';
    case 'failed': return 'red';
    default: return 'slate';
  }
};

interface CertificationManagerModalProps {
  profile: AiModelProfile;
  isOpen: boolean;
  onClose: () => void;
  onCertChange: () => void;
}

export const CertificationManagerModal: React.FC<CertificationManagerModalProps> = ({
  profile,
  isOpen,
  onClose,
  onCertChange,
}) => {
  const { t } = useTranslation('common');

  // ── Certification state ──
  const [certifications, setCertifications] = useState<AiCertificationResult[]>([]);
  const [shellCertCategory, setShellCertCategory] = useState<AiCertificationCategory>('ACCOUNTING');
  const [certSaving, setCertSaving] = useState(false);

  // ── Manual cert sub-modal state ──
  const [showManualCertModal, setShowManualCertModal] = useState(false);
  const [manualCertForm, setManualCertForm] = useState<Partial<ManualCertificationPayload>>({
    maxScore: 100,
    status: 'CERTIFIED',
    toolContractVersion: '1.0.0',
    dataFilterPolicyVersion: '1.0.0',
    testSuiteVersion: '',
    summary: '',
  });

  // ── Initialize ──
  useEffect(() => {
    if (isOpen && profile?.id) {
      loadCertifications();
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

  // ── Handlers ──

  const handleRunShellCert = async () => {
    if (!profile?.id) return;
    try {
      setCertSaving(true);
      const profileHash = profile.profileHash || '';
      await superAdminApi.runGlobalCertification(profile.id, {
        profileHash,
        category: shellCertCategory,
      });
      errorHandler.showSuccess(t('superAdmin.aiModels.certifications.messages.shellRan'));
      await loadCertifications();
      onCertChange();
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setCertSaving(false);
    }
  };

  const handleExpireCertification = async (certificationId: string) => {
    if (!window.confirm(t('superAdmin.aiModels.certifications.confirmExpire'))) return;
    try {
      await superAdminApi.expireCertification(certificationId);
      errorHandler.showSuccess(t('superAdmin.aiModels.certifications.messages.expired'));
      await loadCertifications();
      onCertChange();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  const handleRecordManualCert = async () => {
    if (!profile?.id) return;
    try {
      setCertSaving(true);
      const profileHash = profile.profileHash || '';
      await superAdminApi.recordGlobalCertification(profile.id, {
        profileHash,
        category: manualCertForm.category!,
        moduleId: manualCertForm.moduleId || undefined,
        skillId: manualCertForm.skillId || undefined,
        score: manualCertForm.score!,
        maxScore: manualCertForm.maxScore!,
        status: manualCertForm.status!,
        testSuiteVersion: manualCertForm.testSuiteVersion!,
        toolContractVersion: manualCertForm.toolContractVersion!,
        dataFilterPolicyVersion: manualCertForm.dataFilterPolicyVersion!,
        summary: manualCertForm.summary!,
      });
      errorHandler.showSuccess(t('superAdmin.aiModels.certifications.messages.recorded'));
      setShowManualCertModal(false);
      await loadCertifications();
      onCertChange();
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setCertSaving(false);
    }
  };

  // ── Computed ──
  const highestStatus = useMemo(() => {
    if (certifications.length === 0) return null;
    const active = certifications.filter(c => c.status !== 'EXPIRED');
    if (active.length === 0) return 'EXPIRED' as AiCertificationStatus;
    if (active.some(c => c.status === 'CERTIFIED')) return 'CERTIFIED' as AiCertificationStatus;
    if (active.some(c => c.status === 'WARNING')) return 'WARNING' as AiCertificationStatus;
    return active[0].status as AiCertificationStatus;
  }, [certifications]);

  const profileLabel = profile
    ? `${profile.modelId || profile.modelName} · ${profile.providerId || profile.provider}`
    : '';

  // ── Render ──
  if (!isOpen) return null;

  return (
    <>
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
        <div className="space-y-6">
          {/* ── What is Certification? ── */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-blue-800">
                  {t('superAdmin.aiModels.certifications.whatIsCertification', 'What is certification?')}
                </h3>
                <p className="mt-1 text-sm text-blue-700">
                  {t('superAdmin.aiModels.certifications.whatIsCertificationDesc', 'Certification validates that a model profile is safe to use with specific ERP modules like Accounting, Sales, or Inventory. Without certification, the AI runtime blocks tool access for that module.')}
                </p>
              </div>
            </div>
          </div>

          {/* ── Current Status Summary ── */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">
                    {t('superAdmin.aiModels.certifications.currentStatus', 'Current Status')}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {certifications.length === 0
                      ? t('superAdmin.aiModels.certifications.noCerts', 'No certifications yet. Run shell or manual certification to enable ERP tool access for this model.')
                      : t('superAdmin.aiModels.certifications.certCount', '{{count}} certifications', { count: certifications.filter(c => c.status !== 'EXPIRED').length })
                    }
                  </p>
                </div>
              </div>
              {highestStatus && (
                <SuperAdminBadge tone={certificationStatusTone(highestStatus)}>
                  {highestStatus}
                </SuperAdminBadge>
              )}
            </div>
          </div>

          {/* ── Section 1: Shell Certification ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <h3 className="text-sm font-semibold text-slate-800">
                {t('superAdmin.aiModels.certifications.runShell', 'Run Shell Certification')}
              </h3>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-500">
              {t('superAdmin.aiModels.certifications.shellCertDesc', 'Shell certification checks structural requirements (tool mode, data filter policy, safety policy). It does NOT run live AI tests. A passing shell cert enables ERP tool access for the selected category.')}
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/30 p-4 space-y-3">
              {/* Profile hash (read-only) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('superAdmin.aiModels.certifications.form.profileHash', 'Profile Hash')}
                </label>
                <input
                  type="text"
                  readOnly
                  value={profile?.profileHash || ''}
                  className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-600 cursor-default"
                />
              </div>
              {/* Category selector */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('superAdmin.aiModels.certifications.form.category', 'Category')}
                </label>
                <div className="flex items-end gap-3">
                  <select
                    value={shellCertCategory}
                    onChange={e => setShellCertCategory(e.target.value as AiCertificationCategory)}
                    className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {CERTIFICATION_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>
                        {t(`superAdmin.aiModels.certifications.categories.${cat}`, cat)}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleRunShellCert}
                    disabled={certSaving || !profile?.profileHash}
                    className="flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    <RefreshCw className={clsx('h-4 w-4', certSaving && 'animate-spin')} />
                    {t('superAdmin.aiModels.certifications.runShell', 'Run Shell Certification')}
                  </button>
                </div>
                {!profile?.profileHash && (
                  <p className="mt-1 text-xs text-amber-700">
                    <AlertTriangle className="h-3 w-3 inline mr-1" />
                    {t('superAdmin.aiModels.certifications.noProfileHash', 'Profile hash not available. Save the profile first.')}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Section 2: Manual Certification Button ── */}
          <div className="flex justify-end">
            <button
              onClick={() => {
                setManualCertForm({
                  profileHash: profile?.profileHash || '',
                  category: undefined,
                  moduleId: undefined,
                  skillId: undefined,
                  score: undefined,
                  maxScore: 100,
                  status: 'CERTIFIED',
                  testSuiteVersion: '',
                  toolContractVersion: '1.0.0',
                  dataFilterPolicyVersion: '1.0.0',
                  summary: '',
                });
                setShowManualCertModal(true);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
            >
              <Plus className="h-4 w-4" />
              {t('superAdmin.aiModels.certifications.recordManual', 'Record Manual Certification')}
            </button>
          </div>

          {/* ── Section 3: Existing Certifications Table ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-800">
                {t('superAdmin.aiModels.certifications.existingCerts', 'Existing Certifications')}
              </h3>
            </div>
            {certifications.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                <Shield className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                {t('superAdmin.aiModels.certifications.empty', 'No certifications recorded')}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr className="text-left text-slate-600">
                      <th className="px-3 py-2 font-medium">{t('superAdmin.aiModels.certifications.columns.category')}</th>
                      <th className="px-3 py-2 font-medium">{t('superAdmin.aiModels.certifications.columns.status')}</th>
                      <th className="px-3 py-2 font-medium">{t('superAdmin.aiModels.certifications.columns.score')}</th>
                      <th className="px-3 py-2 font-medium">{t('superAdmin.aiModels.certifications.columns.testedBy')}</th>
                      <th className="px-3 py-2 font-medium">{t('superAdmin.aiModels.certifications.columns.testedAt')}</th>
                      <th className="px-3 py-2 font-medium">{t('superAdmin.aiModels.certifications.columns.summary')}</th>
                      <th className="px-3 py-2 font-medium">{t('superAdmin.aiModels.certifications.columns.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {certifications.map(cert => (
                      <tr key={cert.id} className="bg-white hover:bg-slate-50">
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                            {t(`superAdmin.aiModels.certifications.categories.${cert.category}`, cert.category)}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <SuperAdminBadge tone={certificationStatusTone(cert.status)}>
                            {cert.status}
                          </SuperAdminBadge>
                        </td>
                        <td className="px-3 py-2 font-mono text-sm">
                          {cert.score}/{cert.maxScore}
                        </td>
                        <td className="px-3 py-2 text-sm">{cert.testedBy}</td>
                        <td className="px-3 py-2 text-sm">{new Date(cert.testedAt).toLocaleDateString()}</td>
                        <td className="max-w-[160px] truncate px-3 py-2 text-sm" title={cert.summary}>{cert.summary || '—'}</td>
                        <td className="px-3 py-2">
                          {cert.status !== 'EXPIRED' ? (
                            <button
                              onClick={() => handleExpireCertification(cert.id)}
                              className="text-xs font-medium text-red-600 hover:text-red-800"
                            >
                              {t('superAdmin.aiModels.certifications.expire', 'Expire')}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">{t('superAdmin.aiModels.certifications.expired', 'Expired')}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </SuperAdminModal>

      {/* ── Manual Certification Sub-Modal ── */}
      {showManualCertModal && (
        <SuperAdminModal
          title={t('superAdmin.aiModels.certifications.recordManual', 'Record Manual Certification')}
          onClose={() => setShowManualCertModal(false)}
          size="lg"
          footer={
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowManualCertModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {t('superAdmin.aiModels.actions.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleRecordManualCert}
                disabled={certSaving || !manualCertForm.category || !manualCertForm.testSuiteVersion || !manualCertForm.summary}
                className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {certSaving ? '...' : t('superAdmin.aiModels.certifications.recordManual', 'Record Manual Certification')}
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">
              <Info className="h-3.5 w-3.5 inline mr-1" />
              {t('superAdmin.aiModels.certifications.manualCertInfo', 'Record a certification result from an external AI test suite. This does NOT run any automated tests — it registers a result you have verified manually.')}
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
              <span className="font-medium">Profile Hash:</span> {profile?.profileHash || '\u2014'}
            </div>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">{t('superAdmin.aiModels.certifications.form.category', 'Category')}</span>
              <select
                value={manualCertForm.category || ''}
                onChange={e => setManualCertForm({ ...manualCertForm, category: e.target.value as AiCertificationCategory })}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="">{'\u2014'} Select {'\u2014'}</option>
                {CERTIFICATION_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{t(`superAdmin.aiModels.certifications.categories.${cat}`, cat)}</option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormInput label={t('superAdmin.aiModels.certifications.form.moduleId', 'Module ID (optional)')} value={manualCertForm.moduleId || ''} onChange={v => setManualCertForm({ ...manualCertForm, moduleId: v || undefined })} />
              <FormInput label={t('superAdmin.aiModels.certifications.form.skillId', 'Skill ID (optional)')} value={manualCertForm.skillId || ''} onChange={v => setManualCertForm({ ...manualCertForm, skillId: v || undefined })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormInput label={t('superAdmin.aiModels.certifications.form.score', 'Score')} type="number" value={String(manualCertForm.score || 0)} onChange={v => setManualCertForm({ ...manualCertForm, score: Number(v) || 0 })} />
              <FormInput label={t('superAdmin.aiModels.certifications.form.maxScore', 'Max Score')} type="number" value={String(manualCertForm.maxScore || 100)} onChange={v => setManualCertForm({ ...manualCertForm, maxScore: Number(v) || 100 })} />
            </div>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">{t('superAdmin.aiModels.certifications.form.status', 'Status')}</span>
              <select
                value={manualCertForm.status || 'CERTIFIED'}
                onChange={e => setManualCertForm({ ...manualCertForm, status: e.target.value as AiCertificationStatus })}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              >
                {(['CERTIFIED', 'WARNING', 'FAILED', 'EXPIRED'] as AiCertificationStatus[]).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <FormInput label={t('superAdmin.aiModels.certifications.form.testSuiteVersion', 'Test Suite Version')} value={manualCertForm.testSuiteVersion || ''} onChange={v => setManualCertForm({ ...manualCertForm, testSuiteVersion: v })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <FormInput label={t('superAdmin.aiModels.certifications.form.toolContractVersion', 'Tool Contract Version')} value={manualCertForm.toolContractVersion || '1.0.0'} onChange={v => setManualCertForm({ ...manualCertForm, toolContractVersion: v })} />
              <FormInput label={t('superAdmin.aiModels.certifications.form.dataFilterPolicyVersion', 'Data Filter Policy Version')} value={manualCertForm.dataFilterPolicyVersion || '1.0.0'} onChange={v => setManualCertForm({ ...manualCertForm, dataFilterPolicyVersion: v })} />
            </div>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">{t('superAdmin.aiModels.certifications.form.summary', 'Summary')}</span>
              <textarea
                value={manualCertForm.summary || ''}
                onChange={e => setManualCertForm({ ...manualCertForm, summary: e.target.value })}
                className="min-h-16 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
        </SuperAdminModal>
      )}
    </>
  );
};

const FormInput: React.FC<{
  label: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
}> = ({ label, value, type = 'text', onChange }) => (
  <label className="block text-sm">
    <span className="mb-1 block font-medium text-slate-700">{label}</span>
    <input type={type} value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" />
  </label>
);