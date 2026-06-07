import React, { useState } from 'react';
import { InventoryItem } from '../types';
import { 
  Plus, 
  X, 
  ShieldAlert, 
  Check 
} from 'lucide-react';

interface InventorySectionProps {
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
}

export default function InventorySection({ inventory, setInventory }: InventorySectionProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newSku, setNewSku] = useState('');
  const [newName, setNewName] = useState('');
  const [newCat, setNewCat] = useState('Hardware');
  const [newCost, setNewCost] = useState(0);
  const [newPrice, setNewPrice] = useState(0);
  const [newQty, setNewQty] = useState(1);
  const [errorStr, setErrorStr] = useState('');

  const handleCreateProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorStr('');

    if (!newSku || !newName) {
      setErrorStr('Sku and Name are mandatory fields.');
      return;
    }

    if (inventory.some(p => p.sku === newSku)) {
      setErrorStr(`Product SKU "${newSku}" already exists in index.`);
      return;
    }

    const nextProduct: InventoryItem = {
      id: `PROD-0${inventory.length + 1}`,
      sku: newSku,
      name: newName,
      category: newCat,
      qtyOnHand: Number(newQty),
      avgCost: Number(newCost),
      salePrice: Number(newPrice)
    };

    setInventory(prev => [...prev, nextProduct]);
    setIsAddOpen(false);

    // Reset Form
    setNewSku('');
    setNewName('');
    setNewCost(0);
    setNewPrice(0);
    setNewQty(1);
  };

  const handleReorder = (sku: string) => {
    setInventory(prev => prev.map(item => {
      if (item.sku === sku) {
        return { ...item, qtyOnHand: item.qtyOnHand + 50 };
      }
      return item;
    }));
  };

  const fmt = (num: number) => num.toLocaleString('en-US');

  return (
    <div className="space-y-6 font-sans">
      {/* Header action panel */}
      <div className="flex items-center justify-between pb-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Inventory & Stock Module</h1>
          <p className="text-xs text-slate-500">Track raw materials and packaged licenses, average cost evaluations, and margins.</p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="inline-flex items-center text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3.5 py-2 rounded shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4 mr-1 text-white" />
          Add Product
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main inventory list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-sm">
            <div className="p-4 border-b border-zinc-150 flex items-center justify-between">
              <h2 className="text-xs font-black uppercase text-slate-700 tracking-wider">Product Stock & Pricing Matrix</h2>
              <span className="text-[11px] text-slate-400">Total: {inventory.length} SKUs cataloged</span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">
                    <th className="py-2.5 px-4">SKU / Item</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-right">Avg Cost SYP</th>
                    <th className="py-2.5 px-3 text-right">Selling Price SYP</th>
                    <th className="py-2.5 px-3 text-center">Qty on Hand</th>
                    <th className="py-2.5 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {inventory.map(item => {
                    const isLowStock = item.qtyOnHand < 10;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4">
                          <span className="block font-mono font-bold text-slate-800">{item.sku}</span>
                          <span className="text-[10px] text-slate-500 font-semibold block mt-0.5 truncate max-w-[240px]">{item.name}</span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-medium">{item.category}</td>
                        <td className="py-3 px-3 text-right font-mono text-slate-700 tabular-nums">{fmt(item.avgCost)}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-800 tabular-nums">{fmt(item.salePrice)}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-block font-mono font-bold px-2 py-0.5 rounded-full ${
                            isLowStock 
                              ? 'bg-rose-50 text-rose-700 font-black animate-pulse' 
                              : 'bg-[#F4F4F5] text-zinc-700'
                          }`}>
                            {item.qtyOnHand}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isLowStock ? (
                            <button
                              onClick={() => handleReorder(item.sku)}
                              className="text-[10px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-150 px-2 py-1 rounded transition-colors"
                            >
                              Reorder 50
                            </button>
                          ) : (
                            <span className="text-[10px] text-emerald-600 font-semibold block py-1 flex items-center justify-center gap-0.5">
                              <Check className="w-3.5 h-3.5 text-emerald-500 inline" /> Stocks safe
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Category summaries */}
        <div className="space-y-4">
          <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-sm p-4 text-right">
            <h2 className="text-xs font-black uppercase text-slate-700 tracking-wider text-left mb-4">Stock Valuation Stats</h2>
            <div className="space-y-4">
              <div className="p-3.5 bg-zinc-50 rounded-lg border border-[#F1F3F5] text-left">
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Gross Valuation (At Sales Value)</span>
                <span className="text-sm font-black text-slate-800 mt-1 block font-mono">
                  {fmt(inventory.reduce((sum, item) => sum + (item.qtyOnHand * item.salePrice), 0))} SYP
                </span>
              </div>
              <div className="p-3.5 bg-zinc-50 rounded-lg border border-[#F1F3F5] text-left">
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Average Profit Premium Margin</span>
                <span className="text-sm font-black text-blue-600 mt-1 block font-mono">
                  {fmt(Math.round(inventory.reduce((sum, item) => sum + (item.salePrice - item.avgCost), 0) / inventory.length))} SYP / unit avg
                </span>
              </div>
              <div className="p-3.5 bg-rose-50 rounded-lg border border-rose-150 text-left flex items-start gap-2.5 animate-fade-in">
                <ShieldAlert className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] text-rose-700 font-black uppercase tracking-wider block">Action Needed: Critically low</span>
                  <span className="text-xs text-rose-600 block mt-0.5">
                    {inventory.filter(p => p.qtyOnHand < 10).length} high-priority product SKUs require urgent wholesale provisioning files now.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Add Product Drawer */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50 animate-fade-in">
          <form 
            onSubmit={handleCreateProductSubmit}
            className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col p-6 overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div>
                <h3 className="text-sm font-black text-slate-800">Add New Catalog Product SKU</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Define unit pricing, average accounting costs, and catalog category.</p>
              </div>
              <button 
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorStr && (
              <div className="bg-rose-50 text-rose-700 p-2.5 text-xs rounded mb-4 font-semibold">
                {errorStr}
              </div>
            )}

            <div className="space-y-4 flex-1">
              <div className="grid grid-cols-2 gap-3">
                {/* SKU */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Catalog SKU</label>
                  <input
                    type="text"
                    required
                    placeholder="HW-SRV-990"
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                    className="w-full text-xs text-slate-700 bg-zinc-50 border border-[#E2E8F0] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded p-2 outline-none"
                  />
                </div>

                {/* Name */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Product Title</label>
                  <input
                    type="text"
                    required
                    placeholder="Intel Switch XEON Dual"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full text-xs text-slate-700 bg-zinc-50 border border-[#E2E8F0] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded p-2 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Category */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Class Category</label>
                  <select
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    className="w-full text-xs text-slate-700 bg-zinc-50 border border-[#E2E8F0] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded p-2 outline-none"
                  >
                    <option value="Hardware">Hardware Components</option>
                    <option value="Cabling & Infrastructure">Cabling & Infrastructure</option>
                    <option value="Software">Software & Cloud Licenses</option>
                    <option value="Furniture & Workspaces">Office & Industrial Workspaces</option>
                  </select>
                </div>

                {/* Opening Qty */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Opening Qty</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newQty}
                    onChange={(e) => setNewQty(Number(e.target.value))}
                    className="w-full text-xs text-slate-700 bg-zinc-50 border border-[#E2E8F0] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded p-2 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Cost */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Unit Avg Cost SYP</label>
                  <input
                    type="number"
                    min={0}
                    required
                    placeholder="e.g. 500000"
                    value={newCost || ''}
                    onChange={(e) => setNewCost(Number(e.target.value))}
                    className="w-full text-xs text-slate-700 bg-zinc-50 border border-[#E2E8F0] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded p-2 outline-none"
                  />
                </div>

                {/* Price */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Unit Sale Price SYP</label>
                  <input
                    type="number"
                    min={0}
                    required
                    placeholder="e.g. 850000"
                    value={newPrice || ''}
                    onChange={(e) => setNewPrice(Number(e.target.value))}
                    className="w-full text-xs text-slate-700 bg-zinc-50 border border-[#E2E8F0] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded p-2 outline-none"
                  />
                </div>
              </div>

            </div>

            {/* Actions button */}
            <div className="flex items-center space-x-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="flex-1 text-[11px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 py-2 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 py-2 rounded-md shadow-sm"
              >
                Register SKU Item
              </button>
            </div>

          </form>
        </div>
      )}

    </div>
  );
}
