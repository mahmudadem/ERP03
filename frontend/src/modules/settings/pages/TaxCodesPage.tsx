import React, { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { TaxCodeDTO, TaxScope, TaxType, sharedApi } from '../../../api/sharedApi';

interface TaxCodeFormState {
  code: string;
  name: string;
  rate: number;
  taxType: TaxType;
  scope: TaxScope;
  purchaseTaxAccountId: string;
  salesTaxAccountId: string;
  active: boolean;
}

const emptyForm: TaxCodeFormState = {
  code: '',
  name: '',
  rate: 0,
  taxType: 'VAT',
  scope: 'BOTH',
  purchaseTaxAccountId: '',
  salesTaxAccountId: '',
  active: true,
};

const TaxCodesPage: React.FC = () => {
  const [taxCodes, setTaxCodes] = useState<TaxCodeDTO[]>([]);
  const [form, setForm] = useState<TaxCodeFormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadTaxCodes = async () => {
    try {
      setLoading(true);
      const result = await sharedApi.listTaxCodes();
      setTaxCodes(result || []);
    } catch (error) {
      console.error('Failed to load tax codes', error);
      setTaxCodes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTaxCodes();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleEdit = (taxCode: TaxCodeDTO) => {
    setEditingId(taxCode.id);
    setForm({
      code: taxCode.code,
      name: taxCode.name,
      rate: taxCode.rate,
      taxType: taxCode.taxType,
      scope: taxCode.scope,
      purchaseTaxAccountId: taxCode.purchaseTaxAccountId || '',
      salesTaxAccountId: taxCode.salesTaxAccountId || '',
      active: taxCode.active,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);
      const payload: Partial<TaxCodeDTO> = {
        code: form.code,
        name: form.name,
        rate: Number(form.rate),
        taxType: form.taxType,
        scope: form.scope,
        purchaseTaxAccountId: form.purchaseTaxAccountId || undefined,
        salesTaxAccountId: form.salesTaxAccountId || undefined,
        active: form.active,
      };

      if (editingId) {
        await sharedApi.updateTaxCode(editingId, payload);
      } else {
        await sharedApi.createTaxCode(payload);
      }

      resetForm();
      await loadTaxCodes();
    } catch (error) {
      console.error('Failed to save tax code', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Tax Codes</h1>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">{editingId ? 'Edit Tax Code' : 'Create Tax Code'}</h2>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <label className="text-sm">
            <div className="mb-1 font-medium">Code</div>
            <input
              className="w-full rounded border border-slate-300 px-3 py-2"
              value={form.code}
              onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
              required
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 font-medium">Name</div>
            <input
              className="w-full rounded border border-slate-300 px-3 py-2"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 font-medium">Rate (Decimal)</div>
            <input
              className="w-full rounded border border-slate-300 px-3 py-2"
              type="number"
              step="0.0001"
              min="0"
              value={form.rate}
              onChange={(e) => setForm((prev) => ({ ...prev, rate: Number(e.target.value) }))}
              required
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 font-medium">Type</div>
            <select
              className="w-full rounded border border-slate-300 px-3 py-2"
              value={form.taxType}
              onChange={(e) => setForm((prev) => ({ ...prev, taxType: e.target.value as TaxType }))}
            >
              <option value="VAT">VAT</option>
              <option value="GST">GST</option>
              <option value="EXEMPT">EXEMPT</option>
              <option value="ZERO_RATED">ZERO_RATED</option>
            </select>
          </label>
          <label className="text-sm">
            <div className="mb-1 font-medium">Scope</div>
            <select
              className="w-full rounded border border-slate-300 px-3 py-2"
              value={form.scope}
              onChange={(e) => setForm((prev) => ({ ...prev, scope: e.target.value as TaxScope }))}
            >
              <option value="PURCHASE">PURCHASE</option>
              <option value="SALES">SALES</option>
              <option value="BOTH">BOTH</option>
            </select>
          </label>
          <label className="text-sm">
            <div className="mb-1 font-medium">Active</div>
            <select
              className="w-full rounded border border-slate-300 px-3 py-2"
              value={String(form.active)}
              onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.value === 'true' }))}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
          <label className="text-sm">
            <div className="mb-1 font-medium">Purchase Tax Account ID</div>
            <input
              className="w-full rounded border border-slate-300 px-3 py-2"
              value={form.purchaseTaxAccountId}
              onChange={(e) => setForm((prev) => ({ ...prev, purchaseTaxAccountId: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 font-medium">Sales Tax Account ID</div>
            <input
              className="w-full rounded border border-slate-300 px-3 py-2"
              value={form.salesTaxAccountId}
              onChange={(e) => setForm((prev) => ({ ...prev, salesTaxAccountId: e.target.value }))}
            />
          </label>
          <div className="flex gap-2 md:col-span-2">
            <button className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white" disabled={saving} type="submit">
              {saving ? 'Saving...' : editingId ? 'Update Tax Code' : 'Create Tax Code'}
            </button>
            {editingId && (
              <button className="rounded border border-slate-300 px-4 py-2 text-sm" onClick={resetForm} type="button">
                Cancel
              </button>
            )}
          </div>
        </form>
      </Card>

      <Card className="p-6">
        {loading ? (
          <div className="text-sm text-slate-500">Loading tax codes...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2 text-left">Code</th>
                  <th className="py-2 text-left">Name</th>
                  <th className="py-2 text-left">Rate</th>
                  <th className="py-2 text-left">Type</th>
                  <th className="py-2 text-left">Scope</th>
                  <th className="py-2 text-left">Active</th>
                  <th className="py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {taxCodes.map((taxCode) => (
                  <tr key={taxCode.id} className="border-b border-slate-100">
                    <td className="py-2">{taxCode.code}</td>
                    <td className="py-2">{taxCode.name}</td>
                    <td className="py-2">{(taxCode.rate * 100).toFixed(2)}%</td>
                    <td className="py-2">{taxCode.taxType}</td>
                    <td className="py-2">{taxCode.scope}</td>
                    <td className="py-2">{taxCode.active ? 'YES' : 'NO'}</td>
                    <td className="py-2">
                      <button
                        className="rounded border border-slate-300 px-3 py-1 text-xs"
                        onClick={() => handleEdit(taxCode)}
                        type="button"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
                {taxCodes.length === 0 && (
                  <tr>
                    <td className="py-6 text-center text-slate-500" colSpan={7}>
                      No tax codes found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default TaxCodesPage;
