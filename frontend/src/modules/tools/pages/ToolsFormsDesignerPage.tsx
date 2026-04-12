import React, { useState, useEffect } from 'react';
import { 
  DocumentFormDesigner, 
  DocumentFormConfig,
  AvailableField,
  loadModuleDocumentForms,
  loadModuleDocumentDefinitions,
  saveDocumentForm,
  updateFormMetadata,
  WizardProvider
} from '../forms-designer';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { purchasesApi } from '../../../api/purchasesApi';
import { salesApi } from '../../../api/salesApi';
import { useAuth } from '../../../context/AuthContext';
import { 
  Loader2, 
  FileText, 
  ShoppingCart, 
  Package, 
  ChevronRight,
  Database,
  RefreshCw,
  FileSpreadsheet,
  Plus
} from 'lucide-react';
import { errorHandler } from '../../../services/errorHandler';

type ERPModule = 'ACCOUNTING' | 'SALES' | 'PURCHASE';

export default function ToolsFormsDesignerPage() {
  const { companyId } = useCompanyAccess();
  const { user } = useAuth();
  
  const [activeModule, setActiveModule] = useState<ERPModule>('ACCOUNTING');
  const [forms, setForms] = useState<DocumentFormConfig[]>([]);
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load data for the active module
  useEffect(() => {
    async function fetchData() {
      if (!companyId) return;
      
      setLoading(true);
      try {
        const [loadedForms, loadedDefs] = await Promise.all([
          loadModuleDocumentForms(companyId, activeModule),
          loadModuleDocumentDefinitions(companyId, activeModule)
        ]);
        
        setForms(loadedForms);
        setDefinitions(loadedDefs);
      } catch (error) {
        console.error('Failed to load module data:', error);
        errorHandler.showError('Could not load designer data');
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [companyId, activeModule]);

  // Transform definitions into "Template Buttons" for the designer
  // In the real mechanism, these are the "Document Types" a user can clone
  const templates = definitions.map(def => ({
     id: def.id,
     name: def.name,
     code: def.code,
     headerFields: def.headerFields || [],
     lineFields: def.lineFields || [],
     tableColumns: def.tableColumns || [],
     layout: def.layout || { sections: [] },
     module: def.module,
     isSystemDefault: true
  }));

  // Extra system fields that are always available for any module
  const systemFields: AvailableField[] = [
    { id: 'documentId', label: 'Document Number', type: 'text', category: 'systemMetadata', autoManaged: true },
    { id: 'status', label: 'Status', type: 'text', category: 'systemMetadata', autoManaged: true },
    { id: 'createdAt', label: 'Creation Date', type: 'date', category: 'systemMetadata', autoManaged: true },
    { id: 'createdBy', label: 'Created By', type: 'text', category: 'systemMetadata', autoManaged: true },
  ];

  // Resolve available fields dynamically from the active definitions
  // This is the "Mechanism" - it shows the fields defined in the database
  const availableFields: AvailableField[] = Array.from(new Set(
    definitions.flatMap(def => [
      ...(Array.isArray(def.headerFields) ? def.headerFields : []),
      ...(Array.isArray(def.lineFields) ? def.lineFields : [])
    ])
  )).map(f => ({
    id: f.id,
    label: f.label,
    type: (f.type || 'text').toLowerCase() as any,
    category: 'shared',
    required: f.required
  }));

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
        // Reload list
        const updatedForms = await loadModuleDocumentForms(companyId, activeModule);
        setForms(updatedForms);
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
      // Update local state immediately for visual feedback
      setForms(prev => prev.map(f => f.id === id ? { ...f, enabled } : f));
      
      // Use lightweight updater — does NOT run the full canonical mapper
      const result = await updateFormMetadata(companyId, activeModule, id, { enabled }, user.uid);
      
      if (result.success) {
        errorHandler.showInfo(`Form ${enabled ? 'enabled' : 'disabled'} successfully.`);
      } else {
        // Revert local state on failure
        setForms(prev => prev.map(f => f.id === id ? { ...f, enabled: !enabled } : f));
        errorHandler.showError(result.errors?.[0] || 'Failed to update form status');
      }
    } catch (error) {
      // Revert local state on failure
      setForms(prev => prev.map(f => f.id === id ? { ...f, enabled: !enabled } : f));
      errorHandler.showError('Failed to update form status');
    }
  };

  const handleUpdateSidebarGroup = async (id: string, sidebarGroup: string | null) => {
    if (!companyId || !user) return;
    try {
      // Update local state immediately
      setForms(prev => prev.map(f => f.id === id ? { ...f, sidebarGroup } as any : f));
      
      const result = await updateFormMetadata(companyId, activeModule, id, { sidebarGroup }, user.uid);
      
      if (result.success) {
        errorHandler.showInfo(`Sidebar group ${sidebarGroup ? `set to "${sidebarGroup}"` : 'cleared'}.`);
      } else {
        // Revert on failure
        setForms(prev => prev.map(f => f.id === id ? { ...f, sidebarGroup: (f as any).sidebarGroup } : f));
        errorHandler.showError(result.errors?.[0] || 'Failed to update sidebar group');
      }
    } catch (error) {
      errorHandler.showError('Failed to update sidebar group');
    }
  };

  const handleDeleteForm = async (id: string) => {
    // This logic is mostly handled by useWizard but we should trigger a reload
    // In a real scenario, this would call specialized delete API
    setTimeout(async () => {
      const updatedForms = await loadModuleDocumentForms(companyId, activeModule);
      setForms(updatedForms);
    }, 500);
  };

  const handleManualSync = async () => {
    setLoading(true);
    try {
      if (activeModule === 'PURCHASE') {
        await purchasesApi.getSettings();
      } else if (activeModule === 'SALES') {
        await salesApi.getSettings();
      }
      
      // Reload the data
      const [loadedForms, loadedDefs] = await Promise.all([
        loadModuleDocumentForms(companyId, activeModule),
        loadModuleDocumentDefinitions(companyId, activeModule)
      ]);
      
      setForms(loadedForms);
      setDefinitions(loadedDefs);
      errorHandler.showInfo('Definitions synchronized with backend.');
    } catch (error) {
      console.error('Manual sync failed:', error);
      errorHandler.showError('Synchronization failed');
    } finally {
      setLoading(false);
    }
  };

  // Define module-specific default rules and actions
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

  if (loading && forms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <Loader2 className="animate-spin h-10 w-10 text-indigo-600 mb-4" />
        <p className="text-slate-500 font-medium animate-pulse">Initializing {activeModule} Designer...</p>
      </div>
    );
  }

  return (
    <WizardProvider initialForms={forms}>
      <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
        {/* Unified Header */}
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
                <span className="uppercase">Platform Tools</span>
                <ChevronRight size={12} />
                <span className="text-indigo-500 uppercase">{activeModule} Domain</span>
              </div>
            </div>
          </div>

          {/* Module Selector - Centered */}
          <div className="hidden lg:flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
            <ModuleTab 
              active={activeModule === 'ACCOUNTING'} 
              onClick={() => setActiveModule('ACCOUNTING')}
              icon={<FileText size={18} />}
              label="Accounting"
            />
            <ModuleTab 
              active={activeModule === 'SALES'} 
              onClick={() => setActiveModule('SALES')}
              icon={<ShoppingCart size={18} />}
              label="Sales"
            />
            <ModuleTab 
              active={activeModule === 'PURCHASE'} 
              onClick={() => setActiveModule('PURCHASE')}
              icon={<Package size={18} />}
              label="Purchase"
            />
          </div>

          {/* Actions - Right */}
          <div className="flex items-center gap-2">
            <button 
                onClick={handleManualSync}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-all active:scale-95"
                title="Synchronize Definitions"
              >
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                <span className="hidden xl:inline">Sync DB</span>
            </button>
            <div className="h-8 w-px bg-slate-200 mx-2"></div>
            <DocumentFormDesignerHeaderActions 
               onSaveForm={handleSaveForm}
               forms={forms}
            />
          </div>
        </header>

        {/* Mobile Module Selector (Visible only on small screens) */}
        <div className="lg:hidden bg-white border-b border-slate-200 p-2 flex justify-center gap-1">
             <ModuleTab 
              active={activeModule === 'ACCOUNTING'} 
              onClick={() => setActiveModule('ACCOUNTING')}
              icon={<FileText size={18} />}
              label="Accounting"
            />
            <ModuleTab 
              active={activeModule === 'SALES'} 
              onClick={() => setActiveModule('SALES')}
              icon={<ShoppingCart size={18} />}
              label="Sales"
            />
            <ModuleTab 
              active={activeModule === 'PURCHASE'} 
              onClick={() => setActiveModule('PURCHASE')}
              icon={<Package size={18} />}
              label="Purchase"
            />
        </div>

        {/* Main Designer Area */}
        <div className="flex-1 overflow-hidden relative">
          {isSaving && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-[60] flex items-center justify-center">
              <div className="bg-white p-6 rounded-2xl shadow-2xl flex items-center gap-4 border border-slate-100">
                  <Loader2 className="animate-spin text-indigo-600" size={32} />
                  <span className="text-lg font-bold text-slate-700">Saving Design Configuration...</span>
              </div>
            </div>
          )}

          <DocumentFormDesigner 
            key={activeModule} // Re-mount when module changes to ensure clean state
            templates={templates as any}
            systemFields={systemFields}
            availableFields={availableFields}
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
    </WizardProvider>
  );
}

/**
 * Extracted header actions for cleaner code
 */
function DocumentFormDesignerHeaderActions({ onSaveForm, forms }: { onSaveForm: any, forms: any[] }) {
    // This is a placeholder for the Export/Import/Create buttons 
    // that were originally inside DocumentFormDesigner's internal header.
    // By moving them here, we unify the UI.
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

function ModuleTab({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`
        flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-black transition-all duration-300
        ${active 
          ? 'bg-white text-indigo-600 shadow-md ring-1 ring-slate-200/50 translate-y-0 scale-100' 
          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 translate-y-0.5 scale-95'
        }
      `}
    >
      <span className={active ? 'text-indigo-600' : 'text-slate-400'}>{icon}</span>
      {label}
    </button>
  );
}
