
/**
 * VoucherTable.tsx
 */
import React from 'react';
import { VoucherListItem } from '../../../types/accounting/VoucherListTypes';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

interface Props {
  vouchers: VoucherListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  onPageChange: (page: number) => void;
  onRowClick?: (id: string) => void;
}

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'approved': return 'success';
    case 'pending': return 'warning';
    case 'draft': return 'default';
    case 'cancelled': return 'error';
    case 'locked': return 'info';
    default: return 'default';
  }
};

export const VoucherTable: React.FC<Props> = ({ 
  vouchers = [], 
  pagination, 
  onPageChange,
  onRowClick
}) => {
  const safeVouchers = Array.isArray(vouchers) ? vouchers : [];
  const pageInfo = pagination || { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 };
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Debit</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Credit</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ref</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {safeVouchers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500 text-sm">
                  No vouchers found matching your filters.
                </td>
              </tr>
            ) : (
              safeVouchers.map((voucher) => (
                <tr 
                  key={voucher.id} 
                  onClick={() => onRowClick && onRowClick(voucher.id)}
                  className="hover:bg-blue-50 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(voucher.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                    {voucher.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                      {voucher.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant={getStatusVariant(voucher.status)}>
                      {voucher.status.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-mono">
                    {voucher.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })} {voucher.currency}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-mono">
                    {voucher.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })} {voucher.currency}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate max-w-[150px]">
                    {voucher.reference || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
         <div className="text-sm text-gray-500">
            Showing page <span className="font-medium">{pageInfo.page}</span> of <span className="font-medium">{pageInfo.totalPages || 1}</span> ({pageInfo.totalItems} items)
         </div>
         <div className="flex gap-2">
            <Button 
              variant="secondary" 
              size="sm" 
              disabled={pageInfo.page <= 1}
              onClick={() => onPageChange(pageInfo.page - 1)}
            >
              Previous
            </Button>
            <Button 
              variant="secondary" 
              size="sm" 
              disabled={pageInfo.page >= pageInfo.totalPages}
              onClick={() => onPageChange(pageInfo.page + 1)}
            >
              Next
            </Button>
         </div>
      </div>
    </div>
  );
};
