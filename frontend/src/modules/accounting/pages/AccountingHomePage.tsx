
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';

const AccountingHomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
         <h1 className="text-2xl font-bold text-gray-800">Accounting Overview</h1>
         <Button onClick={() => navigate('/accounting/vouchers/new')}>+ New Voucher</Button>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer border-t-4 border-blue-500" onClick={() => navigate('/accounting/vouchers')}>
            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Transactions</h3>
            <p className="text-2xl font-bold text-gray-800">Vouchers</p>
            <p className="text-sm text-gray-400 mt-2">Invoices, Bills, & Journals</p>
         </Card>

         <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer border-t-4 border-purple-500" onClick={() => navigate('/accounting/reports/trial-balance')}>
            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Reporting</h3>
            <p className="text-2xl font-bold text-gray-800">Trial Balance</p>
            <p className="text-sm text-gray-400 mt-2">View Financial Standing</p>
         </Card>

         <Card className="p-6 border-dashed border-2 bg-gray-50 flex flex-col justify-center items-center text-center">
            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Configuration</h3>
            <p className="text-lg font-bold text-gray-700">Chart of Accounts</p>
            <Button variant="ghost" size="sm" className="mt-2 text-blue-600">Manage Accounts &rarr;</Button>
         </Card>
       </div>
    </div>
  );
};

export default AccountingHomePage;
