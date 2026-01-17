import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CompanyAdminLayout } from '../layout/CompanyAdminLayout';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useCompanyRoles } from '../../../hooks/useCompanyAdmin';
import { rbacApi, Permission, SystemRoleTemplate, CompanyRole } from '../../../api/rbac';
import { errorHandler } from '../../../services/errorHandler';
import { Search, ChevronDown, ChevronRight, Check, Square, CheckSquare } from 'lucide-react';

const t = (key: string) => key;

export const EditRolePage: React.FC = () => {
  const navigate = useNavigate();
  const { roleId } = useParams<{ roleId: string }>();
  const isNew = roleId === 'new';
  
  const { updateRole, createRole, isUpdating, isCreating, roles } = useCompanyRoles();
  
  // State
  const [loading, setLoading] = useState(!isNew);
  const [role, setRole] = useState<Partial<CompanyRole> | null>(isNew ? {} : null);
  
  // Lookup Data
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [templates, setTemplates] = useState<SystemRoleTemplate[]>([]);
  
  // Form Data
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  
  // UI State for Permissions
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // 1. Load Initial Data
  useEffect(() => {
    const init = async () => {
      try {
        const [perms, temps] = await Promise.all([
          rbacApi.getPermissions(),
          rbacApi.getSystemRoleTemplates()
        ]);
        setAllPermissions(perms);
        setTemplates(temps);
        
        // Auto-expand all modules initially
        const modules = new Set(perms.map(p => p.category || 'General'));
        setExpandedModules(modules);

        if (isNew) setLoading(false);
      } catch (err) {
        errorHandler.showError(err);
      }
    };
    init();
  }, [isNew]);

  // 2. Fetch Role Data (If Editing)
  useEffect(() => {
    if (!isNew && roles.length > 0 && roleId) {
       const found = roles.find(r => r.id === roleId);
       if (found) {
         setRole(found);
         setName(found.name);
         setDescription(found.description || '');
         setSelectedPermissions(found.permissions || []);
         setLoading(false);
       } 
    }
  }, [roles, roleId, isNew]);

  // Group permissions by category/module
  const permissionsByCategory = useMemo(() => {
    return allPermissions.reduce((acc, perm) => {
      const cat = perm.category || 'General';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(perm);
      return acc;
    }, {} as Record<string, Permission[]>);
  }, [allPermissions]);

  // Filter permissions based on search
  const filteredPermissionsByCategory = useMemo(() => {
    if (!searchQuery.trim()) return permissionsByCategory;
    
    const query = searchQuery.toLowerCase();
    const filtered: Record<string, Permission[]> = {};
    
    Object.entries(permissionsByCategory).forEach(([category, perms]) => {
      const matchingPerms = perms.filter(p => 
        p.labelEn?.toLowerCase().includes(query) ||
        p.id.toLowerCase().includes(query) ||
        category.toLowerCase().includes(query)
      );
      if (matchingPerms.length > 0) {
        filtered[category] = matchingPerms;
      }
    });
    
    return filtered;
  }, [permissionsByCategory, searchQuery]);

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

  const toggleModule = (category: string) => {
    const modulePerms = permissionsByCategory[category] || [];
    const allSelected = modulePerms.every(p => selectedPermissions.includes(p.id));
    
    if (allSelected) {
      // Deselect all in this module
      setSelectedPermissions(prev => prev.filter(id => !modulePerms.find(p => p.id === id)));
    } else {
      // Select all in this module
      const newPerms = new Set([...selectedPermissions, ...modulePerms.map(p => p.id)]);
      setSelectedPermissions(Array.from(newPerms));
    }
  };

  const toggleExpand = (category: string) => {
    setExpandedModules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const getModuleSelectionState = (category: string): 'none' | 'some' | 'all' => {
    const modulePerms = permissionsByCategory[category] || [];
    const selectedCount = modulePerms.filter(p => selectedPermissions.includes(p.id)).length;
    if (selectedCount === 0) return 'none';
    if (selectedCount === modulePerms.length) return 'all';
    return 'some';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { name, description, permissions: selectedPermissions };

    if (isNew) {
      createRole(payload, { onSuccess: () => navigate('/company-admin/roles') });
    } else if (roleId) {
      updateRole({ roleId, data: payload }, { onSuccess: () => navigate('/company-admin/roles') });
    }
  };

  if (loading) {
    return (
      <CompanyAdminLayout>
        <div className="flex items-center justify-center h-64">
           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </CompanyAdminLayout>
    );
  }

  const isSystem = !isNew && role?.isSystem;
  const totalSelected = selectedPermissions.length;
  const totalAvailable = allPermissions.length;

  return (
    <CompanyAdminLayout>
      <PageHeader 
        title={isNew ? t("companyAdmin.roles.createTitle") : `Edit ${name}`} 
        breadcrumbs={[
          { label: 'Company Admin' }, 
          { label: 'Roles', href: '/company-admin/roles' }, 
          { label: isNew ? 'Create' : 'Edit' }
        ]}
      />

      {isSystem && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            ⚠️ This is a system role. Some permissions cannot be removed.
          </p>
        </div>
      )}

      <div className="flex gap-6 max-w-6xl pb-24">
          {/* Left Column: Role Details */}
          <div className="w-1/3 space-y-6">
              <Card className="p-6">
                <form id="role-form" onSubmit={handleSubmit} className="space-y-6">
                  {isNew && (
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100">
                        <label className="block text-sm font-medium text-blue-900 mb-2">
                          🚀 Quick Start from Template
                        </label>
                        <select 
                            onChange={(e) => handleTemplateSelect(e.target.value)}
                            className="w-full border-blue-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">-- Start from scratch --</option>
                            {templates.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                      </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Role Name *</label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Accountant"
                      required
                      disabled={!!isSystem}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={!!isSystem}
                      placeholder="What can this role do?"
                    />
                  </div>
                </form>
              </Card>

              {/* Selection Summary */}
              <Card className="p-4 bg-gradient-to-r from-slate-50 to-slate-100">
                <div className="text-center">
                  <div className="text-3xl font-bold text-slate-800">{totalSelected}</div>
                  <div className="text-sm text-slate-500">of {totalAvailable} permissions selected</div>
                </div>
              </Card>
          </div>

          {/* Right Column: Permissions */}
          <div className="flex-1">
             <Card className="p-0 overflow-hidden">
                {/* Header with Search */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-white text-lg">Permissions</h3>
                    <span className="text-xs bg-white/20 text-white px-2 py-1 rounded-full">
                      {totalSelected} selected
                    </span>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      placeholder="Search permissions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                </div>

                {/* Permission Groups */}
                <div className="max-h-[500px] overflow-y-auto">
                  {Object.entries(filteredPermissionsByCategory).map(([category, perms]) => {
                    const isExpanded = expandedModules.has(category);
                    const selectionState = getModuleSelectionState(category);
                    const selectedInModule = perms.filter(p => selectedPermissions.includes(p.id)).length;

                    return (
                      <div key={category} className="border-b border-slate-100 last:border-0">
                        {/* Module Header */}
                        <div 
                          className="flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors"
                          onClick={() => toggleExpand(category)}
                        >
                          <button 
                            onClick={(e) => { e.stopPropagation(); toggleModule(category); }}
                            className="flex-shrink-0"
                            disabled={!!isSystem}
                          >
                            {selectionState === 'all' ? (
                              <CheckSquare className="text-blue-600" size={20} />
                            ) : selectionState === 'some' ? (
                              <div className="w-5 h-5 border-2 border-blue-600 rounded bg-blue-100 flex items-center justify-center">
                                <div className="w-2.5 h-0.5 bg-blue-600 rounded" />
                              </div>
                            ) : (
                              <Square className="text-slate-400" size={20} />
                            )}
                          </button>
                          
                          <div className="flex-1 flex items-center gap-2">
                            <span className="font-medium text-slate-800 capitalize">{category}</span>
                            <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                              {selectedInModule}/{perms.length}
                            </span>
                          </div>
                          
                          {isExpanded ? (
                            <ChevronDown size={18} className="text-slate-400" />
                          ) : (
                            <ChevronRight size={18} className="text-slate-400" />
                          )}
                        </div>

                        {/* Permissions List */}
                        {isExpanded && (
                          <div className="bg-white divide-y divide-slate-50">
                            {perms.map(perm => {
                              const isSelected = selectedPermissions.includes(perm.id);
                              return (
                                <label 
                                  key={perm.id} 
                                  className={`flex items-start gap-3 px-4 py-3 pl-12 cursor-pointer transition-colors ${
                                    isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                                  }`}
                                >
                                  <input 
                                    type="checkbox"
                                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    checked={isSelected}
                                    onChange={() => togglePermission(perm.id)}
                                    disabled={!!isSystem} 
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-slate-800">
                                      {perm.labelEn || perm.id}
                                    </div>
                                    {perm.descriptionEn && (
                                      <div className="text-xs text-slate-500 mt-0.5">
                                        {perm.descriptionEn}
                                      </div>
                                    )}
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {Object.keys(filteredPermissionsByCategory).length === 0 && (
                    <div className="p-8 text-center text-slate-500">
                      <p>No permissions match your search.</p>
                    </div>
                  )}
                </div>
             </Card>
          </div>
      </div>

      {/* Fixed Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 z-10">
        <div className="container mx-auto max-w-6xl flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/company-admin/roles')}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            form="role-form"
            disabled={isUpdating || isCreating || !name.trim()}
          >
            {isUpdating || isCreating ? 'Saving...' : 'Save Role'}
          </Button>
        </div>
      </div>
    </CompanyAdminLayout>
  );
};

export default EditRolePage;
