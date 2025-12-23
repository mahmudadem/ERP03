import React, { useState, useMemo } from 'react';
import { accountingApi } from '../../../api/accountingApi';
import { AccountSelector } from './AccountSelector';
import { errorHandler } from '../../../services/errorHandler';

interface PaymentAllocation {
  payToAccountId: string;
  amount: number;
  notes: string;
}

interface PaymentFormProps {
  companyId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const PaymentVoucherForm: React.FC<PaymentFormProps> = ({
  companyId,
  onSuccess,
  onCancel
}) => {
  const [payFromAccountId, setPayFromAccountId] = useState('');
  const [description, setDescription] = useState('');
  const [allocations, setAllocations] = useState<PaymentAllocation[]>([
    { payToAccountId: '', amount: 0, notes: '' }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-calculate total from allocations
  const totalAmount = useMemo(() => {
    return allocations.reduce((sum, alloc) => sum + Number(alloc.amount || 0), 0);
  }, [allocations]);

  const handleAddAllocation = () => {
    setAllocations([...allocations, { payToAccountId: '', amount: 0, notes: '' }]);
  };

  const handleRemoveAllocation = (index: number) => {
    if (allocations.length > 1) {
      setAllocations(allocations.filter((_, i) => i !== index));
    }
  };

  const handleAllocationChange = (index: number, field: keyof PaymentAllocation, value: any) => {
    const updated = [...allocations];
    updated[index] = { ...updated[index], [field]: value };
    setAllocations(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Get local date in YYYY-MM-DD format
      const today = new Date();
      const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      const payload = {
        type: 'payment',
        date: localDate,
        payFromAccountId,
        currency: 'USD',
        exchangeRate: 1,
        totalAmount,
        description,
        lines: allocations.filter(a => a.payToAccountId && a.amount > 0)
      };

      const result = await accountingApi.createVoucher(payload);
      
      errorHandler.showSuccess(`Payment voucher created successfully!\nVoucher #: ${result.voucherNo || result.id}\nDate: ${localDate}\nAmount: $${totalAmount.toFixed(2)}`);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create payment voucher');
      errorHandler.showError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="payment-voucher-form">
      <h2>New Payment Voucher</h2>
      
      {error && (
        <div className="error-message" style={{ color: 'red', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Header Section */}
        <div className="form-section">
          <h3>Payment Header</h3>
          
          <AccountSelector
            value={payFromAccountId}
            onChange={setPayFromAccountId}
            label="Pay From Account"
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

        {/* Allocations Section */}
        <div className="form-section">
          <h3>Payment Allocations</h3>
          
          <table className="allocations-table">
            <thead>
              <tr>
                <th>Pay To Account *</th>
                <th>Amount *</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map((alloc, index) => (
                <tr key={index}>
                  <td>
                    <AccountSelector
                      value={alloc.payToAccountId}
                      onChange={(id) => handleAllocationChange(index, 'payToAccountId', id)}
                      label=""
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={alloc.amount || ''}
                      onChange={(e) => handleAllocationChange(index, 'amount', Number(e.target.value))}
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={alloc.notes}
                      onChange={(e) => handleAllocationChange(index, 'notes', e.target.value)}
                      placeholder="Notes (e.g., Invoice #)"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleRemoveAllocation(index)}
                      disabled={allocations.length === 1}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button type="button" onClick={handleAddAllocation} className="add-allocation-btn">
            + Add Allocation
          </button>
        </div>

        {/* Summary Section */}
        <div className="form-section summary-section">
          <h3>Summary</h3>
          <div className="summary-row">
            <span>Total Amount (USD):</span>
            <strong>{totalAmount.toFixed(2)}</strong>
          </div>
        </div>

        {/* Actions */}
        <div className="form-actions">
          <button type="button" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button type="submit" disabled={loading || !payFromAccountId || totalAmount === 0}>
            {loading ? 'Saving...' : 'Save as Draft'}
          </button>
        </div>
      </form>

      <style>{`
        .payment-voucher-form {
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
        .allocations-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 1rem;
        }
        .allocations-table th,
        .allocations-table td {
          padding: 0.5rem;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }
        .allocations-table th {
          background: #f0f0f0;
          font-weight: 600;
        }
        .allocations-table input {
          width: 100%;
          padding: 0.4rem;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        .add-allocation-btn {
          background: #4CAF50;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          cursor: pointer;
        }
        .add-allocation-btn:hover {
          background: #45a049;
        }
        .summary-section {
          background: #e8f5e9;
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
