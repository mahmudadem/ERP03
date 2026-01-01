import React, { useState } from 'react';
import { X, AlertCircle, RotateCcw, RefreshCw } from 'lucide-react';
import { accountingApi, CorrectionMode, CorrectionRequest } from '../../../api/accountingApi';
import { useAuth } from '../../../context/AuthContext';
import { errorHandler } from '../../../services/errorHandler';

interface VoucherCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  voucherId: string;
  voucherNumber: string;
  originalVoucher: any;
  initialMode?: CorrectionMode;
  onSuccess: (result: any) => void;
}

export function VoucherCorrectionModal({
  isOpen,
  onClose,
  voucherId,
  voucherNumber,
  originalVoucher,
  initialMode = 'REVERSE_ONLY',
  onSuccess
}: VoucherCorrectionModalProps) {
  const { user } = useAuth();
  const [mode, setMode] = useState<CorrectionMode>(initialMode);
  const [reason, setReason] = useState('');
  const [dateStrategy, setDateStrategy] = useState<'original' | 'today' | 'custom'>('original');
  const [customDate, setCustomDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Replacement voucher data (pre-filled from original)
  const [replacementDate, setReplacementDate] = useState(originalVoucher?.date || '');
  const [replacementDesc, setReplacementDesc] = useState(originalVoucher?.description || '');
  const [replacementRef, setReplacementRef] = useState(originalVoucher?.reference || '');
  const [replacementLines, setReplacementLines] = useState(originalVoucher?.lines || []);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason.trim()) {
      errorHandler.showInfo('Please provide a reason for the correction');
      return;
    }

    setIsSubmitting(true);

    try {
      const request: CorrectionRequest = {
        correctionMode: mode,
        options: {
          reason: reason.trim(),
          reversalDate: dateStrategy === 'today' ? 'today' : 
                       dateStrategy === 'custom' ? customDate :
                       undefined,
          replaceStartsAsDraft: true
        }
      };

      if (mode === 'REVERSE_AND_REPLACE') {
        request.replacePayload = {
          date: replacementDate,
          description: replacementDesc,
          reference: replacementRef,
          lines: replacementLines.map((line: any) => ({
            accountId: line.account || line.accountId,
            debitFx: line.debitFx || line.debit,
            creditFx: line.creditFx || line.credit,
            side: line.side,
            memo: line.description || line.memo
          }))
        };
      }

      const result = await accountingApi.reverseAndReplaceVoucher(voucherId, request);
      
      errorHandler.showSuccess('voucherCorrected', {
        reversalId: result.reverseVoucherId,
        replacementId: result.replaceVoucherId || ''
      });

      onSuccess(result);
      onClose();
    } catch (error: any) {
      errorHandler.showError({
        code: 'VOUCHER_CORRECTION_FAILED',
        message: error.message || 'Failed to create correction',
        severity: 'error' as any
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLineChange = (index: number, field: string, value: any) => {
    const updated = [...replacementLines];
    updated[index] = { ...updated[index], [field]: value };
    setReplacementLines(updated);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10002]">
      <div className="bg-[var(--color-bg-primary)] rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Reverse & Replace Voucher
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Info */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" size={18} />
                <div className="text-sm text-blue-900 dark:text-blue-100">
                  <div className="font-medium mb-1">Correcting: Voucher #{voucherNumber}</div>
                  <div>This will create a reversal voucher that negates the original transaction.</div>
                </div>
              </div>
            </div>

            {/* Mode Selection */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                Correction Mode
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setMode('REVERSE_ONLY')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    mode === 'REVERSE_ONLY'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-[var(--color-border)] hover:border-primary-300'
                  }`}
                >
                  <RotateCcw className="mx-auto mb-2" size={24} />
                  <div className="font-medium">Reverse Only</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-1">
                    Cancel the transaction completely
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('REVERSE_AND_REPLACE')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    mode === 'REVERSE_AND_REPLACE'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-[var(--color-border)] hover:border-primary-300'
                  }`}
                >
                  <RefreshCw className="mx-auto mb-2" size={24} />
                  <div className="font-medium">Reverse & Replace</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-1">
                    Correct with a new voucher
                  </div>
                </button>
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                Reason for Correction <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                rows={3}
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-primary-500 outline-none"
                placeholder="Explain why this correction is needed..."
              />
            </div>

            {/* Date Strategy */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                Reversal Date
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="original"
                    checked={dateStrategy === 'original'}
                    onChange={(e) => setDateStrategy(e.target.value as any)}
                    className="mr-2"
                  />
                  <span className="text-sm">Use original date ({originalVoucher?.date})</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="today"
                    checked={dateStrategy === 'today'}
                    onChange={(e) => setDateStrategy(e.target.value as any)}
                    className="mr-2"
                  />
                  <span className="text-sm">Use today's date</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="custom"
                    checked={dateStrategy === 'custom'}
                    onChange={(e) => setDateStrategy(e.target.value as any)}
                    className="mr-2"
                  />
                  <span className="text-sm">Custom date:</span>
                  {dateStrategy === 'custom' && (
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="ml-2 px-2 py-1 border border-[var(--color-border)] rounded text-sm"
                    />
                  )}
                </label>
              </div>
            </div>

            {/* Replacement Form */}
            {mode === 'REVERSE_AND_REPLACE' && (
              <div className="border-t border-[var(--color-border)] pt-6">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
                  Replacement Voucher (Pre-filled from original)
                </h3>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
                        Date
                      </label>
                      <input
                        type="date"
                        value={replacementDate}
                        onChange={(e) => setReplacementDate(e.target.value)}
                        className="w-full px-3 py-2 border border-[var(--color-border)] rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
                        Reference
                      </label>
                      <input
                        type="text"
                        value={replacementRef}
                        onChange={(e) => setReplacementRef(e.target.value)}
                        className="w-full px-3 py-2 border border-[var(--color-border)] rounded text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={replacementDesc}
                      onChange={(e) => setReplacementDesc(e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--color-border)] rounded text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-2">
                      Lines (Edit amounts as needed)
                    </label>
                    <div className="border border-[var(--color-border)] rounded overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-[var(--color-bg-secondary)]">
                          <tr>
                            <th className="px-3 py-2 text-left">Account</th>
                            <th className="px-3 py-2 text-right">Debit</th>
                            <th className="px-3 py-2 text-right">Credit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {replacementLines.map((line: any, index: number) => (
                            <tr key={index} className="border-t border-[var(--color-border)]">
                              <td className="px-3 py-2">{line.accountName || line.account}</td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  value={line.debitFx || line.debit || ''}
                                  onChange={(e) => handleLineChange(index, 'debitFx', parseFloat(e.target.value) || 0)}
                                  className="w-full text-right px-2 py-1 border border-[var(--color-border)] rounded"
                                  step="0.01"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  value={line.creditFx || line.credit || ''}
                                  onChange={(e) => handleLineChange(index, 'creditFx', parseFloat(e.target.value) || 0)}
                                  className="w-full text-right px-2 py-1 border border-[var(--color-border)] rounded"
                                  step="0.01"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !reason.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Submit Correction'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
