/**
 * AiProposalListPage
 *
 * Tenant page showing all AI proposals for the current company.
 * Users can filter by type, status, module and review proposals.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { aiAssistantApi, AiProposalDTO, AiProposalStatus, AiProposalRiskLevel } from '../../../api/aiAssistantApi';

const STATUS_COLORS: Record<AiProposalStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  pending_review: 'bg-yellow-100 text-yellow-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  archived: 'bg-gray-200 text-gray-600',
};

const RISK_COLORS: Record<AiProposalRiskLevel, string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800',
};

export function AiProposalListPage() {
  const { t } = useTranslation('aiAssistant');
  const [proposals, setProposals] = useState<AiProposalDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await aiAssistantApi.listProposals({
        type: typeFilter || undefined,
        status: statusFilter || undefined,
        moduleId: moduleFilter || undefined,
        limit: 50,
      });
      setProposals(result.proposals);
      setTotal(result.total);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || t('proposals.errors.loadList', 'Failed to load proposals'));
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter, moduleFilter, t]);

  useEffect(() => { fetchProposals(); }, [fetchProposals]);

  const handleArchive = useCallback(async (proposalId: string) => {
    try {
      await aiAssistantApi.archiveProposal(proposalId);
      fetchProposals();
    } catch (err: any) {
      setError(err?.response?.data?.error || t('proposals.errors.archive', 'Failed to archive'));
    }
  }, [fetchProposals, t]);

  const moduleOptions = useMemo(() => {
    const modules = new Set(proposals.map(p => p.moduleId));
    return Array.from(modules).sort();
  }, [proposals]);

  const typeOptions = useMemo(() => {
    const types = new Set(proposals.map(p => p.type));
    return Array.from(types).sort();
  }, [proposals]);

  if (loading && proposals.length === 0) {
    return <div className="p-6 text-center text-gray-500">{t('proposals.loading', 'Loading proposals...')}</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {t('proposals.title', 'AI Proposals')}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t('proposals.subtitle', 'Review AI-generated proposals. No ERP data was changed.')}
        </p>
        <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {t('proposals.sandboxBadge', 'AI Proposal · Sandbox · No ERP changes')}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded text-sm"
        >
          <option value="">{t('proposals.allStatuses', 'All Statuses')}</option>
          <option value="draft">{t('proposals.status.draft', 'Draft')}</option>
          <option value="pending_review">{t('proposals.status.pending_review', 'Pending Review')}</option>
          <option value="accepted">{t('proposals.status.accepted', 'Accepted')}</option>
          <option value="rejected">{t('proposals.status.rejected', 'Rejected')}</option>
          <option value="archived">{t('proposals.status.archived', 'Archived')}</option>
        </select>

        <select
          value={moduleFilter}
          onChange={e => setModuleFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded text-sm"
        >
          <option value="">{t('proposals.allModules', 'All Modules')}</option>
          {moduleOptions.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded text-sm"
        >
          <option value="">{t('proposals.allTypes', 'All Types')}</option>
          {typeOptions.map(tp => <option key={tp} value={tp}>{tp}</option>)}
        </select>

        <span className="text-sm text-gray-500 self-center">
          {t('proposals.total', '{{count}} proposals', { count: total })}
        </span>
      </div>

      {/* Proposals Table */}
      {proposals.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {t('proposals.noProposals', 'No proposals found. Ask the AI Assistant to create one!')}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('proposals.table.title', 'Title')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('proposals.table.type', 'Type')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('proposals.table.status', 'Status')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('proposals.table.risk', 'Risk')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('proposals.table.date', 'Created')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('proposals.table.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {proposals.map(proposal => (
                <tr key={proposal.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/ai-assistant/proposals/${proposal.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                      {proposal.title}
                    </Link>
                    {proposal.missingInfo && proposal.missingInfo.length > 0 && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                        {t('proposals.incomplete', 'Incomplete')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{proposal.type}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[proposal.status]}`}>
                      {t(`proposals.status.${proposal.status}`, proposal.status.replace('_', ' '))}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${RISK_COLORS[proposal.riskLevel]}`}>
                      {t(`proposals.risk.${proposal.riskLevel}`, proposal.riskLevel)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(proposal.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link
                        to={`/ai-assistant/proposals/${proposal.id}`}
                        className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                      >
                        {t('proposals.view', 'View')}
                      </Link>
                      {proposal.status !== 'archived' && (
                        <button
                          onClick={() => handleArchive(proposal.id)}
                          className="text-xs px-2 py-1 bg-gray-50 text-gray-700 rounded hover:bg-gray-100"
                        >
                          {t('proposals.archive', 'Archive')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
