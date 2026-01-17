import { useState, useEffect } from 'react';
import { rbacApi, CompanyUser, CompanyRole } from '../../../api/rbac';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { errorHandler } from '../../../services/errorHandler';
import { Trash2 } from 'lucide-react';

export default function AssignUsersRolesPage() {
  const { companyId } = useCompanyAccess();
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [roles, setRoles] = useState<CompanyRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadData = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [usersData, rolesData] = await Promise.all([
        rbacApi.listCompanyUsers(companyId),
        rbacApi.listCompanyRoles(companyId)
      ]);
      setUsers(usersData);
      setRoles(rolesData);
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeleteUser = async (userId: string) => {
    if (!companyId) return;
    if (!window.confirm('Are you sure you want to remove this user from the company?')) return;
    try {
      await rbacApi.deleteCompanyUser(companyId, userId);
      await loadData();
      errorHandler.showSuccess('User removed successfully');
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  const handleRoleChange = async (userId: string, roleId: string) => {
    try {
      await rbacApi.assignRoleToUser(companyId, userId, roleId);
      await loadData();
      errorHandler.showSuccess('Role assigned successfully');
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Assign User Roles</h1>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map(user => {
              const currentRole = roles.find(r => r.id === user.roleId);
              return (
                <tr key={user.userId}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {user.userId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {currentRole?.name || 'No role'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.isOwner ? 'Yes' : 'No'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <select
                        value={user.roleId}
                        onChange={(e) => handleRoleChange(user.userId, e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1"
                        disabled={user.isOwner}
                      >
                        <option value="">-- Select Role --</option>
                        {roles.map(role => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                      {!user.isOwner && (
                        <button
                          onClick={() => handleDeleteUser(user.userId)}
                          className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded transition-colors"
                          title="Remove User"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
