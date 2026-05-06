/**
 * AiProposalDetailPage
 *
 * Shows a single AI proposal with all details, proposed data,
 * warnings, and status controls (accept/reject/archive).
 *
 * IMPORTANT: The "Execute" button is DISABLED and labeled
 * "Execution is not available in this version."
 * Accepting a proposal does NOT create real ERP records.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
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

export function AiProposalDetailPage() {
  const { t } = useTranslation('aiAssistant');
  const { proposalId } = useParams<{ proposalId: string }>();
  const navigate = useNavigate();
  const [proposal, setProposal] = useState<AiProposalDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchProposal = useCallback(async () => {
    if (!proposalId) return;
    setLoading(true);
    try {
      const result = await aiAssistantApi.getProposal(proposalId);
      setProposal(result.proposal);
    } catch (err: any) {
      setError(err?.response?.data?.error || t('proposals.errors.loadDetail', 'Failed to load proposal'));
    } finally {
      setLoading(false);
    }
  }, [proposalId, t]);

  useEffect(() => { fetchProposal(); }, [fetchProposal]);

  const handleStatusUpdate = useCallback(async (newStatus: AiProposalStatus) => {
    if (!proposalId) return;
    setActionLoading(true);
    setError(null);
    try {
      const result = await aiAssistantApi.updateProposalStatus(
        proposalId,
        newStatus,
        newStatus === 'rejected' ? rejectReason.trim() || undefined : undefined,
      );
      setProposal(result.proposal);
      setShowRejectInput(false);
      setRejectReason('');
    } catch (err: any) {
      setError(err?.response?.data?.error || t('proposals.errors.updateStatus', 'Failed to update status'));
    } finally {
      setActionLoading(false);
    }
  }, [proposalId, rejectReason, t]);

  const handleArchive = useCallback(async () => {
    if (!proposalId) return;
    setActionLoading(true);
    try {
      await aiAssistantApi.archiveProposal(proposalId);
      navigate('/ai-assistant/proposals');
    } catch (err: any) {
      setError(err?.response?.data?.error || t('proposals.errors.archive', 'Failed to archive'));
    } finally {
      setActionLoading(false);
    }
  }, [proposalId, navigate, t]);

  if (loading) return <div className="p-6 text-center text-gray-500">{t('proposals.loading', 'Loading...')}</div>;
  if (error && !proposal) return <div className="p-6 text-red-600">{error}</div>;
  if (!proposal) return <div className="p-6 text-gray-500">{t('proposals.notFound', 'Proposal not found')}</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back link */}
      <Link to="/ai-assistant/proposals" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
        ← {t('proposals.backToList', 'Back to Proposals')}
      </Link>

      {/* Error */}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

      {/* Sandbox Badge */}
      <div className="mb-4 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        {t('proposals.sandboxBadge', 'AI Proposal · Sandbox · No ERP changes')}
      </div>

      {/* Title & Status */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{proposal.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{proposal.type} · {proposal.moduleId}</p>
        </div>
        <div className="flex gap-2">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[proposal.status]}`}>
            {t(`proposals.status.${proposal.status}`, proposal.status)}
          </span>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${RISK_COLORS[proposal.riskLevel]}`}>
            {t('proposals.table.risk', 'Risk')}: {t(`proposals.risk.${proposal.riskLevel}`, proposal.riskLevel)}
          </span>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">{t('proposals.summary', 'Summary')}</h2>
        <p className="text-sm text-gray-800">{proposal.summary}</p>
      </div>

      {/* Rationale */}
      <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">{t('proposals.rationale', 'Rationale')}</h2>
        <p className="text-sm text-gray-800">{proposal.rationale}</p>
      </div>

      {/* Proposed Data */}
      <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">{t('proposals.proposedData', 'Proposed Data')}</h2>
        <pre className="text-xs text-gray-800 bg-gray-50 p-3 rounded overflow-x-auto">
          {JSON.stringify(proposal.proposedData, null, 2)}
        </pre>
      </div>

      {/* Warnings */}
      {proposal.warnings.length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h2 className="text-sm font-semibold text-yellow-800 mb-2">{t('proposals.warnings', 'Warnings')}</h2>
          <ul className="list-disc list-inside text-sm text-yellow-700">
            {proposal.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* Missing Info */}
      {proposal.missingInfo && proposal.missingInfo.length > 0 && (
        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <h2 className="text-sm font-semibold text-orange-800 mb-2">{t('proposals.missingInfo', 'Missing Information')}</h2>
          <ul className="list-disc list-inside text-sm text-orange-700">
            {proposal.missingInfo.map((info, i) => <li key={i}>{info}</li>)}
          </ul>
          <p className="text-xs text-orange-600 mt-2">
            {t('proposals.provideMissing', 'Please provide this information to complete the proposal.')}
          </p>
        </div>
      )}

      {/* Context */}
      <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">{t('proposals.context', 'Source Context')}</h2>
        <p className="text-xs text-gray-600">{proposal.inputContextSummary}</p>
        <div className="mt-2 flex gap-4 text-xs text-gray-500">
          <span>{t('proposals.confidence', 'Confidence')}: {proposal.confidence != null ? `${(proposal.confidence * 100).toFixed(0)}%` : t('proposals.notAvailable', 'N/A')}</span>
          <span>{t('proposals.createdBy', 'Created')}: {new Date(proposal.createdAt).toLocaleString()}</span>
          {proposal.reviewedBy && <span>{t('proposals.reviewedBy', 'Reviewed by')}: {proposal.reviewedBy}</span>}
        </div>
      </div>

      {/* Rejection Reason */}
      {proposal.rejectionReason && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-sm font-semibold text-red-800 mb-1">{t('proposals.rejectionReason', 'Rejection Reason')}</h2>
          <p className="text-sm text-red-700">{proposal.rejectionReason}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 mt-6">
        {proposal.status === 'pending_review' && (
          <>
            <button
              onClick={() => handleStatusUpdate('accepted')}
              disabled={actionLoading}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
            >
              {t('proposals.accept', 'Mark as Accepted')}
            </button>
            <button
              onClick={() => setShowRejectInput(true)}
              disabled={actionLoading}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
            >
              {t('proposals.reject', 'Reject')}
            </button>
          </>
        )}
        {proposal.status === 'draft' && (
          <button
            onClick={() => handleStatusUpdate('pending_review')}
            disabled={actionLoading}
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50 text-sm font-medium"
          >
            {t('proposals.submitForReview', 'Submit for Review')}
          </button>
        )}
        {proposal.status !== 'archived' && (
          <button
            onClick={handleArchive}
            disabled={actionLoading}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 text-sm font-medium"
          >
            {t('proposals.archive', 'Archive')}
          </button>
        )}
        {/* DISABLED Execution Button — placeholder for future */}
        <button
          disabled
          className="px-4 py-2 bg-gray-100 text-gray-400 rounded cursor-not-allowed text-sm font-medium border border-gray-200"
          title={t('proposals.executeUnavailableTitle', 'Execution is not available in this version')}
        >
          {t('proposals.executeDisabled', 'Execute (Not Available)')}
        </button>
      </div>

      {/* Reject reason input */}
      {showRejectInput && (
        <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('proposals.rejectionReasonLabel', 'Rejection reason (optional)')}
          </label>
          <textarea
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            rows={3}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => handleStatusUpdate('rejected')}
              disabled={actionLoading}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
            >
              {t('proposals.confirmReject', 'Confirm Rejection')}
            </button>
            <button
              onClick={() => setShowRejectInput(false)}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
            >
              {t('proposals.cancel', 'Cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Safety Notice */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
        <strong>{t('proposals.safetyTitle', 'Safety Notice')}:</strong>{' '}
        {t('proposals.safetyMessage', 'This is an AI-generated proposal in the sandbox. Accepting it does NOT create real ERP records, post vouchers, or execute any business action. No financial data was changed.')}
      </div>
    </div>
  );
}
