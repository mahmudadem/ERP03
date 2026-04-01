"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreInventoryPeriodSnapshotRepository = void 0;
const InventoryMappers_1 = require("../../mappers/InventoryMappers");
const InventoryFirestorePaths_1 = require("./InventoryFirestorePaths");
class FirestoreInventoryPeriodSnapshotRepository {
    constructor(db) {
        this.db = db;
    }
    collection(companyId) {
        return (0, InventoryFirestorePaths_1.getInventoryCollection)(this.db, companyId, 'period_snapshots');
    }
    applyPaging(query, opts) {
        let ref = query;
        if (opts === null || opts === void 0 ? void 0 : opts.offset)
            ref = ref.offset(opts.offset);
        if (opts === null || opts === void 0 ? void 0 : opts.limit)
            ref = ref.limit(opts.limit);
        return ref;
    }
    async saveSnapshot(snapshot) {
        await this.collection(snapshot.companyId)
            .doc(snapshot.id)
            .set(InventoryMappers_1.InventoryPeriodSnapshotMapper.toPersistence(snapshot));
    }
    async getSnapshot(companyId, id) {
        const doc = await this.collection(companyId).doc(id).get();
        if (!doc.exists)
            return null;
        return InventoryMappers_1.InventoryPeriodSnapshotMapper.toDomain(doc.data());
    }
    async getSnapshotByPeriodKey(companyId, periodKey) {
        const snap = await this.collection(companyId)
            .where('periodKey', '==', periodKey)
            .limit(1)
            .get();
        if (snap.empty)
            return null;
        return InventoryMappers_1.InventoryPeriodSnapshotMapper.toDomain(snap.docs[0].data());
    }
    async findNearestSnapshotForDate(companyId, asOfDate) {
        const snap = await this.collection(companyId)
            .where('periodEndDate', '<=', asOfDate)
            .orderBy('periodEndDate', 'desc')
            .limit(1)
            .get();
        if (snap.empty)
            return null;
        return InventoryMappers_1.InventoryPeriodSnapshotMapper.toDomain(snap.docs[0].data());
    }
    async listSnapshots(companyId, opts) {
        let query = this.collection(companyId).orderBy('periodEndDate', 'desc');
        query = this.applyPaging(query, opts);
        const snap = await query.get();
        return snap.docs.map((doc) => InventoryMappers_1.InventoryPeriodSnapshotMapper.toDomain(doc.data()));
    }
}
exports.FirestoreInventoryPeriodSnapshotRepository = FirestoreInventoryPeriodSnapshotRepository;
//# sourceMappingURL=FirestoreInventoryPeriodSnapshotRepository.js.map