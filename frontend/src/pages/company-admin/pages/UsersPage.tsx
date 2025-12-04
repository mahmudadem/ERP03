
import React from 'react';
import { CompanyAdminLayout } from '../layout/CompanyAdminLayout';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { CompanyUser } from '../../../types/company-admin';

const t = (key: string) => key;

const MOCK_USERS: CompanyUser[] = [
  { id: '1', name: 'John Doe', email: 'john@techflow.com', role: 'Admin', status: 'active' },
  { id: '2', name: 'Jane Smith', email: 'jane@techflow.com', role: 'Manager', status: 'active' },
  { id: '3', name: 'Bob Johnson', email: 'bob@techflow.com', role: 'User', status: 'inactive' },
];

export const UsersPage: React.FC = () => {
  return (
    <CompanyAdminLayout>
      <PageHeader 
        title={t("companyAdmin.users.title")} 
        breadcrumbs={[{ label: 'Company Admin' }, { label: 'Users' }]}
        action={<Button variant="primary">+ {t("companyAdmin.users.invite")}</Button>}
      />

      <Card className="p-4 mb-6">
         <div className="flex flex-col md:flex-row gap-4">
           <div className="flex-1">
             <Input placeholder="Search users by name or email..." />
           </div>
           <div className="w-full md:w-48">
             <Select options={[{ label: 'All Roles', value: 'all' }, { label: 'Admin', value: 'admin' }]} />
           </div>
         </div>
      </Card>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {MOCK_USERS.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold mr-3">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                  {user.role}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {user.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button className="text-blue-600 hover:text-blue-900 mr-4">Edit Role</button>
                  <button className="text-gray-600 hover:text-gray-900">
                    {user.status === 'active' ? t("companyAdmin.users.disable") : t("companyAdmin.users.enable")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CompanyAdminLayout>
  );
};

export default UsersPage;
