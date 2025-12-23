import React, { useState, useEffect } from 'react';
import { superAdminApi, BusinessDomain } from '../../../api/superAdmin';
import { errorHandler } from '../../../services/errorHandler';

export const BusinessDomainsManagerPage: React.FC = () => {
  const [domains, setDomains] = useState<BusinessDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState<BusinessDomain | null>(null);
  const [formData, setFormData] = useState({ id: '', name: '', description: '' });

  useEffect(() => {
    loadDomains();
  }, []);

  const loadDomains = async () => {
    try {
      setLoading(true);
      const response: any = await superAdminApi.getBusinessDomains();
      setDomains(response.data || response);
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingDomain(null);
    setFormData({ id: '', name: '', description: '' });
    setIsModalOpen(true);
  };

  const handleEdit = (domain: BusinessDomain) => {
    setEditingDomain(domain);
    setFormData({ id: domain.id, name: domain.name, description: domain.description });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this business domain?')) return;
    
    try {
      await superAdminApi.deleteBusinessDomain(id);
      errorHandler.showSuccess('Business domain deleted');
      loadDomains();
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

    try {
      if (editingDomain) {
        await superAdminApi.updateBusinessDomain(editingDomain.id, {
          name: formData.name,
          description: formData.description
        });
        errorHandler.showSuccess('Business domain updated');
      } else {
        await superAdminApi.createBusinessDomain(formData);
        errorHandler.showSuccess('Business domain created');
      }
      
      setIsModalOpen(false);
      loadDomains();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="business-domains-manager p-6">
      <div className="header mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Business Domains Management</h1>
          <p className="text-gray-600 mt-2">Manage business domain categories for bundles</p>
        </div>
        <button 
          onClick={handleCreate} 
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Create Domain
        </button>
      </div>

      <div className="domains-list bg-white shadow rounded">
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
            {domains.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  No business domains found. Create your first domain to get started.
                </td>
              </tr>
            ) : (
              domains.map((domain) => (
                <tr key={domain.id} className="border-t hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono text-sm">{domain.id}</td>
                  <td className="px-6 py-4 font-semibold">{domain.name}</td>
                  <td className="px-6 py-4 text-gray-600">{domain.description}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => handleEdit(domain)} className="text-blue-600 hover:underline mr-4">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(domain.id)} className="text-red-600 hover:underline">
                      Delete
                    </button>
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
              {editingDomain ? 'Edit Business Domain' : 'Create Business Domain'}
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
                  disabled={!!editingDomain}
                  placeholder="e.g., food-trading"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                  placeholder="e.g., Food Trading"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  rows={3}
                  placeholder="Describe this business domain..."
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
                  {editingDomain ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
