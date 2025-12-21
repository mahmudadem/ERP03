/**
 * Voucher Type Manager
 * 
 * ⚠️ PURE UI COMPONENT
 * 
 * Displays a list of voucher type configurations and opens the designer.
 * Does NOT persist to database - only manages UI state.
 * 
 * Actual persistence happens via callback when voucher is saved.
 */

import React, { useState } from 'react';
import { Plus, Edit3, Trash2, FileSpreadsheet, Search, LayoutDashboard } from 'lucide-react';
import { VoucherTypeConfig } from '../types';
import { VoucherDesigner } from './VoucherDesigner';
import { useWizard } from '../WizardContext';

interface VoucherTypeManagerProps {
  templates?: VoucherTypeConfig[]; // System-wide templates for Step 1
  onExit?: () => void;
  onVoucherSaved?: (voucher: VoucherTypeConfig, isEdit: boolean) => void;
}

export const VoucherTypeManager: React.FC<VoucherTypeManagerProps> = ({ templates = [], onExit, onVoucherSaved }) => {
  const [viewMode, setViewMode] = useState<'list' | 'designer'>('list');
  const [editingVoucher, setEditingVoucher] = useState<VoucherTypeConfig | null>(null);
  const [isCloning, setIsCloning] = useState(false); // Track if we're cloning
  const { vouchers, addVoucher, updateVoucher, deleteVoucher } = useWizard();

  const handleCreateNew = () => {
    setEditingVoucher(null); // Clear for new
    setIsCloning(false);
    setViewMode('designer');
  };

  const handleEdit = (voucher: VoucherTypeConfig) => {
    setEditingVoucher(voucher);
    setIsCloning(false);
    setViewMode('designer');
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this voucher type?')) {
      deleteVoucher(id);
    }
  };

  const handleClone = (voucher: VoucherTypeConfig) => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 7); // 5 random chars
    
    const cloned: VoucherTypeConfig = {
      ...voucher,
      // Truly unique ID
      id: `clone_${random}_${timestamp}`,
      // Unique name with timestamp
      name: `${voucher.name} - Copy`,
      // Unique prefix (add 'C' to differentiate)
      prefix: `${voucher.prefix.replace('-', '')}C${random.toUpperCase()}-`,
      isSystemDefault: false,
      isLocked: false,
    };
    setEditingVoucher(cloned);
    setIsCloning(true); // Mark as cloning, not editing
    setViewMode('designer');
  };

  const handleSave = (config: VoucherTypeConfig) => {
    // If cloning, treat as CREATE not UPDATE
    const isEdit = !!editingVoucher && !isCloning;
    
    if (isEdit) {
        updateVoucher(config);
    } else {
        addVoucher(config);
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
      
      {/* Modal Overlay for Designer */}
      {viewMode === 'designer' && (
        <div className="absolute inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center p-8">
           <div className="bg-white rounded-xl shadow-2xl w-full h-full max-w-6xl overflow-hidden flex flex-col border border-gray-200">
               <VoucherDesigner 
                 initialConfig={editingVoucher}
                 availableTemplates={templates}
                 onSave={handleSave} 
                 onCancel={handleBack} 
               />
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
                <h1 className="text-lg font-bold text-slate-800 leading-tight">Voucher Designer</h1>
                <p className="text-xs text-slate-500">Manage your accounting document definitions</p>
                </div>
            </div>
         </div>
         <button 
           onClick={handleCreateNew}
           className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow transition-colors"
         >
           <Plus size={18} /> Create New Type
         </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto w-full">
            {/* Search Bar */}
            <div className="mb-6 relative">
            <input 
                type="text" 
                placeholder="Search voucher types..." 
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900"
            />
            <Search className="absolute left-3 top-3.5 text-gray-400" size={20} />
            </div>

            {/* Grid List */}
            {vouchers.length === 0 ? (
              <div className="text-center py-20">
                <FileSpreadsheet size={64} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-xl font-bold text-gray-600 mb-2">No Voucher Types Yet</h3>
                <p className="text-gray-500 mb-6">Get started by creating your first voucher type</p>
                <button 
                  onClick={handleCreateNew}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow transition-colors"
                >
                  <Plus size={20} /> Create New Type
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {vouchers.map(voucher => (
                  <div key={voucher.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
                  <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                          <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xl">
                          {voucher.prefix.replace('-', '')}
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                          {voucher.isSystemDefault || voucher.isLocked ? (
                            <button 
                                onClick={() => handleClone(voucher)}
                                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-full"
                                title="Clone"
                                >
                                <Plus size={16} />
                            </button>
                          ) : (
                            <>
                              <button 
                                  onClick={() => handleEdit(voucher)}
                                  className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full"
                                  title="Edit"
                                  >
                                  <Edit3 size={16} />
                              </button>
                              <button 
                                  onClick={() => handleDelete(voucher.id)}
                                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                                  title="Delete"
                                  >
                                  <Trash2 size={16} />
                              </button>
                            </>
                          )}
                          </div>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 mb-1">{voucher.name}</h3>
                      <p className="text-sm text-gray-500">ID: {voucher.id}</p>
                      
                      <div className="mt-6 flex gap-2 flex-wrap">
                          {voucher.isSystemDefault && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-semibold">
                              🔒 System Default
                            </span>
                          )}
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          Start #: {voucher.startNumber}
                          </span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          {voucher.isMultiLine ? 'Multi-Line' : 'Single-Line'}
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
