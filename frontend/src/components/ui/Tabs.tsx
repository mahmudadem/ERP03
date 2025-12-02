import { useState } from 'react';

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTabId?: string;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, defaultTabId, className = '' }) => {
  const [activeTab, setActiveTab] = useState(defaultTabId || tabs[0]?.id);

  if (!tabs.length) return null;

  return (
    <div className={`w-full ${className}`}>
      <div className="flex border-b border-gray-200 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              py-2 px-4 text-sm font-medium border-b-2 transition-colors
              ${activeTab === tab.id 
                ? 'border-blue-500 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div>
        {tabs.map((tab) => {
          if (tab.id !== activeTab) return null;
          return <div key={tab.id}>{tab.content}</div>;
        })}
      </div>
    </div>
  );
};