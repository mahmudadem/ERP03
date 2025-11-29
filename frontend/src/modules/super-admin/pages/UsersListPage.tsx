
import { useEffect, useState } from 'react';
import { superAdminApi, SuperAdminUser } from '../../../api/superAdmin';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';

export default function UsersListPage() {
  const [users, setUsers] = useState<SuperAdminUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await superAdminApi.getAllUsers();
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users', error);
      window.alert('Unable to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePromote = async (userId: string) => {
    if (!window.confirm('Promote this user to SUPER_ADMIN?')) return;
    try {
      await superAdminApi.promoteUser(userId);
      window.alert('User promoted to SUPER_ADMIN');
      loadUsers();
    } catch (error: any) {
      window.alert(error?.message || 'Failed to promote user');
    }
  };

  const handleDemote = async (userId: string) => {
    if (!window.confirm('Demote this SUPER_ADMIN to USER?')) return;
    try {
      await superAdminApi.demoteUser(userId);
      window.alert('User demoted to USER');
      loadUsers();
    } catch (error: any) {
      window.alert(error?.message || 'Failed to demote user');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">All Users</h1>
        <Button variant="ghost" size="sm" onClick={loadUsers} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      <Card className="overflow-hidden">
        {loading && users.length === 0 ? (
          <div className="p-6 text-gray-500">Loading users...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Global Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        user.globalRole === 'SUPER_ADMIN'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {user.globalRole}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {user.globalRole === 'SUPER_ADMIN' ? (
                      <Button variant="secondary" size="sm" onClick={() => handleDemote(user.id)}>
                        Demote
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => handlePromote(user.id)}>
                        Promote
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && !loading && (
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-500" colSpan={4}>
                    No users found.
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
