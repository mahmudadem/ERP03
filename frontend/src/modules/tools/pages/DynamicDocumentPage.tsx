import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { useAuth } from '../../../context/AuthContext';
import { 
  loadModuleDocumentForms, 
  DocumentFormConfig,
  AvailableField
} from '../forms-designer';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { 
  Loader2, 
  Plus, 
  RefreshCw, 
  ArrowLeft,
  FileText,
  AlertCircle
} from 'lucide-react';
import { errorHandler } from '../../../services/errorHandler';
// We'll try to reuse the Voucher renderer if possible, or build a simplified one
import { GenericVoucherRenderer } from '../../accounting/components/shared/GenericVoucherRenderer';
import { useUserPreferences } from '../../../hooks/useUserPreferences';
import { useWindowManager } from '../../../context/WindowManagerContext';

export const DynamicDocumentPage: React.FC = () => {
  const { formCode, id } = useParams<{ formCode: string; id?: string }>();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { companyId } = useCompanyAccess();
  const { user } = useAuth();
  const { uiMode } = useUserPreferences();
  const { openWindow } = useWindowManager();

  const [loading, setLoading] = useState(true);
  const [formConfig, setFormConfig] = useState<DocumentFormConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isNew = pathname.endsWith('/new');
  const isEditor = !!id || isNew;
  const module = pathname.split('/')[1].toUpperCase(); // SALES or PURCHASES (mapped later)
  const normalizedModule = module === 'PURCHASES' ? 'PURCHASE' : module;

  useEffect(() => {
    async function init() {
      if (!companyId || !formCode) return;
      
      setLoading(true);
      setError(null);
      try {
        const forms = await loadModuleDocumentForms(companyId, normalizedModule);
        // Find form by code (normalized: replace dashes with underscores if needed)
        const code = formCode.replace(/-/g, '_');
        const found = forms.find(f => 
          f.code?.toLowerCase() === code.toLowerCase() || 
          f.id.toLowerCase() === code.toLowerCase()
        );

        if (!found) {
          setError(`Document form "${formCode}" not found.`);
        } else {
          setFormConfig(found);
        }
      } catch (err: any) {
        console.error('Failed to load dynamic document config:', err);
        setError('Failed to load document configuration.');
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [companyId, formCode, normalizedModule]);

  // Function to trigger the MDI window
  const handleOpenInWindow = () => {
    if (!formConfig) return;
    openWindow({
      type: 'voucher',
      title: isNew ? `New ${formConfig.name}` : `Edit ${formConfig.name}`,
      data: {
        ...formConfig,
        id: id === 'new' ? undefined : id,
        voucherConfig: formConfig, // Required for VoucherWindow
        status: 'Draft',
        sourceModule: normalizedModule.toLowerCase(), // Critical for non-accounting saves
        lines: [],
        metadata: {
          formId: formConfig.id,
          module: normalizedModule,
          source: 'DYNAMIC_FORM'
        }
      }
    });
    // Navigate back to the list so the background shows the document table
    const listPath = pathname.split('/').slice(0, -1).join('/');
    navigate(listPath);
  };

  // AUTO-TRIGGER: If in windows mode, pop the window immediately on mount
  // CRITICAL: This MUST be before any conditional returns (like if (loading))
  useEffect(() => {
    if (isEditor && uiMode === 'windows' && formConfig && !loading) {
      handleOpenInWindow();
    }
  }, [uiMode, isEditor, !!formConfig, loading]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <Loader2 className="animate-spin h-8 w-8 text-indigo-600 mb-2" />
        <p className="text-slate-500 font-medium">Loading {formCode}...</p>
      </div>
    );
  }

  if (error || !formConfig) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-6 text-center">
        <AlertCircle className="text-red-500 mb-4" size={48} />
        <h2 className="text-xl font-bold text-slate-800 mb-2">Configuration Error</h2>
        <p className="text-slate-500 max-w-md mb-6">{error || 'Unknown error'}</p>
        <Button onClick={() => navigate(-1)} variant="outline">
          <ArrowLeft size={16} className="mr-2" /> Go Back
        </Button>
      </div>
    );
  }

  // --- RENDER EDITOR ---
  // Note: In Windows mode, we don't render the editor full-page; 
  // we trigger handleOpenInWindow (via useEffect) and then the component 
  // proceeds to render the List view below.
  if (isEditor && uiMode !== 'windows') {
    return (
      <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-800">
                {isNew ? `New ${formConfig.name}` : `Edit ${formConfig.name}`}
              </h1>
              <p className="text-xs text-slate-400">#{formCode}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
             <Button className="bg-indigo-600">Save Document</Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8 flex justify-center">
          <div className="w-full max-w-5xl">
             <Card className="p-0 overflow-hidden border-none shadow-xl bg-white">
                <GenericVoucherRenderer 
                   definition={formConfig as any} 
                   mode="classic" 
                   readOnly={false}
                />
             </Card>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER LIST ---
  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-6 py-5 flex items-center justify-between shadow-sm z-10">
           <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{formConfig.name}</h1>
              <p className="text-sm text-slate-500">Manage your {formConfig.name.toLowerCase()} documents.</p>
           </div>
           <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => window.location.reload()} size="sm">
                <RefreshCw size={14} className="mr-2" /> Refresh
              </Button>
              <Button 
                onClick={() => navigate(`${pathname}/new`)} 
                className="bg-indigo-600 hover:bg-indigo-700 shadow-md transition-all active:scale-95"
              >
                <Plus size={18} className="mr-1.5" /> New {formConfig.name}
              </Button>
           </div>
        </header>

        <div className="flex-1 p-6 overflow-hidden flex flex-col">
           <Card className="flex-1 flex flex-col bg-white border-slate-200 shadow-sm overflow-hidden rounded-xl">
              <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
                 <div className="bg-slate-100 p-6 rounded-full text-slate-300 mb-6">
                    <FileText size={64} />
                 </div>
                 <h3 className="text-xl font-bold text-slate-800 mb-2">No Documents Found</h3>
                 <p className="text-slate-500 max-w-sm mb-8">
                   You haven't created any {formConfig.name.toLowerCase()} records yet using this layout.
                 </p>
                 <Button 
                    onClick={() => navigate(`${pathname}/new`)}
                    className="bg-indigo-600 rounded-xl px-8"
                 >
                   Create First Document
                 </Button>
              </div>
           </Card>
        </div>
    </div>
  );
};

export default DynamicDocumentPage;
