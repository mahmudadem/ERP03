import React from 'react';

export const Dashboard: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Metric {i}</h3>
          <p className="text-2xl font-bold mt-2">$24,500</p>
          <div className="mt-4 text-green-500 text-sm font-medium">+12% from last month</div>
        </div>
      ))}
      
      <div className="col-span-1 md:col-span-2 lg:col-span-3 bg-white p-6 rounded-lg shadow-sm h-96 border border-gray-100">
        <h2 className="text-lg font-bold mb-4">Activity Overview</h2>
        <div className="flex items-center justify-center h-full text-gray-400">
          Chart Placeholder
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm h-96 border border-gray-100">
        <h2 className="text-lg font-bold mb-4">Quick Actions</h2>
        <div className="space-y-3">
            <button className="w-full bg-accent text-white py-2 rounded hover:bg-blue-600 transition">
              Create Invoice
            </button>
            <button className="w-full border border-gray-300 py-2 rounded hover:bg-gray-50 transition">
              Add Inventory
            </button>
        </div>
      </div>
    </div>
  );
};