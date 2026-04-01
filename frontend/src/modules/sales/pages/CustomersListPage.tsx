import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PartyDTO, sharedApi } from '../../../api/sharedApi';
import { Card } from '../../../components/ui/Card';

const CustomersListPage: React.FC = () => {
  const navigate = useNavigate();
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

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Customers</h1>
        <button
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          onClick={() => navigate('/sales/customers/new')}
          type="button"
        >
          Add Customer
        </button>
      </div>

      <Card className="p-6">
        {loading ? (
          <div className="text-sm text-slate-500">Loading customers...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2 text-left">Code</th>
                  <th className="py-2 text-left">Display Name</th>
                  <th className="py-2 text-left">Phone</th>
                  <th className="py-2 text-left">Email</th>
                  <th className="py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                    onClick={() => navigate(`/sales/customers/${customer.id}`)}
                  >
                    <td className="py-2">{customer.code}</td>
                    <td className="py-2">{customer.displayName}</td>
                    <td className="py-2">{customer.phone || '-'}</td>
                    <td className="py-2">{customer.email || '-'}</td>
                    <td className="py-2">{customer.active ? 'ACTIVE' : 'INACTIVE'}</td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr>
                    <td className="py-6 text-center text-slate-500" colSpan={5}>
                      No customers found
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
