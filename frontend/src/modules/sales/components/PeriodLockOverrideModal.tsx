import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { useTranslation } from 'react-i18next';

interface PeriodLockOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentDate: string;
  lockedThroughDate: string;
  onConfirm: (reason: string) => void;
}

export const PeriodLockOverrideModal: React.FC<PeriodLockOverrideModalProps> = ({
  isOpen,
  onClose,
  documentDate,
  lockedThroughDate,
  onConfirm,
}) => {
  const { t } = useTranslation('common');
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    if (reason.trim()) {
      onConfirm(reason.trim());
      setReason('');
    }
  };

  const handleClose = () => {
    setReason('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('sales.periodLock.overrideTitle', 'Override Period Lock')}>
      <div className="space-y-4">
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            {t('sales.periodLock.overrideWarning', 'This document date falls within a locked accounting period. Posting requires an override reason.')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">{t('sales.periodLock.documentDate', 'Document Date')}:</span>
            <p className="font-medium">{documentDate}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">{t('sales.periodLock.lockedThrough', 'Locked Through')}:</span>
            <p className="font-medium">{lockedThroughDate}</p>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            {t('sales.periodLock.overrideReason', 'Override Reason')} <span className="text-red-500">*</span>
          </label>
          <textarea
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 min-h-[80px]"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('sales.periodLock.reasonPlaceholder', 'Explain why this document needs to be posted to a locked period...')}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={handleClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button variant="primary" onClick={handleConfirm} disabled={!reason.trim()}>
            {t('sales.periodLock.overrideAndPost', 'Override & Post')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
