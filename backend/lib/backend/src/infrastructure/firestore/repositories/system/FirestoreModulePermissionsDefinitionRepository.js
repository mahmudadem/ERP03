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
exports.FirestoreModulePermissionsDefinitionRepository = void 0;
const admin = __importStar(require("firebase-admin"));
const InfrastructureError_1 = require("../../../errors/InfrastructureError");
class FirestoreModulePermissionsDefinitionRepository {
    constructor(db) {
        this.db = db;
        this.collection = 'modulePermissionsDefinitions';
        this.cache = new Map();
    }
    mapDoc(doc) {
        var _a;
        const data = doc.data() || {};
        return {
            moduleId: data.moduleId || doc.id,
            permissions: data.permissions || [],
            autoAttachToRoles: data.autoAttachToRoles || [],
            createdAt: data.createdAt instanceof admin.firestore.Timestamp ? data.createdAt.toDate() : new Date(),
            updatedAt: data.updatedAt instanceof admin.firestore.Timestamp ? data.updatedAt.toDate() : new Date(),
            permissionsDefined: (_a = data.permissionsDefined) !== null && _a !== void 0 ? _a : true
        };
    }
    setCache(def) {
        this.cache.set(def.moduleId, def);
    }
    invalidate(moduleId) {
        if (moduleId)
            this.cache.delete(moduleId);
        else
            this.cache.clear();
    }
    async list() {
        try {
            const snapshot = await this.db.collection(this.collection).get();
            const defs = snapshot.docs.map((d) => this.mapDoc(d));
            defs.forEach((d) => this.setCache(d));
            return defs;
        }
        catch (err) {
            throw new InfrastructureError_1.InfrastructureError('Failed to list module permissions definitions', err);
        }
    }
    async getByModuleId(moduleId) {
        const cached = this.cache.get(moduleId);
        if (cached)
            return cached;
        try {
            const doc = await this.db.collection(this.collection).doc(moduleId).get();
            if (!doc.exists)
                return null;
            const def = this.mapDoc(doc);
            this.setCache(def);
            return def;
        }
        catch (err) {
            throw new InfrastructureError_1.InfrastructureError('Failed to get module permissions definition', err);
        }
    }
    async create(def) {
        try {
            await this.db.collection(this.collection).doc(def.moduleId).set(def);
            this.invalidate(def.moduleId);
        }
        catch (err) {
            throw new InfrastructureError_1.InfrastructureError('Failed to create module permissions definition', err);
        }
    }
    async update(moduleId, partial) {
        try {
            await this.db.collection(this.collection).doc(moduleId).set(partial, { merge: true });
            this.invalidate(moduleId);
        }
        catch (err) {
            throw new InfrastructureError_1.InfrastructureError('Failed to update module permissions definition', err);
        }
    }
    async delete(moduleId) {
        try {
            await this.db.collection(this.collection).doc(moduleId).delete();
            this.invalidate(moduleId);
        }
        catch (err) {
            throw new InfrastructureError_1.InfrastructureError('Failed to delete module permissions definition', err);
        }
    }
}
exports.FirestoreModulePermissionsDefinitionRepository = FirestoreModulePermissionsDefinitionRepository;
//# sourceMappingURL=FirestoreModulePermissionsDefinitionRepository.js.map