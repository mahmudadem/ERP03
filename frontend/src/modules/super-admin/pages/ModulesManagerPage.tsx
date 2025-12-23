import React, { useState, useEffect } from 'react';
import { superAdminApi, Module } from '../../../api/superAdmin';
import { errorHandler } from '../../../services/errorHandler';

const PROTECTED_MODULES = ['finance', 'inventory', 'hr'];
const FORBIDDEN_IDS = ['core', 'companyAdmin'];

export const ModulesManagerPage: React.FC = () => {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [formData, setFormData] = useState({ id: '', name: '', description: '' });

  useEffect(() => {
    loadModules();
  }, []);

  const loadModules = async () => {
    try {
      setLoading(true);
      const response: any = await superAdminApi.getModules();
      setModules(response.data || response);
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingModule(null);
    setFormData({ id: '', name: '', description: '' });
    setIsModalOpen(true);
  };

  const handleEdit = (module: Module) => {
    setEditingModule(module);
    setFormData({ id: module.id, name: module.name, description: module.description });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (PROTECTED_MODULES.includes(id)) {
      errorHandler.showError({
        code: 'VAL_001',
        message: `Cannot delete protected module: ${id}`,
        severity: 'WARNING'
      } as any);
      return;
    }

    if (!confirm('Are you sure you want to delete this module?')) return;
    
    try {
      await superAdminApi.deleteModule(id);
      errorHandler.showSuccess('Module deleted');
      loadModules();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.id || !formData.name) {
      errorHandler.showError({
        code: 'VAL_001',
        message: 'ID and Name are required',
        severity: 'WARNING'
      } as any);
      return;
    }

    if (FORBIDDEN_IDS.includes(formData.id)) {
      errorHandler.showError({
        code: 'VAL_001',
        message: `Cannot create module with ID: ${formData.id}. This is a reserved system component.`,
        severity: 'WARNING'
      } as any);
      return;
    }

    try {
      if (editingModule) {
        await superAdminApi.updateModule(editingModule.id, {
          name: formData.name,
          description: formData.description
        });
        errorHandler.showSuccess('Module updated');
      } else {
        await superAdminApi.createModule(formData);
        errorHandler.showSuccess('Module created');
      }
      
      setIsModalOpen(false);
      loadModules();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="modules-manager p-6">
      <div className="header mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Modules Management</h1>
          <p className="text-gray-600 mt-2">Manage system-wide module definitions</p>
        </div>
        <button 
          onClick={handleCreate} 
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Create Module
        </button>
      </div>

      <div className="modules-list bg-white shadow rounded">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">ID</th>
              <th className="px-6 py-3 text-left">Name</th>
              <th className="px-6 py-3 text-left">Description</th>
              <th className="px-6 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {modules.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  No modules found. Create your first module to get started.
                </td>
              </tr>
            ) : (
              modules.map((module) => (
                <tr key={module.id} className="border-t hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono text-sm">
                    {module.id}
                    {PROTECTED_MODULES.includes(module.id) && (
                      <span className="ml-2 bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">Protected</span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-semibold">{module.name}</td>
                  <td className="px-6 py-4 text-gray-600">{module.description}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => handleEdit(module)} className="text-blue-600 hover:underline mr-4">
                      Edit
                    </button>
                    {!PROTECTED_MODULES.includes(module.id) && (
                      <button onClick={() => handleDelete(module.id)} className="text-red-600 hover:underline">
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="modal-content bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">
              {editingModule ? 'Edit Module' : 'Create Module'}
            </h2>
            
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">ID *</label>
                <input
                  type="text"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                  disabled={!!editingModule}
                  placeholder="e.g., crm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Cannot use: core, companyAdmin (reserved)
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                  placeholder="e.g., Customer Relationship Management"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  rows={3}
                  placeholder="Describe this module..."
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {editingModule ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
