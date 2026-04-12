import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { accountingApi, Account, AccountClassification, AccountRole, CurrencyPolicy } from '../../../api/accounting';
import { AccountForm } from '../components/AccountForm';
import { errorHandler } from '../../../services/errorHandler';
import { useCompanyProfile } from '../../../hooks/useCompanyAdmin';
import { Folder, FileText, Lock, AlertTriangle, ChevronRight, ChevronDown, Circle, MoreVertical, Edit2, Trash2, Search, Plus, Globe, AlertCircle } from 'lucide-react';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';

export default function AccountsListPage() {
    const { t } = useTranslation('accounting');
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [prePopulatedData, setPrePopulatedData] = useState<Partial<Account> | null>(null);
    const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [showPostingWarning, setShowPostingWarning] = useState(false);
    const [warningParentName, setWarningParentName] = useState('');

    const toggleCollapse = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newCollapsed = new Set(collapsedIds);
        if (newCollapsed.has(id)) {
            newCollapsed.delete(id);
        } else {
            newCollapsed.add(id);
        }
        setCollapsedIds(newCollapsed);
    };

    const expandAll = () => {
        const headerIds = accounts
            .filter(a => a.accountRole === 'HEADER' || (a as any).hasChildren)
            .map(a => a.id);
        setCollapsedIds(new Set());
    };

    const collapseAll = () => {
        const headerIds = accounts
            .filter(a => a.accountRole === 'HEADER' || (a as any).hasChildren)
            .map(a => a.id);
        setCollapsedIds(new Set(headerIds));
    };

    const { data: accounts = [], isLoading } = useQuery({
        queryKey: ['accounts'],
        queryFn: accountingApi.getAccounts,
    });

    const { profile: companyProfile } = useCompanyProfile();
    const baseCurrency = companyProfile?.currency || '';

    const clearEditQueryParam = () => {
        const editId = searchParams.get('editId');
        if (!editId) return;
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('editId');
        setSearchParams(nextParams, { replace: true });
    };

    const closeEditModal = () => {
        setEditingAccount(null);
        clearEditQueryParam();
    };

    const createMutation = useMutation({
        mutationFn: accountingApi.createAccount,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            setIsCreateModalOpen(false);
            errorHandler.showSuccess(t('accountsList.messages.created', { defaultValue: 'Account created successfully' }));
        },
        onError: (err) => errorHandler.showError(err)
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => accountingApi.updateAccount(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            closeEditModal();
            errorHandler.showSuccess(t('accountsList.messages.updated', { defaultValue: 'Account updated successfully' }));
        },
        onError: (err) => errorHandler.showError(err)
    });

    const deactivateMutation = useMutation({
        mutationFn: accountingApi.deactivateAccount,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            errorHandler.showSuccess(t('accountsList.messages.deactivated', { defaultValue: 'Account deactivated' }));
        },
        onError: (err) => errorHandler.showError(err)
    });

    const handleDeactivate = async (id: string, name: string) => {
        if (confirm(t('accountsList.messages.confirmDeactivate', { name, defaultValue: `Are you sure you want to deactivate account "${name}"?` }))) {
            try {
                await deactivateMutation.mutateAsync(id);
            } catch (error: any) {
                // handled by mutation onError
            }
        }
    };

    // Build account tree
    const buildTree = (accounts: Account[], parentId: string | null = null, level: number = 0, visited = new Set<string>()): any[] => {
        return accounts
            .filter((acc) => (acc.parentId || null) === parentId)
            .map((acc) => {
                // Infinite loop protection
                if (visited.has(acc.id)) return null;
                const newVisited = new Set(visited);
                newVisited.add(acc.id);

                return {
                    ...acc,
                    level,
                    children: buildTree(accounts, acc.id, level + 1, newVisited),
                };
            })
            .filter(Boolean);
    };

    const flattenTree = (tree: any[]): any[] => {
        return tree.reduce((acc, node) => {
            return [...acc, node, ...flattenTree(node.children)];
        }, []);
    };

    const safeAccounts = Array.isArray(accounts) ? accounts : [];
    
    // Support deep-linking from reports: /accounting/accounts?editId=<accountId>
    useEffect(() => {
        const editId = searchParams.get('editId');
        if (!editId || safeAccounts.length === 0) return;
        if (editingAccount?.id === editId) return;
        const accountToEdit = safeAccounts.find((a) => a.id === editId);
        if (accountToEdit) {
            setEditingAccount(accountToEdit);
        }
    }, [searchParams, safeAccounts, editingAccount?.id]);
    
    // Sort logic before tree build? Usually code sort is good
    const sortedAccounts = [...safeAccounts].sort((a, b) => a.userCode.localeCompare(b.userCode));
    
    // Identify orphaned accounts (parentId is set but doesn't exist in the list)
    const allIds = new Set(sortedAccounts.map(a => a.id));
    const processedSortedAccounts = sortedAccounts.map(acc => {
        if (acc.parentId && !allIds.has(acc.parentId)) {
            return { ...acc, parentId: null, isOrphan: true };
        }
        return acc;
    });

    const accountTree = buildTree(processedSortedAccounts);

    // Final check for "Unreachable" accounts (due to circular references)
    const reachedIds = new Set<string>();
    const markReached = (nodes: any[]) => {
        nodes.forEach(n => {
            reachedIds.add(n.id);
            if (n.children) markReached(n.children);
        });
    };
    markReached(accountTree);

    const unreachableAccounts = processedSortedAccounts
        .filter(acc => !reachedIds.has(acc.id))
        .map(acc => ({ ...acc, parentId: null, isCircular: true }));

    // Re-build tree if we found unreachable accounts
    const finalAccountTree = unreachableAccounts.length > 0 
        ? [...accountTree, ...buildTree(unreachableAccounts)]
        : accountTree;
    
    // Search filter logic
    const filterTree = (nodes: any[], query: string): any[] => {
        if (!query) return nodes;
        const search = query.toLowerCase();
        
        return nodes.map(node => {
            const matches = 
                node.name.toLowerCase().includes(search) || 
                (node.userCode || '').toLowerCase().includes(search) ||
                (node.classification || '').toLowerCase().includes(search);
            
            const filteredChildren = filterTree(node.children || [], query);
            const hasMatchingChildren = filteredChildren.length > 0;
            
            if (matches || hasMatchingChildren) {
                return { ...node, children: filteredChildren, matchesSearch: matches };
            }
            return null;
        }).filter(Boolean);
    };

    const filteredTree = filterTree(finalAccountTree, searchQuery);
    
    // Auto-expand parents when searching
    const effectiveCollapsedIds = searchQuery ? new Set() : collapsedIds;

    const getVisibleAccounts = (nodes: any[]): any[] => {
        return nodes.reduce((acc, node) => {
            const visible = [...acc, node];
            const isCollapsed = effectiveCollapsedIds.has(node.id);
            if (!isCollapsed && node.children.length > 0) {
                return [...visible, ...getVisibleAccounts(node.children)];
            }
            return visible;
        }, []);
    };

    const flatAccounts = getVisibleAccounts(filteredTree);

    const getClassificationColor = (c: AccountClassification | string) => {
        switch (c) {
            case 'ASSET': return 'bg-blue-100 text-blue-800';
            case 'LIABILITY': return 'bg-red-100 text-red-800';
            case 'EQUITY': return 'bg-purple-100 text-purple-800';
            case 'REVENUE': 
            case 'INCOME': return 'bg-green-100 text-green-800';
            case 'EXPENSE': return 'bg-yellow-100 text-yellow-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getRoleBadge = (role: AccountRole | string) => {
        if (role === 'HEADER') return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"><Folder className="w-3 h-3 mr-1"/> {t('accountsList.roles.header', { defaultValue: 'Header' })}</span>;
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-100 text-cyan-800"><FileText className="w-3 h-3 mr-1"/> {t('accountsList.roles.posting', { defaultValue: 'Posting' })}</span>;
    };

    const getEffectiveCurrency = (account: any): { code: string; isInherited: boolean; type: CurrencyPolicy } => {
        if (account.currencyPolicy === 'FIXED') {
            return { 
                code: account.fixedCurrencyCode || account.currency || baseCurrency, 
                isInherited: false,
                type: 'FIXED'
            };
        }
        if (account.currencyPolicy === 'OPEN') {
            return { code: 'ANY', isInherited: false, type: 'OPEN' };
        }

        // INHERIT Logic: Traverse upwards
        let currentParentId = account.parentId;
        while (currentParentId) {
            const parent = accounts.find(a => a.id === currentParentId);
            if (!parent) break;
            if (parent.currencyPolicy === 'FIXED') {
                return { 
                    code: parent.fixedCurrencyCode || parent.currency || baseCurrency, 
                    isInherited: true,
                    type: 'FIXED'
                };
            }
            if (parent.currencyPolicy === 'OPEN') {
                return { code: 'ANY', isInherited: true, type: 'OPEN' };
            }
            currentParentId = parent.parentId;
        }

        // Default for root or deep inherit
        return { code: baseCurrency, isInherited: true, type: 'FIXED' };
    };

    if (isLoading) {
        return (
            <div className="p-8 flex justify-center items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-500">{t('accountsList.loading', { defaultValue: 'Loading accounts...' })}</span>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{t('accountsList.title', { defaultValue: 'Chart of Accounts' })}</h1>
                    <p className="text-sm text-gray-500 mt-1">{t('accountsList.subtitle', { defaultValue: 'Manage your financial account structure' })}</p>
                </div>
                <div className="flex items-center space-x-3">
                    <div className="flex bg-gray-100 rounded-md p-0.5 border border-gray-200">
                        <button
                            onClick={expandAll}
                            className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-white rounded transition-all shadow-sm"
                        >
                            {t('accountsList.actions.expandAll', { defaultValue: 'Expand All' })}
                        </button>
                        <button
                            onClick={collapseAll}
                            className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-white rounded transition-all shadow-sm"
                        >
                            {t('accountsList.actions.collapseAll', { defaultValue: 'Collapse All' })}
                        </button>
                    </div>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm transition-colors flex items-center"
                    >
                        <span className="text-lg mr-1">+</span> {t('accountsList.actions.newAccount', { defaultValue: 'New Account' })}
                    </button>
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h3 className="font-bold text-gray-900 text-base">{t('accountsList.preview.title', { defaultValue: 'Chart Preview' })}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {t('accountsList.preview.count', { count: accounts.length, defaultValue: '{{count}} accounts' })} • {t('accountsList.preview.expandHint', { defaultValue: 'Click to expand/collapse' })}
                        </p>
                    </div>
                    
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder={t('accountsList.searchPlaceholder', { defaultValue: 'Search accounts...' })}
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

                <div className="divide-y divide-gray-50 max-h-[calc(100vh-250px)] overflow-y-auto">
                    {flatAccounts.map((account) => {
                        const isHeader = account.accountRole === 'HEADER';
                        const hasChildren = account.children?.length > 0;
                        const canExpand = isHeader || hasChildren;
                        const isExpanded = !collapsedIds.has(account.id);
                        const paddingLeft = account.level * 32;

                        return (
                            <div 
                                key={account.id} 
                                className="group flex items-start py-4 px-6 hover:bg-gray-50/80 transition-all cursor-pointer border-l-4 border-l-transparent hover:border-l-blue-500"
                                onClick={() => canExpand && toggleCollapse(account.id, { stopPropagation: () => {} } as any)}
                            >
                                <div className="flex items-start flex-1" style={{ paddingLeft: `${paddingLeft}px` }}>
                                    {/* Chevron/Icon Column */}
                                    <div className="w-10 h-10 flex items-center justify-center flex-shrink-0 -mt-1">
                                        {canExpand ? (
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

                                    {/* Content Column */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono text-[13px] text-gray-400 w-12 flex-shrink-0 tracking-tight">
                                                {account.userCode}
                                            </span>
                                            <span className={`text-[16px] tracking-tight ${isHeader ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                                                {account.name}
                                            </span>
                                            {account.isOrphan && (
                                                <span className="flex items-center gap-1 text-[10px] bg-amber-50 text-amber-600 font-bold px-1.5 py-0.5 rounded border border-amber-100">
                                                    <AlertTriangle className="w-3 h-3" /> {t('accountsList.badges.orphaned', { defaultValue: 'Orphaned' })}
                                                </span>
                                            )}
                                            {account.isCircular && (
                                                <span className="flex items-center gap-1 text-[10px] bg-red-50 text-red-600 font-bold px-1.5 py-0.5 rounded border border-red-100" title={t('accountsList.badges.circularTooltip', { defaultValue: 'Circular Reference Detected: This account points to its own descendant!' })}>
                                                    <AlertTriangle className="w-3 h-3" /> {t('accountsList.badges.circular', { defaultValue: 'Circular Loop' })}
                                                </span>
                                            )}
                                            {account.isProtected && <Lock className="w-3 h-3 text-amber-500 flex-shrink-0" />}

                                            {/* Actions - Visible on Hover next to name/badges */}
                                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity space-x-0.5 ml-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        
                                                        // Safety Check: Prevent creating children under Posting accounts
                                                        if (account.accountRole === 'POSTING') {
                                                            setWarningParentName(account.name);
                                                            setShowPostingWarning(true);
                                                            return;
                                                        }

                                                        // Smart Code Suggestion Logic
                                                        const parentCode = account.userCode || '';
                                                        const children = safeAccounts.filter(a => a.parentId === account.id);
                                                        const suffixes = children
                                                            .map(c => (c.userCode || '').slice(parentCode.length))
                                                            .filter(s => /^\d+$/.test(s))
                                                            .map(s => parseInt(s, 10));
                                                        
                                                        const nextSeq = suffixes.length > 0 ? Math.max(...suffixes) + 1 : 1;
                                                        const suggestedCode = `${parentCode}${nextSeq.toString().padStart(2, '0')}`;

                                                        setPrePopulatedData({
                                                            parentId: account.id,
                                                            userCode: suggestedCode,
                                                            classification: account.classification || account.type as any,
                                                            balanceNature: account.balanceNature,
                                                            currencyPolicy: account.currencyPolicy,
                                                            fixedCurrencyCode: account.fixedCurrencyCode || account.currency,
                                                            accountRole: 'POSTING'
                                                        });
                                                        setIsCreateModalOpen(true);
                                                    }}
                                                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                                    title={t('accountsList.actions.addChild', { defaultValue: 'Add Child Account' })}
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingAccount(account);
                                                    }}
                                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                    title={t('accountsList.actions.edit', { defaultValue: 'Edit Account' })}
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                                {!account.isProtected && (account.status === 'ACTIVE' || account.isActive) && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeactivate(account.id, account.name);
                                                        }}
                                                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                        title={t('accountsList.actions.deactivate', { defaultValue: 'Deactivate Account' })}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5 ml-[60px]">
                                            <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">
                                                {account.classification?.toLowerCase() || account.type?.toLowerCase()}
                                            </span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold uppercase tracking-tight ${
                                                isHeader 
                                                    ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' 
                                                    : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                            }`}>
                                                {account.accountRole || (hasChildren ? t('accountsList.roles.header', { defaultValue: 'HEADER' }) : t('accountsList.roles.posting', { defaultValue: 'POSTING' }))}
                                            </span>
                                            {(() => {
                                                const effective = getEffectiveCurrency(account);
                                                if (effective.type === 'OPEN') {
                                                    return (
                                                        <span className="text-[10px] bg-purple-50 text-purple-600 font-extrabold px-1.5 py-0.5 rounded uppercase border border-purple-100 flex items-center gap-1">
                                                            <Globe className="w-2.5 h-2.5" /> ANY
                                                        </span>
                                                    );
                                                }
                                                return (
                                                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase border flex items-center gap-1 ${
                                                        effective.isInherited 
                                                            ? 'bg-transparent text-blue-400 border-blue-200 border-dashed' 
                                                            : 'bg-blue-50 text-blue-600 border-blue-100'
                                                    }`} title={account.level === 0 ? t('accountsList.currency.rootLock', { defaultValue: 'Root Level Currency Lock (Immutable)' }) : effective.isInherited ? t('accountsList.currency.inheritedPolicy', { defaultValue: 'Inherited Policy' }) : t('accountsList.currency.fixedPolicy', { defaultValue: 'Fixed Policy' })}>
                                                        {account.level === 0 && <Lock size={10} className="text-blue-500 opacity-80" />}
                                                        {effective.code}
                                                        {effective.isInherited && account.level !== 0 && <span className="text-[8px] opacity-70">↓</span>}
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>

                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Create Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                    <AccountForm
                        mode="create"
                        initialValues={prePopulatedData as any}
                        accounts={safeAccounts}
                        onSubmit={(data) => {
                            return createMutation.mutateAsync(data).then(() => {
                                setPrePopulatedData(null);
                            });
                        }}
                        onCancel={() => {
                            setIsCreateModalOpen(false);
                            setPrePopulatedData(null);
                        }}
                    />
                </div>
            )}

             {/* Edit Modal */}
            {editingAccount && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                    <AccountForm
                        mode="edit"
                        initialValues={editingAccount}
                        accounts={safeAccounts}
                        onSubmit={(data) => updateMutation.mutateAsync({ id: editingAccount.id, data })}
                        onCancel={closeEditModal}
                    />
                </div>
            )}

            {/* Posting Account Safety Overlay */}
            <ConfirmDialog
                isOpen={showPostingWarning}
                title="Invalid Parent Selection"
                tone="warning"
                icon={<AlertCircle size={24} />}
                message={
                <div className="space-y-4">
                    <p>You are attempting to create a new account as a child of <strong className="text-slate-900 italic">"{warningParentName}"</strong>.</p>
                    <div className="bg-amber-100/50 p-4 rounded-xl border border-amber-200">
                        <h4 className="text-xs font-black text-amber-800 uppercase tracking-widest mb-1">Accounting Rule Violation</h4>
                        <p className="text-amber-700 text-xs leading-relaxed">
                            Account <strong>"{warningParentName}"</strong> is a <span className="underline decoration-2">Posting Account</span> (Transaction level). 
                            In a professional Chart of Accounts, only <strong>Header Accounts</strong> can have children.
                        </p>
                    </div>
                    <p className="text-slate-500 italic text-[11px]">
                        <strong>Instruction:</strong> To organize your accounts correctly, please select a Header Account (Summary Account) before clicking the creation button, or create a root-level account first.
                    </p>
                </div>
                }
                confirmLabel="I Understand"
                onConfirm={() => setShowPostingWarning(false)}
                onCancel={() => setShowPostingWarning(false)}
            />
        </div>
    );
}
