import React, { useState, useEffect, useMemo } from 'react';
import { DocumentFormDesigner, DocumentFormConfig, AvailableField, loadModuleDocumentForms, loadModuleDocumentDefinitions, loadSystemVoucherTypes, saveDocumentForm, updateFormMetadata, WizardProvider } from '../forms-designer'; import { ModuleStatusBanner } from '../forms-designer/components/ModuleStatusBanner'; import { useCompanyAccess } from '../../../context/CompanyAccessContext'; import { useCompanyModules } from '../../../hooks/useCompanyModules'; import { purchasesApi } from '../../../api/purchasesApi'; import { salesApi } from '../../../api/salesApi'; import { useAuth } from '../../../context/AuthContext'; import { FileText, ShoppingCart, Package, ChevronRight, RefreshCw, FileSpreadsheet, Plus, DownloadCloud } from 'lucide-react';
import { Spinner } from '../../../components/ui/Spinner';
import { errorHandler } from '../../../services/errorHandler';
import { useTranslation } from "react-i18next";

type ERPModule = 'ACCOUNTING' | 'SALES' | 'PURCHASE';

type ModuleInitStatus = 'loading' | 'not_installed' | 'not_initialized' | 'initializing' | 'ready';

const MODULE_BUNDLE_MAP: Record<ERPModule, string> = {
  'ACCOUNTING': 'accounting',
  'SALES': 'sales',
  'PURCHASE': 'purchase'
};

const MODULE_CODE_MAP: Record<ERPModule, string> = {
  'ACCOUNTING': 'accounting',
  'SALES': 'sales',
  'PURCHASE': 'purchase'
};

