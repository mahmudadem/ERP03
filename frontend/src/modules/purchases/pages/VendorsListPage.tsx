import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { PartyDTO, sharedApi } from '../../../api/sharedApi';

const VendorsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState<PartyDTO[]>([]);
  const [loading, setLoading] = useState(false);

  const loadVendors = async () => {
    try {
      setLoading(true);
      const result = await sharedApi.listParties({ role: 'VENDOR' });
      setVendors(result || []);
    } catch (error) {
      console.error('Failed to load vendors', error);
      setVendors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVendors();
  }, []);

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Vendors</h1>
        <button
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          onClick={() => navigate('/purchases/vendors/new')}
          type="button"
        >
          Add Vendor
        </button>
      </div>

      <Card className="p-6">
        {loading ? (
          <div className="text-sm text-slate-500">Loading vendors...</div>
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
                {vendors.map((vendor) => (
                  <tr
                    key={vendor.id}
                    className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                    onClick={() => navigate(`/purchases/vendors/${vendor.id}`)}
                  >
                    <td className="py-2">{vendor.code}</td>
                    <td className="py-2">{vendor.displayName}</td>
                    <td className="py-2">{vendor.phone || '-'}</td>
                    <td className="py-2">{vendor.email || '-'}</td>
                    <td className="py-2">{vendor.active ? 'ACTIVE' : 'INACTIVE'}</td>
                  </tr>
                ))}
                {vendors.length === 0 && (
                  <tr>
                    <td className="py-6 text-center text-slate-500" colSpan={5}>
                      No vendors found
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

export default VendorsListPage;
