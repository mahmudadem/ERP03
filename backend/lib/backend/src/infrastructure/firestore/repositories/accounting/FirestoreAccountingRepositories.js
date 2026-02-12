"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreExchangeRateRepository = exports.FirestoreCostCenterRepository = void 0;
const CostCenter_1 = require("../../../../domain/accounting/entities/CostCenter");
const ExchangeRate_1 = require("../../../../domain/accounting/entities/ExchangeRate");
const firestore_1 = require("firebase-admin/firestore");
// Simple Inline Mappers for brevity in this consolidated file or import from AccountingMappers
class CostCenterMapper {
    static toDomain(id, d) {
        var _a, _b, _c, _d;
        return new CostCenter_1.CostCenter(id, d.companyId, d.name, d.code, d.description || null, d.parentId || null, d.status || CostCenter_1.CostCenterStatus.ACTIVE, ((_b = (_a = d.createdAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || new Date(), d.createdBy || '', ((_d = (_c = d.updatedAt) === null || _c === void 0 ? void 0 : _c.toDate) === null || _d === void 0 ? void 0 : _d.call(_c)) || new Date(), d.updatedBy || '');
    }
    static toPersistence(e) {
        return {
            companyId: e.companyId,
            name: e.name,
            code: e.code,
            description: e.description || null,
            parentId: e.parentId || null,
            status: e.status,
            createdAt: e.createdAt ? firestore_1.Timestamp.fromDate(e.createdAt) : firestore_1.Timestamp.fromDate(new Date()),
            createdBy: e.createdBy || null,
            updatedAt: e.updatedAt ? firestore_1.Timestamp.fromDate(e.updatedAt) : firestore_1.Timestamp.fromDate(new Date()),
            updatedBy: e.updatedBy || null
        };
    }
}
class ExchangeRateMapper {
    static toDomain(id, d) {
        var _a, _b, _c, _d;
        return new ExchangeRate_1.ExchangeRate({
            id: id,
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
            companyId: e.companyId,
            fromCurrency: e.fromCurrency,
            toCurrency: e.toCurrency,
            rate: e.rate,
            date: firestore_1.Timestamp.fromDate(e.date),
            source: e.source,
            createdAt: firestore_1.Timestamp.fromDate(e.createdAt),
            createdBy: e.createdBy || null,
        };
    }
}
class FirestoreCostCenterRepository {
    constructor(settingsResolver) {
        this.settingsResolver = settingsResolver;
        this.collectionName = 'cost_centers';
    }
    getCollection(companyId) {
        return this.settingsResolver.getCostCentersCollection(companyId);
    }
    async create(costCenter) {
        const col = this.getCollection(costCenter.companyId);
        await col.doc(costCenter.id).set(CostCenterMapper.toPersistence(costCenter));
        return costCenter;
    }
    async update(costCenter) {
        const col = this.getCollection(costCenter.companyId);
        await col.doc(costCenter.id).set(CostCenterMapper.toPersistence(costCenter), { merge: true });
        return costCenter;
    }
    async findById(companyId, id) {
        const doc = await this.getCollection(companyId).doc(id).get();
        if (!doc.exists)
            return null;
        return CostCenterMapper.toDomain(doc.id, doc.data());
    }
    async findByCode(companyId, code) {
        const snap = await this.getCollection(companyId).where('code', '==', code).limit(1).get();
        if (snap.empty)
            return null;
        const d = snap.docs[0];
        return CostCenterMapper.toDomain(d.id, d.data());
    }
    async findAll(companyId) {
        const snap = await this.getCollection(companyId).orderBy('code').get();
        return snap.docs.map(d => CostCenterMapper.toDomain(d.id, d.data()));
    }
    async delete(companyId, id) {
        await this.getCollection(companyId).doc(id).delete();
    }
}
exports.FirestoreCostCenterRepository = FirestoreCostCenterRepository;
class FirestoreExchangeRateRepository {
    constructor(settingsResolver) {
        this.settingsResolver = settingsResolver;
        this.collectionName = 'exchange_rates';
    }
    getCollection(companyId) {
        return this.settingsResolver.getExchangeRatesCollection(companyId);
    }
    async save(rate) {
        const col = this.getCollection(rate.companyId);
        await col.doc(rate.id).set(ExchangeRateMapper.toPersistence(rate));
    }
    /** @deprecated Use save() instead */
    async setRate(rate) {
        return this.save(rate);
    }
    /** @deprecated Use getLatestRate() instead */
    async getRate(from, to, date) {
        // This deprecated method lacks companyId. In a multi-tenant system, this is a bug.
        // Transitioning to scoped lookup.
        throw new Error("getRate() without companyId is deprecated and unsupported. Use getLatestRate().");
    }
    async getLatestRate(companyId, fromCurrency, toCurrency, date) {
        const dateStart = new Date(date);
        dateStart.setHours(0, 0, 0, 0);
        const dateEnd = new Date(date);
        dateEnd.setHours(23, 59, 59, 999);
        const snap = await this.getCollection(companyId)
            .where('fromCurrency', '==', fromCurrency.toUpperCase())
            .where('toCurrency', '==', toCurrency.toUpperCase())
            .where('date', '>=', firestore_1.Timestamp.fromDate(dateStart))
            .where('date', '<=', firestore_1.Timestamp.fromDate(dateEnd))
            .orderBy('date', 'desc')
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();
        if (snap.empty)
            return null;
        return ExchangeRateMapper.toDomain(snap.docs[0].id, snap.docs[0].data());
    }
    async getRatesForDate(companyId, fromCurrency, toCurrency, date) {
        const dateStart = new Date(date);
        dateStart.setHours(0, 0, 0, 0);
        const dateEnd = new Date(date);
        dateEnd.setHours(23, 59, 59, 999);
        const snap = await this.getCollection(companyId)
            .where('fromCurrency', '==', fromCurrency.toUpperCase())
            .where('toCurrency', '==', toCurrency.toUpperCase())
            .where('date', '>=', firestore_1.Timestamp.fromDate(dateStart))
            .where('date', '<=', firestore_1.Timestamp.fromDate(dateEnd))
            .orderBy('date', 'desc')
            .orderBy('createdAt', 'desc')
            .get();
        return snap.docs.map(d => ExchangeRateMapper.toDomain(d.id, d.data()));
    }
    async getRecentRates(companyId, fromCurrency, toCurrency, limit = 10) {
        let query = this.getCollection(companyId);
        if (fromCurrency) {
            query = query.where('fromCurrency', '==', fromCurrency.toUpperCase());
        }
        if (toCurrency) {
            query = query.where('toCurrency', '==', toCurrency.toUpperCase());
        }
        const snap = await query
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();
        return snap.docs.map(d => ExchangeRateMapper.toDomain(d.id, d.data()));
    }
    async getMostRecentRate(companyId, fromCurrency, toCurrency) {
        const snap = await this.getCollection(companyId)
            .where('fromCurrency', '==', fromCurrency.toUpperCase())
            .where('toCurrency', '==', toCurrency.toUpperCase())
            .orderBy('date', 'desc')
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();
        if (snap.empty)
            return null;
        return ExchangeRateMapper.toDomain(snap.docs[0].id, snap.docs[0].data());
    }
    async getMostRecentRateBeforeDate(companyId, fromCurrency, toCurrency, date) {
        const dateCeiling = new Date(date);
        dateCeiling.setHours(23, 59, 59, 999);
        const snap = await this.getCollection(companyId)
            .where('fromCurrency', '==', fromCurrency.toUpperCase())
            .where('toCurrency', '==', toCurrency.toUpperCase())
            .where('date', '<=', firestore_1.Timestamp.fromDate(dateCeiling))
            .orderBy('date', 'desc')
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();
        if (snap.empty)
            return null;
        return ExchangeRateMapper.toDomain(snap.docs[0].id, snap.docs[0].data());
    }
}
exports.FirestoreExchangeRateRepository = FirestoreExchangeRateRepository;
//# sourceMappingURL=FirestoreAccountingRepositories.js.map