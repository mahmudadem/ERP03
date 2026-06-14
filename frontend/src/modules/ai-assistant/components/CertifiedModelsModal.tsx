/**
 * CertifiedModelsModal.tsx
 *
 * Modal component that displays certified AI model profiles.
 * Fetches certified profiles via the AI Assistant API and allows
 * the user to select one, which populates provider/model/endpoint
 * in the settings page.
 *
 * Filters out profiles whose certifications contain blocked,
 * deprecated, or expired statuses.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  ShieldCheck,
  X,
  Check,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { Spinner } from '../../../components/ui/Spinner';
import {
  aiAssistantApi,
  CertifiedProfileEntry,
  AiCertificationResult,
  AiCertificationCategory,
} from '../../../api/aiAssistantApi';

// ── Types ──────────────────────────────────────────────────────────────────────

interface CertifiedModelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProfile: (profile: CertifiedProfileEntry) => void;
}

// ── Disallowed certification statuses ───────────────────────────────────────────

const BLOCKED_CERT_STATUSES = new Set(['blocked', 'deprecated', 'expired']);

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Check if a profile entry should be shown (no certification has a blocked/deprecated/expired status). */
function isProfileVisible(entry: CertifiedProfileEntry): boolean {
  if (!entry.certifications || entry.certifications.length === 0) return true;
  // If *all* certifications are blocked/deprecated/expired, hide the entry
  const anyValid = entry.certifications.some(
    (c) => !BLOCKED_CERT_STATUSES.has(String(c.status).toLowerCase())
  );
  return anyValid;
}

/** Determine display status: first non-blocked status, or 'unknown'. */
function getProfileStatus(entry: CertifiedProfileEntry): string {
  if (!entry.certifications || entry.certifications.length === 0) return 'unknown';
  const cert = entry.certifications.find(
    (c) => !BLOCKED_CERT_STATUSES.has(String(c.status).toLowerCase())
  );
  return cert?.status ?? 'unknown';
}

/** Get unique categories from certifications. */
function getCategories(entry: CertifiedProfileEntry): string[] {
  if (!entry.certifications) return [];
  const cats = entry.certifications
    .filter((c) => !BLOCKED_CERT_STATUSES.has(String(c.status).toLowerCase()))
    .map((c) => c.category);
  return Array.from(new Set(cats));
}

/** Get scope badge from certifications (prefer GLOBAL, else TENANT). */
function getScope(entry: CertifiedProfileEntry): 'GLOBAL' | 'TENANT' | null {
  if (!entry.certifications || entry.certifications.length === 0) return null;
  const validCerts = entry.certifications.filter(
    (c) => !BLOCKED_CERT_STATUSES.has(String(c.status).toLowerCase())
  );
  if (validCerts.some((c) => c.scope === 'GLOBAL')) return 'GLOBAL';
  if (validCerts.some((c) => c.scope === 'TENANT')) return 'TENANT';
  return null;
}

// ── Component ───────────────────────────────────────────────────────────────────

