import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InventoryWarehouseDTO, inventoryApi } from '../../../api/inventoryApi';
import { GRNStatus, GoodsReceiptDTO, purchasesApi } from '../../../api/purchasesApi';
import { Card } from '../../../components/ui/Card';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

const STATUS_OPTIONS: Array<{ label: string; value: GRNStatus | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Posted', value: 'POSTED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const GoodsReceiptsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<GRNStatus | 'ALL'>('ALL');
  const [receipts, setReceipts] = useState<GoodsReceiptDTO[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const warehouseNameById = useMemo(
    () =>
      warehouses.reduce<Record<string, string>>((acc, warehouse) => {
        acc[warehouse.id] = `${warehouse.code} - ${warehouse.name}`;
        return acc;
      }, {}),
    [warehouses]
  );

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const [grnResult, warehouseResult] = await Promise.all([
        purchasesApi.listGRNs({
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          limit: 200,
        }),
        inventoryApi.listWarehouses({ active: true, limit: 200 }),
      ]);

      const list = unwrap<GoodsReceiptDTO[]>(grnResult);
      const warehouseList = unwrap<InventoryWarehouseDTO[]>(warehouseResult);
      setReceipts(Array.isArray(list) ? list : []);
      setWarehouses(Array.isArray(warehouseList) ? warehouseList : []);
    } catch (err: any) {
      console.error('Failed to load goods receipts', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to load goods receipts.'
      );
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Goods Receipts</h1>
          <p className="text-sm text-slate-600">Receive stock into inventory and post operational receipts.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as GRNStatus | 'ALL')}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            onClick={() => navigate('/purchases/goods-receipts/new')}
          >
            New GRN
          </button>
        </div>
      </div>

      <Card className="p-4">
        {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 text-left">GRN #</th>
                <th className="py-2 text-left">Vendor</th>
                <th className="py-2 text-left">Receipt Date</th>
                <th className="py-2 text-left">Warehouse</th>
                <th className="py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((grn) => (
                <tr
                  key={grn.id}
                  className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                  onClick={() => navigate(`/purchases/goods-receipts/${grn.id}`)}
                >
                  <td className="py-2 font-medium">{grn.grnNumber}</td>
                  <td className="py-2">{grn.vendorName}</td>
                  <td className="py-2">{grn.receiptDate}</td>
                  <td className="py-2">{warehouseNameById[grn.warehouseId] || grn.warehouseId}</td>
                  <td className="py-2">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium">{grn.status}</span>
                  </td>
                </tr>
              ))}
              {!loading && receipts.length === 0 && (
                <tr>
                  <td className="py-6 text-center text-slate-500" colSpan={5}>
                    No goods receipts found.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td className="py-6 text-center text-slate-500" colSpan={5}>
                    Loading goods receipts...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default GoodsReceiptsListPage;
