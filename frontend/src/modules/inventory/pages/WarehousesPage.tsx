
import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { InventoryWarehouseDTO, inventoryApi } from '../../../api/inventoryApi';
import WarehouseMasterCard from '../components/WarehouseMasterCard';
import { Plus, Warehouse as WarehouseIcon, Search, Layers, ChevronRight, Edit3 } from 'lucide-react';
import { clsx } from 'clsx';
import { useWindowManager } from '../../../context/WindowManagerContext';
import { useUserPreferences } from '../../../hooks/useUserPreferences';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const ROOT_KEY = '__ROOT__';

const WarehousesPage: React.FC = () => {
  const { openWindow } = useWindowManager();
  const { uiMode } = useUserPreferences();
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const result = await inventoryApi.listWarehouses();
      setWarehouses(unwrap<InventoryWarehouseDTO[]>(result) || []);
    } catch (error) {
      console.error('Failed to load warehouses', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleWarehouseClick = (id: string, name: string) => {
    if (uiMode === 'windows') {
       openWindow({
         type: 'warehouse',
         title: `Logistics Node: ${name}`,
         data: { warehouseId: id },
         size: { width: 900, height: 600 }
       });
    } else {
       setEditingId(id);
    }
  };

  const handleAddWarehouse = () => {
    if (uiMode === 'windows') {
       openWindow({
         type: 'warehouse',
         title: 'New Storage Node',
         data: { warehouseId: 'new' },
         size: { width: 900, height: 600 }
       });
    } else {
       setIsAdding(true);
    }
  };

  const childrenByParent = useMemo(() => {
    const map = new Map<string, InventoryWarehouseDTO[]>();
    for (const warehouse of warehouses) {
      const key = warehouse.parentId || ROOT_KEY;
      const current = map.get(key) || [];
      current.push(warehouse);
      map.set(key, current);
    }
    return map;
  }, [warehouses]);

  const renderTree = (parentId: string, depth: number): React.ReactNode => {
    const nodes = childrenByParent.get(parentId) || [];
    return nodes.map((warehouse) => (
      <div key={warehouse.id} className="animate-in slide-in-from-left-2 duration-200">
        <div className={clsx(
            "group flex items-center justify-between py-3 border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-all",
            depth > 0 ? "ml-6 border-l pl-4" : ""
        )}>
          <div className="flex items-center gap-3">
            <div className={clsx(
                "p-2 rounded-lg",
                warehouse.isDefault ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400"
            )}>
                <WarehouseIcon size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{warehouse.name}</span>
                <span className="text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">{warehouse.code}</span>
                {warehouse.isDefault && <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest pl-2">DEFAULT</span>}
              </div>
              <div className="text-[11px] text-slate-400 line-clamp-1 max-w-md">{warehouse.address || 'No physical address defined'}</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className={clsx(
                 "text-[9px] font-black px-2 py-0.5 rounded-full border tracking-widest uppercase",
                 warehouse.active ? "border-green-200 text-green-600 bg-green-50" : "border-slate-200 text-slate-400 bg-slate-50"
             )}>
                {warehouse.active ? 'Operational' : 'Inactive'}
             </div>
             <button 
                onClick={() => handleWarehouseClick(warehouse.id, warehouse.name)}
                className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-all"
             >
                <Edit3 size={16} />
             </button>
          </div>
        </div>
        {renderTree(warehouse.id, depth + 1)}
      </div>
    ));
  };

  const handleSaved = () => {
    setEditingId(null);
    setIsAdding(false);
    load();
  };

  // Switch to Master Card if editing or adding
  if (editingId || isAdding) {
    return (
      <WarehouseMasterCard 
        warehouseId={editingId || 'new'} 
        onClose={() => { setEditingId(null); setIsAdding(false); }}
        onSaved={handleSaved}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      <div className="flex-none p-6 border-b bg-white dark:bg-slate-900 shadow-sm relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-100 dark:shadow-none">
                <Layers size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Warehouse Logistics</h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-[0.15em]">Distribution Nodes & Global Storage Hierarchy</p>
            </div>
          </div>
          <button 
            onClick={handleAddWarehouse}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-md transition-all uppercase tracking-widest"
          >
            <Plus size={16} />
            AUTHORIZE NEW WAREHOUSE
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
        <div className="mx-auto max-w-5xl">
          <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
            <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                    <Search size={14} /> Master Directory
                </div>
                {loading && <div className="text-[10px] text-blue-500 font-black animate-pulse uppercase tracking-tighter">Syncing Nodes...</div>}
            </div>
            
            <div className="p-6">
              {warehouses.length === 0 && !loading ? (
                <div className="py-20 text-center space-y-4">
                    <div className="inline-flex p-6 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-300">
                        <WarehouseIcon size={48} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-600 dark:text-slate-400">No Warehouses Registered</p>
                        <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">Start by clicking the button above to register your first storage location.</p>
                    </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {renderTree(ROOT_KEY, 0)}
                </div>
              )}
            </div>
          </Card>
          
          <div className="mt-8 grid grid-cols-3 gap-6">
             <MetricCard label="Total Capacity" value={warehouses.length} unit="NODES" />
             <MetricCard label="Active Status" value={warehouses.filter(w => w.active).length} unit="OPERATIONAL" />
             <MetricCard label="Default Zone" value={warehouses.find(w => w.isDefault)?.code || 'UNDEFINED'} unit="PRIMARY" />
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: string | number; unit: string }> = ({ label, value, unit }) => (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm border-b-2 border-b-indigo-500/20 transition-all hover:border-b-indigo-500">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{value}</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter font-mono">{unit}</span>
        </div>
    </div>
);

export default WarehousesPage;
