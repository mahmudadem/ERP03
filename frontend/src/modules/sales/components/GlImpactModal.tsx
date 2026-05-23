import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../components/ui/Modal';
import { salesAuditApi, PostingLog, Voucher } from '../../../api/salesAuditApi';

interface GlImpactModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceId: string;
  sourceLabel?: string;
}

const fmt = (n: number) => n.toFixed(2);

export const GlImpactModal: React.FC<GlImpactModalProps> = ({
  isOpen,
  onClose,
  sourceId,
  sourceLabel,
}) => {
  const { t } = useTranslation('common');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postingLogs, setPostingLogs] = useState<PostingLog[]>([]);
  const [voucherMap, setVoucherMap] = useState<Record<string, Voucher>>({});

  useEffect(() => {
    if (!isOpen || !sourceId) return;

    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setPostingLogs([]);
      setVoucherMap({});

      try {
        const logs = await salesAuditApi.getPostingLogsBySource(sourceId);
        const logsArray = Array.isArray(logs) ? logs : [];
        if (cancelled) return;
        setPostingLogs(logsArray);

        const allVoucherIds = Array.from(
          new Set(logsArray.flatMap((log) => log.voucherIds))
        );

        if (allVoucherIds.length > 0) {
          const results = await Promise.allSettled(
            allVoucherIds.map((id) => salesAuditApi.getVoucherById(id))
          );
          if (cancelled) return;
          const map: Record<string, Voucher> = {};
          results.forEach((result, idx) => {
            if (result.status === 'fulfilled') {
              map[allVoucherIds[idx]] = result.value;
            }
          });
          setVoucherMap(map);
        }
      } catch (err: any) {
        if (cancelled) return;
        setError(
          err?.response?.data?.error?.message ||
            err?.response?.data?.message ||
            err?.message ||
            t('sales.glImpact.loadError', 'Failed to load GL impact data.')
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [isOpen, sourceId, t]);

  const title = sourceLabel
    ? `${t('sales.glImpact.title', 'GL Impact')} — ${sourceLabel}`
    : t('sales.glImpact.title', 'GL Impact');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="max-h-[70vh] overflow-y-auto space-y-5 pr-1">
        {loading && (
          <p className="text-sm text-slate-500">{t('common.loading', 'Loading...')}</p>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && postingLogs.length === 0 && (
          <p className="text-sm text-slate-500">
            {t('sales.glImpact.noImpact', 'No GL impact recorded — this document has not been posted yet.')}
          </p>
        )}

        {!loading && !error && postingLogs.map((log) => (
          <div key={log.id} className="space-y-4">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>
                <span className="font-medium text-slate-700">{t('sales.glImpact.strategy', 'Strategy')}:</span>{' '}
                {log.strategy}
              </span>
              <span>
                <span className="font-medium text-slate-700">{t('sales.glImpact.posted', 'Posted')}:</span>{' '}
                {new Date(log.postedAt).toLocaleString()}
              </span>
              {log.sourceDocNumber && (
                <span>
                  <span className="font-medium text-slate-700">{t('sales.glImpact.docNumber', 'Doc#')}:</span>{' '}
                  {log.sourceDocNumber}
                </span>
              )}
            </div>

            {log.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                  {t('sales.glImpact.warnings', 'Posting Warnings')}
                </p>
                {log.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-700">
                    {w}
                  </p>
                ))}
              </div>
            )}

            {log.voucherIds.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {t('sales.glImpact.journalEntries', 'Journal Entries')}
                </p>
                {log.voucherIds.map((vid) => {
                  const voucher = voucherMap[vid];
                  if (!voucher) {
                    return (
                      <p key={vid} className="text-xs text-slate-400">
                        {t('sales.glImpact.voucherNotLoaded', 'Voucher {{id}} — not loaded', { id: vid })}
                      </p>
                    );
                  }
                  return (
                    <div
                      key={vid}
                      className="mb-3 rounded-lg border border-slate-200 overflow-hidden"
                    >
                      <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
                        <span className="text-xs font-semibold text-slate-700">
                          {voucher.voucherNo}
                        </span>
                        <span className="text-xs text-slate-500">
                          {voucher.date} &mdash; {voucher.type}
                        </span>
                      </div>
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-white">
                            <th className="py-1.5 pl-3 text-left font-medium text-slate-600">
                              {t('sales.glImpact.account', 'Account')}
                            </th>
                            <th className="py-1.5 pr-3 text-right font-medium text-slate-600">
                              {t('sales.glImpact.debit', 'Debit')}
                            </th>
                            <th className="py-1.5 pr-3 text-right font-medium text-slate-600">
                              {t('sales.glImpact.credit', 'Credit')}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {voucher.lines.map((line) => (
                            <tr
                              key={line.lineNo}
                              className="border-b border-slate-100"
                            >
                              <td className="py-1.5 pl-3 text-slate-700">
                                {line.accountId}
                              </td>
                              <td className="py-1.5 pr-3 text-right text-slate-700">
                                {line.debitAmount > 0
                                  ? fmt(line.debitAmount)
                                  : ''}
                              </td>
                              <td className="py-1.5 pr-3 text-right text-slate-700">
                                {line.creditAmount > 0
                                  ? fmt(line.creditAmount)
                                  : ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-slate-300 bg-slate-50">
                            <td className="py-1.5 pl-3 font-semibold text-slate-700">
                              {t('sales.glImpact.total', 'Total')}
                            </td>
                            <td className="py-1.5 pr-3 text-right font-semibold text-slate-700">
                              {fmt(voucher.totalDebit)}
                            </td>
                            <td className="py-1.5 pr-3 text-right font-semibold text-slate-700">
                              {fmt(voucher.totalCredit)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })}
              </div>
            )}

            {log.decisions.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {t('sales.glImpact.accountResolution', 'Account Resolution')}
                </p>
                <div className="space-y-3">
                  {log.decisions.map((decision) => {
                    const accountEntries = Object.entries(decision.accounts).filter(
                      ([, v]) => v !== undefined && v !== null
                    ) as [string, { resolvedId: string; fallbackLevel: string }][];

                    return (
                      <div
                        key={decision.lineNo}
                        className="rounded-lg border border-slate-200 px-3 py-2"
                      >
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-700">
                            {t('sales.glImpact.line', 'Line')} {decision.lineNo}
                          </span>
                          {decision.itemId && (
                            <span className="text-xs text-slate-500">
                              {t('sales.glImpact.item', 'Item')}: {decision.itemId}
                            </span>
                          )}
                          {decision.cogsPostingStatus && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                              COGS: {decision.cogsPostingStatus}
                            </span>
                          )}
                        </div>
                        {decision.note && (
                          <p className="mb-1.5 text-xs italic text-slate-500">
                            {decision.note}
                          </p>
                        )}
                        {accountEntries.length > 0 && (
                          <table className="min-w-full text-xs">
                            <thead>
                              <tr className="border-b border-slate-100">
                                <th className="pb-1 text-left font-medium text-slate-500">
                                  {t('sales.glImpact.role', 'Role')}
                                </th>
                                <th className="pb-1 text-left font-medium text-slate-500">
                                  {t('sales.glImpact.account', 'Account')}
                                </th>
                                <th className="pb-1 text-left font-medium text-slate-500">
                                  {t('sales.glImpact.resolvedVia', 'Resolved via')}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {accountEntries.map(([role, ra]) => (
                                <tr key={role} className="border-b border-slate-50">
                                  <td className="py-0.5 pr-3 capitalize text-slate-600">
                                    {role}
                                  </td>
                                  <td className="py-0.5 pr-3 font-mono text-slate-700">
                                    {ra.resolvedId}
                                  </td>
                                  <td className="py-0.5 text-slate-500">
                                    {ra.fallbackLevel}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
};
