import React, { useState, useMemo } from 'react';
import { AmountInput } from './shared/AmountInput';
import { accountingApi } from '../../../api/accountingApi';
import { AccountSelectorSimple } from './AccountSelectorSimple';
import { errorHandler } from '../../../services/errorHandler';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { getCompanyToday, formatCompanyDate } from '../../../utils/dateUtils';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';

interface ReceiptSource {
  receiveFromAccountId: string;
  amount: number;
  notes: string;
}

interface ReceiptFormProps {
  companyId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const ReceiptVoucherForm: React.FC<ReceiptFormProps> = ({
  companyId,
  onSuccess,
  onCancel
}) => {
  const { settings } = useCompanySettings();
  const { company } = useCompanyAccess();
  const baseCurrency = company?.baseCurrency || '';
  const [depositToAccountId, setDepositToAccountId] = useState('');
  const [description, setDescription] = useState('');
  const [sources, setSources] = useState<ReceiptSource[]>([
    { receiveFromAccountId: '', amount: 0, notes: '' }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-calculate total from sources
  const totalAmount = useMemo(() => {
    return sources.reduce((sum, source) => sum + Number(source.amount || 0), 0);
  }, [sources]);

  const handleAddSource = () => {
    setSources([...sources, { receiveFromAccountId: '', amount: 0, notes: '' }]);
  };

  const handleRemoveSource = (index: number) => {
    if (sources.length > 1) {
      setSources(sources.filter((_, i) => i !== index));
    }
  };

  const handleSourceChange = (index: number, field: keyof ReceiptSource, value: any) => {
    const updated = [...sources];
    updated[index] = { ...updated[index], [field]: value };
    setSources(updated);
  };




  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Get company-local "today" date in YYYY-MM-DD format
      const localDate = getCompanyToday(settings);
      
      const payload = {
        type: 'receipt',
        date: localDate,
        depositToAccountId,
        currency: baseCurrency,
        exchangeRate: 1,
        totalAmount,
        description,
        lines: sources.filter(s => s.receiveFromAccountId && s.amount > 0)
      };

      const result = await accountingApi.createVoucher(payload);
      
      errorHandler.showSuccess(`Receipt voucher created successfully!\nVoucher #: ${result.voucherNo || result.id}\nDate: ${formatCompanyDate(localDate, settings)}\nAmount: ${baseCurrency} ${totalAmount.toFixed(2)}`);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create receipt voucher');
      errorHandler.showError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="receipt-voucher-form">
      <h2>New Receipt Voucher</h2>
      
      {error && (
        <div className="error-message" style={{ color: 'red', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Header Section */}
        <div className="form-section">
          <h3>Receipt Header</h3>
          
          <AccountSelectorSimple
            value={depositToAccountId}
            onChange={setDepositToAccountId}
            label="Deposit To Account"
            required
          />

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        {/* Sources Section */}
        <div className="form-section">
          <h3>Receipt Sources</h3>
          
          <table className="sources-table">
            <thead>
              <tr>
                <th>Receive From Account *</th>
                <th>Amount *</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source, index) => (
                <tr key={index}>
                  <td>
                    <AccountSelectorSimple
                      value={source.receiveFromAccountId}
                      onChange={(id) => handleSourceChange(index, 'receiveFromAccountId', id)}
                      label=""
                      required
                    />
                  </td>
                  <td>
                    <AmountInput
                        value={source.amount}
                        onChange={(val) => handleSourceChange(index, 'amount', val)}
                        placeholder=""
                        className="w-full p-2 text-sm border-none outline-none font-mono"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={source.notes}
                      onChange={(e) => handleSourceChange(index, 'notes', e.target.value)}
                      placeholder="Notes (e.g., Invoice #)"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleRemoveSource(index)}
                      disabled={sources.length === 1}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button type="button" onClick={handleAddSource} className="add-source-btn">
            + Add Source
          </button>
        </div>

        {/* Summary Section */}
        <div className="form-section summary-section">
          <h3>Summary</h3>
          <div className="summary-row">
            <span>Total Amount ({baseCurrency}):</span>
            <strong>{totalAmount.toFixed(2)}</strong>
          </div>
        </div>

        {/* Actions */}
        <div className="form-actions">
          <button type="button" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button type="submit" disabled={loading || !depositToAccountId || totalAmount === 0}>
            {loading ? 'Saving...' : 'Save as Draft'}
          </button>
        </div>
      </form>

      <style>{`
        .receipt-voucher-form {
          max-width: 900px;
          margin: 0 auto;
          padding: 2rem;
        }
        .form-section {
          background: #f9f9f9;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
          border-radius: 8px;
        }
        .form-section h3 {
          margin-top: 0;
          margin-bottom: 1rem;
          color: #333;
        }
        .form-group {
          margin-bottom: 1rem;
        }
        .form-group label {
          display: block;
          margin-bottom: 0.25rem;
          font-weight: 500;
          color: #555;
        }
        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        .sources-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 1rem;
        }
        .sources-table th,
        .sources-table td {
          padding: 0.5rem;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }
        .sources-table th {
          background: #f0f0f0;
          font-weight: 600;
        }
        .sources-table input {
          width: 100%;
          padding: 0.4rem;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        .add-source-btn {
          background: #4CAF50;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          cursor: pointer;
        }
        .add-source-btn:hover {
          background: #45a049;
        }
        .summary-section {
          background: #e3f2fd;
        }
        .summary-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
          font-size: 16px;
        }
        .form-actions {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
        }
        .form-actions button {
          padding: 0.75rem 1.5rem;
          border-radius: 4px;
          border: none;
          cursor: pointer;
          font-size: 14px;
        }
        .form-actions button[type="submit"] {
          background: #2196F3;
          color: white;
        }
        .form-actions button[type="submit"]:hover:not(:disabled) {
          background: #1976D2;
        }
        .form-actions button[type="submit"]:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
        .form-actions button[type="button"] {
          background: #f5f5f5;
          color: #333;
        }
        .error-message {
          padding: 1rem;
          background: #ffebee;
          border-left: 4px solid #f44336;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
};
