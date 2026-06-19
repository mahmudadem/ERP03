import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  FormSettingsIdentity,
  FormSettingsModule,
  FormSettingsRecord,
  FormSettingsValue,
  IFormSettingsRepository,
} from '../../../../repository/interfaces/designer/IFormSettingsRepository';

const normalizeModule = (value: string): string => {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'PURCHASES') return 'PURCHASE';
  return raw || 'ACCOUNTING';
};

const settingsIdForIdentity = (identity: FormSettingsIdentity): string => {
  if (identity.formKind === 'BUILT_IN_NATIVE') {
    return `native_${String(identity.builtInFormKey || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  }
  return `form_${String(identity.formId || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
};

export class FirestoreFormSettingsRepository implements IFormSettingsRepository {
  constructor(private readonly db: admin.firestore.Firestore) {}

  private collection(companyId: string, module: FormSettingsModule) {
    return this.db
      .collection('companies')
      .doc(companyId)
      .collection(normalizeModule(module).toLowerCase())
      .doc('Settings')
      .collection('formSettings');
  }

  private toRecord(doc: admin.firestore.DocumentSnapshot): FormSettingsRecord {
    const data = doc.data() || {};
    return {
      id: doc.id,
      companyId: data.companyId,
      module: data.module,
      documentKind: data.documentKind,
      formKind: data.formKind,
      formId: data.formId || null,
      builtInFormKey: data.builtInFormKey || null,
      settings: data.settings || {},
      createdAt: data.createdAt?.toDate?.() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
      updatedBy: data.updatedBy || null,
    };
  }

  async listByCompanyAndModule(companyId: string, module: FormSettingsModule): Promise<FormSettingsRecord[]> {
    const snapshot = await this.collection(companyId, module).get();
    return snapshot.docs.map((doc) => this.toRecord(doc));
  }

  async getByIdentity(companyId: string, identity: FormSettingsIdentity): Promise<FormSettingsRecord | null> {
    const doc = await this.collection(companyId, identity.module).doc(settingsIdForIdentity(identity)).get();
    return doc.exists ? this.toRecord(doc) : null;
  }

  async upsert(
    companyId: string,
    identity: FormSettingsIdentity,
    settings: FormSettingsValue,
    updatedBy?: string | null,
  ): Promise<FormSettingsRecord> {
    const id = settingsIdForIdentity(identity);
    const ref = this.collection(companyId, identity.module).doc(id);
    const existing = await ref.get();
    await ref.set({
      companyId,
      module: normalizeModule(identity.module),
      documentKind: identity.documentKind,
      formKind: identity.formKind,
      formId: identity.formId || null,
      builtInFormKey: identity.builtInFormKey || null,
      settings,
      createdAt: existing.exists ? existing.data()?.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: updatedBy || null,
    }, { merge: true });
    const saved = await ref.get();
    return this.toRecord(saved);
  }

  async cloneSettings(companyId: string, sourceFormId: string, targetFormId: string, updatedBy?: string | null): Promise<void> {
    const modules = ['ACCOUNTING', 'SALES', 'PURCHASE'];
    for (const module of modules) {
      const snapshot = await this.collection(companyId, module)
        .where('formId', '==', sourceFormId)
        .limit(1)
        .get();
      if (snapshot.empty) continue;
      const source = this.toRecord(snapshot.docs[0]);
      await this.upsert(companyId, {
        module: source.module,
        documentKind: source.documentKind,
        formKind: 'DESIGNER_CLONE',
        formId: targetFormId,
      }, source.settings, updatedBy);
      return;
    }
  }
}
