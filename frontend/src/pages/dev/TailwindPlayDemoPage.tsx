import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { inventoryApi, InventoryItemDTO, InventoryWarehouseDTO, StockLevelDTO } from '../../api/inventoryApi';
import { useUserPreferences } from '../../hooks/useUserPreferences';
import { useWindowManager } from '../../context/WindowManagerContext';
import { ChevronDown, RefreshCcw, Database, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import i18n from "i18next";

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

export const TailwindPlayDemoPage: React.FC = () => {
  const { t } = useTranslation('common');
  const { uiMode } = useUserPreferences();
  const { openWindow } = useWindowManager();
  
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [stockLevels, setStockLevels] = useState<StockLevelDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  
  // New Item State
  const [newItemCode, setNewItemCode] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemWarehouseId, setNewItemWarehouseId] = useState('');
  const [newItemQty, setNewItemQty] = useState('1200');

  const loadData = async () => {
    try {
      setLoading(true);
      const itemsRes = await inventoryApi.listItems({ active: true });
      const warehousesRes = await inventoryApi.listWarehouses({ active: true });
      const stockRes = await inventoryApi.getStockLevels();

      const itemsList = unwrap<InventoryItemDTO[]>(itemsRes) || [];
      const warehousesList = unwrap<InventoryWarehouseDTO[]>(warehousesRes) || [];
      const stockList = unwrap<StockLevelDTO[]>(stockRes) || [];

      setItems(itemsList);
      setWarehouses(warehousesList);
      setStockLevels(stockList);
    } catch (error) {
      console.error('Failed to load dev data', error);
      toast.error(i18n.t('Failed to load inventory data'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSeedDemoData = async () => {
    try {
      setLoading(true);
      setShowActionsDropdown(false);
      
      // 1. Get or create a Warehouse
      let warehouse = warehouses[0];
      if (!warehouse) {
        const whRes = await inventoryApi.createWarehouse({
          code: 'MWH-01',
          name: 'Main Warehouse',
          isDefault: true,
          active: true
        });
        warehouse = unwrap<InventoryWarehouseDTO>(whRes);
      }

      // 2. Create the raw steel sheets item
      const itemRes = await inventoryApi.createItem({
        code: 'ITEM-001',
        name: 'Raw Steel Sheets',
        type: 'PRODUCT',
        baseUom: 'pcs',
        costCurrency: 'USD',
        trackInventory: true
      });
      const item = unwrap<InventoryItemDTO>(itemRes);

      // 3. Record opening stock of 1,200 pcs
      await inventoryApi.recordOpeningStock({
        itemId: item.id,
        warehouseId: warehouse.id,
        date: new Date().toISOString().split('T')[0],
        qty: 1200,
        unitCostInMoveCurrency: 10,
        moveCurrency: 'USD',
        fxRateMovToBase: 1,
        fxRateCCYToBase: 1,
        notes: 'Initial seed stock for Tailwind Play layout demo'
      });

      toast.success(i18n.t('Seeded Raw Steel Sheets (1,200 pcs)'));
      await loadData();
    } catch (error: any) {
      console.error('Failed to seed demo data', error);
      toast.error(error?.message || 'Failed to seed demo data. Maybe ITEM-001 already exists?');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemCode || !newItemName) {
      toast.error(i18n.t('Please fill in Code and Name'));
      return;
    }

    try {
      setLoading(true);
      
      // Get or create warehouse
      let whId = newItemWarehouseId;
      if (!whId) {
        let warehouse = warehouses[0];
        if (!warehouse) {
          const whRes = await inventoryApi.createWarehouse({
            code: 'MWH-01',
            name: 'Main Warehouse',
            isDefault: true,
            active: true
          });
          warehouse = unwrap<InventoryWarehouseDTO>(whRes);
        }
        whId = warehouse.id;
      }

      // Create item
      const itemRes = await inventoryApi.createItem({
        code: newItemCode.toUpperCase(),
        name: newItemName,
        type: 'PRODUCT',
        baseUom: 'pcs',
        costCurrency: 'USD',
        trackInventory: true
      });
      const item = unwrap<InventoryItemDTO>(itemRes);

      // Record stock if qty > 0
      const qtyNum = parseFloat(newItemQty);
      if (qtyNum > 0) {
        await inventoryApi.recordOpeningStock({
          itemId: item.id,
          warehouseId: whId,
          date: new Date().toISOString().split('T')[0],
          qty: qtyNum,
          unitCostInMoveCurrency: 10,
          moveCurrency: 'USD',
          fxRateMovToBase: 1,
          fxRateCCYToBase: 1,
          notes: 'Opening stock for custom item'
        });
      }

      toast.success(`Created item ${item.code} successfully`);
      setShowNewItemModal(false);
      setNewItemCode('');
      setNewItemName('');
      setNewItemQty('1200');
      await loadData();
    } catch (error: any) {
      console.error('Failed to create item', error);
      toast.error(error?.message || 'Failed to create item');
    } finally {
      setLoading(false);
    }
  };

  const handleClearDemoData = async () => {
    try {
      setLoading(true);
      setShowActionsDropdown(false);
      
      // Delete any items we created
      for (const item of items) {
        await inventoryApi.deleteItem(item.id);
      }
      toast.success(i18n.t('Cleaned items list'));
      await loadData();
    } catch (error) {
      console.error('Failed to clean items', error);
      toast.error(i18n.t('Failed to clean items'));
    } finally {
      setLoading(false);
    }
  };

  // Merge items with their stock levels and warehouse names
  const mergedItems = items.map((item) => {
    const itemStock = stockLevels.filter((l) => l.itemId === item.id);
    // If no stock, render 0
    if (itemStock.length === 0) {
      return {
        id: item.id,
        code: item.code,
        name: item.name,
        warehouseName: 'Main Warehouse',
        availableQty: 0
      };
    }

    return itemStock.map((lvl) => {
      const wh = warehouses.find((w) => w.id === lvl.warehouseId);
      return {
        id: item.id,
        code: item.code,
        name: item.name,
        warehouseName: wh ? wh.name : 'Main Warehouse',
        availableQty: lvl.qtyOnHand
      };
    })[0]; // Take the first stock location for preview
  });

  return (
    <div className="flex flex-col h-full bg-white text-slate-900 p-8 space-y-6">
      
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t(`Items Master`)}</h1>
          <span className="px-2 py-0.5 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-md">
            Active
          </span>
        </div>
        
        {/* Buttons */}
        <div className="flex items-center gap-2 relative">
          <button
            onClick={() => setShowActionsDropdown((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-[var(--radius-md)] hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
          >
            Actions
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          </button>
          
          {showActionsDropdown && (
            <div className="absolute top-9 right-[100px] z-50 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-1">
              <button
                onClick={handleSeedDemoData}
                className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <Database className="w-3.5 h-3.5 text-slate-400" />
                Seed Demo Data
              </button>
              <button
                onClick={loadData}
                className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCcw className="w-3.5 h-3.5 text-slate-400" />
                Refresh Data
              </button>
              <button
                onClick={handleClearDemoData}
                className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                Clear Sandbox Items
              </button>
            </div>
          )}

          <button
            onClick={() => {
              if (uiMode === 'windows') {
                openWindow({
                  type: 'item',
                  title: 'New Item Master',
                  data: { id: 'new' },
                  size: { width: 900, height: 700 }
                });
              } else {
                setShowNewItemModal(true);
              }
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-[var(--radius-md)] hover:bg-blue-700 active:scale-95 transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            New Item
          </button>
        </div>
      </div>

      {/* Main Table area */}
      <div className="overflow-x-auto border border-slate-100 rounded-lg">
        <table className="min-w-full bg-white divide-y divide-slate-100 text-xs text-left">
          <thead className="bg-slate-50/50">
            <tr>
              <th scope="col" className="px-6 py-3 font-semibold text-slate-500 uppercase tracking-wider w-[25%]">
                Item Code
              </th>
              <th scope="col" className="px-6 py-3 font-semibold text-slate-500 uppercase tracking-wider w-[35%]">
                Item Name
              </th>
              <th scope="col" className="px-6 py-3 font-semibold text-slate-500 uppercase tracking-wider w-[25%]">
                Warehouse
              </th>
              <th scope="col" className="px-6 py-3 font-semibold text-slate-500 uppercase tracking-wider text-right w-[15%]">
                Available Qty
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {mergedItems.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                  No items in Sandbox. Click "Actions" &rarr; "Seed Demo Data" to load screenshot presets.
                </td>
              </tr>
            )}
            {mergedItems.map((item) => (
              <tr key={item.code} className="hover:bg-slate-50/30 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => {
                      if (uiMode === 'windows') {
                        openWindow({
                          type: 'item',
                          title: item.name,
                          data: { id: item.id },
                          size: { width: 900, height: 700 }
                        });
                      } else {
                        toast(`Viewing details for ${item.code}`, { icon: 'ℹ️' });
                      }
                    }}
                    className="font-mono text-blue-600 hover:underline hover:text-blue-700 font-bold"
                  >
                    {item.code}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-slate-800">
                  {item.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                  {item.warehouseName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right font-mono font-bold text-slate-900">
                  {item.availableQty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {loading && (
        <div className="flex justify-center items-center py-4">
          <span className="text-xs text-slate-500 animate-pulse">{t(`Loading sandbox data...`)}</span>
        </div>
      )}

      {/* New Item Modal (Standalone classic mode) */}
      {showNewItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white p-6 rounded-xl border border-slate-200 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-slate-900">{t(`Create New Item`)}</h2>
            <form onSubmit={handleCreateCustomItem} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t(`Item Code`)}</label>
                <input
                  type="text"
                  placeholder="ITEM-002"
                  value={newItemCode}
                  onChange={(e) => setNewItemCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t(`Item Name`)}</label>
                <input
                  type="text"
                  placeholder="Aluminium Rods"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t(`Warehouse`)}</label>
                <select
                  value={newItemWarehouseId}
                  onChange={(e) => setNewItemWarehouseId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">{t(`Default Warehouse`)}</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t(`Starting Stock Qty`)}</label>
                <input
                  type="number"
                  placeholder="1200"
                  value={newItemQty}
                  onChange={(e) => setNewItemQty(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewItemModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-md font-bold shadow-sm"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TailwindPlayDemoPage;
