"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreModuleRegistryRepository = void 0;
const firestore_1 = require("firebase-admin/firestore");
class FirestoreModuleRegistryRepository {
    constructor(db) {
        this.db = db;
        this.collection = 'system_metadata';
        this.subcollection = 'modules';
    }
    async getAll() {
        const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items').get();
        return snapshot.docs.map((doc) => this.toDomain(doc));
    }
    async getById(id) {
        const doc = await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).get();
        if (!doc.exists)
            return null;
        return this.toDomain(doc);
    }
    async getByCode(code) {
        const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items')
            .where('code', '==', code).get();
        if (snapshot.empty)
            return null;
        return this.toDomain(snapshot.docs[0]);
    }
    async create(module) {
        await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(module.id).set(this.withoutUndefined({
            id: module.id,
            code: module.code,
            name: module.name,
            description: module.description,
            version: module.version,
            lifecycleStatus: module.lifecycleStatus,
            runtimeStatus: module.runtimeStatus,
            implementationStatus: module.implementationStatus,
            implementationError: module.implementationError,
            implementationCheckedAt: module.implementationCheckedAt,
            releaseNotes: module.releaseNotes,
            dependencies: module.dependencies,
            businessDomainId: module.businessDomainId,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }));
    }
    async update(id, module) {
        const updateData = this.withoutUndefined(Object.assign({}, module));
        updateData.updatedAt = firestore_1.FieldValue.serverTimestamp();
        await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).update(updateData);
    }
    async updateImplementationCheck(id, status, error, checkedAt) {
        await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).update({
            implementationStatus: status,
            implementationError: error,
            implementationCheckedAt: checkedAt,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    async updateLifecycleStatus(id, status) {
        await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).update({
            lifecycleStatus: status,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    async updateRuntimeStatus(id, status) {
        await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).update({
            runtimeStatus: status,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    async delete(id) {
        await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).delete();
    }
    async getByLifecycleStatus(status) {
        const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items')
            .where('lifecycleStatus', '==', status).get();
        return snapshot.docs.map((doc) => this.toDomain(doc));
    }
    toDomain(doc) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
        const data = doc.data();
        const id = (_a = data.id) !== null && _a !== void 0 ? _a : doc.id;
        return {
            id,
            code: (_b = data.code) !== null && _b !== void 0 ? _b : id,
            name: data.name,
            description: (_c = data.description) !== null && _c !== void 0 ? _c : '',
            version: (_d = data.version) !== null && _d !== void 0 ? _d : '1.0.0',
            lifecycleStatus: (_e = data.lifecycleStatus) !== null && _e !== void 0 ? _e : 'draft',
            runtimeStatus: (_f = data.runtimeStatus) !== null && _f !== void 0 ? _f : 'available',
            implementationStatus: (_g = data.implementationStatus) !== null && _g !== void 0 ? _g : 'unchecked',
            implementationError: (_h = data.implementationError) !== null && _h !== void 0 ? _h : undefined,
            implementationCheckedAt: (_k = (_j = data.implementationCheckedAt) === null || _j === void 0 ? void 0 : _j.toDate()) !== null && _k !== void 0 ? _k : undefined,
            releaseNotes: (_l = data.releaseNotes) !== null && _l !== void 0 ? _l : undefined,
            dependencies: (_m = data.dependencies) !== null && _m !== void 0 ? _m : [],
            businessDomainId: (_o = data.businessDomainId) !== null && _o !== void 0 ? _o : undefined,
            createdAt: (_q = (_p = data.createdAt) === null || _p === void 0 ? void 0 : _p.toDate()) !== null && _q !== void 0 ? _q : new Date(),
            updatedAt: (_s = (_r = data.updatedAt) === null || _r === void 0 ? void 0 : _r.toDate()) !== null && _s !== void 0 ? _s : new Date(),
        };
    }
    withoutUndefined(data) {
        return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
    }
}
exports.FirestoreModuleRegistryRepository = FirestoreModuleRegistryRepository;
//# sourceMappingURL=FirestoreModuleRegistryRepository.js.map