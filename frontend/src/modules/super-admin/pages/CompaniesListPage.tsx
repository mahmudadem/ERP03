import { useEffect, useState } from 'react';
import { superAdminApi, SuperAdminCompany } from '../../../api/superAdmin';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { errorHandler } from '../../../services/errorHandler';

export default function CompaniesListPage() {
  const [companies, setCompanies] = useState<SuperAdminCompany[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const data = await superAdminApi.getAllCompanies();
      setCompanies(data);
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleImpersonate = async (companyId: string) => {
    if (!window.confirm('Start impersonating this company?')) return;
    try {
      await superAdminApi.startImpersonation(companyId);
      errorHandler.showSuccess('Impersonation started. Redirecting...');
      window.location.href = '/';
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">All Companies</h1>
        <Button variant="ghost" size="sm" onClick={loadCompanies} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      <Card className="overflow-hidden">
        {loading && companies.length === 0 ? (
          <div className="p-6 text-gray-500">Loading companies...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner UID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {companies.map((company) => (
                <tr key={company.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{company.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{company.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{company.ownerUid}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {company.createdAt ? new Date(company.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <Button variant="secondary" size="sm" onClick={() => handleImpersonate(company.id)}>
                      Impersonate
                    </Button>
                  </td>
                </tr>
              ))}
              {companies.length === 0 && !loading && (
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-500" colSpan={5}>
                    No companies found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
