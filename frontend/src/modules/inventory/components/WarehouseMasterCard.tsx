
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Warehouse, 
  MapPin, 
  Settings, 
  Layers, 
  FileText,
  GitBranch,
  CheckCircle2,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { InventoryWarehouseDTO, inventoryApi } from '../../../api/inventoryApi';
import { useRBAC } from '../../../api/rbac/useRBAC';
import { MasterCardLayout, FormSection, Field, MasterCardTab } from '../../../components/layout/MasterCardLayout';
import { generateNextCode, CODE_PATTERNS } from '../../../utils/codeGenerator';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

interface WarehouseMasterCardProps {
  warehouseId?: string;
  isWindow?: boolean;
  onClose?: () => void;
  onSaved?: (warehouse: InventoryWarehouseDTO) => void;
}

const WAREHOUSE_TABS: MasterCardTab[] = [
  { id: 'GENERAL', label: 'Basic Info', icon: FileText },
  { id: 'HIERARCHY', label: 'Structure', icon: GitBranch },
  { id: 'LOCATION', label: 'Address', icon: MapPin },
];

const WarehouseMasterCard: React.FC<WarehouseMasterCardProps> = ({ 
  warehouseId, 
  isWindow = false, 
  onClose, 
  onSaved 
}) => {
  const { hasPermission } = useRBAC();
  const [activeTab, setActiveTab] = useState('GENERAL');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);

  const [form, setForm] = useState<Partial<InventoryWarehouseDTO>>({
    name: '',
    code: '',
    address: '',
    parentId: null,
    active: true,
    isDefault: false
  });

  const isNew = !warehouseId || warehouseId === 'new';
  const canEdit = hasPermission('inventory.warehouses.manage');

  useEffect(() => {
    loadWarehouses();
    if (!isNew && warehouseId) loadWarehouse(warehouseId);
  }, [warehouseId]);

  const loadWarehouses = async () => {
    try {
      const result = await inventoryApi.listWarehouses();
      setWarehouses(unwrap<InventoryWarehouseDTO[]>(result) || []);
    } catch (err) { console.error(err); }
  };

  const loadWarehouse = async (id: string) => {
    try {
      setLoading(true);
      const result = await inventoryApi.getWarehouse(id);
      setForm(result);
    } catch (err) { setError('Failed to load warehouse'); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const res = isNew 
        ? await inventoryApi.createWarehouse(form as any)
        : await inventoryApi.updateWarehouse(warehouseId!, form as any);
      onSaved?.(res);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleAutoGenerateCode = async () => {
    try {
      setError(null);
      const res = await inventoryApi.listWarehouses();
      const list = unwrap<InventoryWarehouseDTO[]>(res) || [];
      const codes = list.map(w => w.code);
      const nextCode = generateNextCode(codes, CODE_PATTERNS.WAREHOUSE);
      setForm(p => ({ ...p, code: nextCode }));
    } catch (err) {
      setError('Auto-numbering failed');
    }
  };

  const parentOptions = useMemo(() => {
    return warehouses.filter(w => w.id !== warehouseId);
  }, [warehouses, warehouseId]);

  if (loading) return <div className="p-20 text-center opacity-50 text-[10px] uppercase font-bold tracking-widest">Resolving Supply Chain Node...</div>;

  return (
    <MasterCardLayout
      title={form.name || 'Warehouse'}
      subtitle={isNew ? 'New Storage Location' : 'Storage Node Master Details'}
      identifier={form.code}
      icon={Warehouse}
      tabs={WAREHOUSE_TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      isWindow={isWindow}
      isNew={isNew}
      saving={saving}
      canEdit={canEdit}
      onSave={handleSave}
      onClose={onClose}
      updatedAt={form.updatedAt}
      error={error}
    >
      {activeTab === 'GENERAL' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <FormSection title="Site Identity">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Locality Code" required>
                <div className="relative flex items-center gap-1 group">
                   <input 
                      disabled={!isNew}
                      className="form-control font-bold pr-10" 
                      value={form.code} 
                      onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} 
                      placeholder="e.g. WH-001"
                   />
                   {isNew && (
                      <button 
                         type="button"
                         onClick={handleAutoGenerateCode}
                         className="absolute right-2 p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded transition-all opacity-0 group-hover:opacity-100"
                         title="Magic Sequence"
                      >
                         <Sparkles size={14} />
                      </button>
                   )}
                </div>
              </Field>
              <Field label="System Default">
                 <select className="form-control" value={String(form.isDefault)} onChange={e => setForm(p => ({ ...p, isDefault: e.target.value === 'true' }))}>
                    <option value="false">Standard Site</option>
                    <option value="true">Primary (Default)</option>
                 </select>
              </Field>
              <div className="col-span-2">
                <Field label="Full Location Name" required>
                  <input className="form-control font-medium" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </Field>
              </div>
            </div>
          </FormSection>
          <FormSection title="Operational Status">
             <Field label="Active Status">
                 <select className="form-control" value={String(form.active)} onChange={e => setForm(p => ({ ...p, active: e.target.value === 'true' }))}>
                    <option value="true">ACTIVE / OPERATIONAL</option>
                    <option value="false">CLOSED / MAINTENANCE</option>
                 </select>
              </Field>
          </FormSection>
        </div>
      )}

      {activeTab === 'HIERARCHY' && (
        <div className="space-y-6 animate-in fade-in duration-300">
           <FormSection title="Parent Connectivity">
              <Field label="Reporting Parent Warehouse">
                 <select className="form-control" value={form.parentId || ''} onChange={e => setForm(p => ({ ...p, parentId: e.target.value || null }))}>
                    <option value="">(None - Top Level)</option>
                    {parentOptions.map(p => (
                        <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                    ))}
                 </select>
                 <p className="text-[9px] text-slate-400 mt-2 italic uppercase">Sub-warehouses are used for site zones, racks, or specific rooms without affecting direct inventory lookup.</p>
              </Field>
           </FormSection>
        </div>
      )}

      {activeTab === 'LOCATION' && (
        <div className="space-y-6 animate-in fade-in duration-300">
           <FormSection title="Geographical Location">
              <Field label="Physical Address / GPS Coordinates">
                 <div className="relative">
                    <MapPin size={14} className="absolute left-3 top-2.5 text-slate-400" />
                    <textarea rows={4} className="form-control pl-9 pt-2 text-xs" value={form.address || ''} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
                 </div>
              </Field>
           </FormSection>
        </div>
      )}

      <style>{`
        .form-control { width: 100%; border-radius: 0.375rem; border: 1px solid #cbd5e1; padding: 0.5rem 0.75rem; font-size: 0.75rem; outline: none; transition: all 0.2s; background: #fff; }
        .form-control:focus { border-color: #2563eb; ring: 2px solid #2563eb; }
        .dark .form-control { background: #0f172a; border-color: #334155; color: #f1f5f9; }
      `}</style>
    </MasterCardLayout>
  );
};

export default WarehouseMasterCard;
