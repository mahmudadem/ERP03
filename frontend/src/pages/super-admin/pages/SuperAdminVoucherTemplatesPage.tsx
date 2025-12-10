import React, { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { superAdminVoucherTypesApi } from '../../../api/superAdmin';
import { VoucherTypeDefinition } from '../../../designer-engine/types/VoucherTypeDefinition';
import { useNavigate } from 'react-router-dom';

export const SuperAdminVoucherTemplatesPage: React.FC = () => {
  const [templates, setTemplates] = useState<VoucherTypeDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await superAdminVoucherTypesApi.list();
      setTemplates(data);
    } catch (error) {
      console.error('Failed to load templates', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">System Voucher Templates</h1>
        <Button onClick={() => navigate('new')}>Create Template</Button>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Module</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {templates.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{t.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.code}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.module}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                      onClick={() => t.id && navigate(t.id)}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                    No system templates found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
