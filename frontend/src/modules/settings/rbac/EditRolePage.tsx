
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { rbacApi, CompanyRole, Permission, SystemRoleTemplate } from '../../../api/rbac';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';

export default function EditRolePage() {
  const { roleId } = useParams<{ roleId: string }>();
  const navigate = useNavigate();
  const { companyId } = useCompanyAccess();
  
  const [role, setRole] = useState<CompanyRole | null>(null);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [templates, setTemplates] = useState<SystemRoleTemplate[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [roleId, companyId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [perms, temps] = await Promise.all([
        rbacApi.getPermissions(),
        rbacApi.getSystemRoleTemplates()
      ]);
      setAllPermissions(perms);
      setTemplates(temps);

      if (roleId && roleId !== 'new') {
        const roles = await rbacApi.listCompanyRoles(companyId);
        const currentRole = roles.find(r => r.id === roleId);
        if (currentRole) {
          setRole(currentRole);
          setName(currentRole.name);
          setDescription(currentRole.description || '');
          setSelectedPermissions(currentRole.permissions);
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSelectedPermissions(template.permissions);
      if (!name) setName(template.name);
      if (!description) setDescription(template.description || '');
    }
  };

  const togglePermission = (permId: string) => {
    setSelectedPermissions(prev =>
      prev.includes(permId)
        ? prev.filter(p => p !== permId)
        : [...prev, permId]
    );
  };

  const handleSave = async () => {
    try {
      if (roleId === 'new') {
        await rbacApi.createCompanyRole(companyId, {
          name,
          description,
          permissions: selectedPermissions
        });
      } else {
        await rbacApi.updateCompanyRole(companyId, roleId!, {
          name,
          description,
          permissions: selectedPermissions
        });
      }
      navigate('/settings/rbac/roles');
    } catch (error: any) {
      alert(error.message || 'Failed to save role');
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  const permissionsByCategory = allPermissions.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">
        {roleId === 'new' ? 'Create Role' : 'Edit Role'}
      </h1>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Load from Template
          </label>
          <select
            onChange={(e) => handleTemplateSelect(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
          >
            <option value="">-- Select Template --</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Role Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="e.g., Accountant"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            rows={3}
            placeholder="Optional description"
          />
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Permissions</h2>
        
        {Object.entries(permissionsByCategory).map(([category, perms]) => (
          <div key={category} className="mb-6">
            <h3 className="text-md font-medium text-gray-900 mb-2 capitalize">
              {category}
            </h3>
            <div className="space-y-2">
              {perms.map(perm => (
                <label key={perm.id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedPermissions.includes(perm.id)}
                    onChange={() => togglePermission(perm.id)}
                    className="mr-2"
                  />
                  <span className="text-sm">{perm.labelEn}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <button
          onClick={handleSave}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Save Role
        </button>
        <button
          onClick={() => navigate('/settings/rbac/roles')}
          className="px-6 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
