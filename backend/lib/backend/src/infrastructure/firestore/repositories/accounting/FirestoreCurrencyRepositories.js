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
    constructor(settingsResolver) {
        this.settingsResolver = settingsResolver;
        this.globalCollectionPath = 'system_metadata/currencies/items';
    }
    getCollection(companyId) {
        if (companyId) {
            return this.settingsResolver.getCurrenciesCollection(companyId);
        }
        return this.settingsResolver.db.collection(this.globalCollectionPath);
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
    async findAll(companyId) {
        const snapshot = await this.getCollection(companyId).get();
        return snapshot.docs.map(doc => this.toDomain(doc.data()));
    }
    async findActive(companyId) {
        const snapshot = await this.getCollection(companyId).orderBy('code').get();
        return snapshot.docs
            .map(doc => this.toDomain(doc.data()))
            .filter(c => c.isActive);
    }
    async findByCode(code, companyId) {
        const doc = await this.getCollection(companyId).doc(code.toUpperCase()).get();
        if (!doc.exists)
            return null;
        return this.toDomain(doc.data());
    }
    async save(currency) {
        // Always save to global if no companyId (though saving is rare via this repo)
        await this.settingsResolver.db.collection(this.globalCollectionPath)
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
        const batch = this.settingsResolver.db.batch();
        for (const currency of currencies) {
            const ref = this.settingsResolver.db.collection(this.globalCollectionPath).doc(currency.code);
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
    constructor(settingsResolver) {
        this.settingsResolver = settingsResolver;
    }
    getCollection(companyId) {
        return this.settingsResolver.getCurrenciesCollection(companyId);
    }
    toRecord(doc) {
        var _a, _b;
        const data = doc.data();
        const code = data.currencyCode || data.code || doc.id;
        return {
            id: doc.id,
            companyId: data.companyId,
            currencyCode: code,
            isEnabled: (_a = data.isEnabled) !== null && _a !== void 0 ? _a : true,
            isBase: (_b = data.isBase) !== null && _b !== void 0 ? _b : false,
            enabledAt: data.enabledAt instanceof firestore_1.Timestamp ? data.enabledAt.toDate() : new Date(),
            disabledAt: data.disabledAt instanceof firestore_1.Timestamp ? data.disabledAt.toDate() : null,
        };
    }
    async findEnabledByCompany(companyId) {
        const coll = this.getCollection(companyId);
        let snapshot = await coll.where('isEnabled', '==', true).get();
        if (snapshot.empty) {
            // Trigger self-healing if empty
            const base = await this.getBaseCurrency(companyId);
            if (base) {
                // Re-fetch now that it's repaired
                snapshot = await coll.where('isEnabled', '==', true).get();
            }
        }
        return snapshot.docs.map(doc => this.toRecord(doc));
    }
    async findAllByCompany(companyId) {
        const coll = this.getCollection(companyId);
        let snapshot = await coll.get();
        // Migration Fallback (identical logic)
        if (snapshot.empty) {
            const legacyPaths = ['company_currencies', 'currencies'];
            let legacyDocs = [];
            for (const path of legacyPaths) {
                const legacyColl = this.settingsResolver.db.collection('companies').doc(companyId).collection(path);
                const legacySnap = await legacyColl.get();
                if (!legacySnap.empty) {
                    legacyDocs = legacySnap.docs;
                    break;
                }
            }
            if (legacyDocs.length > 0) {
                return legacyDocs.map(doc => this.toRecord(doc));
            }
        }
        return snapshot.docs.map(doc => this.toRecord(doc));
    }
    async isEnabled(companyId, currencyCode) {
        var _a, _b;
        const docId = currencyCode.toUpperCase();
        const doc = await this.getCollection(companyId).doc(docId).get();
        if (!doc.exists)
            return false;
        return (_b = (_a = doc.data()) === null || _a === void 0 ? void 0 : _a.isEnabled) !== null && _b !== void 0 ? _b : false;
    }
    async enable(companyId, currencyCode) {
        const code = currencyCode.toUpperCase();
        const docId = code;
        const now = new Date();
        await this.getCollection(companyId).doc(docId).set({
            companyId,
            currencyCode: code,
            code: code,
            isEnabled: true,
            isBase: false,
            enabledAt: firestore_1.Timestamp.fromDate(now),
            disabledAt: null,
        }, { merge: true });
        return {
            id: docId,
            companyId,
            currencyCode: code,
            isEnabled: true,
            isBase: false,
            enabledAt: now,
            disabledAt: null,
        };
    }
    async setBaseCurrency(companyId, currencyCode) {
        const code = currencyCode.toUpperCase();
        const coll = this.getCollection(companyId);
        // Use a transaction or batch to ensure only one is base
        const db = this.settingsResolver.db;
        const batch = db.batch();
        // 1. Unset existing base
        const currentBase = await coll.where('isBase', '==', true).get();
        currentBase.docs.forEach(doc => {
            batch.update(doc.ref, { isBase: false });
        });
        // 2. Set new base (and enable it if not already)
        const newBaseRef = coll.doc(code);
        batch.set(newBaseRef, {
            companyId,
            currencyCode: code,
            code: code,
            isEnabled: true,
            isBase: true,
            enabledAt: firestore_1.FieldValue.serverTimestamp()
        }, { merge: true });
        await batch.commit();
    }
    async disable(companyId, currencyCode) {
        const docId = currencyCode.toUpperCase();
        await this.getCollection(companyId).doc(docId).update({
            isEnabled: false,
            disabledAt: firestore_1.Timestamp.fromDate(new Date()),
        });
    }
    async getBaseCurrency(companyId) {
        var _a;
        const coll = this.getCollection(companyId);
        const snapshot = await coll.where('isBase', '==', true).get();
        if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            return data.currencyCode || data.code || snapshot.docs[0].id;
        }
        // FALLBACK & REPAIR: Check company profile
        console.log(`[FirestoreCompanyCurrencyRepository] No currency marked as isBase for ${companyId}. Checking company profile...`);
        const companyDoc = await this.settingsResolver.db.collection('companies').doc(companyId).get();
        const profileBase = (_a = companyDoc.data()) === null || _a === void 0 ? void 0 : _a.baseCurrency;
        if (profileBase) {
            console.log(`[FirestoreCompanyCurrencyRepository] Found base ${profileBase} in profile. Attempting repair...`);
            // Repair: mark this currency as base if it exists, or create it
            const currRef = coll.doc(profileBase);
            await currRef.set({
                companyId,
                currencyCode: profileBase,
                code: profileBase,
                isEnabled: true,
                isBase: true,
                updatedAt: firestore_1.FieldValue.serverTimestamp()
            }, { merge: true });
            return profileBase;
        }
        return null;
    }
}
exports.FirestoreCompanyCurrencyRepository = FirestoreCompanyCurrencyRepository;
//# sourceMappingURL=FirestoreCurrencyRepositories.js.map