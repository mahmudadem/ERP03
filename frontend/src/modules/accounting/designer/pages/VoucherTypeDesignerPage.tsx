import React, { useState, useEffect } from 'react';
import { Button } from '../../../../components/ui/Button';
import { voucherTypeRepository } from '../repositories/VoucherTypeRepository';
import { VoucherTypeDefinition } from '../../../../designer-engine/types/VoucherTypeDefinition';

/**
 * Designer V1 - Full Voucher Designer
 * 
 * Complete designer with all advanced features for voucher type configuration.
 * Uses canonical VoucherTypeDefinition (Schema V2) only.
 */

function VoucherTypeDesignerPage() {
  const [vouchers, setVouchers] = useState<VoucherTypeDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadVouchers();
  }, []);

  const loadVouchers = async () => {
    try {
      setLoading(true);
      setError(null);
      const allVouchers = await voucherTypeRepository.list();
      setVouchers(allVouchers || []);
    } catch (err: any) {
      console.error('Failed to load vouchers:', err);
      setError(err.message || 'Failed to load vouchers');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    // Navigate to AI Designer for creation
    window.location.href = '/#/accounting/ai-designer';
  };

  const handleEdit = (code: string) => {
    // For now, show info - full wizard integration coming in next phase
    const confirmed = window.confirm(
      `Edit "${code}"?\n\n` +
      `Full wizard editing will be available soon.\n` +
      `For now, use AI Designer for modifications.`
    );
    if (confirmed) {
      window.location.href = '/#/accounting/ai-designer';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-gray-500">Loading vouchers...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error: {error}</p>
          <Button variant="secondary" onClick={loadVouchers} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Voucher Designer V1</h1>
          <p className="text-sm text-gray-600 mt-1">
            Full-featured designer for advanced voucher type configuration
          </p>
        </div>
        <Button variant="primary" onClick={handleCreateNew}>
          + Create New
        </Button>
      </div>

      {vouchers && vouchers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No voucher types found</p>
          <Button variant="primary" onClick={handleCreateNew}>
            Create Your First Voucher Type
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {vouchers.map(voucher => (
            <div
              key={voucher.code}
              onClick={() => handleEdit(voucher.code)}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded">
                    {voucher.code?.substring(0, 2).toUpperCase() || 'VT'}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-blue-100 text-blue-700">
                    Schema V{voucher.schemaVersion}
                  </span>
                </div>
              </div>
              <h3 className="text-sm font-medium text-gray-900">{voucher.name}</h3>
              <p className="text-xs text-gray-500 mt-1">{voucher.code}</p>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{voucher.headerFields?.length || 0} fields</span>
                  <span>{voucher.module}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-blue-900 font-semibold mb-2">ℹ️ Designer V1 Status</h3>
        <p className="text-blue-800 text-sm">
          Designer V1 is the full-featured designer with wizard integration.
          For now, please use <strong>AI Designer</strong> at <code>/accounting/ai-designer</code> for creating and editing voucher types.
        </p>
      </div>
    </div>
  );
}

export default VoucherTypeDesignerPage;