export default function ToolsFormsDesignerPage() {
    const { t } = useTranslation('common');
  const { companyId, moduleBundles } = useCompanyAccess();
  const { user } = useAuth();
  const { isModuleInitialized, getModuleStatus, loading: modulesLoading } = useCompanyModules();
  
  const isModuleActive = (mod: ERPModule) => {
    return moduleBundles.includes(MODULE_BUNDLE_MAP[mod]);
  };

  const getModuleInitStatus = (mod: ERPModule): ModuleInitStatus => {
    if (modulesLoading) return 'loading';
    if (!isModuleActive(mod)) return 'not_installed';
    const code = MODULE_CODE_MAP[mod];
    const status = getModuleStatus(code);
    if (!status) return 'not_initialized';
    if (status.initializationStatus === 'in_progress') return 'initializing';
    if (status.initialized) return 'ready';
    return 'not_initialized';
  };

  const [activeModule, setActiveModule] = useState<ERPModule>(() => {
    if (moduleBundles.includes('accounting')) return 'ACCOUNTING';
    if (moduleBundles.includes('sales')) return 'SALES';
    if (moduleBundles.includes('purchase')) return 'PURCHASE';
    return 'ACCOUNTING';
  });

  const [forms, setForms] = useState<DocumentFormConfig[]>([]);
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [catalogTypes, setCatalogTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const activeModuleStatus = getModuleInitStatus(activeModule);

  useEffect(() => {
    async function fetchData() {
      if (!companyId) return;
      
      setLoading(true);
      try {
        const [loadedForms, loadedDefs, loadedCatalog] = await Promise.all([
          loadModuleDocumentForms(companyId, activeModule),
          loadModuleDocumentDefinitions(companyId, activeModule),
          loadSystemVoucherTypes(activeModule)
        ]);
        
        setForms(loadedForms);
        setDefinitions(loadedDefs);
        setCatalogTypes(loadedCatalog);
      } catch (error) {
        console.error('Failed to load module data:', error);
        errorHandler.showError('Could not load designer data');
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [companyId, activeModule]);

  const mergedDefinitions = useMemo(() => {
    const formTypeIds = new Set(forms.map(f => (f as any).typeId || f.id));
    const defTypeIds = new Set(definitions.map(d => d.id));
    const catalogById = new Map(catalogTypes.map((c: any) => [c.id, c]));

    const result = definitions.map((def: any) => {
      const catalog = catalogById.get(def.id);
      return catalog
        ? { ...def, ...catalog, isSystemCatalog: true }
        : { ...def };
    });

    for (const catalog of catalogTypes) {
      if (!defTypeIds.has(catalog.id) && !formTypeIds.has(catalog.id)) {
        result.push({
          ...catalog,
          adoptionStatus: 'available' as const,
        });
      }
    }

    for (const def of result) {
      const hasForm = forms.some(f => (f as any).typeId === def.id || f.id === def.id);
      const isCustom = forms.some(f => 
        ((f as any).typeId === def.id || f.id === def.id) && 
        !f.isSystemGenerated && !f.isLocked
      );

      if (isCustom) {
        def.adoptionStatus = 'custom';
      } else if (hasForm) {
        def.adoptionStatus = 'active';
      } else {
        def.adoptionStatus = 'available';
      }
    }

    return result;
  }, [definitions, catalogTypes, forms]);

  const templates = mergedDefinitions.map(def => ({
     id: def.id,
     name: def.name,
     code: def.code,
     headerFields: def.headerFields || [],
     lineFields: def.lineFields || [],
     tableColumns: def.tableColumns || [],
     layout: def.layout || { sections: [] },
     module: def.module,
     isSystemCatalog: !!def.isSystemCatalog,
     isSystemDefault: def.isSystemCatalog !== true,
     adoptionStatus: def.adoptionStatus,
  }));

  const systemFields: AvailableField[] = [
    { id: 'documentId', label: 'Document Number', type: 'text', category: 'systemMetadata', autoManaged: true, sectionHint: 'HEADER' },
    { id: 'status', label: 'Status', type: 'text', category: 'systemMetadata', autoManaged: true, sectionHint: 'HEADER' },
    { id: 'createdAt', label: 'Creation Date', type: 'date', category: 'systemMetadata', autoManaged: true, sectionHint: 'HEADER' },
    { id: 'createdBy', label: 'Created By', type: 'text', category: 'systemMetadata', autoManaged: true, sectionHint: 'HEADER' },
    
    { id: 'beforeDiscountDoc', label: 'Sum Before Discount (Doc)', type: 'amount', category: 'systemMetadata', autoManaged: true, sectionHint: 'FOOTER' },
    { id: 'beforeDiscountBase', label: 'Sum Before Discount (Base)', type: 'amount', category: 'systemMetadata', autoManaged: true, sectionHint: 'FOOTER' },
    { id: 'subtotalDoc', label: 'Subtotal (Doc)', type: 'amount', category: 'systemMetadata', autoManaged: true, sectionHint: 'FOOTER' },
    { id: 'subtotalBase', label: 'Subtotal (Base)', type: 'amount', category: 'systemMetadata', autoManaged: true, sectionHint: 'FOOTER' },
    { id: 'taxTotalDoc', label: 'Tax Total (Doc)', type: 'amount', category: 'systemMetadata', autoManaged: true, sectionHint: 'FOOTER' },
    { id: 'taxTotalBase', label: 'Tax Total (Base)', type: 'amount', category: 'systemMetadata', autoManaged: true, sectionHint: 'FOOTER' },
    { id: 'grandTotalDoc', label: 'Grand Total (Doc)', type: 'amount', category: 'systemMetadata', autoManaged: true, sectionHint: 'FOOTER' },
    { id: 'grandTotalBase', label: 'Grand Total (Base)', type: 'amount', category: 'systemMetadata', autoManaged: true, sectionHint: 'FOOTER' },
    
    { id: 'lineItems', label: 'Line Items Table', type: 'table', category: 'core', mandatory: true, sectionHint: 'BODY' },
  ];

  const uniqueFieldsMap = new Map<string, any>();
  mergedDefinitions.flatMap(def => [
    ...(Array.isArray(def.headerFields) ? def.headerFields : []),
    ...(Array.isArray(def.lineFields) ? def.lineFields : [])
  ]).forEach(f => {
    if (f && f.id && !uniqueFieldsMap.has(f.id)) {
      uniqueFieldsMap.set(f.id, { ...f, mandatory: false, required: false });
    }
  });

  const availableFields: AvailableField[] = Array.from(uniqueFieldsMap.values()).map(f => ({
    id: f.id,
    label: f.label,
    type: (f.type || 'text').toLowerCase() as any,
    category: 'shared',
    required: false,
    mandatory: false
  }));

  const uniqueTableColumnsMap = new Map<string, any>();
  mergedDefinitions.flatMap(def => def.tableColumns || []).forEach(col => {
    const colId = col?.id || col?.fieldId;
    if (colId && !uniqueTableColumnsMap.has(colId)) {
      uniqueTableColumnsMap.set(colId, {
         id: colId,
         label: col.label || (colId.charAt(0).toUpperCase() + colId.slice(1).replace(/Id$/, '')),
         ...col
      });
    }
  });
  
  const availableTableColumns: any[] = Array.from(uniqueTableColumnsMap.values());

  const handleSaveForm = async (config: DocumentFormConfig, isEdit: boolean) => {
    if (!companyId || !user) return;
    
    setIsSaving(true);
    try {
      const result = await saveDocumentForm(
        companyId, 
        activeModule, 
        config, 
        { systemFields, availableFields },
        user.uid,
        isEdit
      );
      
      if (result.success) {
        errorHandler.showInfo(`${config.name} saved successfully.`);
        const [updatedForms, updatedDefs] = await Promise.all([
          loadModuleDocumentForms(companyId, activeModule),
          loadModuleDocumentDefinitions(companyId, activeModule)
        ]);
        setForms(updatedForms);
        setDefinitions(updatedDefs);
      }
    } catch (error) {
      errorHandler.showError('Failed to save document layout');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    if (!companyId || !user) return;
    try {
      setForms(prev => prev.map(f => f.id === id ? { ...f, enabled } : f));
      
      const result = await updateFormMetadata(companyId, activeModule, id, { enabled }, user.uid);
      
      if (result.success) {
        errorHandler.showInfo(`Form ${enabled ? 'enabled' : 'disabled'} successfully.`);
      } else {
        setForms(prev => prev.map(f => f.id === id ? { ...f, enabled: !enabled } : f));
        errorHandler.showError(result.errors?.[0] || 'Failed to update form status');
      }
    } catch (error) {
      setForms(prev => prev.map(f => f.id === id ? { ...f, enabled: !enabled } : f));
      errorHandler.showError('Failed to update form status');
    }
  };

  const handleUpdateSidebarGroup = async (id: string, sidebarGroup: string | null) => {
    if (!companyId || !user) return;
    try {
      setForms(prev => prev.map(f => f.id === id ? { ...f, sidebarGroup } as any : f));
      
      const result = await updateFormMetadata(companyId, activeModule, id, { sidebarGroup }, user.uid);
      
      if (result.success) {
        errorHandler.showInfo(`Sidebar group ${sidebarGroup ? `set to "${sidebarGroup}"` : 'cleared'}.`);
      } else {
        setForms(prev => prev.map(f => f.id === id ? { ...f, sidebarGroup: (f as any).sidebarGroup } : f));
        errorHandler.showError(result.errors?.[0] || 'Failed to update sidebar group');
      }
    } catch (error) {
      errorHandler.showError('Failed to update sidebar group');
    }
  };

  const handleDeleteForm = async (id: string) => {
    setTimeout(async () => {
      const updatedForms = await loadModuleDocumentForms(companyId, activeModule);
      setForms(updatedForms);
    }, 500);
  };

  const handleSyncCatalog = async () => {
    setIsSyncing(true);
    try {
      if (activeModule === 'PURCHASE') {
        await purchasesApi.getSettings();
      } else if (activeModule === 'SALES') {
        await salesApi.getSettings();
      }
      
      const [loadedForms, loadedDefs, loadedCatalog] = await Promise.all([
        loadModuleDocumentForms(companyId, activeModule),
        loadModuleDocumentDefinitions(companyId, activeModule),
        loadSystemVoucherTypes(activeModule)
      ]);
      
      setForms(loadedForms);
      setDefinitions(loadedDefs);
      setCatalogTypes(loadedCatalog);
      errorHandler.showInfo('Catalog synchronized with platform.');
    } catch (error) {
      console.error('Catalog sync failed:', error);
      errorHandler.showError('Synchronization failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const getDefaults = () => {
    switch (activeModule) {
      case 'ACCOUNTING':
        return {
          rules: [
            { id: 'require_approval', label: 'Require Approval Workflow', enabled: true, description: 'Vouchers must be approved by a supervisor.' },
            { id: 'prevent_negative_cash', label: 'Prevent Negative Cash', enabled: false, description: 'Block saving if cash accounts go negative.' },
            { id: 'allow_future_date', label: 'Allow Future Posting Dates', enabled: true, description: 'Users can select dates in the future.' },
          ],
          actions: [
            { type: 'print', label: 'Print Voucher', enabled: true },
            { type: 'email', label: 'Email PDF', enabled: true },
            { type: 'download_pdf', label: 'Download PDF', enabled: true },
          ]
        };
      case 'SALES':
        return {
          rules: [
            { id: 'require_approval', label: 'Require Approval Workflow', enabled: true, description: 'Documents must be approved by a manager.' },
            { id: 'prevent_negative_qty', label: 'Prevent Negative Stock', enabled: true, description: 'Block saving if stock levels go below zero.' },
            { id: 'validate_credit_limit', label: 'Check Credit Limit', enabled: true, description: 'Warn if customer exceeds their credit limit.' },
          ],
          actions: [
            { type: 'print', label: 'Print Document', enabled: true },
            { type: 'email', label: 'Email Customer', enabled: true },
            { type: 'download_pdf', label: 'Download PDF', enabled: true },
            { type: 'convert_to_receipt', label: 'Convert to Receipt', enabled: false },
          ]
        };
      case 'PURCHASE':
        return {
          rules: [
            { id: 'require_approval', label: 'Require Approval Workflow', enabled: true, description: 'Documents must be approved.' },
            { id: 'update_inventory', label: 'Auto-Update Stock', enabled: true, description: 'Update inventory levels on Goods Receipt.' },
            { id: 'match_invoice_to_grn', label: 'Three-Way Match', enabled: false, description: 'Ensure Invoice/PO/GRN match perfectly.' },
          ],
          actions: [
            { type: 'print', label: 'Print Document', enabled: true },
            { type: 'email', label: 'Email Vendor', enabled: true },
            { type: 'download_pdf', label: 'Download PDF', enabled: true },
          ]
        };
      default:
        return { rules: [], actions: [] };
    }
  };

  const { rules: defaultRules, actions: defaultActions } = getDefaults();

  const showLoading = (loading || modulesLoading) && forms.length === 0;

  if (showLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <Spinner size="xl" variant="indigo" className="mb-4" />
        <p className="text-slate-500 font-medium animate-pulse">{t(`Initializing`)} {activeModule} {t(`Designer...`)}</p>
      </div>
    );
  }

  return (
    <WizardProvider initialForms={forms}>
      <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-30 shadow-sm shrink-0">
          <div className="flex items-center gap-4">
            <div className="text-indigo-600">
              <FileSpreadsheet size={28} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                Document Form Designer
              </h1>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                <span className="uppercase">{t(`Platform Tools`)}</span>
                <ChevronRight size={12} />
                <span className="text-indigo-500 uppercase">{activeModule} {t(`Domain`)}</span>
              </div>
            </div>
          </div>

          <div className="hidden lg:flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
            {isModuleActive('ACCOUNTING') && (
              <ModuleTab 
                active={activeModule === 'ACCOUNTING'} 
                onClick={() => setActiveModule('ACCOUNTING')}
                icon={<FileText size={18} />}
                label="Accounting"
                status={getModuleInitStatus('ACCOUNTING')}
              />
            )}
            {isModuleActive('SALES') && (
              <ModuleTab 
                active={activeModule === 'SALES'} 
                onClick={() => setActiveModule('SALES')}
                icon={<ShoppingCart size={18} />}
                label="Sales"
                status={getModuleInitStatus('SALES')}
              />
            )}
            {isModuleActive('PURCHASE') && (
              <ModuleTab 
                active={activeModule === 'PURCHASE'} 
                onClick={() => setActiveModule('PURCHASE')}
                icon={<Package size={18} />}
                label="Purchase"
                status={getModuleInitStatus('PURCHASE')}
              />
            )}
          </div>

          <div className="flex items-center gap-2">
            <button 
                onClick={handleSyncCatalog}
                disabled={isSyncing}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50"
                title="Synchronize with Platform Catalog"
              >
                <DownloadCloud size={18} className={isSyncing ? "animate-spin" : ""} />
                <span className="hidden xl:inline">{t(`Sync Catalog`)}</span>
            </button>
            <button 
                onClick={handleSyncCatalog}
                disabled={isSyncing}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50"
                title="Refresh Data"
              >
                <RefreshCw size={18} className={isSyncing ? "animate-spin" : ""} />
                <span className="hidden xl:inline">{t(`Refresh`)}</span>
            </button>
            <div className="h-8 w-px bg-slate-200 mx-2"></div>
            <DocumentFormDesignerHeaderActions 
               onSaveForm={handleSaveForm}
               forms={forms}
            />
          </div>
        </header>

        <div className="lg:hidden bg-white border-b border-slate-200 p-2 flex justify-center gap-1">
             {isModuleActive('ACCOUNTING') && (
              <ModuleTab 
                active={activeModule === 'ACCOUNTING'} 
                onClick={() => setActiveModule('ACCOUNTING')}
                icon={<FileText size={18} />}
                label="Accounting"
                status={getModuleInitStatus('ACCOUNTING')}
              />
             )}
             {isModuleActive('SALES') && (
              <ModuleTab 
                active={activeModule === 'SALES'} 
                onClick={() => setActiveModule('SALES')}
                icon={<ShoppingCart size={18} />}
                label="Sales"
                status={getModuleInitStatus('SALES')}
              />
             )}
             {isModuleActive('PURCHASE') && (
              <ModuleTab 
                active={activeModule === 'PURCHASE'} 
                onClick={() => setActiveModule('PURCHASE')}
                icon={<Package size={18} />}
                label="Purchase"
                status={getModuleInitStatus('PURCHASE')}
              />
             )}
        </div>

        <div className="flex-1 overflow-hidden relative">
          {isSaving && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-[60] flex items-center justify-center">
              <div className="bg-white p-6 rounded-2xl shadow-2xl flex items-center gap-4 border border-slate-100">
                  <Spinner size="lg" variant="indigo" />
                  <span className="text-lg font-bold text-slate-700">{t(`Saving Design Configuration...`)}</span>
              </div>
            </div>
          )}

          <div className="flex flex-col h-full overflow-hidden">
            <div className="px-6 py-4 shrink-0">
              <ModuleStatusBanner 
                moduleName={activeModule} 
                status={activeModuleStatus} 
                formsCount={forms.length}
              />
            </div>

            <div className="flex-1 overflow-hidden">
              <DocumentFormDesigner 
                key={activeModule}
                templates={templates as any}
                systemFields={systemFields}
                availableFields={availableFields}
                availableTableColumns={availableTableColumns}
                defaultRules={defaultRules as any}
                defaultActions={defaultActions as any}
                onDocumentSaved={handleSaveForm}
                onToggleEnabled={handleToggleEnabled}
                onDeleteForm={handleDeleteForm}
                onUpdateSidebarGroup={handleUpdateSidebarGroup}
                hideHeader={true} 
              />
            </div>
          </div>
        </div>
      </div>
    </WizardProvider>
  );
}

function DocumentFormDesignerHeaderActions({ onSaveForm, forms }: { onSaveForm: any, forms: any[] }) {
    return (
        <div className="flex items-center gap-2">
             <button 
                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all"
             >
                Export All
             </button>
             <button 
                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all border border-slate-100"
             >
                Import
             </button>
             <button 
                className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all active:scale-95 flex items-center gap-2"
             >
                <Plus size={18} strokeWidth={3} />
                Create New Form
             </button>
        </div>
    );
}

function ModuleTab({ active, onClick, icon, label, status }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, status: ModuleInitStatus }) {
  return (
    <button 
      onClick={onClick}
      className={`
        flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-black transition-all duration-300 relative
        ${active 
          ? 'bg-white text-indigo-600 shadow-md ring-1 ring-slate-200/50 translate-y-0 scale-100' 
          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 translate-y-0.5 scale-95'
        }
      `}
    >
      <span className={active ? 'text-indigo-600' : 'text-slate-400'}>{icon}</span>
      {label}
      {status === 'not_initialized' && (
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border-2 border-white" title="Not initialized" />
      )}
      {status === 'initializing' && (
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white animate-pulse" title="Initializing" />
      )}
    </button>
  );
}
