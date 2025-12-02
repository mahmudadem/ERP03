import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountingApi, Account } from '../../../api/accounting';
import { AccountForm } from '../components/AccountForm';

export default function AccountsListPage() {
    const queryClient = useQueryClient();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);

    const { data: accounts = [], isLoading } = useQuery({
        queryKey: ['accounts'],
        queryFn: accountingApi.getAccounts,
    });

    const createMutation = useMutation({
        mutationFn: accountingApi.createAccount,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            setIsCreateModalOpen(false);
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => accountingApi.updateAccount(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            setEditingAccount(null);
        },
    });

    const deactivateMutation = useMutation({
        mutationFn: accountingApi.deactivateAccount,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
        },
    });

    const handleDeactivate = async (id: string) => {
        if (confirm('Are you sure you want to deactivate this account?')) {
            try {
                await deactivateMutation.mutateAsync(id);
            } catch (error: any) {
                alert(error.message || 'Failed to deactivate account');
            }
        }
    };

    // Build account tree
    const buildTree = (accounts: Account[], parentId: string | null = null, level: number = 0): any[] => {
        return accounts
            .filter((acc) => (acc.parentId || null) === parentId)
            .map((acc) => ({
                ...acc,
                level,
                children: buildTree(accounts, acc.id, level + 1),
            }));
    };

    const flattenTree = (tree: any[]): any[] => {
        return tree.reduce((acc, node) => {
            return [...acc, node, ...flattenTree(node.children)];
        }, []);
    };

    const safeAccounts = Array.isArray(accounts) ? accounts : [];
    const accountTree = buildTree(safeAccounts);
    const flatAccounts = flattenTree(accountTree);

    if (isLoading) {
        return <div className="p-6">Loading accounts...</div>;
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Chart of Accounts</h1>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                    New Account
                </button>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Code
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Type
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Currency
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {flatAccounts.map((account) => (
                            <tr key={account.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{account.code}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900" style={{ paddingLeft: `${account.level * 2 + 1.5}rem` }}>
                                    {account.name}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{account.type}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${account.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {account.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{account.currency || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                    <button
                                        onClick={() => setEditingAccount(account)}
                                        className="text-blue-600 hover:text-blue-900"
                                    >
                                        Edit
                                    </button>
                                    {!account.isProtected && account.isActive && (
                                        <button
                                            onClick={() => handleDeactivate(account.id)}
                                            className="text-red-600 hover:text-red-900"
                                        >
                                            Deactivate
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full">
                        <h2 className="text-xl font-bold mb-4">Create New Account</h2>
                        <AccountForm
                            mode="create"
                            accounts={safeAccounts}
                            onSubmit={(data) => createMutation.mutateAsync(data)}
                            onCancel={() => setIsCreateModalOpen(false)}
                        />
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingAccount && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full">
                        <h2 className="text-xl font-bold mb-4">Edit Account</h2>
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
