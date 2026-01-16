import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountingApi, Account, AccountClassification, AccountRole } from '../../../api/accounting';
import { AccountForm } from '../components/AccountForm';
import { errorHandler } from '../../../services/errorHandler';
import { Folder, FileText, Lock, AlertTriangle, ChevronRight, ChevronDown, Circle, MoreVertical, Edit2, Trash2, Search, Plus } from 'lucide-react';

export default function AccountsListPage() {
    const queryClient = useQueryClient();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [prePopulatedData, setPrePopulatedData] = useState<Partial<Account> | null>(null);
    const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');

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

    const createMutation = useMutation({
        mutationFn: accountingApi.createAccount,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            setIsCreateModalOpen(false);
            errorHandler.showSuccess('Account created successfully');
        },
        onError: (err) => errorHandler.showError(err)
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => accountingApi.updateAccount(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            setEditingAccount(null);
            errorHandler.showSuccess('Account updated successfully');
        },
        onError: (err) => errorHandler.showError(err)
    });

    const deactivateMutation = useMutation({
        mutationFn: accountingApi.deactivateAccount,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            errorHandler.showSuccess('Account deactivated');
        },
        onError: (err) => errorHandler.showError(err)
    });

    const handleDeactivate = async (id: string, name: string) => {
        if (confirm(`Are you sure you want to deactivate account "${name}"?`)) {
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
        if (role === 'HEADER') return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"><Folder className="w-3 h-3 mr-1"/> Header</span>;
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-100 text-cyan-800"><FileText className="w-3 h-3 mr-1"/> Posting</span>;
    };

    if (isLoading) {
        return (
            <div className="p-8 flex justify-center items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-500">Loading accounts...</span>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Chart of Accounts</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage your financial account structure</p>
                </div>
                <div className="flex items-center space-x-3">
                    <div className="flex bg-gray-100 rounded-md p-0.5 border border-gray-200">
                        <button
                            onClick={expandAll}
                            className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-white rounded transition-all shadow-sm"
                        >
                            Expand All
                        </button>
                        <button
                            onClick={collapseAll}
                            className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-white rounded transition-all shadow-sm"
                        >
                            Collapse All
                        </button>
                    </div>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm transition-colors flex items-center"
                    >
                        <span className="text-lg mr-1">+</span> New Account
                    </button>
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h3 className="font-bold text-gray-900 text-base">Chart Preview</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {accounts.length} accounts • Click to expand/collapse
                        </p>
                    </div>
                    
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search accounts..."
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
                                                    <AlertTriangle className="w-3 h-3" /> Orphaned
                                                </span>
                                            )}
                                            {account.isCircular && (
                                                <span className="flex items-center gap-1 text-[10px] bg-red-50 text-red-600 font-bold px-1.5 py-0.5 rounded border border-red-100" title="Circular Reference Detected: This account points to its own descendant!">
                                                    <AlertTriangle className="w-3 h-3" /> Circular Loop
                                                </span>
                                            )}
                                            {account.isProtected && <Lock className="w-3 h-3 text-amber-500 flex-shrink-0" />}

                                            {/* Actions - Visible on Hover next to name/badges */}
                                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity space-x-0.5 ml-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        
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
                                                    title="Add Child Account"
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingAccount(account);
                                                    }}
                                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                    title="Edit Account"
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
                                                        title="Deactivate Account"
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
                                                {account.accountRole || (hasChildren ? 'HEADER' : 'POSTING')}
                                            </span>
                                            {account.currencyPolicy === 'FIXED' && (
                                                <span className="text-[10px] bg-blue-50 text-blue-600 font-extrabold px-1.5 py-0.5 rounded uppercase border border-blue-100">
                                                    {account.fixedCurrencyCode || account.currency}
                                                </span>
                                            )}
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
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="mb-4 pb-2 border-b flex justify-between items-center">
                             <h2 className="text-xl font-bold text-gray-800">Create New Account</h2>
                             <button onClick={() => {
                                 setIsCreateModalOpen(false);
                                 setPrePopulatedData(null);
                             }} className="text-gray-400 hover:text-gray-600">
                                 <span className="text-2xl">&times;</span>
                             </button>
                        </div>
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
                </div>
            )}

            {/* Edit Modal */}
            {editingAccount && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="mb-4 pb-2 border-b flex justify-between items-center">
                             <h2 className="text-xl font-bold text-gray-800">Edit Account: {editingAccount.name}</h2>
                             <button onClick={() => setEditingAccount(null)} className="text-gray-400 hover:text-gray-600">
                                 <span className="text-2xl">&times;</span>
                             </button>
                        </div>
                        <AccountForm
                            mode="edit"
                            initialValues={editingAccount}
                            accounts={safeAccounts}
                            onSubmit={(data) => updateMutation.mutateAsync({ id: editingAccount.id, data })}
                            onCancel={() => setEditingAccount(null)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
