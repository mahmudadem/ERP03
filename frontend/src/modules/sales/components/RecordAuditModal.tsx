import React, { useEffect, useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { useTranslation } from 'react-i18next';
import { salesAuditApi, RecordChangeLog, FieldChange } from '../../../api/salesAuditApi';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';

interface RecordAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: string;
  entityId: string;
}

export const RecordAuditModal: React.FC<RecordAuditModalProps> = ({ isOpen, onClose, entityType, entityId }) => {
  const { t } = useTranslation('common');
  const { companyId } = useCompanyAccess();
  const [logs, setLogs] = useState<RecordChangeLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !companyId) return;
    const fetchLogs = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await salesAuditApi.getRecordAuditLog(entityType, entityId);
        setLogs(data);
      } catch (err: any) {
        setError(err?.message || 'Failed to load audit log');
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [isOpen, companyId, entityType, entityId]);

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('sales.audit.historyTitle', 'Change History')}>
      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        {loading && (
          <div className="text-center py-8 text-gray-500">{t('common.loading', 'Loading...')}</div>
        )}
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}
        {!loading && !error && logs.length === 0 && (
          <div className="text-center py-8 text-gray-500">{t('sales.audit.noChanges', 'No changes recorded yet.')}</div>
        )}
        {!loading && !error && logs.map((log) => (
          <div key={log.id} className="border rounded-lg dark:border-gray-700 overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {new Date(log.timestamp).toLocaleString()} — {log.userEmail || log.userId}
              </span>
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                {log.action}
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  <th className="text-left px-4 py-1.5 text-gray-500 dark:text-gray-400 font-medium">{t('sales.audit.field', 'Field')}</th>
                  <th className="text-left px-4 py-1.5 text-gray-500 dark:text-gray-400 font-medium">{t('sales.audit.before', 'Before')}</th>
                  <th className="text-left px-4 py-1.5 text-gray-500 dark:text-gray-400 font-medium">{t('sales.audit.after', 'After')}</th>
                </tr>
              </thead>
              <tbody>
                {log.changes.map((change: FieldChange, idx: number) => (
                  <tr key={idx} className="border-b dark:border-gray-700 last:border-0">
                    <td className="px-4 py-1.5 font-mono text-xs">{change.field}</td>
                    <td className="px-4 py-1.5 text-red-600 dark:text-red-400 text-xs truncate max-w-[200px]" title={formatValue(change.before)}>
                      {formatValue(change.before)}
                    </td>
                    <td className="px-4 py-1.5 text-green-600 dark:text-green-400 text-xs truncate max-w-[200px]" title={formatValue(change.after)}>
                      {formatValue(change.after)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </Modal>
  );
};
