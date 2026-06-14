import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SalesSettingsDTO, salesApi } from '../../../api/salesApi';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Spinner } from '../../../components/ui/Spinner';
import { AccountSelector } from '../../accounting/components/shared/AccountSelector';
import { WarehouseSelector } from '../../../components/shared/selectors/WarehouseSelector';
import { ShieldCheck, DollarSign, Hash, Shield, Settings, Info, Save, RotateCcw, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

export const MockUnifiedSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'policy' | 'accounts' | 'numbering'>('policy');
  const [settings, setSettings] = useState<SalesSettingsDTO | null>(null);
  const [originalSettings, setOriginalSettings] = useState<SalesSettingsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await salesApi.getSettings();
        const data = (res as any)?.data ?? res;
        setSettings(data);
        setOriginalSettings(data);
      } catch (err) {
        console.error('Failed to load settings', err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const updateField = <K extends keyof SalesSettingsDTO>(field: K, val: SalesSettingsDTO[K]) => {
    setSettings((prev) => (prev ? { ...prev, [field]: val } : prev));
  };

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  const handleSave = async () => {
    if (!settings) return;
    try {
      setSaving(true);
      await salesApi.updateSettings(settings);
      setOriginalSettings(settings);
      toast.success(t('settings.savedSuccessfully', 'Settings saved successfully!'));
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setSettings(originalSettings);
    toast('Changes discarded', { icon: 'ℹ️' });
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" variant="indigo" />
      </div>
    );
  }

  if (!settings) return null;

  const tabs = [
    { id: 'policy', label: 'Sales Policy', icon: ShieldCheck },
    { id: 'accounts', label: 'Account Defaults', icon: DollarSign },
    { id: 'numbering', label: 'Document Numbering', icon: Hash },
  ] as const;

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg-secondary)] relative">
      {/* Settings Header */}
      <div className="flex-none px-8 py-6 bg-white dark:bg-[var(--color-bg-primary)] border-b border-[var(--color-border)] flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--color-text-primary)]">
            Sales Settings <span className="text-indigo-600 text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 font-bold uppercase tracking-widest ml-2">PRO VERSION</span>
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Demo of unified UI/UX with global saving controls, correct theme tokens, and clean layout.
          </p>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <aside className="w-64 border-r border-[var(--color-border)] bg-gray-50/50 dark:bg-[var(--color-bg-secondary)] overflow-y-auto">
          <nav className="p-4 space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
                    isActive
                      ? 'bg-white dark:bg-[var(--color-bg-primary)] text-indigo-600 shadow-sm border border-slate-200/60 dark:border-slate-800'
                      : 'text-[var(--color-text-secondary)] hover:bg-slate-100 dark:hover:bg-[var(--color-bg-tertiary)]'
                  )}
                >
                  <Icon size={16} className={isActive ? 'text-indigo-600' : 'text-[var(--color-text-muted)]'} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto bg-white dark:bg-[var(--color-bg-primary)] p-8 custom-scroll">
          <div className="max-w-4xl mx-auto space-y-8 pb-32">
            
            {activeTab === 'policy' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-black text-[var(--color-text-primary)]">Sales Operational Policy</h2>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1">Manage document flows, limits, and order rules.</p>
                </div>
                
                <Card className="p-6">
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">Workflow Mode</label>
                        <select
                          value={settings.workflowMode}
                          onChange={(e) => updateField('workflowMode', e.target.value as any)}
                          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-2.5 text-xs font-bold text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="SIMPLE">Simple (Invoices only)</option>
                          <option value="OPERATIONAL">Operational (Quotes/Orders/Delivery Notes)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">Default Payment Terms (Days)</label>
                        <Input
                          type="number"
                          value={settings.defaultPaymentTermsDays}
                          onChange={(e) => updateField('defaultPaymentTermsDays', Number(e.target.value))}
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-[var(--color-border)]">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.allowCreditOverride !== false}
                          onChange={(e) => updateField('allowCreditOverride', e.target.checked)}
                          className="h-4.5 w-4.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <div className="text-xs font-bold text-[var(--color-text-primary)]">Allow Credit Limit Overrides</div>
                          <div className="text-[10px] text-[var(--color-text-secondary)]">Let authorized users confirm orders above customer limits.</div>
                        </div>
                      </label>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {activeTab === 'accounts' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-black text-[var(--color-text-primary)]">GL Account Defaults</h2>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1">Specify standard general ledger accounts for automated posting.</p>
                </div>
                
                <Card className="p-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">Default Revenue Account</label>
                      <AccountSelector
                        value={settings.defaultRevenueAccountId || ''}
                        onChange={(acc: any) => updateField('defaultRevenueAccountId', acc?.id || '')}
                        placeholder="Select Account"
                        allowedClassifications={['REVENUE']}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">Default Refund Account</label>
                      <AccountSelector
                        value={settings.defaultRefundAccountId || ''}
                        onChange={(acc: any) => updateField('defaultRefundAccountId', acc?.id || '')}
                        placeholder="Select Account"
                        allowedClassifications={['ASSET']}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">Default Warehouse</label>
                      <WarehouseSelector
                        value={settings.defaultWarehouseId}
                        onChange={(wh: any) => updateField('defaultWarehouseId', wh?.id || '')}
                        placeholder="Select Warehouse"
                      />
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {activeTab === 'numbering' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-black text-[var(--color-text-primary)]">Document Numbering Series</h2>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1">Customize document prefixes and next serial values.</p>
                </div>
                
                <Card className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">Sales Invoice Prefix</label>
                      <Input
                        value={settings.siNumberPrefix}
                        onChange={(e) => updateField('siNumberPrefix', e.target.value.toUpperCase())}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">Next Invoice Number</label>
                      <Input
                        type="number"
                        value={settings.siNumberNextSeq}
                        onChange={(e) => updateField('siNumberNextSeq', Number(e.target.value))}
                      />
                    </div>
                    <div className="flex items-end">
                      <div className="w-full bg-slate-50 dark:bg-slate-900 border border-[var(--color-border)] rounded-xl p-3 text-xs text-[var(--color-text-secondary)] flex items-center justify-center font-mono">
                        Preview: {settings.siNumberPrefix}-{String(settings.siNumberNextSeq).padStart(4, '0')}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* Floating global save bar at the bottom */}
      <div
        className={clsx(
          "fixed bottom-6 left-1/2 -translate-x-1/2 md:left-[calc((100vw-var(--app-sidebar-width))/2+var(--app-sidebar-width))] md:translate-x-[-50%] z-[100] w-full max-w-2xl px-6 transition-all duration-300 transform",
          hasChanges ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0 pointer-events-none"
        )}
      >
        <div className="bg-slate-900 dark:bg-slate-950 text-white rounded-2xl p-4 shadow-2xl border border-slate-800/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
              <AlertTriangle size={18} />
            </div>
            <div>
              <div className="text-xs font-bold">Unsaved Settings Changes</div>
              <div className="text-[10px] text-slate-400">You have unsaved changes in this module.</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDiscard}
              className="flex items-center gap-1.5 px-4 py-2 border border-slate-800 hover:bg-slate-800 text-xs font-bold rounded-xl transition-all active:scale-95"
            >
              <RotateCcw size={14} />
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-xs font-bold rounded-xl shadow-lg transition-all active:scale-95"
            >
              {saving ? (
                <Spinner size="xs" variant="white" />
              ) : (
                <Save size={14} />
              )}
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
