import React from 'react';

export const Dashboard: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-[var(--color-bg-primary)] p-6 rounded-lg shadow-sm border border-[var(--color-border)] transition-colors duration-300">
          <h3 className="text-[var(--color-text-secondary)] text-sm font-medium">Metric {i}</h3>
          <p className="text-2xl font-bold mt-2 text-[var(--color-text-primary)]">$24,500</p>
          <div className="mt-4 text-success-500 text-sm font-medium">+12% from last month</div>
        </div>
      ))}
      
      <div className="col-span-1 md:col-span-2 lg:col-span-3 bg-[var(--color-bg-primary)] p-6 rounded-lg shadow-sm h-96 border border-[var(--color-border)] transition-colors duration-300">
        <h2 className="text-lg font-bold mb-4 text-[var(--color-text-primary)]">Activity Overview</h2>
        <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
          Chart Placeholder
        </div>
      </div>

      <div className="bg-[var(--color-bg-primary)] p-6 rounded-lg shadow-sm h-96 border border-[var(--color-border)] transition-colors duration-300">
        <h2 className="text-lg font-bold mb-4 text-[var(--color-text-primary)]">Quick Actions</h2>
        <div className="space-y-3">
            <button className="w-full bg-primary-600 text-white py-2 rounded hover:bg-primary-700 transition shadow-sm">
              Create Invoice
            </button>
            <button className="w-full border border-[var(--color-border)] text-[var(--color-text-primary)] py-2 rounded hover:bg-[var(--color-bg-tertiary)] transition">
              Add Inventory
            </button>
        </div>
      </div>
    </div>
  );
};