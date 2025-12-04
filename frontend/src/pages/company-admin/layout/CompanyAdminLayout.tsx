
import React from 'react';

interface CompanyAdminLayoutProps {
  children: React.ReactNode;
}

export const CompanyAdminLayout: React.FC<CompanyAdminLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-full bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </div>
    </div>
  );
};
