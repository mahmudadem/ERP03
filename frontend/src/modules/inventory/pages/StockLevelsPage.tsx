import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import {
  InventoryItemDTO,
  InventoryWarehouseDTO,
  StockLevelDTO,
  inventoryApi,
} from '../../../api/inventoryApi';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

type ViewMode = 'byItem' | 'byWarehouse';

interface ItemRollup {
  itemId: string;
  totalQty: number;
  totalValue: number;
  blendedAvgCost: number;
  warehouses: StockLevelDTO[];
}

const StockLevelsPage: React.FC = () => {
  const [levels, setLevels] = useState<StockLevelDTO[]>([]);
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('byItem');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const itemLabelById = useMemo(
    () =>
      items.reduce<Record<string, string>>((acc, item) => {
        acc[item.id] = `${item.code} - ${item.name}`;
        return acc;
      }, {}),
    [items]
  );

  const warehouseLabelById = useMemo(
    () =>
      warehouses.reduce<Record<string, string>>((acc, warehouse) => {
        acc[warehouse.id] = `${warehouse.code} - ${warehouse.name}`;
        return acc;
      }, {}),
    [warehouses]
  );

  // Roll up the per-(item, warehouse) levels into one row per item, keeping the
  // warehouse breakdown for the expandable detail. Blended cost = Σvalue / Σqty,
  // which is the correct cross-warehouse weighted average (per-warehouse WAC stays
  // the source of truth; this is a display rollup only).
  const itemRollups = useMemo<ItemRollup[]>(() => {
    const byItem = new Map<string, ItemRollup>();
    for (const level of levels) {
      const existing =
        byItem.get(level.itemId) ||
        { itemId: level.itemId, totalQty: 0, totalValue: 0, blendedAvgCost: 0, warehouses: [] };
      existing.totalQty += level.qtyOnHand;
      existing.totalValue += level.qtyOnHand * level.avgCostBase;
      existing.warehouses.push(level);
      byItem.set(level.itemId, existing);
    }
    const rollups = Array.from(byItem.values());
    rollups.forEach((r) => {
      r.blendedAvgCost = r.totalQty !== 0 ? r.totalValue / r.totalQty : 0;
    });
    return rollups.sort((a, b) =>
      (itemLabelById[a.itemId] || a.itemId).localeCompare(itemLabelById[b.itemId] || b.itemId)
    );
  }, [levels, itemLabelById]);

  const toggleExpand = (itemId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  };

  const loadLevels = async () => {
    try {
      setLoading(true);
      const result = await inventoryApi.getStockLevels({
        warehouseId: warehouseId || undefined,
        limit: 500,
      });
      setLevels(unwrap<StockLevelDTO[]>(result) || []);
    } catch (error) {
      console.error('Failed to load stock levels', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReferences = async () => {
    try {
      const [itemsResult, warehousesResult] = await Promise.all([
        inventoryApi.listItems({ active: true, limit: 1000 }),
        inventoryApi.listWarehouses({ active: true, limit: 300 }),
      ]);
      setItems(unwrap<InventoryItemDTO[]>(itemsResult) || []);
      setWarehouses(unwrap<InventoryWarehouseDTO[]>(warehousesResult) || []);
    } catch (error) {
      console.error('Failed to load stock level references', error);
    }
  };

  useEffect(() => {
    loadLevels();
  }, [warehouseId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadReferences();
  }, []);

  const qtyClass = (qty: number) =>
    qty < 0 ? 'bg-red-50 dark:bg-red-900/10' : qty < 5 ? 'bg-amber-50 dark:bg-amber-900/10' : '';

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Stock Levels</h1>

      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm md:w-72 dark:bg-slate-800 dark:border-slate-600"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
          >
            <option value="">All warehouses</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.code} - {wh.name}
              </option>
            ))}
          </select>

          <div className="inline-flex overflow-hidden rounded border border-slate-300 dark:border-slate-600">
            <button
              className={`px-3 py-2 text-sm ${viewMode === 'byItem' ? 'bg-slate-700 text-white' : 'bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}
              onClick={() => setViewMode('byItem')}
            >
              By Item
            </button>
            <button
              className={`px-3 py-2 text-sm ${viewMode === 'byWarehouse' ? 'bg-slate-700 text-white' : 'bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}
              onClick={() => setViewMode('byWarehouse')}
            >
              By Warehouse
            </button>
          </div>

          <button
            className="ml-auto rounded bg-slate-700 px-3 py-2 text-sm text-white disabled:opacity-50"
            onClick={loadLevels}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </Card>

      <Card className="p-6">
        <div className="overflow-x-auto">
          {viewMode === 'byItem' ? (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="w-8 py-2" />
                  <th className="py-2 text-left">Item</th>
                  <th className="py-2 text-right">Warehouses</th>
                  <th className="py-2 text-right">Total Qty</th>
                  <th className="py-2 text-right">Blended Avg Cost</th>
                  <th className="py-2 text-right">Total Value</th>
                </tr>
              </thead>
              <tbody>
                {itemRollups.map((rollup) => {
                  const isOpen = expanded.has(rollup.itemId);
                  return (
                    <React.Fragment key={rollup.itemId}>
                      <tr
                        className={`border-b border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 ${qtyClass(rollup.totalQty)}`}
                        onClick={() => toggleExpand(rollup.itemId)}
                      >
                        <td className="py-2 text-center text-slate-400">
                          {rollup.warehouses.length > 1
                            ? (isOpen ? <ChevronDown size={14} className="inline" /> : <ChevronRight size={14} className="inline" />)
                            : null}
                        </td>
                        <td className="py-2 font-medium">{itemLabelById[rollup.itemId] || rollup.itemId}</td>
                        <td className="py-2 text-right text-slate-500">{rollup.warehouses.length}</td>
                        <td className="py-2 text-right font-semibold">{rollup.totalQty}</td>
                        <td className="py-2 text-right">{rollup.blendedAvgCost.toFixed(2)}</td>
                        <td className="py-2 text-right font-semibold">{rollup.totalValue.toFixed(2)}</td>
                      </tr>
                      {isOpen &&
                        rollup.warehouses.map((level) => (
                          <tr key={level.id} className="border-b border-slate-50 dark:border-slate-800/50 text-slate-600 dark:text-slate-400">
                            <td className="py-1.5" />
                            <td className="py-1.5 pl-4 text-xs">↳ {warehouseLabelById[level.warehouseId] || level.warehouseId}</td>
                            <td className="py-1.5" />
                            <td className="py-1.5 text-right text-xs">{level.qtyOnHand}</td>
                            <td className="py-1.5 text-right text-xs">{level.avgCostBase.toFixed(2)}</td>
                            <td className="py-1.5 text-right text-xs">{(level.qtyOnHand * level.avgCostBase).toFixed(2)}</td>
                          </tr>
                        ))}
                    </React.Fragment>
                  );
                })}
                {itemRollups.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      {loading ? 'Loading…' : 'No stock levels found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2 text-left">Item</th>
                  <th className="py-2 text-left">Warehouse</th>
                  <th className="py-2 text-right">Qty On Hand</th>
                  <th className="py-2 text-right">Avg Cost Base</th>
                  <th className="py-2 text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {levels.map((level) => (
                  <tr key={level.id} className={`border-b border-slate-100 dark:border-slate-800 ${qtyClass(level.qtyOnHand)}`}>
                    <td className="py-2">{itemLabelById[level.itemId] || level.itemId}</td>
                    <td className="py-2">{warehouseLabelById[level.warehouseId] || level.warehouseId}</td>
                    <td className="py-2 text-right">{level.qtyOnHand}</td>
                    <td className="py-2 text-right">{level.avgCostBase.toFixed(2)}</td>
                    <td className="py-2 text-right">{(level.qtyOnHand * level.avgCostBase).toFixed(2)}</td>
                  </tr>
                ))}
                {levels.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      {loading ? 'Loading…' : 'No stock levels found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
};

export default StockLevelsPage;
