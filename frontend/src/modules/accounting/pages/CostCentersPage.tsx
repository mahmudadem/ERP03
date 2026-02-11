import React, { useState } from 'react';
import { Plus, Edit2, Trash2, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { accountingApi, CostCenterDTO } from '../../../api/accountingApi';
import { useCostCenters } from '../../../context/CostCentersContext';
import { errorHandler } from '../../../services/errorHandler';

export const CostCentersPage: React.FC = () => {
  const { costCenters, refresh, loading } = useCostCenters();
  const [form, setForm] = useState<Partial<CostCenterDTO>>({ code: '', name: '' });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      setSaving(true);
      if (editingId) {
        await accountingApi.updateCostCenter(editingId, form);
      } else {
        await accountingApi.createCostCenter(form);
      }
      setForm({ code: '', name: '', description: '' });
      setEditingId(null);
      await refresh();
      errorHandler.showSuccess('Saved');
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error || err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (cc: CostCenterDTO) => {
    setEditingId(cc.id);
    setForm(cc);
  };

  const handleDeactivate = async (id: string) => {
    try {
      await accountingApi.deactivateCostCenter(id);
      await refresh();
    } catch (err: any) {
      errorHandler.showError(err?.message || 'Failed to deactivate');
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cost Centers</h1>
          <p className="text-sm text-gray-500">Track departments, branches, and projects.</p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-3 py-2 border rounded-md text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="bg-white border rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            className="border rounded-md px-3 py-2 text-sm"
            placeholder="Code"
            value={form.code || ''}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
          />
          <input
            className="border rounded-md px-3 py-2 text-sm"
            placeholder="Name"
            value={form.name || ''}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="border rounded-md px-3 py-2 text-sm"
            placeholder="Description"
            value={form.description || ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {editingId ? 'Update' : 'Create'}
          </button>
          {editingId && (
            <button
              onClick={() => {
                setEditingId(null);
                setForm({ code: '', name: '', description: '' });
              }}
              className="text-sm text-gray-600"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border rounded-xl p-4 shadow-sm">
        {costCenters.length === 0 ? (
          <p className="text-sm text-gray-500">No cost centers yet.</p>
        ) : (
          <div className="divide-y">
            {costCenters.map((cc) => (
              <div key={cc.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold">{cc.code} — {cc.name}</div>
                  <div className="text-xs text-gray-500">{cc.description || '—'}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${cc.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-700'}`}>
                    {cc.status}
                  </span>
                  <button onClick={() => startEdit(cc)} className="text-indigo-600"><Edit2 size={16} /></button>
                  <button onClick={() => handleDeactivate(cc.id)} className="text-red-500"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CostCentersPage;
