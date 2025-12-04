
import React, { useState } from 'react';
import { CompanyAdminLayout } from '../layout/CompanyAdminLayout';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { ToggleSwitch } from '../../../components/ui/ToggleSwitch';
import { Module } from '../../../types/company-admin';

const t = (key: string) => key;

const MOCK_MODULES: Module[] = [
  { id: '1', name: 'Accounting', description: 'Financial management, ledgers, and reporting', status: 'enabled', features: ['Invoicing', 'Expenses'] },
  { id: '2', name: 'Inventory', description: 'Stock tracking, warehouses, and movements', status: 'enabled', features: ['Stock', 'Warehouses'] },
  { id: '3', name: 'HR & Payroll', description: 'Employee management and payroll processing', status: 'disabled', features: ['Employees', 'Attendance'] },
  { id: '4', name: 'Point of Sale', description: 'Retail sales terminal', status: 'disabled', features: ['POS', 'Orders'] },
];

export const ModulesPage: React.FC = () => {
  const [modules, setModules] = useState(MOCK_MODULES);

  const toggleModule = (id: string, currentStatus: string) => {
    // Logic placeholder
    const newStatus = currentStatus === 'enabled' ? 'disabled' : 'enabled';
    setModules(prev => prev.map(m => m.id === id ? { ...m, status: newStatus } : m));
    // Toast placeholder here
  };

  return (
    <CompanyAdminLayout>
      <PageHeader 
        title={t("companyAdmin.modules.title")} 
        breadcrumbs={[{ label: 'Company Admin' }, { label: 'Modules' }]}
      />

      <div className="grid grid-cols-1 gap-6">
        {modules.map(module => (
          <Card key={module.id} className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
             <div className="flex-1">
               <div className="flex items-center gap-3">
                 <h3 className="text-lg font-bold text-gray-900">{module.name}</h3>
                 <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${module.status === 'enabled' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                   {module.status}
                 </span>
               </div>
               <p className="text-gray-500 mt-1">{module.description}</p>
               <div className="flex gap-2 mt-3">
                 {module.features.map(f => (
                   <span key={f} className="text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded border border-gray-200">{f}</span>
                 ))}
               </div>
             </div>
             
             <div className="flex items-center gap-4">
               <ToggleSwitch 
                 checked={module.status === 'enabled'} 
                 onChange={() => toggleModule(module.id, module.status)}
                 label={module.status === 'enabled' ? t("companyAdmin.modules.disable") : t("companyAdmin.modules.enable")}
               />
             </div>
          </Card>
        ))}
      </div>
    </CompanyAdminLayout>
  );
};

export default ModulesPage;
