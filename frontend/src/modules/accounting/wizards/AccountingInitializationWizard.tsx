import React from 'react';
import { ModuleInitializationWizard } from '../../../components/wizards/ModuleInitializationWizard';

/**
 * Accounting module initialization wizard
 * Future: Add COA template selection, base currency, fiscal year setup
 */
export const AccountingInitializationWizard: React.FC = () => {
  return (
    <ModuleInitializationWizard
      moduleCode="accounting"
      moduleName="Accounting"
      description="Set up your chart of accounts, fiscal year, and accounting preferences."
      steps={
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold shrink-0 mt-0.5">
              1
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Chart of Accounts</h3>
              <p className="text-sm text-gray-600">
                A default chart of accounts will be created for you. You can customize it later.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold shrink-0 mt-0.5">
              2
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Fiscal Year</h3>
              <p className="text-sm text-gray-600">
                Using calendar year (Jan 1 - Dec 31). Change in settings if needed.
              </p>
            </div>
          </div>
        </div>
      }
      redirectPath="/accounting"
    />
  );
};

export default AccountingInitializationWizard;
