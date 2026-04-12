
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PartyDTO, sharedApi } from '../../../api/sharedApi';
import { Card } from '../../../components/ui/Card';
import { useWindowManager } from '../../../context/WindowManagerContext';
import { useUserPreferences } from '../../../hooks/useUserPreferences';

const VendorsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { openWindow } = useWindowManager();
  const { uiMode } = useUserPreferences();
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

  const handleVendorClick = (vendor: PartyDTO) => {
    if (uiMode === 'windows') {
      openWindow({
        type: 'party',
        title: `Vendor: ${vendor.displayName}`,
        data: { partyId: vendor.id, role: 'VENDOR' },
        size: { width: 950, height: 650 }
      });
    } else {
      navigate(`/purchases/vendors/${vendor.id}`);
    }
  };

  const handleAddVendor = () => {
    if (uiMode === 'windows') {
       openWindow({
         type: 'party',
         title: 'New Vendor',
         data: { partyId: 'new', role: 'VENDOR' },
         size: { width: 950, height: 650 }
       });
    } else {
       navigate('/purchases/vendors/new');
    }
  };

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">Vendors (Suppliers)</h1>
        <button
          className="rounded bg-slate-900 px-5 py-2 text-xs font-bold text-white shadow-lg hover:bg-slate-800 transition-all uppercase tracking-widest"
          onClick={handleAddVendor}
          type="button"
        >
          Add Vendor
        </button>
      </div>

      <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800 shadow-xl">
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500 italic animate-pulse tracking-widest font-mono">Loading Supply Chain Records...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3 text-left font-black text-slate-400 uppercase tracking-widest">Code</th>
                  <th className="px-6 py-3 text-left font-black text-slate-400 uppercase tracking-widest">Display Name</th>
                  <th className="px-6 py-3 text-left font-black text-slate-400 uppercase tracking-widest">Phone</th>
                  <th className="px-6 py-3 text-left font-black text-slate-400 uppercase tracking-widest">Email</th>
                  <th className="px-6 py-3 text-left font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {vendors.map((vendor) => (
                  <tr
                    key={vendor.id}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                    onClick={() => handleVendorClick(vendor)}
                  >
                    <td className="px-6 py-4 font-mono font-bold text-indigo-600">{vendor.code}</td>
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">{vendor.displayName}</td>
                    <td className="px-6 py-4 text-slate-500">{vendor.phone || '-'}</td>
                    <td className="px-6 py-4 text-slate-500 font-medium italic">{vendor.email || '-'}</td>
                    <td className="px-6 py-4 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${vendor.active ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>
                            {vendor.active ? 'OPERATIONAL' : 'SUSPENDED'}
                        </span>
                    </td>
                  </tr>
                ))}
                {vendors.length === 0 && (
                  <tr>
                    <td className="py-20 text-center text-slate-400 font-medium" colSpan={5}>
                      No Vendor records identified.
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
