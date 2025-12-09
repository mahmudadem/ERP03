import React, { useState } from 'react';
import { VoucherWizard } from '../components/VoucherWizard';
import { Button } from '../../../../components/ui/Button';
import { RequirePermission } from '../../../../components/auth/RequirePermission';

const VoucherTypeDesignerPage: React.FC = () => {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string | undefined>(undefined);

  const handleCreateNew = () => {
    setSelectedCode(undefined);
    setIsWizardOpen(true);
  };

  const handleEdit = (code: string) => {
    setSelectedCode(code);
    setIsWizardOpen(true);
  };

  if (isWizardOpen) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
        <div className="w-full max-w-6xl h-[90vh]">
            <VoucherWizard initialCode={selectedCode} onClose={() => setIsWizardOpen(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Voucher Types</h1>
        <RequirePermission permission="designer.vouchers.modify">
          <Button variant="primary" onClick={handleCreateNew}>
            + New Voucher Type
          </Button>
        </RequirePermission>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {/* Placeholder for list items - would use VoucherTypeRepository.list() */}
          <li className="px-6 py-4 hover:bg-gray-50 cursor-pointer" onClick={() => handleEdit('JOURNAL')}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-indigo-600 truncate">Journal Voucher</p>
                    <p className="text-sm text-gray-500">JOURNAL</p>
                </div>
                <div className="ml-2 flex-shrink-0 flex">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    Active
                    </span>
                </div>
            </div>
          </li>
          {/* More items... */}
        </ul>
      </div>
    </div>
  );
};

export default VoucherTypeDesignerPage;
