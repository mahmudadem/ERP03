import { client } from './client';

export interface CompanyModuleStatus {
  companyId: string;
  moduleCode: string;
  installedAt: Date;
  initialized: boolean;
  initializationStatus: 'pending' | 'in_progress' | 'complete';
  config: Record<string, any>;
  updatedAt?: Date;
}

export const companyModulesApi = {
  /**
   * List all installed modules for a company
   */
  list: async (companyId: string): Promise<CompanyModuleStatus[]> => {
    try {
      console.log('[companyModulesApi] Calling GET /company-modules/' + companyId);
      const response = await client.get<{ modules: CompanyModuleStatus[] }>(
        `/company-modules/${companyId}`
      );
      console.log('[companyModulesApi] Response received:', response);
      // Axios client is configured to auto-unwrap data, so response IS the data object
      const modules = (response as any).modules || [];
      console.log('[companyModulesApi] Returning modules:', modules);
      return modules;
    } catch (error: any) {
      console.error('[companyModulesApi] API call failed:', error);
      console.error('[companyModulesApi] Error details:', {
        message: error?.message,
        response: error?.response,
        status: error?.response?.status,
        data: error?.response?.data
      });
      return [];
    }
  },

  /**
   * Get a specific module's installation status
   */
  get: async (companyId: string, moduleCode: string): Promise<CompanyModuleStatus> => {
    const { data } = await client.get<CompanyModuleStatus>(
      `/company-modules/${companyId}/${moduleCode}`
    );
    return data;
  },

  /**
   * Mark a module as initialized with optional config
   */
  initialize: async (
    companyId: string,
    moduleCode: string,
    config?: Record<string, any>
  ): Promise<void> => {
    await client.patch(`/company-modules/${companyId}/${moduleCode}/initialize`, {
      config: config || {},
    });
  },

  /**
   * Mark module initialization as in-progress
   */
  startInitialization: async (companyId: string, moduleCode: string): Promise<void> => {
    await client.post(`/company-modules/${companyId}/${moduleCode}/start-initialization`);
  },
};
