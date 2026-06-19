import { PrismaClient } from '@prisma/client';
import {
  FormSettingsIdentity,
  FormSettingsModule,
  FormSettingsRecord,
  FormSettingsValue,
  IFormSettingsRepository,
} from '../../../../repository/interfaces/designer/IFormSettingsRepository';

const MODULE_ID = 'form_settings';

const normalizeModule = (value: string): string => {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'PURCHASES') return 'PURCHASE';
  return raw || 'ACCOUNTING';
};

const settingsIdForIdentity = (identity: FormSettingsIdentity): string =>
  identity.formKind === 'BUILT_IN_NATIVE'
    ? `native_${String(identity.builtInFormKey || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`
    : `form_${String(identity.formId || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`;

export class PrismaFormSettingsRepository implements IFormSettingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listByCompanyAndModule(companyId: string, module: FormSettingsModule): Promise<FormSettingsRecord[]> {
    const store = await this.loadStore(companyId);
    return Object.values(store)
      .filter((record) => normalizeModule(record.module) === normalizeModule(module));
  }

  async getByIdentity(companyId: string, identity: FormSettingsIdentity): Promise<FormSettingsRecord | null> {
    const store = await this.loadStore(companyId);
    return store[settingsIdForIdentity(identity)] || null;
  }

  async upsert(
    companyId: string,
    identity: FormSettingsIdentity,
    settings: FormSettingsValue,
    updatedBy?: string | null,
  ): Promise<FormSettingsRecord> {
    const store = await this.loadStore(companyId);
    const id = settingsIdForIdentity(identity);
    const now = new Date().toISOString();
    const existing = store[id];
    const record: FormSettingsRecord = {
      id,
      companyId,
      module: normalizeModule(identity.module),
      documentKind: identity.documentKind,
      formKind: identity.formKind,
      formId: identity.formId || null,
      builtInFormKey: identity.builtInFormKey || null,
      settings,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      updatedBy: updatedBy || null,
    };
    store[id] = record;
    await this.saveStore(companyId, store);
    return record;
  }

  async cloneSettings(companyId: string, sourceFormId: string, targetFormId: string, updatedBy?: string | null): Promise<void> {
    const store = await this.loadStore(companyId);
    const source = Object.values(store).find((record) => record.formId === sourceFormId);
    if (!source) return;
    await this.upsert(companyId, {
      module: source.module,
      documentKind: source.documentKind,
      formKind: 'DESIGNER_CLONE',
      formId: targetFormId,
    }, source.settings, updatedBy);
  }

  private async loadStore(companyId: string): Promise<Record<string, FormSettingsRecord>> {
    const row = await this.prisma.companyModuleSettings.findUnique({
      where: { companyId_moduleId: { companyId, moduleId: MODULE_ID } },
    });
    return (row?.settings as any)?.records || {};
  }

  private async saveStore(companyId: string, records: Record<string, FormSettingsRecord>): Promise<void> {
    await this.prisma.companyModuleSettings.upsert({
      where: { companyId_moduleId: { companyId, moduleId: MODULE_ID } },
      create: {
        companyId,
        moduleId: MODULE_ID,
        settings: { records } as any,
      },
      update: {
        settings: { records } as any,
      },
    });
  }
}
