import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  InventoryItemDTO,
  InventoryWarehouseDTO,
  StockMovementDTO,
  inventoryApi,
} from '../../../api/inventoryApi';
import { ReportContainer } from '../../../components/reports/ReportContainer';
import { sortReportRowsByDateTimeDesc } from '../../../components/reports/reportSorting';
import { DatePicker } from '../../../components/shared/selectors';
import { Button } from '../../../components/ui/Button';
import { Spinner } from '../../../components/ui/Spinner';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

interface StockMovementParams {
  from?: string;
  to?: string;
}

const Initiator: React.FC<{
  onSubmit: (params: StockMovementParams) => void;
  initialParams?: StockMovementParams | null;
}> = ({ onSubmit, initialParams }) => {
  const { t } = useTranslation('inventory');
  const [from, setFrom] = useState(initialParams?.from || '');
  const [to, setTo] = useState(initialParams?.to || '');

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ from: from || undefined, to: to || undefined });
      }}
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-600">
            {t('movements.filters.from', 'From date')}
          </label>
          <DatePicker value={from} onChange={setFrom} className="w-full" />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-600">
            {t('movements.filters.to', 'To date')}
          </label>
          <DatePicker value={to} onChange={setTo} className="w-full" />
        </div>
      </div>
      <div className="flex justify-end border-t border-slate-100 pt-4">
        <Button type="submit" className="gap-2">
          {t('movements.generate', 'Generate report')}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </form>
  );
};

const ReportContent: React.FC<{
  params: StockMovementParams;
  pagination?: {
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    totalItems: number;
  };
  setTotalItems?: (total: number) => void;
  visibleColumns?: string[];
  density?: 'compact' | 'comfortable';
}> = ({ params, pagination, setTotalItems, visibleColumns, density }) => {
  const { t } = useTranslation('inventory');
  const [movements, setMovements] = useState<StockMovementDTO[]>([]);
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      inventoryApi.getMovements({
        from: params.from,
        to: params.to,
        limit: 5000,
        offset: 0,
      }),
      inventoryApi.listItems({ active: true, limit: 1000 }),
      inventoryApi.listWarehouses({ active: true }),
    ])
      .then(([movementsResult, itemsResult, warehousesResult]) => {
        if (cancelled) return;
        setMovements(unwrap<StockMovementDTO[]>(movementsResult) || []);
        setItems(unwrap<InventoryItemDTO[]>(itemsResult) || []);
        setWarehouses(unwrap<InventoryWarehouseDTO[]>(warehousesResult) || []);
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error('Failed to load movements data', loadError);
        setError(t('movements.loadFailed', 'Failed to load stock movements.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [params.from, params.to, t]);

  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const warehouseMap = useMemo(
    () => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])),
    [warehouses],
  );
  const rows = useMemo(
    () => sortReportRowsByDateTimeDesc(movements, ['date', 'createdAt']),
    [movements],
  );

  useEffect(() => {
    setTotalItems?.(rows.length);
  }, [rows.length, setTotalItems]);

  const pagedRows = useMemo(() => {
    if (!pagination) return rows;
    const start = (pagination.page - 1) * pagination.pageSize;
    return rows.slice(start, start + pagination.pageSize);
  }, [pagination, rows]);

  const visible = (column: string) => !visibleColumns?.length || visibleColumns.includes(column);
  const cellPadding = density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-2.5';
  const getItemLabel = (itemId: string) => {
    const item = itemMap.get(itemId);
    return item ? `${item.code} - ${item.name}` : itemId;
  };
  const getWarehouseName = (warehouseId: string) =>
    warehouseMap.get(warehouseId)?.name || warehouseId;

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50 p-6">
      {error && (
        <div className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {loading ? (
        <div className="flex min-h-48 items-center justify-center border border-slate-200 bg-white">
          <div className="text-center">
            <Spinner size="lg" variant="slate" className="mx-auto mb-3" />
            <p className="text-sm text-slate-500">{t('movements.loading', 'Loading stock movements...')}</p>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-600">
              <tr>
                {visible('date') && <th className={`${cellPadding} text-start`}>{t('movements.columns.date', 'Date')}</th>}
                {visible('item') && <th className={`${cellPadding} text-start`}>{t('movements.columns.item', 'Item')}</th>}
                {visible('warehouse') && <th className={`${cellPadding} text-start`}>{t('movements.columns.warehouse', 'Warehouse')}</th>}
                {visible('type') && <th className={`${cellPadding} text-start`}>{t('movements.columns.type', 'Type')}</th>}
                {visible('direction') && <th className={`${cellPadding} text-start`}>{t('movements.columns.direction', 'Direction')}</th>}
                {visible('quantity') && <th className={`${cellPadding} text-end`}>{t('movements.columns.quantity', 'Qty')}</th>}
                {visible('costBase') && <th className={`${cellPadding} text-end`}>{t('movements.columns.costBase', 'Cost Base')}</th>}
              </tr>
            </thead>
            <tbody>
              {pagedRows.length === 0 ? (
                <tr>
                  <td className="py-20 text-center text-slate-500" colSpan={7}>
                    {t('movements.empty', 'No stock movements match the selected dates.')}
                  </td>
                </tr>
              ) : (
                pagedRows.map((movement) => (
                  <tr key={movement.id} className="border-b border-slate-100 hover:bg-blue-50/40">
                    {visible('date') && <td className={`${cellPadding} text-slate-600`}>{movement.date}</td>}
                    {visible('item') && <td className={`${cellPadding} font-medium text-slate-900`}>{getItemLabel(movement.itemId)}</td>}
                    {visible('warehouse') && <td className={`${cellPadding} text-slate-700`}>{getWarehouseName(movement.warehouseId)}</td>}
                    {visible('type') && (
                      <td className={cellPadding}>
                        {t(`movements.types.${movement.movementType}`, { defaultValue: movement.movementType })}
                      </td>
                    )}
                    {visible('direction') && (
                      <td className={cellPadding}>
                        {t(`movements.directions.${movement.direction}`, { defaultValue: movement.direction })}
                      </td>
                    )}
                    {visible('quantity') && <td className={`${cellPadding} text-end tabular-nums`}>{movement.qty}</td>}
                    {visible('costBase') && <td className={`${cellPadding} text-end tabular-nums`}>{movement.totalCostBase.toFixed(2)}</td>}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const StockMovementsPage: React.FC = () => {
  const { t } = useTranslation('inventory');
  const columns = [
    { id: 'date', label: t('movements.columns.date', 'Date'), permanent: true },
    { id: 'item', label: t('movements.columns.item', 'Item'), permanent: true },
    { id: 'warehouse', label: t('movements.columns.warehouse', 'Warehouse') },
    { id: 'type', label: t('movements.columns.type', 'Type') },
    { id: 'direction', label: t('movements.columns.direction', 'Direction') },
    { id: 'quantity', label: t('movements.columns.quantity', 'Qty') },
    { id: 'costBase', label: t('movements.columns.costBase', 'Cost Base') },
  ];

  return (
    <ReportContainer<StockMovementParams>
      title={t('movements.title', 'Stock Movements')}
      subtitle={t('movements.subtitle', 'Chronological stock movement audit across all items and warehouses')}
      initiator={Initiator}
      ReportContent={ReportContent}
      config={{ paginated: true, defaultPageSize: 50, availableColumns: columns }}
    />
  );
};

export default StockMovementsPage;
