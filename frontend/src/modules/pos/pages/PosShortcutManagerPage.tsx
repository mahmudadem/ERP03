import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Check, Edit3, Eye, EyeOff, FolderPlus, PackagePlus, Save, Star, Trash2 } from 'lucide-react';
import { inventoryApi, InventoryItemDTO } from '../../../api/inventoryApi';
import { posApi, PosLayoutDTO, PosProductShortcutNodeDTO } from '../../../api/posApi';
import { errorHandler } from '../../../services/errorHandler';

type EditingNode = Pick<PosProductShortcutNodeDTO, 'id' | 'label' | 'sortOrder' | 'isActive'>;

const PosShortcutManagerPage: React.FC<{ isWindow?: boolean }> = () => {
  const { t } = useTranslation();
  const [layouts, setLayouts] = useState<PosLayoutDTO[]>([]);
  const [selectedLayoutId, setSelectedLayoutId] = useState('');
  const [nodes, setNodes] = useState<PosProductShortcutNodeDTO[]>([]);
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [layoutName, setLayoutName] = useState('Default shortcuts');
  const [groupName, setGroupName] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [editing, setEditing] = useState<EditingNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedLayout = layouts.find((layout) => layout.id === selectedLayoutId) || null;
  const groups = useMemo(
    () => nodes.filter((node) => node.nodeType === 'GROUP').sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label)),
    [nodes]
  );
  const visibleItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return items.slice(0, 80);
    return items
      .filter((item) => `${item.code} ${item.name} ${item.barcode || ''}`.toLowerCase().includes(q))
      .slice(0, 80);
  }, [itemSearch, items]);
  const groupItems = useMemo(
    () => nodes
      .filter((node) => node.nodeType === 'ITEM' && (node.parentId || '') === selectedGroupId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label)),
    [nodes, selectedGroupId]
  );
  const selectedGroupLabel = selectedGroupId
    ? groups.find((group) => group.id === selectedGroupId)?.label || t('pos.shortcuts.group', { defaultValue: 'Group' })
    : t('pos.shortcuts.root', { defaultValue: 'Root' });

  const loadLayouts = async () => {
    const data = await posApi.listProductShortcutLayouts();
    setLayouts(data);
    setSelectedLayoutId((prev) => prev || data.find((layout) => layout.isDefault && layout.isActive)?.id || data.find((layout) => layout.isActive)?.id || data[0]?.id || '');
  };

  const loadNodes = async (layoutId: string) => {
    if (!layoutId) {
      setNodes([]);
      return;
    }
    setNodes(await posApi.listProductShortcutNodes(layoutId));
  };

  const loadItems = async () => {
    const data = await inventoryApi.listItems({ active: true, limit: 1000 });
    setItems(data);
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        await Promise.all([loadLayouts(), loadItems()]);
      } catch (err: any) {
        errorHandler.showError(err?.message || 'Failed to load POS shortcuts.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    void loadNodes(selectedLayoutId);
    setSelectedGroupId('');
    setSelectedItemIds([]);
    setEditing(null);
  }, [selectedLayoutId]);

  const createLayout = async () => {
    try {
      setSaving(true);
      const layout = await posApi.createProductShortcutLayout({
        name: layoutName || 'Default shortcuts',
        scopeType: 'COMPANY',
        isDefault: layouts.length === 0,
        isActive: true,
      });
      await loadLayouts();
      setSelectedLayoutId(layout.id);
      toast.success(t('pos.shortcuts.layoutCreated', { defaultValue: 'Shortcut layout created.' }));
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error?.message || err?.message || 'Failed to create layout.');
    } finally {
      setSaving(false);
    }
  };

  const updateLayout = async (id: string, patch: Partial<PosLayoutDTO>) => {
    try {
      const updated = await posApi.updateProductShortcutLayout(id, patch);
      setLayouts((prev) => prev.map((layout) => layout.id === id ? updated : { ...layout, isDefault: patch.isDefault ? false : layout.isDefault }));
      toast.success(t('pos.shortcuts.layoutUpdated', { defaultValue: 'Layout updated.' }));
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error?.message || err?.message || 'Failed to update layout.');
    }
  };

  const createGroup = async () => {
    if (!selectedLayoutId || !groupName.trim()) return;
    try {
      const node = await posApi.createProductShortcutNode(selectedLayoutId, {
        nodeType: 'GROUP',
        label: groupName.trim(),
        parentId: null,
        sortOrder: groups.length,
        isActive: true,
      });
      setNodes((prev) => [...prev, node]);
      setSelectedGroupId(node.id);
      setGroupName('');
      toast.success(t('pos.shortcuts.groupCreated', { defaultValue: 'Group created.' }));
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error?.message || err?.message || 'Failed to create group.');
    }
  };

  const addSelectedItems = async () => {
    if (!selectedLayoutId || selectedItemIds.length === 0) return;
    try {
      setSaving(true);
      const existing = new Set(groupItems.map((node) => node.itemId));
      const selected = items.filter((item) => selectedItemIds.includes(item.id) && !existing.has(item.id));
      const created = await Promise.all(selected.map((item, index) => posApi.createProductShortcutNode(selectedLayoutId, {
        nodeType: 'ITEM',
        parentId: selectedGroupId || null,
        itemId: item.id,
        label: item.name,
        sortOrder: groupItems.length + index,
        isActive: true,
      })));
      setNodes((prev) => [...prev, ...created]);
      setSelectedItemIds([]);
      toast.success(t('pos.shortcuts.itemsAdded', { defaultValue: 'Items added to shortcuts.' }));
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error?.message || err?.message || 'Failed to add items.');
    } finally {
      setSaving(false);
    }
  };

  const saveNode = async () => {
    if (!editing) return;
    try {
      const updated = await posApi.updateProductShortcutNode(editing.id, {
        label: editing.label,
        sortOrder: Number(editing.sortOrder) || 0,
        isActive: editing.isActive !== false,
      });
      setNodes((prev) => prev.map((node) => node.id === updated.id ? updated : node));
      setEditing(null);
      toast.success(t('pos.shortcuts.shortcutUpdated', { defaultValue: 'Shortcut updated.' }));
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error?.message || err?.message || 'Failed to update shortcut.');
    }
  };

  const toggleNode = async (node: PosProductShortcutNodeDTO) => {
    const updated = await posApi.updateProductShortcutNode(node.id, { isActive: !node.isActive });
    setNodes((prev) => prev.map((item) => item.id === updated.id ? updated : item));
  };

  const deleteNode = async (node: PosProductShortcutNodeDTO) => {
    await posApi.deleteProductShortcutNode(node.id);
    setNodes((prev) => prev.filter((item) => item.id !== node.id && item.parentId !== node.id));
    if (selectedGroupId === node.id) setSelectedGroupId('');
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-500">{t('common.loading', { defaultValue: 'Loading...' })}</div>;
  }

  return (
    <div className="h-full overflow-auto bg-slate-50 p-4 dark:bg-[var(--color-bg-primary)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between dark:border-[var(--color-border)]">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-[var(--color-text-primary)]">
              {t('pos.shortcuts.title', { defaultValue: 'POS Shortcuts' })}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-[var(--color-text-secondary)]">
              {t('pos.shortcuts.subtitle', { defaultValue: 'Build terminal groups and bulk-assign items to each group.' })}
            </p>
          </div>
          <div className="flex gap-2">
            <input
              value={layoutName}
              onChange={(e) => setLayoutName(e.target.value)}
              className="h-10 min-w-[260px] rounded-lg border border-slate-300 bg-white px-3 text-sm"
              placeholder={t('pos.shortcuts.layoutName', { defaultValue: 'Layout name' })}
            />
            <button onClick={createLayout} disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {t('common.create', { defaultValue: 'Create' })}
            </button>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[280px_minmax(280px,1fr)_minmax(360px,1.2fr)]">
          <section className="rounded-lg border border-slate-200 bg-white p-3 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-secondary)]">
            <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-[var(--color-text-primary)]">
              {t('pos.shortcuts.layouts', { defaultValue: 'Terminal layouts' })}
            </h2>
            <div className="space-y-2">
              {layouts.map((layout) => (
                <button
                  key={layout.id}
                  onClick={() => setSelectedLayoutId(layout.id)}
                  className={`w-full rounded-lg border p-3 text-left text-sm ${selectedLayoutId === layout.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{layout.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${layout.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {layout.isActive ? t('common.active', { defaultValue: 'Active' }) : t('common.inactive', { defaultValue: 'Inactive' })}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                    {layout.isDefault && <span className="inline-flex items-center gap-1 text-amber-700"><Star className="h-3 w-3" /> {t('pos.shortcuts.default', { defaultValue: 'Terminal default' })}</span>}
                    <span>{layout.scopeType}</span>
                  </div>
                </button>
              ))}
            </div>
            {selectedLayout && (
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                <button onClick={() => updateLayout(selectedLayout.id, { isDefault: true, isActive: true })} className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                  <Star className="h-4 w-4" /> {t('pos.shortcuts.makeDefault', { defaultValue: 'Use on terminal' })}
                </button>
                <button onClick={() => updateLayout(selectedLayout.id, { isActive: !selectedLayout.isActive })} className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                  {selectedLayout.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {selectedLayout.isActive ? t('common.disable', { defaultValue: 'Disable' }) : t('common.enable', { defaultValue: 'Enable' })}
                </button>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-3 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-secondary)]">
            <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-[var(--color-text-primary)]">
              {t('pos.shortcuts.groups', { defaultValue: 'Groups' })}
            </h2>
            <div className="mb-3 flex gap-2">
              <input value={groupName} onChange={(e) => setGroupName(e.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm" placeholder={t('pos.shortcuts.groupName', { defaultValue: 'Group name' })} />
              <button onClick={createGroup} disabled={!selectedLayoutId || !groupName.trim()} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                <FolderPlus className="h-4 w-4" /> {t('common.add', { defaultValue: 'Add' })}
              </button>
            </div>
            <div className="space-y-2">
              <button onClick={() => setSelectedGroupId('')} className={`flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm ${selectedGroupId === '' ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200'}`}>
                <span className="font-semibold">{t('pos.shortcuts.rootButtons', { defaultValue: 'Root buttons' })}</span>
                <span className="text-xs text-slate-500">{nodes.filter((node) => node.nodeType === 'ITEM' && !node.parentId).length}</span>
              </button>
              {groups.map((group) => (
                <div key={group.id} className={`rounded-lg border p-3 ${selectedGroupId === group.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200'}`}>
                  <button onClick={() => setSelectedGroupId(group.id)} className="flex w-full items-center justify-between text-left">
                    <span className="text-sm font-semibold text-slate-900">{group.label}</span>
                    <span className="text-xs text-slate-500">{nodes.filter((node) => node.parentId === group.id).length}</span>
                  </button>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => setEditing({ id: group.id, label: group.label, sortOrder: group.sortOrder, isActive: group.isActive })} className="rounded border border-slate-200 px-2 py-1 text-xs"><Edit3 className="inline h-3 w-3" /> Edit</button>
                    <button onClick={() => toggleNode(group)} className="rounded border border-slate-200 px-2 py-1 text-xs">{group.isActive ? 'Disable' : 'Enable'}</button>
                    <button onClick={() => deleteNode(group)} className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-600"><Trash2 className="inline h-3 w-3" /> Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-3 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-secondary)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-800 dark:text-[var(--color-text-primary)]">{selectedGroupLabel}</h2>
                <p className="text-xs text-slate-500">{t('pos.shortcuts.bulkHint', { defaultValue: 'Select many items, then add them to this group.' })}</p>
              </div>
              <button onClick={addSelectedItems} disabled={!selectedLayoutId || selectedItemIds.length === 0 || saving} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                <PackagePlus className="h-4 w-4" /> {t('pos.shortcuts.addSelected', { defaultValue: 'Add selected' })} ({selectedItemIds.length})
              </button>
            </div>

            <input value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} className="mb-3 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" placeholder={t('pos.shortcuts.searchItems', { defaultValue: 'Search item code, name, or barcode' })} />

            <div className="grid max-h-64 gap-2 overflow-auto rounded-lg border border-slate-100 p-2 sm:grid-cols-2">
              {visibleItems.map((item) => {
                const checked = selectedItemIds.includes(item.id);
                const alreadyAdded = groupItems.some((node) => node.itemId === item.id);
                return (
                  <label key={item.id} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-sm ${checked ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200'} ${alreadyAdded ? 'opacity-50' : ''}`}>
                    <input
                      type="checkbox"
                      disabled={alreadyAdded}
                      checked={checked}
                      onChange={(e) => setSelectedItemIds((prev) => e.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id))}
                      className="mt-1"
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-slate-900">{item.name}</span>
                      <span className="block truncate font-mono text-xs text-slate-500">{item.code}</span>
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="mt-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-800">{t('pos.shortcuts.assignedItems', { defaultValue: 'Assigned shortcut buttons' })}</h3>
              <div className="space-y-2">
                {groupItems.length === 0 && <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">{t('pos.shortcuts.noItems', { defaultValue: 'No items assigned yet.' })}</div>}
                {groupItems.map((node) => (
                  <div key={node.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{node.label}</div>
                      <div className="truncate font-mono text-xs text-slate-500">{node.itemId}</div>
                    </div>
                    <div className="flex flex-none gap-2">
                      <button onClick={() => setEditing({ id: node.id, label: node.label, sortOrder: node.sortOrder, isActive: node.isActive })} className="rounded border border-slate-200 px-2 py-1 text-xs"><Edit3 className="inline h-3 w-3" /> Edit</button>
                      <button onClick={() => toggleNode(node)} className="rounded border border-slate-200 px-2 py-1 text-xs">{node.isActive ? 'Disable' : 'Enable'}</button>
                      <button onClick={() => deleteNode(node)} className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-600"><Trash2 className="inline h-3 w-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
              <h3 className="mb-3 text-base font-semibold text-slate-900">{t('pos.shortcuts.editShortcut', { defaultValue: 'Edit shortcut' })}</h3>
              <div className="space-y-3">
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-slate-500">{t('common.label', { defaultValue: 'Label' })}</span>
                  <input value={editing.label} onChange={(e) => setEditing((prev) => prev ? { ...prev, label: e.target.value } : prev)} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-slate-500">{t('pos.shortcuts.sortOrder', { defaultValue: 'Sort order' })}</span>
                  <input type="number" value={editing.sortOrder} onChange={(e) => setEditing((prev) => prev ? { ...prev, sortOrder: Number(e.target.value) || 0 } : prev)} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editing.isActive !== false} onChange={(e) => setEditing((prev) => prev ? { ...prev, isActive: e.target.checked } : prev)} />
                  {t('common.active', { defaultValue: 'Active' })}
                </label>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setEditing(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">{t('common.cancel', { defaultValue: 'Cancel' })}</button>
                <button onClick={saveNode} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"><Save className="h-4 w-4" /> {t('common.save', { defaultValue: 'Save' })}</button>
              </div>
            </div>
          </div>
        )}

        {selectedLayout?.isDefault && selectedLayout?.isActive && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <Check className="h-4 w-4" /> {t('pos.shortcuts.ready', { defaultValue: 'This layout is active and will be used by the POS terminal.' })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PosShortcutManagerPage;
