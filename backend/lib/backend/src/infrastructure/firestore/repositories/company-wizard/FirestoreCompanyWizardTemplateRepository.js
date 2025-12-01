"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreCompanyWizardTemplateRepository = void 0;
const InfrastructureError_1 = require("../../../errors/InfrastructureError");
class FirestoreCompanyWizardTemplateRepository {
    constructor(db) {
        this.db = db;
        this.collectionName = 'system_company_wizard_templates';
    }
    mapStep(step) {
        var _a;
        return {
            id: step.id,
            titleEn: step.titleEn,
            titleAr: step.titleAr,
            titleTr: step.titleTr,
            order: step.order,
            modelKey: (_a = step.modelKey) !== null && _a !== void 0 ? _a : null,
            fields: Array.isArray(step.fields) ? step.fields.map((f) => ({
                id: f.id,
                labelEn: f.labelEn,
                labelAr: f.labelAr,
                labelTr: f.labelTr,
                type: f.type,
                required: !!f.required,
                optionsSource: f.optionsSource
            })) : []
        };
    }
    mapDoc(doc) {
        const data = doc.data() || {};
        return {
            id: data.id || doc.id,
            name: data.name,
            models: data.models || [],
            steps: Array.isArray(data.steps) ? data.steps.map((s) => this.mapStep(s)) : [],
            isDefault: !!data.isDefault
        };
    }
    async getDefaultTemplateForModel(model) {
        try {
            const snapshot = await this.db.collection(this.collectionName)
                .where('models', 'array-contains', model)
                .where('isDefault', '==', true)
                .limit(1)
                .get();
            if (snapshot.empty) {
                // Fallback default template for local/dev when none exists in Firestore
                return {
                    id: 'default-wizard',
                    name: 'Default Wizard',
                    models: [model],
                    steps: [
                        {
                            id: 'basic-info',
                            titleEn: 'Basic Info',
                            titleAr: 'معلومات أساسية',
                            titleTr: 'Temel Bilgi',
                            order: 1,
                            modelKey: model,
                            fields: []
                        }
                    ],
                    isDefault: true
                };
            }
            return this.mapDoc(snapshot.docs[0]);
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to load default company wizard template', error);
        }
    }
    async getById(id) {
        try {
            const doc = await this.db.collection(this.collectionName).doc(id).get();
            if (!doc.exists) {
                if (id === 'default-wizard') {
                    return {
                        id: 'default-wizard',
                        name: 'Default Wizard',
                        models: [],
                        steps: [
                            {
                                id: 'basic-info',
                                titleEn: 'Basic Info',
                                titleAr: 'معلومات أساسية',
                                titleTr: 'Temel Bilgi',
                                order: 1,
                                modelKey: null,
                                fields: []
                            }
                        ],
                        isDefault: true
                    };
                }
                return null;
            }
            return this.mapDoc(doc);
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to load company wizard template', error);
        }
    }
    async listAll() {
        try {
            const snapshot = await this.db.collection(this.collectionName).get();
            return snapshot.docs.map((doc) => this.mapDoc(doc));
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to list company wizard templates', error);
        }
    }
}
exports.FirestoreCompanyWizardTemplateRepository = FirestoreCompanyWizardTemplateRepository;
//# sourceMappingURL=FirestoreCompanyWizardTemplateRepository.js.map