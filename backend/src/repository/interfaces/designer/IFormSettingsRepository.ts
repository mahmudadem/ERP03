export type FormSettingsModule = 'ACCOUNTING' | 'SALES' | 'PURCHASE' | string;
export type FormKind = 'BUILT_IN_NATIVE' | 'DESIGNER_DEFAULT' | 'DESIGNER_CLONE';
export type LinePriceSource = 'PRICE_LIST' | 'LAST_PARTY_PRICE' | 'LAST_EVENT' | 'ITEM_DEFAULT';

export interface FormAccountDefaults {
  defaultWarehouseId?: string | null;
  defaultCashAccountId?: string | null;
  defaultCostCenterId?: string | null;
}

export interface FormPricingBehavior {
  linePriceSource?: LinePriceSource | null;
}

export interface FormSettingsValue {
  accountDefaults?: FormAccountDefaults;
  pricingBehavior?: FormPricingBehavior;
  [namespace: string]: any;
}

export interface FormSettingsRecord {
  id: string;
  companyId: string;
  module: FormSettingsModule;
  documentKind: string;
  formKind: FormKind;
  formId?: string | null;
  builtInFormKey?: string | null;
  settings: FormSettingsValue;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  updatedBy?: string | null;
}

export interface FormSettingsIdentity {
  module: FormSettingsModule;
  documentKind: string;
  formKind: FormKind;
  formId?: string | null;
  builtInFormKey?: string | null;
}

export interface IFormSettingsRepository {
  listByCompanyAndModule(companyId: string, module: FormSettingsModule): Promise<FormSettingsRecord[]>;
  getByIdentity(companyId: string, identity: FormSettingsIdentity): Promise<FormSettingsRecord | null>;
  upsert(companyId: string, identity: FormSettingsIdentity, settings: FormSettingsValue, updatedBy?: string | null): Promise<FormSettingsRecord>;
  cloneSettings(companyId: string, sourceFormId: string, targetFormId: string, updatedBy?: string | null): Promise<void>;
}
