export const COMPANY_MODULES_REFRESH_EVENT = 'company-modules:refresh';

export interface CompanyModulesRefreshEventDetail {
  companyId?: string;
  moduleCode?: string;
}

export const emitCompanyModulesRefresh = (
  detail?: CompanyModulesRefreshEventDetail
): void => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent<CompanyModulesRefreshEventDetail>(COMPANY_MODULES_REFRESH_EVENT, {
      detail,
    })
  );
};
