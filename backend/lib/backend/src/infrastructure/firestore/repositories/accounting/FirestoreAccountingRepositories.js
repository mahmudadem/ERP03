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
exports.FirestoreExchangeRateRepository = exports.FirestoreCostCenterRepository = void 0;
const BaseFirestoreRepository_1 = require("../BaseFirestoreRepository");
const CostCenter_1 = require("../../../../domain/accounting/entities/CostCenter");
const ExchangeRate_1 = require("../../../../domain/accounting/entities/ExchangeRate");
const admin = __importStar(require("firebase-admin"));
// Simple Inline Mappers for brevity in this consolidated file or import from AccountingMappers
class CostCenterMapper {
    static toDomain(d) { return new CostCenter_1.CostCenter(d.id, d.companyId, d.name, d.code, d.parentId); }
    static toPersistence(e) { return Object.assign({}, e); }
}
class ExchangeRateMapper {
    static toDomain(d) {
        var _a, _b, _c, _d;
        return new ExchangeRate_1.ExchangeRate({
            id: d.id,
            companyId: d.companyId || '',
            fromCurrency: d.fromCurrency,
            toCurrency: d.toCurrency,
            rate: d.rate,
            date: ((_b = (_a = d.date) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || new Date(d.date),
            source: d.source || 'MANUAL',
            createdAt: ((_d = (_c = d.createdAt) === null || _c === void 0 ? void 0 : _c.toDate) === null || _d === void 0 ? void 0 : _d.call(_c)) || new Date(),
            createdBy: d.createdBy,
        });
    }
    static toPersistence(e) {
        return {
            id: e.id,
            companyId: e.companyId,
            fromCurrency: e.fromCurrency,
            toCurrency: e.toCurrency,
            rate: e.rate,
            date: admin.firestore.Timestamp.fromDate(e.date),
            source: e.source,
            createdAt: admin.firestore.Timestamp.fromDate(e.createdAt),
            createdBy: e.createdBy,
        };
    }
}
class FirestoreCostCenterRepository extends BaseFirestoreRepository_1.BaseFirestoreRepository {
    constructor() {
        super(...arguments);
        this.collectionName = 'cost_centers';
        this.toDomain = CostCenterMapper.toDomain;
        this.toPersistence = CostCenterMapper.toPersistence;
    }
    async createCostCenter(costCenter) { return this.save(costCenter); }
    async updateCostCenter(id, data) {
        await this.db.collection(this.collectionName).doc(id).update(data);
    }
    async getCostCenter(id) { return this.findById(id); }
    async getCompanyCostCenters(companyId) {
        const snap = await this.db.collection(this.collectionName).where('companyId', '==', companyId).get();
        return snap.docs.map(d => this.toDomain(d.data()));
    }
}
exports.FirestoreCostCenterRepository = FirestoreCostCenterRepository;
class FirestoreExchangeRateRepository extends BaseFirestoreRepository_1.BaseFirestoreRepository {
    constructor() {
        super(...arguments);
        this.collectionName = 'exchange_rates';
        this.toDomain = ExchangeRateMapper.toDomain;
        this.toPersistence = ExchangeRateMapper.toPersistence;
    }
    async save(rate) {
        return super.save(rate);
    }
    /** @deprecated Use save() instead */
    async setRate(rate) {
        return this.save(rate);
    }
    /** @deprecated Use getLatestRate() instead */
    async getRate(from, to, date) {
        const snap = await this.db.collection(this.collectionName)
            .where('fromCurrency', '==', from)
            .where('toCurrency', '==', to)
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();
        if (snap.empty)
            return null;
        return this.toDomain(snap.docs[0].data());
    }
    async getLatestRate(companyId, fromCurrency, toCurrency, date) {
        const dateStart = new Date(date);
        dateStart.setHours(0, 0, 0, 0);
        const dateEnd = new Date(date);
        dateEnd.setHours(23, 59, 59, 999);
        const snap = await this.db.collection(this.collectionName)
            .where('companyId', '==', companyId)
            .where('fromCurrency', '==', fromCurrency.toUpperCase())
            .where('toCurrency', '==', toCurrency.toUpperCase())
            .where('date', '>=', admin.firestore.Timestamp.fromDate(dateStart))
            .where('date', '<=', admin.firestore.Timestamp.fromDate(dateEnd))
            .orderBy('date', 'desc')
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();
        if (snap.empty)
            return null;
        return this.toDomain(snap.docs[0].data());
    }
    async getRatesForDate(companyId, fromCurrency, toCurrency, date) {
        const dateStart = new Date(date);
        dateStart.setHours(0, 0, 0, 0);
        const dateEnd = new Date(date);
        dateEnd.setHours(23, 59, 59, 999);
        const snap = await this.db.collection(this.collectionName)
            .where('companyId', '==', companyId)
            .where('fromCurrency', '==', fromCurrency.toUpperCase())
            .where('toCurrency', '==', toCurrency.toUpperCase())
            .where('date', '>=', admin.firestore.Timestamp.fromDate(dateStart))
            .where('date', '<=', admin.firestore.Timestamp.fromDate(dateEnd))
            .orderBy('date', 'desc')
            .orderBy('createdAt', 'desc')
            .get();
        return snap.docs.map(d => this.toDomain(d.data()));
    }
    async getRecentRates(companyId, fromCurrency, toCurrency, limit = 10) {
        const snap = await this.db.collection(this.collectionName)
            .where('companyId', '==', companyId)
            .where('fromCurrency', '==', fromCurrency.toUpperCase())
            .where('toCurrency', '==', toCurrency.toUpperCase())
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();
        return snap.docs.map(d => this.toDomain(d.data()));
    }
    async getMostRecentRate(companyId, fromCurrency, toCurrency) {
        const snap = await this.db.collection(this.collectionName)
            .where('companyId', '==', companyId)
            .where('fromCurrency', '==', fromCurrency.toUpperCase())
            .where('toCurrency', '==', toCurrency.toUpperCase())
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();
        if (snap.empty)
            return null;
        return this.toDomain(snap.docs[0].data());
    }
}
exports.FirestoreExchangeRateRepository = FirestoreExchangeRateRepository;
//# sourceMappingURL=FirestoreAccountingRepositories.js.map