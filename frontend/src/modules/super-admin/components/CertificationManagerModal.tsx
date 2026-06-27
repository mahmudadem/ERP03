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
  ArrowRight,
  Eye,
  Info,
  Plus,
  RefreshCw,
  Shield,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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
import { useConfirm } from '../../../hooks/useConfirm';

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
  const navigate = useNavigate();

  // ── Certification state ──
  const [certifications, setCertifications] = useState<AiCertificationResult[]>([]);
  const [shellCertCategory, setShellCertCategory] = useState<AiCertificationCategory>('ACCOUNTING');
  const [certSaving, setCertSaving] = useState(false);
  const [runAllInProgress, setRunAllInProgress] = useState(false);
  const [runAllProgress, setRunAllProgress] = useState<{ current: number; total: number; category: string } | null>(null);
  const [runAllResults, setRunAllResults] = useState<AiCertificationResult[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ── Policy configuration state ──
  const [dataFilterPolicyId, setDataFilterPolicyId] = useState<string>('');
  const [safetyPolicyId, setSafetyPolicyId] = useState<string>('');
  const [systemPromptPolicyId, setSystemPromptPolicyId] = useState<string>('');

  // ── Detail sub-modal state ──
  const [detailCert, setDetailCert] = useState<AiCertificationResult | null>(null);

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

  const { confirm, confirmDialog } = useConfirm();

  // ── Initialize ──
  useEffect(() => {
    if (isOpen && profile?.id) {
      loadCertifications();
      setDataFilterPolicyId(profile.dataFilterPolicyId || 'erp-standard-masking');
      setSafetyPolicyId(profile.safetyPolicyId || 'default-safety');
      setSystemPromptPolicyId(profile.systemPromptPolicyId || 'erp-default-assistant');
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
      
      // 1. Update the profile with the selected policies
      const updateResponse = await superAdminApi.updateAiModelProfile(profile.id, {
        provider: profile.provider,
        modelName: profile.modelName,
        status: profile.status,
        supportsToolCalling: profile.supportsToolCalling,
        supportsStructuredJson: profile.supportsStructuredJson,
        maxContextTokens: profile.maxContextTokens,
        textOnlyMode: profile.textOnlyMode,
        dataFilterPolicyId,
        safetyPolicyId,
        systemPromptPolicyId,
      });
      // Handle potential envelope wrapper
      const updatedProfile = (updateResponse as any).data || updateResponse;
      const newHash = updatedProfile.profileHash || profile.profileHash;

      // 2. Run certification using the (potentially new) hash
      const result = await superAdminApi.runGlobalCertification(profile.id, {
        profileHash: newHash,
        category: shellCertCategory,
      });
      const unwrapped = (result as any).data || result;
      setRunAllResults([unwrapped]);
      errorHandler.showSuccess(t('superAdmin.aiModels.certifications.messages.shellRan'));
      await loadCertifications();
      onCertChange();
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setCertSaving(false);
    }
  };

  const handleRunAllCategories = async () => {
    if (!profile?.id) return;
    try {
      setRunAllInProgress(true);
      setCertSaving(true);
      setRunAllResults([]);

      const updateResponse = await superAdminApi.updateAiModelProfile(profile.id, {
        provider: profile.provider,
        modelName: profile.modelName,
        status: profile.status,
        supportsToolCalling: profile.supportsToolCalling,
        supportsStructuredJson: profile.supportsStructuredJson,
        maxContextTokens: profile.maxContextTokens,
        textOnlyMode: profile.textOnlyMode,
        dataFilterPolicyId,
        safetyPolicyId,
        systemPromptPolicyId,
      });
      const updatedProfile = (updateResponse as any).data || updateResponse;
      const newHash = updatedProfile.profileHash || profile.profileHash;

      for (let i = 0; i < CERTIFICATION_CATEGORIES.length; i++) {
        const cat = CERTIFICATION_CATEGORIES[i];
        setRunAllProgress({ current: i + 1, total: CERTIFICATION_CATEGORIES.length, category: cat });
        try {
          const result = await superAdminApi.runGlobalCertification(profile.id, {
            profileHash: newHash,
            category: cat,
          });
          const unwrapped = (result as any).data || result;
          setRunAllResults(prev => [...prev, unwrapped]);
        } catch {
          setRunAllResults(prev => [...prev, {
            id: `error-${cat}`,
            category: cat,
            status: 'FAILED' as AiCertificationStatus,
            score: 0,
            maxScore: 100,
            summary: 'Request failed — check network or provider.',
          } as AiCertificationResult]);
        }
      }

      errorHandler.showSuccess(`Certification complete — ran all ${CERTIFICATION_CATEGORIES.length} categories`);
      await loadCertifications();
      onCertChange();
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setRunAllInProgress(false);
      setRunAllProgress(null);
      setCertSaving(false);
    }
  };

  const handleExpireCertification = async (certificationId: string) => {
    const confirmed = await confirm({
      title: 'Expire Certification',
      tone: 'warning',
      message: t('superAdmin.aiModels.certifications.confirmExpire') as string
    });
    if (!confirmed) return;
    try {
      await superAdminApi.expireCertification(certificationId);
      errorHandler.showSuccess(t('superAdmin.aiModels.certifications.messages.expired'));
      await loadCertifications();
      onCertChange();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  const handleResetCertHistory = async () => {
    if (!profile?.id) return;
    const confirmMsg = `This will permanently delete ALL certification records for "${profile.displayName || profile.modelName}". This is useful when you want to start a fresh certification cycle.\n\nContinue?`;
    const confirmed = await confirm({
      title: 'Reset Certification History',
      tone: 'danger',
      message: confirmMsg
    });
    if (!confirmed) return;
    try {
      const result = await superAdminApi.resetAiModelProfileCertifications(profile.id);
      const payload = (result as any).data || result;
      errorHandler.showSuccess(payload.message || `${payload.removed} record(s) deleted`);
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
  // A cert is "stale" when its profileHash no longer matches the profile's
  // current hash. Stale certs are NOT used by the runtime routing guard
  // (which looks up certs against the live profile hash), so the UI must
  // not present them as still-protecting CERTIFIED rows. We surface
  // staleness as a separate badge AND demote the cert's effective status
  // when summarising readiness.
  const isCertStale = (cert: AiCertificationResult): boolean => {
    if (!profile?.profileHash) return false;
    if (cert.status === 'EXPIRED' || cert.status === 'FAILED') return false;
    return cert.profileHash !== profile.profileHash;
  };

  const highestStatus = useMemo(() => {
    if (certifications.length === 0) return null;
    const active = certifications.filter(c => c.status !== 'EXPIRED' && !isCertStale(c));
    if (active.length === 0) {
      // Either everything expired or everything stale — show whichever is more
      // accurate. If any active-but-stale cert exists, surface WARNING so the
      // user understands tools won't run until re-cert.
      if (certifications.some(c => c.status !== 'EXPIRED' && isCertStale(c))) {
        return 'WARNING' as AiCertificationStatus;
      }
      return 'EXPIRED' as AiCertificationStatus;
    }
    if (active.some(c => c.status === 'CERTIFIED')) return 'CERTIFIED' as AiCertificationStatus;
    if (active.some(c => c.status === 'WARNING')) return 'WARNING' as AiCertificationStatus;
    return active[0].status as AiCertificationStatus;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certifications, profile?.profileHash]);

  // Detect specific failure: cert failed because no platform runtime profile exists.
  // The backend writes a recognizable phrase into the cert summary in this case, so
  // we can render an inline "Fix it" action instead of just showing the error.
  const lastCertMissingRuntime = useMemo(() => {
    const failed = certifications.find(c => c.status === 'FAILED');
    if (!failed) return false;
    const text = `${failed.summary || ''} ${(failed as any).failureReasons?.join(' ') || ''}`.toLowerCase();
    return text.includes('no active platform runtime profile') || text.includes('runtime profile with credential');
  }, [certifications]);

  type Readiness = 'untested' | 'needs-runtime' | 'ready' | 'failed' | 'expired' | 'stale';
  const readiness: Readiness = useMemo(() => {
    if (certifications.length === 0) return 'untested';
    if (lastCertMissingRuntime) return 'needs-runtime';
    const active = certifications.filter(c => c.status !== 'EXPIRED');
    if (active.length === 0) return 'expired';
    const liveActive = active.filter(c => !isCertStale(c));
    if (liveActive.length === 0) return 'stale';
    if (liveActive.some(c => c.status === 'CERTIFIED')) return 'ready';
    if (liveActive.some(c => c.status === 'FAILED')) return 'failed';
    return 'untested';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certifications, lastCertMissingRuntime, profile?.profileHash]);

  const handleFixRuntimeProfile = () => {
    onClose();
    navigate(`/super-admin/ai-runtime-profiles?modelProfileId=${encodeURIComponent(profile.id)}`);
  };

  const profileLabel = profile
    ? `${profile.modelId || profile.modelName} · ${profile.providerId || profile.provider}`
    : '';

  // ── Render ──
  if (!isOpen) return null;

  return (
    <>
      {confirmDialog}
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
        <div className="space-y-5">
          {/* ── Status hero: traffic-light readiness + single primary action ── */}
          {readiness === 'ready' && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-emerald-100 p-2 flex-shrink-0">
                  <ShieldCheck className="h-5 w-5 text-emerald-700" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-emerald-900">{t(`Ready for tenants`)}</h3>
                  <p className="mt-1 text-sm text-emerald-800">
                    This model is certified. Tenants can use it for the categories listed below.
                  </p>
                </div>
              </div>
            </div>
          )}

          {readiness === 'needs-runtime' && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-amber-100 p-2 flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-amber-700" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-amber-900">{t(`Setup incomplete — no platform API key`)}</h3>
                  <p className="mt-1 text-sm text-amber-800">
                    Certification can&apos;t run without a platform API key for this model. Set one up in Platform Global Providers, then come back and re-run.
                  </p>
                  <button
                    onClick={handleFixRuntimeProfile}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800"
                  >
                    Fix it — set up platform API key
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {readiness === 'failed' && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-red-100 p-2 flex-shrink-0">
                  <XCircle className="h-5 w-5 text-red-700" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-red-900">{t(`Last certification failed`)}</h3>
                  <p className="mt-1 text-sm text-red-800">
                    Check the failure detail in the table below, fix the underlying issue, then re-run for the same category.
                  </p>
                </div>
              </div>
            </div>
          )}

          {readiness === 'expired' && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-slate-200 p-2 flex-shrink-0">
                  <Shield className="h-5 w-5 text-slate-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-slate-800">{t(`All certifications expired`)}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Re-run certification for the categories you want to enable.
                  </p>
                </div>
              </div>
            </div>
          )}

          {readiness === 'stale' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-amber-200 p-2 flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-amber-700" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-amber-900">
                    {t('superAdmin.aiModels.certifications.staleHeroTitle', 'Certifications no longer match this profile')}
                  </h3>
                  <p className="mt-1 text-sm text-amber-800">
                    {t(
                      'superAdmin.aiModels.certifications.staleHeroBody',
                      'You edited this profile after running these tests. The chat runtime ignores stale certifications, so tenants on this model currently have no tool access. Re-run certification for each category you want to re-enable.',
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {readiness === 'untested' && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-slate-100 p-2 flex-shrink-0">
                  <Shield className="h-5 w-5 text-slate-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-slate-800">{t(`Not certified yet`)}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Pick an ERP category below and run certification to unlock tool access for tenants.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Primary action: certify for a category ── */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <label className="block text-sm font-semibold text-slate-800 mb-2">
              Certify this model for…
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
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
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <RefreshCw className={clsx('h-4 w-4', certSaving && !runAllInProgress && 'animate-spin')} />
                {certSaving && !runAllInProgress ? 'Running…' : 'Run certification'}
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={handleRunAllCategories}
                disabled={certSaving || !profile?.profileHash}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw className={clsx('h-4 w-4', runAllInProgress && 'animate-spin')} />
                {runAllInProgress
                  ? `Running ${runAllProgress?.current}/${runAllProgress?.total} — ${runAllProgress?.category}…`
                  : `Run all ${CERTIFICATION_CATEGORIES.length} categories`}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Runs a structural test using the saved policies. Takes a few seconds.
              <button
                type="button"
                onClick={() => setShowAdvanced(s => !s)}
                className="ml-2 text-slate-700 hover:text-slate-900 underline"
              >
                {showAdvanced ? 'Hide advanced' : 'Advanced'}
              </button>
            </p>

            {/* ── Inline results from the most recent run ── */}
            {runAllResults.length > 0 && (
              <div className="mt-4 border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                    {t(`Results`)} {runAllInProgress && runAllProgress ? `(${runAllProgress.current}/${runAllProgress.total})` : `— ${runAllResults.length} categories`}
                  </h4>
                  {!runAllInProgress && (
                    <button
                      type="button"
                      onClick={() => setRunAllResults([])}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {!runAllInProgress && (() => {
                  const passed = runAllResults.filter(r => r.status === 'CERTIFIED').length;
                  const failed = runAllResults.filter(r => r.status === 'FAILED').length;
                  const warned = runAllResults.filter(r => r.status === 'WARNING').length;
                  return (
                    <div className={clsx(
                      'mb-3 rounded-lg border px-4 py-2.5 text-sm font-medium',
                      failed === 0
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-amber-200 bg-amber-50 text-amber-800',
                    )}>
                      {failed === 0
                        ? <><ShieldCheck className="inline h-4 w-4 mr-1.5 -mt-0.5" />{passed} {t(`certified`)}{warned > 0 ? `, ${warned} warnings` : ''} {t(`— all categories passed`)}</>
                        : <><AlertTriangle className="inline h-4 w-4 mr-1.5 -mt-0.5" />{passed} {t(`certified,`)} {failed} {t(`failed`)}{warned > 0 ? `, ${warned} warnings` : ''}</>
                      }
                    </div>
                  );
                })()}
                <div className="space-y-1 max-h-[320px] overflow-y-auto">
                  {runAllResults.map(r => (
                    <div
                      key={r.id}
                      className={clsx(
                        'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
                        r.status === 'CERTIFIED' && 'border-emerald-200 bg-emerald-50/50',
                        r.status === 'WARNING' && 'border-amber-200 bg-amber-50/50',
                        r.status === 'FAILED' && 'border-red-200 bg-red-50/50',
                      )}
                    >
                      <span className="flex-shrink-0 mt-0.5">
                        {r.status === 'CERTIFIED' && <ShieldCheck className="h-4 w-4 text-emerald-600" />}
                        {r.status === 'WARNING' && <AlertTriangle className="h-4 w-4 text-amber-600" />}
                        {r.status === 'FAILED' && <XCircle className="h-4 w-4 text-red-600" />}
                      </span>
                      <div className="flex-1 min-w-0 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800">{r.category}</span>
                          <span className="font-mono text-xs text-slate-500">{r.score}/{r.maxScore}</span>
                        </div>
                        {r.summary && (
                          <button
                            type="button"
                            onClick={() => setDetailCert(r)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Details
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {runAllInProgress && runAllProgress && (
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                      <RefreshCw className="h-4 w-4 animate-spin flex-shrink-0" />
                      <span>{t(`Running`)} {runAllProgress.category}…</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Advanced: policies + profile hash + manual cert (rarely needed) */}
            {showAdvanced && (
              <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{t(`Data Filter Policy`)}</label>
                    <select
                      value={dataFilterPolicyId}
                      onChange={e => setDataFilterPolicyId(e.target.value)}
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                    >
                      <option value="none">{t(`None`)}</option>
                      <option value="erp-standard-masking">{t(`ERP Standard Masking`)}</option>
                      <option value="strict-pii">{t(`Strict PII Filtering`)}</option>
                      <option value="financial-only">{t(`Financial Data Only`)}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{t(`Safety Policy`)}</label>
                    <select
                      value={safetyPolicyId}
                      onChange={e => setSafetyPolicyId(e.target.value)}
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                    >
                      <option value="none">{t(`None`)}</option>
                      <option value="default-safety">{t(`Default Safety`)}</option>
                      <option value="strict-safety">{t(`Strict Safety`)}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{t(`System Prompt Policy`)}</label>
                    <select
                      value={systemPromptPolicyId}
                      onChange={e => setSystemPromptPolicyId(e.target.value)}
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                    >
                      <option value="none">{t(`None`)}</option>
                      <option value="erp-default-assistant">{t(`ERP Default Assistant`)}</option>
                      <option value="sales-specialist">{t(`Sales Specialist`)}</option>
                      <option value="accounting-specialist">{t(`Accounting Specialist`)}</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    {t(`Profile hash:`)} <span className="font-mono text-slate-700">{profile?.profileHash?.slice(0, 16) || '—'}…</span>
                  </span>
                  <button
                    type="button"
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
                    className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 underline"
                  >
                    <Plus className="h-3 w-3" />
                    Record manual certification
                  </button>
                </div>
                {!profile?.profileHash && (
                  <p className="text-xs text-amber-700 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Profile hash not available. Save the profile first.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Section 3: Existing Certifications Table ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-800">
                  {t('superAdmin.aiModels.certifications.existingCerts', 'Existing Certifications')}
                </h3>
              </div>
              {certifications.length > 0 && (
                <button
                  type="button"
                  onClick={handleResetCertHistory}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                  title="Permanently delete all certification records for this model — useful when starting a fresh certification cycle."
                >
                  <XCircle className="h-3.5 w-3.5" />
                  {t('superAdmin.aiModels.certifications.resetHistory', 'Reset certification history')}
                </button>
              )}
            </div>
            {certifications.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                <Shield className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                {t('superAdmin.aiModels.certifications.empty', 'No certifications recorded')}
              </div>
            ) : (<>
              {certifications.some(c => isCertStale(c)) && (
                <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-700" />
                    <div>
                      <div className="font-medium">
                        {t(
                          'superAdmin.aiModels.certifications.staleBannerTitle',
                          'Some certifications are stale',
                        )}
                      </div>
                      <div className="mt-1 text-xs text-amber-800">
                        {t(
                          'superAdmin.aiModels.certifications.staleBannerBody',
                          'This profile was edited after these tests were run, so they no longer apply to the current configuration. The chat runtime ignores stale certifications — re-run them to re-enable ERP tools.',
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
                    {certifications.map(cert => {
                      const stale = isCertStale(cert);
                      return (
                      <tr key={cert.id} className={clsx('bg-white hover:bg-slate-50', stale && 'bg-amber-50/40')}>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                            {t(`superAdmin.aiModels.certifications.categories.${cert.category}`, cert.category)}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-1">
                            <SuperAdminBadge tone={stale ? 'slate' : certificationStatusTone(cert.status)}>
                              {cert.status}
                            </SuperAdminBadge>
                            {stale && (
                              <span
                                title={t(
                                  'superAdmin.aiModels.certifications.staleTooltip',
                                  'This certification was run against an older configuration of this profile. The runtime ignores it until you re-run the test on the current config.',
                                )}
                                className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800"
                              >
                                <AlertTriangle className="h-3 w-3" />
                                {t('superAdmin.aiModels.certifications.stale', 'Stale')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 font-mono text-sm">
                          {cert.score}/{cert.maxScore}
                        </td>
                        <td className="px-3 py-2 text-sm">{cert.testedBy}</td>
                        <td className="px-3 py-2 text-sm">{new Date(cert.testedAt).toLocaleDateString()}</td>
                        <td className="px-3 py-2 text-sm">
                          {cert.summary ? (
                            <button
                              type="button"
                              onClick={() => setDetailCert(cert)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Details
                            </button>
                          ) : '—'}
                        </td>
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>)}
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
              <span className="font-medium">{t(`Profile Hash:`)}</span> {profile?.profileHash || '\u2014'}
            </div>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">{t('superAdmin.aiModels.certifications.form.category', 'Category')}</span>
              <select
                value={manualCertForm.category || ''}
                onChange={e => setManualCertForm({ ...manualCertForm, category: e.target.value as AiCertificationCategory })}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="">{'\u2014'} {t(`Select`)} {'\u2014'}</option>
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

      {/* ── Certification Detail Sub-Modal ── */}
      {detailCert && (
        <SuperAdminModal
          title={`${detailCert.category} — Certification Detail`}
          onClose={() => setDetailCert(null)}
          size="lg"
          footer={
            <div className="flex justify-end">
              <button
                onClick={() => setDetailCert(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <SuperAdminBadge tone={certificationStatusTone(detailCert.status)}>
                {detailCert.status}
              </SuperAdminBadge>
              <span className="font-mono text-sm text-slate-600">{detailCert.score}/{detailCert.maxScore}</span>
              <span className="text-xs text-slate-400">
                {new Date(detailCert.testedAt).toLocaleString()}
              </span>
            </div>

            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t(`Summary`)}</h4>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {detailCert.summary || 'No summary available.'}
              </div>
            </div>

            {detailCert.failureReasons && detailCert.failureReasons.length > 0 && (
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-600">{t(`Failure Reasons`)}</h4>
                <ul className="space-y-1">
                  {detailCert.failureReasons.map((reason, i) => (
                    <li key={i} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
              <div><span className="font-medium text-slate-600">{t(`Tested by:`)}</span> {detailCert.testedBy}</div>
              <div><span className="font-medium text-slate-600">{t(`Profile hash:`)}</span> <span className="font-mono">{detailCert.profileHash?.slice(0, 20)}…</span></div>
              <div><span className="font-medium text-slate-600">{t(`Test suite:`)}</span> {detailCert.testSuiteVersion || '—'}</div>
              <div><span className="font-medium text-slate-600">{t(`Tool contract:`)}</span> {detailCert.toolContractVersion || '—'}</div>
            </div>
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