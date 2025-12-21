import React, { useState } from 'react';
import { PaymentVoucherForm } from '../components/PaymentVoucherForm';
import { ReceiptVoucherForm } from '../components/ReceiptVoucherForm';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';

type VoucherType = 'payment' | 'receipt' | null;

const NewVoucherFormsDemo: React.FC = () => {
  const [activeForm, setActiveForm] = useState<VoucherType>(null);
  const { companyId } = useCompanyAccess();
  const currentCompanyId = companyId || '';

  const handleSuccess = () => {
    alert('Voucher created successfully!');
    setActiveForm(null);
    // In production, refresh voucher list here
  };

  const handleCancel = () => {
    setActiveForm(null);
  };

  if (activeForm === 'payment') {
    return (
      <PaymentVoucherForm
        companyId={currentCompanyId}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    );
  }

  if (activeForm === 'receipt') {
    return (
      <ReceiptVoucherForm
        companyId={currentCompanyId}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <div className="new-voucher-demo">
      <div className="demo-header">
        <h1>New Voucher Forms — Corrected Architecture</h1>
        <p className="subtitle">
          Demonstrating one-to-many (Payment) and many-to-one (Receipt) structures
          with generic semantic field names and auto-calculated totals.
        </p>
      </div>

      <div className="form-selector">
        <div className="form-card" onClick={() => setActiveForm('payment')}>
          <div className="card-icon">💸</div>
          <h2>Payment Voucher</h2>
          <p className="card-description">
            One-to-Many Structure
          </p>
          <ul className="feature-list">
            <li>✓ Single source account (payFromAccountId)</li>
            <li>✓ Multiple allocations (payToAccountId)</li>
            <li>✓ Auto-calculated total</li>
            <li>✓ Multi-currency support</li>
          </ul>
          <button className="try-button">Try Payment Form →</button>
        </div>

        <div className="form-card" onClick={() => setActiveForm('receipt')}>
          <div className="card-icon">💰</div>
          <h2>Receipt Voucher</h2>
          <p className="card-description">
            Many-to-One Structure
          </p>
          <ul className="feature-list">
            <li>✓ Multiple sources (receiveFromAccountId)</li>
            <li>✓ Single destination (depositToAccountId)</li>
            <li>✓ Auto-calculated total</li>
            <li>✓ Multi-currency support</li>
          </ul>
          <button className="try-button">Try Receipt Form →</button>
        </div>
      </div>

      <div className="info-section">
        <h3>Architecture Highlights</h3>
        <div className="info-grid">
          <div className="info-item">
            <strong>Generic Semantic Fields:</strong>
            <p>No business-specific names like <code>vendorAccountId</code>.
            Uses <code>payFromAccountId</code>, <code>payToAccountId</code> instead.</p>
          </div>
          <div className="info-item">
            <strong>Auto-Balance:</strong>
            <p>Total amount calculated from line allocations/sources.
            Guarantees balanced vouchers.</p>
          </div>
          <div className="info-item">
            <strong>Multi-Currency:</strong>
            <p>Foreign currency (TRY) → Base currency (USD) conversion.
            Both amounts stored for audit trail.</p>
          </div>
          <div className="info-item">
            <strong>Unified Storage:</strong>
            <p>All vouchers stored as General Journal entries.
            Voucher type is UX concept only.</p>
          </div>
        </div>
      </div>

      <style>{`
        .new-voucher-demo {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }
        .demo-header {
          text-align: center;
          margin-bottom: 3rem;
        }
        .demo-header h1 {
          font-size: 2rem;
          color: #1a1a1a;
          margin-bottom: 0.5rem;
        }
        .subtitle {
          color: #666;
          font-size: 1.1rem;
        }
        .form-selector {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          margin-bottom: 3rem;
        }
        .form-card {
          background: white;
          border: 2px solid #e0e0e0;
          border-radius: 12px;
          padding: 2rem;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .form-card:hover {
          border-color: #2196F3;
          box-shadow: 0 4px 12px rgba(33, 150, 243, 0.2);
          transform: translateY(-2px);
        }
        .card-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }
        .form-card h2 {
          color: #333;
          margin-bottom: 0.5rem;
        }
        .card-description {
          color: #666;
          font-size: 0.9rem;
          margin-bottom: 1rem;
        }
        .feature-list {
          list-style: none;
          padding: 0;
          margin: 1rem 0;
        }
        .feature-list li {
          padding: 0.5rem 0;
          color: #555;
          font-size: 0.9rem;
        }
        .try-button {
          width: 100%;
          padding: 0.75rem;
          background: #2196F3;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 1rem;
          cursor: pointer;
          margin-top: 1rem;
        }
        .try-button:hover {
          background: #1976D2;
        }
        .info-section {
          background: #f5f5f5;
          padding: 2rem;
          border-radius: 12px;
        }
        .info-section h3 {
          margin-top: 0;
          margin-bottom: 1.5rem;
          color: #333;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }
        .info-item {
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
        }
        .info-item strong {
          display: block;
          color: #2196F3;
          margin-bottom: 0.5rem;
        }
        .info-item p {
          margin: 0;
          color: #666;
          line-height: 1.6;
        }
        .info-item code {
          background: #f0f0f0;
          padding: 0.2rem 0.4rem;
          border-radius: 3px;
          font-family: 'Courier New', monospace;
          font-size: 0.9em;
        }
      `}</style>
    </div>
  );
};

export default NewVoucherFormsDemo;
