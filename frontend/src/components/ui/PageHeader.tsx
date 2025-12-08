
import React from 'react';

interface PageHeaderProps {
  title: string;
  breadcrumbs?: { label: string; href?: string }[];
  action?: React.ReactNode;
  subtitle?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, breadcrumbs, action, subtitle }) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div>
        {breadcrumbs && (
          <nav className="flex items-center text-sm text-gray-500 mb-1">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={index}>
                {index > 0 && <span className="mx-2">/</span>}
                <span className={crumb.href ? "text-gray-500" : "text-gray-900 font-medium"}>
                  {crumb.label}
                </span>
              </React.Fragment>
            ))}
          </nav>
        )}
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};
