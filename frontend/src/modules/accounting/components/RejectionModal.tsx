import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { AlertCircle } from 'lucide-react';

interface RejectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title?: string;
}

export const RejectionModal: React.FC<RejectionModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm,
  title = "Reject Voucher"
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError(true);
      return;
    }
    onConfirm(reason);
    setReason('');
    setError(false);
  };

  const handleClose = () => {
    setReason('');
    setError(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                You are about to reject this voucher. This action cannot be undone. 
                Please provide a reason for the audit trail.
              </p>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
            Rejection Reason <span className="text-red-500">*</span>
          </label>
          <div className="mt-1">
            <textarea
              id="reason"
              name="reason"
              rows={3}
              className={`shadow-sm focus:ring-red-500 focus:border-red-500 block w-full sm:text-sm border rounded-md p-2 ${
                error ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="e.g. Missing supporting documentation, Incorrect cost center..."
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (e.target.value.trim()) setError(false);
              }}
            />
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-600">
              A valid reason is required for rejection.
            </p>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="mr-3 inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:text-sm"
          >
            Reject Voucher
          </button>
        </div>
      </form>
    </Modal>
  );
};
