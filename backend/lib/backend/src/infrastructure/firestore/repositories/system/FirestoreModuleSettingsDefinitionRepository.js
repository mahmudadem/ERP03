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
exports.FirestoreModuleSettingsDefinitionRepository = void 0;
const admin = __importStar(require("firebase-admin"));
const InfrastructureError_1 = require("../../../errors/InfrastructureError");
class FirestoreModuleSettingsDefinitionRepository {
    constructor(db) {
        this.db = db;
        this.collectionName = 'moduleSettingsDefinitions';
    }
    mapDoc(doc) {
        const data = doc.data() || {};
        return {
            moduleId: data.moduleId || doc.id,
            fields: data.fields || [],
            createdBy: data.createdBy || '',
            updatedAt: data.updatedAt instanceof admin.firestore.Timestamp ? data.updatedAt.toDate() : new Date(),
        };
    }
    async listDefinitions() {
        try {
            const snapshot = await this.db.collection(this.collectionName).get();
            return snapshot.docs.map((doc) => this.mapDoc(doc));
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to list module settings definitions', error);
        }
    }
    async getDefinition(moduleId) {
        try {
            const doc = await this.db.collection(this.collectionName).doc(moduleId).get();
            if (!doc.exists)
                return null;
            return this.mapDoc(doc);
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to get module settings definition', error);
        }
    }
    async createDefinition(def) {
        try {
            await this.db.collection(this.collectionName).doc(def.moduleId).set(def);
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to create module settings definition', error);
        }
    }
    async updateDefinition(moduleId, def) {
        try {
            await this.db.collection(this.collectionName).doc(moduleId).set(def, { merge: true });
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to update module settings definition', error);
        }
    }
    async deleteDefinition(moduleId) {
        try {
            await this.db.collection(this.collectionName).doc(moduleId).delete();
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to delete module settings definition', error);
        }
    }
}
exports.FirestoreModuleSettingsDefinitionRepository = FirestoreModuleSettingsDefinitionRepository;
//# sourceMappingURL=FirestoreModuleSettingsDefinitionRepository.js.map