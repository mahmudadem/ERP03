/**
 * VouchersListPage.tsx
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useVouchersList } from '../../../hooks/useVouchersList';
import { VoucherFiltersBar } from '../components/VoucherFiltersBar';
import { VoucherTable } from '../components/VoucherTable';
import { Button } from '../../../components/ui/Button';

const VouchersListPage: React.FC = () => {
  const navigate = useNavigate();
  const { 
    vouchers, 
    filters, 
    setFilters, 
    pagination, 
    isLoading, 
    error 
  } = useVouchersList();

  const handleCreate = () => {
    // Default to Invoice for new creation, user can change later or we could show a modal selector here
    navigate('/accounting/vouchers/new?type=INV');
  };

  const handleRowClick = (id: string) => {
    navigate(`/accounting/vouchers/${id}`);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Vouchers</h1>
          <p className="text-sm text-gray-500 mt-1">Manage financial transactions</p>
        </div>
        <div className="flex gap-3">
           <Button onClick={handleCreate} className="shadow-sm">
             + New Voucher
           </Button>
        </div>
      </div>

      {/* Filters */}
      <VoucherFiltersBar 
        filters={filters} 
        onChange={setFilters} 
      />

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      {/* Content */}
      <div className={`transition-opacity duration-200 ${isLoading ? 'opacity-60 pointer-events-none' : ''}`}>
        <VoucherTable 
          vouchers={vouchers}
          pagination={pagination}
          onPageChange={(page) => setFilters({ page })}
          onRowClick={handleRowClick}
        />
      </div>
    </div>
  );
};

export default VouchersListPage;