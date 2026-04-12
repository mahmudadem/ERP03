import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompanyModules } from '../../hooks/useCompanyModules';
import { 
  Calculator, 
  Package, 
  Users, 
  ShoppingCart, 
  Building2,
  FileText,
  ArrowRight,
  Clock,
  ClipboardList
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCompanyAccess } from '../../context/CompanyAccessContext';
import { useMemo } from 'react';

/**
 * Module Setup Card - Shows on Dashboard
 * Displays uninitialized modules and prompts user to complete setup
 */
export const ModuleSetupCard: React.FC = () => {
  const { t } = useTranslation('common');
  const { modules, loading } = useCompanyModules();
  const { moduleBundles } = useCompanyAccess();
  const navigate = useNavigate();

  // Filter uninitialized modules
  const uninitializedModules = useMemo(() => {
    // 1. Get modules from bundles that are either missing from status list OR have initialized set to false
    return moduleBundles
      .filter(code => code !== 'companyAdmin')
      .map(code => {
        const status = modules.find(m => m.moduleCode === code);
        return {
          moduleCode: code,
          initialized: status?.initialized ?? false,
          initializationStatus: status?.initializationStatus ?? 'pending'
        };
      })
      .filter(m => !m.initialized);
  }, [modules, moduleBundles]);

  // Calculate progress percentage based on enabled modules (excluding companyAdmin)
  const progressPercentage = useMemo(() => {
    const activeBundles = moduleBundles.filter(b => b !== 'companyAdmin');
    if (activeBundles.length === 0) return 100;
    
    const initializedCount = activeBundles.filter(code => 
      modules.some(m => m.moduleCode === code && m.initialized)
    ).length;
    
    return Math.round((initializedCount / activeBundles.length) * 100);
  }, [modules, moduleBundles]);

  // Don't show card if loading or all modules are initialized
  if (loading || uninitializedModules.length === 0) {
    return null;
  }

  // Map module codes to friendly names, icons, and setup paths
  const getModuleInfo = (moduleCode: string) => {
    const moduleMap: Record<string, { 
      name: string; 
      description: string; 
      path: string;
      icon: React.ComponentType<{ className?: string }>;
      iconBg: string;
      iconColor: string;
    }> = {
      accounting: {
        name: t('moduleSetupCard.modules.accounting.name'),
        description: t('moduleSetupCard.modules.accounting.description'),
        path: '/accounting/setup',
        icon: Calculator,
        iconBg: 'bg-teal-50',
        iconColor: 'text-teal-600',
      },
      inventory: {
        name: t('moduleSetupCard.modules.inventory.name'),
        description: t('moduleSetupCard.modules.inventory.description'),
        path: '/inventory',
        icon: Package,
        iconBg: 'bg-blue-50',
        iconColor: 'text-blue-600',
      },
      hr: {
        name: t('moduleSetupCard.modules.hr.name'),
        description: t('moduleSetupCard.modules.hr.description'),
        path: '/hr/setup',
        icon: Users,
        iconBg: 'bg-purple-50',
        iconColor: 'text-purple-600',
      },
      pos: {
        name: t('moduleSetupCard.modules.pos.name'),
        description: t('moduleSetupCard.modules.pos.description'),
        path: '/pos/setup',
        icon: ShoppingCart,
        iconBg: 'bg-green-50',
        iconColor: 'text-green-600',
      },
      companyAdmin: {
        name: t('moduleSetupCard.modules.companyAdmin.name'),
        description: t('moduleSetupCard.modules.companyAdmin.description'),
        path: '/companyAdmin/setup',
        icon: Building2,
        iconBg: 'bg-indigo-50',
        iconColor: 'text-indigo-600',
      },
      crm: {
        name: t('moduleSetupCard.modules.crm.name'),
        description: t('moduleSetupCard.modules.crm.description'),
        path: '/crm/setup',
        icon: Users,
        iconBg: 'bg-pink-50',
        iconColor: 'text-pink-600',
      },
      invoicing: {
        name: t('moduleSetupCard.modules.invoicing.name'),
        description: t('moduleSetupCard.modules.invoicing.description'),
        path: '/invoicing/setup',
        icon: FileText,
        iconBg: 'bg-orange-50',
        iconColor: 'text-orange-600',
      },
      purchase: {
        name: t('moduleSetupCard.modules.purchase.name'),
        description: t('moduleSetupCard.modules.purchase.description'),
        path: '/purchases',
        icon: ClipboardList,
        iconBg: 'bg-indigo-50',
        iconColor: 'text-indigo-600',
      },
      purchases: {
        name: t('moduleSetupCard.modules.purchase.name'),
        description: t('moduleSetupCard.modules.purchase.description'),
        path: '/purchases',
        icon: ClipboardList,
        iconBg: 'bg-indigo-50',
        iconColor: 'text-indigo-600',
      },
      sales: {
        name: t('moduleSetupCard.modules.sales.name'),
        description: t('moduleSetupCard.modules.sales.description'),
        path: '/sales',
        icon: ShoppingCart,
        iconBg: 'bg-rose-50',
        iconColor: 'text-rose-600',
      },
    };

    return (
      moduleMap[moduleCode] || {
        name: moduleCode,
        description: t('moduleSetupCard.modules.defaultDescription'),
        path: `/${moduleCode}/setup`,
        icon: Building2,
        iconBg: 'bg-gray-50',
        iconColor: 'text-gray-600',
      }
    );
  };

  // Calculate progress percentage

  return (
    <div className="bg-gray-50 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-1">{t('moduleSetupCard.title')}</h2>
          <p className="text-sm text-gray-600">
            {t('moduleSetupCard.subtitle')}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500 mb-1">{t('moduleSetupCard.setupProgress')}</div>
          <div className="text-2xl font-bold text-primary-600">{progressPercentage}%</div>
        </div>
      </div>

      {/* Module Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {uninitializedModules.map((module) => {
          const info = getModuleInfo(module.moduleCode);
          const Icon = info.icon;
          
          return (
            <div
              key={module.moduleCode}
              className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow duration-200"
            >
              {/* Icon and Status Badge */}
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 ${info.iconBg} rounded-lg flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${info.iconColor}`} />
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-orange-50 rounded-full">
                  <Clock className="w-3 h-3 text-orange-600" />
                  <span className="text-xs font-medium text-orange-600">{t('moduleSetupCard.pending')}</span>
                </div>
              </div>

              {/* Module Info */}
              <h3 className="text-base font-semibold text-gray-900 mb-1.5">
                {info.name}
              </h3>
              <p className="text-sm text-gray-600 mb-5 leading-relaxed min-h-[2.5rem]">
                {info.description}
              </p>

              {/* Configure Button */}
              <button
                onClick={() => navigate(info.path)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-medium text-sm transition-colors duration-200 group"
              >
                {t('moduleSetupCard.configureApp')}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ModuleSetupCard;
