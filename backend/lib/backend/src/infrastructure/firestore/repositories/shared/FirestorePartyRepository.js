"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestorePartyRepository = void 0;
const SharedMappers_1 = require("../../mappers/SharedMappers");
const SharedFirestorePaths_1 = require("./SharedFirestorePaths");
class FirestorePartyRepository {
    constructor(db) {
        this.db = db;
    }
    collection(companyId) {
        return (0, SharedFirestorePaths_1.getSharedCollection)(this.db, companyId, 'parties');
    }
    async resolveRefById(companyId, id) {
        const doc = await this.collection(companyId).doc(id).get();
        if (!doc.exists)
            return null;
        return doc.ref;
    }
    applyListOptions(query, opts) {
        let ref = query;
        if (opts === null || opts === void 0 ? void 0 : opts.offset)
            ref = ref.offset(opts.offset);
        if (opts === null || opts === void 0 ? void 0 : opts.limit)
            ref = ref.limit(opts.limit);
        return ref;
    }
    async create(party) {
        await this.collection(party.companyId).doc(party.id).set(SharedMappers_1.PartyMapper.toPersistence(party));
    }
    async update(party) {
        await this.collection(party.companyId).doc(party.id).set(SharedMappers_1.PartyMapper.toPersistence(party), { merge: true });
    }
    async getById(companyId, id) {
        const ref = await this.resolveRefById(companyId, id);
        if (!ref)
            return null;
        const doc = await ref.get();
        if (!doc.exists)
            return null;
        return SharedMappers_1.PartyMapper.toDomain(doc.data());
    }
    async getByCode(companyId, code) {
        const snap = await this.collection(companyId).where('code', '==', code).limit(1).get();
        if (snap.empty)
            return null;
        return SharedMappers_1.PartyMapper.toDomain(snap.docs[0].data());
    }
    async list(companyId, opts) {
        let query = this.collection(companyId);
        if (opts === null || opts === void 0 ? void 0 : opts.role)
            query = query.where('roles', 'array-contains', opts.role);
        if ((opts === null || opts === void 0 ? void 0 : opts.active) !== undefined)
            query = query.where('active', '==', opts.active);
        query = query.orderBy('displayName', 'asc');
        query = this.applyListOptions(query, opts);
        const snap = await query.get();
        return snap.docs.map((doc) => SharedMappers_1.PartyMapper.toDomain(doc.data()));
    }
    async delete(companyId, id) {
        const ref = await this.resolveRefById(companyId, id);
        if (!ref)
            return;
        await ref.delete();
    }
}
exports.FirestorePartyRepository = FirestorePartyRepository;
//# sourceMappingURL=FirestorePartyRepository.js.map