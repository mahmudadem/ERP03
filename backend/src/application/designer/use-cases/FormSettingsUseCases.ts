import {
  FormSettingsIdentity,
  FormSettingsRecord,
  FormSettingsValue,
  IFormSettingsRepository,
  LinePriceSource,
} from '../../../repository/interfaces/designer/IFormSettingsRepository';

const VALID_LINE_PRICE_SOURCES = new Set<LinePriceSource>([
  'PRICE_LIST',
  'LAST_PARTY_PRICE',
  'LAST_EVENT',
  'ITEM_DEFAULT',
]);

export class FormSettingsUseCases {
  constructor(private readonly repository: IFormSettingsRepository) {}

  list(companyId: string, module: string): Promise<FormSettingsRecord[]> {
    return this.repository.listByCompanyAndModule(companyId, module);
  }

  get(companyId: string, identity: FormSettingsIdentity): Promise<FormSettingsRecord | null> {
    return this.repository.getByIdentity(companyId, identity);
  }

  async save(
    companyId: string,
    identity: FormSettingsIdentity,
    settings: FormSettingsValue,
    updatedBy?: string | null,
  ): Promise<FormSettingsRecord> {
    this.validateIdentity(identity);
    const normalized = this.normalizeSettings(settings);
    return this.repository.upsert(companyId, identity, normalized, updatedBy);
  }

  clone(companyId: string, sourceFormId: string, targetFormId: string, updatedBy?: string | null): Promise<void> {
    if (!sourceFormId || !targetFormId) return Promise.resolve();
    return this.repository.cloneSettings(companyId, sourceFormId, targetFormId, updatedBy);
  }

  private validateIdentity(identity: FormSettingsIdentity) {
    if (!identity.module) throw new Error('module is required');
    if (!identity.documentKind) throw new Error('documentKind is required');
    if (!identity.formKind) throw new Error('formKind is required');
    if (identity.formKind === 'BUILT_IN_NATIVE' && !identity.builtInFormKey) {
      throw new Error('builtInFormKey is required for built-in forms');
    }
    if (identity.formKind !== 'BUILT_IN_NATIVE' && !identity.formId) {
      throw new Error('formId is required for designer forms');
    }
  }

  private normalizeSettings(settings: FormSettingsValue): FormSettingsValue {
    const linePriceSource = settings?.pricingBehavior?.linePriceSource || null;
    if (linePriceSource && !VALID_LINE_PRICE_SOURCES.has(linePriceSource)) {
      throw new Error('linePriceSource must be PRICE_LIST, LAST_PARTY_PRICE, LAST_EVENT or ITEM_DEFAULT');
    }

    return {
      ...settings,
      accountDefaults: {
        defaultWarehouseId: settings?.accountDefaults?.defaultWarehouseId || null,
        defaultCashAccountId: settings?.accountDefaults?.defaultCashAccountId || null,
        defaultCostCenterId: settings?.accountDefaults?.defaultCostCenterId || null,
      },
      pricingBehavior: {
        linePriceSource,
      },
    };
  }
}
