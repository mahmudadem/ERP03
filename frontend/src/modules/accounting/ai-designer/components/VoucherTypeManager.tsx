import React, { useState } from 'react';
import { Plus, Edit3, Trash2, FileSpreadsheet, Search, LayoutDashboard } from 'lucide-react';
import { VoucherTypeDefinition } from '../../../../designer-engine/types/VoucherTypeDefinition';
import { VoucherDesigner } from './VoucherDesigner';
import { useVouchers } from '../VoucherContext';
import { Button } from './ui/Button';

interface VoucherTypeManagerProps {
  onExit: () => void;
}

export const VoucherTypeManager: React.FC<VoucherTypeManagerProps> = ({ onExit }) => {
  const [viewMode, setViewMode] = useState<'list' | 'designer'>('list');
  const [editingDefinition, setEditingDefinition] = useState<VoucherTypeDefinition | null>(null);
  const { definitions, addDefinition, updateDefinition, deleteDefinition } = useVouchers();

  const handleCreateNew = () => {
    setEditingDefinition(null); // Clear for new
    setViewMode('designer');
  };

  const handleEdit = (definition: VoucherTypeDefinition) => {
    setEditingDefinition(definition);
    setViewMode('designer');
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this voucher type?')) {
      deleteDefinition(id);
    }
  };

  const handleSave = (definition: VoucherTypeDefinition) => {
    // GUARD: Validate canonical
    if (definition.schemaVersion !== 2) {
      throw new Error('Cleanup violation: legacy view type detected. Only Schema V2 allowed.');
    }

    if (editingDefinition) {
      updateDefinition(editingDefinition.id, definition);
    } else {
      addDefinition(definition);
    }
    setViewMode('list');
  };

  const handleBack = () => {
    setViewMode('list');
  };

  // Helper: Get display prefix from code
  const getDisplayPrefix = (definition: VoucherTypeDefinition): string => {
    // Extract first 2-3 chars from code, or use module initial
    return definition.code?.substring(0, 3) || '???';
  };

  // Helper: Check if multi-line
  const isMultiLine = (definition: VoucherTypeDefinition): boolean => {
    return definition.tableColumns && definition.tableColumns.length > 0;
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 font-sans text-slate-800 overflow-hidden relative">
      
      {/* Modal Overlay for Designer */}
      {viewMode === 'designer' && (
        <div className="absolute inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-white rounded-xl shadow-2xl w-full h-full max-w-7xl overflow-hidden flex flex-col border border-gray-200">
               <VoucherDesigner 
                 initialDefinition={editingDefinition} 
                 onSave={handleSave} 
                 onCancel={handleBack} 
               />
           </div>
        </div>
      )}

      {/* Header */}
      <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-20 shrink-0">
         <div className="flex items-center gap-4">
            <button 
              onClick={onExit}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 transition-colors"
              title="Back to Dashboard"
            >
              <LayoutDashboard size={20} />
            </button>
            <div className="h-6 w-px bg-gray-200"></div>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {definitions && definitions.length > 0 ? (
              definitions.map(definition => (
                <div key={definition.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
                <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xl">
                        {getDisplayPrefix(definition)}
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                        <button 
                            onClick={() => handleEdit(definition)}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full"
                            title="Edit"
                            >
                            <Edit3 size={16} />
                        </button>
                        <button 
                            onClick={() => handleDelete(definition.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                            title="Delete"
                            >
                            <Trash2 size={16} />
                        </button>
                        </div>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{definition.name}</h3>
                    <p className="text-sm text-gray-500">Code: {definition.code}</p>
                    
                    <div className="mt-6 flex gap-2 flex-wrap">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                        Schema V{definition.schemaVersion}
                        </span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                        {isMultiLine(definition) ? 'Multi-Line' : 'Single-Line'}
                        </span>
                    </div>
                </div>
                <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
                    <span>Module: {definition.module}</span>
                </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-500 text-sm">No voucher types yet. Create one to get started!</p>
              </div>
            )}
            </div>
        </div>
      </div>
    </div>
  );
};