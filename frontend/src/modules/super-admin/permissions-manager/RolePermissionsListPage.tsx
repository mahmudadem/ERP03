import { useEffect, useState } from 'react';
import { superAdminRolesApi } from '../../../api/superAdmin/roles';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { errorHandler } from '../../../services/errorHandler';

const RolePermissionsListPage: React.FC = () => {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRole, setNewRole] = useState({ id: '', name: '', description: '' });
  const navigate = useNavigate();

  const loadRoles = async () => {
    setLoading(true);
    try {
      const data = await superAdminRolesApi.listRoles();
      setRoles(data);
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const handleCreate = async () => {
    try {
      await superAdminRolesApi.createRole(newRole);
      setShowCreateModal(false);
      setNewRole({ id: '', name: '', description: '' });
      errorHandler.showSuccess('Role template created successfully');
      await loadRoles();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">System Role Templates</h1>
          <p className="text-gray-600 mt-1">Manage system-wide role templates</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          + Create Role Template
        </Button>
      </div>

      {roles.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-500">No role templates found. Create your first role template to get started.</p>
        </Card>
      ) : (
        <Card>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Permissions</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {roles.map((role) => (
                <tr key={role.id}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium">{role.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {(role.permissions || []).length} permissions
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <Button onClick={() => navigate(`/super-admin/roles/${role.id}`)}>Edit</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md p-6 space-y-4">
            <h2 className="text-xl font-bold">Create Role Template</h2>
            
            <div>
              <label className="block text-sm font-medium mb-1">ID</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                value={newRole.id}
                onChange={(e) => setNewRole({ ...newRole, id: e.target.value })}
                placeholder="e.g., template_manager"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                value={newRole.name}
                onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                placeholder="e.g., Manager"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                className="w-full border rounded px-3 py-2"
                rows={3}
                value={newRole.description}
                onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                placeholder="Describe this role template..."
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button onClick={() => {
                setShowCreateModal(false);
                setNewRole({ id: '', name: '', description: '' });
              }}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreate}
                disabled={!newRole.id || !newRole.name}
              >
                Create
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default RolePermissionsListPage;
