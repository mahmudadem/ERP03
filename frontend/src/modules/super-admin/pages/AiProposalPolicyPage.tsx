/**
 * AiProposalPolicyPage
 *
 * Super Admin page for managing AI Proposal policies.
 * Controls which proposal types are enabled, daily limits, etc.
 * allowBusinessExecution is ALWAYS false and locked.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import client from '../../../api/client';

interface ProposalPolicy {
  id: string;
  companyId: string | null;
  enabled: boolean;
  allowedProposalTypes: string[];
  disabledProposalTypes: string[];
  maxProposalsPerDayPerCompany: number;
  maxProposalsPerDayPerUser: number;
  requireReview: boolean;
  allowAcceptWithoutExecution: boolean;
  allowBusinessExecution: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProposalSummary {
  globalPolicy: ProposalPolicy;
  companyPolicyCount: number;
  enabledGlobally: boolean;
  allowBusinessExecution: boolean;
  registeredProposalTypes: string[];
  disabledTypes: string[];
}

export function AiProposalPolicyPage() {
  const { t } = useTranslation('common');
  const [summary, setSummary] = useState<ProposalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await client.get('/platform/ai-proposals/summary');
      setSummary(response as unknown as ProposalSummary);
    } catch (err: any) {
      setError(err?.response?.data?.error || t('superAdmin.aiProposalPolicies.errors.load', 'Failed to load proposal policies'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const updatePolicy = useCallback(async (updates: Partial<ProposalPolicy>) => {
    if (!summary) return;
    // SAFETY: Never allow allowBusinessExecution to be true
    if (updates.allowBusinessExecution === true) {
      setError(t('superAdmin.aiProposalPolicies.errors.businessExecutionLocked', 'allowBusinessExecution must ALWAYS be false'));
      return;
    }
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await client.patch(`/platform/ai-proposal-policies/${summary.globalPolicy.id}`, updates);
      await fetchSummary();
      setSuccessMsg(t('superAdmin.aiProposalPolicies.messages.updated', 'Policy updated successfully'));
    } catch (err: any) {
      setError(err?.response?.data?.error || t('superAdmin.aiProposalPolicies.errors.update', 'Failed to update policy'));
    } finally {
      setSaving(false);
    }
  }, [summary, fetchSummary, t]);

  if (loading) return <div className="p-6 text-center text-gray-500">{t('superAdmin.aiProposalPolicies.loading', 'Loading...')}</div>;
  if (error && !summary) return <div className="p-6 text-red-600">{error}</div>;
  if (!summary) return null;

  const policy = summary.globalPolicy;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        {t('superAdmin.aiProposalPolicies.title', 'AI Proposal Policies')}
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        {t('superAdmin.aiProposalPolicies.subtitle', 'Control which AI proposal types are enabled and set limits.')}
      </p>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}
      {successMsg && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">{successMsg}</div>}

      {/* Global Settings */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">{t('superAdmin.aiProposalPolicies.globalSettings', 'Global Settings')}</h2>

        {/* Enabled toggle */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-medium">{t('superAdmin.aiProposalPolicies.proposalSystemEnabled', 'Proposal System Enabled')}</p>
            <p className="text-sm text-gray-500">{t('superAdmin.aiProposalPolicies.proposalSystemEnabledHelp', 'Master switch for the AI proposal sandbox')}</p>
          </div>
          <button
            onClick={() => updatePolicy({ enabled: !policy.enabled })}
            disabled={saving}
            className={`px-4 py-2 rounded text-sm font-medium ${policy.enabled ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            {policy.enabled ? t('superAdmin.aiProposalPolicies.status.enabled', 'Enabled') : t('superAdmin.aiProposalPolicies.status.disabled', 'Disabled')}
          </button>
        </div>

        {/* Require Review */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-medium">{t('superAdmin.aiProposalPolicies.requireReview', 'Require Review')}</p>
            <p className="text-sm text-gray-500">{t('superAdmin.aiProposalPolicies.requireReviewHelp', 'Proposals must be reviewed before acceptance')}</p>
          </div>
          <button
            onClick={() => updatePolicy({ requireReview: !policy.requireReview })}
            disabled={saving}
            className={`px-4 py-2 rounded text-sm font-medium ${policy.requireReview ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            {policy.requireReview ? t('superAdmin.aiProposalPolicies.status.required', 'Required') : t('superAdmin.aiProposalPolicies.status.optional', 'Optional')}
          </button>
        </div>

        {/* Safety lock */}
        <div className="flex items-center justify-between mb-4 p-3 bg-red-50 border border-red-200 rounded">
          <div>
            <p className="font-medium text-red-800">{t('superAdmin.aiProposalPolicies.businessExecution', 'Business Execution')}</p>
            <p className="text-sm text-red-600">{t('superAdmin.aiProposalPolicies.businessExecutionHelp', 'Proposals must NEVER execute real business actions')}</p>
          </div>
          <span className="px-4 py-2 rounded text-sm font-medium bg-red-600 text-white cursor-not-allowed">
            {t('superAdmin.aiProposalPolicies.alwaysFalseLocked', 'ALWAYS FALSE (Locked)')}
          </span>
        </div>
      </div>

      {/* Daily Limits */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">{t('superAdmin.aiProposalPolicies.dailyLimits', 'Daily Limits')}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('superAdmin.aiProposalPolicies.maxPerCompanyDay', 'Max Per Company/Day')}</label>
            <input
              type="number"
              value={policy.maxProposalsPerDayPerCompany}
              onChange={e => updatePolicy({ maxProposalsPerDayPerCompany: parseInt(e.target.value) || 50 })}
              disabled={saving}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('superAdmin.aiProposalPolicies.maxPerUserDay', 'Max Per User/Day')}</label>
            <input
              type="number"
              value={policy.maxProposalsPerDayPerUser}
              onChange={e => updatePolicy({ maxProposalsPerDayPerUser: parseInt(e.target.value) || 20 })}
              disabled={saving}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
        </div>
      </div>

      {/* Proposal Type Controls */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">{t('superAdmin.aiProposalPolicies.proposalTypeControls', 'Proposal Type Controls')}</h2>
        <p className="text-sm text-gray-500 mb-3">{t('superAdmin.aiProposalPolicies.proposalTypeControlsHelp', 'Enable or disable specific proposal types. Disabled types take precedence.')}</p>

        <div className="space-y-2">
          {summary.registeredProposalTypes.map(type => {
            const isDisabled = policy.disabledProposalTypes.includes(type);
            return (
              <div key={type} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm font-medium">{type}</span>
                <button
                  onClick={() => {
                    const newDisabled = isDisabled
                      ? policy.disabledProposalTypes.filter(t => t !== type)
                      : [...policy.disabledProposalTypes, type];
                    updatePolicy({ disabledProposalTypes: newDisabled });
                  }}
                  disabled={saving}
                  className={`px-3 py-1 rounded text-xs font-medium ${isDisabled ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}
                >
                  {isDisabled ? t('superAdmin.aiProposalPolicies.status.disabled', 'Disabled') : t('superAdmin.aiProposalPolicies.status.enabled', 'Enabled')}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">{t('superAdmin.aiProposalPolicies.systemSummary', 'System Summary')}</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-4 bg-gray-50 rounded">
            <p className="text-2xl font-bold text-gray-900">{summary.registeredProposalTypes.length}</p>
            <p className="text-sm text-gray-500">{t('superAdmin.aiProposalPolicies.registeredTypes', 'Registered Types')}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded">
            <p className="text-2xl font-bold text-gray-900">{summary.disabledTypes.length}</p>
            <p className="text-sm text-gray-500">{t('superAdmin.aiProposalPolicies.disabledTypes', 'Disabled Types')}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded">
            <p className="text-2xl font-bold text-gray-900">{summary.companyPolicyCount}</p>
            <p className="text-sm text-gray-500">{t('superAdmin.aiProposalPolicies.companyOverrides', 'Company Overrides')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
