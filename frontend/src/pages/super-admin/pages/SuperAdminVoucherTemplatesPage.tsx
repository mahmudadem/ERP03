import React, { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { superAdminVoucherTypesApi } from '../../../api/superAdmin';
import { VoucherTypeDefinition } from '../../../designer-engine/types/VoucherTypeDefinition';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export const SuperAdminVoucherTemplatesPage: React.FC = () => {
  const { t } = useTranslation('common');
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
        <h1 className="text-2xl font-bold text-gray-900">{t('superAdmin.voucherTemplates.title')}</h1>
        <Button onClick={() => navigate('new')}>{t('superAdmin.voucherTemplates.actions.createTemplate')}</Button>
      </div>

      {loading ? (
        <div>{t('superAdmin.voucherTemplates.loading')}</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('superAdmin.voucherTemplates.columns.name')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('superAdmin.voucherTemplates.columns.code')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('superAdmin.voucherTemplates.columns.module')}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('superAdmin.voucherTemplates.columns.actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {templates.map((template) => (
                <tr key={template.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{template.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{template.code}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{template.module}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                      onClick={() => template.id && navigate(template.id)}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                    >
                      {t('superAdmin.voucherTemplates.actions.edit')}
                    </button>
                  </td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                    {t('superAdmin.voucherTemplates.empty')}
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
