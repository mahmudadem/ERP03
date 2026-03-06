import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Edit2, Trash2, RefreshCw, ChevronRight, ChevronDown, Circle, Search, Layers, Power } from 'lucide-react';
import { accountingApi, CostCenterDTO } from '../../../api/accountingApi';
import { useCostCenters } from '../../../context/CostCentersContext';
import { errorHandler } from '../../../services/errorHandler';
import { useTranslation } from 'react-i18next';

interface TreeNode extends CostCenterDTO {
  children: TreeNode[];
  depth: number;
  matchesSearch?: boolean;
}

function buildTree(items: CostCenterDTO[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  items.forEach(item => map.set(item.id, { ...item, children: [], depth: 0 }));

  items.forEach(item => {
    const node = map.get(item.id)!;
    if (item.parentId && map.has(item.parentId)) {
      const parent = map.get(item.parentId)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const fixDepths = (nodes: TreeNode[], depth: number) => {
    nodes.forEach(n => {
      n.depth = depth;
      fixDepths(n.children, depth + 1);
    });
  };
  fixDepths(roots, 0);

  return roots;
}

export const CostCentersPage: React.FC = () => {
  const { t } = useTranslation('accounting');
  const { costCenters, refresh, loading } = useCostCenters();
  
  const [form, setForm] = useState<Partial<CostCenterDTO>>({ code: '', name: '', description: '', parentId: null });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    refresh();
  }, [refresh]);

  const tree = useMemo(() => buildTree(costCenters), [costCenters]);

  const filterTree = (nodes: TreeNode[], query: string): TreeNode[] => {
      if (!query) return nodes;
      const search = query.toLowerCase();
      
      return nodes.map(node => {
          const matches = 
              node.name.toLowerCase().includes(search) || 
              (node.code || '').toLowerCase().includes(search) ||
              (node.description || '').toLowerCase().includes(search);
          
          const filteredChildren = filterTree(node.children || [], query);
          const hasMatchingChildren = filteredChildren.length > 0;
          
          if (matches || hasMatchingChildren) {
              return { ...node, children: filteredChildren, matchesSearch: matches };
          }
          return null;
      }).filter(Boolean) as TreeNode[];
  };

  const filteredTree = useMemo(() => filterTree(tree, searchQuery), [tree, searchQuery]);
  const effectiveCollapsedIds = searchQuery ? new Set<string>() : collapsedIds;

  const getVisibleNodes = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.reduce((acc: TreeNode[], node) => {
          const visible = [...acc, node];
          const isCollapsed = effectiveCollapsedIds.has(node.id);
          if (!isCollapsed && node.children.length > 0) {
              return [...visible, ...getVisibleNodes(node.children)];
          }
          return visible;
      }, []);
  };

  const flatList = useMemo(() => getVisibleNodes(filteredTree), [filteredTree, effectiveCollapsedIds]);

  const availableParents = useMemo(() => {
    if (!editingId) return costCenters.filter(cc => cc.status === 'ACTIVE');
    const descendants = new Set<string>();
    const collectDescendants = (id: string) => {
      descendants.add(id);
      costCenters.filter(cc => cc.parentId === id).forEach(cc => collectDescendants(cc.id));
    };
    collectDescendants(editingId);
    return costCenters.filter(cc => cc.status === 'ACTIVE' && !descendants.has(cc.id));
  }, [costCenters, editingId]);

  const toggleCollapse = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCollapsedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });
  };

  const expandAll = () => setCollapsedIds(new Set());
  const collapseAll = () => {
    const parentIds = costCenters.filter(cc => costCenters.some(c => c.parentId === cc.id)).map(cc => cc.id);
    setCollapsedIds(new Set(parentIds));
  };

  const openCreateModal = (parentId: string | null = null) => {
    setEditingId(null);
    setForm({ code: '', name: '', description: '', parentId, status: 'ACTIVE' });
    setIsModalOpen(true);
  };

  const startEdit = (cc: CostCenterDTO) => {
    setEditingId(cc.id);
    setForm({ code: cc.code, name: cc.name, description: cc.description, parentId: cc.parentId || null, status: cc.status });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setForm({ code: '', name: '', description: '', parentId: null, status: 'ACTIVE' });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = { ...form };
      if (!payload.parentId) payload.parentId = null;
      if (editingId) {
        await accountingApi.updateCostCenter(editingId, payload);
      } else {
        await accountingApi.createCostCenter(payload);
      }
      closeModal();
      await refresh();
      errorHandler.showSuccess(t('costCenters.saved'));
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error || err?.message || t('costCenters.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDanger?: boolean;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const handleToggleActive = (id: string, name: string, currentStatus: string) => {
    const isActivating = currentStatus === 'INACTIVE';
    const actionTranslation = isActivating ? t('costCenters.confirmActivate', `Are you sure you want to activate cost center "${name}"?`) : t('costCenters.confirmDeactivate', `Are you sure you want to deactivate cost center "${name}"?`);
    
    setConfirmState({
      isOpen: true,
      title: isActivating ? t('common.activate', 'Activate') : t('common.deactivate', 'Deactivate'),
      message: actionTranslation,
      isDanger: !isActivating,
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, isOpen: false }));
        try {
          if (isActivating) {
            await accountingApi.activateCostCenter(id);
          } else {
            await accountingApi.deactivateCostCenter(id);
          }
          await refresh();
          setForm(prev => ({ ...prev, status: isActivating ? 'ACTIVE' : 'INACTIVE' }));
        } catch (err: any) {
          errorHandler.showError(err?.message || (isActivating ? t('costCenters.activateError') : t('costCenters.deactivateError')));
        }
      }
    });
  };

  const handleDelete = (id: string, name: string) => {
    setConfirmState({
      isOpen: true,
      title: t('common.delete', 'Delete'),
      message: t('costCenters.confirmDelete', `Are you sure you want to permanently delete cost center "${name}"? This cannot be undone.`),
      isDanger: true,
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, isOpen: false }));
        try {
          await accountingApi.deleteCostCenter(id);
          await refresh();
        } catch (err: any) {
          errorHandler.showError(err?.message || t('costCenters.deleteError'));
        }
      }
    });
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
          <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('costCenters.title', 'Cost Centers')}</h1>
              <p className="text-sm text-gray-500 mt-1">{t('costCenters.subtitle', 'Manage your organizational cost tracking structure')}</p>
          </div>
          <div className="flex items-center space-x-3">
              <div className="flex bg-gray-100 rounded-md p-0.5 border border-gray-200">
                  <button
                      onClick={expandAll}
                      className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-white rounded transition-all shadow-sm"
                  >
                      {t('costCenters.expandAll', 'Expand All')}
                  </button>
                  <button
                      onClick={collapseAll}
                      className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-white rounded transition-all shadow-sm"
                  >
                      {t('costCenters.collapseAll', 'Collapse All')}
                  </button>
              </div>
              <button
                  onClick={refresh}
                  className="p-2 text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 shadow-sm transition-colors"
                  title={t('costCenters.refresh', 'Refresh')}
              >
                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                  onClick={() => openCreateModal()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm transition-colors flex items-center"
              >
                  <Plus className="w-5 h-5 mr-1" /> {t('costCenters.create', 'New Cost Center')}
              </button>
          </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                  <h3 className="font-bold text-gray-900 text-base">{t('costCenters.listTitle', 'Hierarchy Preview')}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                      {costCenters.length} {t('costCenters.itemsCount', 'cost centers')} • {t('costCenters.clickHint', 'Click row to expand/collapse')}
                  </p>
              </div>
              
              <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                      type="text"
                      placeholder={t('costCenters.searchHint', 'Search by code, name...')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  {searchQuery && (
                      <button 
                          onClick={() => setSearchQuery('')}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                          &times;
                      </button>
                  )}
              </div>
          </div>

          {costCenters.length === 0 && !loading ? (
            <div className="p-8 text-center text-gray-500">
                <Layers className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p>{t('costCenters.empty', 'No cost centers found. Create one to get started.')}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-[calc(100vh-250px)] overflow-y-auto">
                {flatList.map((cc) => {
                    const hasChildren = cc.children.length > 0;
                    const isExpanded = !effectiveCollapsedIds.has(cc.id);
                    const paddingLeft = cc.depth * 32;

                    return (
                        <div 
                            key={cc.id} 
                            className="group flex items-start py-4 px-6 hover:bg-gray-50/80 transition-all cursor-pointer border-l-4 border-l-transparent hover:border-l-blue-500"
                            onClick={() => hasChildren && toggleCollapse(cc.id)}
                        >
                            <div className="flex items-start flex-1" style={{ paddingLeft: `${paddingLeft}px` }}>
                                <div className="w-10 h-10 flex items-center justify-center flex-shrink-0 -mt-1">
                                    {hasChildren ? (
                                        <div className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
                                            {isExpanded ? (
                                                <ChevronDown className="w-4 h-4 text-gray-400" />
                                            ) : (
                                                <ChevronRight className="w-4 h-4 text-gray-400" />
                                            )}
                                        </div>
                                    ) : (
                                        <Circle className="w-1.5 h-1.5 text-gray-300 fill-current" />
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3">
                                        <span className="font-mono text-[13px] text-gray-400 min-w-[3rem] w-auto flex-shrink-0 tracking-tight">
                                            {cc.code}
                                        </span>
                                        <span className={`text-[16px] tracking-tight ${hasChildren ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                                            {cc.name}
                                        </span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold uppercase tracking-tight ${
                                            cc.status === 'ACTIVE' 
                                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                                : 'bg-gray-100 text-gray-500 border border-gray-200'
                                        }`}>
                                            {t(`costCenters.status.${cc.status.toLowerCase()}`, cc.status)}
                                        </span>

                                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity space-x-0.5 ml-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openCreateModal(cc.id);
                                                }}
                                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                                title={t('costCenters.addChild', 'Add Child Cost Center')}
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    startEdit(cc);
                                                }}
                                                className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                title={t('common.edit', 'Edit')}
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(cc.id, cc.name);
                                                }}
                                                className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                title={t('common.delete', 'Delete')}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5 ml-[54px]">
                                      {cc.description ? (
                                        <span className="text-xs text-gray-500">{cc.description}</span>
                                      ) : (
                                        <span className="text-xs text-gray-400 italic">{t('costCenters.noDescription', 'No description')}</span>
                                      )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
          )}
      </div>

      {/* Modern Form Modal */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                       <div>
                         <h2 className="text-xl font-bold text-gray-900">
                           {editingId ? t('costCenters.update', 'Edit Cost Center') : t('costCenters.create', 'Create Cost Center')}
                         </h2>
                         <p className="text-xs text-gray-500 mt-0.5">
                           {editingId ? t('costCenters.updateDesc', 'Update the details below.') : t('costCenters.createDesc', 'Add a new node to your hierarchy.')}
                         </p>
                       </div>
                       <button onClick={closeModal} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                           <span className="text-xl leading-none">&times;</span>
                       </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto flex-1">
                    {editingId && (
                      <div className="flex items-center justify-between mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                          <h4 className="text-sm font-bold text-gray-900">{t('costCenters.statusLabel', 'Cost Center Status')}</h4>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {form.status === 'ACTIVE' ? t('costCenters.statusActiveDesc', 'Currently active and available for use.') : t('costCenters.statusInactiveDesc', 'Currently inactive and hidden from new assignments.')}
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={form.status === 'ACTIVE'}
                            onChange={() => handleToggleActive(editingId, form.name || '', form.status || 'ACTIVE')}
                          />
                          <div className={`relative w-12 h-6 rounded-full transition-colors ${form.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                            <div className={`absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full shadow-md transition-transform ${form.status === 'ACTIVE' ? 'translate-x-6' : 'translate-x-0'}`}></div>
                          </div>
                        </label>
                      </div>
                    )}
                    <form id="cost-center-form" onSubmit={handleSave} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('costCenters.code', 'Code')} *</label>
                        <input
                          autoFocus
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          placeholder={t('costCenters.codePlaceholder', { defaultValue: 'e.g. MKT-01' })}
                          value={form.code || ''}
                          onChange={(e) => setForm({ ...form, code: e.target.value })}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('costCenters.name', 'Name')} *</label>
                        <input
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          placeholder={t('costCenters.namePlaceholder', { defaultValue: 'e.g. Marketing Department' })}
                          value={form.name || ''}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('costCenters.parentLabel', 'Parent Cost Center')}</label>
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white"
                          value={form.parentId || ''}
                          onChange={(e) => setForm({ ...form, parentId: e.target.value || null })}
                        >
                          <option value="">{t('costCenters.noParent', '— No Parent (Root Level) —')}</option>
                          {availableParents.map(cc => (
                            <option key={cc.id} value={cc.id}>
                              {cc.code} — {cc.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('costCenters.description', 'Description')}</label>
                        <textarea
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          placeholder={t('costCenters.descriptionPlaceholder', { defaultValue: 'Optional details about this cost center...' })}
                          value={form.description || ''}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
                        />
                      </div>
                    </form>
                  </div>
                  
                  <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/80 flex justify-end gap-3 rounded-b-xl">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 hover:bg-gray-50 shadow-sm"
                    >
                      {t('common.cancel', 'Cancel')}
                    </button>
                    <button
                      type="submit"
                      form="cost-center-form"
                      disabled={saving}
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 hover:bg-blue-700 shadow-sm disabled:opacity-70"
                    >
                      {saving && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                      {t('common.save', 'Save Cost Center')}
                    </button>
                  </div>
              </div>
          </div>
      )}

      {/* Confirmation Modal */}
      {confirmState.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">{confirmState.title}</h3>
              <p className="text-sm text-gray-600">{confirmState.message}</p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 hover:bg-gray-50"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={confirmState.onConfirm}
                className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-sm ${
                  confirmState.isDanger 
                    ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' 
                    : 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500'
                }`}
              >
                {t('common.confirm', 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CostCentersPage;
