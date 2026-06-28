import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { ShieldCheck } from 'lucide-react';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { CompanyUser, listUsers } from '../../../api/companyAdmin';
import { PosManagerOverrideAction, posApi } from '../../../api/posApi';
import { errorHandler } from '../../../services/errorHandler';

export interface ManagerOverrideValue {
  managerOverrideId: string;
  managerUserId: string;
  managerName?: string;
  reason: string;
  approvedAt: string;
  action: PosManagerOverrideAction;
}

interface ManagerOverrideCaptureProps {
  isOpen: boolean;
  action: PosManagerOverrideAction;
  title?: string;
  context?: Record<string, unknown>;
  onCancel: () => void;
  onApproved: (override: ManagerOverrideValue) => void;
}

const actionLabel = (action: PosManagerOverrideAction, t: any): string => {
  switch (action) {
    case 'VOID_LINE': return t('pos:managerOverride.actions.VOID_LINE', { defaultValue: 'Void line' });
    case 'PRICE_OVERRIDE': return t('pos:managerOverride.actions.PRICE_OVERRIDE', { defaultValue: 'Price override' });
    case 'DISCOUNT_OVERRIDE': return t('pos:managerOverride.actions.DISCOUNT_OVERRIDE', { defaultValue: 'Discount override' });
    case 'TAX_OVERRIDE': return t('pos:managerOverride.actions.TAX_OVERRIDE', { defaultValue: 'Tax override' });
    case 'RETURN': return t('pos:managerOverride.actions.RETURN', { defaultValue: 'Return' });
    case 'REPRINT': return t('pos:managerOverride.actions.REPRINT', { defaultValue: 'Reprint' });
    default: return action;
  }
};

const userLabel = (user: CompanyUser): string => {
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return name ? `${name} (${user.email})` : user.email || user.userId;
};

export const ManagerOverrideCapture: React.FC<ManagerOverrideCaptureProps> = ({
  isOpen,
  action,
  title,
  context,
  onCancel,
  onApproved,
}) => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [managerUserId, setManagerUserId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setReason('');
    setManagerUserId('');
    const load = async () => {
      try {
        setLoadingUsers(true);
        setUsers(await listUsers());
      } catch (err: any) {
        errorHandler.showError(err?.response?.data?.error?.message || err?.message || t('pos:managerOverride.errors.loadUsers', { defaultValue: 'Failed to load company users.' }));
      } finally {
        setLoadingUsers(false);
      }
    };
    void load();
  }, [isOpen]);

  const activeUsers = useMemo(
    () => users.filter((user) => user.status !== 'REMOVED' && user.status !== 'DISABLED'),
    [users]
  );

  const selectedManager = activeUsers.find((user) => user.userId === managerUserId);
  const selectedManagerName = selectedManager ? userLabel(selectedManager) : undefined;

  const onSubmit = async () => {
    if (!managerUserId) {
      toast.error(t('pos:managerOverride.managerRequired', { defaultValue: 'Select the approving manager.' }));
      return;
    }
    if (!reason.trim()) {
      toast.error(t('pos:managerOverride.reasonRequired', { defaultValue: 'Enter the approval reason.' }));
      return;
    }
    try {
      setSubmitting(true);
      const created = await posApi.createManagerOverride({
        action,
        managerUserId,
        managerName: selectedManagerName,
        reason: reason.trim(),
        context,
      });
      toast.success(t('pos:managerOverride.approved', { defaultValue: 'Manager approval captured.' }));
      onApproved({
        managerOverrideId: created.managerOverrideId,
        managerUserId: created.managerUserId,
        managerName: created.managerName,
        reason: created.reason,
        approvedAt: created.approvedAt,
        action: created.action,
      });
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error?.message || err?.message || t('pos:managerOverride.errors.capture', { defaultValue: 'Failed to capture manager approval.' }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      title={title || t('pos:managerOverride.title', { defaultValue: 'Manager approval' })}
      icon={<ShieldCheck className="h-5 w-5" />}
      tone="warning"
      isConfirming={submitting}
      onCancel={onCancel}
      onConfirm={onSubmit}
      confirmLabel={submitting
        ? t('common.saving', { defaultValue: 'Saving...' })
        : t('pos:managerOverride.capture', { defaultValue: 'Capture approval' })}
      cancelLabel={t('common.cancel', { defaultValue: 'Cancel' })}
      message={
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-slate-700">
            <span className="font-semibold">{t('pos:managerOverride.action', { defaultValue: 'Action' })}:</span>{' '}
            {actionLabel(action, t)}
          </div>
          <div>
            <label htmlFor="pos-manager-override-user" className="mb-1 block text-xs font-medium text-slate-600">
              {t('pos:managerOverride.manager', { defaultValue: 'Approving manager' })}
            </label>
            <select
              id="pos-manager-override-user"
              value={managerUserId}
              onChange={(event) => setManagerUserId(event.target.value)}
              disabled={loadingUsers || submitting}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 disabled:opacity-60"
            >
              <option value="">
                {loadingUsers
                  ? t('common.loading', { defaultValue: 'Loading...' })
                  : t('pos:managerOverride.selectManager', { defaultValue: 'Select manager' })}
              </option>
              {activeUsers.map((user) => (
                <option key={user.userId} value={user.userId}>
                  {userLabel(user)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pos-manager-override-reason" className="mb-1 block text-xs font-medium text-slate-600">
              {t('pos:managerOverride.reason', { defaultValue: 'Reason' })}
            </label>
            <textarea
              id="pos-manager-override-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              disabled={submitting}
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 disabled:opacity-60"
            />
          </div>
        </div>
      }
    />
  );
};

export default ManagerOverrideCapture;
