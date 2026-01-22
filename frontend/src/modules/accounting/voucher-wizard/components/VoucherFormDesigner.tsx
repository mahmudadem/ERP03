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
import { FormCard } from './FormCard';
import { WarningModal } from './WarningModal';
import { RequirePermission } from '../../../../components/auth/RequirePermission';
import { errorHandler } from '../../../../services/errorHandler';

interface Props { // Renamed from VoucherFormDesignerProps as per the snippet
  templates?: VoucherFormConfig[]; // System-wide templates for Step 1
  onExit?: () => void;
  onVoucherSaved?: (voucher: VoucherFormConfig, isEdit: boolean) => void;
  onDeleteForm?: (formId: string) => void;
  onToggleEnabled?: (formId: string, enabled: boolean) => void;
}

export const VoucherFormDesigner: React.FC<Props> = (props) => {
  const { 
    templates = [], 
    onExit,
    onVoucherSaved,
    onDeleteForm,
    onToggleEnabled
  } = props;
  // Reverted to original state management for now, as useVoucherForms is not defined.
  const [viewMode, setViewMode] = useState<'list' | 'designer'>('list');
  const [editingForm, setEditingForm] = useState<VoucherFormConfig | null>(null);
  const [isCloning, setIsCloning] = useState(false); // Track if we're cloning
  const [searchQuery, setSearchQuery] = useState('');
  const [warningModal, setWarningModal] = useState<{ isOpen: boolean; title: string; message: string; suggestion?: string }>({
    isOpen: false,
    title: '',
    message: '',
    suggestion: ''
  });
  const { forms: allForms, addForm, updateForm, deleteForm } = useWizard();

  // Filter forms based on search query
  const forms = allForms.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateNew = () => {
    setEditingForm(null); // Clear for new
    setIsCloning(false);
    setViewMode('designer');
  };

  const handleExportSingle = (form: VoucherFormConfig) => {
    // Export as single-element array for consistency dealing with import logic
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify([form], null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `voucher_form_${form.id}.json`);
    document.body.appendChild(downloadAnchorNode); 
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const isProtected = (form: VoucherFormConfig) => {
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

  const handleDelete = async (id: string) => {
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
    if (!window.confirm('⚠️ Are you sure you want to delete this form? This cannot be undone.')) {
      return;
    }
    
    try {
      await deleteForm(id);
      if (onDeleteForm) onDeleteForm(id);
    } catch (error: any) {
      const serverMessage = error.response?.data?.error || error.message;
      errorHandler.showError({
        code: 'DELETE_FAILED',
        message: serverMessage || 'Failed to delete form. It may be in use.',
        severity: 'ERROR'
      } as any);
    }
  };

  const handleToggleEnabled = async (formId: string, enabled: boolean) => {
    const form = allForms.find(f => f.id === formId);
    if (!form) return;

    try {
      // Update local state
      await updateForm({ ...form, enabled });

      // Notify parent to sync state (Parent handles database persistence)
      if (onToggleEnabled) {
          onToggleEnabled(formId, enabled);
      }
    } catch (error) {
      errorHandler.showError({
        code: 'UPDATE_FAILED',
        message: 'Failed to update form status. Please try again.',
        severity: 'ERROR'
      } as any);
    }
  };

  const handleClone = (form: VoucherFormConfig) => {
    const timestamp = Date.now();
    
    // Determine the base type (use existing baseType or fallback to code/id)
    const originalBaseType = (form as any).baseType || form.code || form.id;
    
    // Extract prefix from parent form (e.g., "JE-" -> "JE")
    const parentPrefix = form.prefix.replace('-', '').replace(/[^A-Z]/g, '');
    
    // Generate ID: PREFIX_TIMESTAMP_C (e.g., JE_1766619511000_C)
    const cloneId = `${parentPrefix}_${timestamp}_C`;
    
    const cloned: VoucherFormConfig = {
      ...form,
      // Use new pattern: PREFIX_TIMESTAMP_C
      id: cloneId,
      // Unique name with timestamp
      name: `${form.name} - Copy`,
      // Unique prefix (add 'C' to differentiate)
      prefix: `${parentPrefix}C-`,
      isSystemDefault: false,
      isLocked: false,
      // IMPORTANT: Preserve the base type for backend compatibility
      baseType: originalBaseType,
    } as any;
    setEditingForm(cloned);
    setIsCloning(true); // Mark as cloning, not editing
    setViewMode('designer');
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allForms, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "voucher_forms_export.json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const inputElement = e.target;
    if (inputElement.files && inputElement.files.length > 0) {
       fileReader.readAsText(inputElement.files[0], "UTF-8");
       fileReader.onload = (e) => {
          try {
            const importedForms = JSON.parse(e.target?.result as string);
            if (Array.isArray(importedForms)) {
               // Check if single or multiple forms
               if (importedForms.length === 0) {
                  errorHandler.showInfo('No forms found in file.');
               } else if (importedForms.length === 1) {
                  // Single form: Open in designer for review/edit
                  const form = importedForms[0];
                  
                  // Check for ID collision
                  const exists = allForms.find(f => f.id === form.id);
                  
                  // If exists, generate a copy ID
                  const newId = exists 
                    ? `${form.id}_IMPORT_${Math.floor(Math.random() * 1000)}` 
                    : form.id;
                    
                  const importedForm = { 
                    ...form, 
                    id: newId,
                    name: exists ? `${form.name} (Imported)` : form.name 
                  };
                  
                  // Populate designer with imported data
                  setEditingForm(importedForm);
                  setIsCloning(false); // This is an import, not a clone
                  setViewMode('designer');
                  
                  errorHandler.showInfo('Form loaded in designer. Review and save when ready.');
               } else {
                  // Multiple forms: Show warning that bulk import is not supported
                  errorHandler.showError({
                    code: 'IMPORT_ERROR',
                    message: `Import file contains ${importedForms.length} forms. Only single-form imports are supported.`,
                    severity: 'WARNING'
                  } as any);
                  errorHandler.showInfo('Please import one form at a time, or export individual forms for import.');
               }
            } else {
               throw new Error("Invalid file format: Expected an array of forms");
            }
          } catch (error: any) {
             errorHandler.showError({
                code: 'IMPORT_ERROR',
                message: "Failed to import forms: " + error.message,
                severity: "ERROR"
             } as any);
          }
          // Reset input
          if(inputElement) inputElement.value = '';
       };
    }
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
         <div className="flex items-center gap-2">
           <button 
             onClick={handleExport}
             className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-slate-600 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm transition-colors text-sm"
           >
             Export All
           </button>
           <label className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-slate-600 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm transition-colors text-sm cursor-pointer">
             Import
             <input type="file" accept=".json" onChange={handleImport} className="hidden" />
           </label>
           <RequirePermission permission="accounting.designer.create">
             <button 
               onClick={handleCreateNew}
               className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow transition-colors"
             >
               <Plus size={18} /> Create New Form
             </button>
           </RequirePermission>
         </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto w-full">
            {/* Search Bar */}
            <div className="mb-8 relative">
            <input 
                type="text" 
                placeholder="Search voucher forms..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900"
            />
            <Search className="absolute left-3 top-3.5 text-gray-400" size={20} />
            </div>

            {/* Grid List */}
            {allForms.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <FileSpreadsheet size={64} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-xl font-bold text-gray-600 mb-2">No Voucher Forms Yet</h3>
                <p className="text-gray-500 mb-6">Get started by designing your first voucher form</p>
                <RequirePermission permission="accounting.designer.create">
                  <button 
                    onClick={handleCreateNew}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow transition-colors"
                  >
                    <Plus size={20} /> Create New Form
                  </button>
                </RequirePermission>
              </div>
            ) : forms.length === 0 ? (
              <div className="text-center py-20 bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-200">
                <Search size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-xl font-bold text-gray-600 mb-2">No Matches Found</h3>
                <p className="text-gray-500 mb-4">No forms match your search "{searchQuery}"</p>
                <button 
                  onClick={() => setSearchQuery('')}
                  className="text-indigo-600 font-bold hover:underline"
                >
                  Clear search filter
                </button>
              </div>
            ) : (
              <div className="space-y-12">
                {/* --- SECTION: SYSTEM DEFAULTS --- */}
                {forms.filter(f => isProtected(f)).length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="h-8 w-1 bg-indigo-500 rounded-full"></div>
                      <h2 className="text-xl font-bold text-slate-800">System Voucher Templates</h2>
                      <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full font-medium">Read-Only</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {forms.filter(f => isProtected(f)).map((form: VoucherFormConfig) => (
                        <FormCard
                          key={form.id}
                          form={form}
                          isProtected={true}
                          onEdit={handleEdit}
                          onClone={handleClone}
                          onDelete={handleDelete}
                          onToggleEnabled={handleToggleEnabled}
                          onExport={handleExportSingle}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* divider if both sections exist */}
                {forms.filter(f => isProtected(f)).length > 0 && forms.filter(f => !isProtected(f)).length > 0 && (
                  <div className="border-t border-gray-100"></div>
                )}

                {/* --- SECTION: USER CUSTOMIZED --- */}
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-1 bg-green-500 rounded-full"></div>
                      <h2 className="text-xl font-bold text-slate-800">Your Custom Forms</h2>
                      <span className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded-full font-medium">Editable</span>
                    </div>
                    
                    {forms.filter(f => !isProtected(f)).length === 0 && (
                      <p className="text-sm text-gray-400">No custom forms created yet</p>
                    )}
                  </div>
                  
                  {forms.filter(f => !isProtected(f)).length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {forms.filter(f => !isProtected(f)).map((form: VoucherFormConfig) => (
                        <FormCard
                          key={form.id}
                          form={form}
                          isProtected={false}
                          onEdit={handleEdit}
                          onClone={handleClone}
                          onDelete={handleDelete}
                          onToggleEnabled={handleToggleEnabled}
                          onExport={handleExportSingle}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
                       <p className="text-gray-500">Clones or new forms will appear here.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};
