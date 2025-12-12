import React from 'react';
import { ModuleInitializationWizard } from '../../../components/wizards/ModuleInitializationWizard';

/**
 * Company Admin module initialization wizard
 */
export const CompanyAdminInitializationWizard: React.FC = () => {
  return (
    <ModuleInitializationWizard
      moduleCode="companyAdmin"
      moduleName="Company Administration"
      description="Company settings, user management, and permissions are ready to use."
      redirectPath="/company-admin"
    />
  );
};

export default CompanyAdminInitializationWizard;
