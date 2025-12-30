import React from 'react';
import { VoucherFormConfig } from '../types';
import { useFormUsageCheck } from '../../../../hooks/useFormUsageCheck';
import { Plus, Edit3, Trash2, Power, PowerOff } from 'lucide-react';
import { RequirePermission } from '../../../../components/auth/RequirePermission';

interface FormCardProps {
  form: VoucherFormConfig;
  isProtected: boolean;
  onEdit: (form: VoucherFormConfig) => void;
  onClone: (form: VoucherFormConfig) => void;
  onDelete: (formId: string) => void;
  onToggleEnabled: (formId: string, enabled: boolean) => void;
}

export const FormCard: React.FC<FormCardProps> = ({
  form,
  isProtected,
  onEdit,
  onClone,
  onDelete,
  onToggleEnabled
}) => {
  const { isInUse, voucherCount, isChecking } = useFormUsageCheck(form.id);
  const isEnabled = form.enabled !== false; // Default to enabled

  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden group ${
      !isEnabled ? 'opacity-60' : ''
    }`}>
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className={`w-12 h-12 rounded-full ${
            isProtected ? 'bg-indigo-50 text-indigo-600' : 'bg-green-50 text-green-600'
          } flex items-center justify-center font-bold text-xl`}>
            {form.prefix?.replace('-', '') || form.id.slice(0, 2).toUpperCase()}
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
            <RequirePermission permission="accounting.designer.create">
              <button 
                onClick={() => onClone(form)}
                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-full"
                title="Clone"
              >
                <Plus size={16} />
              </button>
            </RequirePermission>
            
            <RequirePermission permission="accounting.designer.modify">
              <button 
                onClick={() => onEdit(form)}
                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full"
                title={isProtected ? "View / Restricted Edit" : "Edit"}
              >
                <Edit3 size={16} />
              </button>
            </RequirePermission>
            
            {/* Enable/Disable Toggle - Professional Look */}
            <RequirePermission permission="accounting.designer.modify">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-full px-2 py-1 ml-1 group/toggle">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleEnabled(form.id, !isEnabled);
                  }}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                    isEnabled ? 'bg-green-500' : 'bg-slate-300'
                  }`}
                  title={isEnabled ? "Deactivate" : "Activate"}
                >
                  <span
                    aria-hidden="true"
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out ${
                      isEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 w-11 text-center">
                  {isEnabled ? 'Active' : 'Off'}
                </span>
              </div>
            </RequirePermission>
            
            {/* Delete - only for unused, non-protected forms */}
            {!isProtected && (
              <RequirePermission permission="accounting.designer.modify">
                <button 
                  onClick={() => onDelete(form.id)}
                  disabled={isInUse}
                  className={`p-2 rounded-full ${
                    isInUse 
                      ? 'text-gray-300 cursor-not-allowed' 
                      : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                  }`}
                  title={isInUse ? `Cannot delete: ${voucherCount} voucher(s) exist` : "Delete"}
                >
                  <Trash2 size={16} />
                </button>
              </RequirePermission>
            )}
          </div>
        </div>
        
        <h3 className="text-lg font-bold text-gray-900 mb-1">{form.name}</h3>
        <p className="text-xs text-gray-500 truncate">ID: {form.id}</p>
        
        <div className="mt-6 flex gap-2 flex-wrap">
          {isProtected ? (
            <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
              🔒 System
            </span>
          ) : (
            <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
              ✨ Custom
            </span>
          )}
          
          {!isEnabled && (
            <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded uppercase tracking-wider">
              ⏸ Disabled
            </span>
          )}
          
          {isInUse && (
            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded uppercase tracking-wider">
              📊 {voucherCount} voucher{voucherCount !== 1 ? 's' : ''}
            </span>
          )}
          
          <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded uppercase tracking-wider">
            Start #: {form.startNumber}
          </span>
        </div>
      </div>
      
      <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
        <span>{isProtected ? 'System Template' : 'User Created'}</span>
        {isChecking && <span className="text-blue-600">Checking usage...</span>}
      </div>
    </div>
  );
};
