"use strict";
/**
 * Firestore implementation for Accounting Currency Repositories
 *
 * Reads from system_metadata/currencies/items collection (global data).
 * Manages CompanyCurrency for enable/disable per company.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreCompanyCurrencyRepository = exports.FirestoreAccountingCurrencyRepository = void 0;
const firestore_1 = require("firebase-admin/firestore");
const Currency_1 = require("../../../../domain/accounting/entities/Currency");
/**
 * Firestore implementation of ICurrencyRepository for Accounting.
 * Reads global currencies from system_metadata/currencies/items collection.
 */
class FirestoreAccountingCurrencyRepository {
    constructor(db) {
        this.db = db;
        // Reads from the system_metadata pattern used by seedSystemMetadata.ts
        this.collectionPath = 'system_metadata/currencies/items';
    }
    toDomain(data) {
        var _a, _b;
        return new Currency_1.Currency({
            code: data.code,
            name: data.name,
            symbol: data.symbol,
            decimalPlaces: (_a = data.decimalPlaces) !== null && _a !== void 0 ? _a : 2,
            isActive: (_b = data.isActive) !== null && _b !== void 0 ? _b : true,
        });
    }
    async findAll() {
        const snapshot = await this.db.collection(this.collectionPath).get();
        return snapshot.docs.map(doc => this.toDomain(doc.data()));
    }
    async findActive() {
        // system_metadata currencies are all active by default
        const snapshot = await this.db.collection(this.collectionPath).orderBy('code').get();
        return snapshot.docs
            .map(doc => this.toDomain(doc.data()))
            .filter(c => c.isActive);
    }
    async findByCode(code) {
        const doc = await this.db.collection(this.collectionPath).doc(code.toUpperCase()).get();
        if (!doc.exists)
            return null;
        return this.toDomain(doc.data());
    }
    async save(currency) {
        await this.db.collection(this.collectionPath)
            .doc(currency.code)
            .set({
            code: currency.code,
            name: currency.name,
            symbol: currency.symbol,
            decimalPlaces: currency.decimalPlaces,
            isActive: currency.isActive,
            updatedAt: new Date().toISOString(),
        }, { merge: true });
    }
    async seedCurrencies(currencies) {
        const batch = this.db.batch();
        for (const currency of currencies) {
            const ref = this.db.collection(this.collectionPath).doc(currency.code);
            batch.set(ref, {
                code: currency.code,
                name: currency.name,
                symbol: currency.symbol,
                decimalPlaces: currency.decimalPlaces,
                isActive: currency.isActive,
                updatedAt: new Date().toISOString(),
            }, { merge: true });
        }
        await batch.commit();
    }
}
exports.FirestoreAccountingCurrencyRepository = FirestoreAccountingCurrencyRepository;
/**
 * Firestore implementation of ICompanyCurrencyRepository.
 * Manages enabled currencies per company (no rate fields).
 */
class FirestoreCompanyCurrencyRepository {
    constructor(db) {
        this.db = db;
        this.collectionName = 'company_currencies';
    }
    toRecord(doc) {
        var _a, _b, _c, _d, _e;
        const data = doc.data();
        return {
            id: doc.id,
            companyId: data.companyId,
            currencyCode: data.currencyCode,
            isEnabled: (_a = data.isEnabled) !== null && _a !== void 0 ? _a : true,
            enabledAt: ((_c = (_b = data.enabledAt) === null || _b === void 0 ? void 0 : _b.toDate) === null || _c === void 0 ? void 0 : _c.call(_b)) || new Date(),
            disabledAt: ((_e = (_d = data.disabledAt) === null || _d === void 0 ? void 0 : _d.toDate) === null || _e === void 0 ? void 0 : _e.call(_d)) || null,
        };
    }
    async findEnabledByCompany(companyId) {
        const snapshot = await this.db.collection(this.collectionName)
            .where('companyId', '==', companyId)
            .where('isEnabled', '==', true)
            .get();
        return snapshot.docs.map(doc => this.toRecord(doc));
    }
    async findAllByCompany(companyId) {
        const snapshot = await this.db.collection(this.collectionName)
            .where('companyId', '==', companyId)
            .get();
        return snapshot.docs.map(doc => this.toRecord(doc));
    }
    async isEnabled(companyId, currencyCode) {
        var _a, _b;
        const docId = `${companyId}_${currencyCode.toUpperCase()}`;
        const doc = await this.db.collection(this.collectionName).doc(docId).get();
        if (!doc.exists)
            return false;
        return (_b = (_a = doc.data()) === null || _a === void 0 ? void 0 : _a.isEnabled) !== null && _b !== void 0 ? _b : false;
    }
    async enable(companyId, currencyCode) {
        const code = currencyCode.toUpperCase();
        const docId = `${companyId}_${code}`;
        const now = new Date();
        await this.db.collection(this.collectionName).doc(docId).set({
            companyId,
            currencyCode: code,
            isEnabled: true,
            enabledAt: firestore_1.Timestamp.fromDate(now),
            disabledAt: null,
        }, { merge: true });
        return {
            id: docId,
            companyId,
            currencyCode: code,
            isEnabled: true,
            enabledAt: now,
            disabledAt: null,
        };
    }
    async disable(companyId, currencyCode) {
        const docId = `${companyId}_${currencyCode.toUpperCase()}`;
        await this.db.collection(this.collectionName).doc(docId).update({
            isEnabled: false,
            disabledAt: firestore_1.Timestamp.fromDate(new Date()),
        });
    }
}
exports.FirestoreCompanyCurrencyRepository = FirestoreCompanyCurrencyRepository;
//# sourceMappingURL=FirestoreCurrencyRepositories.js.map