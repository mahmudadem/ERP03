import React, { useEffect, useState } from 'react';
import { superAdminRolesApi } from '../../../api/superAdmin/roles';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { useNavigate } from 'react-router-dom';

const RolePermissionsListPage: React.FC = () => {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await superAdminRolesApi.listRoles();
        setRoles(data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Roles</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {roles.map((role) => (
          <Card key={role.id} className="p-4 flex justify-between">
            <div>
              <div className="font-semibold">{role.name}</div>
              <div className="text-sm text-gray-500">{(role.resolvedPermissions || []).length} permissions</div>
            </div>
            <Button onClick={() => navigate(`/super-admin/roles/${role.id}`)}>Edit</Button>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default RolePermissionsListPage;
