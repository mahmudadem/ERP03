"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreCompanyModuleSettingsRepository = void 0;
const admin = __importStar(require("firebase-admin"));
const InfrastructureError_1 = require("../../../errors/InfrastructureError");
class FirestoreCompanyModuleSettingsRepository {
    constructor(db) {
        this.db = db;
    }
    collection(companyId) {
        return this.db.collection('companies').doc(companyId).collection('moduleSettings');
    }
    async getSettings(companyId, moduleId) {
        try {
            const doc = await this.collection(companyId).doc(moduleId).get();
            if (!doc.exists)
                return null;
            return doc.data() || null;
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to get company module settings', error);
        }
    }
    async saveSettings(companyId, moduleId, settings, userId) {
        try {
            await this.collection(companyId).doc(moduleId).set(Object.assign(Object.assign({}, settings), { updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: userId }));
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to save company module settings', error);
        }
    }
    async ensureModuleIsActivated(companyId, moduleId) {
        try {
            const moduleDoc = await this.db.collection('companies').doc(companyId).collection('modules').doc(moduleId).get();
            if (!moduleDoc.exists) {
                throw new Error('Module not activated for this company');
            }
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to verify module activation', error);
        }
    }
}
exports.FirestoreCompanyModuleSettingsRepository = FirestoreCompanyModuleSettingsRepository;
//# sourceMappingURL=FirestoreCompanyModuleSettingsRepository.js.map