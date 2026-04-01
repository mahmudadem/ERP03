import React, { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { InventoryWarehouseDTO, inventoryApi } from '../../../api/inventoryApi';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

const WarehousesPage: React.FC = () => {
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [form, setForm] = useState({ name: '', code: '', address: '' });

  const load = async () => {
    try {
      const result = await inventoryApi.listWarehouses();
      setWarehouses(unwrap<InventoryWarehouseDTO[]>(result) || []);
    } catch (error) {
      console.error('Failed to load warehouses', error);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await inventoryApi.createWarehouse(form);
      setForm({ name: '', code: '', address: '' });
      await load();
    } catch (error) {
      console.error('Failed to create warehouse', error);
    }
  };

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Warehouses</h1>

      <Card className="p-6">
        <form className="grid gap-3 md:grid-cols-4" onSubmit={handleCreate}>
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Code"
            value={form.code}
            onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
            required
          />
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm md:col-span-2"
            placeholder="Address"
            value={form.address}
            onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
          />
          <button className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white md:col-span-4" type="submit">
            Add Warehouse
          </button>
        </form>
      </Card>

      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 text-left">Code</th>
                <th className="py-2 text-left">Name</th>
                <th className="py-2 text-left">Address</th>
                <th className="py-2 text-left">Default</th>
                <th className="py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.map((warehouse) => (
                <tr key={warehouse.id} className="border-b border-slate-100">
                  <td className="py-2">{warehouse.code}</td>
                  <td className="py-2">{warehouse.name}</td>
                  <td className="py-2">{warehouse.address || '-'}</td>
                  <td className="py-2">{warehouse.isDefault ? 'YES' : 'NO'}</td>
                  <td className="py-2">{warehouse.active ? 'ACTIVE' : 'INACTIVE'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default WarehousesPage;
