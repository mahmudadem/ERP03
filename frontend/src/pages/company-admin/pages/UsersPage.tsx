import React, { useState } from 'react';
import { CompanyAdminLayout } from '../layout/CompanyAdminLayout';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useCompanyUsers, useCompanyRoles } from '../../../hooks/useCompanyAdmin';
import { Edit2, Search, Shield, User as UserIcon, Mail, Power, UserPlus, X, Save, CheckCircle, Ban, Trash2 } from 'lucide-react';

export const UsersPage: React.FC = () => {
  const { 
    users, 
    isLoading, 
    inviteUser, 
    isInviting, 
    updateUserRole, 
    isUpdatingRole,
    disableUser, 
    isDisabling,
    enableUser,
    isEnabling,
    deleteUser,
    isDeleting
  } = useCompanyUsers();
  
  const { roles } = useCompanyRoles();
  
  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  
  // Invite Modal State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    roleId: '',
    firstName: '',
    lastName: '',
  });

  // Role Assignment Modal State
  const [roleAssignmentUser, setRoleAssignmentUser] = useState<any>(null);
  const [targetRoleId, setTargetRoleId] = useState('');

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.firstName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.lastName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    inviteUser(inviteForm, {
      onSuccess: () => {
        setShowInviteModal(false);
        setInviteForm({ email: '', roleId: '', firstName: '', lastName: '' });
      }
    });
  };

  const openRoleModal = (user: any) => {
    setRoleAssignmentUser(user);
    setTargetRoleId(user.roleId || '');
  };

  const handleSaveRole = () => {
    if (roleAssignmentUser) {
      updateUserRole(
        { userId: roleAssignmentUser.userId, roleId: targetRoleId },
        { 
          onSuccess: () => {
            setRoleAssignmentUser(null);
          }
        }
      );
    }
  };

  const handleToggleStatus = (user: any) => {
    const action = user.status === 'active' ? 'disable' : 'enable';
    if (window.confirm(`Are you sure you want to ${action} ${user.email}?`)) {
      if (user.status === 'active') {
        disableUser(user.userId);
      } else {
        enableUser(user.userId);
      }
    }
  };

  const handleDeleteUser = (user: any) => {
    if (window.confirm(`Are you sure you want to remove ${user.email} from the company?`)) {
      deleteUser(user.userId);
    }
  };

  const isActionLoading = isDisabling || isEnabling || isDeleting;

  return (
    <CompanyAdminLayout>
      <PageHeader 
        title="User Management" 
        breadcrumbs={[{ label: 'Company Admin' }, { label: 'Users' }]}
        action={
          <Button onClick={() => setShowInviteModal(true)}>
            <UserPlus size={18} className="mr-2" /> Invite User
          </Button>
        }
      />

      <Card className="p-4 mb-6">
        <div className="flex gap-4 items-center">
           <div className="flex-1 relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
             <Input 
               placeholder="Search users..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="pl-10"
             />
           </div>
           <div className="text-sm text-gray-500">
             {filteredUsers.length} users
           </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredUsers.length === 0 ? (
        <EmptyState 
          title={searchTerm ? "No users match your search" : "No users found"} 
          description={searchTerm ? "Try adjusting your search terms" : "Get started by inviting users to your company."}
          action={!searchTerm ? <Button onClick={() => setShowInviteModal(true)}>Invite User</Button> : undefined}
        />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.userId} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          user.isOwner ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                        }`}>
                          <span className="font-semibold text-sm">
                            {((user.firstName?.[0] || '') + (user.lastName?.[0] || '')).toUpperCase() || <UserIcon size={20} />}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                          {user.firstName} {user.lastName}
                          {user.isOwner && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 uppercase tracking-wide">
                              Owner
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <Mail size={14} className="text-gray-400" />
                      {user.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2 group">
                      {user.isOwner ? (
                        <div className="flex items-center text-gray-900 font-medium bg-gray-100 px-2 py-1 rounded">
                          <Shield size={14} className="mr-1.5 text-purple-500" />
                          {user.roleName}
                        </div>
                      ) : (
                        <>
                          <div className={`flex items-center font-medium px-2 py-1 rounded ${
                            user.roleName ? 'text-gray-900 bg-gray-50' : 'text-gray-400 bg-gray-50 italic'
                          }`}>
                            <Shield size={14} className="mr-1.5 text-blue-500" />
                            {user.roleName || 'No Role'}
                          </div>
                          <button 
                            onClick={() => openRoleModal(user)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-full transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Change Role"
                          >
                            <Edit2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {user.status === 'active' ? (
                        <CheckCircle size={12} className="mr-1.5" />
                      ) : (
                        <Ban size={12} className="mr-1.5" />
                      )}
                      <span className="capitalize">{user.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {!user.isOwner && (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleToggleStatus(user)}
                          disabled={isActionLoading}
                          className={`p-1.5 rounded-md transition-colors ${
                            user.status === 'active' 
                              ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50' 
                              : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                          }`}
                          title={user.status === 'active' ? 'Disable User' : 'Enable User'}
                        >
                          <Power size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user)}
                          disabled={isActionLoading}
                          className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Remove User"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Role Assignment Modal */}
      {roleAssignmentUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md p-6 shadow-xl border-0">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Assign Role</h2>
                <div className="text-sm text-gray-500 mt-1">
                  Assigning role for <span className="font-medium text-gray-900">{roleAssignmentUser.firstName} {roleAssignmentUser.lastName}</span>
                </div>
              </div>
              <button 
                onClick={() => setRoleAssignmentUser(null)}
                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Role</label>
              <select
                value={targetRoleId}
                onChange={(e) => setTargetRoleId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm shadow-sm transition-shadow"
              >
                <option value="">Select a role...</option>
                {roles.map(role => (
                  <option key={role.id} value={role.id}>
                    {role.name} {role.isSystem ? '(System)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 justify-end">
              <Button 
                variant="secondary" 
                onClick={() => setRoleAssignmentUser(null)}
                disabled={isUpdatingRole}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveRole} 
                disabled={isUpdatingRole || !targetRoleId}
                className="min-w-[100px]"
              >
                {isUpdatingRole ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" /> 
                ) : (
                  <Save size={16} className="mr-2" />
                )}
                Save
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md p-6 shadow-xl border-0">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Invite New User</h2>
              <button 
                onClick={() => setShowInviteModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                <Input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  required
                  placeholder="colleague@company.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <Input
                    value={inviteForm.firstName}
                    onChange={(e) => setInviteForm({ ...inviteForm, firstName: e.target.value })}
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <Input
                    value={inviteForm.lastName}
                    onChange={(e) => setInviteForm({ ...inviteForm, lastName: e.target.value })}
                    placeholder="Doe"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign Role *</label>
                <select
                  value={inviteForm.roleId}
                  onChange={(e) => setInviteForm({ ...inviteForm, roleId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm shadow-sm"
                  required
                >
                  <option value="">Select a role...</option>
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowInviteModal(false)}
                  disabled={isInviting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isInviting}>
                  {isInviting ? 'Sending...' : 'Send Invitation'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </CompanyAdminLayout>
  );
};

export default UsersPage;
