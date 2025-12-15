import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Circle } from 'lucide-react';

interface Account {
  code: string;
  name: string;
  type: string;
  parentCode?: string | null;
}

interface COATreePreviewProps {
  accounts: Account[];
  className?: string;
}

interface TreeNode {
  account: Account;
  children: TreeNode[];
  level: number;
}

/**
 * COA Tree Preview Component
 * Displays a hierarchical tree view of chart of accounts
 */
export const COATreePreview: React.FC<COATreePreviewProps> = ({ accounts, className = '' }) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['1', '2', '3', '4', '5'])); // Expand main categories by default

  // Build tree structure from flat account list
  const buildTree = (accounts: Account[]): TreeNode[] => {
    const accountMap = new Map<string, TreeNode>();
    const rootNodes: TreeNode[] = [];

    // Create nodes
    accounts.forEach(account => {
      accountMap.set(account.code, {
        account,
        children: [],
        level: 0
      });
    });

    // Build parent-child relationships and calculate levels
    accounts.forEach(account => {
      const node = accountMap.get(account.code)!;
      
      if (account.parentCode && accountMap.has(account.parentCode)) {
        const parent = accountMap.get(account.parentCode)!;
        parent.children.push(node);
        node.level = parent.level + 1;
      } else {
        rootNodes.push(node);
      }
    });

    // Sort children by code
    const sortChildren = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => a.account.code.localeCompare(b.account.code));
      nodes.forEach(node => sortChildren(node.children));
    };
    sortChildren(rootNodes);

    return rootNodes;
  };

  const toggleNode = (code: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(code)) {
      newExpanded.delete(code);
    } else {
      newExpanded.add(code);
    }
    setExpandedNodes(newExpanded);
  };

  const renderNode = (node: TreeNode) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedNodes.has(node.account.code);
    const paddingLeft = node.level * 24;

    return (
      <div key={node.account.code}>
        {/* Node Row */}
        <div 
          className="flex items-start py-2 hover:bg-gray-50 rounded cursor-pointer group"
          style={{ paddingLeft: `${paddingLeft + 8}px` }}
          onClick={() => hasChildren && toggleNode(node.account.code)}
        >
          {/* Expand/Collapse Button */}
          <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )
            ) : (
              <Circle className="w-2 h-2 text-gray-300 fill-current" />
            )}
          </div>

          {/* Account Info */}
          <div className="flex-1 min-w-0 ml-2">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-sm text-gray-500 flex-shrink-0">
                {node.account.code}
              </span>
              <span className="text-sm text-gray-900 font-medium truncate">
                {node.account.name}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {node.account.type}
            </div>
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children.map(child => renderNode(child))}
          </div>
        )}
      </div>
    );
  };

  const tree = buildTree(accounts);

  if (!accounts || accounts.length === 0) {
    return (
      <div className={`text-center py-8 text-gray-500 ${className}`}>
        No accounts to preview
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${className}`}>
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="font-semibold text-gray-900 text-sm">Chart Preview</h3>
        <p className="text-xs text-gray-600 mt-0.5">
          {accounts.length} accounts • Click to expand/collapse
        </p>
      </div>
      <div className="px-2 py-2 max-h-96 overflow-y-auto">
        {tree.map(node => renderNode(node))}
      </div>
    </div>
  );
};
