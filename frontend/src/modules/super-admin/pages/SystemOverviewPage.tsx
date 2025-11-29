
import { useEffect, useState } from 'react';
import { superAdminApi, SystemOverview } from '../../../api/superAdmin';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';

const statStyles = ['border-t-4 border-blue-500', 'border-t-4 border-green-500', 'border-t-4 border-purple-500', 'border-t-4 border-orange-500', 'border-t-4 border-amber-500'];

export default function SystemOverviewPage() {
  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const data = await superAdminApi.getSystemOverview();
      setOverview(data);
    } catch (error) {
      console.error('Failed to load system overview', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    { label: 'Total Users', value: overview?.totalUsers ?? 0 },
    { label: 'Total Companies', value: overview?.totalCompanies ?? 0 },
    { label: 'Total Vouchers', value: overview?.totalVouchers ?? 0 },
    { label: 'Inventory Items', value: overview?.totalInventoryItems ?? 0 },
    { label: 'Roles', value: overview?.totalRoles ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">System Overview</h1>
          <p className="text-sm text-gray-500 mt-1">High-level view of tenants and resources</p>
        </div>
        <Button variant="ghost" size="sm" onClick={loadOverview} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {loading && !overview && (
        <Card className="p-6">
          <div className="text-gray-500">Loading system overview...</div>
        </Card>
      )}

      {overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {stats.map((stat, idx) => (
            <Card key={stat.label} className={`p-5 hover:shadow-md transition-shadow ${statStyles[idx % statStyles.length]}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{stat.label}</p>
              <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
            </Card>
          ))}
        </div>
      )}

      {!loading && !overview && (
        <Card className="p-6">
          <p className="text-gray-600">No data available yet.</p>
        </Card>
      )}

      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Quick Actions</h2>
            <p className="text-sm text-gray-500">Jump to super admin tools</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => (window.location.href = '/#/super-admin/users')}>Manage Users</Button>
            <Button variant="secondary" onClick={() => (window.location.href = '/#/super-admin/companies')}>Manage Companies</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
