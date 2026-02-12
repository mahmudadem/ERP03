import React, { useState } from 'react';
import { Plus, Edit2, Trash2, RefreshCw } from 'lucide-react';
import { accountingApi, CostCenterDTO } from '../../../api/accountingApi';
import { useCostCenters } from '../../../context/CostCentersContext';
import { errorHandler } from '../../../services/errorHandler';
import { useTranslation } from 'react-i18next';

export const CostCentersPage: React.FC = () => {
  const { t } = useTranslation('accounting');
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
      errorHandler.showSuccess(t('costCenters.saved'));
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error || err?.message || t('costCenters.saveError'));
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
      errorHandler.showError(err?.message || t('costCenters.deactivateError'));
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('costCenters.title')}</h1>
          <p className="text-sm text-gray-500">{t('costCenters.subtitle')}</p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-3 py-2 border rounded-md text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {t('costCenters.refresh')}
        </button>
      </div>

      <div className="bg-white border rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            className="border rounded-md px-3 py-2 text-sm"
            placeholder={t('costCenters.code')}
            value={form.code || ''}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
          />
          <input
            className="border rounded-md px-3 py-2 text-sm"
            placeholder={t('costCenters.name')}
            value={form.name || ''}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="border rounded-md px-3 py-2 text-sm"
            placeholder={t('costCenters.description')}
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
            {editingId ? t('costCenters.update') : t('costCenters.create')}
          </button>
          {editingId && (
            <button
              onClick={() => {
                setEditingId(null);
                setForm({ code: '', name: '', description: '' });
              }}
              className="text-sm text-gray-600"
            >
              {t('common.cancel')}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border rounded-xl p-4 shadow-sm">
        {costCenters.length === 0 ? (
          <p className="text-sm text-gray-500">{t('costCenters.empty')}</p>
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
                    {t(`costCenters.status.${cc.status.toLowerCase()}`)}
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
