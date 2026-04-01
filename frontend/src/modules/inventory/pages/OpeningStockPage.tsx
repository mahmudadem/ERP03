import React, { useMemo, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { inventoryApi } from '../../../api/inventoryApi';

interface OpeningStockLine {
  id: string;
  itemId: string;
  warehouseId: string;
  qty: number;
  unitCostInMoveCurrency: number;
  moveCurrency: string;
  fxRateMovToBase: number;
  fxRateCCYToBase: number;
}

const makeLine = (): OpeningStockLine => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  itemId: '',
  warehouseId: '',
  qty: 0,
  unitCostInMoveCurrency: 0,
  moveCurrency: 'USD',
  fxRateMovToBase: 1,
  fxRateCCYToBase: 1,
});

const OpeningStockPage: React.FC = () => {
  const [date, setDate] = useState('');
  const [lines, setLines] = useState<OpeningStockLine[]>([makeLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState('');

  const validLines = useMemo(
    () => lines.filter((line) => line.itemId && line.warehouseId && line.qty > 0),
    [lines]
  );

  const updateLine = <K extends keyof OpeningStockLine>(id: string, field: K, value: OpeningStockLine[K]) => {
    setLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, [field]: value } : line))
    );
  };

  const removeLine = (id: string) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((line) => line.id !== id) : prev));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || validLines.length === 0) {
      setResult('Enter a date and at least one valid line.');
      return;
    }

    try {
      setSubmitting(true);
      const responses = await Promise.all(
        validLines.map((line) =>
          inventoryApi.recordOpeningStock({
            itemId: line.itemId,
            warehouseId: line.warehouseId,
            date,
            qty: Number(line.qty),
            unitCostInMoveCurrency: Number(line.unitCostInMoveCurrency),
            moveCurrency: line.moveCurrency.toUpperCase(),
            fxRateMovToBase: Number(line.fxRateMovToBase),
            fxRateCCYToBase: Number(line.fxRateCCYToBase),
          })
        )
      );

      const movementIds = responses
        .map((res: any) => (res?.data ?? res)?.id)
        .filter(Boolean);

      setResult(`Created ${movementIds.length} opening movements: ${movementIds.join(', ')}`);
      setLines([makeLine()]);
    } catch (error) {
      console.error('Failed to record opening stock', error);
      setResult('ERROR: failed to create opening movements.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Opening Stock (Bulk)</h1>

      <Card className="p-6">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-3 md:grid-cols-3">
            <input
              type="date"
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <button
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              type="button"
              onClick={() => setLines((prev) => [...prev, makeLine()])}
            >
              Add Line
            </button>
            <div className="text-sm text-slate-600 self-center">
              Valid lines: {validLines.length}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2 text-left">Item</th>
                  <th className="py-2 text-left">Warehouse</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Unit Cost</th>
                  <th className="py-2 text-left">Currency</th>
                  <th className="py-2 text-right">FX M to B</th>
                  <th className="py-2 text-right">FX C to B</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-b border-slate-100">
                    <td className="py-2 pr-2">
                      <input
                        className="w-full rounded border border-slate-300 px-2 py-1"
                        value={line.itemId}
                        onChange={(e) => updateLine(line.id, 'itemId', e.target.value)}
                        placeholder="itemId"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        className="w-full rounded border border-slate-300 px-2 py-1"
                        value={line.warehouseId}
                        onChange={(e) => updateLine(line.id, 'warehouseId', e.target.value)}
                        placeholder="warehouseId"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        className="w-24 rounded border border-slate-300 px-2 py-1 text-right"
                        value={line.qty}
                        onChange={(e) => updateLine(line.id, 'qty', Number(e.target.value))}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        className="w-28 rounded border border-slate-300 px-2 py-1 text-right"
                        value={line.unitCostInMoveCurrency}
                        onChange={(e) => updateLine(line.id, 'unitCostInMoveCurrency', Number(e.target.value))}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        className="w-20 rounded border border-slate-300 px-2 py-1"
                        value={line.moveCurrency}
                        onChange={(e) => updateLine(line.id, 'moveCurrency', e.target.value.toUpperCase())}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        className="w-24 rounded border border-slate-300 px-2 py-1 text-right"
                        value={line.fxRateMovToBase}
                        onChange={(e) => updateLine(line.id, 'fxRateMovToBase', Number(e.target.value))}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        className="w-24 rounded border border-slate-300 px-2 py-1 text-right"
                        value={line.fxRateCCYToBase}
                        onChange={(e) => updateLine(line.id, 'fxRateCCYToBase', Number(e.target.value))}
                      />
                    </td>
                    <td className="py-2 text-right">
                      <button
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-50"
                        disabled={lines.length <= 1}
                        onClick={() => removeLine(line.id)}
                        type="button"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white" type="submit" disabled={submitting}>
            {submitting ? 'Recording...' : 'Record Opening Stock'}
          </button>
        </form>

        {result && (
          <p className="mt-4 text-sm text-slate-600">{result}</p>
        )}
      </Card>
    </div>
  );
};

export default OpeningStockPage;
