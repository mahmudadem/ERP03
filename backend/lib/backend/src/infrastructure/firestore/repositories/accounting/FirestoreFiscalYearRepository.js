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
exports.FirestoreFiscalYearRepository = void 0;
const admin = __importStar(require("firebase-admin"));
const FiscalYear_1 = require("../../../../domain/accounting/entities/FiscalYear");
const toDomain = (id, data) => {
    var _a, _b;
    const periods = (data.periods || []).map((p) => {
        var _a, _b, _c, _d;
        return ({
            id: p.id,
            name: p.name,
            startDate: p.startDate,
            endDate: p.endDate,
            status: p.status,
            closedAt: p.closedAt ? ((_b = (_a = p.closedAt).toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || new Date(p.closedAt) : undefined,
            closedBy: p.closedBy,
            lockedAt: p.lockedAt ? ((_d = (_c = p.lockedAt).toDate) === null || _d === void 0 ? void 0 : _d.call(_c)) || new Date(p.lockedAt) : undefined,
            lockedBy: p.lockedBy,
        });
    });
    return new FiscalYear_1.FiscalYear(id, data.companyId, data.name, data.startDate, data.endDate, data.status, periods, data.closingVoucherId, data.createdAt ? ((_b = (_a = data.createdAt).toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || new Date(data.createdAt) : undefined, data.createdBy);
};
const toPersistence = (f) => ({
    companyId: f.companyId,
    name: f.name,
    startDate: f.startDate,
    endDate: f.endDate,
    status: f.status,
    periods: f.periods.map((p) => (Object.assign(Object.assign({}, p), { closedAt: p.closedAt ? admin.firestore.Timestamp.fromDate(p.closedAt) : undefined, lockedAt: p.lockedAt ? admin.firestore.Timestamp.fromDate(p.lockedAt) : undefined }))),
    closingVoucherId: f.closingVoucherId || null,
    createdAt: f.createdAt ? admin.firestore.Timestamp.fromDate(f.createdAt) : admin.firestore.FieldValue.serverTimestamp(),
    createdBy: f.createdBy || null,
});
class FirestoreFiscalYearRepository {
    constructor(db) {
        this.db = db;
    }
    collection(companyId) {
        return this.db
            .collection('companies')
            .doc(companyId)
            .collection('accounting')
            .doc('Data')
            .collection('fiscalYears');
    }
    async findByCompany(companyId) {
        const snap = await this.collection(companyId).orderBy('startDate', 'desc').get();
        return snap.docs.map((d) => toDomain(d.id, d.data()));
    }
    async findById(companyId, id) {
        const doc = await this.collection(companyId).doc(id).get();
        if (!doc.exists)
            return null;
        return toDomain(doc.id, doc.data());
    }
    async findActiveForDate(companyId, date) {
        // Query by startDate <= date, then filter by endDate in memory to avoid composite range issues
        const snap = await this.collection(companyId)
            .where('startDate', '<=', date)
            .orderBy('startDate', 'desc')
            .limit(3)
            .get();
        const match = snap.docs
            .map((d) => toDomain(d.id, d.data()))
            .find((fy) => fy.endDate >= date);
        return match || null;
    }
    async save(fiscalYear) {
        await this.collection(fiscalYear.companyId).doc(fiscalYear.id).set(toPersistence(fiscalYear));
    }
    async update(fiscalYear) {
        await this.collection(fiscalYear.companyId).doc(fiscalYear.id).set(toPersistence(fiscalYear), { merge: true });
    }
}
exports.FirestoreFiscalYearRepository = FirestoreFiscalYearRepository;
//# sourceMappingURL=FirestoreFiscalYearRepository.js.map