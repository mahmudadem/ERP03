/**
 * Voucher Form Designer Manager
 * 
 * ⚠️ PURE UI COMPONENT
 * 
 * Displays a list of voucher form/template configurations and opens the designer.
 * Does NOT persist to database - only manages UI state.
 * 
 * Actual persistence happens via callback when form is saved.
 */

import React, { useState } from 'react';
import { Plus, Edit3, Trash2, FileSpreadsheet, Search, LayoutDashboard } from 'lucide-react';
import { VoucherFormConfig } from '../types';
import { VoucherDesigner } from './VoucherDesigner';
import { useWizard } from '../WizardContext';
import { AccountsProvider } from '../../../../context/AccountsContext';
import { WarningModal } from './WarningModal';

interface VoucherFormDesignerProps {
  templates?: VoucherFormConfig[]; // System-wide templates for Step 1
  onExit?: () => void;
  onVoucherSaved?: (voucher: VoucherFormConfig, isEdit: boolean) => void;
}

export const VoucherFormDesigner: React.FC<VoucherFormDesignerProps> = ({ templates = [], onExit, onVoucherSaved }) => {
  const [viewMode, setViewMode] = useState<'list' | 'designer'>('list');
  const [editingForm, setEditingForm] = useState<VoucherFormConfig | null>(null);
  const [isCloning, setIsCloning] = useState(false); // Track if we're cloning
  const [warningModal, setWarningModal] = useState<{ isOpen: boolean; title: string; message: string; suggestion?: string }>({
    isOpen: false,
    title: '',
    message: '',
    suggestion: ''
  });
  const { forms, addForm, updateForm, deleteForm } = useWizard();

  const handleCreateNew = () => {
    setEditingForm(null); // Clear for new
    setIsCloning(false);
    setViewMode('designer');
  };

  const isProtected = (form: VoucherFormConfig) => {
    // Protection is based ONLY on database flags, not hardcoded IDs
    return form.isSystemDefault || form.isLocked || (form as any).isSystemGenerated || (form as any).isDefault;
  };

  const handleEdit = (form: VoucherFormConfig) => {
    if (isProtected(form)) {
      setWarningModal({
        isOpen: true,
        title: 'System Default Voucher',
        message: 'This is a system default voucher that cannot be edited or deleted directly to preserve system integrity.',
        suggestion: 'Please use the Clone (+) button to create a customizable copy that you can modify.'
      });
      return;
    }
    setEditingForm(form);
    setIsCloning(false);
    setViewMode('designer');
  };

  const handleDelete = (id: string) => {
    const form = forms.find(f => f.id === id);
    if (form && isProtected(form)) {
      setWarningModal({
        isOpen: true,
        title: 'Cannot Delete System Voucher',
        message: 'This is a system default voucher that is protected from deletion to maintain system integrity.',
        suggestion: 'If you need a different configuration, please clone this voucher and customize the copy instead.'
      });
      return;
    }
    if (window.confirm('Are you sure you want to delete this voucher form?')) {
      deleteForm(id);
    }
  };

  const handleClone = (form: VoucherFormConfig) => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 7); // 5 random chars
    
    // Determine the base type (use existing baseType or fallback to code/id)
    const originalBaseType = (form as any).baseType || form.code || form.id;
    
    const cloned: VoucherFormConfig = {
      ...form,
      // Truly unique ID
      id: `clone_${random}_${timestamp}`,
      // Unique name with timestamp
      name: `${form.name} - Copy`,
      // Unique prefix (add 'C' to differentiate)
      prefix: `${form.prefix.replace('-', '')}C${random.toUpperCase()}-`,
      isSystemDefault: false,
      isLocked: false,
      // IMPORTANT: Preserve the base type for backend compatibility
      baseType: originalBaseType,
    } as any;
    setEditingForm(cloned);
    setIsCloning(true); // Mark as cloning, not editing
    setViewMode('designer');
  };

  const handleSave = (config: VoucherFormConfig) => {
    // If cloning, treat as CREATE not UPDATE
    const isEdit = !!editingForm && !isCloning;
    
    if (isEdit) {
        updateForm(config);
    } else {
        addForm(config);
    }
    
    // Notify parent if callback provided
    onVoucherSaved?.(config, isEdit);
    
    setViewMode('list');
    setIsCloning(false); // Reset flag
  };

  const handleBack = () => {
    setViewMode('list');
    setIsCloning(false); // Reset flag
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 font-sans text-slate-800 overflow-hidden relative">
      
      {/* Warning Modal */}
      <WarningModal
        isOpen={warningModal.isOpen}
        onClose={() => setWarningModal({ ...warningModal, isOpen: false })}
        title={warningModal.title}
        message={warningModal.message}
        suggestion={warningModal.suggestion}
      />
      
      {/* Modal Overlay for Designer */}
      {viewMode === 'designer' && (
        <div className="absolute inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center p-8">
           <div className="bg-white rounded-xl shadow-2xl w-full h-full max-w-6xl overflow-hidden flex flex-col border border-gray-200">
               <AccountsProvider>
                 <VoucherDesigner 
                   initialConfig={editingForm}
                   availableTemplates={templates}
                   onSave={handleSave} 
                   onCancel={handleBack} 
                 />
               </AccountsProvider>
           </div>
        </div>
      )}

      {/* Header */}
      <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-20 shrink-0">
         <div className="flex items-center gap-4">
            {onExit && (
              <>
                <button 
                  onClick={onExit}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 transition-colors"
                  title="Back to Dashboard"
                >
                  <LayoutDashboard size={20} />
                </button>
                <div className="h-6 w-px bg-gray-200"></div>
              </>
            )}
            <div className="flex items-center gap-3">
                <div className="bg-indigo-600 text-white p-2 rounded-lg">
                <FileSpreadsheet size={20} />
                </div>
                <div>
                <h1 className="text-lg font-bold text-slate-800 leading-tight">Voucher Form Designer</h1>
                <p className="text-xs text-slate-500">Manage your accounting document layouts</p>
                </div>
            </div>
         </div>
         <button 
           onClick={handleCreateNew}
           className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow transition-colors"
         >
           <Plus size={18} /> Create New Form
         </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto w-full">
            {/* Search Bar */}
            <div className="mb-6 relative">
            <input 
                type="text" 
                placeholder="Search voucher forms..." 
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900"
            />
            <Search className="absolute left-3 top-3.5 text-gray-400" size={20} />
            </div>

            {/* Grid List */}
            {forms.length === 0 ? (
              <div className="text-center py-20">
                <FileSpreadsheet size={64} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-xl font-bold text-gray-600 mb-2">No Voucher Forms Yet</h3>
                <p className="text-gray-500 mb-6">Get started by designing your first voucher form</p>
                <button 
                  onClick={handleCreateNew}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow transition-colors"
                >
                  <Plus size={20} /> Create New Form
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {forms.map((form: VoucherFormConfig) => (
                  <div key={form.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
                  <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                          <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xl">
                          {form.prefix.replace('-', '')}
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                            <button 
                                onClick={() => handleClone(form)}
                                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-full"
                                title="Clone"
                                >
                                <Plus size={16} />
                            </button>
                            <button 
                                onClick={() => handleEdit(form)}
                                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full"
                                title="Edit"
                                >
                                <Edit3 size={16} />
                            </button>
                            <button 
                                onClick={() => handleDelete(form.id)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                                title="Delete"
                                >
                                <Trash2 size={16} />
                            </button>
                          </div>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 mb-1">{form.name}</h3>
                      <p className="text-sm text-gray-500">ID: {form.id}</p>
                      
                      <div className="mt-6 flex gap-2 flex-wrap">
                          {isProtected(form) && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-semibold">
                            🔒 System Template
                            </span>
                          )}
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          Start #: {form.startNumber}
                          </span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          {form.isMultiLine ? 'Multi-Line' : 'Single-Line'}
                          </span>
                      </div>
                  </div>
                  <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
                      <span>Last Modified: Today</span>
                  </div>
                  </div>
              ))}
              </div>
            )}
        </div>
      </div>
    </div>
  );
};