export const CertifiedModelsModal: React.FC<CertifiedModelsModalProps> = ({
  isOpen,
  onClose,
  onSelectProfile,
}) => {
  const { t } = useTranslation('aiAssistant');

  const [profiles, setProfiles] = useState<CertifiedProfileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch on open ──────────────────────────────────────────────────────────

  const fetchProfiles = useCallback(async () => {
    if (!isOpen) return;
    try {
      setLoading(true);
      setError(null);
      const result = await aiAssistantApi.listTenantCertifiedProfiles({ scope: 'ALL' });
      // Filter out profiles where ALL certifications are blocked/deprecated/expired
      const visible = result.filter(isProfileVisible);
      setProfiles(visible);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || t('settings.certifiedModels.empty', 'No certified models available'));
    } finally {
      setLoading(false);
    }
  }, [isOpen, t]);

  useEffect(() => {
    if (isOpen) fetchProfiles();
  }, [isOpen, fetchProfiles]);

  // ── Escape key handler ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 py-8 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={onClose} />
        </div>

        {/* Spacer */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        {/* Panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full border border-gray-200">
          {/* Header */}
          <div className="bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                {t('settings.certifiedModels.title', 'Recommended Certified Models')}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Safety label */}
          <div className="px-6 pt-4">
            <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-800">
              <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600" />
              <span>
                {t('settings.certifiedModels.description', { defaultValue: 'Index of models the platform has tested. Compare capabilities, certifications, and credit cost per chat to pick the best fit for your work.' })}
              </span>
            </div>
          </div>

          {/* Shell certification disclaimer */}
          <div className="px-6 pt-2">
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-600" />
              <span>
                {t('settings.certifiedModels.shellDisclaimer', 'Certification scores reflect structural and connectivity checks. Full ERP module coverage requires comprehensive test suites that may not yet be complete. Treat WARNING scores with caution.')}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Spinner size="lg" variant="indigo" />
                <span className="ml-3 text-sm text-gray-500">
                  {t('settings.certifiedModels.loading', 'Loading certified models...')}
                </span>
              </div>
            )}

            {error && !loading && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {!loading && !error && profiles.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <ShieldCheck className="w-10 h-10 mb-3 text-gray-300" />
                <p className="text-sm font-medium">
                  {t('settings.certifiedModels.empty', 'No certified models available')}
                </p>
              </div>
            )}

            {!loading && !error && profiles.length > 0 && (
              <div className="overflow-x-auto border border-gray-200 rounded-md">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-600">
                        {t('settings.certifiedModels.columnName', 'Model')}
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-600">
                        {t('settings.certifiedModels.columnProvider', 'Provider')}
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-600">
                        {t('settings.certifiedModels.columnScope', 'Scope')}
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-600">
                        {t('settings.certifiedModels.columnCategories', 'Certified Categories')}
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-600">
                        {t('settings.certifiedModels.columnToolMode', 'Tool Mode')}
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-600">
                        {t('settings.certifiedModels.columnStatus', 'Status')}
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-600">
                        {t('settings.certifiedModels.columnScore', 'Score')}
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-600">
                        {t('settings.certifiedModels.columnCreditCost', { defaultValue: 'Credits/Chat' })}
                      </th>
                      <th className="text-right px-4 py-2.5 font-medium text-gray-600">
                        {/* Select column */}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {profiles.map((entry, idx) => {
                      const profile = entry.profile as Record<string, unknown>;
                      const displayName = String(profile.displayName || profile.modelName || 'Unknown');
                      const provider = String(profile.provider || '');
                      const scope = getScope(entry);
                      const categories = getCategories(entry);
                      const toolMode = String(profile.toolMode || 'unknown');
                      const status = getProfileStatus(entry);

                      // Build certification score summary
                      const certScores = entry.certifications
                        ?.filter((c) => !BLOCKED_CERT_STATUSES.has(String(c.status).toLowerCase()))
                        ?? [];
                      const bestScore = certScores.length > 0
                        ? certScores.reduce((best, c) => (c.score > best.score ? c : best), certScores[0])
                        : null;

                      return (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2.5 font-medium text-gray-800">
                            {displayName}
                          </td>
                          <td className="px-4 py-2.5 text-gray-600">
                            {provider}
                          </td>
                          <td className="px-4 py-2.5">
                            {scope === 'GLOBAL' && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                                <Check className="w-3 h-3" />
                                {t('settings.certifiedModels.scopeGlobal', 'GLOBAL')}
                              </span>
                            )}
                            {scope === 'TENANT' && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                                {t('settings.certifiedModels.scopeTenant', 'TENANT')}
                              </span>
                            )}
                            {!scope && (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-gray-600 text-xs">
                            {categories.length > 0 ? categories.join(', ') : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-gray-600 text-xs font-mono">
                            {toolMode}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                              status === 'CERTIFIED'
                                ? 'bg-green-100 text-green-800 border border-green-200'
                                : status === 'WARNING'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-gray-100 text-gray-700 border border-gray-200'
                            }`}>
                              {status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-600">
                            {bestScore ? (
                              <div className="flex flex-wrap gap-1">
                                <span className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium bg-gray-50">
                                  {bestScore.score}/{bestScore.maxScore}
                                </span>
                                {certScores.length > 1 && (
                                  <span className="text-xs text-gray-400">
                                    +{certScores.length - 1} {t('settings.certifiedModels.moreCerts', 'more')}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-xs">
                            {(() => {
                              const c = profile.creditCost;
                              const cost = typeof c === 'number' && Number.isFinite(c) && c >= 0 ? c : 1;
                              if (cost === 0) {
                                return <span className="inline-flex items-center rounded-md bg-green-100 px-2 py-0.5 font-medium text-green-800">{t('settings.modelCreditCostFree', 'Free')}</span>;
                              }
                              const tone = cost <= 1 ? 'bg-slate-100 text-slate-700' : cost <= 5 ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800';
                              return <span className={`inline-flex items-center rounded-md px-2 py-0.5 font-medium ${tone}`}>{cost}</span>;
                            })()}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => onSelectProfile(entry)}
                              className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
                            >
                              <Check className="w-3.5 h-3.5" />
                              {t('settings.certifiedModels.selectButton', 'Select')}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
            >
              {t('settings.certifiedModels.closeModal', 'Close')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CertifiedModelsModal;