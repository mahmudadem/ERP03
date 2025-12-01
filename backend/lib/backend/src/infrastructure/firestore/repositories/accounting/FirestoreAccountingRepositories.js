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
    static toDomain(d) { var _a, _b; return new ExchangeRate_1.ExchangeRate(d.id, d.fromCurrency, d.toCurrency, d.rate, (_b = (_a = d.date) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)); }
    static toPersistence(e) { return Object.assign(Object.assign({}, e), { date: admin.firestore.Timestamp.fromDate(e.date) }); }
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
    async setRate(rate) { return this.save(rate); }
    async getRate(from, to, date) {
        // MVP: Simplified query, ignoring date range for exact match or latest
        const snap = await this.db.collection(this.collectionName)
            .where('fromCurrency', '==', from)
            .where('toCurrency', '==', to)
            .orderBy('date', 'desc')
            .limit(1)
            .get();
        if (snap.empty)
            return null;
        return this.toDomain(snap.docs[0].data());
    }
}
exports.FirestoreExchangeRateRepository = FirestoreExchangeRateRepository;
//# sourceMappingURL=FirestoreAccountingRepositories.js.map