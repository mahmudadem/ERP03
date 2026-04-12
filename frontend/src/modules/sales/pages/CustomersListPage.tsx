
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PartyDTO, sharedApi } from '../../../api/sharedApi';
import { Card } from '../../../components/ui/Card';
import { useWindowManager } from '../../../context/WindowManagerContext';
import { useUserPreferences } from '../../../hooks/useUserPreferences';

const CustomersListPage: React.FC = () => {
  const navigate = useNavigate();
  const { openWindow } = useWindowManager();
  const { uiMode } = useUserPreferences();
  const [customers, setCustomers] = useState<PartyDTO[]>([]);
  const [loading, setLoading] = useState(false);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const result = await sharedApi.listParties({ role: 'CUSTOMER' });
      setCustomers(result || []);
    } catch (error) {
      console.error('Failed to load customers', error);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleCustomerClick = (customer: PartyDTO) => {
    if (uiMode === 'windows') {
      openWindow({
        type: 'party',
        title: `Customer: ${customer.displayName}`,
        data: { partyId: customer.id, role: 'CUSTOMER' },
        size: { width: 950, height: 650 }
      });
    } else {
      navigate(`/sales/customers/${customer.id}`);
    }
  };

  const handleAddCustomer = () => {
    if (uiMode === 'windows') {
       openWindow({
         type: 'party',
         title: 'New Customer',
         data: { partyId: 'new', role: 'CUSTOMER' },
         size: { width: 950, height: 650 }
       });
    } else {
       navigate('/sales/customers/new');
    }
  };

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Customers</h1>
        <button
          className="rounded bg-slate-900 px-5 py-2 text-xs font-bold text-white shadow-lg hover:bg-slate-800 transition-all uppercase tracking-widest"
          onClick={handleAddCustomer}
          type="button"
        >
          Add Customer
        </button>
      </div>

      <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800 shadow-xl">
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500 italic animate-pulse">Syncing Master Records...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3 text-left font-black text-slate-400 uppercase tracking-widest">Code</th>
                  <th className="px-6 py-3 text-left font-black text-slate-400 uppercase tracking-widest">Display Name</th>
                  <th className="px-6 py-3 text-left font-black text-slate-400 uppercase tracking-widest">Roles</th>
                  <th className="px-6 py-3 text-left font-black text-slate-400 uppercase tracking-widest">Phone</th>
                  <th className="px-6 py-3 text-left font-black text-slate-400 uppercase tracking-widest">Email</th>
                  <th className="px-6 py-3 text-left font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                    onClick={() => handleCustomerClick(customer)}
                  >
                    <td className="px-6 py-4 font-mono font-bold text-blue-600">{customer.code}</td>
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">{customer.displayName}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {(customer.roles || []).map((role) => (
                          <span
                            key={role}
                            className="bg-slate-100 dark:bg-slate-800 text-slate-500 rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter"
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{customer.phone || '-'}</td>
                    <td className="px-6 py-4 text-slate-500">{customer.email || '-'}</td>
                    <td className="px-6 py-4 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${customer.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                            {customer.active ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr>
                    <td className="py-20 text-center text-slate-400 font-medium" colSpan={6}>
                      No Customer records found in directory.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default CustomersListPage;
