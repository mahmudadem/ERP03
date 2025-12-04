
import React from 'react';
import { CompanyAdminLayout } from '../layout/CompanyAdminLayout';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Bundle } from '../../../types/company-admin';

const t = (key: string) => key;

const MOCK_BUNDLES: Bundle[] = [
  { id: '1', name: 'Starter', description: 'Essential tools for small businesses', modules: ['Accounting'], features: ['Basic Reporting'], price: '$29/mo', isCurrent: false },
  { id: '2', name: 'Growth', description: 'Advanced features for growing teams', modules: ['Accounting', 'Inventory'], features: ['Advanced Reporting', 'Multi-warehouse'], price: '$79/mo', isCurrent: true },
  { id: '3', name: 'Enterprise', description: 'Full suite with premium support', modules: ['All Modules'], features: ['Custom Roles', 'API Access', 'Dedicated Support'], price: '$199/mo', isCurrent: false },
];

export const BundlesPage: React.FC = () => {
  return (
    <CompanyAdminLayout>
      <PageHeader 
        title={t("companyAdmin.bundles.title")} 
        breadcrumbs={[{ label: 'Company Admin' }, { label: 'Bundles' }]}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {MOCK_BUNDLES.map(bundle => (
          <Card key={bundle.id} className={`p-6 flex flex-col relative ${bundle.isCurrent ? 'ring-2 ring-blue-500 shadow-lg' : ''}`}>
             {bundle.isCurrent && (
               <span className="absolute top-0 right-0 bg-blue-500 text-white text-xs px-3 py-1 rounded-bl rounded-tr font-bold uppercase tracking-wide">
                 {t("companyAdmin.bundles.current")}
               </span>
             )}
             
             <h3 className="text-xl font-bold text-gray-900 mb-2">{bundle.name}</h3>
             <p className="text-gray-500 text-sm mb-4 h-10">{bundle.description}</p>
             <div className="text-3xl font-extrabold text-gray-900 mb-6">{bundle.price}</div>
             
             <div className="flex-1 space-y-4 mb-8">
               <div>
                 <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Modules</p>
                 <ul className="space-y-1">
                   {bundle.modules.map((m, i) => (
                     <li key={i} className="flex items-center text-sm text-gray-700">
                       <span className="mr-2 text-green-500">✓</span> {m}
                     </li>
                   ))}
                 </ul>
               </div>
               <div>
                 <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Features</p>
                 <ul className="space-y-1">
                   {bundle.features.map((f, i) => (
                     <li key={i} className="flex items-center text-sm text-gray-700">
                       <span className="mr-2 text-blue-500">•</span> {f}
                     </li>
                   ))}
                 </ul>
               </div>
             </div>
             
             <Button 
               variant={bundle.isCurrent ? "secondary" : "primary"} 
               className="w-full"
               disabled={bundle.isCurrent}
             >
               {bundle.isCurrent ? 'Active Plan' : t("companyAdmin.bundles.apply")}
             </Button>
          </Card>
        ))}
      </div>
    </CompanyAdminLayout>
  );
};

export default BundlesPage;
